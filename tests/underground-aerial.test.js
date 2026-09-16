// Extracted verbatim from the deployed Sprint 5/6 Data Event script.
function isBlank(v){return v===null||v===undefined||v===''||(typeof v==='string'&&v.trim()==='');}
function toNum(v){if(isBlank(v))return null;var n=parseFloat(String(v).replace(/,/g,''));if(isNaN(n)||!isFinite(n))return null;return n;}

// Conduit package is a FACT encoded in the labor code. Parsed, never guessed.
//   BM60(3)(1.25) T -> 3 x 1.25"      BM60-(4)DP -> 1 x 4"
function parseConduitPackage(code){
  if(isBlank(code)) return null;
  var c=String(code).trim();
  if(c.indexOf('BM60')!==0) return null;
  if(c.indexOf('BM60-R')===0) return null;           // rock adder: no conduit
  var m=/^BM60\((\d+)\)\((\d*\.?\d+)\)/.exec(c);
  if(m) return {count:parseInt(m[1],10), diameter:m[2]};
  if(/^BM60-?\((\d+)Way\)/i.test(c)) return {count:1, diameter:'MICRO'};
  if(c.indexOf('BM60(MICRO)')===0) return {count:1, diameter:'MICRO'};
  m=/^BM60-?\((\d*\.?\d+)\)/.exec(c);
  if(m) return {count:1, diameter:m[1]};
  return null;                                        // e.g. BM60-DROP: size not stated
}
function segId(a,b){a=(a||'').trim().toUpperCase();b=(b||'').trim().toUpperCase();if(!a||!b)return null;return (a<=b)?(a+'_'+b):(b+'_'+a);}
function reelRangeIssues(ss,es,rb,re){
  var out=[];
  if(ss===null||es===null||rb===null||re===null) return out;
  var lo=Math.min(rb,re), hi=Math.max(rb,re);
  if(ss<lo||ss>hi) out.push('start outside reel range');
  if(es<lo||es>hi) out.push('end outside reel range');
  return out;
}

let pass=0,fail=0;
function eq(id,a,e){const ok=JSON.stringify(a)===JSON.stringify(e);ok?pass++:fail++;
  console.log((ok?'PASS':'FAIL')+'  '+id+'  got='+JSON.stringify(a)+(ok?'':'  want='+JSON.stringify(e)));}

console.log('== SPRINT 5: CONDUIT PACKAGE DERIVATION ==');
eq('TEST-UG-001 3x1.25 trench', parseConduitPackage('BM60(3)(1.25) T'), {count:3,diameter:'1.25'});
eq('TEST-UG-002 2x2 trench',    parseConduitPackage('BM60(2)(2) T'),    {count:2,diameter:'2'});
eq('TEST-UG-003 1x4 bore',      parseConduitPackage('BM60-(4)DP'),      {count:1,diameter:'4'});
eq('TEST-UG-004 1x1.25 missile',parseConduitPackage('BM60-(1.25)MB'),   {count:1,diameter:'1.25'});
eq('TEST-UG-005 0.75 drop',     parseConduitPackage('BM60(1)(0.75)Drop'),{count:1,diameter:'0.75'});
eq('TEST-UG-006 7-way micro',   parseConduitPackage('BM60-(7Way)P Micro Duct'),{count:1,diameter:'MICRO'});
eq('TEST-UG-007 micro',         parseConduitPackage('BM60(MICRO)'),     {count:1,diameter:'MICRO'});
eq('TEST-UG-008 rock adder',    parseConduitPackage('BM60-R'),          null);
eq('TEST-UG-009 size not stated',parseConduitPackage('BM60-DROP'),      null);
eq('TEST-UG-010 non-UG code',   parseConduitPackage('AFO.SL'),          null);
eq('TEST-UG-011 blank',         parseConduitPackage(''),                null);
eq('TEST-UG-012 null',          parseConduitPackage(null),              null);

console.log('== SPRINT 5: CONDUIT FOOTAGE (the spec example) ==');
const condFt=(qty,code)=>{const p=parseConduitPackage(code);return p?Math.round(toNum(qty)*p.count*100)/100:'';};
eq('TEST-UG-020 500 FT of 3x125 = 1500', condFt(500,'BM60(3)(1.25) T'), 1500);
eq('TEST-UG-021 500 FT of 2x125 = 1000', condFt(500,'BM60(2)(1.25) T'), 1000);
eq('TEST-UG-022 300 FT of 1x4   = 300',  condFt(300,'BM60-(4)DP'),      300);
eq('TEST-UG-023 1 FT   of 3x125 = 3',    condFt(1,'BM60(3)(1.25) T'),   3);
eq('TEST-UG-024 1000 FT of 3x125= 3000', condFt(1000,'BM60(3)(1.25) T'),3000);
eq('TEST-UG-025 no package -> blank',    condFt(500,'BM60-DROP'),       '');

console.log('== SPRINT 6: SPAN ID DIRECTION NORMALIZATION ==');
eq('TEST-AERIAL-001 forward',  segId('P-101','P-102'), 'P-101_P-102');
eq('TEST-AERIAL-002 reversed', segId('P-102','P-101'), 'P-101_P-102');
eq('TEST-AERIAL-003 one blank',segId('P-101',''),      null);

console.log('== SPRINT 4: REEL RANGE (23.5) ==');
eq('TEST-REEL-001 inside 110000-115000 of 100000-120000', reelRangeIssues(110000,115000,100000,120000), []);
eq('TEST-REEL-002 end past reel end',  reelRangeIssues(119000,121000,100000,120000), ['end outside reel range']);
eq('TEST-REEL-003 start before begin', reelRangeIssues(95000,101000,100000,120000),  ['start outside reel range']);
eq('TEST-REEL-004 both outside',       reelRangeIssues(90000,130000,100000,120000),  ['start outside reel range','end outside reel range']);
eq('TEST-REEL-005 exact reel bounds',  reelRangeIssues(100000,120000,100000,120000), []);
eq('TEST-REEL-006 reel stored reversed',reelRangeIssues(110000,115000,120000,100000),[]);
eq('TEST-REEL-007 no reel linked',     reelRangeIssues(110000,115000,null,null),     []);

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
