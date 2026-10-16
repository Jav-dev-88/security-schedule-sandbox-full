import {assignmentClassifier} from './assignment-status.js';
import {ledger,linkedParts,linkedRows} from './editor-model.js';
export function noteEligibleShifts(master,state){
 const normal=ledger(master),classify=assignmentClassifier(master,state);
 return ledger(state).map(classify).filter(r=>r.guard&&!r.paidHoliday&&(r.isCoverage||r.moveNote||!normal.some(n=>n.guard===r.guard&&n.day===r.day&&n.post===r.post&&n.start===r.start&&n.end===r.end)));
}
export const noteShiftKey=r=>JSON.stringify([r.source,r.guard,r.day,r.start,r.end]);
export function noteShiftOptions(state,master=null){
 const seen=new Set(),options=[],eligible=master?noteEligibleShifts(master,state):ledger(state).filter(r=>r.guard&&!r.paidHoliday),keys=new Set(eligible.map(noteShiftKey));
 for(const r of eligible){
  const linked=linkedParts(state,r).filter(p=>keys.has(noteShiftKey(p))),parts=linked.length?linked:[r],sorted=parts.slice().sort((a,b)=>a.start-b.start),key=JSON.stringify(sorted.map(x=>[x.source,x.day,x.start,x.end,x.guard]));
  if(seen.has(key))continue;seen.add(key);options.push({key,guard:r.guard,day:r.day,post:[...new Set(sorted.map(x=>x.post))].join(' + '),start:Math.min(...parts.map(x=>x.start)),end:Math.max(...parts.map(x=>x.end)),parts:sorted.map(x=>({source:x.source,start:x.start,end:x.end}))});
 }
 return options.sort((a,b)=>a.day-b.day||a.start-b.start||a.guard.localeCompare(b.guard));
}
export function validateShiftNotes(notes){
 if(!Array.isArray(notes)||notes.length>2000)throw Error('Invalid shift notes.');const ids=new Set();
 for(const n of notes){if(!n||typeof n.id!=='string'||!n.id||n.id.length>100||ids.has(n.id)||typeof n.guard!=='string'||!n.guard.trim()||n.guard.length>80||!Number.isInteger(n.day)||n.day<0||n.day>6||typeof n.post!=='string'||n.post.length>500||!Number.isInteger(n.start)||n.start<0||n.start>=1440||!Number.isInteger(n.end)||n.end<=n.start||n.end-n.start>1440||!['Extra hours','Covering shift','Other'].includes(n.kind)||typeof n.text!=='string'||!n.text.trim()||n.text.length>500||!Array.isArray(n.parts)||n.parts.length<1||n.parts.length>20||n.parts.some(p=>!p||typeof p.source!=='string'||p.source.length>100||!Number.isInteger(p.start)||!Number.isInteger(p.end)||p.end<=p.start))throw Error('Choose a shift and enter a note of up to 500 characters.');ids.add(n.id);}
 return notes;
}
export function saveShiftNote(state,shift,fields,id=null){
 const next=structuredClone(state);next.shiftNotes??=[];const previous=id?next.shiftNotes.find(n=>n.id===id):null;if(id&&!previous&&!shift?.automatic)throw Error('This note was removed. Refresh and try again.');if(!previous&&!shift)throw Error('Choose a scheduled shift.');
 const note={...(previous||shift),id:id||crypto.randomUUID(),kind:fields.kind,text:String(fields.text||'').trim(),updatedAt:new Date().toISOString()};for(const key of ['key','automatic','comment','commentIds'])delete note[key];
 if(previous)next.shiftNotes=next.shiftNotes.map(n=>n.id===id?note:n);else next.shiftNotes.push(note);validateShiftNotes(next.shiftNotes);return next;
}

// Coverage comes from saved assignments, attendance and Master; derive it on every
// read so corrections update immediately and refreshes never create duplicates.
export function automaticCoverageNotes(master,state){
 const classify=assignmentClassifier(master,state),shifts=ledger(state).map(classify),groups=new Map(),links=new Map(),result=[];
 for(const r of shifts.filter(r=>r.guard&&r.isCoverage&&!r.paidHoliday)){
  if(!links.has(r.source))links.set(r.source,linkedRows(state,r));const rows=links.get(r.source);
  const key=JSON.stringify([r.guard,r.day,rows.length===2?rows.map(row=>row.id).sort():[r.source,r.start,r.end,r.post]]);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
 }
 for(const group of groups.values()){
  const runs=[];for(const r of group.sort((a,b)=>a.start-b.start||a.source.localeCompare(b.source))){const last=runs.at(-1);if(last&&r.start<=Math.max(...last.map(x=>x.end)))last.push(r);else runs.push([r]);}
  for(const covering of runs){
   const first=covering[0],parts=covering.map(r=>({source:r.source,start:r.start,end:r.end})),start=Math.min(...covering.map(r=>r.start)),end=Math.max(...covering.map(r=>r.end));
   const key=JSON.stringify([first.guard,first.day,parts]);let hash=14695981039346656037n;for(const c of key){hash^=BigInt(c.codePointAt(0));hash=BigInt.asUintN(64,hash*1099511628211n);}
   result.push({guard:first.guard,day:first.day,parts,start,end,post:[...new Set(covering.map(r=>r.post))].join(' + '),id:'auto-cover-'+hash.toString(16),kind:'Covering shift',text:first.guard+' · '+[...new Set(covering.map(r=>r.note))].join(' · '),automatic:true});
  }
 }
 return result;
}
function sameShift(a,b){return a.guard===b.guard&&a.day===b.day&&a.start===b.start&&a.end===b.end&&JSON.stringify(a.parts)===JSON.stringify(b.parts);}
export function weeklyShiftNotes(master,state){
 const eligible=new Set(noteEligibleShifts(master,state).map(noteShiftKey)),manual=(state.shiftNotes||[]).filter(n=>n.parts.some(p=>eligible.has(noteShiftKey({...p,guard:n.guard,day:n.day})))),used=new Set(),auto=automaticCoverageNotes(master,state).map(note=>{const comments=manual.filter(n=>n.id===note.id||n.kind==='Covering shift'&&sameShift(n,note));comments.forEach(n=>used.add(n.id));return {...note,comment:comments.map(n=>n.text).join('\n'),commentIds:comments.map(n=>n.id)};});
 return [...auto,...manual.filter(n=>!used.has(n.id))];
}
