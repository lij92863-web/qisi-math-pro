const test=require('node:test'),assert=require('node:assert/strict');const H=require('./browser-harness'),fixture=require('../fixtures/print-long-paper.json');
test('actual long PDF keeps each group heading with its first question and the last answer block together',{timeout:60000},async()=>{
    const h=await H.startBrowserApp(32911);let preview;try{
        h.page.on('dialog',d=>d.accept());await h.page.evaluate(async fixture=>{await db.images.put({id:'triangle',blob:new Blob([fixture.svg],{type:'image/svg+xml'})});await db.questions.bulkPut(fixture.questions);},fixture);
        await h.page.reload();await h.page.waitForFunction(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');return app?.questions.length===8&&app.editTplName;});
        for(const question of fixture.questions)await H.callProxy(h.page,'toggleCart',question.id);await H.callProxy(h.page,'openExamBuilder');
        await h.page.evaluate(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');Object.assign(app.examConfig,{title:'奇思数学 Pro · 合成打印验收卷',subtitle:'图形选项、长题、表格与题答分页',fontFamily:'思源宋体',fontSize:'小四',paperSize:'A4',showAnswer:false,showSolution:false,showAnswerGrid:true,answerGridCount:8,answerLineCount:0});app.exportMode='withAnswers';});
        const opened=h.context.waitForEvent('page');await h.page.getByRole('button',{name:'打印 PDF',exact:true}).click();preview=await opened;await preview.locator('#printBtn:not([disabled])').waitFor();
        const bytes=await preview.pdf({format:'A4',preferCSSPageSize:true,printBackground:true});
        const pages=await h.page.evaluate(async bytes=>{pdfjsLib.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.min.js';const task=pdfjsLib.getDocument({data:new Uint8Array(bytes)});try{const document=await task.promise,pages=[];for(let page=1;page<=document.numPages;page++){const content=await(await document.getPage(page)).getTextContent();pages.push(content.items.map(item=>item.str||'').join('').replace(/\s/g,''));}return pages;}finally{await task.destroy();}},Array.from(bytes));
        const headings=[['一、单选题','CHECK-Q1'],['二、多选题','CHECK-Q2'],['三、填空题','CHECK-Q3'],['四、解答题','CHECK-Q5'],['五、证明题','CHECK-Q8']];
        const orphans=headings.filter(([heading,marker])=>!pages.some(page=>page.includes(heading)&&page.includes(marker))).map(([heading])=>heading);
        const last=fixture.questions[7],lastAnswer=('8.'+last.answer+last.solution).replace(/\s/g,'');
        assert.deepEqual({orphanHeadings:orphans,lastAnswerWhole:pages.some(page=>page.includes(lastAnswer))},{orphanHeadings:[],lastAnswerWhole:true});
        for(let id=1;id<=8;id++){assert.ok(pages.some(page=>page.includes('CHECK-Q'+id)));assert.ok(pages.some(page=>page.includes('ANS-Q'+id)));}H.assertNoRuntimeErrors(h);
    }finally{if(preview)await preview.close();await h.close();}
});
