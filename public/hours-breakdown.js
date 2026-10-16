import {staffingHoursSummary} from './schedule-summary.js';
import {ledger,applyRows} from './editor-model.js';
import {workedTotalsByDay,payrollSummary} from './payroll.js';
import {payrollForWeek} from './payroll-transfers.js';
import {assignmentClassifier} from './assignment-status.js';
const key=r=>r.guard+'|'+r.day,sum=(rows,k)=>rows.reduce((n,r)=>n+(r[k]||0),0);
export function weeklyHoursBreakdown(workspace,week,{guard='',day='all'}={}){
 const state=workspace.weeks[week],select=r=>(!guard||r.guard===guard)&&(day==='all'||r.day===Number(day));
 const master=ledger(workspace.master).filter(r=>r.guard&&!r.paidHoliday&&select(r)),classify=assignmentClassifier(workspace.master,state),weekly=ledger(state).map(classify).filter(r=>r.guard&&!r.paidHoliday&&select(r));
 const baseline=workedTotalsByDay(master),scheduled=workedTotalsByDay(weekly),pay=(state.isTest?payrollSummary({...state,isTest:false}):payrollForWeek(workspace,week)).filter(select),payMap=new Map(pay.map(r=>[key(r),r]));
 if(state.isTest)for(const p of pay){p.worked=scheduled.get(key(p))?.worked||0;p.payable=p.worked+(p.paidLeave||0)+(p.adjustmentHours||0);}
 const keys=new Set([...baseline.keys(),...scheduled.keys(),...payMap.keys()]);const signature=rows=>JSON.stringify(rows.map(r=>[r.post,r.start,r.end]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 const changes=[],payrollChanges=[];
 for(const k of keys){const split=k.lastIndexOf('|'),name=k.slice(0,split),d=Number(k.slice(split+1)),before=master.filter(r=>key(r)===k),after=weekly.filter(r=>key(r)===k),masterHours=baseline.get(k)?.worked||0,scheduledHours=scheduled.get(k)?.worked||0,p=payMap.get(k)||{},payrollHours=p.worked||0;
  if(signature(before)!==signature(after)||Math.abs(scheduledHours-masterHours)>.00001)changes.push({guard:name,day:d,masterHours,scheduledHours,delta:scheduledHours-masterHours,before,after,events:(state.events||[]).filter(e=>e.guard===name&&e.day===d)});
  const incoming=state.isTest?0:p.transferredIn||0,outgoing=state.isTest?0:p.transferredOut||0,reconciliation=payrollHours-scheduledHours-incoming+outgoing;
  if(Math.abs(payrollHours-scheduledHours)>.00001||incoming||outgoing)payrollChanges.push({guard:name,day:d,shifts:after,scheduledHours,payrollHours,incoming,outgoing,reconciliation,delta:payrollHours-scheduledHours});
 }
 const order=(a,b)=>a.day-b.day||a.guard.localeCompare(b.guard);changes.sort(order);payrollChanges.sort(order);
 const masterHours=[...baseline.values()].reduce((n,r)=>n+r.worked,0),scheduledHours=[...scheduled.values()].reduce((n,r)=>n+r.worked,0),payrollHours=sum(pay,'worked'),incoming=state.isTest?0:sum(pay,'transferredIn'),outgoing=state.isTest?0:sum(pay,'transferredOut');
 const transfers=state.isTest?[]:(workspace.payrollTransfers||[]).filter(t=>(!guard||t.guard===guard)&&(t.fromWeek===week&&(day==='all'||t.day===Number(day))||t.toWeek===week&&!workspace.weeks[t.fromWeek]?.isTest&&(day==='all'||Number(day)===6)));
 applyRows(state);
 return {masterStaffing:staffingHoursSummary(workspace.master,day),weeklyStaffing:staffingHoursSummary(state,day),week,isTest:!!state.isTest,masterHours,scheduledHours,payrollHours,weeklyDelta:scheduledHours-masterHours,payrollDelta:payrollHours-scheduledHours,incoming,outgoing,reconciliation:payrollHours-scheduledHours-incoming+outgoing,masterOverlap:master.reduce((n,r)=>n+(r.end-r.start)/60,0)-masterHours,weeklyOverlap:weekly.reduce((n,r)=>n+(r.end-r.start)/60,0)-scheduledHours,paidLeave:sum(pay,'paidLeave'),adjustments:sum(pay,'adjustmentHours'),payable:sum(pay,'payable'),changes,payrollChanges,transfers};
}
