const test=require('node:test');
const assert=require('node:assert/strict');
const Library=require('../qisi-library-service');
const Storage=require('../qisi-storage-repository');
const {FakeDatabase}=require('./storage-test-harness');
function setup(rows,extra={}){
    const db=new FakeDatabase({questions:rows,images:[{id:'i',blob:new Blob(['bytes'])}]});
    const repository=Storage.createRepository(db,{clock:()=>100}); const reports=[];let refreshes=0;
    const service=Library.createLibraryService({repository,matchesFilters:()=>true});
    const maintenance=Library.createQuestionMaintenance({repository,service,tokenize:()=>({issues:[],segments:[]}),
        renderMath:()=>'',refreshLibrary:async()=>{refreshes++;},report:row=>reports.push(row),...extra});
    return {db,repository,service,maintenance,reports,get refreshes(){return refreshes;}};
}
const row=id=>({id,stem:'\\includegraphics{i}',answer:'',solution:'',options:[],images:[{id:'i'}],updatedAt:1});
test('diagnostic audit is read-only and reports math/image/internal-token issues without altering raw evidence',async()=>{
    const q={...row('q'),stem:'[[IMAGE:absent]] @@QISI_MATH_1@@',rawText:'untouched'};
    const h=setup([q],{tokenize:()=>({issues:[{type:'unbalanced',preview:'$'}],segments:[{type:'math',expression:'bad',raw:'$bad$'}]}),
        renderMath:()=>{throw new Error('BAD_MATH');}});
    const before=await h.db.table('questions').toArray();const issues=await h.maintenance.audit();
    for(const type of ['unbalanced','katex-error','image-not-in-question','image-blob-missing','internal-token-leaked'])assert.ok(issues.some(row=>row.type===type));
    assert.deepEqual(await h.db.table('questions').toArray(),before);assert.equal(h.refreshes,0);
    assert.equal(await h.db.table('images').rows.get('i').blob.text(),'bytes');
});
test('explicit migration is idempotent and leaves raw source evidence intact',async()=>{
    const h=setup([{...row('q'),rawText:'\\includegraphics{i}'}]);
    assert.equal(h.reports.length,0);assert.equal(h.db.table('questions').rows.get('q').stem,'\\includegraphics{i}');
    assert.equal(await h.maintenance.migrate(),1);assert.equal(await h.maintenance.migrate(),0);
    assert.equal(h.db.table('questions').rows.get('q').stem,'[[IMAGE:i]]');
    assert.equal(h.db.table('questions').rows.get('q').rawText,'\\includegraphics{i}');
});
test('partial migration reports durable progress, stops at failure, and resumes only on a new explicit command',async()=>{
    const db=new FakeDatabase({questions:[row('a'),row('b'),row('c')]});
    const base=Storage.createRepository(db,{clock:()=>100});let fail=true;const writes=[],reports=[];
    const repository={...base,async updateQuestion(id,...args){writes.push(id);if(id==='b'&&fail)throw new Error('SAVE_REFUSED');return base.updateQuestion(id,...args);}};
    const service=Library.createLibraryService({repository,matchesFilters:()=>true});let refreshes=0;
    const m=Library.createQuestionMaintenance({repository,service,tokenize:()=>({issues:[],segments:[]}),renderMath:()=>'',
        refreshLibrary:async()=>{refreshes++;},report:event=>reports.push(event)});
    await assert.rejects(m.migrate(),error=>error.message==='SAVE_REFUSED'&&error.migrationProgress.changedCount===1&&error.migrationProgress.failedQuestionId==='b');
    assert.deepEqual(writes,['a','b']);assert.equal(refreshes,1);assert.equal(db.table('questions').rows.get('b').stem,'\\includegraphics{i}');
    assert.equal(db.table('questions').rows.get('c').stem,'\\includegraphics{i}');
    fail=false;assert.equal(await m.migrate(),2);assert.equal(await m.migrate(),0);assert.deepEqual(writes,['a','b','b','c']);
    assert.equal(reports[0].kind,'migration-failed');
});
test('readback failure after migration is reported as already committed, not as rollback',async()=>{
    const h=setup([row('q')],{refreshLibrary:async()=>{throw new Error('READ_REFUSED');}});
    await assert.rejects(h.maintenance.migrate(),error=>error.code==='LIBRARY_MIGRATION_REFRESH_FAILED'&&error.migrationProgress.changedCount===1);
    assert.equal(h.db.table('questions').rows.get('q').stem,'[[IMAGE:i]]');
    assert.equal(h.reports[0].kind,'migration-refresh-failed');
});
