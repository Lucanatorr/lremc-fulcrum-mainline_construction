// Mirrors the CASE logic in reports/sequential-overlap.sql.
// Ranges are normalized first, so direction never affects the result.
function classify(a1,a2,b1,b2){
  const alo=Math.min(a1,a2), ahi=Math.max(a1,a2);
  const blo=Math.min(b1,b2), bhi=Math.max(b1,b2);
  if(alo>bhi||ahi<blo) return null;                     // no intersection at all
  if(alo===blo&&ahi===bhi) return {type:'EXACT DUPLICATE',sev:'CRITICAL'};
  if((alo>=blo&&ahi<=bhi)||(blo>=alo&&bhi<=ahi)) return {type:'CONTAINED',sev:'CRITICAL'};
  if(Math.min(ahi,bhi)-Math.max(alo,blo)===0) return {type:'ADJACENT',sev:'INFO'};
  return {type:'PARTIAL OVERLAP',sev:'WARNING'};
}
let pass=0,fail=0;
function eq(id,a,e){const ok=JSON.stringify(a)===JSON.stringify(e);ok?pass++:fail++;
  console.log((ok?'PASS':'FAIL')+'  '+id+'  got='+JSON.stringify(a)+(ok?'':'  want='+JSON.stringify(e)));}

console.log('== 23.4 SEQUENTIAL OVERLAP CLASSIFICATION ==');
// The spec's own worked examples, against existing 100000-105000.
eq('TEST-OVL-001 partial (104500-108000)', classify(100000,105000,104500,108000), {type:'PARTIAL OVERLAP',sev:'WARNING'});
eq('TEST-OVL-002 containment (101000-102000)', classify(100000,105000,101000,102000), {type:'CONTAINED',sev:'CRITICAL'});
eq('TEST-OVL-003 exact duplicate', classify(100000,105000,100000,105000), {type:'EXACT DUPLICATE',sev:'CRITICAL'});
eq('TEST-OVL-004 adjacent (105000-110000)', classify(100000,105000,105000,110000), {type:'ADJACENT',sev:'INFO'});
eq('TEST-OVL-005 fully disjoint', classify(100000,105000,106000,110000), null);
console.log('-- direction must not matter (both stored reversed) --');
eq('TEST-OVL-006 reversed partial', classify(105000,100000,108000,104500), {type:'PARTIAL OVERLAP',sev:'WARNING'});
eq('TEST-OVL-007 reversed exact',   classify(105000,100000,105000,100000), {type:'EXACT DUPLICATE',sev:'CRITICAL'});
eq('TEST-OVL-008 one reversed',     classify(100000,105000,102000,101000), {type:'CONTAINED',sev:'CRITICAL'});
eq('TEST-OVL-009 reversed adjacent',classify(105000,100000,110000,105000), {type:'ADJACENT',sev:'INFO'});
console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
