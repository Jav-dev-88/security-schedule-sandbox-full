import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleExcelParts,zipExcelParts} from '../public/schedule-excel.js';
const state=()=>({version:2,rows:[{id:'night',post:'Lobby & Dock',p:1,start:1380,end:1860,guards:['Alex','','','','','',''],billable:false},{id:'early',post:'Lobby',p:2,start:510,end:900,guards:['Bea','','','','','',''],billable:false},{id:'late',post:'Lobby',p:3,start:900,end:990,guards:['Bea','','','','','',''],billable:false}],plans:{},overrides:{},events:[]});
const workspace=()=>({activeWeek:'2026-10-18',master:state(),weeks:{},holidays:[{name:'Site holiday',date:'2026-10-12'}],payrollTransfers:[]});
test('weekly Excel preserves all platoons, dates, split and overnight shifts, and literal text',()=>{
 const w=workspace(),s=state(),before=JSON.stringify(s);s.rows[0].guards[1]='=HYPERLINK("test")';const {files,filename}=scheduleExcelParts(w,s),sheet=files['xl/worksheets/sheet1.xml'];
 assert.equal(filename,'Security_Schedule_W-E_10-18-2026.xlsx');
 for(const text of ['FIRST PLATOON','SECOND PLATOON','THIRD PLATOON','Monday\n10-12-2026\nSite holiday','Sunday\n10-18-2026','Lobby &amp; Dock','Blank shift','Bea','=HYPERLINK(&quot;test&quot;)'])assert(sheet.includes(text),text);
 assert(sheet.includes('<v>1.2916666666666667</v>'),'overnight end is next-day 07:00');assert.equal((sheet.match(/<f>/g)||[]).length,3,'one editable duration formula per shift');assert(sheet.includes('orientation="landscape"'));assert(sheet.includes('fitToWidth="1"'));
 s.rows[0].guards[1]='';assert.equal(JSON.stringify(s),before,'export leaves schedule data unchanged');
});
test('Master Excel has its own title, no weekly dates/holidays/transfers, and stable filename',()=>{
 const w=workspace(),{files,filename}=scheduleExcelParts(w,w.master,'master'),sheet=files['xl/worksheets/sheet1.xml'];
 assert.equal(filename,'Security_Master_Template.xlsx');assert(sheet.includes('MASTER TEMPLATE'));assert(files['xl/workbook.xml'].includes('Master Template'));assert(!sheet.includes('10-18-2026'));assert(!sheet.includes('Site holiday'));assert(sheet.includes('Normal weekly staffing pattern'));
});
test('Excel includes coverage, holiday off and payroll week transfer annotations',()=>{
 const w=workspace(),s=state();s.rows[0].guards[0]='Cam';w.payrollTransfers=[{fromWeek:w.activeWeek,toWeek:'2026-10-11',day:0,source:'night',segment:'night|0|regular|1380|1860',guard:'Cam',start:1380,end:1860,hours:8}];s.events=[{type:'Paid holiday — off',source:'early',day:0,guard:'Bea',start:510,end:900,payment:'PAID',paidHours:6.5}];
 const {files}=scheduleExcelParts(w,s),sheet=files['xl/worksheets/sheet1.xml'];assert(sheet.includes('Cam · Covering'));assert(sheet.includes('Paid holiday — off'));assert(sheet.includes('8 hrs in W-E 10-11-2026'));
});
test('Excel ZIP has valid headers, UTF-8 entries and the standard CRC32 check value',()=>{
 const bytes=zipExcelParts({'check.xml':'123456789'}),v=new DataView(bytes.buffer);assert.equal(v.getUint32(0,true),0x04034b50);assert.equal(v.getUint32(14,true),0xcbf43926);assert.equal(v.getUint32(bytes.length-22,true),0x06054b50);assert.equal(v.getUint16(bytes.length-14,true),1);
});
