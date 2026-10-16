import test from 'node:test';
import assert from 'node:assert/strict';
import {weeklyVacations,upcomingVacations} from '../public/weekly-vacations.js';

test('vacations overlap both weeks and appear before the next schedule exists',()=>{
 const w={vacations:[{guard:'Alex',from:'2026-12-30',to:'2027-01-06'},{guard:'Bea',from:'2027-01-08',to:'2027-01-10'}],weeks:{}};
 const [current,next]=weeklyVacations(w,'2027-01-03');
 assert.equal(next.weekEnd,'2027-01-10');
 assert.deepEqual(current.guards,[{guard:'Alex',ranges:[{from:'2026-12-30',to:'2027-01-03'}]}]);
 assert.deepEqual(next.guards,[{guard:'Alex',ranges:[{from:'2027-01-04',to:'2027-01-06'}]},{guard:'Bea',ranges:[{from:'2027-01-08',to:'2027-01-10'}]}]);
});
test('saved and split-shift vacation events are deduplicated; other leave stays out',()=>{
 const w={vacations:[{guard:'Alex',from:'2026-10-12',to:'2026-10-13'}],weeks:{'2026-10-18':{events:[{guard:'Alex',day:0,type:'Vacation'},{guard:'Alex',day:0,type:'Vacation'},{guard:'Alex',day:3,type:'Vacation'},{guard:'Bea',day:1,type:'LOA'}]},'2026-10-25':{events:[{guard:'Cam',day:0,type:'Vacation'}]}}};
 const [current,next]=weeklyVacations(w,'2026-10-18');
 assert.deepEqual(current.guards,[{guard:'Alex',ranges:[{from:'2026-10-12',to:'2026-10-13'},{from:'2026-10-15',to:'2026-10-15'}]}]);
 assert.deepEqual(next.guards,[{guard:'Cam',ranges:[{from:'2026-10-19',to:'2026-10-19'}]}]);
});

test('Upcoming vacations use today through 14 days ahead, keep full dates, and merge linked events / overlapping ranges',()=>{
 const w={vacations:[{guard:'A',from:'2026-10-28',to:'2026-11-04'},{guard:'A',from:'2026-10-29',to:'2026-11-02'},{guard:'B',from:'2026-10-30',to:'2026-11-05'},{guard:'C',from:'2026-10-31',to:'2026-11-06'},{guard:'Ongoing',from:'2026-10-12',to:'2026-10-20'},{guard:'Today',from:'2026-10-16',to:'2026-10-18'}],weeks:{'2026-11-01':{events:[{guard:'A',type:'Vacation',day:2},{guard:'A',type:'Vacation',day:2}]},'2026-10-25':{isTest:true,events:[{guard:'Test guard',type:'Vacation',day:1}]}}};
 const r=upcomingVacations(w,'2026-10-16');assert.equal(r.to,'2026-10-30');assert.deepEqual(r.guards.map(g=>[g.guard,g.daysUntil]),[['Today',0],['A',12],['B',14]]);assert.equal(r.guards[1].to,'2026-11-04');
});
test('Upcoming legacy vacation days merge across weeks and work over a year boundary',()=>{
 const w={weeks:{'2027-01-03':{events:[{guard:'A',type:'Vacation',day:6},{guard:'A',type:'Vacation',day:6}]},'2027-01-10':{events:[{guard:'A',type:'Vacation',day:0},{guard:'B',type:'Sick',day:1}]}}};assert.deepEqual(upcomingVacations(w,'2026-12-25').guards,[{guard:'A',from:'2027-01-03',to:'2027-01-04',daysUntil:9}]);
});
