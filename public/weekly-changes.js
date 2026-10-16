import {ledger} from './editor-model.js';

// Compare the actual assignment with its Master row, including time and billing edits.
export function changedWeeklyShifts(master,shifts){
 const normal=master?ledger(master):[];
 return shifts.filter(r=>r.payrollTransfer||r.moveNote||r.isCoverage||!normal.some(n=>
  n.source===r.source&&n.day===r.day&&n.guard===r.guard&&n.post===r.post&&
  n.start===r.start&&n.end===r.end&&!!n.billable===!!r.billable));
}
export function transfersForWeek(records,week){
 return (records||[]).filter(t=>t.fromWeek===week||t.toWeek===week);
}
