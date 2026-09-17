// Extracted verbatim from the deployed Sprint 5/6 Data Event script.
function isBlank(v){return v===null||v===undefined||v===''||(typeof v==='string'&&v.trim()==='');}
function toNum(v){if(isBlank(v))return null;var n=parseFloat(String(v).replace(/,/g,''));if(isNaN(n)||!isFinite(n))return null;return n;}

// Conduit parsing comes from the DEPLOYED script via the harness - see
// tests/harness.js. A re-typed copy here would keep passing after the real
// script changed, which is how these expectations went stale once already.
const { load } = require('./harness.js');
const deployed = load('mainline-construction-dev.js');
const parseConduitPackage = deployed.fn('parseConduitPackage');
// Span and segment IDs are the same direction-normalizing function in the
// deployed script, so both are tested through it rather than through a copy.
const segId = deployed.fn('normalizedPair');

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

console.log('== SPRINT 5/8: CONDUIT PACKAGE DERIVATION ==');
// Shape changed at v5.0.0: {count,diameter} became {pulls,size,bundled,
// materialMultiplier,materialCode}. Sizes are 1.25/2/4 only per the ruling.
const pkg=(c)=>{const p=parseConduitPackage(c);return p?{pulls:p.pulls,size:p.size}:null;};
eq('TEST-UG-001 3x1.25 trench', pkg('BM60(3)(1.25) T'), {pulls:3,size:'1.25'});
eq('TEST-UG-002 2x2 trench',    pkg('BM60(2)(2) T'),    {pulls:2,size:'2'});
eq('TEST-UG-003 1x4 bore',      pkg('BM60-(4)DP'),      {pulls:1,size:'4'});
eq('TEST-UG-004 1x1.25 missile',pkg('BM60-(1.25)MB'),   {pulls:1,size:'1.25'});
eq('TEST-UG-005 0.75 now out of scope', pkg('BM60(1)(0.75)Drop'), null);
eq('TEST-UG-006 7-way micro out of scope', pkg('BM60-(7Way)P Micro Duct'), null);
eq('TEST-UG-007 micro out of scope', pkg('BM60(MICRO)'),null);
eq('TEST-UG-008 rock adder',    pkg('BM60-R'),          null);
eq('TEST-UG-009 size not stated',pkg('BM60-DROP'),      null);
eq('TEST-UG-010 non-UG code',   pkg('AFO.SL'),          null);
eq('TEST-UG-011 blank',         pkg(''),                null);
eq('TEST-UG-012 null',          pkg(null),              null);
eq('TEST-UG-013 5-pull directional bore', pkg('BM60(5)(1.25)DP'), {pulls:5,size:'1.25'});

console.log('== SPRINT 5/8: TOTAL DUCT FOOTAGE (informational, not purchasing) ==');
// quantity x pull count = duct feet in the ground. This is NOT the material
// quantity - see tests/conduit-dp-material.test.js for that distinction.
const condFt=(qty,code)=>{const p=parseConduitPackage(code);return p?Math.round(toNum(qty)*p.pulls*100)/100:'';};
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
