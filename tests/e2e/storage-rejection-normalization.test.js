const test=require('node:test');
const assert=require('node:assert/strict');
const H=require('./browser-harness');
test('normalized repository rejection is handled once and a multi-table failure rolls back every prior write',{timeout:35000},async()=>{
    const h=await H.startBrowserApp(32890);
    try{
        await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy')?.editTplName);
        const result=await h.page.evaluate(async()=>{
            const before={id:'tree',nodes:[{id:'original',name:'keep original'}]};await db.personalKnowledge.put(before);
            window.fixtureRejections=[];window.addEventListener('unhandledrejection',event=>window.fixtureRejections.push(event.reason?.message));
            db.customTemplates.hook('creating',()=>{throw new Error('SECOND_TABLE_REFUSED');});
            const repository=Qisi.StorageRepository.createRepository(db);let failure;
            try{await repository.transaction(['personalKnowledge','customTemplates'],tx=>tx.put('personalKnowledge',{id:'tree',nodes:[{id:'wrong',name:'must rollback'}]})
                .then(()=>tx.put('customTemplates',{id:'rejected'})));}catch(error){failure={code:error.code,message:error.message};}
            await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            return {before,tree:await db.personalKnowledge.get('tree'),templates:await db.customTemplates.count(),failure,rejections:window.fixtureRejections};
        });
        assert.equal(result.failure.code,'storage-failure');assert.match(result.failure.message,/SECOND_TABLE_REFUSED/);
        assert.deepEqual(result.tree,result.before);assert.equal(result.templates,0);assert.deepEqual(result.rejections,[]);H.assertNoRuntimeErrors(h);
    }finally{await h.close();}
});
