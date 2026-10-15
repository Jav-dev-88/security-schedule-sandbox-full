// Print a snapshot outside the dashboard so hidden panels cannot create pages.
export function schedulePrintScale(height,available=720){
 return Math.min(1,Math.max(0.01,(available-8)/Math.max(1,height)));
}
export function clearSchedulePrint(){document.getElementById('schedulePrintRoot')?.remove();}
export function prepareSchedulePrint(schedule,heading){
 clearSchedulePrint();
 const root=document.createElement('section');root.id='schedulePrintRoot';root.setAttribute('aria-hidden','true');
 const sheet=document.createElement('div');sheet.className='schedule-print-sheet';
 const title=document.createElement('h1');title.textContent=heading;sheet.append(title);
 const grid=schedule.cloneNode(true);grid.removeAttribute('id');grid.className='schedule-print-grid';
 grid.querySelectorAll('.controls,.row-actions,.edit-hint,.field-hint,.platoon-bar .toolbar,.row-field-editor,.inline-editor').forEach(node=>node.remove());
 grid.querySelectorAll('button.cellbutton,button.row-field').forEach(button=>{const content=document.createElement('div');content.className='schedule-print-cell';content.innerHTML=button.innerHTML;button.replaceWith(content);});
 grid.querySelectorAll('button,input,select,dialog,br').forEach(node=>{if(node.tagName!=='BR'||node.parentElement===grid)node.remove();});
 sheet.append(grid);root.append(sheet);document.body.append(root);
 // Letter landscape: 8.5 inches minus .3 top and .7 bottom, at 96 CSS px/in.
 const scale=schedulePrintScale(sheet.getBoundingClientRect().height);
 root.style.zoom=String(scale);root.style.width=(10.4/scale)+'in';sheet.style.width='100%';
 return root;
}
