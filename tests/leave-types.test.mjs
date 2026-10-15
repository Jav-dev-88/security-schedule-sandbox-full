import test from 'node:test';import assert from 'node:assert/strict';
import {newWorkspace,validateWorkspace} from '../src/domain.js';
import {attendanceTypes,customLeaveTypes,defaultLeavePayment,saveLeaveType,removeLeaveType} from '../public/leave-types.js';
import {attendanceEvent} from '../public/workspace-model.js';import {ledger} from '../public/editor-model.js';import {payrollSummary} from '../public/payroll.js';
const row=(id,start,end,p=2)=>({id,post:'Lobby',p,start,end,guards:['Guard A','','','','','',''],billable:false});
test('LOA is available by default; managers can add types and change defaults without changing leave history',()=>{
 const w=newWorkspace();assert(attendanceTypes(w).includes('LOA'));assert.equal(defaultLeavePayment(w,'LOA'),'UNPAID');
 const next=saveLeaveType(w,{name:' Bereavement ',payment:'PAID'});assert(attendanceTypes(next).includes('Bereavement'));assert(!w.leaveTypes);assert.equal(defaultLeavePayment(next,'Bereavement'),'PAID');assert.doesNotThrow(()=>validateWorkspace(next));
 const changed=saveLeaveType(next,{name:'bereavement',payment:'PENDING'});assert.equal(customLeaveTypes(changed).filter(t=>t.name==='Bereavement').length,1);assert.equal(defaultLeavePayment(changed,'Bereavement'),'PENDING');
 assert.throws(()=>saveLeaveType(w,{name:'sick',payment:'PAID'}),/already exists/);assert.throws(()=>saveLeaveType(w,{name:' ',payment:'UNPAID'}),/name/);assert.throws(()=>validateWorkspace({...w,leaveTypes:[{name:'Unsafe',payment:'WORKED'}]}),/leave type name/);
 assert(!attendanceTypes(removeLeaveType(w,'LOA')).includes('LOA'));
});
test('Custom full-shift leave opens both linked parts, credits at most eight hours and pays the cover separately',()=>{
 const w=saveLeaveType(newWorkspace(),{name:'Bereavement',payment:'PAID'});w.weeks[w.activeWeek].rows=[row('early',510,900),row('late',900,990,3)];const original=structuredClone(w.weeks[w.activeWeek]);
 const state=attendanceEvent(original,ledger(original)[0],{type:'Bereavement',payment:'PAID',paidHours:8,cover:'Guard B'},customLeaveTypes(w));assert(ledger(state).every(r=>r.guard==='Guard B'));assert.equal(state.events.length,2);assert(state.events.every(e=>e.type==='Bereavement'));const pay=payrollSummary(state);assert.equal(pay.find(r=>r.guard==='Guard A').paidLeave,8);assert.equal(pay.find(r=>r.guard==='Guard B').worked,8);
 w.weeks[w.activeWeek]=state;const removed=removeLeaveType(w,'Bereavement');assert.deepEqual(removed.weeks[w.activeWeek],state);assert.equal(payrollSummary(removed.weeks[w.activeWeek]).find(r=>r.guard==='Guard A').paidLeave,8);assert.throws(()=>attendanceEvent(original,ledger(original)[0],{type:'Not configured',payment:'UNPAID'},customLeaveTypes(w)),/Choose the leave type/);
 const loa=attendanceEvent(original,ledger(original)[0],{type:'LOA',payment:'UNPAID',paidHours:8});assert(ledger(loa).every(r=>!r.guard&&r.role==='open'));assert(loa.events.every(e=>e.type==='LOA'&&e.paidHours===0));
});
