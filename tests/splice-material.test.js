// Extracted verbatim from the deployed Sprint 7/8 Data Event script.
function isBlank(v){return v===null||v===undefined||v===''||(typeof v==='string'&&v.trim()==='');}
function toNum(v){if(isBlank(v))return null;var n=parseFloat(String(v).replace(/,/g,''));if(isNaN(n)||!isFinite(n))return null;return n;}

// HO-1 (25-48) -> {lo:25, hi:48}; HO-1 (145 or above) -> {lo:145, hi:null}
function parseSpliceBand(code){
  if(isBlank(code)) return null;
  var c=String(code).trim();
  if(c.indexOf('HO-1')!==0) return null;
  var m=/\((\d+)\s*-\s*(\d+)\)/.exec(c);
  if(m) return {lo:parseInt(m[1],10), hi:parseInt(m[2],10)};
  m=/\((\d+)\s*or above\)/i.exec(c);
  if(m) return {lo:parseInt(m[1],10), hi:null};
  return null;
}
function bandLabel(b){return b===null?null:(b.hi===null?b.lo+'+':b.lo+'-'+b.hi);}
function bandFits(b,fiberCount){
  if(b===null||fiberCount===null) return true;          // nothing to check
  if(fiberCount<b.lo) return false;
  if(b.hi!==null&&fiberCount>b.hi) return false;
  return true;
}
// Conduit parsing comes from the DEPLOYED script via the harness, so the
// v5.0.0 size-dependent multiplier cannot drift away from these tests.
const { load } = require('./harness.js');
const parseConduitPackage = load('mainline-construction-dev.js').fn('parseConduitPackage');
// Installed material: multiplier x production footage. 1:1 for bundled 1.25",
// n:1 for single-pipe 2" and 4".
const conduitMaterialQty=(qty,code)=>{const p=parseConduitPackage(code);
  return p?Math.round(toNum(qty)*p.materialMultiplier*100)/100:'';};
const totalDuctFt=(qty,code)=>{const p=parseConduitPackage(code);return p?Math.round(toNum(qty)*p.pulls*100)/100:'';};

let pass=0,fail=0;
function eq(id,a,e){const ok=JSON.stringify(a)===JSON.stringify(e);ok?pass++:fail++;
  console.log((ok?'PASS':'FAIL')+'  '+id+'  got='+JSON.stringify(a)+(ok?'':'  want='+JSON.stringify(e)));}

console.log('== SPRINT 8: PULL-COUNT RULING (bundled SKU, 1 FT per production FT) ==');
const matCode=(c)=>{const p=parseConduitPackage(c);return p?[p.pulls,p.size,p.materialMultiplier,p.materialCode]:null;};
eq('TEST-MAT-001 1-pull plow',  matCode('BM60(1)(1.25) P'), [1,'1.25',1,'CONDUIT-1.25-1PULL']);
eq('TEST-MAT-002 2-pull plow',  matCode('BM60(2)(1.25) P'), [2,'1.25',1,'CONDUIT-1.25-2PULL']);
eq('TEST-MAT-003 3-pull trench',matCode('BM60(3)(1.25) T'), [3,'1.25',1,'CONDUIT-1.25-3PULL']);
eq('TEST-MAT-004 2 inch is single-pipe, so 2 pulls multiply', matCode('BM60(2)(2) T'), [2,'2',2,'CONDUIT-2-1PULL']);
eq('TEST-MAT-005 4 inch bore',  matCode('BM60-(4)DP'),      [1,'4',1,'CONDUIT-4-1PULL']);
eq('TEST-MAT-006 0.75 out of scope', parseConduitPackage('BM60(1)(0.75) T'), null);
eq('TEST-MAT-007 micro out of scope',parseConduitPackage('BM60-(7Way)P Micro Duct'), null);
eq('TEST-MAT-008 rock adder',   parseConduitPackage('BM60-R'),          null);

console.log('-- material qty is 1:1 with production, NOT multiplied by pull count --');
eq('TEST-MAT-010 500FT 3-pull -> 500 FT of SKU', conduitMaterialQty(500,'BM60(3)(1.25) T'), 500);
eq('TEST-MAT-011 500FT 1-pull -> 500 FT of SKU', conduitMaterialQty(500,'BM60(1)(1.25) T'), 500);
eq('TEST-MAT-012 300FT of 2-pull 2in -> 600 FT of single pipe', conduitMaterialQty(300,'BM60(2)(2) T'), 600);
console.log('-- total duct feet stays available as information --');
eq('TEST-MAT-013 500FT 3-pull -> 1500 duct FT', totalDuctFt(500,'BM60(3)(1.25) T'), 1500);
eq('TEST-MAT-014 500FT 1-pull -> 500 duct FT',  totalDuctFt(500,'BM60(1)(1.25) T'), 500);

console.log('== SPRINT 7: SPLICE BAND ==');
eq('TEST-SPLICE-001 band 1-24',   parseSpliceBand('HO-1 (1-24)'),         {lo:1,hi:24});
eq('TEST-SPLICE-002 band 25-48',  parseSpliceBand('HO-1 (25-48)'),        {lo:25,hi:48});
eq('TEST-SPLICE-003 band 73-144', parseSpliceBand('HO-1 (73 -144)'),      {lo:73,hi:144});
eq('TEST-SPLICE-004 open band',   parseSpliceBand('HO-1 (145 or above)'), {lo:145,hi:null});
eq('TEST-SPLICE-005 non-splice',  parseSpliceBand('BM60(3)(1.25) T'),     null);
eq('TEST-SPLICE-006 label open',  bandLabel({lo:145,hi:null}),            '145+');

console.log('-- band must match the fiber count, or the work is mispriced --');
eq('TEST-SPLICE-010 48 fibers in 25-48 band',  bandFits({lo:25,hi:48},48),  true);
eq('TEST-SPLICE-011 49 fibers in 25-48 band',  bandFits({lo:25,hi:48},49),  false);
eq('TEST-SPLICE-012 24 fibers in 25-48 band',  bandFits({lo:25,hi:48},24),  false);
eq('TEST-SPLICE-013 288 fibers in 145+ band',  bandFits({lo:145,hi:null},288), true);
eq('TEST-SPLICE-014 100 fibers in 145+ band',  bandFits({lo:145,hi:null},100), false);
eq('TEST-SPLICE-015 no fiber count -> no claim',bandFits({lo:25,hi:48},null), true);

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
