import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,ledger,splitCell,addRow,editRowFields,orderedGroups} from '../public/editor-model.js';

test('Supervisor always remains in manually assigned Platoon 2, including split segments',()=>{
 const original=initialState();
 const supervisor=ledger(original).find(r=>r.source==='supervisor'&&r.day===0);
 assert.equal(supervisor.p,2);
 assert.equal(supervisor.start,360);
 const split=splitCell(original,supervisor,{post:'Supervisor temporary coverage',from:420,to:480,billable:false,needsCover:true}).state;
 const segments=ledger(split).filter(r=>r.source==='supervisor'&&r.day===0);
 assert.ok(segments.length>=3);
 assert.ok(segments.every(r=>r.p===2),'No split, transfer, return, or coverage may be moved by clock time');
 assert.ok(orderedGroups(split).filter(r=>r.source==='supervisor'||r.id==='supervisor').every(r=>r.p===2));
});

test('New rows require a manager-selected platoon, not a time-based guess',()=>{
 const state=initialState();
 const fields={post:'Early Supervisor',start:360,end:1020,day:0,guard:'',status:'open',billable:false};
 assert.throws(()=>addRow(state,fields),/Choose a platoon/);
 const result=addRow(state,{...fields,platoon:2}).state;
 const row=result.rows.at(-1);
 assert.equal(row.p,2);
 assert.ok(ledger(result).some(r=>r.source===row.id&&r.p===2));
});

test('Changing a shift time does not change its platoon unless explicitly selected',()=>{
 const state=initialState();
 const row=state.rows.find(r=>r.id==='supervisor');
 const changed=editRowFields(state,row.id,{start:420,end:1020}).state;
 assert.equal(changed.rows.find(r=>r.id==='supervisor').p,2);
 assert.equal(state.rows.find(r=>r.id==='supervisor').p,2);
});
