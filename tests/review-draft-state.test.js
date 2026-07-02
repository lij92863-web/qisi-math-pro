const test = require('node:test');
const assert = require('node:assert/strict');

const {
    summarizeDraftStatus,
    normalizeDraftPreviewOptions,
    normalizeDraftEditorNewlines,
    syncActiveDraftEditorFromQuestion,
    draftSummaryQuestionNo,
    draftRawOptionSourceCandidates,
    repairDraftChoiceOptionsFromCachedFileText,
    finalDraftNeedsOptionVisionRepair,
    convertDocxImporterDraftToRecognitionItem,
    mergeDocxVisualDraftsByQuestionNumberForV2,
    buildDraftImagePlacementCode,
    shouldInlineDraftImageInStemForV2,
    attachDraftImageTokensIntoStemsForV2
} = require('../qisi-review-draft-state.js');

test('BM08: summarize', () => {
    const r = summarizeDraftStatus([
        { question: '1', answer: 'A', solution: 'S' },
        { question: '2' }
    ]);
    assert.equal(r.total, 2);
    assert.equal(r.complete, 1);
    assert.equal(r.missingAnswer, 1);
    assert.equal(r.missingSolution, 1);
    assert.ok(r.safePartial);
});

test('BMR3: summarize empty and rejected warnings safely', () => {
    assert.deepEqual(summarizeDraftStatus([]), {
        total: 0,
        complete: 0,
        missingAnswer: 0,
        missingSolution: 0,
        safePartial: false
    });

    const r = summarizeDraftStatus([
        { question: '1', answer: '', solution: 'S', warnings: ['parser-objective-answer-rejected'] },
        { question: '2', answer: 'B', solution: '' }
    ]);
    assert.equal(r.missingAnswer, 1);
    assert.equal(r.missingSolution, 1);
    assert.equal(r.safePartial, true);
});

test('BMR3: normalize draft preview options preserves four slots', () => {
    assert.deepEqual(normalizeDraftPreviewOptions({ options: ['A', 'B'] }), ['A', 'B', '', '']);
    assert.deepEqual(normalizeDraftPreviewOptions({ options: [] }), ['', '', '', '']);
    assert.deepEqual(normalizeDraftPreviewOptions(null), ['', '', '', '']);
});

test('BMR3: editor newline normalization and active editor sync', () => {
    assert.equal(normalizeDraftEditorNewlines('a\r\nb\rc'), 'a\nb\nc');

    const activeDraftQuestion = { value: { id: 'q1', stem: 'Stem' } };
    const activeDraftEditorBuffer = { value: 'old' };
    const activeDraftEditorOriginal = { value: 'old' };
    const activeDraftEditorQuestionId = { value: 'old' };

    syncActiveDraftEditorFromQuestion({
        activeDraftQuestion,
        activeDraftEditorBuffer,
        activeDraftEditorOriginal,
        activeDraftEditorQuestionId,
        buildDraftEditorSource: q => `${q.stem}\r\nA. one`
    });

    assert.equal(activeDraftEditorBuffer.value, 'Stem\r\nA. one');
    assert.equal(activeDraftEditorOriginal.value, 'Stem\r\nA. one');
    assert.equal(activeDraftEditorQuestionId.value, 'q1');

    activeDraftQuestion.value = null;
    syncActiveDraftEditorFromQuestion({
        activeDraftQuestion,
        activeDraftEditorBuffer,
        activeDraftEditorOriginal,
        activeDraftEditorQuestionId,
        buildDraftEditorSource: () => 'unused'
    });
    assert.equal(activeDraftEditorBuffer.value, '');
    assert.equal(activeDraftEditorOriginal.value, '');
    assert.equal(activeDraftEditorQuestionId.value, '');
});

test('BMR3: draft summary question number fallback', () => {
    assert.equal(draftSummaryQuestionNo({ questionNumber: '9' }, 0), '9');
    assert.equal(draftSummaryQuestionNo({ question: '3' }, 0), '3');
    assert.equal(draftSummaryQuestionNo({}, 2), '3');
});

test('BMR3: raw option source candidates include matching page block', () => {
    const deps = {
        cleanRecognizedText: value => String(value || '').trim(),
        normalizeQuestionKey: value => String(value || '').match(/\d+/)?.[0] || '',
        splitQuestionBlocksByNumber: source => [
            { question: '1', block: '1. first' },
            { question: '2', block: '2. stem A. a B. b' }
        ].filter(item => source.includes(item.question))
    };
    const result = draftRawOptionSourceCandidates({
        questionNumber: '2',
        rawText: 'raw',
        rawBlock: 'raw',
        sourceTrace: { rawBlock: 'trace raw', pageText: 'page has 1 and 2' },
        stem: 'stem',
        pageText: 'page has 2'
    }, deps);

    assert.ok(result.includes('raw'));
    assert.ok(result.includes('trace raw'));
    assert.ok(result.includes('2. stem A. a B. b'));
    assert.equal(new Set(result).size, result.length);
});

test('BMR3: cached DOCX option repair mutates draft like legacy helper', () => {
    const q = {
        questionNumber: '2',
        sourceFileId: 'f1',
        options: ['', '', '', ''],
        warnings: ['选择题仅识别到 1/4 个选项。', 'keep me']
    };
    const ok = repairDraftChoiceOptionsFromCachedFileText(q, {
        draftFileTextCache: new Map([['f1', '1. old\n2. stem A. one B. two C. three D. four']]),
        choiceQuestionMissingOptions: () => true,
        normalizeQuestionKey: value => String(value || '').match(/\d+/)?.[0] || '',
        splitQuestionBlocksByNumber: source => [
            { question: '2', block: '2. stem A. one B. two C. three D. four' }
        ],
        forceExtractOptionsFromText: source => source.includes('A. one')
            ? { stem: '2. stem', options: ['one', 'two', 'three', 'four'] }
            : null,
        sanitizeChoiceOptions: options => Array.isArray(options) ? options : []
    });

    assert.equal(ok, true);
    assert.equal(q.stem, '2. stem');
    assert.deepEqual(q.options, ['one', 'two', 'three', 'four']);
    assert.equal(q.rawBlock, '2. stem A. one B. two C. three D. four');
    assert.equal(q.pageText, '1. old\n2. stem A. one B. two C. three D. four');
    assert.deepEqual(q.warnings, ['keep me', '已从原始 DOCX 全文按题号补回选择题选项，请核对。']);
});

test('BMR3: option vision repair requires source page image and missing options', () => {
    assert.equal(finalDraftNeedsOptionVisionRepair(null), false);
    assert.equal(finalDraftNeedsOptionVisionRepair({ sourcePageImage: 'img', options: ['A', 'B'] }), false);
    assert.equal(finalDraftNeedsOptionVisionRepair({ sourceTrace: { sourcePageImage: 'img' }, options: ['A'] }), true);
    assert.equal(finalDraftNeedsOptionVisionRepair({ options: ['A'] }), false);
});

test('BMR3: converts DOCX importer draft to recognition item with normalized images', () => {
    const item = convertDocxImporterDraftToRecognitionItem({
        questionNumber: '7',
        order: 7,
        type: '单选题',
        stem: 'Stem',
        options: ['A', 'B'],
        answer: 'A',
        solution: 'S',
        sourceFileId: 'file-1',
        sourceFileName: 'q.docx',
        sourceTrace: { blockTextHead: 'raw head' },
        images: [
            { id: 'img1', url: 'u1' },
            { id: 'img1', url: 'u1-copy' },
            { id: 'hidden', url: 'u2', displayable: false }
        ],
        warnings: ['w']
    });

    assert.equal(item.questionNumber, '7');
    assert.equal(item.rawText, 'raw head');
    assert.deepEqual(item.images.map(img => img.id), ['img1']);
    assert.deepEqual(item.sourceTrace.imageIds, ['img1']);
});

test('BMR3: merges visual DOCX drafts by normalized question number', () => {
    const merged = mergeDocxVisualDraftsByQuestionNumberForV2(
        [{ questionNumber: '1', stem: 'xml1' }, { questionNumber: '2', stem: 'xml2' }],
        [{ question: '第2题', stem: 'visual2' }],
        {
            normalizeDocxMergeQuestionKeyForV2: value => String(value || '').match(/\d+/)?.[0] || '',
            mergeDocxVisualDraftIntoXmlDraftForV2: (xml, visual) => ({
                ...xml,
                stem: visual.stem
            })
        }
    );

    assert.deepEqual(merged.map(item => item.stem), ['xml1', 'visual2']);
    assert.deepEqual(mergeDocxVisualDraftsByQuestionNumberForV2([{ stem: 'x' }], []), [{ stem: 'x' }]);
});

test('BMR3: image placement code and inline image decisions are stable', () => {
    assert.equal(buildDraftImagePlacementCode({ id: 'img1' }), '\\begin{center}[[IMAGE:img1]]\\end{center}');
    assert.equal(
        buildDraftImagePlacementCode({ id: 'img1' }, 'left'),
        '\\begin{wrapfigure}{l}{0.34\\linewidth}\\centering [[IMAGE:img1]]\\end{wrapfigure}'
    );
    assert.throws(() => buildDraftImagePlacementCode({}, 'center'), /图片缺少 ID/);

    assert.equal(shouldInlineDraftImageInStemForV2({ id: 'i', url: 'u', source: 'manual-crop' }), true);
    assert.equal(shouldInlineDraftImageInStemForV2({ id: 'i', url: 'u', source: 'source-page' }), false);
    assert.equal(shouldInlineDraftImageInStemForV2({ id: 'i', url: 'u', status: 'deleted', source: 'manual-crop' }), false);
});

test('BMR3: attaches draft image tokens without mutating unrelated drafts', () => {
    const now = Date.now();
    const drafts = [
        { id: 'q1', stem: 'Stem 1', imageReviewStatus: 'none' },
        { id: 'q2', stem: 'Stem 2' }
    ];
    const result = attachDraftImageTokensIntoStemsForV2(drafts, [
        { id: 'img1', questionId: 'q1', url: 'u', source: 'manual-crop' },
        { id: 'src', questionId: 'q1', url: 'u', source: 'source-page' }
    ]);

    assert.notEqual(result[0], drafts[0]);
    assert.equal(result[0].stem, 'Stem 1\n[[IMAGE:img1]]');
    assert.equal(result[0].hasImage, true);
    assert.equal(result[0].imageReviewStatus, 'need_confirm');
    assert.ok(result[0].updatedAt >= now);
    assert.equal(result[1], drafts[1]);
});
