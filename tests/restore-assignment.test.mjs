import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {assignScheduleGuard,vacationCoverageEvents,attendanceEvent} from '../public/workspace-model.js';
import {ledger} from '../public/editor-model.js';import {payrollSummary} from '../public/payroll.js';
const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function fixture(){const master={rows:[{id:'dock',p:2,post:'Dock',start:420,end:900,guards:['A','','','','','',''],billable:false}],plans:{},overrides:{},events:[]};const state=structuredClone(master);state.rows[0].guards[0]='Cover';const opened=[];const nodes={cellEditor:{close(){}}};const c={workspace:{mode:'weekly',master},state,vacationCoverageEvents,clearTimeout(){},timer:0,activeInline:null,$:id=>nodes[id],render(){},structuredClone,openAttendance:(...args)=>opened.push(args)};vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function promptAttendanceChange('),source.indexOf('function inlineCell(')),c);return {master,state,c,opened,target:ledger(state)[0]};}
test('Returning saved Master guard to own post skips an absence question for covering guard and counts only restored worked hours',()=>{
 const {state,c,target,opened}=fixture(),fields={guard:'A',status:'staff',billable:false};assert.equal(c.promptAttendanceChange(target,fields),false);assert.equal(opened.length,0);const next=assignScheduleGuard(state,target,fields).state;assert.equal(ledger(next)[0].guard,'A');assert.equal(next.events.length,0);const totals=payrollSummary(next);assert.equal(totals.filter(r=>r.guard==='A').reduce((n,r)=>n+r.worked,0),8);assert.equal(totals.filter(r=>r.guard==='Cover').reduce((n,r)=>n+r.worked,0),0);assert.equal(state.rows[0].guards[0],'Cover');
});
test('Ordinary replacement and clearing a guard still offer attendance, and restoration must match source, day, post and time',()=>{
 for(const [change,fields] of [[{}, {guard:'Other'}],[{}, {guard:''}],[{source:'different'},{guard:'A'}],[{day:1},{guard:'A'}],[{post:'Lobby'},{guard:'A'}],[{end:960},{guard:'A'}]]){const {c,target,opened}=fixture();assert.equal(c.promptAttendanceChange({...target,...change},fields),true);assert.equal(opened.length,1);}
});
test('Restoring from a covering assignment never cancels the original vacation protection',()=>{
 const {master,c}=fixture();const state=attendanceEvent(master,ledger(master)[0],{type:'Vacation',cover:'Cover',payment:'PAID',paidHours:8});c.state=state;const target=ledger(state)[0],events=structuredClone(state.events);assert.equal(c.promptAttendanceChange(target,{guard:'A'}),false);assert.throws(()=>assignScheduleGuard(state,target,{guard:'A',status:'staff',billable:false}),/recorded on vacation/);assert.deepEqual(state.events,events);
});
