import {ledger,segmentKey,linkedParts} from './editor-model.js';
import {datesForWeek} from './workspace-model.js';
import {payrollSummary,withWeeklyOvertime,workedTotalsByDay} from './payroll.js';
export function validateTransfer(t){if(!t||typeof t.id!=='string'||!t.id||typeof t.guard!=='string'||!t.guard||typeof t.segment!=='string'||!Number.isInteger(t.day)||t.day<0||t.day>6||!Number.isFinite(t.hours)||t.hours<=0||t.hours>24||typeof t.note!=='string'||!t.note.trim()||t.note.length>300||typeof t.post!=='string'||typeof t.billable!=='boolean'||!Number.isInteger(t.start)||!Number.isInteger(t.end)||t.end<=t.start)throw Error('Invalid payroll transfer.');datesForWeek(t.fromWeek);datesForWeek(t.toWeek);if(t.fromWeek===t.toWeek)throw Error('Choose a different payroll week.');return t;}
export function addPayrollTransfer(workspace,fromWeek,target,toWeek,note){const state=workspace.weeks[fromWeek],parts=state?linkedParts(state,target):[];if(parts.length<2)return addTransferSingle(workspace,fromWeek,target,toWeek,note);let next=structuredClone(workspace);const groupId=crypto.randomUUID();for(const part of parts){next=addTransferSingle(next,fromWeek,part,toWeek,note);next.payrollTransfers.at(-1).groupId=groupId;}return next;}
function addTransferSingle(workspace,fromWeek,target,toWeek,note){const next=structuredClone(workspace),state=next.weeks[fromWeek];if(!state||state.isTest||next.weeks[toWeek]?.isTest)throw Error('Payroll transfers require regular schedules, not test schedules.');const shift=ledger(state).find(r=>segmentKey(r)===segmentKey(target)&&r.guard===target.guard);if(!shift||!shift.guard||shift.paidHoliday)throw Error('Choose an existing worked shift.');next.payrollTransfers??=[];if(next.payrollTransfers.some(t=>t.fromWeek===fromWeek&&t.segment===segmentKey(shift)))throw Error('This shift already has a payroll transfer. Remove it from the transfer log before changing it.');if(next.payrollTransfers.some(t=>t.fromWeek===fromWeek&&t.guard===shift.guard&&t.toWeek!==toWeek&&Math.max(t.day*1440+t.start,shift.day*1440+shift.start)<Math.min(t.day*1440+t.end,shift.day*1440+shift.end)))throw Error('Overlapping hours are already transferred to another week. Remove that transfer first.');const t=validateTransfer({id:crypto.randomUUID(),guard:shift.guard,fromWeek,toWeek,segment:segmentKey(shift),day:shift.day,hours:(shift.end-shift.start)/60,post:shift.post,start:shift.start,end:shift.end,billable:!!shift.billable,note:note.trim(),created:new Date().toISOString()});next.payrollTransfers.push(t);return next;}
export function removePayrollTransfer(workspace,id){const next=structuredClone(workspace);const record=(next.payrollTransfers||[]).find(t=>t.id===id);next.payrollTransfers=(next.payrollTransfers||[]).filter(t=>t.id!==id&&(!record?.groupId||t.groupId!==record.groupId));return next;}
export function transferForShift(workspace,week,shift){return (workspace.payrollTransfers||[]).find(t=>t.fromWeek===week&&t.segment===segmentKey(shift)&&t.guard===shift.guard);}
// Keep billable minutes from overlapping source posts when the work moves weeks.
function incomingShiftRecords(workspace,records){
 const sources=new Map();return records.flatMap(t=>{
  if(!sources.has(t.fromWeek))sources.set(t.fromWeek,workspace.weeks[t.fromWeek]?ledger(workspace.weeks[t.fromWeek]).filter(r=>r.guard&&!r.paidHoliday):[]);
  const offset=t.day*1440,billing=sources.get(t.fromWeek).filter(r=>r.guard===t.guard&&r.billable).map(r=>[Math.max(t.start,r.day*1440+r.start-offset),Math.min(t.end,r.day*1440+r.end-offset)]).filter(([a,b])=>a<b);
  const bounds=[...new Set([t.start,t.end,...billing.flat()])].sort((a,b)=>a-b);
  return bounds.slice(0,-1).map((start,i)=>({...t,start,end:bounds[i+1],billable:t.billable||billing.some(([a,b])=>a<=start&&b>=bounds[i+1])}));
 });
}
export function payrollForWeek(workspace,week,stateOverride=null){const state=stateOverride||workspace.weeks[week]||{rows:[],plans:{},overrides:{},events:[]};if(state.isTest)return [];const out=(workspace.payrollTransfers||[]).filter(t=>t.fromWeek===week),incoming=(workspace.payrollTransfers||[]).filter(t=>t.toWeek===week&&!workspace.weeks[t.fromWeek]?.isTest);const result=payrollSummary(state,8,out.map(t=>t.segment)),groups=new Map(result.map(g=>[g.guard+'|'+g.day,g]));
 const group=(guard,day)=>{const k=guard+'|'+day;if(!groups.has(k))groups.set(k,{guard,day,shifts:[],worked:0,billable:0,nonBillable:0,regular:0,extraWorked:0,paidLeave:0,adjustmentHours:0,payable:0,overlap:0,crossSunday:false});return groups.get(k);};
 for(const [key,h]of workedTotalsByDay(out)){const split=key.lastIndexOf('|');group(key.slice(0,split),+key.slice(split+1)).transferredOut=h.worked;}
 // A transfer changes the payroll week, not the actual date worked. Deduplicate
 // within each source week, then add distinct source dates to destination Sunday.
 const incomingShifts=incomingShiftRecords(workspace,incoming);
 for(const fromWeek of new Set(incoming.map(t=>t.fromWeek)))for(const [key,h]of workedTotalsByDay(incomingShifts.filter(t=>t.fromWeek===fromWeek))){const split=key.lastIndexOf('|'),g=group(key.slice(0,split),6);g.worked+=h.worked;g.billable+=h.billable;g.transferredIn=(g.transferredIn||0)+h.worked;}
 for(const g of groups.values()){g.nonBillable=g.worked-g.billable;g.regular=Math.min(8,g.worked);g.extraWorked=Math.max(0,g.worked-8);g.payable=g.worked+g.paidLeave+g.adjustmentHours;}
 return withWeeklyOvertime([...groups.values()],workspace.settings?.overtimeHours??40);
}

export function sundayContinuationCandidates(workspace,week){const state=workspace.weeks[week];if(!state||state.isTest)return [];const end=new Date(week+'T12:00:00Z');end.setUTCDate(end.getUTCDate()-7);const previousWeek=end.toISOString().slice(0,10),previous=workspace.weeks[previousWeek];if(!previous||previous.isTest)return [];const prior=ledger(previous).filter(r=>r.guard&&!r.paidHoliday),current=ledger(state).filter(r=>r.guard&&!r.paidHoliday&&r.day===0&&r.start===1380&&r.end===1860),candidates=[];
 for(const shift of current){const earlier=prior.find(r=>r.guard===shift.guard&&r.day===6&&r.start===900&&r.end===1380);if(!earlier||transferForShift(workspace,week,shift))continue;
 // Do not propose adding hours if an overnight is already recorded in the prior Sunday payroll.
 if(prior.some(r=>r.guard===shift.guard&&r.day===6&&r.start===1380&&r.end===1860))continue;
 const id=[week,segmentKey(shift),shift.guard,previousWeek,segmentKey(earlier)].join('::');if((workspace.continuationDecisions||[]).some(d=>d.id===id&&d.decision==='NO'))continue;
 candidates.push({id,guard:shift.guard,shift,fromWeek:week,toWeek:previousWeek,hours:8});}
 return candidates;
}
export function answerSundayContinuation(workspace,week,id,accept){const candidate=sundayContinuationCandidates(workspace,week).find(c=>c.id===id);if(!candidate)throw Error('These shifts changed. Refresh and review them again.');if(accept)return addPayrollTransfer(workspace,week,candidate.shift,candidate.toWeek,'Confirmed stayed from Sunday 15:00–23:00 into overnight 23:00–07:00');const next=structuredClone(workspace);next.continuationDecisions??=[];next.continuationDecisions.push({id,guard:candidate.guard,fromWeek:week,toWeek:candidate.toWeek,decision:'NO',created:new Date().toISOString()});return next;}
