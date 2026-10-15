let arranged=false;
function move(id,slot){const node=document.getElementById(id),target=document.getElementById(slot);if(node&&target&&node!==target)target.append(node);}
export function initManagerLayout(){
 document.body.classList.add('modern-manager');
 if(!arranged){arranged=true;for(const [id,slot] of [['managerNav','modernNavSlot'],['previewGuardView','modernHeadingActions'],['createWeekControls','modernCreateSlot'],['weekControls','modernWeekSlot'],['platoon','modernPlatoonSlot'],['scheduleSearch','modernSearchSlot'],['printSchedule','modernPrintSlot'],['toggleAuto','modernSaveSlot'],['accountTools','modernAccountSlot'],['undo','modernAccountSlot'],['reset','modernAccountSlot'],['masterLock','modernSettingsSlot'],['deleteWeek','modernSettingsSlot'],['testWeekLabel','modernSettingsSlot'],['workflowError','modernSettingsSlot']])move(id,slot);}
 try{localStorage.removeItem('security-manager-layout');}catch{}
}
