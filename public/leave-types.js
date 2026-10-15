export const BUILTIN_ATTENDANCE_TYPES=['Vacation','Sick','Personal','Call-out','Unpaid leave','Left early','Came late','Paid holiday — off','Return to work (remove holiday off)'];
const normal=name=>name.trim().toLowerCase();
export function customLeaveTypes(workspace){return workspace.leaveTypes??[{name:'LOA',payment:'UNPAID'}];}
export function validateLeaveTypes(types){
 if(!Array.isArray(types)||types.length>80)throw Error('Use no more than 80 custom leave types.');const names=new Set(BUILTIN_ATTENDANCE_TYPES.map(normal));
 for(const type of types){if(typeof type?.name!=='string'||!type.name.trim()||type.name.length>80||!['PENDING','PAID','UNPAID'].includes(type.payment))throw Error('Enter a valid leave type name.');const name=normal(type.name);if(names.has(name))throw Error('That leave type already exists.');names.add(name);}return types;
}
export function saveLeaveType(workspace,{name,payment}){
 const next=structuredClone(workspace);next.leaveTypes=structuredClone(customLeaveTypes(workspace));const type={name:String(name||'').trim(),payment};
 const existing=next.leaveTypes.find(t=>normal(t.name)===normal(type.name));if(existing){if(payment!==undefined)existing.payment=payment;}else next.leaveTypes.push({...type,payment:payment??'UNPAID'});validateLeaveTypes(next.leaveTypes);return next;
}
export function removeLeaveType(workspace,name){const next=structuredClone(workspace);next.leaveTypes=customLeaveTypes(workspace).filter(t=>normal(t.name)!==normal(name));return next;}
export function attendanceTypes(workspace){return [...BUILTIN_ATTENDANCE_TYPES,...customLeaveTypes(workspace).map(t=>t.name)];}
export function defaultLeavePayment(workspace,type){return customLeaveTypes(workspace).find(t=>t.name===type)?.payment||(type==='Paid holiday — off'?'PAID':['Call-out','Unpaid leave'].includes(type)?'UNPAID':'PENDING');}

export function leaveTypeLabel(type){return type==='Unpaid leave'?'Leave':type==='Paid holiday — off'?'Holiday — off':type;}
