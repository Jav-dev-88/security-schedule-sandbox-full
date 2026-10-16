import test from 'node:test';import assert from 'node:assert/strict';
import {weeklyHoursBreakdown} from '../public/hours-breakdown.js';
import {newWorkspace,emptyState} from '../src/domain.js';import {ledger} from '../public/editor-model.js';import {addPayrollTransfer} from '../public/payroll-transfers.js';
const row=(id,guard,start=420,end=900,day=0)=>({id,p:2,post:id,start,end,guards:Array.from({length:7},(_,d)=>d===day?guard:''),billable:false});
const close=(a,b)=>assert(Math.abs(a-b)<.000001,`${a} != ${b}`);
test('Master changes and an eight-hour transfer reconcile exactly with weekly cards and list the affected guard',()=>{
 let w=newWorkspace();const week=w.activeWeek;w.master.rows=[row('Dock','A'),row('Lobby','B')];w.weeks[week]=structuredClone(w.master);w.weeks[week].rows[0].guards[0]='C';w.weeks[week].rows.push(row('Extra','B',900,1020));
 const d=new Date(week+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-7);const to=d.toISOString().slice(0,10);w=addPayrollTransfer(w,week,ledger(w.weeks[week]).find(r=>r.guard==='C'),to,'Continued from prior Sunday');
 const before=JSON.stringify(w),r=weeklyHoursBreakdown(w,week);assert.equal(JSON.stringify(w),before,'Read-only explanation never edits payroll');assert.equal(r.masterHours,16);assert.equal(r.weeklyDelta,2);assert.equal(r.scheduledHours,18);assert.equal(r.outgoing,8);assert.equal(r.payrollHours,10);assert.equal(r.payrollDelta,-8);assert.equal(r.reconciliation,0);assert.deepEqual(r.changes.map(x=>[x.guard,x.delta]),[['A',-8],['B',2],['C',8]]);assert.equal(r.transfers[0].guard,'C');assert.equal(r.transfers[0].toWeek,to);
 const c=weeklyHoursBreakdown(w,week,{guard:'C',day:'0'});assert.equal(c.scheduledHours,8);assert.equal(c.payrollHours,0);assert.equal(c.transfers.length,1);assert.equal(weeklyHoursBreakdown(w,week,{day:'1'}).transfers.length,0);
});
test('Incoming overlapping transfers count once and keep their actual source date',()=>{
 let w=newWorkspace();const week=w.activeWeek;w.master=emptyState();w.weeks[week].rows=[row('Dock','A'),row('Lobby','A',480,720)];const d=new Date(week+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+7);const to=d.toISOString().slice(0,10);w.weeks[to]=emptyState();for(const r of ledger(w.weeks[week]))w=addPayrollTransfer(w,week,r,to,'Transfer overlapping assignment');
 const out=weeklyHoursBreakdown(w,week);assert.equal(out.scheduledHours,8);assert.equal(out.weeklyOverlap,4);assert.equal(out.outgoing,8);assert.equal(out.payrollHours,0);
 const incoming=weeklyHoursBreakdown(w,to);assert.equal(incoming.incoming,8);assert.equal(incoming.payrollHours,8);assert.equal(incoming.transfers.length,2);assert.equal(incoming.transfers[0].fromWeek,week);assert.equal(incoming.transfers[0].day,0);assert.equal(weeklyHoursBreakdown(w,to,{day:'0'}).incoming,0);assert.equal(weeklyHoursBreakdown(w,to,{day:'6'}).incoming,8);
});
test('Leave and adjustments remain separate from worked hours and test schedules ignore transfers',()=>{
 const w=newWorkspace(),week=w.activeWeek;w.master.rows=[row('Dock','A')];w.weeks[week]=emptyState();w.weeks[week].events=[{guard:'A',day:0,post:'Dock',type:'Vacation',start:420,end:900,payment:'PAID',paidHours:8}];w.weeks[week].adjustments=[{guard:'A',day:0,hours:2}];let r=weeklyHoursBreakdown(w,week);assert.equal(r.masterHours,8);assert.equal(r.scheduledHours,0);assert.equal(r.payrollHours,0);assert.equal(r.paidLeave,8);assert.equal(r.adjustments,2);assert.equal(r.payable,10);assert.equal(r.changes[0].events[0].type,'Vacation');
 w.weeks[week].isTest=true;w.weeks[week].rows=[row('Dock','A')];w.payrollTransfers=[{guard:'A',fromWeek:week,toWeek:'2020-01-05',day:0,hours:8}];r=weeklyHoursBreakdown(w,week);assert.equal(r.scheduledHours,8);assert.equal(r.payrollHours,8);assert.equal(r.transfers.length,0);
});
test('Every stage reconciles even when overnight overlap changes which day owns the minutes',()=>{
 const w=newWorkspace(),week=w.activeWeek;w.master.rows=[row('Night','A',1380,1860,0)];w.weeks[week]=structuredClone(w.master);w.weeks[week].rows.push(row('Early','A',0,420,1));for(const day of ['all','0','1']){const r=weeklyHoursBreakdown(w,week,{day});close(r.masterHours+r.weeklyDelta,r.scheduledHours);close(r.scheduledHours+r.incoming-r.outgoing+r.reconciliation,r.payrollHours);close(r.changes.reduce((n,r)=>n+r.delta,0),r.weeklyDelta);close(r.payrollChanges.reduce((n,r)=>n+r.delta,0),r.payrollDelta);}
});
