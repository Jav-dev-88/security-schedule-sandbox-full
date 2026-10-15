import test from 'node:test';
import assert from 'node:assert/strict';
import {saveHoliday,validateHolidays,holidayOnDate} from '../public/holidays.js';
import {newWorkspace,validateWorkspace,guardView} from '../src/domain.js';
import {datesForWeek,generateWeek} from '../public/workspace-model.js';
import {fullScheduleHtml} from '../public/guard-portal.js';
import {schedulePdf} from '../src/pdf.js';
import {payrollSummary} from '../public/payroll.js';
function fixture(){const w=newWorkspace();w.master.rows=[{id:'a',post:'Lobby',p:2,start:420,end:900,guards:['Guard A','','','','','',''],billable:false}];return generateWeek(w,'2026-11-29');}
test('Paid holiday calendar can be added, edited and validated without changing assignments or payroll',()=>{
 const w=fixture(),state=structuredClone(w.weeks[w.activeWeek]),pay=payrollSummary(state),next=saveHoliday(w,{name:' Thanksgiving ',date:'2026-11-26'});
 assert.equal(w.holidays.length,0);assert.equal(next.holidays[0].name,'Thanksgiving');assert.doesNotThrow(()=>validateWorkspace(next));assert.deepEqual(next.weeks[w.activeWeek],state);assert.deepEqual(payrollSummary(next.weeks[w.activeWeek]),pay);
 assert.throws(()=>saveHoliday(next,{name:'Duplicate',date:'2026-11-26'}),/already saved/);
 const edited=saveHoliday(next,{name:'Observed holiday',date:'2026-11-27'},0);assert.equal(holidayOnDate(edited.holidays,'2026-11-26'),'');assert.equal(holidayOnDate(edited.holidays,'2026-11-27'),'Observed holiday');
 assert.throws(()=>saveHoliday(w,{name:'Invalid',date:'2026-02-30'}),/valid date/);assert.throws(()=>validateHolidays([{name:' ',date:'2026-11-26'}]),/holiday name/);assert.throws(()=>validateWorkspace({...w,holidays:[{name:'Missing date'}]}),/valid date/);
});
test('Holiday labels follow their date into future generated weeks and guard view without exposing other attendance',()=>{
 let w=saveHoliday(fixture(),{name:'Thanksgiving <paid>',date:'2026-11-26'});w=generateWeek(w,'2026-12-06');
 const view=guardView(w,'Guard A'),week=view.weeks.find(s=>s.end==='2026-11-29'),other=view.weeks.find(s=>s.end==='2026-12-06');
 assert.equal(week.holidays.length,1);assert.equal(other.holidays.length,0);assert.equal(week.hours.worked,8);
 const html=fullScheduleHtml(week,'Guard A');assert(html.includes('Thanksgiving &lt;paid&gt; · Paid holiday'));assert.equal((html.match(/federal-holiday-column/g)||[]).length,2);assert(!fullScheduleHtml(other,'Guard A').includes('federal-holiday-column'));
});
test('PDF highlights only the observed date and includes the paid holiday name',()=>{
 const w=saveHoliday(fixture(),{name:'Thanksgiving',date:'2026-11-26'}),state=w.weeks[w.activeWeek];
 const pdf=new TextDecoder().decode(schedulePdf(state,w.activeWeek,w.master,[],w.holidays));assert(pdf.startsWith('%PDF-1.4'));assert(pdf.includes('11-26-2026 - Thanksgiving'));assert(pdf.includes('(PAID HOLIDAY)'));assert(pdf.includes('1 0.945 0.80 rg'));
 const plain=new TextDecoder().decode(schedulePdf(state,w.activeWeek,w.master,[],[{name:'Other week',date:'2026-12-25'}]));assert(!plain.includes('(PAID HOLIDAY)'));assert(!plain.includes('Other week'));
});

test('Federal checklist matches all eleven OPM observed dates for 2026 and 2027',async()=>{
 const {federalHolidays}=await import('../public/holidays.js');
 assert.deepEqual(federalHolidays(2026).map(h=>h.date),['2026-01-01','2026-01-19','2026-02-16','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-10-12','2026-11-11','2026-11-26','2026-12-25']);
 assert.deepEqual(federalHolidays(2027).map(h=>h.date),['2027-01-01','2027-01-18','2027-02-15','2027-05-31','2027-06-18','2027-07-05','2027-09-06','2027-10-11','2027-11-11','2027-11-25','2027-12-24']);
 assert.equal(federalHolidays(2028)[0].date,'2027-12-31');assert.equal(federalHolidays(2026).find(h=>h.key==='independence').actualDate,'2026-07-04');assert.throws(()=>federalHolidays(9999),/holiday year/);
});
test('Checking holidays saves only selected dates, keeps custom holidays and pay, and supports another year',async()=>{
 const {federalHolidayChoices,setFederalHolidayChoices}=await import('../public/holidays.js');let w=saveHoliday(fixture(),{name:'Site anniversary',date:'2026-08-20'});const before=structuredClone(w.weeks),master=structuredClone(w.master);
 const choices=federalHolidayChoices(w,2026);assert(choices.every(h=>!h.enabled));choices.find(h=>h.key==='thanksgiving').enabled=true;const july=choices.find(h=>h.key==='independence');july.enabled=true;july.date=july.actualDate;
 w=setFederalHolidayChoices(w,2026,choices);assert.equal(w.holidays.length,3);assert(w.holidays.some(h=>h.date==='2026-07-04'));assert.deepEqual(w.weeks,before);assert.deepEqual(w.master,master);
 const next=federalHolidayChoices(w,2027);next.find(h=>h.key==='christmas').enabled=true;w=setFederalHolidayChoices(w,2027,next);assert.equal(w.holidays.length,4);
 const reload=federalHolidayChoices(w,2026);assert.equal(reload.filter(h=>h.enabled).length,2);assert.equal(reload.find(h=>h.key==='independence').date,'2026-07-04');
 const no2026=reload.map(h=>({...h,enabled:false}));w=setFederalHolidayChoices(w,2026,no2026);assert.deepEqual(w.holidays.map(h=>h.name),['Site anniversary','Christmas Day']);assert.doesNotThrow(()=>validateWorkspace(w));
});
test('Checklist adopts existing named holidays and preserves later manual edits without duplicates',async()=>{
 const {federalHolidayChoices,setFederalHolidayChoices}=await import('../public/holidays.js');let w=saveHoliday(fixture(),{name:'Thanksgiving',date:'2026-11-26'});let choices=federalHolidayChoices(w,2026);assert(choices.find(h=>h.key==='thanksgiving').enabled);w=setFederalHolidayChoices(w,2026,choices);assert.equal(w.holidays.length,1);
 w=saveHoliday(w,{name:'Thanksgiving observed at site',date:'2026-11-27'},0);choices=federalHolidayChoices(w,2026);assert(choices.find(h=>h.key==='thanksgiving').enabled);assert.equal(choices.find(h=>h.key==='thanksgiving').date,'2026-11-27');w=setFederalHolidayChoices(w,2026,choices);assert.equal(w.holidays.length,1);assert.equal(w.holidays[0].date,'2026-11-27');
 assert.throws(()=>setFederalHolidayChoices(w,2026,choices.slice(1)),/Reload/);
 const conflict=saveHoliday(w,{name:'Site closure',date:'2026-12-25'});choices.find(h=>h.key==='christmas').enabled=true;assert.throws(()=>setFederalHolidayChoices(conflict,2026,choices),/already uses/);
});
