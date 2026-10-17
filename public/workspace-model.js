import {applyHolidayCreditWeek} from './holiday-credits.js';
import {customLeaveTypes} from './leave-types.js';
import {applyWaitingSwitches} from './future-switches.js';
import {fmt} from './model.js';
import {initialState,ledger,segmentKey,addRow,assign,linkedRows,linkedParts} from './editor-model.js';
export function createWorkspace(weekly){return {version:1,master:initialState(),masterLocked:false,weeks:{'2026-10-11':structuredClone(weekly)},activeWeek:'2026-10-11',mode:'weekly',staff:[]};}
export function datesForWeek(end){if(!/^\d{4}-\d{2}-\d{2}$/.test(end))throw Error('Choose the week-ending date.');const d=new Date(end+'T12:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==end||d.getUTCDay()!==0)throw Error('Choose a Sunday week ending.');return Array.from({length:7},(_,i)=>{const day=new Date(d);day.setUTCDate(day.getUTCDate()-6+i);return day.toISOString().slice(0,10);});}
export function generateWeek(workspace,end,{overwrite=false}={}){datesForWeek(end);if(workspace.weeks[end]&&!overwrite)throw Error('This test week already exists.');const copy=structuredClone(workspace);copy.weeks[end]=structuredClone(copy.master);copy.weeks[end].events=[];copy.weeks[end].adjustments=[];copy.weeks[end].moves=[];for(const row of copy.weeks[end].rows)for(let day=0;day<7;day++)if((copy.inactiveStaff||[]).some(n=>n.toLowerCase()===row.guards[day].toLowerCase())){row.guards[day]='';(row.open??=Array(7).fill(false))[day]=true;delete copy.weeks[end].plans[row.id+'|'+day];for(const k of Object.keys(copy.weeks[end].overrides))if(k.startsWith(row.id+'|'+day+'|'))delete copy.weeks[end].overrides[k];}for(const p of Object.values(copy.weeks[end].plans))if((copy.inactiveStaff||[]).includes(p.replacement))p.replacement='';for(const o of Object.values(copy.weeks[end].overrides))if((copy.inactiveStaff||[]).includes(o.guard)){o.guard='';o.blank=false;o.role='open';}copy.activeWeek=end;copy.mode='weekly';copy.weeks[end]=applySavedVacations(copy.weeks[end],end,copy.vacations||[]);return applyHolidayCreditWeek(applyWaitingSwitches(copy,end),end);}
export function saveActive(workspace,state){const copy=structuredClone(workspace);if(copy.mode==='master'){if(copy.masterLocked)throw Error('Master is locked. Unlock it to edit.');copy.master=structuredClone(state);}else copy.weeks[copy.activeWeek]=structuredClone(state);return copy;}
export function attendanceEvent(state,target,fields,leaveTypes=customLeaveTypes({})){fields={...fields,_customLeave:leaveTypes.some(t=>t.name===fields.type)};const parts=linkedParts(state,target).sort((a,b)=>a.start-b.start);if(parts.length<2)return attendanceSingle(state,target,fields);
 const partial=['Left early','Came late'].includes(fields.type),at=Number(fields.time);if(partial&&(!Number.isFinite(at)||at<=parts[0].start||at>=parts.at(-1).end))throw Error('Enter a time inside the linked 08:30–16:30 shift.');let next=structuredClone(state),remaining=Number(fields.paidHours||0);
 for(const part of parts){if(!ledger(next).some(r=>segmentKey(r)===segmentKey(part)&&r.guard===target.guard))continue;let fullGap=false;if(partial){if(fields.type==='Left early'&&part.end<=at||fields.type==='Came late'&&part.start>=at)continue;fullGap=fields.type==='Left early'?part.start>=at:part.end<=at;}
 const credit=Math.min((part.end-part.start)/60,Math.max(0,remaining));next=attendanceSingle(next,part,{...fields,paidHours:credit,_skipVacationCascade:true,_fullGap:fullGap,_allowZeroHoliday:true});remaining-=credit;
 }
 if(fields.type==='Vacation'){const other=ledger(next).find(r=>r.guard===target.guard&&r.day===target.day);if(other)return attendanceEvent(next,other,fields);}return next;
}
function attendanceSingle(state,target,{type,time='',cover='',payment='PENDING',paidHours=0,note='',_skipVacationCascade=false,_fullGap=false,_allowZeroHoliday=false,_customLeave=false}){
 if(cover&&cover===target.guard)throw Error('Choose another covering guard.');
 if(!target.guard)throw Error('Choose a staffed cell.');const next=structuredClone(state),id=segmentKey(target),hours=(target.end-target.start)/60;
 if(type==='Paid holiday — off'||type==='Return to work (remove holiday off)'){
  const row=next.rows.find(r=>r.id===target.source);
  if(!row||next.plans[target.source+'|'+target.day]||target.start!==row.start||target.end!==row.end)throw Error('Use a full regular cell for holiday off; review split shifts first.');
  next.events=(next.events||[]).filter(e=>!(e.type==='Paid holiday — off'&&e.source===target.source&&e.day===target.day&&e.guard===target.guard));
  if(type==='Return to work (remove holiday off)')return next;
  if(cover)throw Error('Holiday off keeps the guard visible. Add any working coverage separately.');
  const credit=Number(paidHours);if(!Number.isFinite(credit)||(credit<=0&&!_allowZeroHoliday)||credit<0||credit>Math.min(8,hours))throw Error('Enter paid holiday hours above 0 and no more than 8 or the shift length.');
  next.events.push({id:crypto.randomUUID(),source:target.source,guard:target.guard,day:target.day,post:target.post,start:target.start,end:target.end,type,payment:'PAID',paidHours:credit,requestedHours:credit,note});return next;
 }
 const event={id:crypto.randomUUID(),source:target.source,coverageSource:target.source,coverageStart:target.start,coverageEnd:target.end,guard:target.guard,day:target.day,post:target.post,start:target.start,end:target.end,type,time,cover,payment,requestedHours:Math.min(8,hours),paidHours:payment==='PAID'?Math.max(0,Math.min(8,hours,Number(paidHours)||0)):0,note};
 if(type==='Call-out'){event.payment='UNPAID';event.paidHours=0;event.requestedHours=0;}
 if((type==='Left early'||type==='Came late')&&!_fullGap){
  const at=Number(time);if(!Number.isFinite(at)||at<=target.start||at>=target.end)throw Error('Enter a time inside this shift.');event.payment='WORKED_ONLY';event.paidHours=0;
  const workStart=type==='Came late'?at:target.start,workEnd=type==='Left early'?at:target.end;
  next.overrides[id]={...next.overrides[id],start:workStart,end:workEnd,note:[next.overrides[id]?.note,target.guard+' '+(type==='Left early'?'left early':'came late')+' at '+fmt(at)].filter(Boolean).join(' · ')};
  const gapStart=type==='Left early'?at:target.start,gapEnd=type==='Came late'?at:target.end;
  ensureCoverAvailable(next,{...target,start:gapStart,end:gapEnd},cover);const result=addRow(next,{post:target.post,start:gapStart,end:gapEnd,day:target.day,guard:cover,billable:target.billable,status:cover?'staff':'open',platoon:target.p,quick:!!state.rows.find(r=>r.id===target.source)?.quick});event.coverageSource=result.state.rows.at(-1).id;event.coverageStart=gapStart;event.coverageEnd=gapEnd;result.state.events=[...(state.events||[]),event];return result.state;
 }
 if(!_fullGap&&!_customLeave&&!['Vacation','Sick','Personal','Call-out','Unpaid leave'].includes(type))throw Error('Choose the leave type.');
 if(_fullGap){event.payment='WORKED_ONLY';event.paidHours=0;event.note=[note,'Linked shift: '+type+' at '+fmt(Number(time))].filter(Boolean).join(' · ');}
 ensureCoverAvailable(next,target,cover);const result=assign(next,target,{guard:cover,billable:target.billable,status:cover?'staff':'open',linked:false});result.state.events=[...(state.events||[]),event];
 if(type==='Vacation'&&!_skipVacationCascade){const other=ledger(result.state).find(r=>r.guard===target.guard&&r.day===target.day);if(other)return attendanceEvent(result.state,other,{type,cover,payment,paidHours,note});}
 return result.state;
}

function ensureCoverAvailable(state,target,cover){if(!cover)return;const start=target.day*1440+target.start,end=target.day*1440+target.end;if(ledger(state).some(r=>!r.paidHoliday&&r.guard===cover&&segmentKey(r)!==segmentKey(target)&&Math.max(start,r.day*1440+r.start)<Math.min(end,r.day*1440+r.end)))throw Error(cover+' already has a shift during these coverage hours. Choose an available guard or leave coverage pending.');}
export function attendanceCoverage(state,event){if(event.type==='Paid holiday — off')return 'Off duty — paid holiday';if(!event.coverageSource)return event.cover&&event.cover!==event.guard?event.cover:'';const from=event.coverageStart??event.start,to=event.coverageEnd??event.end;const rows=ledger(state).filter(r=>r.source===event.coverageSource&&r.day===event.day&&r.guard&&r.guard!==event.guard&&!r.paidHoliday&&r.start<to&&r.end>from);const names=[...new Set(rows.map(r=>r.guard))];return names.join(' / ');}

export function repairFullShiftCoverage(state){const next=structuredClone(state),removedRows=[];let count=0;for(const event of next.events||[]){if(event.coverageSource||!['Vacation','Sick','Personal','Call-out','Unpaid leave'].includes(event.type))continue;const originals=next.rows.filter(row=>row.post===event.post&&row.start===event.start&&row.end===event.end&&row.guards[event.day]===event.guard&&next.overrides[segmentKey({source:row.id,day:event.day,role:'regular',start:row.start,end:row.end})]?.blank);if(originals.length!==1)continue;const original=originals[0];const candidates=next.rows.filter(row=>row.id!==original.id&&row.custom&&row.p===original.p&&row.post===event.post&&row.start===event.start&&row.end===event.end&&row.guards.every((g,d)=>d===event.day||!g)&&(!row.open||row.open.every((o,d)=>d===event.day||!o))&&(event.cover?row.guards[event.day]===event.cover:!row.guards[event.day]&&row.open?.[event.day]));if(candidates.length!==1)continue;const coverage=candidates[0];if(Object.keys(next.overrides).some(k=>k.startsWith(coverage.id+'|'))||Object.values(next.plans).some(p=>p.source===coverage.id||p.source===original.id)||(next.events||[]).some(e=>e!==event&&(e.source===coverage.id||e.coverageSource===coverage.id)))continue;const key=segmentKey({source:original.id,day:event.day,role:'regular',start:original.start,end:original.end});delete next.overrides[key];original.guards[event.day]=coverage.guards[event.day]||'';(original.open??=Array(7).fill(false))[event.day]=!coverage.guards[event.day];(original.billing??=Array(7).fill(original.billable))[event.day]=coverage.billing?.[event.day]??coverage.billable;event.source=original.id;event.coverageSource=original.id;event.coverageStart=event.start;event.coverageEnd=event.end;removedRows.push(structuredClone(coverage));next.rows=next.rows.filter(row=>row.id!==coverage.id);count++;}return {state:next,count,removedRows};}

export function removeAttendanceRecord(state,id){
 if(!(state.events||[]).some(e=>e.id===id))throw Error('This attendance record is no longer available.');
 const next=structuredClone(state);next.events=next.events.filter(e=>e.id!==id);return next;
}

export function validateVacation(v){const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;if(!v||typeof v.id!=='string'||!v.id||typeof v.guard!=='string'||!v.guard.trim()||v.guard.length>80||!validDate(v.from)||!validDate(v.to)||v.to<v.from||!['PENDING','PAID','UNPAID'].includes(v.payment)||typeof v.note!=='string'||v.note.length>300)throw Error('Choose a guard, valid vacation dates, and payment status.');return v;}
export function applySavedVacations(state,end,vacations){let next=structuredClone(state);const dates=datesForWeek(end);for(const v of vacations){for(let day=0;day<7;day++){if(dates[day]<v.from||dates[day]>v.to)continue;const targets=ledger(next).filter(r=>r.guard===v.guard&&r.day===day);for(const target of targets){if(!ledger(next).some(r=>r.guard===v.guard&&segmentKey(r)===segmentKey(target)))continue;if(target.paidHoliday)throw Error('Review the paid holiday entry for '+v.guard+' on '+dates[day]+' before adding vacation.');const existing=(next.events||[]).find(e=>e.type==='Vacation'&&e.guard===v.guard&&e.day===day&&(e.coverageSource||e.source)===target.source&&(e.coverageStart??e.start)===target.start&&(e.coverageEnd??e.end)===target.end);if(existing){const id=existing.id;next=assign(next,target,{guard:'',status:'open',billable:target.billable,linked:false}).state;const event=next.events.find(e=>e.id===id);event.vacationId=v.id;event.coverageSource=target.source;event.coverageStart=target.start;event.coverageEnd=target.end;event.cover='';continue;}const eventCount=(next.events||[]).length;next=attendanceSingle(next,target,{type:'Vacation',payment:v.payment,paidHours:8,note:v.note||'Vacation '+v.from+' through '+v.to,_skipVacationCascade:true});for(const event of next.events.slice(eventCount))event.vacationId=v.id;}}}return next;}
export function addVacation(workspace,fields){const v=validateVacation({...fields,id:crypto.randomUUID(),created:new Date().toISOString()});const next=structuredClone(workspace);next.vacations??=[];if(next.vacations.some(old=>old.guard===v.guard&&old.from<=v.to&&old.to>=v.from))throw Error('This guard already has vacation recorded in that date range.');next.vacations.push(v);for(const [end,state]of Object.entries(next.weeks))next.weeks[end]=applySavedVacations(state,end,[v]);return next;}

export function vacationOnDays(state,guard,days,fields){if(!Array.isArray(days)||!days.length||days.some(d=>!Number.isInteger(d)||d<0||d>6))throw Error('Choose at least one vacation day.');let next=structuredClone(state),changed=false;for(const day of new Set(days)){const target=ledger(next).find(r=>r.guard===guard&&r.day===day);if(!target)continue;if(target.paidHoliday)throw Error('Review the paid holiday entry before adding vacation on that day.');next=attendanceEvent(next,target,{...fields,type:'Vacation'});changed=true;}if(!changed)throw Error('This guard has no scheduled shifts on the selected days.');return next;}

export function editVacation(workspace,id,fields){
 const next=structuredClone(workspace),old=(next.vacations||[]).find(v=>v.id===id);if(!old)throw Error('Vacation no longer exists.');
 const v=validateVacation({...old,...fields,guard:old.guard,id});if(next.vacations.some(x=>x.id!==id&&x.guard===v.guard&&x.from<=v.to&&x.to>=v.from))throw Error('This date range overlaps another vacation.');
 for(const [end,state] of Object.entries(next.weeks)){
  const dates=datesForWeek(end);let updated=state;
  for(const e of (state.events||[]).filter(e=>e.vacationId===id)){
   if(dates[e.day]>=v.from&&dates[e.day]<=v.to){e.payment=v.payment;e.paidHours=v.payment==='PAID'?Math.min(8,(e.end-e.start)/60):0;e.note=v.note||'Vacation '+v.from+' through '+v.to;continue;}
   const target=ledger(updated).find(r=>r.source===e.source&&r.day===e.day&&r.start===e.start&&r.end===e.end);
   if(!target||target.guard||target.paidHoliday)throw Error('Cannot restore '+v.guard+' on '+dates[e.day]+': their original shift has coverage or was changed. Clear that coverage first, then edit the vacation dates.');
   updated=assign(updated,target,{guard:e.guard,status:'staff',billable:target.billable,linked:false}).state;updated.events=updated.events.filter(x=>x.id!==e.id);
  }
  next.weeks[end]=applySavedVacations(updated,end,[v]);
 }
 Object.assign(old,v);return next;
}

// Calendar dates use the building's timezone, independent of the viewer's device.
export function scheduleToday(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const part=type=>parts.find(p=>p.type===type).value;
 return part('year')+'-'+part('month')+'-'+part('day');
}
export function currentScheduleWeek(now=new Date()){
 const day=new Date(scheduleToday(now)+'T12:00:00Z');
 day.setUTCDate(day.getUTCDate()+(7-day.getUTCDay())%7);
 return day.toISOString().slice(0,10);
}
export function openingScheduleWeek(weeks,fallback,now=new Date()){
 const current=currentScheduleWeek(now);
 return weeks.includes(current)?current:weeks.includes(fallback)?fallback:weeks.slice().sort().at(-1)||'';
}

export function vacationCoverageEvents(state,target){
 return (state.events||[]).filter(e=>['Vacation','Extra holiday day off'].includes(e.type)&&e.guard!==target.guard&&e.day===target.day&&(e.coverageStart??e.start)<target.end&&(e.coverageEnd??e.end)>target.start&&
  (e.coverageSource?e.coverageSource===target.source:e.source===target.source||e.cover===target.guard&&e.post===target.post));
}
export function assignScheduleGuard(state,target,fields){
 const parts=fields.linked===false?[target]:[target,...linkedParts(state,target)],events=[...new Map(parts.flatMap(part=>vacationCoverageEvents(state,part)).map(e=>[e.id,e])).values()];
 if(events.some(e=>e.guard===fields.guard))throw Error(fields.guard+' is recorded on '+(events.some(e=>e.guard===fields.guard&&e.type==='Vacation')?'vacation':'leave')+' for this shift. Choose another covering guard or correct their vacation dates first.');
 const result=assign(state,target,events.length&&!fields.guard?{...fields,status:'open'}:fields);
 for(const e of result.state.events||[]){if(!events.some(old=>old.id===e.id))continue;if(!e.coverageSource){const original=events.find(old=>old.id===e.id);e.coverageSource=parts.find(part=>vacationCoverageEvents(state,part).some(event=>event.id===e.id))?.source||original.source;e.coverageStart=original.start;e.coverageEnd=original.end;}e.cover=fields.guard||'';}
 return result;
}
export function recheckVacationAssignments(workspace,end){
 if(!workspace.weeks[end])throw Error('Choose an existing weekly schedule.');const next=structuredClone(workspace),state=next.weeks[end],dates=datesForWeek(end),vacations=structuredClone(next.vacations||[]);
 // Older weekly-only vacation records also protect their recorded dates.
 for(const e of state.events||[]){if(e.type!=='Vacation'||vacations.some(v=>v.guard===e.guard&&v.from<=dates[e.day]&&v.to>=dates[e.day]))continue;vacations.push({id:e.vacationId||'recorded-vacation:'+e.guard+':'+dates[e.day],guard:e.guard,from:dates[e.day],to:dates[e.day],payment:['PAID','UNPAID'].includes(e.payment)?e.payment:'PENDING',note:e.note||'Recorded vacation'});}
 const candidates=ledger(state).filter(r=>r.guard&&vacations.some(v=>v.guard===r.guard&&v.from<=dates[r.day]&&v.to>=dates[r.day]));next.weeks[end]=applySavedVacations(state,end,vacations);
 return {workspace:next,openedShifts:candidates.length,changed:JSON.stringify(state)!==JSON.stringify(next.weeks[end])};
}

// Full-shift returns cancel the matching absence, never another guard's leave.
export function returningLeaveEvents(state,target,fields){
 if(!fields.guard||fields.status&&fields.status!=='staff')return [];
 const parts=fields.linked===false?[target]:[target,...linkedParts(state,target)];
 return (state.events||[]).filter(e=>e.guard===fields.guard&&!['Left early','Came late','Paid holiday — off','Extra holiday day off'].includes(e.type)&&parts.some(p=>e.day===p.day&&(e.coverageSource||e.source)===p.source&&e.start===p.start&&e.end===p.end));
}
function cancelReturnedLeave(workspace,end,events){
 const next=structuredClone(workspace),dates=datesForWeek(end),eventKeys=new Set(events.map(e=>JSON.stringify(e))),vacationDays=new Map();
 for(const e of events)if(e.type==='Vacation'){if(!vacationDays.has(e.guard))vacationDays.set(e.guard,new Set());vacationDays.get(e.guard).add(dates[e.day]);}
 next.weeks[end].events=(next.weeks[end].events||[]).filter(e=>!eventKeys.has(JSON.stringify(e))&&!(e.type==='Vacation'&&vacationDays.get(e.guard)?.has(dates[e.day])));
 const offset=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 if(next.vacations)next.vacations=next.vacations.flatMap(v=>{let ranges=[v];for(const day of vacationDays.get(v.guard)||[])ranges=ranges.flatMap(r=>{if(day<r.from||day>r.to)return [r];const pieces=[];if(r.from<day)pieces.push({...r,to:offset(day,-1)});if(day<r.to)pieces.push({...r,id:pieces.length?crypto.randomUUID():r.id,from:offset(day,1)});return pieces;});return ranges;});
 return next;
}
export function returnGuardToWork(workspace,state,target,fields){
 const events=returningLeaveEvents(state,target,fields);if(!events.length)return assignScheduleGuard(state,target,fields);
 const next=cancelReturnedLeave(saveActive(workspace,state),workspace.activeWeek,events),result=assignScheduleGuard(next.weeks[next.activeWeek],target,fields);
 return {...result,workspace:next,message:fields.guard+' returned to work; matching leave removed for '+datesForWeek(workspace.activeWeek)[target.day]+'.'};
}
export function reconcileReturnedLeave(workspace,end){
 const state=workspace.weeks[end];if(!state)return {workspace,count:0};const shifts=ledger(state),events=(state.events||[]).filter(e=>!['Left early','Came late','Paid holiday — off','Extra holiday day off'].includes(e.type)&&shifts.some(r=>!r.paidHoliday&&r.guard===e.guard&&r.day===e.day&&(r.source===e.source||r.source===e.coverageSource)&&r.start<=e.start&&r.end>=e.end));
 return {workspace:events.length?cancelReturnedLeave(workspace,end,events):workspace,count:events.length};
}
