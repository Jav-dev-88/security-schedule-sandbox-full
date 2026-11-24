import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,ledger,coverPartOfOpenShift} from '../public/editor-model.js';
import {assignScheduleGuard,attendanceCoverage} from '../public/workspace-model.js';

const day=4; // Friday
function vacationFixture(){
 const state=initialState(),lobby=state.rows.find(r=>r.id==='lobby'),dock=state.rows.find(r=>r.id==='dock3');
 for(const row of [lobby,dock]){
  const guard=row.guards[day];row.guards[day]='';(row.open??=Array(7).fill(false))[day]=true;
  (state.events??=[]).push({id:'vac-'+row.id,type:'Vacation',day,source:row.id,coverageSource:row.id,coverageStart:row.start,coverageEnd:row.end,start:row.start,end:row.end,guard,payment:'PAID',paidHours:Math.min(8,(row.end-row.start)/60)});
 }
 return state;
}
function cell(state,id){
 const row=state.rows.find(r=>r.id===id);
 return {source:id,day,role:'regular',post:row.post,p:row.p,start:row.start,end:row.end,guard:'',billable:false};
}
function shifts(state,id){
 return ledger(state).filter(r=>(r.source===id||state.rows.find(row=>row.id===r.source)?.coverageParent===id)&&r.day===day);
}

test('Reopen vacation 08:30–15:00 from Blank shift without changing linked 15:00–16:30',()=>{
 let state=vacationFixture();
 const before=structuredClone(state.events);
 const lobby=ledger(state).find(r=>r.source==='lobby'&&r.day===day);
 state=assignScheduleGuard(state,lobby,{guard:'',status:'blank',billable:false,linked:false}).state;
 assert.ok(!ledger(state).some(r=>r.source==='lobby'&&r.day===day));
 state=assignScheduleGuard(state,cell(state,'lobby'),{guard:'',status:'open',billable:false,linked:false}).state;
 assert.ok(ledger(state).some(r=>r.source==='lobby'&&r.day===day&&r.role==='open'&&!r.guard));
 assert.ok(ledger(state).some(r=>r.source==='dock3'&&r.day===day&&r.role==='open'));
 assert.deepEqual(state.events.map(e=>({id:e.id,type:e.type,guard:e.guard,day:e.day,start:e.start,end:e.end})),before.map(e=>({id:e.id,type:e.type,guard:e.guard,day:e.day,start:e.start,end:e.end})));
 assert.equal(state.rows.find(r=>r.id==='lobby').open[day],true);
});

test('Old blank overrides on regular or open keys must not suppress restored OPEN',()=>{
 for(const role of ['regular','open']){
  let state=vacationFixture();
  const row=state.rows.find(r=>r.id==='lobby');
  state.overrides[[row.id,day,role,row.start,row.end].join('|')]={blank:true,note:'Previously marked blank'};
  if(role==='open')assert.ok(!ledger(state).some(r=>r.source===row.id&&r.day===day));
  state=assignScheduleGuard(state,cell(state,row.id),{guard:'',status:'open',billable:false,linked:false}).state;
  assert.ok(ledger(state).some(r=>r.source===row.id&&r.day===day&&r.role==='open'));
  assert.equal(state.events.length,2);
 }
});

test('Partial coverage calculates 3.5 worked hours and leaves 3 remaining OPEN',()=>{
 let state=vacationFixture(),master=initialState(),priorEvents=structuredClone(state.events);
 const open=ledger(state).find(r=>r.source==='lobby'&&r.day===day);
 state=coverPartOfOpenShift(state,open,{guard:'Temp Coverage A',from:510,to:720,billable:true}).state;
 const parts=shifts(state,'lobby');
 assert.equal(parts.filter(r=>r.guard==='Temp Coverage A').length,1);
 assert.equal(parts.filter(r=>r.guard==='Temp Coverage A').reduce((n,r)=>n+(r.end-r.start)/60,0),3.5);
 assert.deepEqual(parts.filter(r=>!r.guard).map(r=>[r.start,r.end]),[[720,900]]);
 assert.deepEqual(state.events,priorEvents);
 assert.equal(attendanceCoverage(state,state.events.find(e=>e.source==='lobby')),'Temp Coverage A');
 assert.equal(master.rows.find(r=>r.id==='lobby').guards[day],'Carson');
 assert.ok(shifts(state,'dock3').some(r=>r.role==='open'),'15:00–16:30 remains OPEN');
});

test('Partial coverage can be added again to an existing uncovered remainder',()=>{
 let state=vacationFixture(),open=ledger(state).find(r=>r.source==='lobby'&&r.day===day);
 state=coverPartOfOpenShift(state,open,{guard:'Temp Coverage A',from:510,to:720}).state;
 const remaining=shifts(state,'lobby').find(r=>r.role==='open');
 state=coverPartOfOpenShift(state,remaining,{guard:'Temp Coverage B',from:720,to:780}).state;
 const parts=shifts(state,'lobby');
 assert.deepEqual(parts.filter(r=>r.guard).map(r=>[r.guard,r.start,r.end]).sort((a,b)=>a[1]-b[1]),
  [['Temp Coverage A',510,720],['Temp Coverage B',720,780]]);
 assert.deepEqual(parts.filter(r=>!r.guard).map(r=>[r.start,r.end]),[[780,900]]);
 assert.match(attendanceCoverage(state,state.events.find(e=>e.source==='lobby')),/Williams/);
 assert.match(attendanceCoverage(state,state.events.find(e=>e.source==='lobby')),/Lamont/);
});

test('Reject part coverage outside OPEN interval or overlapping the replacement guard shift',()=>{
 const state=vacationFixture(),open=ledger(state).find(r=>r.source==='lobby'&&r.day===day);
 assert.throws(()=>coverPartOfOpenShift(state,open,{guard:'Williams',from:480,to:720}),/inside the OPEN/);
 assert.throws(()=>coverPartOfOpenShift(state,open,{guard:'Williams',from:720,to:950}),/inside the OPEN/);
 assert.throws(()=>coverPartOfOpenShift(state,open,{guard:'Lamont',from:510,to:900}),/recorded|shift/i);
 assert.deepEqual(ledger(state).find(r=>r.source==='lobby'&&r.day===day).role,'open');
});
