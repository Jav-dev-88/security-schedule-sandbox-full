import {ledger} from './editor-model.js';
// Staffing totals count post positions, while payroll counts each guard's worked
// minutes once. Split records sharing a post position never create extra demand.
export function staffingHoursSummary(state,day='all'){
 const groups=new Map(),byPlatoon={1:0,2:0,3:0};
 for(const r of ledger(state)){
  if(r.paidHoliday||(day!=='all'&&r.day!==Number(day)))continue;
  const key=JSON.stringify([r.source,r.day,r.post]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
 }
 let assigned=0,open=0;
 for(const rows of groups.values()){
  const bounds=[...new Set(rows.flatMap(r=>[r.start,r.end]))].sort((a,b)=>a-b);
  for(let i=0;i<bounds.length-1;i++){const a=bounds[i],b=bounds[i+1],active=rows.filter(r=>r.start<=a&&r.end>=b);if(!active.length)continue;const hours=(b-a)/60;if(active.some(r=>r.guard))assigned+=hours;else{open+=hours;byPlatoon[active[0].p]+=hours;}}
 }
 return {total:assigned+open,assigned,open,byPlatoon};
}
export function openHoursSummary(state,day='all'){const s=staffingHoursSummary(state,day);return {total:s.open,byPlatoon:s.byPlatoon};}
