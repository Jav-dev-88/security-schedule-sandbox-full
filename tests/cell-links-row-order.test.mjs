import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,ledger,orderedGroups,linkScheduleCells,unlinkScheduleCell,linkedCellPartner,movePlatoonRow,assign} from '../public/editor-model.js';

test('Two nonoverlapping cells can be linked without changing current guards or hours',()=>{
 const state=initialState(),first=ledger(state).find(r=>r.source==='supervisor'&&r.day===0),row=state.rows.find(r=>r.id==='supervisor');
 const other=ledger(state).find(r=>r.source!==first.source&&r.day===1);
 assert.ok(other);
 const previous=structuredClone(state);
 const linked=linkScheduleCells(state,first,other).state;
 assert.equal(linkedCellPartner(linked,first).source,other.source);
 assert.equal(linkedCellPartner(linked,other).source,first.source);
 assert.deepEqual(linked.rows,previous.rows,'linking does not rewrite any assignments');
 const unlinked=unlinkScheduleCell(linked,first).state;
 assert.equal(linkedCellPartner(unlinked,first),null);
 assert.deepEqual(unlinked.rows,previous.rows);
});

test('Cannot link overlapping same-day posts or a cell that has a leave record',()=>{
 const state=initialState(),cells=ledger(state).filter(r=>r.day===0&&r.p===2&&r.start<=480&&r.end>480&&r.role==='regular');
 assert.ok(cells.length>=2);
 assert.throws(()=>linkScheduleCells(state,cells[0],cells[1]),/overlap/i);
 const first=ledger(state)[0],second=ledger(state).find(r=>r.day!==first.day);
 state.events=[{id:'leave-link',day:first.day,source:first.source,type:'Vacation'}];
 assert.throws(()=>linkScheduleCells(state,first,second),/leave or attendance/i);
});

test('Row can move up/down only within its original platoon, and preserves assignments',()=>{
 const state=initialState();
 const original=orderedGroups(state).filter(r=>r.p===2&&r.id);
 const last=original.at(-1);
 const rows=structuredClone(state.rows);
 const moved=movePlatoonRow(state,last.id,-1).state;
 const order=orderedGroups(moved).filter(r=>r.p===2&&r.id);
 assert.equal(order.at(-2).id,last.id);
 assert.deepEqual(moved.rows,rows);
 assert.deepEqual(orderedGroups(moved).filter(r=>r.p===1).map(r=>r.id),orderedGroups(state).filter(r=>r.p===1).map(r=>r.id));
 const restored=movePlatoonRow(moved,last.id,1).state;
 assert.equal(orderedGroups(restored).filter(r=>r.p===2&&r.id).at(-1).id,last.id);
});
