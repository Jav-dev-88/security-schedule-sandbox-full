import {masterShiftOptions,shiftSignature,checkPlannedSwitch,applyPlannedSwitch} from '../public/future-switches.js';
import {datesForWeek,scheduleToday,currentScheduleWeek} from '../public/workspace-model.js';
import {saveAdjustment} from '../public/pay-adjustments.js';

export async function submissionsApi(request,user,db,url,{body,json,fail,manager,canManage,readWorkspace,writeWorkspace,audit,now}){
 const path=url.pathname,method=request.method;
 if(!path.startsWith('/api/submissions')&&path!=='/api/master-switch-options')return null;
 const partnerFor=async id=>{const partner=await db.prepare("SELECT * FROM users WHERE id=? AND guard_name<>'' AND disabled=0 AND id<>?").bind(id||'',user.id).first();if(!partner||partner.guard_name===user.guard_name)fail(400,'Choose another guard with an active account.');return partner;};
 if(path==='/api/master-switch-options'&&method==='GET'){
  if(!user.guard_name)fail(403,'Your account needs a linked schedule name.');const week=url.searchParams.get('week');try{datesForWeek(week);}catch(e){fail(400,e.message);}const w=(await readWorkspace(db)).workspace;
  if(w.weeks[week])fail(409,'This weekly schedule already exists. Use Switch shifts instead.');if(week<currentScheduleWeek())fail(400,'Choose the current week or a future week.');const partner=url.searchParams.get('partner')?await partnerFor(url.searchParams.get('partner')):null;
  return json({week,dates:datesForWeek(week),source:'MASTER',mine:masterShiftOptions(w.master,user.guard_name),theirs:partner?masterShiftOptions(w.master,partner.guard_name):[]});
 }
 if(path==='/api/submissions'&&method==='GET'){
  const query='SELECT r.*,u.name AS requester_name,u.guard_name AS requester_guard,p.name AS partner_name FROM guard_submissions r JOIN users u ON u.id=r.user_id LEFT JOIN users p ON p.id=r.partner_user_id';
  const rows=canManage(user)?await db.prepare(query+' ORDER BY r.created_at DESC LIMIT 300').all():await db.prepare(query+' WHERE r.user_id=? OR r.partner_user_id=? ORDER BY r.created_at DESC LIMIT 100').bind(user.id,user.id).all();
  const w=(await readWorkspace(db)).workspace;return json({submissions:rows.results.map(r=>{const plan=(w.futureSwitches||[]).find(p=>p.id===r.id);return {...r,payload:JSON.parse(r.payload),effectiveStatus:r.status==='APPROVED'&&plan?plan.status:r.status,detail:plan?.detail||''};})});
 }
 if(path==='/api/submissions'&&method==='POST'){
  if(!user.guard_name)fail(403,'Your account needs a linked schedule name.');const b=await body(request),w=(await readWorkspace(db)).workspace;
  const note=String(b.note||'').trim();if(!note||note.length>250)fail(400,'Enter a note of up to 250 characters.');let payload,partner=null;
  if(b.kind==='FUTURE_SWITCH'){
   try{datesForWeek(b.week);}catch(e){fail(400,e.message);}if(w.weeks[b.week])fail(409,'This week exists. Use Switch shifts instead.');if(b.week<currentScheduleWeek())fail(400,'Choose the current week or a future week.');partner=await partnerFor(b.partnerId);
   payload={week:b.week,fromKey:b.fromKey,toKey:b.toKey,requester:user.guard_name,partner:partner.guard_name,note};
   try{payload.fromSignature=shiftSignature(w.master,b.fromKey,user.guard_name);payload.toSignature=shiftSignature(w.master,b.toKey,partner.guard_name);payload.from=masterShiftOptions(w.master,user.guard_name).find(s=>s.key===b.fromKey);payload.to=masterShiftOptions(w.master,partner.guard_name).find(s=>s.key===b.toKey);applyPlannedSwitch({...w,weeks:{...w.weeks,[b.week]:w.master}},user,partner,payload);}catch(e){fail(400,e.message);}
  }else if(b.kind==='MISSING_HOURS'){
   if(typeof b.workDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.workDate)||!Number.isFinite(Date.parse(b.workDate+'T12:00:00Z'))||new Date(b.workDate+'T12:00:00Z').toISOString().slice(0,10)!==b.workDate||b.workDate>scheduleToday())fail(400,'Choose a valid date today or earlier.');
   const hours=Number(b.hours);if(!Number.isFinite(hours)||hours<=0||hours>24)fail(400,'Enter missing hours above 0 and no more than 24.');const week=currentScheduleWeek(new Date(b.workDate+'T16:00:00Z'));
   payload={week,workDate:b.workDate,day:datesForWeek(week).indexOf(b.workDate),hours,guard:user.guard_name,note};
  }else fail(400,'Choose a future switch or missing hours.');
  const existing=await db.prepare("SELECT payload FROM guard_submissions WHERE user_id=? AND kind=? AND status NOT IN ('DENIED','CANCELLED')").bind(user.id,b.kind).all();if(existing.results.some(r=>{const p=JSON.parse(r.payload);return b.kind==='MISSING_HOURS'?p.workDate===payload.workDate&&p.hours===payload.hours&&p.note===note:p.week===payload.week&&p.fromKey===payload.fromKey&&p.toKey===payload.toKey&&p.partner===payload.partner;}))fail(409,'This request was already submitted. Check My requests.');
  const id=crypto.randomUUID();await db.prepare('INSERT INTO guard_submissions(id,user_id,kind,payload,partner_user_id,partner_status,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,user.id,b.kind,JSON.stringify(payload),partner?.id||null,partner?'PENDING':'NONE',now()).run();await audit(db,user,'GUARD_SUBMISSION',b.kind+' '+id);return json({id},201);
 }
 const match=path.match(/^\/api\/submissions\/([^/]+)$/);if(!match||method!=='PATCH')fail(404,'Request endpoint not found.');
 const r=await db.prepare('SELECT * FROM guard_submissions WHERE id=?').bind(match[1]).first();if(!r)fail(404,'Request not found.');const b=await body(request);
 if(r.status==='APPROVED'&&r.kind==='FUTURE_SWITCH'&&b.action==='CANCEL'){
  if(r.user_id!==user.id)manager(user);const {workspace:w,revision}=await readWorkspace(db),next=structuredClone(w),plan=(next.futureSwitches||[]).find(p=>p.id===r.id);
  if(!plan||plan.status==='APPLIED')fail(409,'An applied switch cannot be cancelled here. Ask a manager to review the weekly schedule.');plan.status='CANCELLED';plan.detail='Cancelled before being applied.';
  const updated=await writeWorkspace(db,user,next,revision,'Cancelled future switch '+r.id,[nonce=>db.prepare("UPDATE guard_submissions SET status='CANCELLED' WHERE id=? AND status='APPROVED' AND EXISTS(SELECT 1 FROM workspace WHERE write_nonce=?)").bind(r.id,nonce)],r.id,'APPROVED');return json({ok:true,revision:updated});
 }
 if(r.status!=='PENDING')fail(409,'This request was already decided.');
 if(b.action==='CANCEL'&&r.user_id===user.id){const result=await db.prepare("UPDATE guard_submissions SET status='CANCELLED' WHERE id=? AND status='PENDING'").bind(r.id).run();if(!result.meta.changes)fail(409,'Request already decided.');await audit(db,user,'CANCEL_SUBMISSION',r.id);return json({ok:true});}
 if(r.partner_user_id===user.id&&(!canManage(user)||b.partnerResponse)){
  if(!['APPROVE','DENY'].includes(b.action))fail(400,'Choose accept or decline.');const status=b.action==='APPROVE'?'APPROVED':'DENIED';const result=await db.prepare("UPDATE guard_submissions SET partner_status=?,status=CASE WHEN ?='DENIED' THEN 'DENIED' ELSE status END WHERE id=? AND status='PENDING' AND partner_status='PENDING'").bind(status,status,r.id).run();if(!result.meta.changes)fail(409,'The partner response was already recorded.');await audit(db,user,'PARTNER_SUBMISSION',r.id+' '+status);return json({ok:true});
 }
 manager(user);if(!['APPROVE','DENY'].includes(b.action))fail(400,'Choose approve or deny.');const note=String(b.note||'').slice(0,500);
 if(b.action==='DENY'){const changed=await db.prepare("UPDATE guard_submissions SET status='DENIED',decision_note=?,decided_by=?,decided_at=? WHERE id=? AND status='PENDING'").bind(note,user.id,now(),r.id).run();if(!changed.meta.changes)fail(409,'Request already decided.');await audit(db,user,'DENY_SUBMISSION',r.id);return json({ok:true});}
 if(r.kind==='FUTURE_SWITCH'&&r.partner_status!=='APPROVED')fail(409,'The other guard must accept first.');const actor=await db.prepare('SELECT * FROM users WHERE id=?').bind(r.user_id).first();if(!actor||actor.disabled)fail(409,'The requesting account must be active.');
 const {workspace:w,revision}=await readWorkspace(db),p=JSON.parse(r.payload);let next=structuredClone(w);
 if(r.kind==='MISSING_HOURS'){
  if(actor.guard_name!==p.guard)fail(409,'The account schedule name changed. Review and resubmit.');if(!next.weeks[p.week])fail(409,'Create W-E '+p.week+' before approving these hours.');
  if(next.weeks[p.week].isTest)fail(409,'Missing hours cannot be added to a test payroll.');
  if((next.weeks[p.week].adjustments||[]).some(a=>a.id==='request-'+r.id))fail(409,'These hours were already added.');
  next.weeks[p.week]=saveAdjustment(next.weeks[p.week],{guard:p.guard,day:p.day,type:'Missing worked hours',hours:p.hours,note:'Guard request: '+p.note});next.weeks[p.week].adjustments.at(-1).id='request-'+r.id;
 }else{
  const partner=await db.prepare('SELECT * FROM users WHERE id=?').bind(r.partner_user_id).first();if(!partner||partner.disabled||actor.guard_name!==p.requester||partner.guard_name!==p.partner)fail(409,'Both accounts and their schedule names must still match.');
  try{checkPlannedSwitch(next.weeks[p.week]||next.master,p);if(next.weeks[p.week])next=applyPlannedSwitch(next,actor,partner,p);}catch(e){fail(409,e.message);}
  next.futureSwitches??=[];if(next.futureSwitches.some(plan=>plan.id===r.id))fail(409,'This switch was already approved.');next.futureSwitches.push({...p,id:r.id,status:next.weeks[p.week]?'APPLIED':'WAITING_SCHEDULE',detail:next.weeks[p.week]?'Applied to the weekly schedule.':'Approved. Waiting for this weekly schedule to be created.'});
 }
 const updated=await writeWorkspace(db,user,next,revision,'Approved '+r.kind+' '+r.id,[nonce=>db.prepare("UPDATE guard_submissions SET status='APPROVED',decision_note=?,decided_by=?,decided_at=? WHERE id=? AND status='PENDING' AND EXISTS(SELECT 1 FROM workspace WHERE write_nonce=?)").bind(note,user.id,now(),r.id,nonce)],r.id);
 return json({ok:true,revision:updated});
}
