import {datesForWeek,editVacation} from './workspace-model.js';
import {ledger} from './editor-model.js';
const DAY=86400000;
export function vacationMoveEnd(from,old){
 const start=Date.parse(from+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!Number.isFinite(start)||new Date(start).toISOString().slice(0,10)!==from)throw Error('Choose a valid new vacation start date.');
 return new Date(start+(Date.parse(old.to+'T12:00:00Z')-Date.parse(old.from+'T12:00:00Z'))).toISOString().slice(0,10);
}
export function vacationChoices(workspace,guard){
 const saved=(workspace.vacations||[]).filter(v=>v.guard===guard).map(v=>({...v,source:'saved'}));
 const byDate=new Map();for(const [week,state]of Object.entries(workspace.weeks)){const dates=datesForWeek(week);for(const e of state.events||[]){if(e.guard!==guard||e.type!=='Vacation'||e.vacationId&&saved.some(v=>v.id===e.vacationId))continue;const date=dates[e.day];if(saved.some(v=>v.from<=date&&v.to>=date))continue;const refs=byDate.get(date)||[];refs.push({week,id:e.id,payment:e.payment});byDate.set(date,refs);}}
 const groups=[];for(const date of [...byDate.keys()].sort()){let g=groups.at(-1);if(!g||Date.parse(date+'T12:00:00Z')-Date.parse(g.to+'T12:00:00Z')!==DAY){g={id:'recorded:'+guard+':'+date,guard,from:date,to:date,source:'recorded',refs:[],note:'Recorded vacation'};groups.push(g);}g.to=date;g.refs.push(...byDate.get(date));}
 for(const g of groups){const payments=new Set(g.refs.map(r=>r.payment));g.payment=payments.size===1&&['PAID','UNPAID'].includes([...payments][0])?[...payments][0]:'PENDING';}
 return [...saved,...groups].sort((a,b)=>b.from.localeCompare(a.from)).map(v=>({...v,signature:JSON.stringify({id:v.id,guard:v.guard,from:v.from,to:v.to,payment:v.payment,note:v.note||'',refs:v.refs||[]})}));
}
export function moveVacation(workspace,guard,id,from,signature,note=''){
 const choice=vacationChoices(workspace,guard).find(v=>v.id===id);if(!choice)throw Error('This vacation is no longer available. Reload the vacation list.');if(signature&&choice.signature!==signature)throw Error('This vacation changed. Reload and submit a new move request.');
 const to=vacationMoveEnd(from,choice);if(from===choice.from)throw Error('Choose a different vacation date.');
 if(vacationChoices(workspace,guard).some(v=>v.id!==id&&v.from<=to&&v.to>=from))throw Error('The new dates overlap another vacation.');
 const next=structuredClone(workspace);
 if(choice.source==='recorded'){
  next.vacations??=[];next.vacations.push({id,guard,from:choice.from,to:choice.to,payment:choice.payment,note:choice.note});
  for(const ref of choice.refs){const e=next.weeks[ref.week].events.find(e=>e.id===ref.id);e.vacationId=id;}
 }
 // Do not displace another assignment when restoring the old vacation dates.
 for(const [week,state]of Object.entries(next.weeks)){const dates=datesForWeek(week),list=ledger(state);for(const e of state.events||[]){if(e.vacationId!==id||dates[e.day]>=from&&dates[e.day]<=to)continue;if(list.some(r=>r.guard===guard&&!r.paidHoliday&&r.day===e.day&&r.start<e.end&&r.end>e.start))throw Error('Review '+guard+'’s other assignment on '+dates[e.day]+' before restoring this vacation shift.');}}
 return editVacation(next,id,{from,to,payment:choice.payment,note:note||choice.note||'Vacation moved'});
}
