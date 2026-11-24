import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,ledger,assign,addRow} from '../public/editor-model.js';
import {returnGuardToWork} from '../public/workspace-model.js';

test('Marking an OPEN vacation coverage cell blank preserves original leave and other dates',()=>{
 const state=initialState(),row=state.rows.find(r=>r.id==='supervisor');
 const day=4,originalGuard=row.guards[day];
 row.guards[day]='';(row.open??=Array(7).fill(false))[day]=true;
 state.events=[{id:'vacation-case',type:'Vacation',source:row.id,coverageSource:row.id,coverageStart:row.start,coverageEnd:row.end,guard:originalGuard,day,post:row.post,start:row.start,end:row.end,payment:'UNPAID',paidHours:0}];
 const open=ledger(state).find(r=>r.source===row.id&&r.day===day);
 assert.equal(open.role,'open');
 const workspace={master:initialState(),weeks:{'2026-11-29':structuredClone(state)},activeWeek:'2026-11-29',mode:'weekly'};
 const result=returnGuardToWork(workspace,state,open,{guard:'',status:'blank',billable:false,linked:false});
 assert.equal(result.state.events[0].id,'vacation-case');
 assert.ok(!ledger(result.state).some(r=>r.source===row.id&&r.day===day));
 assert.deepEqual(result.state.rows.find(r=>r.id===row.id).guards.filter((_,i)=>i!==day),row.guards.filter((_,i)=>i!==day));
 assert.equal(workspace.master.rows.find(r=>r.id===row.id).guards[day],originalGuard);
});

test('One-day blank override hides only that OPEN split coverage segment',()=>{
 const state=initialState();
 const created=addRow(state,{post:'Loading Dock',start:510,end:900,day:4,platoon:2,guard:'',status:'open',billable:false}).state;
 const source=created.rows.at(-1).id;
 const open=ledger(created).find(r=>r.source===source&&r.day===4);
 assert.ok(open);
 const changed=assign(created,open,{guard:'',status:'blank',billable:false,linked:false}).state;
 assert.ok(!ledger(changed).some(r=>r.source===source&&r.day===4));
 assert.equal(created.rows.at(-1).open[4],true);
});
