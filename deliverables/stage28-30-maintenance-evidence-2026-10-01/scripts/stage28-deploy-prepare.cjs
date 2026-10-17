const fs=require('node:fs'),path=require('node:path');
const here=__dirname,out='C:/Users/Administrator/AppData/Local/Temp/qisi-stage28-maintenance';
let s=fs.readFileSync(path.join(here,'stage27-deploy.cjs'),'utf8').replaceAll('qisi-stage27-stats','qisi-stage28-maintenance');
s=s.replace("'c6ce988926dd80c6a7bed218083939ff9cc98dce'", "'e522a7098e6fa3373c8fd4cb6c3851d528322d13'")
 .replace("'87c0c674132be63d661c10634c0e4eb522f9f550'", "'21ac97fb005fd78c215a6fcd916acc4bf61f0493'");
s=s.replace(/const files = \[[^;]*;/,"const files = JSON.parse(fs.readFileSync(path.join(out, 'allowed.json')));");
fs.writeFileSync(path.join(here,'stage28-deploy.cjs'),s);
s=fs.readFileSync(path.join(here,'stage27-desktop-acceptance.cjs'),'utf8').replaceAll('qisi-stage27-stats','qisi-stage28-maintenance');
s=s.replace("const response=await page.goto", "page.on('dialog',dialog=>dialog.accept());\n  const response=await page.goto");
s=s.replace('vue:Vue.version,katex:katex.version,','schemaVersion:db.verno,indexStorage:typeof Qisi.QuestionIndexStorage.configure,coreKey:Qisi.QuestionDuplicatePolicy.canonicalCoreFingerprint({stem:"a__b",options:[]}),vue:Vue.version,katex:katex.version,');
s=s.replace("assert.equal(report.modules.statsPort,'function');", "assert.equal(report.modules.schemaVersion,9);assert.equal(report.modules.indexStorage,'function');assert.equal(report.modules.coreKey,'qisi-core-v2:[\"a__b\",[]]');assert.equal(report.modules.statsPort,'function');");
s=s.replace("['/qisi-backup-snapshot-policy.js',200]", "['/qisi-question-index-storage.js',200],['/qisi-backup-snapshot-policy.js',200]");
s=s.replace("  await page.screenshot({path:path.join(out,'desktop-acceptance.png'),fullPage:true});",`  await page.screenshot({path:path.join(out,'desktop-acceptance.png'),fullPage:true});
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
  assert.equal(report.legacyPackage.previewCount,2);assert.equal(report.legacyPackage.importCount,2);assert.notEqual(...report.legacyPackage.keys);
  assert.deepEqual(report.legacyPackage.keys,report.legacyPackage.exportKeys);assert.equal(report.legacyPackage.legacyFieldsRemoved,true);assert.equal(report.legacyPackage.formalCount,0);assert.equal(report.legacyPackage.exportSchema,'1.0');assert.deepEqual(report.legacyPackage.raw,['raw-a','raw-b']);
`);
fs.writeFileSync(path.join(here,'stage28-desktop-acceptance.cjs'),s);
