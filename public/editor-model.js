import {BASE,segments,validate,key} from './model.js';
export const initialRows=structuredClone(BASE);
export const segmentKey=r=>r.editKey||[r.source,r.day,r.role,r.start,r.end].join('|');
export function applyRows(state){BASE.splice(0,BASE.length,...structuredClone(state.rows));}
export function ledger(state){applyRows(state);return segments(state.plans).map(r=>({...r,editKey:segmentKey(r),...state.overrides[segmentKey(r)]})).filter(r=>!r.blank);}
export function initialState(){return {version:2,rows:structuredClone(initialRows),plans:{},overrides:{}};}
export function assign(state,target,{guard,billable,status='staff'}){
 const next=structuredClone(state),list=ledger(next),id=segmentKey(target),prior=list.find(r=>segmentKey(r)===id)||target;
 if(guard&&status==='staff'){
  const a=target.day*1440+target.start,b=target.day*1440+target.end;
  const overlaps=list.filter(r=>r.guard===guard&&segmentKey(r)!==id&&Math.max(a,r.day*1440+r.start)<Math.min(b,r.day*1440+r.end));
  if(overlaps.length){
   const existing=overlaps[0],owner=next.rows.find(r=>r.id===existing.source);
   if(overlaps.length!==1||existing.day!==target.day||existing.start>target.start||existing.end<target.end||next.plans[key(existing.source,existing.day)]||owner.guards[existing.day]!==guard)throw Error(guard+' already works then. Use “Part at another post” on their original cell.');
   applyRows(next);next.plans[key(owner.id,target.day)]=validate({source:owner.id,day:target.day,post:target.post,from:target.start,to:target.end,billable,returns:true,needsCover:true,replacement:''},next.plans);
   const row=next.rows.find(r=>r.id===target.source);
   if(prior.role==='regular'&&target.start===row.start&&target.end===row.end){row.guards[target.day]='';(row.open??=Array(7).fill(false))[target.day]=false;}
   else next.overrides[id]={blank:true};
   return {state:next,message:guard+' moved for this part of the shift and returns afterward. Hours count once.'};
  }
 }
 const row=next.rows.find(r=>r.id===target.source);
 if(!row)throw Error('This test row is no longer available.');
 const baseline=(prior.role==='regular'||(prior.role==='open'&&!next.plans[key(row.id,target.day)]))&&target.start===row.start&&target.end===row.end;
 if(baseline){row.guards[target.day]=status==='staff'?guard:'';(row.open??=Array(7).fill(false))[target.day]=status==='open';(row.billing??=Array(7).fill(row.billable))[target.day]=billable;
  if(status!=='staff')delete next.plans[key(row.id,target.day)];
 }else next.overrides[id]={...next.overrides[id],guard:status==='staff'?guard:'',billable,blank:status==='blank',role:status==='open'?'open':prior.role==='open'?'coverage':prior.role,note:status==='open'?'Needs coverage':status==='staff'?'Schedule assignment updated':'Blank shift'};
 return {state:next,message:'Cell updated in the test demo.'};
}
export function addRow(state,{post,start,end,day,guard,billable,status,platoon,quick=false}){
 if(!post.trim()&&!quick)throw Error('Enter the post.');if(end<=start||end-start>1440)throw Error('Enter different start and end times (maximum 24 hours).');
 if(!Number.isInteger(day)||day<0||day>6)throw Error('Choose a day.');
 const next=structuredClone(state),id='custom-'+crypto.randomUUID(),row={id,post:post.trim(),start,end,p:[1,2,3].includes(+platoon)?+platoon:start>=1380||start<420?1:start>=900?3:2,guards:Array(7).fill(''),open:Array(7).fill(false),billable,sortDay:day,custom:true,quick:!!quick};next.rows.push(row);
 return assign(next,{source:id,post:row.post,start,end,day,role:'regular',guard:''},{guard,billable,status});
}
export function splitCell(state,target,{post,from,to,billable,needsCover}){
 const next=structuredClone(state),row=next.rows.find(r=>r.id===target.source);
 if(!target.guard||target.role!=='regular'||target.start!==row.start||target.end!==row.end)throw Error('Choose the guard’s original unsplit shift to split it.');
 applyRows(next);const p=validate({source:row.id,day:target.day,post:post.trim(),from,to,billable,needsCover,returns:true,replacement:''},next.plans);next.plans[key(row.id,target.day)]=p;
 return {state:next,message:'Shift split. The guard returns at the end of this period.'};
}

// Worksheet rows remain intact across the seven day columns.
export function orderedGroups(state,list=ledger(state)){
 const map=new Map(),order=new Map(state.rows.map((r,i)=>[r.id,i]));
 const add=r=>{const source=state.rows.find(s=>s.id===(r.id||r.source));const derived=!!r.source&&(!source||r.post!==source.post||r.start!==source.start||r.end!==source.end);const additional=!!(source?.custom||derived);const k=[r.p,r.post,r.start,r.end,additional,source?.custom?source.id:''].join('|');if(!map.has(k))map.set(k,{...r,additional,derived,quick:!!source?.quick,order:order.get(r.id||r.source)??10000,cells:Array.from({length:7},()=>[])});return map.get(k);};
 state.rows.forEach(add);list.forEach(r=>add(r).cells[r.day].push(r));
 return [...map.values()].sort((a,b)=>a.p-b.p||Number(a.quick)-Number(b.quick)||(a.quick?(a.order-b.order||Number(a.derived)-Number(b.derived)):(Number(a.derived)-Number(b.derived)||a.order-b.order))||a.start-b.start||a.end-b.end);
}
export function removeRow(state,id){
 const row=state.rows.find(r=>r.id===id);if(!row)throw Error('Select an original worksheet row to delete.');
 const linked=Object.values(state.plans).some(p=>p.source!==id&&p.post===row.post&&p.from===row.start&&p.to===row.end);
 if(linked)throw Error('This row receives a split shift. Remove that split from its original row before deleting this row.');
 const next=structuredClone(state),plans={},overrides={};
 for(const [k,v] of Object.entries(next.plans))if(k.startsWith(id+'|')){plans[k]=v;delete next.plans[k];}
 for(const [k,v] of Object.entries(next.overrides))if(k.startsWith(id+'|')){overrides[k]=v;delete next.overrides[k];}
 next.rows=next.rows.filter(r=>r.id!==id);
 return {state:next,row:structuredClone(row),plans,overrides};
}
export function restoreRow(state,archive){
 if(state.rows.some(r=>r.id===archive.row.id))throw Error('This row is already present.');
 const next=structuredClone(state);next.rows.push(structuredClone(archive.row));Object.assign(next.plans,structuredClone(archive.plans));Object.assign(next.overrides,structuredClone(archive.overrides));return next;
}
export function quickAddRow(state,platoon){
 const p=Number(platoon);if(![1,2,3].includes(p))throw Error('Choose a platoon.');
 const [start,end]=p===1?[1380,1860]:p===2?[420,900]:[900,1380];
 const next=structuredClone(state);next.rows.push({id:'custom-'+crypto.randomUUID(),post:'',p,start,end,guards:Array(7).fill(''),open:Array(7).fill(false),billable:false,custom:true,quick:true});
 return {state:next,message:'Blank row added to '+['First','Second','Third'][p-1]+' Platoon. Fill the guard cells; post and times are optional.'};
}

export function editRowFields(state,id,patch){
 const original=state.rows.find(r=>r.id===id);if(!original)throw Error('This row is no longer available.');
 const next=structuredClone(state),row=next.rows.find(r=>r.id===id);
 const post=String(patch.post??row.post).trim(),p=Number(patch.p??row.p),start=patch.start??row.start,rawEnd=patch.end??row.end;
 if(post.length>100||(!post&&!row.quick))throw Error('Enter a post with up to 100 characters.');
 if(![1,2,3].includes(p)||!Number.isInteger(start)||start<0||start>=1440||!Number.isInteger(rawEnd)||rawEnd<0||rawEnd>=2880)throw Error('Enter valid military times.');
 const endClock=rawEnd%1440;if(endClock===start)throw Error('Start and end cannot be the same time.');const end=endClock<=start?endClock+1440:endClock;
 const changed=start!==row.start||end!==row.end||post!==row.post||p!==row.p;
 if(changed){const linked=Object.entries(next.plans).some(([key,plan])=>key.startsWith(id+'|')||(plan.post===row.post&&plan.from===row.start&&plan.to===row.end))||Object.keys(next.overrides).some(key=>key.startsWith(id+'|'))||(next.events||[]).some(e=>e.post===row.post&&e.start===row.start&&e.end===row.end&&row.guards.includes(e.guard));if(linked)throw Error('This row has split or attendance records. Review those assignments before changing its post or times; no records were removed.');}
 Object.assign(row,{post,p,start,end});if('billable'in patch){row.billable=!!patch.billable;delete row.billing;}
 if(start!==original.start||end!==original.end){const list=ledger(next).filter(r=>r.guard);for(const a of list.filter(r=>r.source===id))for(const b of list){if(b.source===id||a.guard!==b.guard)continue;const lo=Math.max(a.day*1440+a.start,b.day*1440+b.start),hi=Math.min(a.day*1440+a.end,b.day*1440+b.end);if(lo<hi)throw Error(a.guard+' already has another shift during these times. The time change was not applied.');}}
 return {state:next,message:'Row updated. Hours recalculated automatically.'};
}
export function nextTemporaryGuardName(names){let highest=0;for(const name of names){const match=/^Temp Guard (\d+)$/i.exec(name);if(match&&Number.isSafeInteger(Number(match[1])))highest=Math.max(highest,Number(match[1]));}if(highest>=Number.MAX_SAFE_INTEGER)throw Error('Choose a temporary guard name manually.');return 'Temp Guard '+(highest+1);}
export function scheduleWarnings(state){const list=ledger(state),warnings=[];for(const r of list){if(!r.guard)warnings.push({type:'coverage',day:r.day,source:r.source,message:'Coverage needed: '+(r.post||'post not set')});else if(!r.post)warnings.push({type:'post',day:r.day,source:r.source,message:r.guard+' has an assigned shift with no post.'});}const guards=new Map();for(const r of list.filter(r=>r.guard)){if(!guards.has(r.guard))guards.set(r.guard,[]);guards.get(r.guard).push(r);}for(const [guard,rows]of guards){rows.sort((a,b)=>a.day*1440+a.start-b.day*1440-b.start);for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){const a=rows[i],b=rows[j];if(b.day*1440+b.start>=a.day*1440+a.end)break;if(Math.max(a.day*1440+a.start,b.day*1440+b.start)<Math.min(a.day*1440+a.end,b.day*1440+b.end))warnings.push({type:'overlap',day:b.day,source:b.source,message:guard+' has overlapping shifts: '+(a.post||'post not set')+' and '+(b.post||'post not set')+'.'});}}
 return warnings;
}
