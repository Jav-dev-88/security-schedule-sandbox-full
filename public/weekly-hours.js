// Aggregate payroll rows, which already reconcile overlaps and week transfers.
export function guardHoursTotals(rows,names=[]){
 const groups=new Map([...new Set(names)].filter(Boolean).map(guard=>[guard,{guard,worked:0,overtime:0,paidLeave:0,adjustmentHours:0,payable:0}]));
 for(const r of rows){if(!groups.has(r.guard))groups.set(r.guard,{guard:r.guard,worked:0,overtime:0,paidLeave:0,adjustmentHours:0,payable:0});const g=groups.get(r.guard);for(const key of ['worked','overtime','paidLeave','adjustmentHours','payable'])g[key]+=Number(r[key]||0);}
 return [...groups.values()].sort((a,b)=>a.guard.localeCompare(b.guard,'en',{sensitivity:'base',numeric:true}));
}
