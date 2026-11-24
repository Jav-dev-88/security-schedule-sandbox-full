import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,ledger,orderedGroups,movePlatoonRow} from '../public/editor-model.js';

test('Ledger maintains first paid holiday, no billable work, and paid hours',()=>{
 const s=initialState(),row=s.rows.find(r=>r.id==='lobby');
 s.events=[
  {id:'a',type:'Paid holiday — off',source:row.id,day:0,guard:row.guards[0],start:row.start,end:row.end,payment:'PAID',paidHours:6},
  {id:'b',type:'Paid holiday — off',source:row.id,day:0,guard:row.guards[0],start:row.start,end:row.end,payment:'PAID',paidHours:3}
 ];
 const item=ledger(s).find(r=>r.source===row.id&&r.day===0);
 assert.equal(item.holidayHours,6);
 assert.equal(item.billable,false);
 assert.equal(item.note,'Paid holiday — off duty');
});

test('Ledger uses latest move and preserves coverage notes',()=>{
 const s=initialState(),row=s.rows.find(r=>r.id==='lobby');
 row.guards[0]='';
 (row.open??=Array(7).fill(false))[0]=true;
 s.moves=[
  {id:'old',day:0,start:row.start,end:row.end,source:row.id,destination:'dock2',guard:'Guard A',fromPost:row.post,toPost:'Old'},
  {id:'new',day:0,start:row.start,end:row.end,source:row.id,destination:'dock2',guard:'Guard A',fromPost:row.post,toPost:'New'}
 ];
 const shift=ledger(s).find(r=>r.source===row.id&&r.day===0);
 assert.match(shift.moveNote,/New/);
 assert.doesNotMatch(shift.moveNote,/Old/);
 assert.match(shift.note,/New/);
});

test('Manual platoon row order remains stable after repeated rendering',()=>{
 const s=initialState(),p=2;
 const original=orderedGroups(s).filter(r=>r.p===p&&r.id);
 const last=original.at(-1);
 const next=movePlatoonRow(s,last.id,-1).state;
 const list=orderedGroups(next).filter(r=>r.p===p&&r.id);
 assert.equal(list.at(-2).id,last.id);
 assert.deepEqual(list.map(r=>r.id),orderedGroups(next).filter(r=>r.p===p&&r.id).map(r=>r.id));
 assert.deepEqual(orderedGroups(next).filter(r=>r.p===1).map(r=>r.id),orderedGroups(s).filter(r=>r.p===1).map(r=>r.id));
});
