const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const Snapshot=require('../qisi-backup-snapshot-policy'),Storage=require('../qisi-storage-repository');
const {FakeDatabase}=require('./storage-test-harness');
const tables=()=>Object.fromEntries(Storage.BACKUP_TABLES.map(name=>[name,[]]));
test('snapshot guard compares metadata, typed bytes and exact same-length Blob contents',async()=>{
 const source={x:undefined,n:NaN,rows:[{id:'q',blob:new Blob(['abc'])}],bytes:new Uint8Array([1,2])};
 assert.equal(await Snapshot.assertSameSnapshot(source,structuredClone(source)),true);
 for(const edit of [value=>value.rows[0].id='other',value=>value.rows[0].blob=new Blob(['abd']),value=>value.bytes[1]=3,value=>delete value.x,value=>value.n=null]){
  const changed=structuredClone(source);edit(changed);await assert.rejects(()=>Snapshot.assertSameSnapshot(source,changed),{code:'BACKUP_LIVE_DATA_CHANGED'});
 }
 await assert.rejects(()=>Snapshot.assertSameSnapshot({unsupported:new Map([['a',1]])},{unsupported:new Map([['a',2]])}),{code:'BACKUP_LIVE_DATA_CHANGED'});
});
test('guarded restore rejects concurrent data changes before any existing rows are cleared',async()=>{
 const database=new FakeDatabase({questions:[{id:'q',stem:'current'}],images:[{id:'i',blob:new Blob(['abc'])}]});
 const repository=Storage.createRepository(database,{waitFor:work=>work}),saved=(await repository.createBackup()).tables;
 await database.table('images').put({id:'i',blob:new Blob(['abd'])});
 const incoming={schemaVersion:Storage.BACKUP_SCHEMA_VERSION,tables:tables()};incoming.tables.questions=[{id:'old',stem:'older'}];
 await assert.rejects(()=>repository.restoreBackup(incoming,{expectedSnapshot:saved}),{code:'restore-conflict'});
 assert.equal((await database.table('questions').get('q')).stem,'current');
 assert.equal(await (await database.table('images').get('i')).blob.text(),'abd');
 const fresh=(await repository.createBackup()).tables;await repository.restoreBackup(incoming,{expectedSnapshot:fresh});
 assert.equal(await database.table('questions').get('q'),undefined);assert.equal((await database.table('questions').get('old')).stem,'older');
});
test('real IndexedDB keeps restore transaction alive for binary comparison and rolls back on a changed snapshot',async()=>{
 const http=require('node:http'),{chromium}=require('playwright');
 const server=http.createServer((req,res)=>res.end('<!doctype html>'));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;try{
  browser=await chromium.launch({headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
  for(const file of ['vendor/dexie/dexie.min.js','qisi-backup-snapshot-policy.js','qisi-storage-repository.js','qisi-backup.js'])await page.addScriptTag({path:path.resolve(__dirname,'..',file)});
  const result=await page.evaluate(async()=>{
   const db=new Dexie('isolated-backup-restore');db.version(1).stores(Object.fromEntries(Qisi.StorageRepository.BACKUP_TABLES.map(name=>[name,'id'])));await db.open();
   const repository=Qisi.StorageRepository.createRepository(db),incoming={schemaVersion:'qisi.storage.v1',tables:{questions:[{id:'old',stem:'older'}]}};
   await db.questions.put({id:'q',stem:'current'});await db.images.put({id:'i',blob:new Blob([new Uint8Array(1024*1024+1)])});
   const snapshot=await Qisi.Backup.snapshotDatabase(db);await repository.restoreBackup(incoming,{expectedSnapshot:snapshot});
   const first=await db.questions.get('old'),next=await Qisi.Backup.snapshotDatabase(db);await db.questions.put({id:'new',stem:'concurrent'});
   let code;try{await repository.restoreBackup(incoming,{expectedSnapshot:next})}catch(error){code=error.code}
   const preserved=await db.questions.get('new');db.close();await Dexie.delete('isolated-backup-restore');return {first:first.stem,code,preserved:preserved.stem};
  });assert.deepEqual(result,{first:'older',code:'restore-conflict',preserved:'concurrent'});
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
});


test('N26 absent tables survive partial restore while explicit empty tables clear',async()=>{
 const database=new FakeDatabase({questions:[{id:'q'}],images:[{id:'i',blob:new Blob(['keep'])}],customTemplates:[{id:'t'}]});
 const repository=Storage.createRepository(database,{waitFor:work=>work});
 await repository.restoreBackup({schemaVersion:Storage.BACKUP_SCHEMA_VERSION,tables:{questions:[]}});
 assert.equal((await database.table('questions').toArray()).length,0);
 assert.equal(await (await database.table('images').get('i')).blob.text(),'keep');assert.equal((await database.table('customTemplates').get('t')).id,'t');
});
