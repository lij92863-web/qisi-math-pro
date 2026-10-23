const test=require('node:test'),assert=require('node:assert/strict');
const H=require('./browser-harness');
async function setup(port){const h=await H.startBrowserApp(port);h.page.on('dialog',d=>d.accept());
    await h.page.addInitScript(()=>{window.fixtureDocUrls=[];window.fixtureRevokedDocs=[];const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=create(blob);if(blob.type.startsWith('text/html'))window.fixtureDocUrls.push(url);return url;};URL.revokeObjectURL=url=>{if(window.fixtureDocUrls.includes(url))window.fixtureRevokedDocs.push(url);return revoke(url);};});
    await h.page.evaluate(()=>db.questions.put({id:'print-fixture',type:'单选题',stem:'OUTPUT FIXTURE $x^2$',options:['one','two'],images:[],answer:'A',solution:'solution',meta:{},createdAt:1}));
    await h.page.reload();await h.page.waitForFunction(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');return app?.questions.length===1&&app.editTplName;});
    await H.callProxy(h.page,'toggleCart','print-fixture');await H.callProxy(h.page,'openExamBuilder');return h;}
test('isolated print preview keeps its lease while open and releases it after actual tab closure',{timeout:35000},async()=>{
    const h=await setup(32895);let preview;try{
        const opened=h.context.waitForEvent('page');await h.page.getByRole('button',{name:'打印 PDF',exact:true}).click();preview=await opened;await preview.locator('#printBtn:not([disabled])').waitFor();
        assert.equal(await preview.evaluate(()=>window.opener),null);assert.deepEqual(await h.page.evaluate(()=>({made:window.fixtureDocUrls.length,revoked:window.fixtureRevokedDocs.length})),{made:1,revoked:0});
        await preview.reload();await preview.locator('#printBtn:not([disabled])').waitFor();assert.equal(await h.page.evaluate(()=>window.fixtureRevokedDocs.length),0);
        await preview.close();preview=null;await h.page.waitForFunction(()=>window.fixtureRevokedDocs.length===1,{},{timeout:4000});H.assertNoRuntimeErrors(h);
    }finally{if(preview)await preview.close();await h.close();}
});
test('failed print stylesheet never enables the print button',{timeout:35000},async()=>{
    const h=await setup(32896);let preview;try{
        await h.context.route('**/vendor/katex/katex.min.css',route=>route.abort());
        const opened=h.context.waitForEvent('page');await h.page.getByRole('button',{name:'打印 PDF',exact:true}).click();preview=await opened;
        await preview.waitForFunction(()=>{const button=document.getElementById('printBtn');return button&&button.textContent!=='正在准备图片...';});
        const result=await preview.locator('#printBtn').evaluate(button=>({disabled:button.disabled,label:button.textContent}));
        assert.equal(result.disabled,true);assert.match(result.label,/字体或样式未能完整加载/);H.assertNoRuntimeErrors(h);
    }finally{if(preview)await preview.close();await h.close();}
});

test('font stylesheet pending keeps printing disabled and repeated commands share a single opening',{timeout:35000},async()=>{
    const h=await setup(32897);let preview,release;const gate=new Promise(resolve=>release=resolve);try{
        await h.context.addInitScript(()=>{window.fixturePrintCalls=0;window.print=()=>window.fixturePrintCalls++;});
        await h.context.route('**/vendor/katex/katex.min.css',async route=>{await gate;await route.continue();});
        const opened=h.context.waitForEvent('page');await h.page.getByRole('button',{name:'打印 PDF',exact:true}).click();preview=await opened;await preview.locator('#printBtn').waitFor();
        assert.equal(await preview.locator('#printBtn').isDisabled(),true);
        assert.equal(await h.page.evaluate(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');return app.printExam()===app.printExam();}),true);
        assert.equal(await h.page.evaluate(()=>window.fixtureDocUrls.length),1);release();await preview.locator('#printBtn:not([disabled])').waitFor();
        await h.page.waitForFunction(()=>!Qisi.Runtime.getRuntimeDependency('AppProxy').printBusy);assert.equal(await preview.evaluate(()=>window.fixturePrintCalls),0);H.assertNoRuntimeErrors(h);
    }finally{release();if(preview)await preview.close();await h.close();}
});
test('blocked popup releases its unconsumed document and tells the user opening was not confirmed',{timeout:35000},async()=>{
    const h=await setup(32898);try{
        await h.page.addInitScript(()=>{window.Qisi=window.Qisi||{};Object.defineProperty(window.Qisi,'PrintResources',{configurable:true,set(owner){Object.defineProperty(window.Qisi,'PrintResources',{configurable:true,value:{...owner,createOutputWorkspace:options=>owner.createOutputWorkspace({...options,openDeadlineMs:150})}});}});
            const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.href.startsWith('blob:'))return;return click.call(this);};});
        await h.page.reload();await h.page.waitForFunction(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');return app?.cart.length===1&&app.editTplName;});
        const feedback=h.page.waitForEvent('dialog');await h.page.getByRole('button',{name:'打印 PDF',exact:true}).click();assert.match((await feedback).message(),/未能确认打开/);
        await h.page.waitForFunction(()=>window.fixtureRevokedDocs.length===1&&!Qisi.Runtime.getRuntimeDependency('AppProxy').printBusy);
        assert.equal(h.context.pages().length,1);H.assertNoRuntimeErrors(h);
    }finally{await h.close();}
});
test('actual app unmount releases a preview pending stylesheet without invalidating its loaded content',{timeout:35000},async()=>{
    const h=await setup(32899);let preview,release;const gate=new Promise(resolve=>release=resolve);try{
        await h.context.route('**/vendor/katex/katex.min.css',async route=>{await gate;await route.continue();});
        const opened=h.context.waitForEvent('page');await h.page.getByRole('button',{name:'打印 PDF',exact:true}).click();preview=await opened;await preview.locator('#printBtn').waitFor();
        await h.page.evaluate(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').$.appContext.app.unmount());
        await h.page.waitForFunction(()=>window.fixtureRevokedDocs.length===1);release();await preview.locator('#printBtn:not([disabled])').waitFor();
        assert.match(await preview.locator('.question-flow-body').textContent(),/OUTPUT FIXTURE/);H.assertNoRuntimeErrors(h);
    }finally{release();if(preview)await preview.close();await h.close();}
});
