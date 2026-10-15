// Calendar markers are separate from individual attendance and payroll credits.
export function holidayOnDate(holidays,date){return (holidays||[]).filter(h=>h.date===date).map(h=>h.name).join(' / ');}
export function validateHolidays(holidays){
 if(!Array.isArray(holidays)||holidays.length>500)throw Error('Invalid paid holiday list.');
 for(const h of holidays){const date=h?.date;if(typeof h?.name!=='string'||!h.name.trim()||h.name.length>80||typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Enter a holiday name and valid date.');if(h.federalKey!==undefined&&(!federalNames.some(([key])=>key===h.federalKey)||!Number.isInteger(h.federalYear)||h.federalYear<2000||h.federalYear>2099))throw Error('Invalid federal holiday selection.');}
 return holidays;
}
export function saveHoliday(workspace,{name,date},index=null){
 const next=structuredClone(workspace),holiday={...(index===null?{}:workspace.holidays?.[index]),name:String(name||'').trim(),date};next.holidays??=[];validateHolidays([holiday]);
 if(index!==null&&(!Number.isInteger(index)||!next.holidays[index]))throw Error('This holiday no longer exists. Reopen the holiday list.');
 if(next.holidays.some((h,i)=>i!==index&&h.date===date))throw Error('A paid holiday is already saved for this date. Edit that entry instead.');
 if(index===null)next.holidays.push(holiday);else next.holidays[index]=holiday;validateHolidays(next.holidays);return next;
}

const federalNames=[['new-year',"New Year's Day"],['mlk','Birthday of Martin Luther King, Jr.'],['washington',"Washington's Birthday (Presidents' Day)"],['memorial','Memorial Day'],['juneteenth','Juneteenth National Independence Day'],['independence','Independence Day'],['labor','Labor Day'],['columbus','Columbus Day'],['veterans','Veterans Day'],['thanksgiving','Thanksgiving Day'],['christmas','Christmas Day']];
// OPM standard federal calendar: https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/
export function federalHolidays(year){
 year=Number(year);if(!Number.isInteger(year)||year<2000||year>2099)throw Error('Choose a holiday year from 2000 through 2099.');
 const date=(month,day)=>new Date(Date.UTC(year,month-1,day,12)),iso=d=>d.toISOString().slice(0,10);
 const nth=(month,weekday,n)=>{const d=date(month,1);d.setUTCDate(1+(weekday-d.getUTCDay()+7)%7+(n-1)*7);return d;};
 const lastMonday=()=>{const d=date(6,0);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d;};
 const dates=[date(1,1),nth(1,1,3),nth(2,1,3),lastMonday(),date(6,19),date(7,4),nth(9,1,1),nth(10,1,2),date(11,11),nth(11,4,4),date(12,25)];
 return federalNames.map(([key,name],i)=>{const actualDate=iso(dates[i]),observed=new Date(dates[i]),day=observed.getUTCDay();if(day===6)observed.setUTCDate(observed.getUTCDate()-1);if(day===0)observed.setUTCDate(observed.getUTCDate()+1);return {key,name,year,actualDate,date:iso(observed)};});
}
const federalAliases={
 'new-year':['newyear'],mlk:['martinlutherking','mlk'],washington:['washington','presidents'],memorial:['memorial'],juneteenth:['juneteenth'],independence:['independence','fourthofjuly','julyfourth'],labor:['labor'],columbus:['columbus','indigenouspeoples'],veterans:['veterans'],thanksgiving:['thanksgiving'],christmas:['christmas']
};
function savedFederal(holidays,entry){return (holidays||[]).find(h=>h.federalKey===entry.key&&h.federalYear===entry.year)||
 (holidays||[]).find(h=>!h.federalKey&&(h.date===entry.date||h.date===entry.actualDate)&&federalAliases[entry.key].some(alias=>h.name.toLowerCase().replace(/[^a-z]/g,'').includes(alias)));}
export function federalHolidayChoices(workspace,year){return federalHolidays(year).map(entry=>{const saved=savedFederal(workspace.holidays,entry);return {...entry,enabled:!!saved,date:saved?.date||entry.date};});}
export function setFederalHolidayChoices(workspace,year,choices){
 const entries=federalHolidays(year),next=structuredClone(workspace),known=new Set(entries.map(e=>e.key));next.holidays??=[];
 if(!Array.isArray(choices)||choices.length!==entries.length||new Set(choices.map(c=>c.key)).size!==entries.length||choices.some(c=>!known.has(c.key)||typeof c.enabled!=='boolean'))throw Error('Reload the federal holiday checklist before saving.');
 const previous=next.holidays;const matched=new Set(entries.map(e=>savedFederal(previous,e)).filter(Boolean));next.holidays=previous.filter(h=>!matched.has(h));
 for(const entry of entries){const choice=choices.find(c=>c.key===entry.key);if(!choice.enabled)continue;
  const old=savedFederal(previous,entry),holiday={...old,name:old?.name||entry.name,date:choice.date,federalKey:entry.key,federalYear:entry.year};validateHolidays([holiday]);
  if(next.holidays.some(h=>h.date===holiday.date))throw Error('Another saved holiday already uses '+holiday.date+'. Edit its date or the checklist date first.');next.holidays.push(holiday);
 }
 validateHolidays(next.holidays);return next;
}
