const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root='C:/Users/Administrator/Desktop/题库系统',out='C:/Users/Administrator/AppData/Local/Temp/qisi-stage28-maintenance';
const {chromium}=require(path.join(root,'node_modules/playwright'));
const origin='http://127.0.0.1:3000';
(async()=>{
 const report={date:'2026-10-01',root,origin,isolatedBrowser:true,paidCalls:0,errors:[],consoleErrors:[],blockedRequests:[],navigation:[],sri:[],http:[]};
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({acceptDownloads:true});
  await context.route('**/api/ai/**',async r=>{report.blockedRequests.push(r.request().url());await r.abort();});
  await context.route(/^https?:\/\/(?!127\.0\.0\.1:3000\/)/,async r=>{report.blockedRequests.push(r.request().url());await r.abort();});
  context.on('page',p=>{p.on('pageerror',e=>report.errors.push(String(e)));p.on('console',e=>{if(e.type()==='error')report.consoleErrors.push({text:e.text(),location:e.location()});});});
  const page=await context.newPage();
  report.dialogs=[];page.on('dialog',dialog=>{report.dialogs.push(dialog.message());return dialog.accept();});
  const response=await page.goto(origin+'/main.html');assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.Qisi?.Runtime?.getRuntimeDependency('AppProxy'));
  report.modules=await page.evaluate(()=>({schemaVersion:db.verno,indexStorage:typeof Qisi.QuestionIndexStorage.configure,coreKey:Qisi.QuestionDuplicatePolicy.canonicalCoreFingerprint({stem:"a__b",options:[]}),vue:Vue.version,katex:katex.version,backup:typeof Qisi.Backup?.readFullDatabaseBackupBlob,snapshot:typeof Qisi.BackupSnapshotPolicy,workspace:typeof Qisi.BackupWorkspace?.createBackupWorkspace,pdf:pdfjsLib.version,reviewRead:typeof Qisi.DraftPersistenceService.reloadDraftReview,repositoryRead:typeof Qisi.StorageRepository.createRepository(db).loadDraftReview,statsPort:typeof Qisi.DraftPersistenceService.refreshDraftBatchStats,repositoryStats:typeof Qisi.StorageRepository.createRepository(db).refreshDraftBatchStats}));
  assert.equal(report.modules.schemaVersion,9);assert.equal(report.modules.indexStorage,'function');assert.equal(report.modules.coreKey,'qisi-core-v2:["a__b",[]]');assert.equal(report.modules.statsPort,'function');assert.equal(report.modules.repositoryStats,'function');assert.equal(report.modules.reviewRead,'function');assert.equal(report.modules.repositoryRead,'function');assert.equal(report.modules.vue,'3.4.27');assert.equal(report.modules.katex,'0.16.47');assert.equal(report.modules.workspace,'function');assert.equal(report.modules.backup,'function');
  const assets=await page.locator('[integrity]').evaluateAll(nodes=>nodes.map(n=>({url:n.src||n.href,integrity:n.integrity})));
  for(const a of assets){const r=await context.request.get(a.url);assert.equal(r.status(),200);const digest='sha384-'+crypto.createHash('sha384').update(await r.body()).digest('base64');assert.equal(digest,a.integrity);report.sri.push({url:a.url,valid:true});}
  for(const name of ['新题目录入','批量录题','题库与检索','智能组卷台','个人管理','极客排版配置']){const b=page.getByRole('button',{name,exact:true});await b.click();await page.waitForFunction(label=>[...document.querySelectorAll('nav button')].some(n=>n.textContent.trim()===label&&n.classList.contains('active')),name);report.navigation.push({name,active:true});}
  await page.getByRole('button',{name:'题库与检索',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'下载完整备份',exact:true}).click();const download=await downloadPromise;
  const downloaded=path.join(out,'isolated-empty-database-backup.zip');await download.saveAs(downloaded);
  const bytes=fs.readFileSync(downloaded);report.backup={filename:download.suggestedFilename(),bytes:bytes.length};
  await page.getByTestId('restore-file').setInputFiles({name:'isolated-fixture.zip',mimeType:'application/zip',buffer:bytes});await page.getByTestId('restore-preview').waitFor();
  report.backup.preview=true;report.backup.confirmDisabled=await page.getByTestId('restore-confirm').isDisabled();assert.equal(report.backup.confirmDisabled,true);
  await page.screenshot({path:path.join(out,'desktop-acceptance.png'),fullPage:true});
  report.legacyPackage=await page.evaluate(async()=>{
   const app=Qisi.Runtime.getRuntimeDependency('AppProxy');
   const raw=[{id:'legacy-a',stem:'a__b',options:[],answer:'1',type:'填空题',images:[],exportFingerprint:'a__b__',rawText:'raw-a'},
              {id:'legacy-b',stem:'a',options:['b__'],answer:'2',type:'填空题',images:[],exportFingerprint:'a__b__',rawText:'raw-b'}];
   const zip=new JSZip();zip.file('manifest.json',JSON.stringify({schemaVersion:'1.0',packageType:'qisi-question-bank',createdBy:{name:'isolated-legacy'}}));zip.file('questions.json',JSON.stringify(raw));
   const file=new File([await zip.generateAsync({type:'blob'})],'legacy-fixture.zip',{type:'application/zip'});
   await app.handleImportBankFileChange({target:{files:[file],value:''}});
   const previewCount=app.pendingImportPreview?.rawQuestions.length;
   await app.confirmImportBankPreview();
   const imported=await db.externalQuestions.toArray();
   const plan=await Qisi.ExportService.createExportService({coreFingerprint:Qisi.QuestionDuplicatePolicy.canonicalCoreFingerprint,stemFingerprint:Qisi.QuestionDuplicatePolicy.canonicalStemFingerprint}).build(raw);
   return{previewCount,importCount:imported.length,keys:imported.map(q=>q.sourceFingerprint),legacyFieldsRemoved:imported.every(q=>q.exportFingerprint===undefined),
    raw:imported.map(q=>q.rawText),formalCount:await db.questions.count(),exportSchema:plan.manifest.schemaVersion,exportKeys:plan.questions.map(q=>q.exportFingerprint)};
  });
  console.log(JSON.stringify({legacyPackage:report.legacyPackage,errors:report.errors,consoleErrors:report.consoleErrors,dialogs:report.dialogs}));
  assert.equal(report.legacyPackage.previewCount,2);assert.equal(report.legacyPackage.importCount,2);assert.notEqual(...report.legacyPackage.keys);
  assert.deepEqual(report.legacyPackage.keys,report.legacyPackage.exportKeys);assert.equal(report.legacyPackage.legacyFieldsRemoved,true);assert.equal(report.legacyPackage.formalCount,0);assert.equal(report.legacyPackage.exportSchema,'1.0');assert.deepEqual(report.legacyPackage.raw,['raw-a','raw-b']);

  await page.evaluate(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');app.questions=[{id:'isolated-print-fixture',type:'填空题',grade:'高三',stem:'计算 $\\frac{1}{2}+\\frac{1}{2}$',answer:'$1$',solution:'相加得 $1$',images:[]}];app.cart=['isolated-print-fixture'];app.exportMode='withAnswers';});
  const popupPromise=context.waitForEvent('page');await page.evaluate(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').printExam());const printPage=await popupPromise;
  await printPage.waitForFunction(()=>document.getElementById('printBtn')?.disabled===false);await printPage.evaluate(()=>document.fonts.ready);
  report.print={stylesheet:await printPage.locator('link[rel="stylesheet"]').getAttribute('href'),mathCount:await printPage.locator('.katex').count(),ready:true};assert.equal(report.print.stylesheet,origin+'/vendor/katex/katex.min.css');assert.ok(report.print.mathCount>=3);
  await printPage.screenshot({path:path.join(out,'desktop-print-acceptance.png'),fullPage:true});await printPage.close();
  for(const [url,status] of [['/qisi-question-index-storage.js',200],['/qisi-backup-snapshot-policy.js',200],['/qisi-backup-workspace.js',200],['/qisi-local-server.js',404],['/package.json',404],['/.env',404],['/tmp/uploads/private.docx',404]]){const r=await context.request.get(origin+url);assert.equal(r.status(),status);report.http.push({url,status});}
  const foreign=await context.request.get(origin+'/api/health',{headers:{Origin:'https://example.com'}});assert.equal(foreign.status(),403);report.http.push({foreignOrigin:403});
  const first=await context.request.get(origin+'/qisi-backup-workspace.js');const etag=first.headers().etag;assert.ok(etag);const revalidated=await context.request.get(origin+'/qisi-backup-workspace.js',{headers:{'If-None-Match':etag}});assert.equal(revalidated.status(),304);report.http.push({etagRevalidate:304});
  fs.writeFileSync(path.join(out,'desktop-acceptance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.consoleErrors,[]);assert.deepEqual(report.blockedRequests,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
