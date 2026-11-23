const test=require('node:test');
const assert=require('node:assert/strict');
const H=require('./browser-harness');
const gif=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');

test('manual image removal deletes only the chosen reference, including options, and preserves adjacent content', {timeout:30000},async()=>{
    const h=await H.startBrowserApp(32872);
    try{
        await h.page.evaluate(()=>{
            const form=Qisi.Runtime.getRuntimeDependency('AppProxy').entryForm;
            form.stem='before \\begin{center}[[IMAGE:a]]\\end{center} BETWEEN \\begin{center}[[IMAGE:b]]\\end{center} after';
            form.options=['[[IMAGE:b]]','keep'];form.images=[{id:'a'},{id:'b'}];
        });
        await H.callProxy(h.page,'removeEntryImage','b');
        const form=await h.page.evaluate(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').entryForm);
        assert.equal(form.stem,'before \\begin{center}[[IMAGE:a]]\\end{center} BETWEEN  after');
        assert.deepEqual(form.options,['','keep']);assert.deepEqual(form.images.map(row=>row.id),['a']);
    }finally{await h.close();}
});
test('actual upload storage failure publishes neither image nor shortcode', {timeout:30000},async()=>{
    const h=await H.startBrowserApp(32873);
    try{
        h.page.on('dialog',d=>d.accept());
        await h.page.evaluate(()=>{
            const app=Qisi.Runtime.getRuntimeDependency('AppProxy');app.view='entry';app.entryForm.stem='keep text';window.auditImageWrites=0;
            db.images.hook('creating',()=>{window.auditImageWrites++;throw new Error('IMAGE_WRITE_REFUSED');});
        });
        await h.page.locator('.entry-drop-zone input[type=file]').setInputFiles({name:'fixture.gif',mimeType:'image/gif',buffer:gif});
        await h.page.waitForFunction(()=>window.auditImageWrites===1);
        const result=await h.page.evaluate(async()=>{const f=Qisi.Runtime.getRuntimeDependency('AppProxy').entryForm;return {stem:f.stem,images:f.images.length,stored:await db.images.count()};});
        assert.deepEqual(result,{stem:'keep text',images:0,stored:0});
    }finally{await h.close();}
});
test('uploaded manual draft restores visible exact image bytes and saves atomically after reload', {timeout:45000},async()=>{
    const h=await H.startBrowserApp(32874);
    try{
        h.page.on('dialog',d=>d.accept());
        await h.page.evaluate(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');app.view='entry';app.entryForm.stem='draft text';});
        await h.page.locator('.entry-drop-zone input[type=file]').setInputFiles({name:'fixture.gif',mimeType:'image/gif',buffer:gif});
        await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').entryForm.images.length===1);
        await h.page.waitForFunction(async()=>await db.images.count()===1);
        const originalId=await h.page.evaluate(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').entryForm.images[0].id);
        await h.page.reload();
        await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy')?.entryForm.images[0]?.url,{},{timeout:5000});
        const restored=await h.page.evaluate(async()=>{
            const f=Qisi.Runtime.getRuntimeDependency('AppProxy').entryForm,image=new Image();image.src=f.images[0].url;await image.decode();
            return {id:f.images[0].id,width:image.naturalWidth,stem:f.stem};
        });
        assert.equal(restored.id,originalId);assert.equal(restored.width,1);assert.ok(restored.stem.includes(originalId));
        await h.page.getByRole('button',{name:'确认无误，保存入库',exact:true}).click();
        await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').questions.length===1);
        const stored=await h.page.evaluate(async()=>{const q=(await db.questions.toArray())[0];return {q,bytes:Array.from(new Uint8Array(await (await db.images.get(q.images[0].id)).blob.arrayBuffer())),draft:localStorage.getItem('qisi_draft_v2')};});
        assert.equal(stored.q.images[0].id,originalId);assert.deepEqual(stored.bytes,[...gif]);assert.equal(stored.draft,null);
        H.assertNoRuntimeErrors(h);
    }finally{await h.close();}
});
for(const [index,mode]of ['failure','new-input','refresh-failure','double-click'].entries()){
    test(`actual manual save coordination: ${mode}`,{timeout:40000},async()=>{
        const h=await H.startBrowserApp(32875+index);
        try{
            const dialogs=[];h.page.on('dialog',async d=>{dialogs.push(d.message());await d.accept();});
            await h.page.addInitScript(mode=>{
                window.manualCalls=0;window.manualMode=mode;window.manualGate=new Promise(resolve=>{window.releaseManual=resolve;});
                window.Qisi=window.Qisi||{};
                Object.defineProperty(window.Qisi,'LibraryService',{configurable:true,set(owner){Object.defineProperty(window.Qisi,'LibraryService',{configurable:true,value:{...owner,createLibraryService(...args){
                    const service=owner.createLibraryService(...args);return {...service,async saveQuestion(...args){window.manualCalls++;await window.manualGate;
                        if(window.manualMode==='failure')throw new Error('MANUAL_WRITE_REFUSED');
                        return service.saveQuestion(...args);
                    }};
                }}});}});
                Object.defineProperty(window.Qisi,'StorageRepository',{configurable:true,set(owner){Object.defineProperty(window.Qisi,'StorageRepository',{configurable:true,value:{...owner,createRepository(...args){
                    const repository=owner.createRepository(...args);return {...repository,async loadQuestionsById(...args){
                        if(window.manualMode==='refresh-failure')throw new Error('MANUAL_READ_REFUSED');return repository.loadQuestionsById(...args);
                    }};
                }}});}});
            },mode);
            await h.page.reload();await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy'));
            await h.page.evaluate(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');app.view='entry';app.entryForm.stem='captured question';});
            const button=h.page.getByRole('button',{name:'确认无误，保存入库',exact:true});await button.click();
            await h.page.waitForFunction(()=>window.manualCalls===1);
            if(mode==='double-click')await button.click();
            if(mode==='new-input')await h.page.getByRole('textbox',{name:'单题 LaTeX 源码',exact:true}).fill('new input after save started');
            const failureDialog=['failure','refresh-failure'].includes(mode) ? h.page.waitForEvent('dialog',{timeout:5000}) : null;
            await h.page.evaluate(()=>window.releaseManual());
            if(failureDialog)await failureDialog;
            else await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').questions.length===1);
            const result=await h.page.evaluate(async()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');return {questions:await db.questions.toArray(),form:app.entryForm.stem,view:app.view,calls:window.manualCalls};});
            assert.equal(result.calls,1);
            if(mode==='failure'){assert.equal(result.questions.length,0);assert.equal(result.form,'captured question');assert.ok(dialogs.some(s=>s.includes('MANUAL_WRITE_REFUSED')));}
            else{assert.equal(result.questions.length,1);assert.equal(result.questions[0].stem,'captured question');
                if(mode==='new-input'){assert.equal(result.form,'new input after save started');assert.equal(result.view,'entry');}
                if(mode==='refresh-failure')assert.ok(dialogs.some(s=>/题目已保存.*刷新失败/.test(s)));
            }
        }finally{await h.close();}
    });
}
