// Extracted verbatim from the deployed Sprint 1 Data Event script.
function isBlank(v){return v===null||v===undefined||v===''||(typeof v==='string'&&v.trim()==='');}
function toNum(v){if(isBlank(v))return null;var n=parseFloat(String(v).replace(/,/g,''));if(isNaN(n)||!isFinite(n))return null;return n;}
function isoWeek(d){var t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));var dayNum=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-dayNum);var yearStart=new Date(Date.UTC(t.getUTCFullYear(),0,1));var week=Math.ceil((((t-yearStart)/86400000)+1)/7);return {year:t.getUTCFullYear(),week:week};}
function pad2(n){return (n<10?'0':'')+n;}
function laborParse(label){var m=/^(.*?)\s*\((FT|EA|HR|SPLICE|SF|EVENT)\)\s*(.*)$/.exec(label);return m?{unit:m[2],desc:m[3]}:null;}
function segId(a,b){a=(a||'').trim().toUpperCase();b=(b||'').trim().toUpperCase();if(!a||!b)return null;return (a<=b)?(a+'_'+b):(b+'_'+a);}

let pass=0,fail=0;
function eq(id,actual,expected){
  const ok=JSON.stringify(actual)===JSON.stringify(expected);
  ok?pass++:fail++;
  console.log((ok?'PASS':'FAIL')+'  '+id+'  got='+JSON.stringify(actual)+(ok?'':'  want='+JSON.stringify(expected)));
}
const seqFt=(s,e)=>{const a=toNum(s),b=toNum(e);return (a===null||b===null)?'':Math.abs(b-a);};
const total=(s,sl,o)=>Math.round(((toNum(s)||0)+(toNum(sl)||0)+(toNum(o)||0))*100)/100;
const ext=(q,r)=>Math.round(((toNum(q)||0)*(toNum(r)||0))*100)/100;

console.log('== 23.2 FIBER SEQUENTIALS ==');
eq('TEST-FIBER-001 increasing',      seqFt(100000,101250), 1250);
eq('TEST-FIBER-002 decreasing',      seqFt(101250,100000), 1250);
eq('TEST-FIBER-003 same',            seqFt(100000,100000), 0);
eq('TEST-FIBER-004 missing start',   seqFt(null,101250),   '');
eq('TEST-FIBER-005 missing end',     seqFt(100000,null),   '');
eq('TEST-FIBER-006 garbage input',   seqFt('abc',101250),  '');
eq('TEST-FIBER-007 blank string',    seqFt('',101250),     '');

console.log('== 23.3 SLACK ==');
eq('TEST-FIBER-010 slack total',     total(1250,150,50),   1450);
eq('TEST-FIBER-011 slack only',      total(1250,null,null),1250);
eq('TEST-FIBER-012 all blank',       total(null,null,null),0);

console.log('== 23.13 EXTENDED VALUE ==');
eq('TEST-FIN-001 500 x 8.25',        ext(500,8.25),        4125);
eq('TEST-FIN-002 decimal rate',      ext(1000,7.875),      7875);
eq('TEST-FIN-003 blank rate',        ext(500,null),        0);
eq('TEST-FIN-004 blank qty',         ext(null,8.25),       0);
eq('TEST-FIN-005 large value',       ext(1000000,1.85),    1850000);
eq('TEST-FIN-006 rounding',          ext(3,0.335),         1.01);

console.log('== 23.29 REPORTING DATES (ISO, Mon start) ==');
const wk=s=>{const d=new Date(s+'T12:00:00');const i=isoWeek(d);return i.year+'-W'+pad2(i.week);};
eq('TEST-REPORT-001 2026-01-01',     wk('2026-01-01'), '2026-W01');
eq('TEST-REPORT-002 2026-12-31',     wk('2026-12-31'), '2026-W53');
eq('TEST-REPORT-003 Mon 2026-09-14', wk('2026-09-14'), '2026-W38');
eq('TEST-REPORT-004 Sun 2026-09-20', wk('2026-09-20'), '2026-W38');
eq('TEST-REPORT-005 Mon 2026-09-21', wk('2026-09-21'), '2026-W39');
eq('TEST-REPORT-006 leap 2028-02-29',wk('2028-02-29'), '2028-W09');

console.log('== LABOR METADATA PARSE ==');
eq('TEST-CORE-001 FT code',   laborParse('BM60(3)(1.25) T (FT) Labor to place three (3) vacant'), {unit:'FT',desc:'Labor to place three (3) vacant'});
eq('TEST-CORE-002 SPLICE',    laborParse('HO-1 (1-24) (SPLICE) This unit is labor for fusion'),   {unit:'SPLICE',desc:'This unit is labor for fusion'});
eq('TEST-CORE-003 EA',        laborParse('BM2 (EA) Ground Rod'),                                   {unit:'EA',desc:'Ground Rod'});
eq('TEST-CORE-004 EVENT',     laborParse('BMHR ER1 (EVENT) Emergency Call Out.'),                  {unit:'EVENT',desc:'Emergency Call Out.'});
eq('TEST-CORE-005 malformed', laborParse('NO UNIT HERE'),                                          null);

console.log('== 23.28 SEGMENT DIRECTION ==');
eq('TEST-SEG-001 forward',    segId('HH-001','HH-002'), 'HH-001_HH-002');
eq('TEST-SEG-002 reversed',   segId('HH-002','HH-001'), 'HH-001_HH-002');
eq('TEST-SEG-003 case/space', segId(' hh-002 ','HH-001'),'HH-001_HH-002');
eq('TEST-SEG-004 missing to', segId('HH-001',''),        null);

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
