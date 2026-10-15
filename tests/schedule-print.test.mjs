import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {schedulePrintScale,prepareSchedulePrint,clearSchedulePrint} from '../public/schedule-print.js';

test('Print scale fits short and long schedules above the reserved bottom margin',()=>{
 for(const height of [200,650,720,900,1400,2200]){
  const scale=schedulePrintScale(height);
  assert(scale<=1);assert(height*scale<=712);
 }
 assert.equal(schedulePrintScale(400),1);
});

test('Print snapshot is independent of dashboard visibility and leaves the editable source intact',()=>{
 const removed=[],replaced=[];let root;
 class Node{
  constructor(tag='DIV'){this.tagName=tag.toUpperCase();this.style={};this.children=[];this.innerHTML='';}
  setAttribute(){} removeAttribute(){} append(node){this.children.push(node);}
  remove(){removed.push(this);if(this===root)root=null;}
  getBoundingClientRect(){return {height:1000};}
 }
 const clone=new Node();const control=new Node('button'),cell=new Node('button'),rowField=new Node('button'),dateBreak=new Node('br'),spacer=new Node('br');
 cell.innerHTML='<strong>Guard A</strong><small>Covering</small>';rowField.innerHTML='Loading Dock';
 cell.replaceWith=node=>replaced.push(node);rowField.replaceWith=node=>replaced.push(node);dateBreak.parentElement=new Node('th');spacer.parentElement=clone;
 clone.querySelectorAll=selector=>selector.startsWith('.controls')?[control]:selector.startsWith('button.cellbutton')?[cell,rowField]:[dateBreak,spacer];
 const source={cloneNode:()=>clone};
 const oldDocument=globalThis.document;
 globalThis.document={getElementById:()=>root,createElement:tag=>new Node(tag),body:{append:node=>{root=node;}}};
 try{
  const snapshot=prepareSchedulePrint(source,'WEEKLY SCHEDULE — W-E 10-18-2026');
  assert.equal(snapshot.id,'schedulePrintRoot');assert.equal(snapshot.children[0].children[0].textContent,'WEEKLY SCHEDULE — W-E 10-18-2026');
  assert(replaced[0].innerHTML.includes('Guard A'));assert.equal(replaced[1].innerHTML,'Loading Dock');assert.equal(clone.className,'schedule-print-grid');
  assert(removed.includes(control));assert(removed.includes(spacer));assert(!removed.includes(dateBreak),'Dates retain line breaks below weekday names');
  assert.equal(snapshot.style.zoom,'0.712');assert.equal(source.id,undefined,'The live source is untouched');
  clearSchedulePrint();assert.equal(root,null);
 }finally{globalThis.document=oldDocument;}
 const css=fs.readFileSync(new URL('../public/schedule-print.css',import.meta.url),'utf8');
 assert(css.includes('margin:.3in .3in .7in'));assert(css.includes('body.print-schedule>:not(#schedulePrintRoot){display:none!important}'));
});
