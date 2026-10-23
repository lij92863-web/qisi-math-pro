const test=require('node:test');
const assert=require('node:assert/strict');
const H=require('./browser-harness');
const fixture=[{id:'choice-a',stem:'FIRST CHOICE',type:'单选题',answer:'A',solution:'FIRST SOLUTION'},
    {id:'choice-b',stem:'SECOND CHOICE',type:'单选题',answer:'B',solution:'SECOND SOLUTION'},
    {id:'long',stem:'LONG QUESTION',type:'解答题',answer:'LONG ANSWER',solution:'LONG SOLUTION'}].map(q=>({...q,images:[],options:[],meta:{},createdAt:1}));
async function setup(port){const h=await H.startBrowserApp(port);h.page.on('dialog',d=>d.accept());await h.page.evaluate(async rows=>db.questions.bulkPut(rows),fixture);await h.page.reload();
    await h.page.waitForFunction(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');return app?.questions.length===3&&app.editTplName;});
    for(const id of ['choice-a','choice-b'])await H.callProxy(h.page,'toggleCart',id);await H.callProxy(h.page,'openExamBuilder');return h;}
test('actual zero-point assignment survives group sync and totals exactly zero for that question',{timeout:35000},async()=>{
    const h=await setup(32891);try{
        const result=await h.page.evaluate(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');app.examGroupConfig['单选题'].points=5;app.examQuestionMeta['choice-b'].points=5;app.examQuestionMeta['choice-a'].points=0;app.syncExamGroups();return {points:app.examQuestionMeta['choice-a'].points,total:app.activeExamGroups[0].total,other:app.examQuestionMeta['choice-b'].points};});
        assert.equal(result.points,0);assert.equal(result.total,result.other);H.assertNoRuntimeErrors(h);
    }finally{await h.close();}
});
test('actual pointer cancellation preserves order and releases pointer listeners and drag styles',{timeout:35000},async()=>{
    const h=await setup(32892);try{
        await h.page.evaluate(()=>{window.dragListeners=new Map();const add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document);for(const type of ['pointermove','pointerup','pointercancel'])window.dragListeners.set(type,new Set());
            document.addEventListener=(type,fn,...args)=>{window.dragListeners.get(type)?.add(fn);return add(type,fn,...args);};document.removeEventListener=(type,fn,...args)=>{window.dragListeners.get(type)?.delete(fn);return remove(type,fn,...args);};});
        const first=await h.page.locator('[data-exam-qid="choice-a"]').boundingBox(),second=await h.page.locator('[data-exam-qid="choice-b"]').boundingBox();
        await h.page.mouse.move(first.x+80,first.y+35);await h.page.mouse.down();await h.page.mouse.move(second.x+80,second.y+second.height-2,{steps:6});
        await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').draggingExamQuestionId==='choice-a');
        await h.page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true})));await h.page.mouse.up();
        const result=await h.page.evaluate(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');return {cart:app.cart,dragging:app.draggingExamQuestionId,listeners:[...window.dragListeners.values()].reduce((n,set)=>n+set.size,0),active:document.body.classList.contains('exam-drag-active')};});
        assert.deepEqual(result,{cart:['choice-a','choice-b'],dragging:'',listeners:0,active:false});
        const drag = async (from,to) => {
            const source=await h.page.locator('[data-exam-qid="'+from+'"]').boundingBox(),target=await h.page.locator('[data-exam-qid="'+to+'"]').boundingBox();
            await h.page.mouse.move(source.x+80,source.y+35);await h.page.mouse.down();await h.page.mouse.move(target.x+80,target.y+target.height-2,{steps:6});
            await h.page.waitForFunction(id=>Qisi.Runtime.getRuntimeDependency('AppProxy').draggingExamQuestionId===id,from);
        };
        await drag('choice-a','choice-b');await h.page.mouse.up();await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').cart[0]==='choice-b');
        await h.page.waitForFunction(()=>!document.body.classList.contains('exam-drag-active'));
        await drag('choice-b','choice-a');await h.page.evaluate(()=>{Qisi.Runtime.getRuntimeDependency('AppProxy').view='library';});await h.page.mouse.up();
        const ended=await h.page.evaluate(()=>({cart:Qisi.Runtime.getRuntimeDependency('AppProxy').cart,listeners:[...window.dragListeners.values()].reduce((n,set)=>n+set.size,0),active:document.body.classList.contains('exam-drag-active')}));
        assert.deepEqual(ended,{cart:['choice-b','choice-a'],listeners:0,active:false});H.assertNoRuntimeErrors(h);
    }finally{await h.close();}
});
test('actual printing uses the paper captured before asynchronous image preparation',{timeout:40000},async()=>{
    const h=await setup(32893);try{
        await h.page.addInitScript(()=>{
            window.paperPrepared=false;window.paperGate=new Promise(resolve=>window.releasePaper=resolve);window.Qisi=window.Qisi||{};
            Object.defineProperty(window.Qisi,'PrintResources',{configurable:true,set(owner){Object.defineProperty(window.Qisi,'PrintResources',{configurable:true,value:{...owner,
                createPrintWorkspace(options){return owner.createPrintWorkspace({...options,hydrate:async command=>{window.paperPrepared=true;await window.paperGate;return owner.hydrateQuestionsForPrint(command);}});}
            }});}});
        });
        await h.page.reload();await h.page.waitForFunction(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');return app?.cart.length===2&&app.editTplName;});
        await h.page.evaluate(()=>{
            const app=Qisi.Runtime.getRuntimeDependency('AppProxy');app.examConfig.title='CAPTURED TITLE';app.examQuestionMeta['choice-a'].note='CAPTURED NOTE';app.exportMode='withAnswers';});
        const opened=h.context.waitForEvent('page',{timeout:10000});await h.page.getByRole('button',{name:'打印 PDF',exact:true}).click();await h.page.waitForFunction(()=>window.paperPrepared);
        await h.page.evaluate(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');app.examConfig.title='LATER TITLE';app.examQuestionMeta['choice-a'].note='LATER NOTE';app.exportMode='questions';app.moveCartQuestion('choice-b',-1);window.releasePaper();});
        const preview=await opened;await preview.locator('#printBtn:not([disabled])').waitFor();
        const result=await preview.evaluate(()=>({title:document.querySelector('.title').textContent,notes:[...document.querySelectorAll('.q-note')].map(el=>el.textContent),stems:[...document.querySelectorAll('.question-flow-body')].map(el=>el.textContent),answers:document.querySelectorAll('.answer-section').length}));
        assert.equal(result.title,'CAPTURED TITLE');assert.deepEqual(result.notes,['CAPTURED NOTE']);assert.match(result.stems[0],/FIRST CHOICE/);assert.equal(result.answers,1);H.assertNoRuntimeErrors(h);
    }finally{await h.close();}
});

test('actual mixed-type paper and answer numbering follow the same captured order',{timeout:35000},async()=>{
    const h=await setup(32894);try{
        await H.callProxy(h.page,'toggleCart','long');
        await h.page.evaluate(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');app.cart=['long','choice-b','choice-a'];app.exportMode='withAnswers';});
        const opened=h.context.waitForEvent('page',{timeout:10000});await h.page.getByRole('button',{name:'打印 PDF',exact:true}).click();const preview=await opened;await preview.locator('#printBtn:not([disabled])').waitFor();
        const result=await preview.evaluate(()=>({stems:[...document.querySelectorAll('.question-flow-body')].map(el=>el.textContent),answers:[...document.querySelectorAll('.answer-item')].map(el=>el.textContent)}));
        assert.match(result.stems[0],/SECOND CHOICE/);assert.match(result.stems[1],/FIRST CHOICE/);assert.match(result.stems[2],/LONG QUESTION/);
        assert.match(result.answers[0],/^1\.\s*B/);assert.match(result.answers[1],/^2\.\s*A/);assert.match(result.answers[2],/^3\.\s*LONG ANSWER/);H.assertNoRuntimeErrors(h);
    }finally{await h.close();}
});
