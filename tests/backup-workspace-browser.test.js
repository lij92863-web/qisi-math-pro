const test=require('node:test'),assert=require('node:assert/strict');
const {startBrowserApp,assertNoRuntimeErrors}=require('./e2e/browser-harness');
globalThis.JSZip=require('../vendor/jszip/jszip.min');require('../qisi-archive-security');const Backup=require('../qisi-backup');
test('backup UI validates archives, requires consent and protects current data before native IndexedDB restore',{timeout:60000},async()=>{
 const harness=await startBrowserApp(32461),writes=[];
 try{
  const {page}=harness;await page.exposeFunction('captureFixtureBackup',async(name,bytes)=>writes.push({name,blob:new Blob([Buffer.from(bytes)],{type:'application/zip'})}));
  await page.addInitScript(()=>{
   const files=new Map();window.showDirectoryPicker=async()=>({name:'测试备份目录',getFileHandle:async(name,options)=>{
    if(!files.has(name)&&!options?.create)throw new DOMException('missing','NotFoundError');
    if(!files.has(name))files.set(name,null);
    return {createWritable:async()=>{if(files.get(name))throw Error('attempted overwrite');let blob;return {write:async data=>{blob=data},close:async()=>{files.set(name,blob);await window.captureFixtureBackup(name,Array.from(new Uint8Array(await blob.arrayBuffer())))},abort:async()=>{}}}};
   }});
  });
  await page.reload();await page.waitForFunction(()=>window.Qisi?.Runtime?.getRuntimeDependency('AppProxy'));
  const bytes=await page.evaluate(async()=>{
   await db.open();await db.questions.put({id:'restore-ui-q',stem:'$x^2$',type:'填空题',grade:'高三',createdAt:1});
   const backup=await Qisi.Backup.createFullDatabaseBackup(db);
   await db.questions.put({id:'restore-ui-q',stem:'$y^2$',type:'填空题',grade:'高三',createdAt:1});
   return Array.from(new Uint8Array(await backup.blob.arrayBuffer()));
  });
  await page.getByRole('button',{name:'题库与检索',exact:true}).click();
  await page.getByTestId('restore-file').setInputFiles({name:'fixture.zip',mimeType:'application/zip',buffer:Buffer.from(bytes)});
  await page.getByTestId('restore-preview').waitFor();assert.equal(await page.getByTestId('restore-confirm').isDisabled(),true);
  await page.getByTestId('restore-consent').check();await page.getByTestId('restore-word').fill('wrong');assert.equal(await page.getByTestId('restore-confirm').isDisabled(),true);
  await page.getByRole('button',{name:'选择备份文件夹',exact:true}).click();await page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').backupStatus.lastBackupAt>0);
  await page.getByTestId('restore-word').fill('恢复备份');assert.equal(await page.getByTestId('restore-confirm').isDisabled(),false);
  await Promise.all([page.waitForEvent('framenavigated',frame=>frame===page.mainFrame()),page.getByTestId('restore-confirm').click()]);
  await page.waitForFunction(()=>window.Qisi?.Runtime?.getRuntimeDependency('AppProxy'));
  assert.equal(await page.evaluate(async()=>{await db.open();return (await db.questions.get('restore-ui-q')).stem}),'$x^2$');
  const safety=writes.find(item=>item.name.includes('before-restore'));assert.ok(safety,'safety archive persisted before restore');
  const decoded=await Backup.readFullDatabaseBackupBlob(safety.blob);assert.equal(decoded.backup.tables.questions.find(q=>q.id==='restore-ui-q').stem,'$y^2$');
  assertNoRuntimeErrors(harness);
 }finally{await harness.close()}
});
test('corrupt restore files leave current data untouched and the manual backup download remains usable',{timeout:60000},async()=>{
 const harness=await startBrowserApp(32462);
 try{
  const {page}=harness;await page.getByRole('button',{name:'题库与检索',exact:true}).click();
  await page.getByTestId('restore-file').setInputFiles({name:'broken.zip',mimeType:'application/zip',buffer:Buffer.from('not-a-zip')});
  await page.getByRole('alert').filter({hasText:'操作未完成'}).waitFor();assert.equal(await page.getByTestId('restore-preview').count(),0);
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'下载完整备份',exact:true}).click();
  const download=await downloadPromise;assert.match(download.suggestedFilename(),/^qisi-full-backup-\d+\.zip$/);
  assertNoRuntimeErrors(harness);
 }finally{await harness.close()}
});

test('backup uses native completed transactions across windows and ignores aborted writes',{timeout:60000},async()=>{
 const harness=await startBrowserApp(32466);let second;
 try{
  const {page}=harness;
  await page.evaluate(async()=>{
   window.mutationFixture=new Dexie('BackupMutationBrowserFixture');mutationFixture.version(1).stores({questions:'id'});await mutationFixture.open();window.mutationCount=0;
   const state=new Proxy({}, {set(target,key,value){if(key==='pendingChanges'&&value===true)mutationCount++;target[key]=value;return true;}});
   window.mutationWorkspace=Qisi.BackupWorkspace.createBackupWorkspace({database:mutationFixture,mutationEvents:Dexie.on('storagemutated'),backup:{TABLE_NAMES:['questions']}},state);mutationWorkspace.start();
   try{await mutationFixture.transaction('rw',mutationFixture.questions,async()=>{await mutationFixture.questions.put({id:'aborted'});throw Error('abort fixture');});}catch(error){if(error.message!=='abort fixture')throw error;}
  });
  assert.equal(await page.evaluate(()=>mutationCount),0);
  await page.evaluate(()=>mutationFixture.questions.bulkPut([{id:'1'},{id:'2'},{id:'3'}]));
  assert.equal(await page.evaluate(()=>mutationCount),1,'one notification for a multi-row commit');
  second=await page.context().newPage();await second.goto(page.url());await second.waitForFunction(()=>window.Dexie&&window.Qisi?.BackupWorkspace);
  await second.evaluate(async()=>{window.otherMutationFixture=new Dexie('BackupMutationBrowserFixture');otherMutationFixture.version(1).stores({questions:'id'});await otherMutationFixture.open();await otherMutationFixture.questions.put({id:'other-window'});});
  await page.waitForFunction(()=>mutationCount===2);
  await page.evaluate(()=>mutationWorkspace.dispose());await second.evaluate(()=>otherMutationFixture.questions.put({id:'after-dispose'}));
  assert.equal(await page.evaluate(()=>mutationCount),2);
  assertNoRuntimeErrors(harness);
 }finally{await second?.close();await harness.close();}
});
