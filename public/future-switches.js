import {ledger,segmentKey,assign,linkedParts} from './editor-model.js';
export function applyPlannedSwitch(w,requester,partner,payload){const next=structuredClone(w),state=next.weeks[payload.week];if(!state)throw Error('Week no longer exists.');const list=ledger(state),a=list.find(r=>segmentKey(r)===payload.fromKey&&r.guard===requester.guard_name),b=list.find(r=>segmentKey(r)===payload.toKey&&r.guard===partner.guard_name);if(!a||!b)throw Error('The requested shifts have changed. Submit a new switch request.');if(a.paidHoliday||b.paidHoliday)throw Error('Off-duty holiday shifts cannot be switched.');if(requester.guard_name===partner.guard_name)throw Error('Choose a different scheduled person.');if(a.role!=='regular'||b.role!=='regular')throw Error('Only original unsplit shifts can be switched.');let result=assign(state,a,{guard:'',status:'blank',billable:a.billable}).state;result=assign(result,b,{guard:'',status:'blank',billable:b.billable}).state;for(const [target,guard] of [[a,partner.guard_name],[b,requester.guard_name]]){const parts=linkedParts(state,target),start=Math.min(target.start,...parts.map(r=>r.start))+target.day*1440,end=Math.max(target.end,...parts.map(r=>r.end))+target.day*1440;if(ledger(result).some(r=>r.guard===guard&&!r.paidHoliday&&r.day*1440+r.start<end&&r.day*1440+r.end>start))throw Error(guard+' has another shift that overlaps this switch. Adjust that shift first.');}result=assign(result,a,{guard:partner.guard_name,status:'staff',billable:a.billable}).state;result=assign(result,b,{guard:requester.guard_name,status:'staff',billable:b.billable}).state;next.weeks[payload.week]=result;return next;}

export function masterShiftOptions(master,guard){return ledger(master).filter(r=>r.guard===guard&&r.role==='regular'&&!r.paidHoliday).map(r=>({key:segmentKey(r),day:r.day,post:r.post,start:r.start,end:r.end}));}
export function shiftSignature(state,key,guard){
 const target=ledger(state).find(r=>segmentKey(r)===key&&r.guard===guard&&r.role==='regular'&&!r.paidHoliday);
 if(!target)throw Error('The requested shift changed. Submit a new request.');
 const parts=linkedParts(state,target);return JSON.stringify((parts.length?parts:[target]).map(r=>({key:segmentKey(r),guard:r.guard,day:r.day,post:r.post,start:r.start,end:r.end,off:!!r.paidHoliday,role:r.role})).sort((a,b)=>a.key.localeCompare(b.key)));
}
export function checkPlannedSwitch(state,plan){
 if(shiftSignature(state,plan.fromKey,plan.requester)!==plan.fromSignature||shiftSignature(state,plan.toKey,plan.partner)!==plan.toSignature)throw Error('Assignments or linked shifts changed. Manager review is needed.');
}
export function applyWaitingSwitches(workspace,end){
 let next=workspace;
 for(const plan of next.futureSwitches||[]){
  if(plan.week!==end||!['WAITING_SCHEDULE','NEEDS_REVIEW','APPLIED'].includes(plan.status))continue;
  try{checkPlannedSwitch(next.weeks[end],plan);const updated=applyPlannedSwitch(next,{guard_name:plan.requester},{guard_name:plan.partner},plan);next.weeks[end]=updated.weeks[end];plan.status='APPLIED';plan.detail='Applied when the weekly schedule was created.';}
  catch(e){plan.status='NEEDS_REVIEW';plan.detail=e.message;}
 }
 return next;
}
