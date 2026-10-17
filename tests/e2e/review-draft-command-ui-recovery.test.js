const test = require('node:test');
const assert = require('node:assert/strict');

const {
    startBrowserApp,
    callProxy,
    seedReviewBatch,
    getDbSnapshot,
    clearE2eData,
    assertNoRuntimeErrors
} = require('./browser-harness.js');

test('review draft command failure preserves unsaved input and shows a UI error', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32109);
    const { page } = harness;

    try {
        const batchId = await seedReviewBatch(page, {
            batchId: 'e2e_review_command_failure'
        });
        await page.evaluate(async () => {
            const proxy = window.Qisi.Runtime
                .getRuntimeDependency('AppProxy');
            proxy.view = 'batchImport';
            await proxy.openBatchList();
        });
        await callProxy(page, 'openBatchReview', batchId);
        await page.locator('.batch-latex-source-editor').waitFor();

        await page.evaluate(() => {
            window.__qisiOriginalDraftPersistenceService =
                window.Qisi.DraftPersistenceService;
            window.Qisi.DraftPersistenceService = Object.freeze({
                ...window.Qisi.DraftPersistenceService,
                persistReviewDraftCommand: async () => {
                    const error = new Error('fixture write failure');
                    error.code = 'DRAFT_PERSISTENCE_WRITE_FAILED';
                    throw error;
                }
            });
        });

        await page.locator('.batch-latex-source-editor').fill(
            '1. This edit must roll back\nA. One\nB. Two\nC. Three\nD. Four'
        );
        await callProxy(page, 'saveActiveDraftQuestion');

        await page.waitForFunction(() =>
            document.querySelector('.batch-toast')?.textContent
                ?.includes('DRAFT_PERSISTENCE_WRITE_FAILED')
        );
        assert.match(
            await page.locator('.batch-latex-source-editor').inputValue(),
            /This edit must roll back/ // User-authorized N7 fix: retain editor input; DB rollback assertions below remain.
        );
        const snapshot = await getDbSnapshot(page);
        const draft = snapshot.drafts.find(item =>
            item.batchId === 'e2e_review_command_failure'
        );
        assert.match(draft.stem, /E2E original stem/);
        assert.doesNotMatch(draft.stem, /must roll back/);
        assert.equal(snapshot.questions.length, 0);
        await callProxy(page, 'discardActiveDraftEditorChanges');
        assert.match(await page.locator('.batch-latex-source-editor').inputValue(), /E2E original stem/);
        assert.match(await page.evaluate(() => window.Qisi.Runtime.getRuntimeDependency('AppProxy').activeDraftQuestion.stem), /E2E original stem/);

        await page.evaluate(() => {
            window.Qisi.DraftPersistenceService =
                window.__qisiOriginalDraftPersistenceService;
            delete window.__qisiOriginalDraftPersistenceService;
        });
        assertNoRuntimeErrors(harness);
        await clearE2eData(page);
    } finally {
        await harness.close();
    }
});


test('N5/N6 metadata-only edits remain dirty, protect unload and persist before confirmation', {timeout:90000}, async()=>{
 const h=await startBrowserApp(32119),{page}=h;
 try{
  const id=await seedReviewBatch(page,{batchId:'e2e_findings_metadata'});
  await page.evaluate(async()=>{const p=window.Qisi.Runtime.getRuntimeDependency('AppProxy');p.view='batchImport';await p.openBatchList();});
  await callProxy(page,'openBatchReview',id);await page.locator('.batch-latex-source-editor').waitFor();
  const result=await page.evaluate(()=>{
   const p=window.Qisi.Runtime.getRuntimeDependency('AppProxy');p.activeDraftQuestion.year='2031';p.activeDraftSourceLabel='Edited source';
   return {dirty:p.activeDraftEditorDirty};
  });assert.equal(result.dirty,true);
  assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;}),true);
  await callProxy(page,'markDraftReviewed');const snapshot=await getDbSnapshot(page),q=snapshot.drafts.find(q=>q.batchId===id);
  assert.equal(q.year,'2031');assert.equal(q.meta.year,'2031');assert.equal(q.meta.source,'Edited source');assert.equal(q.source.mode,'docx-deterministic');assert.equal(q.status,'reviewed');
  assert.equal(await page.evaluate(()=>window.Qisi.Runtime.getRuntimeDependency('AppProxy').activeDraftEditorDirty),false);
  assertNoRuntimeErrors(h);await clearE2eData(page);
 }finally{await h.close();}
});
