export const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export const DATES=['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10','2026-10-11'];
export const STAFF=['Samuel','Collado','Echevarria','Rasheed','Carson','Lodvil','Ralph','Assouman','Jackie','Koudjoji','Gobardhan','Lamont','Williams','Escolastico','Flores'];
export const POST_OPTIONS=['32nd LD — Additional Coverage','33rd LD — Additional Coverage','Lobby — Additional Coverage','FLSD — Additional Coverage','Rover — Additional Coverage','6th Ave Entrance — Additional Coverage'];
export const BASE=[
{id:'desk',post:'Desk',start:1380,end:1860,p:1,guards:['Jackie','Jackie','Jackie','Jackie','Koudjoji','Samuel','Samuel'],billable:false},
{id:'night',post:'Building Rover (P1)',start:1380,end:1860,p:1,guards:['Assouman','Samuel','Koudjoji','Koudjoji','Samuel','Gobardhan','Gobardhan'],billable:false},
{id:'supervisor',post:'Supervisor',start:360,end:1020,p:2,guards:['Williams','Williams','Williams','Williams','Williams','',''],billable:false},
{id:'daylobby',post:'FLSD / Lobby Sat & Sun',start:420,end:900,p:2,guards:['Echevarria','Echevarria','Echevarria','Echevarria','Echevarria','Escolastico','Escolastico'],billable:false},
{id:'dock2',post:'Loading Dock 32nd St. (P2)',start:420,end:900,p:2,guards:['Lamont','Lamont','Lamont','Lamont','Lamont','',''],billable:false},
{id:'entrance',post:'6th Ave Main Entrance',start:420,end:1140,p:2,guards:['Collado','Escolastico','Assouman','Assouman','Escolastico','',''],billable:false},
{id:'relief',post:'Rover / Relief',start:480,end:960,p:2,guards:['Lodvil','Ralph','Ralph','Ralph','Ralph','',''],billable:false},
{id:'lobby',post:'Lobby',start:510,end:900,p:2,guards:['Rasheed','Rasheed','Rasheed','Rasheed','Carson','',''],billable:false},
{id:'flsd',post:'FLSD',start:900,end:1380,p:3,guards:['Flores','Flores','Flores','Flores','Flores','',''],billable:false},
{id:'rover',post:'Rover Guard',start:900,end:1380,p:3,guards:['Samuel','Collado','Samuel','Lodvil','Lodvil','Collado','Collado'],billable:false},
{id:'dock3',post:'Loading Dock 32nd St. (P3)',start:900,end:990,p:3,guards:['Rasheed','Rasheed','Rasheed','Rasheed','Carson','',''],billable:false},
{id:'weekend',post:'Sat & Sun Lobby',start:900,end:1380,p:3,guards:['','','','','','Ralph','Assouman'],billable:false}
];
export const fmt=n=>String(Math.floor((n%1440)/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
export function parseTime(value){const s=String(value).trim();let hour,minute;if(/^\d{1,2}$/.test(s)){hour=+s;minute=0;}else if(/^\d{3,4}$/.test(s)){hour=+s.slice(0,-2);minute=+s.slice(-2);}else if(/^\d{1,2}:\d{2}$/.test(s)){[hour,minute]=s.split(':').map(Number);}else throw Error('Use military time, such as 15, 1500 or 15:00.');if(hour>23||minute>59)throw Error('Time must be between 0000 and 2359.');return hour*60+minute;}
export const key=(id,day)=>id+'|'+day;
export function segments(plans={}){const list=[];for(const source of BASE)for(let day=0;day<7;day++){const guard=source.guards[day],plan=plans[key(source.id,day)];if(!guard&&!source.open?.[day])continue;const add=(post,start,end,name,billable,role,note)=>{if(end>start)list.push({source:source.id,post,start,end,guard:name,billable,p:role==='regular'&&start===source.start?source.p:start%1440>=900&&start%1440<1380?3:start%1440>=1380||start%1440<420?1:2,day,role,note});};if(!plan){add(source.post,source.start,source.end,guard,source.billing?.[day]??source.billable,guard?'regular':'open',guard?'Regular scheduled shift':'Needs coverage');continue;}
add(source.post,source.start,plan.from,guard,source.billing?.[day]??source.billable,'regular','Worked before changing post');
add(plan.post,plan.from,plan.to,guard,plan.billable,'transfer','Part of the same shift at another post; returns '+(plan.returns?'at '+fmt(plan.to):'not scheduled'));
if(plan.needsCover)add(source.post,plan.from,plan.to,plan.replacement||'',source.billing?.[day]??source.billable,plan.replacement?'coverage':'open',plan.replacement?'Covers '+guard+' while at '+plan.post:'Needs coverage while '+guard+' works at '+plan.post);
if(plan.returns)add(source.post,plan.to,source.end,guard,source.billing?.[day]??source.billable,'return','Returned to regular post');else if(plan.needsCover)add(source.post,plan.to,source.end,'',source.billing?.[day]??source.billable,'open','Needs coverage; original guard does not return');
}return list;}
export function validate(plan,plans={}){const source=BASE.find(r=>r.id===plan.source);if(!source||!Number.isInteger(plan.day)||plan.day<0||plan.day>6||!source.guards[plan.day])throw Error('Choose a staffed test shift.');if(!Number.isFinite(plan.from)||!Number.isFinite(plan.to)||plan.from<source.start||plan.to>source.end||plan.to<=plan.from)throw Error('Choose a period inside the original '+fmt(source.start)+'–'+fmt(source.end)+' shift.');if(!plan.post.trim())throw Error('Enter the destination post.');if(plan.post.trim()===source.post)throw Error('Choose a different post.');if(plan.replacement===source.guards[plan.day])throw Error('The same guard cannot cover both posts at once.');if(plan.needsCover&&plan.replacement){const a=plan.day*1440+plan.from,b=plan.day*1440+plan.to;const others=segments(plans).filter(r=>r.guard===plan.replacement&&!(r.source===plan.source&&r.day===plan.day));if(others.some(r=>Math.max(a,r.day*1440+r.start)<Math.min(b,r.day*1440+r.end)))throw Error(plan.replacement+' already works during this coverage period. Choose another guard or leave it OPEN.');}return plan;}
export function total(list,guard,day){const rows=list.filter(r=>r.guard===guard&&(day==null||r.day===day));return {worked:rows.reduce((n,r)=>n+(r.end-r.start)/60,0),billable:rows.filter(r=>r.billable).reduce((n,r)=>n+(r.end-r.start)/60,0)};}
