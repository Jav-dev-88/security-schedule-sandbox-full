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
