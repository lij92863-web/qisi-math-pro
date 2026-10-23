const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const H = require('./browser-harness');
const { installMineruReplay } = require('../harness/mineru-replay');
const { readSuite } = require('../../scripts/golden/run.cjs');
const root = path.resolve(__dirname, '../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

const allTables = page => page.evaluate(async () => {
    const database = new Dexie('QisiMathVueDB');
    await database.open();
    async function canonical(value) {
        if (value instanceof Blob) return { binaryType: value.type, bytes: Array.from(new Uint8Array(await value.arrayBuffer())) };
        if (value instanceof ArrayBuffer) return { arrayBuffer: Array.from(new Uint8Array(value)) };
        if (ArrayBuffer.isView(value)) return { view: value.constructor.name, bytes: Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)) };
        if (value instanceof Date) return { date: value.toISOString() };
        if (Array.isArray(value)) return Promise.all(value.map(canonical));
        // Optional undefined properties have no value in the JSON backup format.
        if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value)
            .filter(([, item]) => item !== undefined).map(async ([key, item]) => [key, await canonical(item)])));
        return value;
    }
    try {
        const rows = {};
        for (const table of Qisi.Backup.TABLE_NAMES) rows[table] = await canonical(await database.table(table).toArray());
        return rows;
    } finally { database.close(); }
});

test('full PDF import, edit, search, print, backup and isolated restore preserve 11 tables and image bytes', { timeout: 120000 }, async () => {
    const source = await H.startBrowserApp(33300);
    let target, preview;
    const safetyWrites = [];
    try {
        const suite = readSuite(path.join(root, 'golden/synthetic-suite.json'));
        assert.equal(suite.sha256, '720da3f4ab5db00216b6fb2d7b1c17f057b34fd6e3fd21be0a45e163e2a9ec66');
        const item = suite.suite.cases.find(row => row.id === 'pdf-dual-with-image');
        await installMineruReplay(source.page, item.sources.map(row => ({
            file: path.join(root, row.file), items: row.items,
            images: Object.fromEntries(Object.entries(row.assets || {}).map(([name, asset]) => [name, {
                type: asset.type, bytes: Buffer.from(asset.base64, 'base64')
            }]))
        })));
        const imported = await H.createImportThroughUi(source.page, { files: item.sources.map(row => ({
            file: path.join(root, row.file), roles: row.roles
        })) });
        assert.equal(imported.snapshot.drafts.length, 2);
        assert.equal(imported.snapshot.questions.length, 0);
        await H.callProxy(source.page, 'openBatchReview', imported.batchId);
        // Submit one question and keep the neighbouring question pending in the archive.
        const draft = imported.snapshot.drafts.find(q => q.questionNumber === '1');
        await H.callProxy(source.page, 'selectDraftQuestion', draft.id);
        for (const field of ['question', 'answer', 'solution']) await H.callProxy(source.page, 'choosePdfCandidate', field, 0);
        const editorSource = await source.page.evaluate(() => Qisi.Runtime.getRuntimeDependency('AppProxy').activeDraftEditorBuffer);
        await source.page.locator('.batch-latex-source-editor').fill('A1-DRAFT-EDIT\n\n' + editorSource);
        assert.equal(await H.callProxy(source.page, 'saveActiveDraftQuestion', { silent:true }), true);
        const savedDraft = (await H.getDbSnapshot(source.page)).drafts.find(row=>row.id===draft.id);
        assert.match(savedDraft.stem, /A1-DRAFT-EDIT/);
        assert.equal((await H.getDbSnapshot(source.page)).questions.length, 0);
        await H.callProxy(source.page, 'confirmDraftImages');
        await H.callProxy(source.page, 'markDraftReviewed');
        assert.equal((await H.getDbSnapshot(source.page)).questions.length, 0);
        assert.equal(await H.callProxy(source.page, 'submitDraftQuestion', draft.id, true), true);
        const beforeFormalEdit = await allTables(source.page);
        const formal = beforeFormalEdit.questions[0];
        await H.callProxy(source.page, 'saveEditedQuestion', formal.id, formal.stem+'\n\nA1-CHAIN-EDIT', formal.images,
            formal.grade, formal.type, formal.diff, formal.answer, formal.solution,
            Array.isArray(formal.tags)?formal.tags.join(','):String(formal.tags||''),formal.options,formal.knowledge||'',formal.systemKnowledge||'',formal.personalKnowledge||'');
        const afterFormalEdit = await allTables(source.page);
        assert.match(afterFormalEdit.questions[0].stem,/A1-CHAIN-EDIT/);
        assert.equal(afterFormalEdit.questions[0].answer,formal.answer);assert.equal(afterFormalEdit.questions[0].solution,formal.solution);
        for(const table of Object.keys(beforeFormalEdit).filter(name=>name!=='questions'))assert.deepEqual(afterFormalEdit[table],beforeFormalEdit[table]);
        await source.page.getByRole('button',{name:'题库与检索',exact:true}).click();
        await source.page.getByPlaceholder('搜索题干、答案、解析',{exact:true}).fill('A1-NONEXISTENT-SEARCH-MARKER');
        await source.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').filteredQuestions.length===0);
        await source.page.getByPlaceholder('搜索题干、答案、解析',{exact:true}).fill('A1-CHAIN-EDIT');
        await source.page.waitForFunction(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');return app.filteredQuestions.length===1&&app.filteredQuestions[0].stem.includes('A1-CHAIN-EDIT');});
        await source.page.getByPlaceholder('搜索题干、答案、解析',{exact:true}).fill('');
        await source.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').librarySearchInput==='');
        await source.page.evaluate(()=>{Qisi.Runtime.getRuntimeDependency('AppProxy').personalL1Name='A1 personal tree';});
        assert.equal(await H.callProxy(source.page,'createPersonalL1'),true);
        await H.callProxy(source.page,'triggerNewCustomTemplate');
        await source.page.evaluate(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');app.editTplName='A1 portable template';app.examConfig.fontFamily='霞鹜文楷';app.examConfig.fontSize='四号';});
        assert.equal(await H.callProxy(source.page,'saveNewCustomTemplate'),true);
        const savedTemplate=await source.page.evaluate(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').customTemplates[0]);
        await H.callProxy(source.page,'selectCustomTemplate',savedTemplate);
        await H.callProxy(source.page,'toggleCart',formal.id);await H.callProxy(source.page,'openExamBuilder');
        await source.page.evaluate(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');app.exportMode='questions';app.examConfig.showAnswer=false;app.examConfig.showSolution=false;});
        const sourceOpening=source.context.waitForEvent('page');await source.page.getByRole('button',{name:'打印 PDF',exact:true}).click();preview=await sourceOpening;
        await preview.locator('#printBtn:not([disabled])').waitFor();assert.match(await preview.locator('.question-flow-body').textContent(),/A1-CHAIN-EDIT/);
        assert.equal(await preview.locator('.missing-image,.latex-render-error').count(),0);await preview.close();preview=null;
        const original = await allTables(source.page);
        assert.equal(Object.keys(original).length, 11);
        assert.equal(original.questions.length, 1);
        assert.equal(original.images.length, 1);
        assert.equal(original.customTemplates.length, 1);assert.equal(original.personalKnowledge.length, 1);
        assert.equal(original.customTemplates[0].config.fontFamily,'霞鹜文楷');assert.equal(original.customTemplates[0].config.fontSize,'四号');
        assert.equal(original.draftQuestions.length, 2);
        assert.equal(original.draftImportFiles.length, 2);
        assert.equal(original.draftQuestions.find(q => q.questionNumber === '2').status, 'pending');
        await source.page.getByRole('button', { name: '题库与检索', exact: true }).click();
        const downloading = source.page.waitForEvent('download');
        await source.page.getByRole('button', { name: '下载完整备份', exact: true }).click();
        let download;
        try { download = await downloading; }
        catch (error) {
            const status = await source.page.evaluate(() => {
                const state = Qisi.Runtime.getRuntimeDependency('AppProxy').backupStatus;
                return { error: state.error, notice: state.notice, busy: state.busy, reading: state.reading };
            });
            throw new Error(error.message + '\nBackup UI status: ' + JSON.stringify(status), { cause: error });
        }
        assert.equal(await download.failure(), null);
        const bytes = await fs.readFile(await download.path());
        assert.ok(bytes.length > 0);
        assert.deepEqual(await allTables(source.page), original);

        target = await H.startBrowserApp(33301);
        assert.notEqual(target.origin, source.origin);
        await target.page.exposeFunction('captureSyntheticSafetyArchive', async (name, array) => safetyWrites.push({ name, bytes: Buffer.from(array) }));
        await target.context.addInitScript(() => {
            window.__testPrintCalls = 0;
            window.print = () => { window.__testPrintCalls += 1; };
            const files = new Map();
            window.showDirectoryPicker = async () => ({ name: 'synthetic-isolated-safety-folder', getFileHandle: async (name, options) => {
                if (!files.has(name) && !options?.create) throw new DOMException('missing', 'NotFoundError');
                if (!files.has(name)) files.set(name, null);
                return { createWritable: async () => {
                    if (files.get(name)) throw Error('Cannot overwrite a synthetic safety archive');
                    let blob;
                    return { write: async value => { blob = value; }, close: async () => {
                        files.set(name, blob);
                        await window.captureSyntheticSafetyArchive(name, Array.from(new Uint8Array(await blob.arrayBuffer())));
                    }, abort: async () => {} };
                } };
            } });
        });
        await target.page.reload();
        await target.page.waitForFunction(() => Boolean(window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')));
        const empty = await allTables(target.page);
        assert.equal(empty.questions.length, 0);
        assert.equal(empty.draftQuestions.length, 0);
        await target.page.getByRole('button', { name: '题库与检索', exact: true }).click();
        await target.page.getByTestId('restore-file').setInputFiles({ name: 'synthetic-full-backup.zip', mimeType: 'application/zip', buffer: bytes });
        await target.page.getByTestId('restore-preview').waitFor();
        assert.equal(await target.page.getByTestId('restore-confirm').isDisabled(), true);
        assert.deepEqual(await allTables(target.page), empty);
        await target.page.getByRole('button', { name: '选择备份文件夹', exact: true }).click();
        await target.page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy').backupStatus.lastBackupAt > 0);
        await target.page.getByTestId('restore-consent').check();
        await target.page.getByTestId('restore-word').fill('恢复备份');
        assert.equal(await target.page.getByTestId('restore-confirm').isDisabled(), false);
        await Promise.all([
            target.page.waitForEvent('framenavigated', frame => frame === target.page.mainFrame()),
            target.page.getByTestId('restore-confirm').click()
        ]);
        await target.page.waitForFunction(() => Boolean(window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')));
        assert.deepEqual(await allTables(target.page), original);
        assert.deepEqual(await allTables(source.page), original);
        const safety = safetyWrites.find(row => row.name.includes('before-restore'));
        assert.ok(safety, 'A complete safety archive must be persisted before restore');
        const safetyQuestions = await target.page.evaluate(async array => {
            const decoded = await Qisi.Backup.readFullDatabaseBackupBlob(new Blob([new Uint8Array(array)], { type: 'application/zip' }));
            return decoded.backup.tables.questions;
        }, Array.from(safety.bytes));
        assert.deepEqual(safetyQuestions, empty.questions);
        await target.page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy').questions.length === 1);
        await target.page.waitForFunction(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');return app.personalKnowledgeTree.length===1&&app.customTemplates.length===1;});
        const restoredOwners=await target.page.evaluate(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');return {tree:app.personalKnowledgeTree,template:app.customTemplates[0],cart:app.cart};});
        assert.deepEqual(restoredOwners.tree,original.personalKnowledge[0].nodes);assert.deepEqual(restoredOwners.template,original.customTemplates[0]);
        await H.callProxy(target.page,'selectCustomTemplate',restoredOwners.template);
        assert.deepEqual(await target.page.evaluate(()=>{const app=Qisi.Runtime.getRuntimeDependency('AppProxy');return {font:app.examConfig.fontFamily,size:app.examConfig.fontSize};}),{font:'霞鹜文楷',size:'四号'});
        if(!restoredOwners.cart.includes(original.questions[0].id))await H.callProxy(target.page,'toggleCart',original.questions[0].id);
        await H.callProxy(target.page, 'openExamBuilder');
        await target.page.getByRole('button', { name: '只打印题目', exact: true }).click();
        const opening = target.context.waitForEvent('page');
        await target.page.getByRole('button', { name: '打印 PDF', exact: true }).click();
        preview = await opening;
        await preview.locator('#printBtn:not([disabled])').waitFor();
        const printed = await preview.evaluate(async () => {
            await Promise.all([...document.images].map(img => img.decode()));
            return { questions: document.querySelectorAll('.exam-question').length,
                text: document.querySelector('.exam-question')?.textContent,
                images: [...document.images].map(img => ({ url: img.src, width: img.naturalWidth, height: img.naturalHeight })),
                errors: document.querySelectorAll('.missing-image,.latex-render-error').length,
                printCalls: window.__testPrintCalls || 0 };
        });
        assert.equal(printed.questions, 1);
        assert.match(printed.text, /第一题/);
        assert.equal(printed.images.length, 1);
        assert.ok(printed.images[0].width > 0 && printed.images[0].height > 0);
        const asset = Object.values(item.sources[0].assets)[0];
        assert.equal(hash(Buffer.from(printed.images[0].url.split(',')[1], 'base64')), hash(Buffer.from(asset.base64, 'base64')));
        assert.equal(printed.errors, 0);
        assert.equal(printed.printCalls, 0);
        assert.deepEqual(await allTables(target.page), original);
        H.assertNoRuntimeErrors(source);
        H.assertNoRuntimeErrors(target);
        if (process.env.QISI_BACKUP_PORTABILITY_EVIDENCE_DIR) {
            const directory = path.resolve(process.env.QISI_BACKUP_PORTABILITY_EVIDENCE_DIR);
            assert.ok(directory.startsWith(path.join(root, 'local-run-artifacts') + path.sep));
            await fs.mkdir(directory, { recursive: true });
            await fs.writeFile(path.join(directory, 'synthetic-backup.zip'), bytes, { flag: 'wx' });
            await fs.writeFile(path.join(directory, 'restored-print.png'), await preview.screenshot({ fullPage: true }), { flag: 'wx' });
            await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify({ ok: true, syntheticOnly: true,
                sourceOrigin: source.origin, restoredOrigin: target.origin, suiteSha256: suite.sha256,
                archiveSha256: hash(bytes), archiveBytes: bytes.length,
                tableCounts: Object.fromEntries(Object.entries(original).map(([table, rows]) => [table, rows.length])),
                allDefinedValuesAndBinaryBytesRetained: true, pendingNeighbourRetained: true,
                draftEditConfirmedBeforeAdmission:true,formalEditAndSearchVerified:true,sourcePrintBeforeBackup:true,personalTreeAndTemplateRestored:true,
                safetyArchivePersistedBeforeRestore: true, restoredPrintImageMatchesSourceBytes: true,
                systemPrintPerformed: false, realAiOcrCalls: 0, productionUserDataWritten: false,
                limit: 'Undefined optional object properties are omitted as in JSON. Synthetic portability proof only; no real-paper or production-database certification.'
            }, null, 2), { flag: 'wx' });
        }
    } finally {
        try { if (preview) await preview.close(); }
        finally { try { if (target) await target.close(); } finally { await source.close(); } }
    }
});
