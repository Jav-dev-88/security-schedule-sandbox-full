import test from 'node:test';
import assert from 'node:assert/strict';
import {weeklyVacations} from '../public/weekly-vacations.js';

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
