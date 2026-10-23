const test=require('node:test');
const assert=require('node:assert/strict');
const H=require('./browser-harness');
async function callMaintenance(page,name){
    await page.evaluate(name=>{
        window.auditMaintenanceResult={done:false};
        window.auditMaintenanceTask=window[name]().then(value=>{window.auditMaintenanceResult={done:true,value};},
            error=>{window.auditMaintenanceResult={done:true,error:error.message};});
    },name);
    await page.waitForFunction(()=>window.auditMaintenanceResult.done);
    const result=await page.evaluate(()=>window.auditMaintenanceResult);
    assert.equal(result.error,undefined);return result.value;
}
test('startup never migrates; global audit is readonly and explicit migration is durable and idempotent', {timeout:45000}, async()=>{
    const h=await H.startBrowserApp(32871);
    try{
        await h.page.addInitScript(()=>{
            window.auditMigrationCalls=0;window.Qisi=window.Qisi||{};
            Object.defineProperty(window.Qisi,'LibraryService',{configurable:true,set(owner){
                Object.defineProperty(window.Qisi,'LibraryService',{configurable:true,value:{...owner,createLibraryService(...args){
                    const service=owner.createLibraryService(...args);
                    return {...service,migrateSafeQuestionLatexData(...args){window.auditMigrationCalls++;return service.migrateSafeQuestionLatexData(...args);}};
                }}});
            }});
        });
        await h.page.reload();await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy'));
        await h.page.evaluate(async()=>{
            const bytes=Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),c=>c.charCodeAt(0));
            await db.images.put({id:'maintenance-image',blob:new Blob([bytes],{type:'image/gif'})});
            await db.questions.put({id:'maintenance-q',stem:'题图 \\includegraphics{maintenance-image} MATHPROTECT1',
                answer:'',solution:'[[IMAGE:missing-image]]',options:[],images:[{id:'maintenance-image'}],
                rawText:'原始 \\includegraphics{maintenance-image} MATHPROTECT1',meta:{grade:'高一'},type:'填空题',createdAt:1,updatedAt:1});
        });
        await h.page.reload();await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy')?.questions.length===1);
        assert.equal(await h.page.evaluate(()=>window.auditMigrationCalls),0);
        const before=await h.page.evaluate(async()=>JSON.stringify(await db.questions.toArray()));
        const issues=await callMaintenance(h.page,'auditQuestionLatexData');
        assert.ok(issues.some(row=>row.type==='internal-token-leaked'));
        assert.ok(issues.some(row=>row.type==='image-blob-missing'));
        assert.equal(await h.page.evaluate(async()=>JSON.stringify(await db.questions.toArray())),before);
        assert.equal(await h.page.evaluate(()=>window.auditMigrationCalls),0);
        assert.equal(await callMaintenance(h.page,'migrateSafeQuestionLatexData'),1);
        const migrated=await h.page.evaluate(async()=>db.questions.get('maintenance-q'));
        assert.match(migrated.stem,/\[\[IMAGE:maintenance-image\]\]/);assert.doesNotMatch(migrated.stem,/MATHPROTECT/);
        assert.equal(migrated.rawText,'原始 \\includegraphics{maintenance-image} MATHPROTECT1');
        assert.equal(migrated.solution,'[[IMAGE:missing-image]]');
        assert.equal(await callMaintenance(h.page,'migrateSafeQuestionLatexData'),0);
        assert.equal(await h.page.evaluate(()=>window.auditMigrationCalls),2);
        H.assertNoRuntimeErrors(h);
    }finally{await h.close();}
});
