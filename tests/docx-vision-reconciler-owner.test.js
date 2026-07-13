const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Reconciler = require('../qisi-docx-vision-reconciler.js');
const ROOT = path.resolve(__dirname, '..');

const ports = overrides => ({
    normalizeQuestionNumber: value => String(value || '').match(/\d+/)?.[0] || '',
    cleanText: value => String(value || '').trim(),
    mergeQuestions: items => items.map(item => ({ ...item })),
    ...overrides
});

test('DOCX reconciler follows skeleton order and preserves formula, option, image, and page trace', () => {
    const reconcile = Reconciler.createDocxVisionReconciler(ports());
    const formula = '$\\frac{1}{2}$';
    const image = { image_bbox: [1, 2, 3, 4], page: 3 };
    const result = reconcile([
        {
            question: '2', stem: `second ${formula}`,
            options: ['A2', 'B2', 'C2', 'D2'],
            sourcePage: 3, sourcePages: [3],
            recognizedImages: [image], sourceTrace: { page: 3 }
        },
        {
            question: '1', stem: 'first',
            options: ['A1', 'B1', 'C1', 'D1'], sourcePage: 1
        }
    ], {
        authoritative: true,
        questionNumbers: ['1', '2']
    });

    assert.equal(result.applied, true);
    assert.deepEqual(result.questions.map(item => item.questionNumber), ['1', '2']);
    assert.deepEqual(result.questions[1].options, ['A2', 'B2', 'C2', 'D2']);
    assert.match(result.questions[1].stem, /\\frac/);
    assert.deepEqual(result.questions[1].recognizedImages, [image]);
    assert.deepEqual(result.questions[1].sourcePages, [3]);
    assert.deepEqual(result.questions[1].sourceTrace, {
        page: 3,
        questionNumberEvidence: 'docx-explicit-paragraph-marker'
    });
});

test('DOCX reconciler reports outside-skeleton candidates and missing questions', () => {
    const reconcile = Reconciler.createDocxVisionReconciler(ports());
    const result = reconcile([
        { question: '1', stem: 'one' },
        { question: '3', stem: 'outside', sourcePage: 4 }
    ], {
        authoritative: true,
        questionNumbers: ['1', '2']
    });
    assert.deepEqual(result.questions.map(item => item.questionNumber), ['1']);
    assert.deepEqual(result.missingQuestionNumbers, ['2']);
    assert.equal(result.rejectedCandidates.length, 1);
    assert.equal(
        result.rejectedCandidates[0].reason,
        'question-number-not-in-docx-skeleton'
    );
    assert.equal(result.rejectedCandidates[0].sourcePage, 4);
});

test('DOCX reconciler fails closed for malformed merge, option conflict, and skeleton conflict', () => {
    const malformed = Reconciler.createDocxVisionReconciler(ports({
        mergeQuestions: () => ({})
    }));
    assert.throws(
        () => malformed([{ question: '1' }], {
            authoritative: true, questionNumbers: ['1', '2']
        }),
        error => error.code === 'DOCX_RECONCILE_RESULT_MALFORMED'
    );

    const reconcile = Reconciler.createDocxVisionReconciler(ports());
    assert.throws(
        () => reconcile([
            { question: '1', options: ['left', '', '', ''] },
            { question: '1', options: ['right', '', '', ''] }
        ], {
            authoritative: true, questionNumbers: ['1', '2']
        }),
        error => error.code === 'DOCX_RECONCILE_OPTION_CONFLICT'
    );
    assert.throws(
        () => reconcile([{ question: '1' }], {
            authoritative: true, questionNumbers: ['1', '1']
        }),
        error => error.code === 'DOCX_RECONCILE_SKELETON_CONFLICT'
    );
});

test('DOCX reconciler rejects cancellation and missing production ports', () => {
    assert.throws(
        () => Reconciler.createDocxVisionReconciler({}),
        error => error.code === 'DOCX_RECONCILER_PORT_REQUIRED'
    );
    const controller = new AbortController();
    controller.abort();
    const reconcile = Reconciler.createDocxVisionReconciler(ports());
    assert.throws(
        () => reconcile([{ question: '1' }], {
            authoritative: false, questionNumbers: []
        }, { signal: controller.signal }),
        error =>
            error.name === 'AbortError' &&
            error.code === 'DOCX_RECONCILE_CANCELLED'
    );
});

test('app delegates DOCX reconciliation and has no unreachable option-repair closure', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.match(app, /DocxVisionReconciler\s*\.createDocxVisionReconciler\s*\(/);
    for (const oldOwner of [
        'reconcileStrictQuestionsWithDocxSkeleton',
        'normalizeDocxOptionEvidenceText',
        'parseDocxOptionsFromText',
        'fillOptionsFromDocxVisualOnly',
        'fillDocxOptionsOnly',
        'attachDocxTextEvidenceToItem',
        'repairDocxOptionsFromTextEvidence'
    ]) {
        assert.doesNotMatch(app, new RegExp(`const\\s+${oldOwner}\\s*=`));
    }
});
