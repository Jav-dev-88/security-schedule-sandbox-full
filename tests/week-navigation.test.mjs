import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function harness(weeks,active='2026-10-18'){
 const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',attributes:{},classes:{},classList:{toggle(name,value){nodes.get(id).classes[name]=value;}},setAttribute(name,value){this.attributes[name]=value;}});return nodes.get(id);};let current='2026-10-18',resets=0;const pages=[],creates=[];
 const c={workspace:{mode:'weekly',activeWeek:active,weeks},page:'weekly',$,currentScheduleWeek:()=>current,displayDate:s=>s.slice(5,7)+'-'+s.slice(8)+'-'+s.slice(0,4),resetHoursFilters:()=>resets++,showPage:p=>pages.push(p)};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function renderWeekNavigation('),source.indexOf("$('generateWeek').onclick=")),c);$('generateWeek').onclick=()=>creates.push($('newWeekEnd').value);
 return {c,$,pages,creates,setCurrent:s=>current=s,resets:()=>resets};
}
test('Saved week groups sort around current week, mark selection, and retain test labels',()=>{
 const h=harness({'2026-10-04':{},'2026-10-11':{},'2026-10-18':{},'2026-11-01':{isTest:true},'2026-10-25':{}});h.c.renderWeekNavigation();
 assert(h.$('pastWeekSelect').innerHTML.indexOf('10-11-2026')<h.$('pastWeekSelect').innerHTML.indexOf('10-04-2026'));assert(h.$('upcomingWeekSelect').innerHTML.indexOf('10-25-2026')<h.$('upcomingWeekSelect').innerHTML.indexOf('11-01-2026'));assert(h.$('upcomingWeekSelect').innerHTML.includes('Test'));assert.equal(h.$('currentWeekButton').attributes['aria-pressed'],'true');
 h.$('pastWeekSelect').value='2026-10-11';h.$('pastWeekSelect').onchange();h.c.renderWeekNavigation();assert.equal(h.c.workspace.activeWeek,'2026-10-11');assert.equal(h.$('currentWeekButton').attributes['aria-pressed'],'false');assert.equal(h.$('pastWeekSelect').classes['selected-week'],true);
 h.$('upcomingWeekSelect').value='2026-10-25';h.$('upcomingWeekSelect').onchange();h.c.renderWeekNavigation();assert.equal(h.$('pastWeekSelect').value,'');h.$('currentWeekButton').onclick();assert.equal(h.c.workspace.activeWeek,'2026-10-18');assert.equal(h.resets(),3);assert.deepEqual(h.creates,[]);
 h.setCurrent('2026-10-25');h.c.renderWeekNavigation();assert(h.$('pastWeekSelect').innerHTML.includes('10-18-2026'));assert(!h.$('upcomingWeekSelect').innerHTML.includes('10-25-2026'));
});
test('Missing current week uses existing create action; empty lists disable; invalid selection does nothing',()=>{
 const h=harness({});h.c.renderWeekNavigation();assert(h.$('pastWeekSelect').disabled);assert(h.$('upcomingWeekSelect').disabled);assert.equal(h.$('currentWeekButton').textContent,'Create this week’s schedule');h.$('currentWeekButton').onclick();assert.deepEqual(h.creates,['2026-10-18']);h.$('pastWeekSelect').value='';h.$('pastWeekSelect').onchange();assert.equal(h.resets(),0);assert.equal(Object.keys(h.c.workspace.weeks).length,0);
});
