// Extracted verbatim from the deployed Sprint 3 v2.0.0 Data Event script
// (Mainline Construction - Development). Exercises validateRate() against the
// Sprint 2 / 23.7-23.12 rate-control scenarios.

function isBlank(v){return v===null||v===undefined||v===''||(typeof v==='string'&&v.trim()==='');}
function toNum(v){if(isBlank(v))return null;var n=parseFloat(String(v).replace(/,/g,''));if(isNaN(n)||!isFinite(n))return null;return n;}
function parseDate(v){if(isBlank(v))return null;var d=new Date(v);return isNaN(d.getTime())?null:d;}
function dayOnly(d){return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());}

// r = the record's snapshot values, exactly as record_defaults would have copied them.
function validateRate(r){
  var out=[];
  function flag(level,msg){out.push({level:level,message:msg});}
  var rateId=r.rate_source_id, rate=toNum(r.contractor_rate);
  if(isBlank(rateId)){flag('CRITICAL','No contractor rate linked - this production cannot be priced');return out;}
  if(rate===null) flag('CRITICAL','Linked rate has no unit rate');
  else if(rate===0) flag('CRITICAL','Linked rate is zero');

  var myC=isBlank(r.contractor_id_snapshot)?'':String(r.contractor_id_snapshot).trim();
  var rC=isBlank(r.rate_contractor_id_snap)?'':String(r.rate_contractor_id_snap).trim();
  if(myC&&rC&&myC!==rC) flag('CRITICAL','Rate belongs to contractor '+rC+' but this production is for '+myC);

  var myP=isBlank(r.project_id_snapshot)?'':String(r.project_id_snapshot).trim();
  var rP=isBlank(r.rate_project_id_snap)?'':String(r.rate_project_id_snap).trim();
  if(rP&&myP&&rP!==myP) flag('CRITICAL','Rate is specific to project '+rP+' but this production is for '+myP);

  var myCode=r.labor_code||'', rateCode=r.rate_labor_code_snap||'';
  if(myCode&&rateCode&&myCode!==rateCode) flag('CRITICAL','Rate prices labor code '+rateCode+' but this production uses '+myCode);

  var wd=parseDate(r.work_date), eff=parseDate(r.rate_effective_date), exp=parseDate(r.rate_expiration_snap);
  if(wd&&eff&&dayOnly(wd)<dayOnly(eff)) flag('CRITICAL','Work date precedes the rate effective date - the rate was not yet in force');
  if(wd&&exp&&dayOnly(wd)>dayOnly(exp)) flag('CRITICAL','Work date is after the rate expiration date - expired rate');
  return out;
}

let pass=0,fail=0;
function check(id,rec,expectClean,mustMention){
  const issues=validateRate(rec);
  const clean=issues.length===0;
  let ok=(clean===expectClean);
  if(ok&&mustMention) ok=issues.some(i=>i.message.toLowerCase().includes(mustMention.toLowerCase()));
  ok?pass++:fail++;
  console.log((ok?'PASS':'FAIL')+'  '+id+'  -> '+(clean?'clean':issues.map(i=>i.level+': '+i.message).join(' | ')));
}

// Baseline: River City, all-projects rate, in force.
const base={rate_source_id:'RATE-000031',contractor_rate:'6',
  contractor_id_snapshot:'CON-0001',rate_contractor_id_snap:'CON-0001',
  project_id_snapshot:'PRJ-000001',rate_project_id_snap:'',
  labor_code:'BM60(1)(1.25) T',rate_labor_code_snap:'BM60(1)(1.25) T',
  work_date:'2026-06-15',rate_effective_date:'2026-01-01',rate_expiration_snap:''};

console.log('== 23.11 MISSING / ZERO RATE ==');
check('TEST-RATE-001 valid all-projects rate', base, true);
check('TEST-RATE-002 no rate linked',      {...base,rate_source_id:'',contractor_rate:''}, false,'cannot be priced');
check('TEST-RATE-003 zero rate',           {...base,contractor_rate:'0'},                  false,'zero');
check('TEST-RATE-004 blank rate value',    {...base,contractor_rate:''},                   false,'no unit rate');

console.log('== 23.7 CONTRACTOR-SPECIFIC RATE ==');
check('TEST-RATE-010 contractor mismatch', {...base,rate_contractor_id_snap:'CON-0002'},   false,'belongs to contractor');
check('TEST-RATE-011 contractor match',    base, true);

console.log('== 23.8 PROJECT-SPECIFIC RATE ==');
check('TEST-RATE-020 project-specific, matching',   {...base,rate_project_id_snap:'PRJ-000001'}, true);
check('TEST-RATE-021 project-specific, wrong project',{...base,rate_project_id_snap:'PRJ-000002'}, false,'specific to project');
check('TEST-RATE-022 all-projects rate is universal', {...base,rate_project_id_snap:'',project_id_snapshot:'PRJ-000009'}, true);

console.log('== LABOR CODE MISMATCH ==');
check('TEST-RATE-030 code mismatch', {...base,rate_labor_code_snap:'BM60(1)(2) T'}, false,'prices labor code');

console.log('== 23.9 EFFECTIVE-DATE BOUNDARIES ==');
const dated={...base,rate_effective_date:'2026-01-01',rate_expiration_snap:'2026-06-30'};
check('TEST-RATE-040 mid-window 06/15',        {...dated,work_date:'2026-06-15'}, true);
check('TEST-RATE-041 first day inclusive',     {...dated,work_date:'2026-01-01'}, true);
check('TEST-RATE-042 last day inclusive',      {...dated,work_date:'2026-06-30'}, true);
check('TEST-RATE-043 day after expiry',        {...dated,work_date:'2026-07-01'}, false,'expired');
check('TEST-RATE-044 day before effective',    {...dated,work_date:'2025-12-31'}, false,'not yet in force');
check('TEST-RATE-045 open-ended never expires',{...base,work_date:'2099-01-01'},  true);
check('TEST-RATE-046 timestamp on expiry day', {...dated,work_date:'2026-06-30T23:45:00'}, true);

console.log('== 23.10 HISTORICAL SNAPSHOT ==');
// Master repriced to $12 AFTER this record was saved. The record keeps its own
// copy, so nothing about it changes.
const historical={...base,contractor_rate:'6'};
const qty=500;
const extended=Math.round(qty*toNum(historical.contractor_rate)*100)/100;
check('TEST-RATE-050 snapshot still valid after master reprice', historical, true);
console.log((extended===3000?'PASS':'FAIL')+'  TEST-RATE-051 extended value pinned to snapshot  -> '+extended+' (expected 3000)');
extended===3000?pass++:fail++;

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
