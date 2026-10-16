import test from 'node:test';import assert from 'node:assert/strict';
import {staffingHoursSummary,openHoursSummary} from '../public/schedule-summary.js';import {emptyState} from '../src/domain.js';import {ledger} from '../public/editor-model.js';import {attendanceEvent,assignScheduleGuard} from '../public/workspace-model.js';import {payrollSummary} from '../public/payroll.js';import {automaticCoverageNotes} from '../public/shift-notes.js';
const row=(id,guard,start=420,end=900)=>({id,p:2,post:id,start,end,guards:[guard,'','','','','','',''].slice(0,7),billable:false});
test('Vacation and replacement changes preserve total demand and the original vacation credit',()=>{
 const master=emptyState();master.rows=[row('Dock','A')];let state=attendanceEvent(master,ledger(master)[0],{type:'Vacation',payment:'PAID',paidHours:8});assert.equal(staffingHoursSummary(master).total,8);assert.deepEqual(staffingHoursSummary(state),{total:8,assigned:0,open:8,byPlatoon:{1:0,2:8,3:0}});
 for(const guard of ['B','C']){state=assignScheduleGuard(state,ledger(state)[0],{guard,billable:false}).state;const summary=staffingHoursSummary(state);assert.equal(summary.total,8);assert.equal(summary.assigned,8);assert.equal(summary.open,0);assert.equal(state.events.length,1);assert.equal(state.events[0].guard,'A');assert.equal(state.events[0].cover,guard);assert.equal(payrollSummary(state).find(r=>r.guard==='A').paidLeave,8);assert.equal(automaticCoverageNotes(master,state)[0].guard,guard);assert.equal(payrollSummary(state).find(r=>r.guard===guard).worked,8);}
 state=assignScheduleGuard(state,ledger(state)[0],{guard:'',billable:false}).state;assert.equal(staffingHoursSummary(state).total,8);assert.equal(staffingHoursSummary(state).open,8);assert.equal(state.events.length,1);assert.equal(automaticCoverageNotes(master,state).length,0);
});
test('Staffing separates simultaneous post positions from unique guard worked hours',()=>{
 const s=emptyState();s.rows=[row('Dock','A'),row('Lobby','A')];assert.equal(staffingHoursSummary(s).assigned,16);assert.equal(staffingHoursSummary(s).total,16);assert.equal(payrollSummary(s)[0].worked,8);assert.equal(staffingHoursSummary(s,1).total,0);
});
test('Open shift filling, split demand and off-duty holidays reconcile without counting unused rows',()=>{
 const s=emptyState();s.rows=[{...row('Open',''),open:[true,false,false,false,false,false,false]},row('Unused','')];assert.equal(staffingHoursSummary(s).total,8);assert.equal(openHoursSummary(s).total,8);
 let assigned=assignScheduleGuard(s,ledger(s)[0],{guard:'B',billable:false}).state;assert.equal(staffingHoursSummary(assigned).total,8);assert.equal(staffingHoursSummary(assigned).assigned,8);
 assigned=attendanceEvent(assigned,ledger(assigned)[0],{type:'Paid holiday — off',payment:'PAID',paidHours:8});assert.equal(staffingHoursSummary(assigned).total,0);assert.equal(staffingHoursSummary(assigned).open,0);
});
