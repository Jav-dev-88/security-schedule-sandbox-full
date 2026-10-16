import test from 'node:test';import assert from 'node:assert/strict';
import {missingInterval,leaveUse,seniority,validatePeople} from '../public/people-model.js';
import {newWorkspace,guardView,validateWorkspace} from '../src/domain.js';
test('Missing intervals calculate exact minutes, overnight, and reject ambiguous equal times',()=>{
 assert.equal(missingInterval('08:30','16:30').hours,8);assert.equal(missingInterval('23:15','01:45').hours,2.5);assert.equal(missingInterval('08:31','08:32').hours,1/60);assert.equal(missingInterval('15:00','14:00').hours,23);assert.equal(missingInterval('23:15','01:45').overnight,true);
 for(const [a,b] of [['08:00','08:00'],['24:00','12:00'],['8:00','10:00'],['','']])assert.throws(()=>missingInterval(a,b));
});
test('Leave usage combines linked shift portions, deduplicates overlaps, caps a day and excludes test / other years',()=>{
 const w=newWorkspace();w.staff=['A','B'];w.weeks={'2026-10-18':{...w.master,events:[{guard:'A',day:0,type:'Sick',start:510,end:900},{guard:'A',day:0,type:'Sick',start:900,end:990},{guard:'A',day:0,type:'Sick',start:510,end:900},{guard:'A',day:1,type:'Personal',start:420,end:1140},{guard:'B',day:1,type:'Sick',start:420,end:900}]},'2026-10-25':{...w.master,isTest:true,events:[{guard:'A',day:0,type:'Sick',start:420,end:900}]}};
 assert.deepEqual(leaveUse(w,'A',2026),[{date:'2026-10-12',type:'sick',hours:8},{date:'2026-10-13',type:'personal',hours:8}]);assert.deepEqual(leaveUse(w,'A',2025),[]);
 w.leaveAllowances={2026:{A:{sick:8,personal:3},B:{sick:10,personal:4}}};w.staffProfiles={A:{hireDate:'2020-01-01'},B:{hireDate:'2010-01-01'}};const own=guardView(w,'A');assert.equal(own.leaveBalances.find(b=>b.year==='2026').allowance.sick,8);assert.equal(JSON.stringify(own.leaveBalances).includes('"B"'),false);
});
test('Seniority leaves unknown dates last and separates temporary guards; saved metadata validates',()=>{
 const w=newWorkspace();w.staff=['A','B','C','Temp'];w.temporaryStaff=['Temp'];w.staffProfiles={B:{hireDate:'2010-01-01'},A:{hireDate:'2020-01-01'}};assert.deepEqual(seniority(w).map(x=>x.name),['B','A','C']);assert.doesNotThrow(()=>validateWorkspace(w));
 w.staffProfiles.C={hireDate:'2026-02-30'};assert.throws(()=>validatePeople(w));delete w.staffProfiles.C;w.leaveAllowances={2026:{A:{sick:-1,personal:3}}};assert.throws(()=>validatePeople(w));w.leaveAllowances[2026].A.sick=8;assert.doesNotThrow(()=>validatePeople(w));
});
