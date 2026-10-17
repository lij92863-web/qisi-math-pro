const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root='C:/Users/Administrator/Desktop/题库系统',out='C:/Users/Administrator/AppData/Local/Temp/qisi-desktop-sync-2026-09-30';
const {chromium}=require(path.join(root,'node_modules/playwright'));
const {makeDraft}=require(path.join(root,'tests/fixtures/formal-admission-transaction'));
(async()=>{const browser=await chromium.launch({headless:true});try{
 const context=await browser.newContext();await context.route('**/api/ai/**',r=>r.abort());await context.route(/^https:/,r=>r.abort());const page=await context.newPage();await page.goto('http://127.0.0.1:3000/main.html');await page.waitForFunction(()=>window.Qisi?.Runtime?.getRuntimeDependency('AppProxy'));
 const samples=[];for(let round=0;round<3;round++)for(const n of (round%2?[10000,1000]:[1000,10000])){
  const m=20;
  const result=await page.evaluate(async({n,m,round,fixture})=>{
   const name=`isolated-formal-measure-${n}-${round}`,database=new Dexie(name);const schema=Object.fromEntries(Qisi.StorageRepository.BACKUP_TABLES.map(t=>[t,t==='draftQuestions'?'id,batchId': 'id']));database.version(1).stores(schema);await database.open();
   try{
    await database.questions.bulkPut(Array.from({length:n},(_,i)=>({id:`existing-${i}`,stem:`既有题目${i}`,options:['1','2','3','4'],answer:'A'})));
    const drafts=Array.from({length:m},(_,i)=>({...fixture,id:`draft-${i}`,stem:`待确认新题${i}`,questionNumber:String(i+1)}));await database.draftQuestions.bulkPut(drafts);await database.draftImportBatches.put({id:'batch-1',submittedCount:0});
    let reads=0,readRows=0,readMs=0,cpuMs=0,scanCalls=0;const tablePrototype=Object.getPrototypeOf(database.questions),originalRead=tablePrototype.toArray;
    tablePrototype.toArray=function(...args){const start=performance.now();return originalRead.apply(this,args).then(rows=>{if(this.name==='questions'){reads++;readRows+=rows.length;readMs+=performance.now()-start;}return rows;});};
    const policy=Qisi.FormalAdmissionPolicy;const repo=Qisi.StorageRepository.createRepository(database,{admission:{evaluateDraftAdmission:policy.evaluateDraftAdmission,validateAdmissionDecision:policy.validateAdmissionDecision,buildQuestionV2:policy.buildQuestionV2,validateQuestionV2:Qisi.RecognitionContracts.validateQuestionV2},duplicatePolicy:{evaluate:input=>{scanCalls++;const start=performance.now();const r=Qisi.QuestionDuplicatePolicy.evaluate(input);cpuMs+=performance.now()-start;return r;}}});
    const start=performance.now();for(let i=0;i<m;i++){const requestId=`request-${i}`,ctx=policy.createAdmissionContext({mode:'pdf-ai',actorId:'isolated-benchmark',explicitConfirmation:true,requestId,idempotencyKey:requestId,evaluatedAt:new Date().toISOString(),source:{sourceId:'source-1',batchId:'batch-1'}});await repo.confirmDraftToQuestion(drafts[i].id,policy.evaluateDraftAdmission(drafts[i],ctx),{expectedDraftVersion:1,idempotencyKey:requestId,actorId:'isolated-benchmark',requestId,questionId:`formal-${i}`,context:ctx});}
    const elapsedMs=performance.now()-start;const count=await database.questions.count();return {n,m,round,elapsedMs,reads,readRows,readMs,cpuMs,scanCalls,count};
   }finally{database.close();await Dexie.delete(name);}
  },{n,m,round,fixture:makeDraft()});
  assert.equal(result.count,n+m);assert.equal(result.scanCalls,m);assert.equal(result.reads,m);assert.equal(result.readRows,m*n+m*(m-1)/2);samples.push(result);
 }
 const report={scope:'Production formal repository boundary with native IndexedDB: decision to commit; excludes UI workflow reloads/render, AI/OCR, seed setup and user data.',date:'2026-10-01',root,paidCalls:0,samples};fs.writeFileSync(path.join(out,'formal-boundary-metrics.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
