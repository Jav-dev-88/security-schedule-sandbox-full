import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {schedulePdf} from '../src/pdf.js';import {scheduleExcelParts} from '../public/schedule-excel.js';
const state={rows:[{id:'dock',post:'Dock',p:2,start:420,end:900,guards:['','','','','','',''],open:[true,false,false,false,false,false,false],billable:false}],plans:{},overrides:{},events:[]};
test('Open shifts say Open needs coverage in PDF and Excel, while unused cells remain blank shifts',()=>{
 const pdf=new TextDecoder().decode(schedulePdf(state,'2026-10-25'));assert(pdf.includes('(Open)'));assert(pdf.includes('(needs coverage)'));assert(pdf.includes('(Blank shift)'));
 const xml=scheduleExcelParts({activeWeek:'2026-10-25',master:state,holidays:[],payrollTransfers:[]},state).files['xl/worksheets/sheet1.xml'];assert(xml.includes('Open — needs coverage'));assert(xml.includes('Blank shift'));assert.equal(state.rows[0].open[0],true);
 const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');assert(app.includes("esc(x.guard?guardLabel(x.guard):'Open — needs coverage')"));
});
