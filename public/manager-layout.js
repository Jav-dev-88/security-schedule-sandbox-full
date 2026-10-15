let arranged=false;
function move(id,slot){const node=document.getElementById(id),target=document.getElementById(slot);if(node&&target&&node!==target)target.append(node);}
export function initManagerLayout(){
 document.body.classList.add('modern-manager');
 if(!arranged){arranged=true;for(const [id,slot] of [
  ['managerNav','modernNavSlot'],['previewGuardView','modernHeadingActions'],['createWeekControls','modernCreateSlot'],['weekControls','modernWeekSlot'],['platoon','modernPlatoonSlot'],['scheduleSearch','modernSearchSlot'],['toggleAuto','modernSaveSlot'],['accountTools','modernAccountSlot'],['refreshShared','headerRefreshSlot'],['reset','modernSettingsSlot'],['masterLock','modernSettingsSlot'],['deleteWeek','modernSettingsSlot'],['testWeekLabel','modernSettingsSlot'],['workflowError','modernSettingsSlot'],
  ['printSchedule','printExportActions'],['downloadSchedulePdf','printExportActions'],['emailSchedule','printExportActions'],['printPayroll','printExportActions'],['exportCsv','printExportActions'],['downloadTransferPayroll','printExportActions'],['printCoverage','printExportActions'],
  ['openManualSwitch','requestsActions'],['openBackups','historyActions'],['deletedRowsPanel','historyDeletedSlot'],['openAccounts','staffAccessTools'],['weeklyLeavePanel','coverageSummarySlot'],['coverageHolidays','holidaySettingsSlot'],['stats','payrollSummarySlot'],['hoursExplanation','payrollSummarySlot'],['openHoursBreakdown','payrollSummarySlot'],['modernSummary','scheduleSummarySlot']
 ])move(id,slot);}
 try{localStorage.removeItem('security-manager-layout');}catch{}
}
