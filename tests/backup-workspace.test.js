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
 return {workspace,state,ports,folder,files,timers,writeListeners,get created(){return created},get restored(){return restored},get aborted(){return aborted},
  commit:(abort=false)=>{if(!abort)for(const fn of writeListeners)fn({'idb://fixture-db/questions/':{}})},
  fire:async()=>{const [id,fn]=timers.entries().next().value;timers.delete(id);await fn()}};
}

test('retention caps managed automatic copies after a successful write and preserves other files', async () => {
    const h = harness();
    let stamp = 100, sequence = 0;
    h.ports.rotationScope = () => 'b1230000-0000-0000-0000-000000000001';
    h.ports.uniqueId = () => 'a1230000-0000-0000-0000-' + String(++sequence).padStart(12, '0');
    const create = h.ports.backup.createFullDatabaseBackup;
    h.ports.backup.createFullDatabaseBackup = async () => ({ ...await create(), filename: `qisi-full-backup-${stamp++}.zip` });
    h.folder.entries = async function* () { for (const name of h.files.keys()) yield [name, { kind: 'file' }]; };
    h.folder.removeEntry = async name => { h.files.delete(name); };
    h.files.set('qisi-full-backup-10-auto-legacy.zip', 'old');
    h.files.set('qisi-full-backup-11-before-restore-preserved.zip', 'old');
    h.files.set('qisi-full-backup-12-auto-managed-c1230000-0000-0000-0000-000000000001-a1230000-0000-0000-0000-000000000001.zip', 'another library');
    h.files.set('photo.zip', 'unrelated');
    await h.workspace.chooseFolder();
    for (let i = 0; i < 11; i++) { h.commit(); await h.fire(); }
    const auto = [...h.files.keys()].filter(name => name.includes('-auto-managed-b123'));
    assert.equal(auto.length, 7);
    assert.ok(auto.some(name => name.startsWith('qisi-full-backup-105-')));
    assert.ok(auto.some(name => name.startsWith('qisi-full-backup-111-')));
    assert.equal(h.files.size, 12);
});
test('completed transactions coalesce into one backup and aborts never schedule work',async()=>{
 const h=harness();h.commit(true);assert.equal(h.timers.size,0);
 await h.workspace.chooseFolder();assert.equal(h.created,1);h.commit();h.commit();assert.equal(h.timers.size,1);
 await h.fire();assert.equal(h.created,2);assert.equal(h.state.pendingChanges,false);
 h.workspace.dispose();assert.equal(h.writeListeners.size,0);assert.equal(h.timers.size,0);
});

test('saved folder resumes after restart or asks for permission to the same folder', async () => {
    for (const initial of ['granted', 'prompt']) {
        const h = harness();
        h.workspace.dispose();
        let permission = initial, picks = 0;
        h.folder.queryPermission = async () => permission;
        h.folder.requestPermission = async () => { permission = 'granted'; return permission; };
        const state = {};
        let saved = { folder: h.folder, automatic: true };
        const workspace = createBackupWorkspace({ ...h.ports,
            pickDirectory: async () => { picks++; return h.folder; },
            loadFolder: async () => saved, saveFolder: async selection => { saved = selection; }
        }, state);
        await workspace.start();
        assert.equal(state.folderRemembered, true);
        assert.equal(state.automatic, initial === 'granted');
        assert.equal(state.needsPermission, initial === 'prompt');
        if (initial === 'prompt') assert.equal((await workspace.resumeAutomatic()).ok, true);
        assert.equal(state.folderReady, true);
        assert.equal(state.automatic, true);
        assert.equal(state.needsPermission, false);
        assert.equal(picks, 0);
        await workspace.pauseAutomatic();
        assert.equal(saved.automatic, false);
        workspace.dispose();
    }
});
test('emergency restore requires a verified candidate, a failed safety backup and separate consent', async () => {
    const h = harness();
    let restores = 0;
    h.ports.repository.restoreBackup = async (backup, options) => {
        assert.equal(backup.tables.questions[0].id, 'old');
        assert.equal(options.expectedSnapshot, undefined);
        restores++;
    };
    await h.workspace.inspectRestoreFile({ name: 'fixture.zip' });
    h.state.confirmOverwrite = true;
    h.state.confirmWord = '恢复备份';
    assert.equal((await h.workspace.restoreWithoutSafety()).code, 'CONFIRMATION_REQUIRED');
    assert.equal((await h.workspace.restoreSelected()).code, 'FOLDER_REQUIRED');
    assert.equal(h.state.safetyFailed, true);
    assert.equal((await h.workspace.restoreWithoutSafety()).code, 'CONFIRMATION_REQUIRED');
    h.state.confirmWithoutSafety = true;
    assert.equal((await h.workspace.restoreWithoutSafety()).ok, true);
    assert.equal(restores, 1);
    assert.equal(h.state.safetyFailed, false);
});
test('new changes during compression stay pending and concurrent calls cannot clear its busy flag',async()=>{
 const h=harness();await h.workspace.chooseFolder();let release;h.ports.block=new Promise(resolve=>release=resolve);
 const pending=h.workspace.backupNow();await Promise.resolve();h.commit();
 assert.equal((await h.workspace.downloadBackup()).ok,false);assert.equal(h.state.busy,true);
 assert.equal((await h.workspace.restoreSelected()).ok,false);assert.equal(h.state.busy,true);
 release();await pending;assert.equal(h.state.pendingChanges,true);assert.equal(h.timers.size,1);
 h.ports.block=null;await h.fire();assert.equal(h.state.pendingChanges,false);
});
test('file collisions preserve old archives and transient write failures retry without claiming success',async()=>{
 const h=harness(),name='qisi-full-backup-100-initial-id.zip';h.files.set(name,'old-file');await h.workspace.chooseFolder();assert.equal(h.files.get(name),'old-file');assert.ok(h.files.has('qisi-full-backup-100-initial-id-1.zip'));
 h.ports.failWrite=true;h.commit();await h.fire();assert.equal(h.state.automatic,true);assert.equal(h.state.lastSavedFile,'qisi-full-backup-100-initial-id-1.zip');assert.equal(h.aborted,1);assert.equal(h.timers.size,1);
 h.ports.failWrite=false;await h.fire();assert.equal(h.state.pendingChanges,false);
});

test('a capacity error retains automatic mode and retries when the database changes', async () => {
 const h = harness(), create = h.ports.backup.createFullDatabaseBackup;
 await h.workspace.chooseFolder();
 h.ports.backup.createFullDatabaseBackup = async () => { throw Object.assign(new Error(), { code: 'ARCHIVE_TOTAL_SIZE_LIMIT' }); };
 h.commit(); await h.fire();
 assert.equal(h.state.automatic, true); assert.equal(h.timers.size, 0); assert.match(h.state.error, /2 GiB/);
 h.ports.backup.createFullDatabaseBackup = create;
 h.commit(); await h.fire();
 assert.equal(h.state.pendingChanges, false); assert.equal(h.state.error, '');
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
