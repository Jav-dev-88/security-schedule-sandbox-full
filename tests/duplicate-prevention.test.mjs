import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkspace,applyVacation,validateWorkspace} from '../src/domain.js';
import {ledger} from '../public/editor-model.js';
import {payrollSummary,workedTotalsByDay} from '../public/payroll.js';
import {addPayrollTransfer,payrollForWeek} from '../public/payroll-transfers.js';
const row=(id,start,end,day=0,billable=false)=>({id,post:id,p:start>=1380?1:2,start,end,guards:Array.from({length:7},(_,d)=>d===day?'Guard A':''),billable});
const state=rows=>({version:2,rows,plans:{},overrides:{},events:[]});
const setup=(rows,dest=[])=>{const w=newWorkspace();w.activeWeek='2026-10-18';w.weeks={'2026-10-18':state(rows),'2026-10-11':state(dest)};return w;};
const sum=(rows,key)=>rows.reduce((n,r)=>n+(r[key]||0),0);

test('approved linked vacation records each part once, including repeated request application',()=>{
 const w=setup([row('early',510,900),row('late',900,990)]),user={guard_name:'Guard A'},payload={week:w.activeWeek,days:[0,0]};
 const next=applyVacation(w,user,payload);assert.equal(next.weeks[w.activeWeek].events.length,2);assert.deepEqual(next.weeks[w.activeWeek].events.map(e=>e.source),['early','late']);
 assert.deepEqual(applyVacation(next,user,payload),next);assert.equal(w.weeks[w.activeWeek].events.length,0);
});
test('overnight overlap across adjacent shift days counts each minute once and keeps billable credit',()=>{
 const s=state([row('night',1380,1860),row('morning',360,840,1,true)]),pay=payrollSummary(s);
 assert.equal(sum(pay,'worked'),15);assert.equal(sum(pay,'billable'),8);assert.equal(sum(pay,'overlap'),1);assert(pay.every(g=>g.billable<=g.worked));
 assert.equal(pay.find(g=>g.day===0).worked,8);assert.equal(pay.find(g=>g.day===1).worked,7);
});
test('transferring a different work date retains legitimate destination-week hours',()=>{
 let w=setup([row('shift',420,900)],[row('destination',420,900,6)]);w=addPayrollTransfer(w,w.activeWeek,ledger(w.weeks[w.activeWeek])[0],'2026-10-11','Continuation');
 assert.equal(sum(payrollForWeek(w,w.activeWeek),'worked'),0);const dest=payrollForWeek(w,'2026-10-11');assert.equal(sum(dest,'worked'),16);assert.equal(sum(dest,'transferredIn'),8);assert.doesNotThrow(()=>validateWorkspace(w));
});
test('outgoing transfer removes overlapping source minutes too, while preserving work and billing across weeks',()=>{
 let w=setup([row('shift',420,900),row('overlap',600,960,0,true)]);const before=payrollSummary(w.weeks[w.activeWeek]);w=addPayrollTransfer(w,w.activeWeek,ledger(w.weeks[w.activeWeek]).find(r=>r.source==='shift'),'2026-10-11','Move hours');
 const source=payrollForWeek(w,w.activeWeek),dest=payrollForWeek(w,'2026-10-11');assert.equal(sum(source,'worked'),1);assert.equal(sum(dest,'worked'),8);assert.equal(sum(source,'worked')+sum(dest,'worked'),sum(before,'worked'));assert.equal(sum(source,'billable')+sum(dest,'billable'),sum(before,'billable'));assert.doesNotThrow(()=>validateWorkspace(w));
});
test('overlapping transfers to the same destination merge, while sending the same minutes to different weeks is blocked',()=>{
 let w=setup([row('shift',420,900),row('overlap',600,960)]);const shifts=ledger(w.weeks[w.activeWeek]);w=addPayrollTransfer(w,w.activeWeek,shifts[0],'2026-10-11','First');
 assert.throws(()=>addPayrollTransfer(w,w.activeWeek,shifts[1],'2026-10-04','Second'),/Overlapping hours/);
 w=addPayrollTransfer(w,w.activeWeek,shifts[1],'2026-10-11','Same payroll week');assert.equal(sum(payrollForWeek(w,'2026-10-11'),'worked'),9);assert.equal(sum(payrollForWeek(w,'2026-10-11'),'transferredIn'),9);assert.equal(sum(payrollForWeek(w,w.activeWeek),'transferredOut'),9);
});
test('shared work calculation agrees with an independent minute-by-minute reference across overlaps',()=>{
 const shifts=[];for(let n=0;n<40;n++)shifts.push({guard:'Guard '+(n%3),day:n%7,start:(n*137)%1440,end:(n*137)%1440+30+(n*71)%720,billable:n%4===0});
 const expected=new Map();for(const guard of new Set(shifts.map(s=>s.guard)))for(let minute=0;minute<8*1440;minute++){
  const active=shifts.filter(r=>r.guard===guard&&r.day*1440+r.start<=minute&&minute<r.day*1440+r.end);if(!active.length)continue;
  const key=guard+'|'+Math.min(...active.map(r=>r.day)),g=expected.get(key)||{worked:0,billable:0};g.worked++;if(active.some(r=>r.billable))g.billable++;expected.set(key,g);
 }
 const actual=workedTotalsByDay(shifts);assert.equal(actual.size,expected.size);for(const [key,v]of expected){assert(Math.abs(actual.get(key).worked-v.worked/60)<1e-8,key);assert(Math.abs(actual.get(key).billable-v.billable/60)<1e-8,key);}
});

test('distinct days and source weeks transferred to one payroll week stay separate',()=>{
 let w=setup([row('monday',420,900),row('tuesday',420,900,1)]);w.weeks['2026-10-25']=state([row('another-monday',420,900)]);
 const shifts=ledger(w.weeks[w.activeWeek]);for(const r of shifts)w=addPayrollTransfer(w,w.activeWeek,r,'2026-10-11','Distinct work date');
 w=addPayrollTransfer(w,'2026-10-25',ledger(w.weeks['2026-10-25'])[0],'2026-10-11','Another source week');
 const dest=payrollForWeek(w,'2026-10-11');assert.equal(sum(dest,'worked'),24);assert.equal(sum(dest,'transferredIn'),24);assert.equal(sum(payrollForWeek(w,w.activeWeek),'worked'),0);
});
