import {ledger,segmentKey} from './editor-model.js';

// Sweep actual minutes across day boundaries. The earlier shift day owns an
// overlapping minute, while billing is retained if any active post is billable.
export function workedTotalsByDay(shifts){
 const guards=new Map(),totals=new Map();
 for(const r of shifts){
  if(!r.guard||r.paidHoliday||r.end<=r.start)continue;
  if(!guards.has(r.guard))guards.set(r.guard,[]);
  const events=guards.get(r.guard);
  events.push({at:r.day*1440+r.start,day:r.day,delta:1,billable:r.billable?1:0},{at:r.day*1440+r.end,day:r.day,delta:-1,billable:r.billable?-1:0});
 }
 for(const [guard,events]of guards){
  events.sort((a,b)=>a.at-b.at);const active=Array(7).fill(0);let billable=0,last=events[0].at;
  for(const e of events){
   const owner=active.findIndex(n=>n>0);
   if(owner>=0&&e.at>last){const key=guard+'|'+owner,g=totals.get(key)||{worked:0,billable:0};g.worked+=(e.at-last)/60;if(billable>0)g.billable+=(e.at-last)/60;totals.set(key,g);}
   active[e.day]+=e.delta;billable+=e.billable;last=e.at;
  }
 }
 return totals;
}

function withoutTransferredMinutes(shifts,excluded){
 const blocked=shifts.filter(r=>excluded.includes(segmentKey(r)));
 if(!blocked.length)return shifts;
 return shifts.flatMap(r=>{
  let spans=[[r.day*1440+r.start,r.day*1440+r.end]];
  for(const b of blocked){if(b.guard!==r.guard)continue;const from=b.day*1440+b.start,to=b.day*1440+b.end;spans=spans.flatMap(([a,z])=>to<=a||from>=z?[[a,z]]:[...(a<from?[[a,from]]:[]),...(to<z?[[to,z]]:[])]);}
  return spans.map(([a,z])=>({...r,start:a-r.day*1440,end:z-r.day*1440}));
 });
}

export function payrollSummary(state,regularHours=8,excluded=[],extraShifts=[]){
 if(state.isTest)return [];
 const original=ledger(state).filter(r=>r.guard&&!r.paidHoliday),list=[...withoutTransferredMinutes(original,excluded),...extraShifts],groups=new Map();
 for(const r of list){const k=r.guard+'|'+r.day;if(!groups.has(k))groups.set(k,{guard:r.guard,day:r.day,shifts:[],paidLeave:0});groups.get(k).shifts.push(r);}
 for(const e of state.events||[]){const k=e.guard+'|'+e.day;if(!groups.has(k))groups.set(k,{guard:e.guard,day:e.day,shifts:[],paidLeave:0});if(e.payment==='PAID')groups.get(k).paidLeave=Math.min(8,groups.get(k).paidLeave+Number(e.paidHours||0));}
 for(const a of state.adjustments||[]){const k=a.guard+'|'+a.day;if(!groups.has(k))groups.set(k,{guard:a.guard,day:a.day,shifts:[],paidLeave:0});const g=groups.get(k);g.adjustmentHours=(g.adjustmentHours||0)+a.hours;}
 const totals=workedTotalsByDay(list);
 return [...groups.values()].map(g=>{const {worked=0,billable=0}=totals.get(g.guard+'|'+g.day)||{},raw=g.shifts.reduce((n,r)=>n+(r.end-r.start)/60,0);return {...g,worked,billable,nonBillable:worked-billable,regular:Math.min(regularHours,worked),extraWorked:Math.max(0,worked-regularHours),adjustmentHours:g.adjustmentHours||0,payable:worked+g.paidLeave+(g.adjustmentHours||0),overlap:Math.max(0,raw-worked),crossSunday:g.day===6&&g.shifts.some(r=>r.end>1440)};}).sort((a,b)=>a.guard.localeCompare(b.guard)||a.day-b.day);
}

export function withWeeklyOvertime(rows,threshold=40){const running=new Map();return rows.slice().sort((a,b)=>a.guard.localeCompare(b.guard)||a.day-b.day).map(r=>{const before=running.get(r.guard)||0,after=before+r.worked;running.set(r.guard,after);return {...r,overtime:Math.max(0,after-threshold)-Math.max(0,before-threshold)};});}
