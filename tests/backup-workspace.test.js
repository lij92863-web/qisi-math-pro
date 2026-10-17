const test=require('node:test'),assert=require('node:assert/strict');
const {createBackupWorkspace}=require('../qisi-backup-workspace');
function harness(){
 const state={},files=new Map(),timers=new Map(),writeListeners=new Set();let timerId=0,created=0,restored=0,aborted=0;
 const parsed={backup:{tables:{questions:[{id:'old'}]}},manifest:{exportedAt:'fixture-date',tables:{questions:{count:1},images:{count:0}}},verification:{ok:true,questionCount:1,imageCount:0,warnings:[]},absentTables:[]};
 const folder={name:'fixture-folder',getFileHandle:async(name,options)=>{
  if(!files.has(name)&&!options?.create)throw Object.assign(Error(),{name:'NotFoundError'});
  if(!files.has(name))files.set(name,null);
  return {createWritable:async()=>{
   assert.equal(files.get(name),null,'must not overwrite an existing archive');
   return {write:async blob=>{if(ports.failWrite)throw Error('disk failure');files.set(name,blob)},close:async()=>{},abort:async()=>{aborted++}};
  }};
 }};
 const backup={TABLE_NAMES:['questions','images'],createFullDatabaseBackup:async()=>{created++;if(ports.block)await ports.block;return {blob:new Blob(['archive']),filename:'qisi-full-backup-100.zip',manifest:{verification:{ok:true}},snapshot:{saved:true}}},readFullDatabaseBackupBlob:async()=>{if(ports.blockRead)await ports.blockRead;return parsed},exportFullDatabaseBackup:async()=>{if(ports.blockDownload)await ports.blockDownload;return {}}};
 const database={name:'fixture-db'};
 const mutationEvents={subscribe:fn=>writeListeners.add(fn),unsubscribe:fn=>writeListeners.delete(fn)};
 const ports={database,mutationEvents,backup,supported:true,pickDirectory:async()=>folder,uniqueId:()=> 'id',clock:()=>100,setTimer:fn=>{timers.set(++timerId,fn);return timerId},clearTimer:id=>timers.delete(id),repository:{restoreBackup:async(candidate,options)=>{assert.deepEqual(options.expectedSnapshot,{saved:true});if(ports.conflict)throw Object.assign(Error(),{code:'restore-conflict'});restored++;assert.equal(candidate,parsed.backup)}}};
 const workspace=createBackupWorkspace(ports,state);workspace.start();
 return {workspace,state,ports,files,timers,writeListeners,get created(){return created},get restored(){return restored},get aborted(){return aborted},
  commit:(abort=false)=>{if(!abort)for(const fn of writeListeners)fn({'idb://fixture-db/questions/':{}})},
  fire:async()=>{const [id,fn]=timers.entries().next().value;timers.delete(id);await fn()}};
}
test('completed transactions coalesce into one backup and aborts never schedule work',async()=>{
 const h=harness();h.commit(true);assert.equal(h.timers.size,0);
 await h.workspace.chooseFolder();assert.equal(h.created,1);h.commit();h.commit();assert.equal(h.timers.size,1);
 await h.fire();assert.equal(h.created,2);assert.equal(h.state.pendingChanges,false);
 h.workspace.dispose();assert.equal(h.writeListeners.size,0);assert.equal(h.timers.size,0);
});
test('new changes during compression stay pending and concurrent calls cannot clear its busy flag',async()=>{
 const h=harness();await h.workspace.chooseFolder();let release;h.ports.block=new Promise(resolve=>release=resolve);
 const pending=h.workspace.backupNow();await Promise.resolve();h.commit();
 assert.equal((await h.workspace.downloadBackup()).ok,false);assert.equal(h.state.busy,true);
 assert.equal((await h.workspace.restoreSelected()).ok,false);assert.equal(h.state.busy,true);
 release();await pending;assert.equal(h.state.pendingChanges,true);assert.equal(h.timers.size,1);
 h.ports.block=null;await h.fire();assert.equal(h.state.pendingChanges,false);
});
test('file collisions preserve old archives and failed writes pause automatic mode without claiming success',async()=>{
 const h=harness(),name='qisi-full-backup-100-initial-id.zip';h.files.set(name,'old-file');await h.workspace.chooseFolder();assert.equal(h.files.get(name),'old-file');assert.ok(h.files.has('qisi-full-backup-100-initial-id-1.zip'));
 h.ports.failWrite=true;h.commit();await h.fire();assert.equal(h.state.automatic,false);assert.equal(h.state.lastSavedFile,'qisi-full-backup-100-initial-id-1.zip');assert.equal(h.aborted,1);assert.equal(h.timers.size,0);
});
test('restoration requires explicit consent and a completed safety archive; conflicts preserve the candidate',async()=>{
 const h=harness();await h.workspace.inspectRestoreFile({name:'fixture.zip'});assert.equal((await h.workspace.restoreSelected()).ok,false);assert.equal(h.restored,0);
 h.state.confirmOverwrite=true;h.state.confirmWord='恢复备份';assert.equal((await h.workspace.restoreSelected()).code,'FOLDER_REQUIRED');
 await h.workspace.chooseFolder();h.ports.conflict=true;const result=await h.workspace.restoreSelected();assert.equal(result.code,'restore-conflict');assert.equal(h.restored,0);assert.ok(h.state.preview);assert.match(h.state.error,/变化/);
 h.ports.conflict=false;assert.equal((await h.workspace.restoreSelected()).ok,true);assert.equal(h.restored,1);assert.equal(h.state.preview,null);assert.ok([...h.files.keys()].some(name=>name.includes('before-restore')));
});


test('N27 preferences roll back on DB restore failure and survive a successful restore',async()=>{
 const h=harness(),read=h.ports.backup.readFullDatabaseBackupBlob;let value='current',rollbacks=0;
 h.ports.backup.readFullDatabaseBackupBlob=async()=>({...await read(),preferences:{qisi_teacher_name:'restored'}});
 h.ports.backup.restorePreferences=p=>{const previous=value;value=p.qisi_teacher_name;return ()=>{value=previous;rollbacks++;}};
 await h.workspace.chooseFolder();await h.workspace.inspectRestoreFile({name:'fixture.zip'});h.state.confirmWord='恢复备份';h.state.confirmOverwrite=true;
 h.ports.conflict=true;assert.equal((await h.workspace.restoreSelected()).ok,false);assert.equal(value,'current');assert.equal(rollbacks,1);
 h.ports.conflict=false;assert.equal((await h.workspace.restoreSelected()).ok,true);assert.equal(value,'restored');assert.equal(rollbacks,1);
});
