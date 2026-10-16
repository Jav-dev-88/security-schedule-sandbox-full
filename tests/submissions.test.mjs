import test from 'node:test';import assert from 'node:assert/strict';
import worker from '../src/worker.js';import {FakeD1} from './d1.mjs';
import {generateWeek,currentScheduleWeek} from '../public/workspace-model.js';
import {payrollForWeek} from '../public/payroll-transfers.js';
import {applyWaitingSwitches} from '../public/future-switches.js';

async function call(env,path,{cookie,method='GET',data}={}){const response=await worker.fetch(new Request('https://schedule.test'+path,{method,headers:{...(cookie?{cookie}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined}),env);return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
const row=(id,guard,day)=>({id,p:2,post:'Dock '+id,start:420,end:900,guards:Array.from({length:7},(_,d)=>d===day?guard:''),billable:false});
async function fixture(){
 const env={DB:new FakeD1(false),ADMIN_USERNAME:'admin',ADMIN_PASSWORD:'StrongPassword123',ASSETS:{fetch:async()=>new Response('asset')}};
 const admin=await call(env,'/api/login',{method:'POST',data:{username:'admin',password:env.ADMIN_PASSWORD}}),cookie=admin.cookie;
 const loaded=await call(env,'/api/workspace',{cookie}),w=loaded.data.workspace;w.staff=['Guard A','Guard B','Guard C'];w.master.rows=[row('a','Guard A',0),row('b','Guard B',1)];w.weeks[w.activeWeek]=structuredClone(w.master);
 assert.equal((await call(env,'/api/workspace',{cookie,method:'PUT',data:{workspace:w,revision:loaded.data.revision}})).status,200);
 const guards=[];for(const [name,phone]of [['Guard A','2025550101'],['Guard B','2025550102'],['Guard C','2025550103']]){
  const created=await call(env,'/api/users',{cookie,method:'POST',data:{role:'GUARD',name,guardName:name,phone,generate:true}});assert.equal(created.status,201);
  const login=await call(env,'/api/phone-login',{method:'POST',data:{phone,code:created.data.code}});assert.equal(login.status,200);guards.push({id:created.data.id,cookie:login.cookie});
 }
 const future=new Date(currentScheduleWeek()+'T12:00:00Z');future.setUTCDate(future.getUTCDate()+14);
 return {env,cookie,guards,week:future.toISOString().slice(0,10)};
}
async function futureRequest(f){const {env,guards,week}=f,options=await call(env,'/api/master-switch-options?week='+week+'&partner='+guards[1].id,{cookie:guards[0].cookie});assert.equal(options.status,200);const result=await call(env,'/api/submissions',{cookie:guards[0].cookie,method:'POST',data:{kind:'FUTURE_SWITCH',week,partnerId:guards[1].id,fromKey:options.data.mine[0].key,toKey:options.data.theirs[0].key,note:'Swap Monday with Tuesday'}});assert.equal(result.status,201);return result.data.id;}

test('Future switch waits for partner and manager, then applies on generation while preserving Master',async()=>{
 const f=await fixture(),{env,cookie,guards,week}=f;try{
  const id=await futureRequest(f);
  assert.equal((await call(env,'/api/submissions/'+id,{cookie,method:'PATCH',data:{action:'APPROVE'}})).status,409);
  assert.equal((await call(env,'/api/submissions/'+id,{cookie:guards[2].cookie,method:'PATCH',data:{action:'APPROVE'}})).status,403);
  assert.equal((await call(env,'/api/submissions',{cookie:guards[2].cookie})).data.submissions.length,0,'Unrelated guard cannot see a private request');
  assert.equal((await call(env,'/api/submissions/'+id,{cookie:guards[1].cookie,method:'PATCH',data:{action:'APPROVE'}})).status,200);
  assert.equal((await call(env,'/api/submissions/'+id,{cookie,method:'PATCH',data:{action:'APPROVE'}})).status,200);
  let result=await call(env,'/api/workspace',{cookie});assert(!result.data.workspace.weeks[week]);assert.equal(result.data.workspace.futureSwitches[0].status,'WAITING_SCHEDULE');
  const master=JSON.stringify(result.data.workspace.master),next=generateWeek(result.data.workspace,week);
  assert.equal(next.weeks[week].rows[0].guards[0],'Guard B');assert.equal(next.weeks[week].rows[1].guards[1],'Guard A');assert.equal(JSON.stringify(next.master),master);assert.equal(next.futureSwitches[0].status,'APPLIED');
  assert.equal((await call(env,'/api/workspace',{cookie,method:'PUT',data:{workspace:next,revision:result.data.revision}})).status,200);
  assert.equal((await call(env,'/api/submissions',{cookie:guards[0].cookie})).data.submissions[0].effectiveStatus,'APPLIED');
  assert.equal((await call(env,'/api/submissions/'+id,{cookie,method:'PATCH',data:{action:'APPROVE'}})).status,409);
  assert.equal((await call(env,'/api/master-switch-options?week='+week,{cookie:guards[0].cookie})).status,409,'Existing weekly schedules use the regular switch flow');
 }finally{env.DB.close();}
});

test('Future switch with changed Master or vacation stays untouched and requires review',async()=>{
 const f=await fixture(),{env,cookie,guards,week}=f;try{
  const id=await futureRequest(f);await call(env,'/api/submissions/'+id,{cookie:guards[1].cookie,method:'PATCH',data:{action:'APPROVE'}});
  await call(env,'/api/submissions/'+id,{cookie,method:'PATCH',data:{action:'APPROVE'}});
  const {workspace:w}=(await call(env,'/api/workspace',{cookie})).data;
  w.master.rows[0].post='Changed post';const next=generateWeek(w,week);
  assert.equal(next.weeks[week].rows[0].guards[0],'Guard A');assert.equal(next.futureSwitches[0].status,'NEEDS_REVIEW');assert(next.futureSwitches[0].detail.includes('changed'));
  const restore=structuredClone(w);restore.master.rows[0].post='Dock a';restore.vacations=[{id:'vacation',guard:'Guard A',from:week.slice(0,4)+'-01-01',to:week,payment:'UNPAID',note:''}];
  const vacation=generateWeek(restore,week);assert.equal(vacation.futureSwitches[0].status,'NEEDS_REVIEW');assert.equal(vacation.weeks[week].rows[0].guards[0],'');
  const repeated=structuredClone(next);repeated.weeks[week]=structuredClone(w.master);assert.equal(applyWaitingSwitches(repeated,week).futureSwitches[0].status,'NEEDS_REVIEW');
 }finally{env.DB.close();}
});

test('Missing hours are private, require manager approval, add pay once, and leave worked/billable schedule intact',async()=>{
 const f=await fixture(),{env,cookie,guards}=f;try{
  const loaded=(await call(env,'/api/workspace',{cookie})).data,week=loaded.workspace.activeWeek;
  const d=new Date(week+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-6);const workDate=d.toISOString().slice(0,10),data={kind:'MISSING_HOURS',workDate,hours:2,note:'Two hours missing from my pay',guard:'Guard C'};
  const req=await call(env,'/api/submissions',{cookie:guards[0].cookie,method:'POST',data});assert.equal(req.status,201);
  assert.equal((await call(env,'/api/submissions',{cookie:guards[0].cookie,method:'POST',data})).status,409,'Duplicate submissions are rejected');
  assert.equal((await call(env,'/api/submissions',{cookie:guards[1].cookie})).data.submissions.length,0);
  assert.equal((await call(env,'/api/submissions/'+req.data.id,{cookie:guards[0].cookie,method:'PATCH',data:{action:'APPROVE'}})).status,403);
  const before=(await call(env,'/api/workspace',{cookie})).data.workspace,totals=payrollForWeek(before,week).find(p=>p.guard==='Guard A');assert.equal(before.weeks[week].adjustments?.length||0,0);
  assert.equal((await call(env,'/api/submissions/'+req.data.id,{cookie,method:'PATCH',data:{action:'APPROVE'}})).status,200);
  const after=(await call(env,'/api/workspace',{cookie})).data.workspace,actual=payrollForWeek(after,week).find(p=>p.guard==='Guard A');
  assert.equal(after.weeks[week].adjustments[0].guard,'Guard A','Client cannot submit for another person');assert.equal(actual.payable,totals.payable+2);assert.equal(actual.worked,totals.worked);assert.equal(actual.billable,totals.billable);assert.deepEqual(after.weeks[week].rows,before.weeks[week].rows);
  assert.equal((await call(env,'/api/submissions/'+req.data.id,{cookie,method:'PATCH',data:{action:'APPROVE'}})).status,409);
  for(const hours of [0,-2,25])assert.equal((await call(env,'/api/submissions',{cookie:guards[0].cookie,method:'POST',data:{...data,hours}})).status,400);
  assert.equal((await call(env,'/api/submissions',{cookie:guards[0].cookie,method:'POST',data:{...data,workDate:'2026-02-30'}})).status,400);
 }finally{env.DB.close();}
});

test('Cancelled and declined future requests cannot alter a schedule; missing absent payroll week waits',async()=>{
 const f=await fixture(),{env,cookie,guards}=f;try{
  const id=await futureRequest(f);assert.equal((await call(env,'/api/submissions/'+id,{cookie:guards[0].cookie,method:'PATCH',data:{action:'CANCEL'}})).status,200);
  assert.equal((await call(env,'/api/submissions/'+id,{cookie,method:'PATCH',data:{action:'APPROVE'}})).status,409);
  const second=await futureRequest(f);assert.equal((await call(env,'/api/submissions/'+second,{cookie:guards[1].cookie,method:'PATCH',data:{action:'DENY'}})).status,200);
  assert.equal((await call(env,'/api/submissions/'+second,{cookie,method:'PATCH',data:{action:'APPROVE'}})).status,409);
  const req=await call(env,'/api/submissions',{cookie:guards[0].cookie,method:'POST',data:{kind:'MISSING_HOURS',workDate:'2025-01-06',hours:1,note:'Prior payroll correction'}});assert.equal(req.status,201);
  assert.equal((await call(env,'/api/submissions/'+req.data.id,{cookie,method:'PATCH',data:{action:'APPROVE'}})).status,409);
  assert.equal((await call(env,'/api/submissions',{cookie})).data.submissions.find(r=>r.id===req.data.id).status,'PENDING');
 }finally{env.DB.close();}
});

test('An approved future switch can be withdrawn before generation and never applies afterwards',async()=>{
 const f=await fixture(),{env,cookie,guards,week}=f;try{
  const id=await futureRequest(f);await call(env,'/api/submissions/'+id,{cookie:guards[1].cookie,method:'PATCH',data:{action:'APPROVE'}});await call(env,'/api/submissions/'+id,{cookie,method:'PATCH',data:{action:'APPROVE'}});
  assert.equal((await call(env,'/api/submissions/'+id,{cookie:guards[2].cookie,method:'PATCH',data:{action:'CANCEL'}})).status,403);
  assert.equal((await call(env,'/api/submissions/'+id,{cookie:guards[0].cookie,method:'PATCH',data:{action:'CANCEL'}})).status,200);
  const {workspace:w}=(await call(env,'/api/workspace',{cookie})).data,next=generateWeek(w,week);
  assert.equal(next.futureSwitches[0].status,'CANCELLED');assert.equal(next.weeks[week].rows[0].guards[0],'Guard A');assert.equal(next.weeks[week].rows[1].guards[1],'Guard B');
 }finally{env.DB.close();}
});

test('Cancellation racing an hours approval cannot add pay after the request is cancelled',async()=>{
 const f=await fixture(),{env,cookie,guards}=f;try{
  const {workspace:w}=(await call(env,'/api/workspace',{cookie})).data,d=new Date(w.activeWeek+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-6);
  const req=await call(env,'/api/submissions',{cookie:guards[0].cookie,method:'POST',data:{kind:'MISSING_HOURS',workDate:d.toISOString().slice(0,10),hours:1,note:'Check one missing hour'}});assert.equal(req.status,201);
  const batch=env.DB.batch.bind(env.DB);let intercepted=false;
  env.DB.batch=async statements=>{if(!intercepted&&typeof statements[0]?.args[0]==='string'&&statements[0].args[0].startsWith('{"version":1')){intercepted=true;env.DB.db.prepare("UPDATE guard_submissions SET status='CANCELLED' WHERE id=?").run(req.data.id);}return batch(statements);};
  assert.equal((await call(env,'/api/submissions/'+req.data.id,{cookie,method:'PATCH',data:{action:'APPROVE'}})).status,409);assert(intercepted);
  const after=(await call(env,'/api/workspace',{cookie})).data.workspace;assert.equal(after.weeks[w.activeWeek].adjustments?.length||0,0);
 }finally{env.DB.close();}
});

test('Missing start/end are calculated by server; payment ledger supports partial payment, retries and permissions without duplicate payroll',async()=>{
 const f=await fixture(),{env,cookie,guards}=f;try{
  const {workspace:w}=(await call(env,'/api/workspace',{cookie})).data,d=new Date(w.activeWeek+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-6);const workDate=d.toISOString().slice(0,10);
  const data={kind:'MISSING_HOURS',workDate,startTime:'23:00',endTime:'01:30',hours:99,note:'Overnight unpaid part'};
  const created=await call(env,'/api/submissions',{cookie:guards[0].cookie,method:'POST',data});assert.equal(created.status,201);const id=created.data.id;
  let r=(await call(env,'/api/submissions',{cookie:guards[0].cookie})).data.submissions[0];assert.equal(r.payload.hours,2.5);assert.equal(r.payload.overnight,true);assert.equal(r.payload.startTime,'23:00');
  assert.equal((await call(env,'/api/submissions',{cookie:guards[0].cookie,method:'POST',data:{...data,note:'duplicate changed note'}})).status,409);
  for(const [startTime,endTime] of [['08:00','08:00'],['25:00','12:00'],['','12:00']])assert.equal((await call(env,'/api/submissions',{cookie:guards[0].cookie,method:'POST',data:{...data,startTime,endTime}})).status,400);
  const payment={id:crypto.randomUUID(),hours:1,paidDate:workDate,note:'First payment'};
  assert.equal((await call(env,'/api/submissions/'+id+'/payments',{cookie,method:'POST',data:payment})).status,409);
  assert.equal((await call(env,'/api/submissions/'+id,{cookie,method:'PATCH',data:{action:'APPROVE'}})).status,200);
  const before=(await call(env,'/api/workspace',{cookie})).data.workspace;
  assert.equal((await call(env,'/api/submissions/'+id+'/payments',{cookie:guards[0].cookie,method:'POST',data:payment})).status,403);
  assert.equal((await call(env,'/api/submissions/'+id+'/payments',{cookie,method:'POST',data:{...payment,paidDate:'2026-02-30'}})).status,400);
  assert.equal((await call(env,'/api/submissions/'+id+'/payments',{cookie,method:'POST',data:payment})).status,201);
  assert.equal((await call(env,'/api/submissions/'+id+'/payments',{cookie,method:'POST',data:payment})).status,200,'Retry is idempotent');
  assert.equal((await call(env,'/api/submissions/'+id+'/payments',{cookie,method:'POST',data:{...payment,hours:2}})).status,409);
  assert.equal((await call(env,'/api/submissions/'+id+'/payments',{cookie,method:'POST',data:{...payment,id:crypto.randomUUID(),hours:2}})).status,409,'Cannot overpay remaining hours');
  assert.equal((await call(env,'/api/submissions/'+id+'/payments',{cookie,method:'POST',data:{...payment,id:crypto.randomUUID(),hours:1.5}})).status,201);
  r=(await call(env,'/api/submissions',{cookie:guards[0].cookie})).data.submissions[0];assert.equal(r.payments.length,2);assert.equal(r.payments.reduce((n,p)=>n+p.hours,0),2.5);
  assert.equal((await call(env,'/api/submissions',{cookie:guards[1].cookie})).data.submissions.length,0);
  const after=(await call(env,'/api/workspace',{cookie})).data.workspace;assert.deepEqual(after,before,'Actual payment records do not add another payroll correction');
 }finally{env.DB.close();}
});
