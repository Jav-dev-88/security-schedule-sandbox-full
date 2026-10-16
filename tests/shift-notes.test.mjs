import test from 'node:test';import assert from 'node:assert/strict';
import {noteShiftOptions,saveShiftNote,validateShiftNotes} from '../public/shift-notes.js';
import {emptyState,newWorkspace,validateWorkspace} from '../src/domain.js';
import {payrollSummary} from '../public/payroll.js';
const row=(id,start,end,guard)=>({id,p:2,post:'Dock',start,end,guards:[guard,'','','','','',''],billable:false});
test('Weekly notes save shift context, edit independently, survive reassignment and never change payable hours',()=>{
 const state=emptyState();state.rows=[row('a',420,900,'Guard A')];const shift=noteShiftOptions(state)[0],before=payrollSummary(state);let next=saveShiftNote(state,shift,{kind:'Covering shift',text:'  Covered for Flores.  '});
 assert.equal(next.shiftNotes[0].text,'Covered for Flores.');assert.equal(next.shiftNotes[0].guard,'Guard A');assert.deepEqual(payrollSummary(next),before);assert.equal(state.shiftNotes,undefined);
 const id=next.shiftNotes[0].id;next.rows[0].guards[0]='Guard B';next=saveShiftNote(next,null,{kind:'Extra hours',text:'Stayed two additional hours.'},id);assert.equal(next.shiftNotes.length,1);assert.equal(next.shiftNotes[0].guard,'Guard A','Original shift context remains in the note');assert.equal(next.shiftNotes[0].text,'Stayed two additional hours.');
 assert.throws(()=>saveShiftNote(next,null,{kind:'Other',text:''},id));assert.throws(()=>saveShiftNote(next,null,{kind:'Other',text:'a'.repeat(501)},id));assert.throws(()=>saveShiftNote(next,null,{kind:'Other',text:'Missing'},'deleted-id'));
 const w=newWorkspace();w.weeks[w.activeWeek]=next;assert.doesNotThrow(()=>validateWorkspace(w));w.weeks[w.activeWeek].shiftNotes.push(next.shiftNotes[0]);assert.throws(()=>validateWorkspace(w),/Choose a shift/);
});
test('Notes combine linked 08:30–16:30 parts and reject invalid days and empty notes',()=>{
 const state=emptyState();state.rows=[row('a',510,900,'Rasheed'),{...row('b',900,990,'Rasheed'),p:3}];const options=noteShiftOptions(state);assert.equal(options.length,1);assert.equal(options[0].start,510);assert.equal(options[0].end,990);assert.equal(options[0].parts.length,2);
 const next=saveShiftNote(state,options[0],{kind:'Extra hours',text:'Covered linked shift.'});next.shiftNotes[0].day=8;assert.throws(()=>validateShiftNotes(next.shiftNotes));
});
