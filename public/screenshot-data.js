import {initialState,initialRows} from './editor-model.js';
export function screenshotState(){
 const state=initialState(),empty=()=>Array(7).fill('');
 const rows=[
 ['daylobby','FLSD / Lobby Sat & Sun',420,900,2,['Echevarria','Echevarria','Echevarria','Echevarria','Echevarria','Escolastico','Escolastico']],
 ['supervisor','Supervisor',360,1020,2,['Rasheed','Rasheed','','Rasheed','Rasheed','','']],
 ['entrance','6th Ave Main Entrance',420,1140,2,['Collado','Escolastico','Assouman','Assouman','Escolastico','','']],
 ['lobby','Lobby',510,900,2,['Escolastico','Collado','Escolastico','Flores','Floater','','']],
 ['dock2','Loading Dock 32nd St.',420,900,2,['Lamont','Lamont','Lamont','Lamont','Lamont','','']],
 ['relief','Rover / Relief',480,960,2,['Lodvil','Assouman','Collado','','Floater','','']],
 ['dayweekend','Sat & Sun',420,900,2,['','','','','','Lodvil','Lodvil']],
 ['awny-mon1','33rd LD AdWeek Billable',420,510,2,['Gobardhan','','','','','',''],true],
 ['awny-mon2','33rd LD AdWeek Billable',510,900,2,['Flores','','','','','',''],true],
 ['awny-tue','33rd LD AdWeek Billable',420,900,2,['','Flores','','','','',''],true],
 ['awny-wed1','33rd LD AdWeek Billable',420,570,2,['','','Rasheed','','','',''],true],
 ['supervisor-part','Supervisor',570,1020,2,['','','Rasheed','','','','']],
 ['awny-wed2','33rd LD AdWeek Billable',570,900,2,['','','Floater','','','',''],true],
 ['relief-part','Rover / Relief',480,900,2,['','','','Floater','','','']],
 ['awny-spare','33rd LD AdWeek Billable',480,900,2,empty(),true],
 ['flsd','FLSD',900,1380,3,['Flores','Flores','Flores','Flores','Flores','','']],
 ['supervisor-p3','Supervisor',900,1380,3,['','','','','','Collado','Collado']],
 ['rover','Rover Guard',900,1380,3,['','','Samuel','Lodvil','Lodvil','','']],
 ['dock3','Loading Dock 32nd',900,990,3,['Escolastico','Lamont','Escolastico','Flores','Floater','','']],
 ['weekend','Sat & Sun Lobby',900,1380,3,['','','','','','Assouman','Assouman']],
 ['rover-return','Rover Guard',1020,1380,3,['Samuel','Collado','','','','','']],
 ['awny-p3','33rd LD AdWeek Billable',900,1020,3,['Samuel','Collado','Lamont','','','',''],true],
 ['rover-gap','Rover Guard Gap',990,1020,3,['Escolastico','Lamont','Escolastico','','','','']],
 ['omc','OMC Billable',960,1050,3,['','Assouman','','','','',''],true]
 ];
 state.rows=[...structuredClone(initialRows.filter(r=>r.p===1)),...rows.map(([id,post,start,end,p,guards,billable=false],i)=>({id,post,start,end,p,guards,billable,order:i+2}))];
 state.layout='spreadsheet';return state;
}
