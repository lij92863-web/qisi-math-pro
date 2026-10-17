const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const source='C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统',out='C:/Users/Administrator/AppData/Local/Temp/qisi-stage28-maintenance';
const {chromium}=require(path.join(source,'node_modules/playwright'));
(async()=>{
 const server=http.createServer((req,res)=>res.end('<!doctype html>')); await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),report={date:'2026-10-01',paidCalls:0,scope:'Native IDB fixture only. Bulk write/update includes transaction and derived hooks/index maintenance; schema upgrade includes reopening plus backfill/index creation. Serialized UTF8 size is not physical disk space.',writes:[],upgrades:[]};
 try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
  for(const name of ['vendor/dexie/dexie.min.js','qisi-question-duplicate-policy.js','qisi-question-index-storage.js'])await page.addScriptTag({path:path.join(source,name)});
  for(let round=0;round<3;round++)for(const mode of round%2?['indexed','plain']:['plain','indexed']){
   const row=await page.evaluate(async({mode,round})=>{
    const name='isolated-index-write-cost-'+mode+'-'+round,db=new Dexie(name);
    db.version(8).stores({questions:'id',draftQuestions:'id,batchId'});
    if(mode==='indexed')Qisi.QuestionIndexStorage.configure(db,{policy:Qisi.QuestionDuplicatePolicy});await db.open();
    try{
     const rows=Array.from({length:5000},(_,i)=>({id:'q-'+i,stem:'Question '+i+' '+ 'x'.repeat(96),options:['A','B','C','D'],answer:'A',solution:'s'.repeat(96),rawText:'kept raw'}));
     let start=performance.now();await db.questions.bulkPut(rows);const insertMs=performance.now()-start;
     start=performance.now();await db.questions.toCollection().modify({solution:'updated solution'});const updateMs=performance.now()-start;
     const stored=await db.questions.toArray();
     return{mode,round,n:rows.length,insertMs,updateMs,count:stored.length,serializedBytes:new TextEncoder().encode(JSON.stringify(stored)).length};
    }finally{db.close();await Dexie.delete(name);}
   },{mode,round});assert.equal(row.count,5000);report.writes.push(row);console.log(JSON.stringify(row));
  }
  for(let round=0;round<3;round++){
   const row=await page.evaluate(async round=>{
    const name='isolated-index-upgrade-cost-'+round,old=new Dexie(name);
    old.version(8).stores({questions:'id',draftQuestions:'id,batchId'});await old.open();
    await old.questions.bulkPut(Array.from({length:10000},(_,i)=>({id:'old-'+i,stem:'Legacy question '+i+' '+ 'x'.repeat(96),options:['A','B','C','D'],solution:'keep solution',rawText:'raw'})));old.close();
    const db=new Dexie(name);db.version(8).stores({questions:'id',draftQuestions:'id,batchId'});Qisi.QuestionIndexStorage.configure(db,{policy:Qisi.QuestionDuplicatePolicy});
    try{const start=performance.now();await db.open();const elapsedMs=performance.now()-start;return{round,n:10000,elapsedMs,version:db.verno,rows:await db.questions.count(),indexedRows:await db.questions.where('duplicateCoreV2').above('').count()};}
    finally{db.close();await Dexie.delete(name);}
   },round);assert.equal(row.version,9);assert.equal(row.rows,10000);assert.equal(row.indexedRows,10000);report.upgrades.push(row);console.log(JSON.stringify(row));
  }
  fs.writeFileSync(path.join(out,'native-write-upgrade-metrics.json'),JSON.stringify(report,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
