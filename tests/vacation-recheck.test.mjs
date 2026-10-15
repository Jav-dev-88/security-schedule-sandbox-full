import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkspace} from '../src/domain.js';
import {ledger,assign} from '../public/editor-model.js';
import {generateWeek,attendanceEvent,attendanceCoverage,assignScheduleGuard,vacationCoverageEvents,recheckVacationAssignments} from '../public/workspace-model.js';
import {payrollSummary} from '../public/payroll.js';
const row=(id,start=420,end=900)=>({id,post:'Lobby',p:2,start,end,guards:['Guard A','','','','','',''],billable:false});
const fixture=()=>{const w=newWorkspace();w.activeWeek='2026-10-18';w.master.rows=[row('one')];w.weeks[w.activeWeek]=structuredClone(w.master);w.vacations=[{id:'vacation-a',guard:'Guard A',from:'2026-10-12',to:'2026-10-18',payment:'PAID',note:'Booked'}];return w;};
test('Replacing and clearing vacation coverage keeps the original vacation and paid hours',()=>{
 let s=fixture().master;s=attendanceEvent(s,ledger(s)[0],{type:'Vacation',cover:'Guard B',payment:'PAID',paidHours:8});
 const original=structuredClone(s.events[0]);assert.equal(vacationCoverageEvents(s,ledger(s)[0]).length,1);
 s=assignScheduleGuard(s,ledger(s)[0],{guard:'Guard C',status:'staff',billable:false}).state;
 assert.equal(attendanceCoverage(s,s.events[0]),'Guard C');assert.deepEqual(s.events[0],{...original,cover:'Guard C'});
 assert.equal(payrollSummary(s).find(r=>r.guard==='Guard A').paidLeave,8);
 s=assignScheduleGuard(s,ledger(s)[0],{guard:'',billable:false}).state;
 assert.equal(ledger(s)[0].role,'open');assert.equal(attendanceCoverage(s,s.events[0]),'');assert.equal(s.events.length,1);
 assert.throws(()=>assignScheduleGuard(s,ledger(s)[0],{guard:'Guard A'}),/recorded on vacation/);
});
test('Linked vacation coverage updates both parts without recording another absence',()=>{
 let s=fixture().master;s.rows=[row('early',510,900),{...row('late',900,990),p:3}];
 s=attendanceEvent(s,ledger(s)[0],{type:'Vacation',cover:'Guard B',payment:'PAID',paidHours:8});
 s=assignScheduleGuard(s,ledger(s)[0],{guard:'Guard C',billable:false}).state;
 assert(ledger(s).every(r=>r.guard==='Guard C'));assert.equal(s.events.length,2);assert(s.events.every(e=>e.guard==='Guard A'&&e.cover==='Guard C'));assert.equal(payrollSummary(s).find(r=>r.guard==='Guard A').paidLeave,8);
});
test('Vacation recheck catches later assignments, keeps covers, avoids duplicate leave and is repeatable',()=>{
 let w=generateWeek(fixture(),'2026-10-18',{overwrite:true});assert.equal(ledger(w.weeks[w.activeWeek])[0].role,'open');
 let s=w.weeks[w.activeWeek];s=assign(s,ledger(s)[0],{guard:'Guard A',billable:false}).state;
 s.rows.push({...row('new'),start:960,end:1020});s.rows.push({...row('covered'),guards:['Guard B','','','','','','']});w.weeks[w.activeWeek]=s;
 const before=structuredClone(w),result=recheckVacationAssignments(w,w.activeWeek);assert(result.changed);assert.equal(result.openedShifts,2);
 const after=result.workspace.weeks[w.activeWeek];assert(!ledger(after).some(r=>r.guard==='Guard A'));assert(ledger(after).some(r=>r.guard==='Guard B'));
 assert.equal(after.events.filter(e=>e.coverageSource==='one').length,1);assert.deepEqual(result.workspace.master,w.master);assert.deepEqual(w,before);
 const again=recheckVacationAssignments(result.workspace,w.activeWeek);assert.equal(again.changed,false);assert.equal(again.openedShifts,0);
});
test('Recheck respects older weekly vacation entries even without a saved vacation range',()=>{
 const w=fixture();w.vacations=[];let s=attendanceEvent(w.master,ledger(w.master)[0],{type:'Vacation',payment:'UNPAID'});s=assign(s,ledger(s)[0],{guard:'Guard A'}).state;w.weeks[w.activeWeek]=s;
 const result=recheckVacationAssignments(w,w.activeWeek);assert.equal(result.openedShifts,1);assert.equal(result.workspace.weeks[w.activeWeek].events.length,1);assert(!ledger(result.workspace.weeks[w.activeWeek]).some(r=>r.guard==='Guard A'));
});
