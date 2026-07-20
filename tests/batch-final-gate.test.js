const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const modulePath = path.join(__dirname, '..', 'qisi-batch-final-gate.js');
const gate = require(modulePath);

const normalizeQuestionKey = value => {
    const text = String(value || '')
        .replace(/[０-９]/g, character =>
            String.fromCharCode(character.charCodeAt(0) - 65248)
        )
        .replace(/第|题|[.．、:：\s]/g, '')
        .trim();
    const number = text.match(/\d{1,3}/)?.[0] || '';
    return number ? String(Number(number)) : '';
};

const cleanRecognizedText = value => String(value || '').trim();

const cleanDisplayOptionsForBatchSave = options => {
    const source = Array.isArray(options) ? options : ['', '', '', ''];
    return [0, 1, 2, 3].map(index => cleanRecognizedText(source[index] || ''));
};

const mergeImageListsById = (...lists) => {
    const byId = new Map();
    for (const list of lists) {
        for (const image of (Array.isArray(list) ? list : [])) {
            if (!image?.id || byId.has(image.id)) continue;
            byId.set(image.id, { ...image, normalized: true });
        }
    }
    return [...byId.values()];
};

const policy = {
    cleanRecognizedText,
    cleanDisplayOptionsForBatchSave,
    normalizeQuestionKey,
    mergeImageListsById
};

test('exports the pure final-gate API for Node without a mutating dedupe operation', () => {
    assert.deepEqual(Object.keys(gate).sort(), [
        'buildCandidateDiagnostics',
        'countMeaningfulOptions',
        'getCandidateIdentity',
        'isMeaningfulOption',
        'mergeCandidate',
        'rankCandidates',
        'rebindDraftImages',
        'scoreCandidate'
    ]);
    assert.equal(gate.batchFinalGateDedupeDrafts, undefined);
    assert.equal(gate.dedupeDrafts, undefined);
});

test('registers the same API as Qisi.BatchFinalGate in a browser context', () => {
    const source = fs.readFileSync(modulePath, 'utf8');
    const context = {};
    context.globalThis = context;

    vm.runInNewContext(source, context, { filename: modulePath });

    assert.equal(typeof context.Qisi.BatchFinalGate.scoreCandidate, 'function');
    assert.equal(typeof context.Qisi.BatchFinalGate.mergeCandidate, 'function');
    assert.equal(context.Qisi.BatchFinalGate.dedupeDrafts, undefined);
});

test('candidate identity preserves nullish question precedence and source precedence', () => {
    assert.deepEqual(
        gate.getCandidateIdentity({
            questionNumber: '第０３题',
            question: '9',
            sourceDocxFileId: 'docx-primary',
            sourceQuestionFileId: 'question-secondary',
            sourceFileId: 'file-tertiary'
        }, policy),
        {
            questionNumber: '3',
            sourceKey: 'docx-primary',
            key: 'docx-primary::3'
        }
    );

    assert.deepEqual(
        gate.getCandidateIdentity({
            questionNumber: '',
            question: '9',
            sourceTrace: { questionNo: '10', sourceFileName: 'trace.docx' }
        }, policy),
        {
            questionNumber: '',
            sourceKey: 'trace.docx',
            key: ''
        },
        'an empty questionNumber is present and must block lower-priority fields'
    );

    assert.equal(
        gate.getCandidateIdentity({ questionNumber: null, question: '9' }, policy).questionNumber,
        '9'
    );
    assert.equal(
        gate.getCandidateIdentity({ questionNumber: '3', sourceFileId: 'left' }, policy).key,
        'left::3'
    );
    assert.equal(
        gate.getCandidateIdentity({ questionNumber: '3', sourceFileId: 'right' }, policy).key,
        'right::3',
        'equal question numbers from different source files must not share an identity'
    );
    assert.equal(
        gate.getCandidateIdentity({ questionNumber: '4' }, policy).sourceKey,
        'unknown-file'
    );
});

test('exercised policy dependencies fail loudly instead of taking silent fallbacks', () => {
    assert.throws(
        () => gate.getCandidateIdentity({ questionNumber: '3' }, {}),
        /policy\.normalizeQuestionKey\(\)/
    );
    assert.throws(
        () => gate.isMeaningfulOption('A. content', {}),
        /policy\.cleanRecognizedText\(\)/
    );
    assert.throws(
        () => gate.countMeaningfulOptions(['A. content'], {}),
        /policy\.cleanDisplayOptionsForBatchSave\(\)/
    );
    assert.throws(
        () => gate.mergeCandidate(
            { stem: 'abcdefgh', options: [] },
            { stem: 'abcdefgh', options: [] },
            { ...policy, mergeImageListsById: undefined }
        ),
        /policy\.mergeImageListsById\(\)/
    );

    assert.equal(
        gate.isMeaningfulOption('[[IMAGE:choice]]', {}),
        true,
        'a media-only branch does not exercise the text-cleaning dependency'
    );
});

test('meaningful-option rules reject labels and punctuation but retain content and media', () => {
    for (const value of ['', ' ', 'A', 'A.', '(B)', '（Ｃ）', '...', null, undefined, 0]) {
        assert.equal(gate.isMeaningfulOption(value, policy), false, JSON.stringify(value));
    }

    for (const value of [
        'A. content',
        '（B）答案内容',
        '[[IMAGE:choice-a]]',
        '[[FORMULA_IMAGE:choice-b]]',
        '\\includegraphics[width=2cm]{choice-c.png}',
        '$A$',
        '1',
        '0'
    ]) {
        assert.equal(gate.isMeaningfulOption(value, policy), true, value);
    }
});

test('meaningful-option count cleans and considers only the first four slots', () => {
    let received;
    const trackedPolicy = {
        ...policy,
        cleanDisplayOptionsForBatchSave(options) {
            received = options;
            return ['A.', 'B. 有内容', '[[IMAGE:c]]', '...', 'E. must-not-count'];
        }
    };

    const original = ['raw-a', 'raw-b', 'raw-c', 'raw-d', 'raw-e'];
    assert.equal(gate.countMeaningfulOptions(original, trackedPolicy), 2);
    assert.equal(received, original);
    assert.deepEqual(original, ['raw-a', 'raw-b', 'raw-c', 'raw-d', 'raw-e']);
});

test('quality score preserves exact option-completeness weights', () => {
    const base = { stem: 'abcdefgh', options: ['', '', '', ''] };
    assert.equal(gate.scoreCandidate(base, policy), 0);
    assert.equal(gate.scoreCandidate({ ...base, options: ['content'] }, policy), 60);
    assert.equal(gate.scoreCandidate({ ...base, options: ['one', 'two'] }, policy), 180);
    assert.equal(
        gate.scoreCandidate({ ...base, options: ['one', 'two', 'three', 'four'] }, policy),
        480
    );
});

test('quality score preserves legacy text, LaTeX, media, image, and bad-character weights', () => {
    assert.equal(gate.scoreCandidate({ stem: '中文中文中文中文', options: [] }, policy), 16);
    assert.equal(gate.scoreCandidate({ stem: '中'.repeat(80), options: [] }, policy), 120);
    assert.equal(
        gate.scoreCandidate({ stem: 'abcdefgh x=\\frac{1}{2}', options: [] }, policy),
        100,
        'complete fraction has five legacy regex signals, not a parsed-formula score'
    );
    assert.equal(
        gate.scoreCandidate({ stem: 'abcdefgh x=\\frac{1', options: [] }, policy),
        40,
        'malformed fraction still has two legacy regex signals'
    );
    assert.equal(
        gate.scoreCandidate({ stem: 'abcdefgh [[IMAGE:one]]', options: [] }, policy),
        30
    );
    assert.equal(
        gate.scoreCandidate({
            stem: 'abcdefgh [[IMAGE:one]] [[IMAGE:two]] [[IMAGE:three]]',
            options: []
        }, policy),
        80,
        'media bonus is capped at 80'
    );
    assert.equal(
        gate.scoreCandidate({
            stem: 'abcdefgh',
            options: [],
            images: [{ id: 'img' }],
            sourcePageImage: 'page.png'
        }, policy),
        75
    );
    assert.equal(gate.scoreCandidate({ stem: 'abcdefgh□', options: [] }, policy), -80);
    assert.equal(gate.scoreCandidate({ stem: 'abcdefgh□□', options: [] }, policy), -160);
});

test('quality score preserves placeholder, short-stem, choice-semantics, and label penalties', () => {
    assert.equal(gate.scoreCandidate({ stem: '未能自动切出题目', options: [] }, policy), -584);
    assert.equal(gate.scoreCandidate({ stem: 'abc', options: [] }, policy), -180);

    const choiceStem = '这是一个单选题测试文本';
    assert.equal(
        gate.scoreCandidate({ stem: choiceStem, options: [] }, policy),
        [...choiceStem].length * 2 - 220
    );
    assert.equal(
        gate.scoreCandidate({ stem: 'abcdefgh', options: ['A.', '', '', ''] }, policy),
        -200
    );
});

test('quality score preserves exact source bonuses', () => {
    const candidate = { stem: 'abcdefgh', options: [] };
    assert.equal(gate.scoreCandidate({ ...candidate, recognitionSource: 'visual' }, policy), 50);
    assert.equal(gate.scoreCandidate({ ...candidate, recognitionSource: 'docx-importer' }, policy), 40);
    assert.equal(gate.scoreCandidate({ ...candidate, recognitionSource: 'pdf-text' }, policy), -10);
    assert.equal(
        gate.scoreCandidate({ ...candidate, recognitionSource: 'visual-pdf-text' }, policy),
        40
    );
});

test('ranking is descending, stable for ties, and does not mutate the input array', () => {
    const low = { id: 'low', stem: 'abcdefgh', options: [] };
    const tiedFirst = { id: 'tie-a', stem: 'abcdefgh', options: ['one'] };
    const tiedSecond = { id: 'tie-b', stem: 'abcdefgh', options: ['two'] };
    const high = { id: 'high', stem: 'abcdefgh', options: ['1', '2', '3', '4'] };
    const input = [low, tiedFirst, tiedSecond, high];

    assert.deepEqual(
        gate.rankCandidates(input, policy).map(item => item.id),
        ['high', 'tie-a', 'tie-b', 'low']
    );
    assert.deepEqual(input.map(item => item.id), ['low', 'tie-a', 'tie-b', 'high']);
});

test('merge preserves the best identity while filling higher-quality fields and evidence', () => {
    const best = {
        id: 'best-id',
        questionNumber: '8',
        stem: '坏字□',
        options: ['A. only', '', '', ''],
        answer: 'x',
        solution: 'short',
        images: [{ id: 'same', from: 'best' }],
        recognizedImages: [],
        warnings: ['best-warning'],
        sourceTrace: {
            source: 'docx-importer',
            rawBlock: 'best-raw',
            duplicateMergedFrom: [{ id: 'earlier' }]
        }
    };
    const other = {
        id: 'other-id',
        questionNumber: '8',
        stem: '这是完整的候选题干',
        options: ['A. one', 'B. two', 'C. three', 'D. four'],
        answer: '\\frac{1}{2}',
        solution: 'a much longer solution text',
        images: [
            { id: 'same', from: 'other' },
            { id: 'new', from: 'other' }
        ],
        recognizedImages: [{ id: 'recognized' }],
        sourcePageImage: 'other-page.png',
        answerPageImage: 'answer-page.png',
        solutionPageImage: 'solution-page.png',
        rawText: 'other raw text',
        warnings: ['best-warning', 'other-warning'],
        sourceTrace: {
            source: 'visual',
            sourcePageImage: 'trace-page.png',
            rawBlock: 'other-raw',
            pageText: 'other-page-text'
        }
    };
    const bestSnapshot = structuredClone(best);
    const otherSnapshot = structuredClone(other);

    const merged = gate.mergeCandidate(best, other, policy);

    assert.equal(merged.id, 'best-id');
    assert.equal(merged.questionNumber, '8');
    assert.equal(merged.stem, other.stem);
    assert.equal(merged.options, other.options);
    assert.equal(merged.answer, other.answer);
    assert.equal(merged.solution, other.solution);
    assert.deepEqual(merged.images, [
        { id: 'same', from: 'best', normalized: true },
        { id: 'new', from: 'other', normalized: true }
    ]);
    assert.deepEqual(merged.recognizedImages, [
        { id: 'recognized', normalized: true }
    ]);
    assert.equal(merged.sourcePageImage, 'other-page.png');
    assert.equal(merged.answerPageImage, 'answer-page.png');
    assert.equal(merged.solutionPageImage, 'solution-page.png');
    assert.equal(merged.sourceTrace.source, 'docx-importer');
    assert.equal(merged.sourceTrace.sourcePageImage, 'trace-page.png');
    assert.equal(merged.sourceTrace.rawBlock, 'best-raw');
    assert.equal(merged.sourceTrace.pageText, 'other-page-text');
    assert.deepEqual(merged.sourceTrace.duplicateMergedFrom[0], { id: 'earlier' });
    assert.deepEqual(
        merged.sourceTrace.duplicateMergedFrom[1],
        {
            id: 'other-id',
            questionNumber: '8',
            source: 'visual',
            score: gate.scoreCandidate(other, policy),
            badChars: 0,
            optionCount: 4,
            stemHead: other.stem
        }
    );
    assert.deepEqual(merged.warnings, [
        'best-warning',
        'other-warning',
        '检测到重复题号，系统已合并候选并保留质量更高版本。'
    ]);
    assert.deepEqual(best, bestSnapshot);
    assert.deepEqual(other, otherSnapshot);
});

test('merge replaces tied-count options only when corruption improves without losing math signals', () => {
    const best = {
        stem: 'abcdefgh',
        options: ['A. x□', 'B. y', '', '']
    };
    const improved = {
        stem: 'abcdefgh',
        options: ['A. x', 'B. y', '', '']
    };
    const losesMath = {
        stem: 'abcdefgh',
        options: ['A. x', 'B. plain', '', '']
    };
    const bestWithMath = {
        ...best,
        options: ['A. \\frac{1}{2}□', 'B. y', '', '']
    };

    assert.equal(gate.mergeCandidate(best, improved, policy).options, improved.options);
    assert.equal(gate.mergeCandidate(bestWithMath, losesMath, policy).options, bestWithMath.options);
});

test('candidate diagnostics expose the same legacy score signals used by ranking', () => {
    const item = {
        id: 'diagnostic-id',
        questionNumber: '第3题',
        sourceFileId: 'file-id',
        recognitionSource: 'visual',
        stem: 'abcdefgh□ x=\\frac{1',
        options: ['A. content', 'B.', '', '']
    };

    assert.deepEqual(gate.buildCandidateDiagnostics(item, policy), {
        id: 'diagnostic-id',
        q: '第3题',
        sourceKey: 'file-id',
        source: 'visual',
        score: gate.scoreCandidate(item, policy),
        optionCount: 1,
        badChars: 1,
        latexSignals: 2,
        stemHead: 'abcdefgh□ x=\\frac{1'
    });
});

test('image rebinding maps removed draft ids, drops true orphans, and keeps unbound rows', () => {
    const images = [
        { id: 'mapped', questionId: 'removed-id' },
        { id: 'kept', questionId: 'kept-id' },
        { id: 'orphan', questionId: 'missing-id' },
        { id: 'unbound', questionId: '' },
        null
    ];
    const snapshot = structuredClone(images);
    const result = gate.rebindDraftImages(images, {
        drafts: [{ id: 'kept-id' }],
        idMap: new Map([
            ['removed-id', 'kept-id'],
            ['missing-id', 'still-missing-id']
        ])
    });

    assert.deepEqual(result, [
        { id: 'mapped', questionId: 'kept-id' },
        { id: 'kept', questionId: 'kept-id' },
        { id: 'unbound', questionId: '' }
    ]);
    assert.deepEqual(images, snapshot);
    assert.notEqual(result[0], images[0]);
});

test('module source does not contain data, network, AI, or OCR operations', () => {
    const source = fs.readFileSync(modulePath, 'utf8');

    assert.doesNotMatch(source, /\bdb\s*\./);
    assert.doesNotMatch(source, /\bfetch\s*\(/);
    assert.doesNotMatch(source, /\/api\/ai\//);
    assert.doesNotMatch(source, /\b(?:ocr|dashscope)\b/i);
});
