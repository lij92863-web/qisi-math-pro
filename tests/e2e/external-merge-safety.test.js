const test = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const H = require('./browser-harness');

for (const [index, valid] of [true, false].entries()) {
    test(`actual external fill image association: ${valid ? 'durable and visible' : 'missing declaration refuses all writes'}`, { timeout: 45000 }, async () => {
        const h = await H.startBrowserApp(32955 + index);
        try {
            const dialogs = []; h.page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
            await h.page.evaluate(async valid => {
                const base = { stem: '合成补全题', type: '填空题', options: [], answer: '1', meta: {} };
                await db.questions.put({ ...base, id: 'local', solution: '', images: [], createdAt: 1, updatedAt: 1 });
                const bytes = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));
                await db.images.put({ id: 'fill-image', blob: new Blob([bytes], { type: 'image/gif' }), createdAt: 1 });
                await db.externalQuestions.put({ ...base, id: 'external', batchId: 'batch', importedAt: 1, processStatus: 'unprocessed',
                    solution: '解析 [[IMAGE:fill-image]]', images: valid ? [{ id: 'fill-image', align: 'center' }] : [] });
                await db.importBatches.put({ id: 'batch', importedAt: 1 });
            }, valid);
            await h.page.reload();
            await h.page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy')?.externalQuestions.length === 1);
            await h.page.evaluate(() => { Qisi.Runtime.getRuntimeDependency('AppProxy').selectedExternalIds = ['external']; });
            await H.callProxy(h.page, 'openExternalConfirmPage');
            assert.equal(await h.page.evaluate(() => Qisi.Runtime.getRuntimeDependency('AppProxy').confirmItems[0].action), 'fill');
            const feedback = h.page.waitForEvent('dialog');
            await h.page.getByRole('button', { name: '确认加入', exact: true }).first().click();
            await feedback;
            if (valid) {
                await H.callProxy(h.page, 'videoNav', 'library');
                await H.callProxy(h.page, 'switchLibraryKnowledgeMode', 'system');
                const card = h.page.locator('.library-layout .question-card').filter({ hasText: '合成补全题' });
                await card.getByRole('button', { name: '解析', exact: true }).click();
                await card.locator('img[alt="题图"]').evaluate(async img => { await img.decode(); });
            }
            const result = await h.page.evaluate(async () => {
                const row = await db.questions.get('local'), external = await db.externalQuestions.get('external');
                return { row, external, merges: await db.mergeBatches.count(), count: await db.questions.count() };
            });
            assert.equal(result.count, 1);
            if (valid) {
                assert.equal(result.row.solution, '解析 [[IMAGE:fill-image]]');
                assert.equal(result.row.images[0].id, 'fill-image');assert.equal(result.row.images[0].url, undefined);
                assert.equal(result.external.processStatus, 'filled');assert.equal(result.merges, 1);
                await H.callProxy(h.page, 'undoLatestExternalMerge');
                assert.deepEqual(await h.page.evaluate(async () => { const q = await db.questions.get('local'); return [q.solution, q.images]; }), ['', []]);
            } else {
                assert.equal(result.row.solution, '');assert.deepEqual(result.row.images, []);
                assert.equal(result.external.processStatus, 'unprocessed');assert.equal(result.merges, 0);
                assert.ok(dialogs.some(message => message.includes('图片引用缺失或冲突')));
            }
            H.assertNoRuntimeErrors(h);
        } finally { await h.close(); }
    });
}

test('actual ZIP file input keeps remapped picture references and bytes consistent with raw evidence preserved', { timeout: 45000 }, async () => {
    const h = await H.startBrowserApp(32865);
    try {
        h.page.on('dialog', d => d.accept());
        const bytes = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        const zip = new JSZip();
        zip.file('manifest.json', JSON.stringify({ packageType: 'qisi-question-bank', createdBy: { name: 'L2 fixture' } }));
        zip.file('questions.json', JSON.stringify([{ id: 'source', type: '选择题', stem: '图 [[IMAGE:old]]',
            options: ['[[FORMULA_IMAGE:old]]', 'B'], answer: '[[IMAGE:old]]', solution: '\\includegraphics{old}',
            rawText: 'raw [[IMAGE:old]]', images: [{ id: 'old', file: 'images/old.gif' }] }]));
        zip.file('images/old.gif', bytes);
        await h.page.evaluate(() => { Qisi.Runtime.getRuntimeDependency('AppProxy').view = 'library'; });
        await h.page.locator('input[type=file][accept=".zip"]').setInputFiles({ name: 'L2-fixture.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) });
        await h.page.getByRole('button', { name: '确认导入', exact: true }).click();
        await h.page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy').externalQuestions.length === 1);
        const result = await h.page.evaluate(async () => {
            const q = (await db.externalQuestions.toArray())[0], image = await db.images.get(q.images[0].id);
            return { q, bytes: Array.from(new Uint8Array(await image.blob.arrayBuffer())), formal: await db.questions.count() };
        });
        const id = result.q.images[0].id;
        assert.notEqual(id, 'old'); assert.equal(result.q.stem, `图 [[IMAGE:${id}]]`);
        assert.equal(result.q.options[0], `[[FORMULA_IMAGE:${id}]]`);
        assert.equal(result.q.answer, `[[IMAGE:${id}]]`); assert.equal(result.q.solution, `\\includegraphics{${id}}`);
        assert.equal(result.q.rawText, 'raw [[IMAGE:old]]'); assert.deepEqual(result.bytes, [...bytes]);
        assert.equal(result.formal, 0); H.assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});

test('actual merge then teacher edit then undo preserves the edited formal question', { timeout: 45000 }, async () => {
    const h = await H.startBrowserApp(32866);
    try {
        const dialogs = []; h.page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
        await h.page.evaluate(async () => {
            await db.externalQuestions.put({ id: 'e1', batchId: 'b1', stem: '合成外来题', answer: '1', options: [], images: [], type: '填空题', importedAt: 1 });
            await db.importBatches.put({ id: 'b1', importedAt: 1 });
        });
        await h.page.reload();
        await h.page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy')?.externalQuestions.length === 1);
        await h.page.evaluate(() => { const app = Qisi.Runtime.getRuntimeDependency('AppProxy'); app.selectedExternalIds = ['e1']; });
        await H.callProxy(h.page, 'openExternalConfirmPage');
        await h.page.getByRole('button', { name: '确认加入', exact: true }).first().click();
        await h.page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy').questions.length === 1);
        const q = (await H.getDbSnapshot(h.page)).questions[0];
        await H.callProxy(h.page, 'saveEditedQuestion', q.id, '教师后续编辑', [], q.meta.grade, q.type, q.meta.diff, q.answer, q.solution, '', q.options, '', '', '');
        await H.callProxy(h.page, 'undoLatestExternalMerge');
        const after = (await H.getDbSnapshot(h.page)).questions;
        assert.equal(after.length, 1); assert.equal(after[0].stem, '教师后续编辑');
        assert.ok(dialogs.some(message => message.startsWith('撤销失败')));
        assert.equal(await h.page.evaluate(() => db.mergeBatches.filter(b => b.revertedAt > 0).count()), 0);
    } finally { await h.close(); }
});

for (const [index, mode] of ['double-click', 'storage-failure', 'readback-failure', 'new-page'].entries()) {
    test(`actual external confirmation coordination: ${mode}`, { timeout: 45000 }, async () => {
        const h=await H.startBrowserApp(32867+index);
        try {
            const dialogs=[]; h.page.on('dialog',async d=>{dialogs.push(d.message());await d.accept();});
            await h.page.addInitScript(mode=>{
                window.auditMergeCalls=0; window.auditMergeMode=mode; window.auditBankReads=[];
                window.auditMergeGate=new Promise(resolve=>{window.auditReleaseMerge=resolve;});
                window.Qisi=window.Qisi||{};
                Object.defineProperty(window.Qisi,'LibraryService',{configurable:true,set(owner){
                    Object.defineProperty(window.Qisi,'LibraryService',{configurable:true,value:{...owner,createLibraryService(...args){
                        const service=owner.createLibraryService(...args);
                        return {...service,async commitExternalMerge(command){
                            window.auditMergeCalls++; await window.auditMergeGate;
                            if(window.auditMergeMode==='storage-failure')throw new Error('MERGE_WRITE_REFUSED');
                            const result=await service.commitExternalMerge(command);
                            window.auditMergeCommitted=true;return result;
                        }};
                    }}});
                }});
                Object.defineProperty(window.Qisi,'StorageRepository',{configurable:true,set(owner){
                    Object.defineProperty(window.Qisi,'StorageRepository',{configurable:true,value:{...owner,createRepository(...args){
                        const repository=owner.createRepository(...args);
                        return {...repository,async listTable(name,...rest){
                            window.auditBankReads.push(name);
                            if(window.auditMergeCommitted&&window.auditMergeMode==='readback-failure'&&name==='externalQuestions')throw new Error('MERGE_READ_FAILED');
                            return repository.listTable(name,...rest);
                        }};
                    }}});
                }});
            },mode);
            await h.page.reload(); await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy'));
            await h.page.evaluate(async()=>{
                await db.externalQuestions.put({id:'fixture-e',batchId:'fixture-b',stem:'协调测试题',answer:'2',options:[],images:[],type:'填空题',importedAt:1});
                await db.importBatches.put({id:'fixture-b',importedAt:1});
            });
            await h.page.reload(); await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy')?.externalQuestions.length===1);
            await h.page.evaluate(()=>{Qisi.Runtime.getRuntimeDependency('AppProxy').selectedExternalIds=['fixture-e'];window.auditBankReads=[];});
            await H.callProxy(h.page,'openExternalConfirmPage');
            const button=h.page.getByRole('button',{name:'确认加入',exact:true}).first();
            await button.click(); await h.page.waitForFunction(()=>window.auditMergeCalls===1);
            if(mode==='double-click')await button.click();
            if(mode==='new-page')await h.page.evaluate(()=>{Qisi.Runtime.getRuntimeDependency('AppProxy').view='entry';});
            await h.page.evaluate(()=>window.auditReleaseMerge());
            await h.page.waitForFunction(mode=>{
                const app=Qisi.Runtime.getRuntimeDependency('AppProxy');
                return mode==='storage-failure'?window.auditMergeCalls===1:
                    mode==='readback-failure'?window.auditBankReads.includes('externalQuestions'):app.questions.length===1;
            },mode);
            // Observe the command's settled result through the retained page task, without invoking it again.
            await h.page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
            const result=await h.page.evaluate(async()=>{
                const app=Qisi.Runtime.getRuntimeDependency('AppProxy');
                return {calls:window.auditMergeCalls,formal:await db.questions.count(),audits:await db.mergeBatches.count(),
                    selected:[...app.selectedExternalIds],decisions:app.confirmItems.length,view:app.view,reads:window.auditBankReads};
            });
            assert.equal(result.calls,1);
            if(mode==='storage-failure'){
                assert.equal(result.formal,0);assert.equal(result.audits,0);assert.deepEqual(result.selected,['fixture-e']);
                assert.equal(result.decisions,1);assert.ok(dialogs.some(text=>text.includes('MERGE_WRITE_REFUSED')));
            }else{
                assert.equal(result.formal,1);assert.equal(result.audits,1);assert.equal(result.decisions,0);
                assert.ok(!result.reads.includes('customTemplates'));assert.ok(!result.reads.includes('personalKnowledge'));
                if(mode==='readback-failure')assert.ok(dialogs.some(text=>/已写入.*刷新失败/.test(text)));
                if(mode==='new-page')assert.equal(result.view,'entry');
            }
        }finally{await h.close();}
    });
}

