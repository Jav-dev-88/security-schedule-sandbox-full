// Calendar markers are separate from individual attendance and payroll credits.
export function holidayOnDate(holidays,date){return (holidays||[]).filter(h=>h.date===date).map(h=>h.name).join(' / ');}
export function validateHolidays(holidays){
 if(!Array.isArray(holidays)||holidays.length>500)throw Error('Invalid paid holiday list.');
 for(const h of holidays){const date=h?.date;if(typeof h?.name!=='string'||!h.name.trim()||h.name.length>80||typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Enter a holiday name and valid date.');}
 return holidays;
}
export function saveHoliday(workspace,{name,date},index=null){
 const next=structuredClone(workspace),holiday={name:String(name||'').trim(),date};next.holidays??=[];validateHolidays([holiday]);
 if(index!==null&&(!Number.isInteger(index)||!next.holidays[index]))throw Error('This holiday no longer exists. Reopen the holiday list.');
 if(next.holidays.some((h,i)=>i!==index&&h.date===date))throw Error('A paid holiday is already saved for this date. Edit that entry instead.');
 if(index===null)next.holidays.push(holiday);else next.holidays[index]=holiday;validateHolidays(next.holidays);return next;
}
