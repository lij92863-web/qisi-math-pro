const test=require('node:test');
const assert=require('node:assert/strict');
const H=require('./browser-harness');

test('actual knowledge creation failure retains tree, selected parent and typed name', {timeout:35000},async()=>{
    const h=await H.startBrowserApp(32879);
    try{
        h.page.on('dialog',d=>d.accept());
        await h.page.evaluate(async()=>{await db.personalKnowledge.put({id:'tree',nodes:[{id:'root',name:'existing',children:[]}]});});
        await h.page.reload();await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy')?.personalKnowledgeTree.length===1);
        await h.page.evaluate(()=>{
            const app=Qisi.Runtime.getRuntimeDependency('AppProxy');app.view='personal';app.selectedPersonalL1Id='root';window.auditKnowledgeWrites=0;
            db.personalKnowledge.hook('updating',()=>{window.auditKnowledgeWrites++;throw new Error('TREE_WRITE_REFUSED');});
        });
        await h.page.getByPlaceholder('如：函数',{exact:true}).fill('new root');
        await h.page.locator('.personal-layout').getByRole('button',{name:'添加知识点',exact:true}).click();
        await h.page.waitForFunction(()=>window.auditKnowledgeWrites===1);
        const result=await h.page.evaluate(async()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');return {tree:app.personalKnowledgeTree,name:app.personalL1Name,selected:app.selectedPersonalL1Id,stored:(await db.personalKnowledge.get('tree')).nodes};});
        assert.deepEqual(result.tree,result.stored);assert.equal(result.name,'new root');assert.equal(result.selected,'root');
    }finally{await h.close();}
});

test('actual knowledge tree add, rename, reload, counts and delete keep parent and formal records consistent', {timeout:45000},async()=>{
    const h=await H.startBrowserApp(32880);
    try{
        const promptNames=['child','leaf','renamed leaf'];h.page.on('dialog',d=>d.type()==='prompt'?d.accept(promptNames.shift()):d.accept());
        await h.page.evaluate(()=>{Qisi.Runtime.getRuntimeDependency('AppProxy').view='personal';});
        await h.page.getByPlaceholder('如：函数',{exact:true}).fill('root');
        await h.page.locator('.personal-layout').getByRole('button',{name:'添加知识点',exact:true}).click();
        await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').personalTreeRows.length===1);
        await h.page.locator('.personal-tree-row.level-1').getByRole('button',{name:'新增子节点',exact:true}).click();
        await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').personalTreeRows.length===2);
        await h.page.locator('.personal-tree-row.level-2').getByRole('button',{name:'新增子节点',exact:true}).click();
        await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').personalTreeRows.length===3);
        await h.page.locator('.personal-tree-row.level-3').getByRole('button',{name:'修改',exact:true}).click();
        await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').personalTreeRows[2].node.name==='renamed leaf');
        await h.page.evaluate(async()=>{await db.questions.put({id:'knowledge-fixture',stem:'keep question',images:[],options:[],personalKnowledge:'renamed leaf',createdAt:1,meta:{}});});
        await h.page.reload();await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy')?.personalTreeRows.length===3);
        const counts=await h.page.evaluate(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').personalKnowledgeCounts);
        assert.deepEqual(counts,{'renamed leaf':1,child:1,root:1});
        await h.page.evaluate(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');app.view='personal';app.selectedPersonalL1Id=app.personalKnowledgeTree[0].id;app.selectedPersonalL2Id=app.personalKnowledgeTree[0].children[0].id;});
        await h.page.locator('.personal-tree-row.level-1').getByRole('button',{name:'删除',exact:true}).click();
        await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').personalKnowledgeTree.length===0);
        const result=await h.page.evaluate(async()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');return {selected1:app.selectedPersonalL1Id,selected2:app.selectedPersonalL2Id,tree:(await db.personalKnowledge.get('tree')).nodes,formal:await db.questions.count()};});
        assert.deepEqual(result,{selected1:'',selected2:'',tree:[],formal:1});H.assertNoRuntimeErrors(h);
    }finally{await h.close();}
});
