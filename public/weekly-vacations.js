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

// Upcoming starts are anchored to today, independent of the week being viewed.
export function upcomingVacations(workspace,today,days=14){
 const offset=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);},to=offset(today,days),groups=new Map();
 const add=(guard,from,end)=>{if(!guard||!from||!end)return;if(!groups.has(guard))groups.set(guard,[]);groups.get(guard).push({from,to:end});};
 for(const v of workspace.vacations||[])add(v.guard,v.from,v.to);
 for(const [week,state] of Object.entries(workspace.weeks||{})){if(state.isTest)continue;const dates=datesForWeek(week);for(const e of state.events||[])if(e.type==='Vacation'&&dates[e.day])add(e.guard,dates[e.day],dates[e.day]);}
 const guards=[];for(const [guard,ranges] of groups){const merged=[];for(const r of ranges.sort((a,b)=>a.from.localeCompare(b.from)||a.to.localeCompare(b.to))){const last=merged.at(-1);if(last&&r.from<=offset(last.to,1))last.to=last.to>r.to?last.to:r.to;else merged.push({...r});}for(const r of merged)if(r.from>=today&&r.from<=to)guards.push({guard,...r,daysUntil:Math.round((Date.parse(r.from+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000)});}
 return {from:today,to,guards:guards.sort((a,b)=>a.from.localeCompare(b.from)||a.guard.localeCompare(b.guard))};
}
