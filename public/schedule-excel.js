import {excelTemplate} from './excel-template.js';
import {ledger,orderedGroups} from './editor-model.js';
import {assignmentClassifier} from './assignment-status.js';
import {datesForWeek} from './workspace-model.js';
import {DAYS} from './model.js';
import {holidayOnDate} from './holidays.js';
import {transferForShift} from './payroll-transfers.js';

const xml=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const date=d=>d.slice(5,7)+'-'+d.slice(8)+'-'+d.slice(0,4);
const MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
// Store UTF-8 XML parts in a standard ZIP package without a network or CDN dependency.
export function zipExcelParts(files){
 const encoder=new TextEncoder(),parts=[],directory=[];let offset=0;
 for(const [path,content]of Object.entries(files)){
  const name=encoder.encode(path),body=encoder.encode(content),crc=crc32(body),local=new Uint8Array(30+name.length),a=new DataView(local.buffer);
  a.setUint32(0,0x04034b50,true);a.setUint16(4,20,true);a.setUint16(6,0x800,true);a.setUint16(12,33,true);a.setUint32(14,crc,true);a.setUint32(18,body.length,true);a.setUint32(22,body.length,true);a.setUint16(26,name.length,true);local.set(name,30);
  const central=new Uint8Array(46+name.length),b=new DataView(central.buffer);b.setUint32(0,0x02014b50,true);b.setUint16(4,20,true);b.setUint16(6,20,true);b.setUint16(8,0x800,true);b.setUint16(14,33,true);b.setUint32(16,crc,true);b.setUint32(20,body.length,true);b.setUint32(24,body.length,true);b.setUint16(28,name.length,true);b.setUint32(42,offset,true);central.set(name,46);parts.push(local,body);directory.push(central);offset+=local.length+body.length;
 }
 const size=directory.reduce((n,p)=>n+p.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,directory.length,true);v.setUint16(10,directory.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);
 const result=new Uint8Array(offset+size+end.length);let at=0;for(const part of [...parts,...directory,end]){result.set(part,at);at+=part.length;}return result;
}
export function scheduleExcelParts(workspace,state,mode='weekly',week=workspace.activeWeek){
 const master=mode==='master',dates=master?[]:datesForWeek(week),styles=excelTemplate.styles,rows=[],merges=[];
 const classify=assignmentClassifier(master?null:workspace.master,state),list=ledger(state).map(classify),groups=orderedGroups(state,list);
 const cell=(col,row,value,style='body',formula=null)=>{
  const ref=String.fromCharCode(65+col)+row,s=styles[style];
  return formula?'<c r="'+ref+'" s="'+s+'"><f>'+xml(formula)+'</f><v>'+value+'</v></c>':typeof value==='number'?'<c r="'+ref+'" s="'+s+'"><v>'+value+'</v></c>':'<c r="'+ref+'" s="'+s+'" t="inlineStr"><is><t xml:space="preserve">'+xml(value)+'</t></is></c>';
 };
 const row=(values,style='body',height=30)=>{const n=rows.length+1;rows.push('<row r="'+n+'" ht="'+height+'" customHeight="1">'+values.map((value,col)=>cell(col,n,value,style)).join('')+'</row>');return n;};
 const wide=(text,style,height=30)=>{const n=row([text,...Array(10).fill('')],style,height);merges.push('A'+n+':K'+n);};
 const title=(master?'MASTER TEMPLATE':(state.isTest?'TEST SCHEDULE · ':'')+'W-E '+date(week));
 wide('Security Operations · '+title,'title',30);
 wide(master?'Normal weekly staffing pattern':date(dates[0])+' through '+date(dates[6]),'subtitle',24);
 for(const p of [1,2,3]){
  wide(['FIRST','SECOND','THIRD'][p-1]+' PLATOON','section',26);
  row(['Post / Location','Time In','Time Out','Hours',...DAYS.map((d,i)=>d+(master?'':'\n'+date(dates[i])+(holidayOnDate(workspace.holidays||[],dates[i])?'\n'+holidayOnDate(workspace.holidays||[],dates[i]):'')))],'header',master?28:52);
  for(const group of groups.filter(g=>g.p===p)){
   const n=rows.length+1,texts=group.cells.map(items=>items.length?items.map(r=>{
    const t=master?null:transferForShift(workspace,week,r);
    return (r.guard||'Blank shift')+(r.paidHoliday?' · Paid holiday — off':r.isCoverage?' · Covering':'')+(r.billable&&r.guard?' · Billable':'')+(t?'\n'+t.hours+' hrs in W-E '+date(t.toWeek):'')+(r.moveNote?'\n'+r.moveNote:'');
   }).join('\n'):'Blank shift');
   const dayStyle=(items,day)=>items.some(r=>r.paidHoliday)?'off':items.some(r=>r.isCoverage)?'coverage':items.some(r=>r.guard&&r.billable)?'billable':!master&&holidayOnDate(workspace.holidays||[],dates[day])?'holiday':!items.length?'blank':items.some(r=>!r.guard)?'open':'body';
   const count=Math.max(1,...texts.map(t=>t.split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/22)),0)),Math.ceil((group.post||'').length/30));
   rows.push('<row r="'+n+'" ht="'+Math.max(30,count*14+8)+'" customHeight="1">'+cell(0,n,group.post||'')+cell(1,n,group.start/1440,'time')+cell(2,n,group.end/1440,'time')+cell(3,n,(group.end-group.start)/60,'hours','IF(C'+n+'>=B'+n+',C'+n+'-B'+n+',C'+n+'+1-B'+n+')*24')+texts.map((text,day)=>cell(day+4,n,text,dayStyle(group.cells[day],day))).join('')+'</row>');
  }
 }
 wide('Gray = Blank shift · Amber = needs coverage · Purple = covering · Blue = billable · Gold = holiday date · Green = holiday off','subtitle',30);
 const sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:K'+rows.length+'"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="4" ySplit="4" topLeftCell="E5" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="30"/><cols><col min="1" max="1" width="32" customWidth="1"/><col min="2" max="3" width="10" customWidth="1"/><col min="4" max="4" width="9" customWidth="1"/><col min="5" max="11" width="24" customWidth="1"/></cols><sheetData>'+rows.join('')+'</sheetData><mergeCells count="'+merges.length+'">'+merges.map(ref=>'<mergeCell ref="'+ref+'"/>').join('')+'</mergeCells><pageMargins left="0.25" right="0.25" top="0.3" bottom="0.7" header="0" footer="0"/><pageSetup paperSize="1" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
 const files={...excelTemplate.files,'xl/worksheets/sheet1.xml':sheet};
 files['xl/workbook.xml']=files['xl/workbook.xml'].replace('name="Schedule"','name="'+(master?'Master Template':'Weekly Schedule')+'"');
 return {files,filename:master?'Security_Master_Template.xlsx':'Security_'+(state.isTest?'Test_':'')+'Schedule_W-E_'+date(week)+'.xlsx'};
}
export function downloadScheduleExcel(workspace,state,mode,week){
 const {files,filename}=scheduleExcelParts(workspace,state,mode,week),bytes=zipExcelParts(files),url=URL.createObjectURL(new Blob([bytes],{type:MIME})),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return filename;
}
