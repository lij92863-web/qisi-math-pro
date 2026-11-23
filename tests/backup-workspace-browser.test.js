const test=require('node:test'),assert=require('node:assert/strict');
const {startBrowserApp,assertNoRuntimeErrors}=require('./e2e/browser-harness');
globalThis.JSZip=require('../vendor/jszip/jszip.min');require('../qisi-archive-security');const Backup=require('../qisi-backup');

test('legacy handouts and recovered edits round-trip in the same native backup', { timeout: 45000 }, async () => {
 const h = await startBrowserApp(33015);
 try {
  await h.page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy')?.databaseStatus === '');
  await h.page.evaluate(async () => {
   const legacy = new Dexie('QisiHandoutStudio'); legacy.version(1).stores({ entries: 'id' });
   const doc = Qisi.HandoutDocument.create();
   Object.assign(doc, { id: 'old', name: '搬迁测试', updatedAt: 1 });
   doc.blocks = [Qisi.HandoutDocument.block('text', { text: '旧讲义原文' })];
   try {
    await legacy.table('entries').bulkPut([{ id: 'doc:old', value: doc },
     { id: 'workspace', value: { current: 'old', saved: [{ id: 'old', name: doc.name, updatedAt: 1 }] } }]);
    await db.table('localSettings').delete('handout-storage-migrated');
   } finally { legacy.close(); }
  });
  await h.page.reload();
  await h.page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy')?.databaseStatus === '');
  assert.equal(await h.page.evaluate(async () => (await Qisi.HandoutDocument.store.get('doc:old')).name), '搬迁测试');
  await h.page.evaluate(async () => {
   const doc = await Qisi.HandoutDocument.store.get('doc:old');
   doc.name = '关页前的最后一次编辑'; doc.updatedAt = 2;
   if (!Qisi.HandoutDocument.recordPending(doc)) throw Error('checkpoint');
  });
  await h.page.reload();
  await h.page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy')?.databaseStatus === '');
  const result = await h.page.evaluate(async () => {
   const { Backup, HandoutDocument, StorageRepository } = Qisi;
   const fresh = await Backup.createFullDatabaseBackup(db);
   const parsed = await Backup.readFullDatabaseBackupBlob(fresh.blob);
   const saved = parsed.backup.tables.handoutEntries.find(row => row.id === 'doc:old');
   await HandoutDocument.store.remove('old');
   const repository = StorageRepository.createRepository(db);
   await repository.restoreBackup(parsed.backup, { expectedSnapshot: await Backup.snapshotDatabase(db) });
   const restored = await HandoutDocument.store.get('doc:old');
   await repository.restoreBackup({ ...parsed.backup, tables: { questions: [] } });
   return { name: restored.name, saved: saved.value.name, blocks: restored.blocks.length,
    localOnly: Object.hasOwn(parsed.backup.tables, 'localSettings'), preserved: Boolean(await HandoutDocument.store.get('doc:old')) };
  });
  assert.deepEqual(result, { name: '关页前的最后一次编辑', saved: '关页前的最后一次编辑', blocks: 1, localOnly: false, preserved: true });
  assertNoRuntimeErrors(h);
 } finally { await h.close(); }
});

test('a real IndexedDB directory handle resumes automatic backup on reload', { timeout: 45000 }, async () => {
 const h = await startBrowserApp(33019);
 try {
  await h.page.addInitScript(() => {
   window.showDirectoryPicker = async () => {
    sessionStorage.setItem('pickerCount', String(Number(sessionStorage.getItem('pickerCount') || 0) + 1));
    return (await navigator.storage.getDirectory()).getDirectoryHandle('backup-reopen', { create: true });
   };
  });
  await h.page.reload();
  await h.page.waitForFunction(() => window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')?.databaseStatus === '');
  assert.equal(await h.page.evaluate(async () => {
   const result = await Qisi.Runtime.getRuntimeDependency('AppProxy').backupWorkspace.chooseFolder();
   return result.ok && Boolean((await db.table('localSettings').get('backup-folder'))?.value?.folder);
  }), true);
  await h.page.reload();
  await h.page.waitForFunction(() => window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')?.backupStatus.automatic === true);
  const result = await h.page.evaluate(() => {
   const state = Qisi.Runtime.getRuntimeDependency('AppProxy').backupStatus;
   return { ready: state.folderReady, name: state.folderName, count: Number(sessionStorage.getItem('pickerCount')), timestamp: state.lastBackupAt };
  });
  assert.deepEqual({ ready: result.ready, name: result.name, count: result.count }, { ready: true, name: 'backup-reopen', count: 1 });
  assert.ok(result.timestamp > 0);
  assertNoRuntimeErrors(h);
 } finally { await h.close(); }
});

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
  await page.getByRole('button',{name:'个人知识点与备份',exact:true}).click();
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
  const {page}=harness;
  await page.getByRole('button',{name:'个人知识点与备份',exact:true}).click();
  await page.getByTestId('restore-file').setInputFiles({name:'broken.zip',mimeType:'application/zip',buffer:Buffer.from('not-a-zip')});
  await page.getByRole('alert').filter({hasText:'有效的备份压缩包'}).waitFor();assert.equal(await page.getByTestId('restore-preview').count(),0);
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
