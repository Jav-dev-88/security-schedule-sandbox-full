import {ledger,assign} from './editor-model.js';
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const weekFor=date=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+(7-d.getUTCDay())%7);return d.toISOString().slice(0,10);};
const dayDate=(end,day)=>{const d=new Date(end+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-6+day);return d.toISOString().slice(0,10);};
export function holidayCreditBalances(w){
 const credits=new Map(),vacations=[...(w.vacations||[])];
 const legacy=new Map();for(const [end,state] of Object.entries(w.weeks))for(const e of state.events||[])if(e.type==='Vacation'){const date=dayDate(end,e.day);if(!vacations.some(v=>v.guard===e.guard&&v.from<=date&&v.to>=date)){if(!legacy.has(e.guard))legacy.set(e.guard,new Set());legacy.get(e.guard).add(date);}}
 for(const [guard,days] of legacy){let range=null;for(const date of [...days].sort()){if(range&&(Date.parse(date)-Date.parse(range.to))===86400000)range.to=date;else{range={guard,from:date,to:date};vacations.push(range);}}}
 for(const holiday of w.holidays||[])for(const v of vacations)if(v.from<=holiday.date&&v.to>=holiday.date){const id=encodeURIComponent(v.guard)+'|'+holiday.date,old=credits.get(id);credits.set(id,{id,guard:v.guard,holidayDate:holiday.date,holidayName:holiday.name,vacationTo:old&&old.vacationTo>v.to?old.vacationTo:v.to,sourceValid:true});}
 for(const use of w.holidayCreditUses||[]){const source=credits.get(use.id);credits.set(use.id,{...use,...source,sourceValid:!!source,use:{...use,status:!w.weeks[use.week]&&use.status==='APPLIED'?'WAITING_SCHEDULE':use.status}});}
 return [...credits.values()].sort((a,b)=>a.guard.localeCompare(b.guard)||a.holidayDate.localeCompare(b.holidayDate));
}
export function validateHolidayCreditUses(uses){if(!Array.isArray(uses)||uses.length>2000)throw Error('Invalid holiday day records.');const ids=new Set();for(const u of uses){if(!u||typeof u.id!=='string'||u.id!==encodeURIComponent(u.guard)+'|'+u.holidayDate||ids.has(u.id)||typeof u.guard!=='string'||!u.guard||u.guard.length>80||typeof u.holidayName!=='string'||u.holidayName.length>80||!validDate(u.holidayDate)||!validDate(u.date)||u.week!==weekFor(u.date)||!['DAY_OFF','WORK_PAY'].includes(u.mode)||!['WAITING_SCHEDULE','APPLIED','NEEDS_REVIEW'].includes(u.status)||!Number.isFinite(u.hours)||u.hours<=0||u.hours>8||typeof u.note!=='string'||u.note.length>200)throw Error('Invalid holiday day record.');ids.add(u.id);}return uses;}
export function applyHolidayCreditWeek(workspace,end){
 const w=structuredClone(workspace),state=w.weeks[end];if(!state)return w;
 for(const use of w.holidayCreditUses||[]){if(use.week!==end)continue;if((state.events||[]).some(e=>e.holidayCreditId===use.id)||(state.adjustments||[]).some(a=>a.holidayCreditId===use.id)){use.status='APPLIED';continue;}
 const source=holidayCreditBalances(w).find(c=>c.id===use.id);if(!source?.sourceValid||use.date<=source.vacationTo){use.status='NEEDS_REVIEW';continue;}
 const day=Array.from({length:7},(_,i)=>dayDate(end,i)).indexOf(use.date),targets=ledger(w.weeks[end]).filter(r=>r.guard===use.guard&&r.day===day&&!r.paidHoliday),otherLeave=(state.events||[]).some(e=>e.guard===use.guard&&e.day===day);
 if(!targets.length||otherLeave||(w.vacations||[]).some(v=>v.guard===use.guard&&v.from<=use.date&&v.to>=use.date)){use.status='NEEDS_REVIEW';continue;}
 if(use.mode==='WORK_PAY'){w.weeks[end].adjustments??=[];w.weeks[end].adjustments.push({id:'holiday-credit:'+use.id,holidayCreditId:use.id,guard:use.guard,day,type:'Other paid hours',hours:use.hours,note:(use.holidayName+' holiday during vacation · Working on '+use.date+(use.note?' · '+use.note:'')).slice(0,300)});}
 else{let remaining=use.hours,next=w.weeks[end];for(const target of targets){next=assign(next,target,{guard:'',status:'open',billable:target.billable,linked:false}).state;const paidHours=Math.min(remaining,(target.end-target.start)/60);remaining-=paidHours;next.events??=[];next.events.push({id:crypto.randomUUID(),holidayCreditId:use.id,source:target.source,coverageSource:target.source,coverageStart:target.start,coverageEnd:target.end,guard:use.guard,day,post:target.post,start:target.start,end:target.end,type:'Extra holiday day off',cover:'',payment:'PAID',paidHours,requestedHours:paidHours,note:use.holidayName+' holiday during vacation'+(use.note?' · '+use.note:'')});}if(remaining>0.001){use.status='NEEDS_REVIEW';continue;}w.weeks[end]=next;}
 use.status='APPLIED';
 }
 return w;
}
export function useHolidayCredit(workspace,{id,mode,date,hours=8,note=''}){
 if(!validDate(date)||!['DAY_OFF','WORK_PAY'].includes(mode)||!Number.isFinite(Number(hours))||+hours<=0||+hours>8||typeof note!=='string'||note.length>200)throw Error('Choose a date, day off or work, and up to 8 holiday hours.');
 const source=holidayCreditBalances(workspace).find(c=>c.id===id);if(!source?.sourceValid)throw Error('The holiday must be selected and included in this guard’s saved vacation.');if(source.use?.status==='APPLIED')throw Error('This holiday day has already been used.');if(date<=source.vacationTo)throw Error('Choose a date after this vacation ends.');
 if((workspace.holidayCreditUses||[]).some(u=>u.id!==id&&u.guard===source.guard&&u.date===date))throw Error('Another extra holiday day is already assigned to this date. Choose another working day.');if((workspace.vacations||[]).some(v=>v.guard===source.guard&&v.from<=date&&v.to>=date))throw Error('Choose a date outside the guard’s vacation.');
 let w=structuredClone(workspace);w.holidayCreditUses=(w.holidayCreditUses||[]).filter(u=>u.id!==id);const use={id,guard:source.guard,holidayDate:source.holidayDate,holidayName:source.holidayName,date,week:weekFor(date),mode,hours:+hours,note:note.trim(),status:'WAITING_SCHEDULE'};w.holidayCreditUses.push(use);validateHolidayCreditUses(w.holidayCreditUses);
 if(w.weeks[use.week]){w=applyHolidayCreditWeek(w,use.week);if(w.holidayCreditUses.find(u=>u.id===id).status==='NEEDS_REVIEW')throw Error('Choose a scheduled working day with enough hours and no other leave. Existing coverage will not be replaced.');}return w;
}
export function cancelHolidayCredit(workspace,id){const credit=holidayCreditBalances(workspace).find(c=>c.id===id);if(credit?.use?.status==='APPLIED')throw Error('This day is already applied. Correct its attendance or payroll record first.');const next=structuredClone(workspace);next.holidayCreditUses=(next.holidayCreditUses||[]).filter(c=>c.id!==id);return next;}
