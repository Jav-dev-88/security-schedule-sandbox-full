import {ledger} from './editor-model.js';
const sameName=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
export function assignmentClassifier(master,state){
 const normal=master?ledger(master):[];
 return shift=>{
  if(!shift.guard)return {...shift,isCoverage:false};
  const event=(state.events||[]).find(e=>e.day===shift.day&&e.post===shift.post&&!sameName(e.guard,shift.guard)&&Math.max(e.coverageStart??e.start,shift.start)<Math.min(e.coverageEnd??e.end,shift.end)&&(e.coverageSource?e.coverageSource===shift.source:sameName(e.cover,shift.guard)));
  const matches=normal.filter(r=>r.day===shift.day&&r.post===shift.post&&Math.max(r.start,shift.start)<Math.min(r.end,shift.end));
  const own=matches.filter(r=>sameName(r.guard,shift.guard)).sort((a,b)=>a.start-b.start);
  let coveredTo=shift.start;for(const r of own)if(r.start<=coveredTo)coveredTo=Math.max(coveredTo,r.end);
  const isCoverage=!!event||!!master&&coveredTo<shift.end;
  if(!isCoverage)return {...shift,isCoverage:false};
  const replaced=event?.guard||[...new Set(matches.filter(r=>r.guard&&!sameName(r.guard,shift.guard)).map(r=>r.guard))].join(', ');
  const note=replaced?'Covering '+replaced+(event?' — '+event.type:' — differs from Master'):'Covering shift — not assigned here in Master';
  return {...shift,isCoverage:true,note};
 };
}
