import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../public/editor-model.js';
import {schedulePdf} from '../src/pdf.js';

function render(state){
 const bytes=schedulePdf(state,'2026-10-11');
 const source=new TextDecoder().decode(bytes);
 return source;
}

test('Weekly PDF is legal landscape and contains all three platoons on one page',()=>{
 const pdf=render(initialState());
 assert.match(pdf,/\/MediaBox \[0 0 1008 612\]/);
 assert.match(pdf,/\/Count 1\b/);
 for(const p of ['FIRST','SECOND','THIRD'])assert.ok(pdf.includes(p+' PLATOON'));
 for(const d of ['MONDAY','SUNDAY'])assert.ok(pdf.includes(d));
});

test('Even an unusually long week remains one page without dropping coverage rows',()=>{
 const state=initialState();
 for(let i=0;i<42;i++)state.rows.push({
  id:'extra-p3-'+i,post:'Extra Coverage '+i,p:3,start:900,end:1380,
  guards:['Williams','','','','','',''],billable:false,custom:true
 });
 const pdf=render(state);
 assert.match(pdf,/\/Count 1\b/);
 assert.ok(pdf.includes('Extra Coverage 0'));
 assert.ok(pdf.includes('Extra Coverage 41'));
 assert.ok(pdf.includes('SUNDAY'));
});

test('Normal week uses most of the legal page width with larger readable text',()=>{
 const pdf=render(initialState());
 // Outer transform uses legal paper dimensions and the new 952-point table;
 // the prior exporter drew a 747-point table scaled down by tall headers.
 const fit=Number(pdf.match(/q\n([0-9.]+) 0 0 \1 /)?.[1]??NaN);
 assert(Number.isFinite(fit),'PDF must have a uniform scale transform');
 assert(fit>0.9,'Normal week should not shrink to tiny text');
 assert(pdf.includes('10.5 Tf'),'Post labels should use increased base font size');
 assert(pdf.includes('10 Tf'),'Guard labels should use increased base font size');
 assert(pdf.includes('(SUNDAY)'),'Sunday column must remain included');
});
