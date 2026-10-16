import {datesForWeek,scheduleToday} from './workspace-model.js';
export function missingInterval(start,end){
 const parse=t=>{if(typeof t!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))throw Error('Enter valid start and end times.');return Number(t.slice(0,2))*60+Number(t.slice(3));};
 const a=parse(start),b=parse(end);if(a===b)throw Error('Start and end must be different.');const minutes=(b-a+1440)%1440;return {startTime:start,endTime:end,hours:minutes/60,overnight:b<a};
}
export function validatePeople(w){
 const obj=x=>x&&typeof x==='object'&&!Array.isArray(x);
 if(w.staffProfiles!==undefined){if(!obj(w.staffProfiles)||Object.keys(w.staffProfiles).length>1000)throw Error('Invalid staff profiles.');for(const [name,p] of Object.entries(w.staffProfiles)){if(!name||name.length>80||!obj(p)||typeof p.hireDate!=='string'||(p.hireDate&&(p.hireDate>scheduleToday()||!/^\d{4}-\d{2}-\d{2}$/.test(p.hireDate)||!Number.isFinite(Date.parse(p.hireDate+'T12:00:00Z'))||new Date(p.hireDate+'T12:00:00Z').toISOString().slice(0,10)!==p.hireDate)))throw Error('Enter a valid hire date.');}}
 if(w.leaveAllowances!==undefined){if(!obj(w.leaveAllowances)||Object.keys(w.leaveAllowances).length>100)throw Error('Invalid leave allowances.');for(const [year,entries] of Object.entries(w.leaveAllowances)){if(!/^\d{4}$/.test(year)||!obj(entries)||Object.keys(entries).length>1000)throw Error('Invalid allowance year.');for(const [name,a] of Object.entries(entries)){if(!name||name.length>80||!obj(a)||['sick','personal'].some(k=>typeof a[k]!=='number'||!Number.isFinite(a[k])||a[k]<0||a[k]>366))throw Error('Enter allowances between 0 and 366 days.');}}}
}
export function regularGuards(w){return [...new Set(w.staff||[])].filter(n=>!(w.temporaryStaff||[]).includes(n)&&!(w.inactiveStaff||[]).includes(n)).sort((a,b)=>a.localeCompare(b));}
export function leaveUse(w,guard,year){
 const days=new Map();for(const [week,s] of Object.entries(w.weeks)){if(s.isTest)continue;const dates=datesForWeek(week);for(const e of s.events||[]){const type=/^sick/i.test(e.type)?'sick':/^personal/i.test(e.type)?'personal':null,date=dates[e.day];if(e.guard!==guard||!type||!date?.startsWith(String(year)+'-'))continue;const key=date+'|'+type;if(!days.has(key))days.set(key,{date,type,intervals:[]});days.get(key).intervals.push([e.start,e.end]);}}
 return [...days.values()].map(d=>{let total=0,end=-Infinity;for(const [a,b] of d.intervals.sort((a,b)=>a[0]-b[0])){total+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}return {date:d.date,type:d.type,hours:Math.min(8,total/60)};}).sort((a,b)=>a.date.localeCompare(b.date));
}
export function ownLeaveBalances(w,guard){const years=new Set([String(new Date().getUTCFullYear()),...Object.keys(w.leaveAllowances||{}),...Object.keys(w.weeks).map(end=>end.slice(0,4))]);return [...years].sort().map(year=>({year,allowance:w.leaveAllowances?.[year]?.[guard]||null,use:leaveUse(w,guard,year)}));}
export function seniority(w){return regularGuards(w).map(name=>({name,hireDate:w.staffProfiles?.[name]?.hireDate||''})).sort((a,b)=>(a.hireDate||'9999').localeCompare(b.hireDate||'9999')||a.name.localeCompare(b.name));}
