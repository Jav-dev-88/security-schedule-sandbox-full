import {datesForWeek} from './workspace-model.js';

// Dates, rather than shift records, keep split shifts and saved ranges from duplicating guards.
export function weeklyVacations(workspace,weekEnd){
 const next=new Date(weekEnd+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+7);
 return [weekEnd,next.toISOString().slice(0,10)].map(end=>{
  const dates=datesForWeek(end),groups=new Map();
  const add=(guard,date)=>{if(!guard||!dates.includes(date))return;if(!groups.has(guard))groups.set(guard,new Set());groups.get(guard).add(date);};
  for(const v of workspace.vacations||[])for(const date of dates)if(v.from<=date&&date<=v.to)add(v.guard,date);
  for(const e of workspace.weeks?.[end]?.events||[])if(e.type==='Vacation')add(e.guard,dates[e.day]);
  return {weekEnd:end,from:dates[0],to:dates[6],guards:[...groups].sort(([a],[b])=>a.localeCompare(b,'en',{sensitivity:'base',numeric:true})).map(([guard,days])=>{
   const ranges=[];for(const date of [...days].sort()){const last=ranges.at(-1);if(last&&dates.indexOf(date)===dates.indexOf(last.to)+1)last.to=date;else ranges.push({from:date,to:date});}
   return {guard,ranges};
  })};
 });
}
