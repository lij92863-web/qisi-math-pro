const test=require('node:test'),assert=require('node:assert/strict');
globalThis.JSZip=require('../vendor/jszip/jszip.min');require('../qisi-archive-security');
const Backup=require('../qisi-backup');
const data=()=>Object.fromEntries(Backup.TABLE_NAMES.map(name=>[name,name==='questions'?[{id:'q1',stem:'$x^2$'}]:name==='images'?[{id:'img1',blob:new Blob(['image-bytes'],{type:'image/png'})}]:[{id:name+'1'}]]));
function db(rows){let inTransaction=false,transactions=0;return {name:'fixture',tables:Object.keys(rows).map(name=>({name})),get transactions(){return transactions},transaction:async(mode,tables,work)=>{assert.equal(mode,'r');assert.equal(tables.length,Object.keys(rows).length);transactions++;inTransaction=true;try{return await work()}finally{inTransaction=false}},table:name=>({toArray:async()=>{assert.equal(inTransaction,true);return rows[name]}})};}
async function mutate(blob,work){const zip=await JSZip.loadAsync(await blob.arrayBuffer());await work(zip);return new Blob([await zip.generateAsync({type:'uint8array',compression:'DEFLATE'})],{type:'application/zip'});}
test('all backup tables share one read transaction and full archive roundtrips images without downloads',async()=>{
 const database=db(data()),created=await Backup.createFullDatabaseBackup(database);
 assert.equal(database.transactions,1);assert.equal(created.manifest.verification.ok,true);
 const restored=await Backup.readFullDatabaseBackupBlob(created.blob);
 assert.deepEqual(restored.absentTables,[]);assert.deepEqual(Object.keys(restored.backup.tables),Backup.TABLE_NAMES);
 assert.equal(restored.backup.tables.questions[0].stem,'$x^2$');assert.equal(await restored.backup.tables.images[0].blob.text(),'image-bytes');
 assert.equal(restored.backup.tables.images[0].blob.type,'image/png');assert.equal(created.snapshot.images[0].blob instanceof Blob,true);
});
test('damage to any optional table, duplicate IDs and unlisted tables fails before restoration',async()=>{
 const {blob}=await Backup.createFullDatabaseBackup(db(data()));
 const changes=[
  zip=>zip.file('tables/customTemplates.json','not-json'),
  zip=>zip.file('tables/personalKnowledge.json',JSON.stringify([{id:'a'},{id:'a'}])),
  async zip=>{const manifest=JSON.parse(await zip.file('manifest.json').async('text'));manifest.tables.draftQuestions.count=2;zip.file('manifest.json',JSON.stringify(manifest));},
  zip=>zip.file('tables/unlisted.json','[]'),
  zip=>zip.file('tables/questions.json',JSON.stringify([{id:''}]))
 ];
 for(const change of changes){const bad=await mutate(blob,change);assert.equal((await Backup.verifyFullDatabaseBackupBlob(bad)).ok,false);await assert.rejects(()=>Backup.readFullDatabaseBackupBlob(bad));}
});
test('image bytes, sizes, counts and distinct file ownership are checked',async()=>{
 const {blob}=await Backup.createFullDatabaseBackup(db(data()));
 for(const change of [zip=>zip.remove('image-blobs/img1-0.png'),zip=>zip.file('image-blobs/img1-0.png','wrong-size')]){
  const bad=await mutate(blob,change);await assert.rejects(()=>Backup.readFullDatabaseBackupBlob(bad));
 }
 const rows=data();rows.images.push({id:'img2',blob:new Blob(['second'],{type:'image/png'})});
 const created=await Backup.createFullDatabaseBackup(db(rows));
 const duplicated=await mutate(created.blob,async zip=>{const images=JSON.parse(await zip.file('tables/images.json').async('text'));images[1].blobFile=images[0].blobFile;zip.file('tables/images.json',JSON.stringify(images));});
 await assert.rejects(()=>Backup.readFullDatabaseBackupBlob(duplicated));
});
test('older partial full backups explicitly report absent tables and long image IDs do not collide',async()=>{
 const rows=data(),prefix='same'.repeat(40);rows.images=[{id:prefix+'1',blob:new Blob(['first'],{type:'image/png'})},{id:prefix+'2',blob:new Blob(['second'],{type:'image/png'})}];
 const created=await Backup.createFullDatabaseBackup(db({questions:rows.questions,images:rows.images}));
 const read=await Backup.readFullDatabaseBackupBlob(created.blob);assert.equal(read.absentTables.length,Backup.TABLE_NAMES.length-2);assert.equal(await read.backup.tables.images[1].blob.text(),'second');
});
test('same-length binary damage fails CRC after archive limits have passed',async()=>{
 const {blob}=await Backup.createFullDatabaseBackup(db(data()));
 const zip=await JSZip.loadAsync(await blob.arrayBuffer());
 const bytes=await zip.generateAsync({type:'nodebuffer',compression:'STORE'});
 const index=bytes.indexOf(Buffer.from('image-bytes'));assert.ok(index>0);bytes[index]^=1;
 const corrupt=new Blob([bytes],{type:'application/zip'});
 assert.equal((await Backup.verifyFullDatabaseBackupBlob(corrupt)).ok,false);
 await assert.rejects(()=>Backup.readFullDatabaseBackupBlob(corrupt));
});
test('draft images and nested binary fields roundtrip instead of becoming empty JSON objects',async()=>{
 const rows=data();rows.draftImages[0].blob=new Blob(['draft-pixels'],{type:'image/jpeg'});
 rows.draftImportFiles[0].evidence={source:new Blob(['pdf-fixture'],{type:'application/pdf'})};
 const {blob}=await Backup.createFullDatabaseBackup(db(rows));
 const read=await Backup.readFullDatabaseBackupBlob(blob);
 assert.equal(await read.backup.tables.draftImages[0].blob.text(),'draft-pixels');
 assert.equal(await read.backup.tables.draftImportFiles[0].evidence.source.text(),'pdf-fixture');
 assert.equal(read.backup.tables.draftImportFiles[0].evidence.source.type,'application/pdf');
 const corrupt=await mutate(blob,async zip=>{const m=JSON.parse(await zip.file('manifest.json').async('text'));m.binaryFields[0].path=['__proto__','polluted'];zip.file('manifest.json',JSON.stringify(m));});
 await assert.rejects(()=>Backup.readFullDatabaseBackupBlob(corrupt));assert.equal({}.polluted,undefined);
});
