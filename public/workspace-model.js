import {fmt} from './model.js';
import {initialState,ledger,segmentKey,addRow} from './editor-model.js';
export function createWorkspace(weekly){return {version:1,master:initialState(),masterLocked:false,weeks:{'2026-10-11':structuredClone(weekly)},activeWeek:'2026-10-11',mode:'weekly',staff:[]};}
export function datesForWeek(end){if(!/^\d{4}-\d{2}-\d{2}$/.test(end))throw Error('Choose the week-ending date.');const d=new Date(end+'T12:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==end||d.getUTCDay()!==0)throw Error('Choose a Sunday week ending.');return Array.from({length:7},(_,i)=>{const day=new Date(d);day.setUTCDate(day.getUTCDate()-6+i);return day.toISOString().slice(0,10);});}
export function generateWeek(workspace,end,{overwrite=false}={}){datesForWeek(end);if(workspace.weeks[end]&&!overwrite)throw Error('This test week already exists.');const copy=structuredClone(workspace);copy.weeks[end]=structuredClone(copy.master);copy.weeks[end].events=[];copy.activeWeek=end;copy.mode='weekly';return copy;}
export function saveActive(workspace,state){const copy=structuredClone(workspace);if(copy.mode==='master'){if(copy.masterLocked)throw Error('Master is locked. Unlock it to edit.');copy.master=structuredClone(state);}else copy.weeks[copy.activeWeek]=structuredClone(state);return copy;}
export function attendanceEvent(state,target,{type,time='',cover='',payment='PENDING',paidHours=0,note=''}){
 if(cover&&cover===target.guard)throw Error('Choose another covering guard.');
 if(!target.guard)throw Error('Choose a staffed cell.');const next=structuredClone(state),id=segmentKey(target),hours=(target.end-target.start)/60;
 const event={id:crypto.randomUUID(),guard:target.guard,day:target.day,post:target.post,start:target.start,end:target.end,type,time,cover,payment,requestedHours:Math.min(8,hours),paidHours:payment==='PAID'?Math.max(0,Math.min(8,hours,Number(paidHours)||0)):0,note};
 if(type==='Left early'||type==='Came late'){
  const at=Number(time);if(!Number.isFinite(at)||at<=target.start||at>=target.end)throw Error('Enter a time inside this shift.');event.payment='WORKED_ONLY';event.paidHours=0;
  const workStart=type==='Came late'?at:target.start,workEnd=type==='Left early'?at:target.end;
  next.overrides[id]={...next.overrides[id],start:workStart,end:workEnd,note:[next.overrides[id]?.note,target.guard+' '+(type==='Left early'?'left early':'came late')+' at '+fmt(at)].filter(Boolean).join(' · ')};
  const gapStart=type==='Left early'?at:target.start,gapEnd=type==='Came late'?at:target.end;
  const result=addRow(next,{post:target.post,start:gapStart,end:gapEnd,day:target.day,guard:cover,billable:target.billable,status:cover?'staff':'open',platoon:target.p});result.state.events=[...(state.events||[]),event];return result.state;
 }
 if(!['Vacation','Sick','Personal','Call-out','Unpaid leave'].includes(type))throw Error('Choose the leave type.');
 next.overrides[id]={blank:true};
 const result=addRow(next,{post:target.post,start:target.start,end:target.end,day:target.day,guard:cover,billable:target.billable,status:cover?'staff':'open',platoon:target.p});result.state.events=[...(state.events||[]),event];return result.state;
}
