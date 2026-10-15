import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleToday,currentScheduleWeek,openingScheduleWeek} from '../public/workspace-model.js';

test('Opening week follows New York dates at midnight, Sundays, and year boundaries',()=>{
 for(const [instant,today,week] of [
  ['2026-10-16T02:00:00Z','2026-10-15','2026-10-18'],
  ['2026-10-19T03:59:00Z','2026-10-18','2026-10-18'],
  ['2026-10-19T04:00:00Z','2026-10-19','2026-10-25'],
  ['2026-11-02T04:59:00Z','2026-11-01','2026-11-01'],
  ['2026-11-02T05:00:00Z','2026-11-02','2026-11-08'],
  ['2026-12-31T20:00:00Z','2026-12-31','2027-01-03']]){
  assert.equal(scheduleToday(new Date(instant)),today);
  assert.equal(currentScheduleWeek(new Date(instant)),week);
 }
 const now=new Date('2026-10-15T12:00:00Z'),weeks=['2026-10-11','2026-10-18','2026-10-25'];
 assert.equal(openingScheduleWeek(weeks,'2026-10-25',now),'2026-10-18');
 const missing=['2026-10-11','2026-10-25'],before=JSON.stringify(missing);
 assert.equal(openingScheduleWeek(missing,'2026-10-11',now),'2026-10-11');
 assert.equal(openingScheduleWeek(missing,'missing',now),'2026-10-25');
 assert.equal(JSON.stringify(missing),before,'Opening never creates or overwrites a week');
 assert.equal(openingScheduleWeek([],null,now),'');
});
