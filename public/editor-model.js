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
export function addRow(state,{post,start,end,day,guard,billable,status,platoon}){
 if(!post.trim())throw Error('Enter the post.');if(end<=start||end-start>1440)throw Error('Enter different start and end times (maximum 24 hours).');
 if(!Number.isInteger(day)||day<0||day>6)throw Error('Choose a day.');
 const next=structuredClone(state),id='custom-'+crypto.randomUUID(),row={id,post:post.trim(),start,end,p:[1,2,3].includes(+platoon)?+platoon:start>=1380||start<420?1:start>=900?3:2,guards:Array(7).fill(''),open:Array(7).fill(false),billable,sortDay:day,custom:true};next.rows.push(row);
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
 const add=r=>{const source=state.rows.find(s=>s.id===(r.id||r.source));const derived=!!r.source&&(!source||r.post!==source.post||r.start!==source.start||r.end!==source.end);const additional=!!(source?.custom||derived);const k=[r.p,r.post,r.start,r.end,additional,source?.custom?source.id:''].join('|');if(!map.has(k))map.set(k,{...r,additional,derived,order:order.get(r.id||r.source)??10000,cells:Array.from({length:7},()=>[])});return map.get(k);};
 state.rows.forEach(add);list.forEach(r=>add(r).cells[r.day].push(r));
 return [...map.values()].sort((a,b)=>a.p-b.p||Number(a.derived)-Number(b.derived)||a.order-b.order||a.start-b.start||a.end-b.end);
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
