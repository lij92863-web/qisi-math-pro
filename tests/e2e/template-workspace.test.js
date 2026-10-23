const test=require('node:test');
const assert=require('node:assert/strict');
const H=require('./browser-harness');
const ready = page => page.waitForFunction(() => Boolean(Qisi.Runtime.getRuntimeDependency('AppProxy')?.editTplName));

test('actual custom-template disk failure preserves entered code and reports failure', {timeout:35000},async()=>{
    const h=await H.startBrowserApp(32881);
    try{
        await ready(h.page);
        const dialogs=[];h.page.on('dialog',async d=>{dialogs.push(d.message());await d.accept();});
        await h.page.evaluate(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');app.view='template';app.triggerNewCustomTemplate();window.templateWrites=0;db.customTemplates.hook('creating',()=>{window.templateWrites++;throw new Error('TEMPLATE_WRITE_REFUSED');});});
        const code='\\documentclass{article}\n\\begin{document}typed content\\end{document}';
        await h.page.locator('.template-layout textarea').fill(code);await h.page.getByPlaceholder('模板名称',{exact:true}).fill('keep name');
        await h.page.getByRole('button',{name:'保存为新模板',exact:true}).click();await h.page.waitForFunction(()=>window.templateWrites===1);
        const result=await h.page.evaluate(async()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');return {code:app.latexTemplate,name:app.editTplName,mode:app.editMode,stored:await db.customTemplates.count()};});
        assert.deepEqual(result,{code,name:'keep name',mode:'new',stored:0});assert.ok(dialogs.some(m=>m.includes('TEMPLATE_WRITE_REFUSED')));
        H.assertNoRuntimeErrors(h);
    }finally{await h.close();}
});

test('actual system-template storage refusal does not publish or report a successful override', {timeout:35000},async()=>{
    const h=await H.startBrowserApp(32882);
    try{
        await ready(h.page);
        const dialogs=[];h.page.on('dialog',async d=>{dialogs.push(d.message());await d.accept();});
        const before=await h.page.evaluate(()=>{
            const app=Qisi.Runtime.getRuntimeDependency('AppProxy');app.view='template';const card=app.allTemplateCards.find(t=>t.system);app.selectTemplateCard(card);
            const old=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='qisi_template_overrides')throw new Error('TEMPLATE_PREF_REFUSED');return old.call(this,key,value);};
            return {key:card.id,card:JSON.parse(JSON.stringify(card)),stored:localStorage.getItem('qisi_template_overrides')};
        });
        await h.page.getByPlaceholder('模板名称',{exact:true}).fill('unsaved name');
        const dialog=h.page.waitForEvent('dialog');await h.page.getByRole('button',{name:'更新当前模板',exact:true}).click();await dialog;
        const result=await h.page.evaluate(key=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');return {card:app.allTemplateCards.find(t=>t.id===key),name:app.editTplName,stored:localStorage.getItem('qisi_template_overrides')};},before.key);
        assert.deepEqual(result.card,before.card);assert.equal(result.name,'unsaved name');assert.equal(result.stored,before.stored);
        assert.ok(dialogs.some(m=>m.includes('失败')));assert.ok(!dialogs.some(m=>m.includes('系统模板已更新')));
    }finally{await h.close();}
});

test('template font settings survive save, switching and reload without unrelated library reads', {timeout:40000},async()=>{
    const h=await H.startBrowserApp(32883);
    try{
        await ready(h.page);
        h.page.on('dialog',d=>d.accept());
        await h.page.evaluate(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');app.view='template';app.triggerNewCustomTemplate();app.editTplName='Saved font template';app.examConfig.fontFamily='楷体';app.examConfig.fontSize='三号';app.examConfig.title='saved title';window.unrelatedReads=0;
            const table=db.questions,old=table.toArray.bind(table);table.toArray=(...args)=>{window.unrelatedReads++;return old(...args);};});
        await h.page.getByRole('button',{name:'保存为新模板',exact:true}).click();await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').customTemplates.length===1);
        const stored=await h.page.evaluate(async()=>({tpl:(await db.customTemplates.toArray())[0],reads:window.unrelatedReads}));assert.equal(stored.reads,0);assert.equal(stored.tpl.config.fontFamily,'楷体');assert.equal(stored.tpl.config.fontSize,'三号');
        await H.callProxy(h.page,'selectTemplateCard',stored.tpl ? {...stored.tpl,system:false}:null);
        await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').examConfig.fontFamily==='楷体');
        await h.page.reload();await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy')?.selectedExamTemplate?.startsWith('tpl_'));
        const result=await h.page.evaluate(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');return {font:app.examConfig.fontFamily,size:app.examConfig.fontSize,title:app.examConfig.title,key:app.selectedExamTemplate};});
        assert.deepEqual(result,{font:'楷体',size:'三号',title:'saved title',key:stored.tpl.id});H.assertNoRuntimeErrors(h);
    }finally{await h.close();}
});
