const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
    actionManifest,
    stableActionId
} = require('./ui-action-acceptance-manifest');

const ROOT = path.resolve(__dirname, '..');
const MAIN_HTML = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');

const EXPECTED_OWNER_COUNTS = Object.freeze({
    shared: 21,
    entry: 19,
    review: 40,
    library: 22,
    settings: 7,
    exam: 8
});

const EXPECTED_CONFIRM_EXPRESSIONS = Object.freeze([
    'clearBatchDraftWorkspace',
    'clearCart',
    'confirmAddExternalToPersonal',
    'confirmImportBankPreview',
    'createDraftImportBatch',
    'deleteBatchImport(batch.id)',
    'deleteDraftImage(img.id)',
    'deleteExternalBatch(batch.id)',
    'deletePersonalRow(row)',
    'deleteUnassignedImage(img.id)',
    'handleDelete',
    'removeBatchCreateFile(file.id)',
    'rerunActiveBatchRecognition',
    'selectDraftQuestion(q.id)',
    'undoLatestExternalMerge'
].sort());

const EXPECTED_PROMPT_EXPRESSIONS = Object.freeze([
    'addPersonalChild(row)',
    'exportQuestionBankPackage',
    'renamePersonalNode(row.node)'
].sort());

const EXPECTED_FILE_CHOOSER_EXPRESSIONS = Object.freeze([
    '$refs.entryImgInput.click()',
    '$refs.ocrInput.click()',
    'openBatchFilePicker',
    'openImportBankPicker'
].sort());

const EXPECTED_AI_OCR_EXPRESSIONS = Object.freeze([
    '$refs.ocrInput.click()',
    'createDraftImportBatch',
    'rerunActiveBatchRecognition',
    'runBatchRecognition(batch.id)'
].sort());

const EXPECTED_BROWSER_INTERACTION_EXPRESSIONS = Object.freeze([
    "openBatchCreate('mixed')",
    'openBatchList',
    'openExamBuilder',
    "switchLibraryKnowledgeMode('external')",
    "switchLibraryKnowledgeMode('personal')",
    "switchLibraryKnowledgeMode('system')",
    "view = 'batchImport'; openBatchList()",
    "view = 'entry'",
    "view = 'library'",
    "view = 'personal'",
    "view = 'template'",
    'showEntryKnowledge = !showEntryKnowledge; showEntryPersonalKnowledge = false',
    'showEntryPersonalKnowledge = !showEntryPersonalKnowledge; showEntryKnowledge = false',
    'entryTab = t.id',
    'resetLibraryFilters',
    "exportMode='questions'",
    "exportMode='withAnswers'",
    "exportMode='split'"
].sort());

function collectClickExpressions(html) {
    const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
    const clickBinding = /(?:@click|v-on:click)(?:\.[\w-]+)*(?:\s*=\s*"([^"]*)")?/g;
    const expressions = [];
    let match;
    while ((match = clickBinding.exec(withoutComments))) {
        expressions.push(String(match[1] || '').trim());
    }
    return expressions;
}

function expressionsWith(field, value) {
    return actionManifest
        .filter(action => Array.isArray(action[field]) && action[field].includes(value))
        .map(action => action.expression)
        .sort();
}

test('UI action acceptance manifest is a bidirectional inventory of main.html clicks', () => {
    const bindings = collectClickExpressions(MAIN_HTML);
    const actionable = bindings.filter(Boolean);
    const distinct = [...new Set(actionable)].sort();
    const declared = actionManifest.map(action => action.expression).sort();

    assert.equal(bindings.length, 139, 'all click bindings, including modifier-only bindings, must remain inventoried');
    assert.equal(actionable.length, 137, 'actionable click binding count changed');
    assert.equal(distinct.length, 117, 'distinct click expression count changed');
    assert.equal(actionManifest.length, 117, 'manifest must declare exactly one row per distinct click expression');
    assert.deepEqual(declared, distinct, 'main.html and the action manifest must contain exactly the same expressions');
});

test('every action has stable identity, owner, risk, fixture and honest evidence', () => {
    const ids = new Set();
    const ownerCounts = {};
    const riskCounts = {};

    for (const action of actionManifest) {
        assert.match(action.id, /^ui-[0-9a-f]{16}$/);
        assert.equal(action.id, stableActionId(action.expression), `${action.expression} must keep its expression-derived id`);
        assert.equal(ids.has(action.id), false, `${action.id} must be unique`);
        ids.add(action.id);

        assert.ok(Object.hasOwn(EXPECTED_OWNER_COUNTS, action.owner), `${action.expression} has an unknown owner`);
        assert.match(action.risk, /^R[0-3]$/);
        assert.equal(typeof action.fixture, 'string');
        assert.ok(action.fixture.trim(), `${action.expression} must name a fixture strategy`);
        assert.equal(typeof action.delegateOwner, 'string');
        assert.ok(action.delegateOwner.trim(), `${action.expression} must name its delegate owner`);
        assert.ok(Array.isArray(action.dialogs));
        assert.ok(Array.isArray(action.sideEffects));
        assert.equal(new Set(action.dialogs).size, action.dialogs.length, `${action.expression} repeats a dialog type`);
        assert.equal(new Set(action.sideEffects).size, action.sideEffects.length, `${action.expression} repeats a side effect`);
        assert.ok(action.dialogs.every(dialog => dialog === 'confirm' || dialog === 'prompt'));

        ownerCounts[action.owner] = (ownerCounts[action.owner] || 0) + 1;
        riskCounts[action.risk] = (riskCounts[action.risk] || 0) + 1;

        if (action.automatedEvidence) {
            assert.match(action.automatedEvidence, /^tests\/.+\.test\.js$/);
            assert.equal(action.manualAcceptance, null);
        } else {
            assert.equal(typeof action.manualAcceptance, 'object');
            for (const field of ['precondition', 'action', 'expected', 'isolation']) {
                assert.equal(typeof action.manualAcceptance[field], 'string');
                assert.ok(action.manualAcceptance[field].trim(), `${action.expression} needs manual ${field}`);
            }
            assert.match(action.manualAcceptance.action, new RegExp(action.expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        }
        if (action.risk === 'R2' || action.risk === 'R3') {
            assert.ok(action.sideEffects.length > 0, `${action.expression} must identify its isolated side effect`);
        }
    }

    assert.deepEqual(ownerCounts, EXPECTED_OWNER_COUNTS);
    for (const risk of ['R1', 'R2', 'R3']) {
        assert.ok(riskCounts[risk] > 0, `${risk} must have acceptance rows`);
        assert.ok(actionManifest.filter(action => action.risk === risk).every(action => action.fixture.trim()));
    }
});

test('blocking dialogs, file choosers and AI/OCR entrypoints are exact', () => {
    assert.deepEqual(expressionsWith('dialogs', 'confirm'), EXPECTED_CONFIRM_EXPRESSIONS);
    assert.deepEqual(expressionsWith('dialogs', 'prompt'), EXPECTED_PROMPT_EXPRESSIONS);
    assert.deepEqual(expressionsWith('sideEffects', 'file-chooser'), EXPECTED_FILE_CHOOSER_EXPRESSIONS);
    assert.deepEqual(expressionsWith('sideEffects', 'ai-ocr'), EXPECTED_AI_OCR_EXPRESSIONS);
    assert.deepEqual(
        actionManifest.filter(action => action.risk === 'R3').map(action => action.expression).sort(),
        EXPECTED_AI_OCR_EXPRESSIONS,
        'recognition risk must be limited to the four audited entrypoints'
    );
});

test('browser smoke claims evidence only for the eighteen interactions it exercises', () => {
    const covered = actionManifest
        .filter(action => action.automatedEvidence === 'tests/app-ui-navigation-browser.test.js')
        .map(action => action.expression)
        .sort();

    assert.equal(covered.length, 18);
    assert.deepEqual(covered, EXPECTED_BROWSER_INTERACTION_EXPRESSIONS);
});

test('all 117 actions are either automated or have a concrete isolated manual procedure', () => {
    const automated = actionManifest.filter(action => action.automatedEvidence);
    const manual = actionManifest.filter(action => action.manualAcceptance);
    assert.equal(automated.length + manual.length, 117);
    assert.equal(automated.filter(action => action.manualAcceptance).length, 0);
    assert.equal(manual.filter(action => action.automatedEvidence).length, 0);
    assert.ok(automated.length > 11, 'composable behavior tests must add evidence beyond navigation');
    assert.ok(manual.length > 0, 'unsafe/unautomated actions must remain explicitly manual');
});
