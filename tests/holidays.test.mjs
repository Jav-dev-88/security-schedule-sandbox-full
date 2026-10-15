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
