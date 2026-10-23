const test = require('node:test');
const assert = require('node:assert/strict');
const Merge = require('../qisi-library-external-merge');
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
function setup(overrides = {}) {
    const state = Merge.createExternalState({ ref: value => ({ value }) });
    const messages = [], navigation = [], writes = [], refreshes = [];
    const external = [{ id: 'e1', stem: 'fixture' }];
    let changeVisit, stopCount = 0;
    const workspace = Merge.createWorkspace({ state,
        library: { async commitExternalMerge(command) { writes.push(command); return { summary: { added: 1 } }; } },
        repository: { async importExternalBatch(command) { writes.push(command); } },
        packages: { async read(file) { return { file }; }, project() { return { batch: { id: 'b1', sourceTeacher: 'fixture' }, questions: external }; } },
        model: { getMatchInfo: () => ({ status: 'new' }), copyQuestion: row => ({ id: 'q1', stem: row.stem }), fillQuestion: q => q },
        read: { externalQuestions: () => external, questions: () => [], pagedExternalQuestions: () => external, importBatches: () => [] },
        refresh: { async banks() { refreshes.push('banks'); }, async external() { refreshes.push('external'); } },
        notify: value => messages.push(value), confirm: () => true, navigate: value => navigation.push(value),
        defaultAction: () => 'add', clock: () => 100, random: () => 0.5,
        observeNavigation: callback => { changeVisit=callback; return () => {stopCount++;}; }, ...overrides });
    return {state, workspace, messages, navigation, writes, refreshes, external, changeVisit: () => changeVisit(), stopCount: () => stopCount};
}
function select(h) { h.state.selectedExternalIds.value=['e1']; assert.equal(h.workspace.openConfirm(),true); h.navigation.length=0; }

test('external workspace dispatches repeated merge clicks once and refreshes only both banks', async () => {
    const hold = deferred(); let writes = 0;
    const h = setup({ library: { async commitExternalMerge() { writes++; await hold.promise; return {summary:{added:1}}; } } });
    select(h); const first = h.workspace.commit(), second = h.workspace.commit();
    assert.equal(first, second); await Promise.resolve(); assert.equal(writes, 1);
    hold.resolve(); await first; assert.deepEqual(h.refreshes,['banks']); assert.deepEqual(h.navigation,['merged']);
    assert.deepEqual(h.state.selectedExternalIds.value,[]);
});
test('failed merge keeps selection and pending decisions without false refresh or success', async () => {
    const h=setup({library:{async commitExternalMerge(){throw new Error('DISK_FULL');}}}); select(h);
    const items=h.state.confirmItems.value;
    assert.equal(await h.workspace.commit(),false); assert.equal(h.state.confirmItems.value,items);
    assert.deepEqual(h.state.selectedExternalIds.value,['e1']); assert.deepEqual(h.refreshes,[]);
    assert.deepEqual(h.navigation,[]); assert.match(h.messages[0],/DISK_FULL/);
});
test('post-commit refresh failure reports durable import and prevents accidental resubmission', async () => {
    const h=setup({refresh:{async external(){throw new Error('READ_FAILED');}}});
    await h.workspace.preview({name:'one.zip'}); const result=await h.workspace.confirmImport();
    assert.deepEqual(result,{committed:true,refreshed:false}); assert.equal(h.writes.length,1);
    assert.equal(h.state.pendingImportPreview.value,null); assert.deepEqual(h.navigation,[]);
    assert.match(h.messages[0],/已写入.*刷新失败/); assert.doesNotMatch(h.messages[0],/未写入/);
    assert.equal(await h.workspace.confirmImport(),false); assert.equal(h.writes.length,1);
});
test('preview cancellation and newer selection reject late results; dispose removes its observer', async () => {
    const holds=[deferred(),deferred()]; let calls=0;
    const h=setup({packages:{read(){return holds[calls++].promise;}}});
    const first=h.workspace.preview({name:'one'}); h.workspace.cancelPreview();
    const second=h.workspace.preview({name:'two'}); holds[1].resolve({file:'two'}); await second;
    holds[0].resolve({file:'one'}); await first; assert.equal(h.state.pendingImportPreview.value.file,'two');
    h.workspace.dispose(); assert.equal(h.stopCount(),1); assert.equal(await h.workspace.commit(),false);
});
test('a completed old merge preserves new selection and does not navigate a newer page visit', async () => {
    const hold=deferred(); const h=setup({library:{async commitExternalMerge(){await hold.promise;return {summary:{added:1}};}}});
    select(h); const pending=h.workspace.commit(); await Promise.resolve(); h.changeVisit();
    const nextItems=[{externalId:'e2',question:{id:'e2'}}]; h.state.confirmItems.value=nextItems; h.state.selectedExternalIds.value.push('e2');
    hold.resolve(); await pending; assert.deepEqual(h.navigation,[]); assert.deepEqual(h.state.selectedExternalIds.value,['e2']);
    assert.equal(h.state.confirmItems.value,nextItems);
});
test('invalid selected IDs never open an empty confirmation page', () => {
    const h=setup(); h.state.selectedExternalIds.value=['missing'];
    assert.equal(h.workspace.openConfirm(),false); assert.deepEqual(h.navigation,[]); assert.equal(h.writes.length,0);
});

test('new knowledge input during pending merge survives completion without navigating away', async () => {
    const hold=deferred(); const h=setup({library:{async commitExternalMerge(){await hold.promise;return {summary:{added:1}};}}});
    select(h); const pending=h.workspace.commit(); await Promise.resolve();
    h.state.confirmItems.value[0].personalKnowledge='new input';
    hold.resolve();await pending;assert.equal(h.state.confirmItems.value[0].personalKnowledge,'new input');
    assert.deepEqual(h.navigation,[]);
});
test('unmount before dispatch prevents the queued write and observer cleanup is idempotent', async () => {
    const h=setup();select(h);const pending=h.workspace.commit();h.workspace.dispose();h.workspace.dispose();
    assert.equal(await pending,false);assert.equal(h.writes.length,0);assert.equal(h.stopCount(),1);
});
