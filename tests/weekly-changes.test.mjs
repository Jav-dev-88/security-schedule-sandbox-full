import test from 'node:test';
import assert from 'node:assert/strict';
import {ledger} from '../public/editor-model.js';
import {changedWeeklyShifts,transfersForWeek} from '../public/weekly-changes.js';
const master=()=>({version:2,rows:[{id:'lobby',post:'Lobby',p:2,start:420,end:900,guards:['Alex','','','','','',''],billable:false}],plans:{},overrides:{},events:[]});
test('daily details omit Master assignments and include added, replacement, time, post and billing changes',()=>{
 const m=master(),r=ledger(m).find(r=>r.guard==='Alex');
 assert.deepEqual(changedWeeklyShifts(m,[r]),[]);
 const changes=[{...r,source:'extra'},{...r,guard:'Bea'},{...r,start:480},{...r,end:960},{...r,post:'Dock'},{...r,billable:true},{...r,guard:'',role:'open'}];
 assert.deepEqual(changedWeeklyShifts(m,[r,...changes]),changes);
});
test('transfer and move details remain visible even when assignment matches Master',()=>{
 const m=master(),r=ledger(m).find(r=>r.guard==='Alex'),out={...r,payrollTransfer:{hours:8}},moved={...r,moveNote:'Moved'};
 assert.deepEqual(changedWeeklyShifts(m,[r,out,moved]),[out,moved]);
});
test('transfer list includes incoming and outgoing records only for selected week',()=>{
 const records=[{id:'out',fromWeek:'2026-10-18',toWeek:'2026-10-11'},{id:'in',fromWeek:'2026-10-25',toWeek:'2026-10-18'},{id:'other',fromWeek:'2026-11-01',toWeek:'2026-10-25'}];
 assert.deepEqual(transfersForWeek(records,'2026-10-18').map(t=>t.id),['out','in']);
 assert.deepEqual(transfersForWeek(records,'2026-11-08'),[]);
});
