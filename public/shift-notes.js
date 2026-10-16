import {ledger,linkedParts} from './editor-model.js';
export function noteShiftOptions(state){
 const seen=new Set(),options=[];
 for(const r of ledger(state).filter(r=>r.guard&&!r.paidHoliday)){
  const linked=linkedParts(state,r),parts=linked.length?linked:[r],sorted=parts.slice().sort((a,b)=>a.start-b.start),key=JSON.stringify(sorted.map(x=>[x.source,x.day,x.start,x.end,x.guard]));
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
 const next=structuredClone(state);next.shiftNotes??=[];const previous=id?next.shiftNotes.find(n=>n.id===id):null;if(id&&!previous)throw Error('This note was removed. Refresh and try again.');if(!previous&&!shift)throw Error('Choose a scheduled shift.');
 const note={...(previous||shift),id:id||crypto.randomUUID(),kind:fields.kind,text:String(fields.text||'').trim(),updatedAt:new Date().toISOString()};delete note.key;
 if(previous)next.shiftNotes=next.shiftNotes.map(n=>n.id===id?note:n);else next.shiftNotes.push(note);validateShiftNotes(next.shiftNotes);return next;
}
