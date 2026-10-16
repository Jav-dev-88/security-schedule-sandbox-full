import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import * as people from '../public/people-model.js';import * as editor from '../public/editor-model.js';import * as ws from '../public/workspace-model.js';import {newWorkspace} from '../src/domain.js';import {payrollForWeek} from '../public/payroll-transfers.js';import {fullScheduleHtml} from '../public/guard-portal.js';
test('Management tabs open the request week, preserve reports, save allowances and dates, and record partial payments',async()=>{
 const nodes=new Map(),listeners=new Map();
 class Element{
  constructor(id=''){this.id=id;this.children=[];this.dataset={};this.value='';this.hidden=false;this.classList={toggle(){},add(){}};}
  set innerHTML(html){this.cache={};this.html=html;for(const m of html.matchAll(/<[^>]+>/g)){const tag=m[0],id=tag.match(/id="([^"]+)"/)?.[1];if(!id)continue;const e=new Element(id);e.value=tag.match(/value="([^"]*)"/)?.[1]||'';nodes.set(id,e);}}
  get innerHTML(){return this.html||'';}
  append(e){this.children.push(e);if(e.id)nodes.set(e.id,e);}
  insertBefore(e){this.append(e);}
  querySelector(){return new Element();}
  querySelectorAll(selector){if(!selector.startsWith('[data-'))return [];this.cache??={};if(this.cache[selector])return this.cache[selector];const key=selector.slice(1,-1);return this.cache[selector]=[...this.innerHTML.matchAll(new RegExp(key+'="([^"]+)"','g'))].map(m=>{const e=new Element();e.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=m[1];return e;});}
  setAttribute(){}scrollIntoView(){}
 }
 for(const id of ['payrollDetails','payrollPanel','staffAccessTools','weekSelect','printPayroll'])nodes.set(id,new Element(id));
 const tabs=['missing','leave','reports','seniority'].map(name=>{const e=new Element();e.dataset.hoursTab=name;return e;});
 const w=newWorkspace();w.staff=['A','B'];w.weeks['2025-01-12']=structuredClone(w.master);w.weeks['2025-01-12'].rows=[{id:'dock',p:2,post:'Dock',start:420,end:900,guards:['A','','','','','',''],billable:false}];
 const requests=[{id:'req',kind:'MISSING_HOURS',status:'PENDING',payload:{guard:'A',week:'2025-01-12',workDate:'2025-01-06',day:0,hours:2.5,startTime:'23:00',endTime:'01:30',overnight:true,note:'Overnight gap'},payments:[]}],calls=[],saved=[],storage=new Map();let page='weekly',reloads=0;
 const context={...people,...editor,...ws,payrollForWeek,fullScheduleHtml,crypto,console,sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},location:{reload:()=>reloads++},document:{getElementById:id=>nodes.get(id),createElement:()=>new Element(),querySelectorAll:s=>s==='[data-hours-tab]'?tabs:[],addEventListener:(k,f)=>listeners.set(k,f)},window:{scheduleApp:{getWorkspace:()=>structuredClone(w),getPage:()=>page,showPage:p=>{page=p;context.window.managerPageChanged(p);},selectReviewWeek:week=>{w.activeWeek=week;},savePeople:async fields=>{saved.push(fields);Object.assign(w,structuredClone(fields));}}},savesFinished:async()=>{},download(){},api:async(path,options)=>{if(options){const body=JSON.parse(options.body);calls.push({path,body});if(path.endsWith('/payments'))requests[0].payments.push({hours:body.hours,paid_date:body.paidDate,note:body.note});return {};}return {submissions:structuredClone(requests)};}};
 const code=fs.readFileSync(new URL('../public/people-tools.js',import.meta.url),'utf8').replace(/^import .+;\n/gm,'').replace(/export /g,'');vm.createContext(context);vm.runInContext(code,context);await context.initPeopleTools();
 await vm.runInContext("choose('missing')",context);assert.equal(w.activeWeek,'2025-01-12','Request week is loaded automatically');assert(nodes.get('missingReview').innerHTML.includes('23:00–01:30'));assert(nodes.get('missingSchedule').innerHTML.includes('Dock'));assert.equal(nodes.get('payrollPanel').hidden,true);
 await nodes.get('approveMissing').onclick();assert.equal(calls.at(-1).body.action,'APPROVE');assert.equal(reloads,1);
 requests[0].status='APPROVED';await vm.runInContext('load()',context);nodes.get('missingPaidHours').value='1';await nodes.get('missingPaymentForm').onsubmit({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.equal(calls.at(-1).body.hours,1);assert(nodes.get('missingReview').innerHTML.includes('1.50 hrs'));
 await vm.runInContext("choose('reports')",context);assert.equal(nodes.get('payrollPanel').hidden,false);assert.equal(nodes.get('peopleContent').hidden,true);
 await vm.runInContext("choose('leave')",context);nodes.get('peopleContent').querySelectorAll('[data-edit-balance]')[0].onclick();

 nodes.get('allowSick').value='8';nodes.get('allowPersonal').value='3';await nodes.get('balanceForm').onsubmit({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.equal(saved.at(-1).leaveAllowances[2026].A.sick,8);
 await vm.runInContext("choose('seniority')",context);nodes.get('peopleContent').querySelectorAll('[data-hire]')[0].onclick();nodes.get('hireDate').value='2010-01-01';await nodes.get('hireForm').onsubmit({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.equal(saved.at(-1).staffProfiles.A.hireDate,'2010-01-01');
 requests[0].payload.week='2024-01-14';await vm.runInContext("choose('missing')",context);assert(nodes.get('missingReview').innerHTML.includes('weekly schedule has not been created'));assert(nodes.get('missingMaster'));
});
