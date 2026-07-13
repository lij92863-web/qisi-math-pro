const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const OutputPort = require('../qisi-production-import-output-port.js');
const ROOT = path.resolve(__dirname, '..');

const helpers = {
    cleanText: value => String(value || '').trim(),
    normalizeQuestionKey: value => {
        const match = String(value || '').match(/\d{1,3}/);
        return match ? String(Number(match[0])) : '';
    },
    cleanOptions: options => {
        const list = Array.isArray(options) ? options : [];
        return [0, 1, 2, 3].map(index => String(list[index] || '').trim());
    },
    mergeImages: (...lists) => {
        const byId = new Map();
        lists.flat().filter(Boolean).forEach(image => {
            if (!byId.has(image.id)) byId.set(image.id, image);
        });
        return [...byId.values()];
    },
    clock: () => 500
};

test('projectImportOutput keeps the stronger duplicate and preserves complementary evidence', () => {
    const weak = {
        id: 'weak', sourceFileId: 'source-1', questionNumber: '2',
        stem: '识别失败', options: ['A.', 'B.', 'C.', 'D.'],
        answer: 'A', solution: '', warnings: ['weak-warning'],
        images: [{ id: 'inside-weak' }], sourceTrace: { source: 'pdf-text' }
    };
    const strong = {
        id: 'strong', sourceFileId: 'source-1', questionNumber: '2',
        stem: '下列命题中正确的是 $x^2+1$',
        options: ['A. 甲', 'B. 乙', 'C. 丙', 'D. 丁'],
        answer: '', solution: '完整解析', warnings: ['strong-warning'],
        images: [{ id: 'inside-strong' }], sourceTrace: { source: 'strict-visual' }
    };
    const first = {
        id: 'first', sourceFileId: 'source-1', questionNumber: '1',
        stem: '第一题题干', options: [], sourceTrace: { source: 'docx-importer' }
    };
    const result = OutputPort.projectImportOutput({
        drafts: [weak, strong, first],
        draftImages: [
            { id: 'bound-weak', questionId: 'weak' },
            { id: 'orphan', questionId: 'missing' },
            { id: 'unassigned', questionId: null, status: 'unassigned' }
        ],
        stage: 'characterization'
    }, helpers);

    assert.deepEqual(result.drafts.map(draft => draft.id), ['first', 'strong']);
    assert.equal(result.drafts[1].answer, 'A');
    assert.equal(result.drafts[1].solution, '完整解析');
    assert.deepEqual(result.drafts[1].images.map(image => image.id), [
        'inside-strong', 'inside-weak'
    ]);
    assert.equal(result.drafts[1].order, 2);
    assert.equal(result.drafts[1].updatedAt, 500);
    assert.equal(result.removedIds.has('weak'), true);
    assert.equal(result.idMap.get('weak'), 'strong');
    assert.deepEqual(result.draftImages, [
        { id: 'bound-weak', questionId: 'strong' },
        { id: 'unassigned', questionId: null, status: 'unassigned' }
    ]);
    assert.match(result.drafts[1].warnings.join('\n'), /检测到重复题号/);
    assert.match(result.drafts[1].warnings.join('\n'), /同一题号识别出 2 条候选/);
    assert.equal(result.diagnostics.stage, 'characterization');
    assert.equal(result.diagnostics.before.length, 3);
    assert.equal(result.diagnostics.after.length, 2);
});

test('same question number from different source files remains separate and ordered', () => {
    const result = OutputPort.projectImportOutput({
        drafts: [
            { id: 'b', sourceFileId: 'source-b', questionNumber: '1', stem: '题干 B' },
            { id: 'a', sourceFileId: 'source-a', questionNumber: '1', stem: '题干 A' },
            { id: 'none', sourceFileId: 'source-a', stem: '无题号' }
        ]
    }, helpers);
    assert.deepEqual(result.drafts.map(draft => draft.id), ['a', 'b', 'none']);
    assert.deepEqual(result.drafts.map(draft => draft.order), [1, 2, 3]);
    assert.deepEqual(result.drafts.map(draft => draft.questionNumber), ['1', '1', '3']);
});

test('countMeaningfulOptions preserves media-only options and rejects empty labels', () => {
    assert.equal(OutputPort.countMeaningfulOptions(
        ['A.', '[[IMAGE:i1]]', 'C. value', 'D.'], helpers
    ), 2);
    assert.equal(OutputPort.countMeaningfulOptions(null, helpers), 0);
});

test('helper failures retain the legacy deterministic fallbacks', () => {
    const throwing = {
        cleanText: () => { throw new Error('clean unavailable'); },
        normalizeQuestionKey: () => { throw new Error('key unavailable'); },
        cleanOptions: () => { throw new Error('options unavailable'); },
        clock: () => 10
    };
    const result = OutputPort.projectImportOutput({
        drafts: [{ id: 'd1', questionNumber: '第 7 题', stem: ' fallback ' }]
    }, throwing);
    assert.equal(result.drafts[0].questionNumber, '7');
    assert.equal(result.drafts[0].stem, ' fallback ');
    assert.equal(OutputPort.countMeaningfulOptions(['A. value'], throwing), 1);
});

test('output owner has no DB, UI, persistence, OCR, or formal authority', () => {
    const implementation = fs.readFileSync(
        path.join(ROOT, 'qisi-production-import-output-port.js'), 'utf8'
    );
    assert.doesNotMatch(implementation, /indexedDB|Dexie|\.transaction\s*\(|\.put\s*\(|\.update\s*\(/);
    assert.doesNotMatch(implementation, /document\.|window\.|Vue|FormalAdmission|controlledWrite/i);
    assert.doesNotMatch(
        implementation,
        /\bfetch\s*\(|\brecognize[A-Z_$][\w$]*\s*\(|\bocr[A-Z_$][\w$]*\s*\(/
    );
});

test('production final gates delegate to the shared output owner', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.match(app, /ProductionImportOutputPort\.projectImportOutput\s*\(/);
    assert.match(app, /ProductionImportOutputPort\.countMeaningfulOptions\s*\(/);
    assert.doesNotMatch(app, /const batchFinalGateQualityScore\s*=/);
    assert.doesNotMatch(app, /const batchFinalGateMergeCandidateIntoBest\s*=/);
    assert.doesNotMatch(app, /const batchFinalGateRebindDraftImages\s*=/);
});
