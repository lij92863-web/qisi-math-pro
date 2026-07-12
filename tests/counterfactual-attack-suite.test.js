const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Runtime = require('../qisi-runtime.js').Runtime;
const Contracts = require('../qisi-recognition-contracts.js');
const Repair = require('../qisi-support-repair.js');
const Aligner = require('../qisi-pdf-support-aligner.js');
const Storage = require('../qisi-storage-repository.js');
const Library = require('../qisi-library-service.js');
const Export = require('../qisi-export-service.js');
const Import = require('../qisi-import-orchestrator.js');
const { createLocalAdapter } = require('../qisi-ocr-local-adapter.js');
const { FakeDatabase } = require('./storage-test-harness.js');
const { analyzeRuntimeDependencies } = require('../scripts/verify-qisi-runtime-dependencies.js');

const ROOT = path.resolve(__dirname, '..');
const MAIN = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
const APP = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const analyze = (html, virtualFiles = {}) => analyzeRuntimeDependencies({
    rootDir: ROOT,
    html,
    virtualFiles
});

test('runtime attacks fail startup analysis and init throw renders a visible escaped error', () => {
    assert.equal(analyze(MAIN.replace(/^.*qisi-ui-events\.js.*\r?\n/m, '')).ok, false);

    const uiLine = MAIN.match(/^.*qisi-ui-events\.js.*$/m)[0];
    const late = analyze(MAIN.replace(uiLine, '').replace(
        /(<script[^>]+app\.js[^>]*><\/script>)/,
        `$1\n${uiLine}`
    ));
    assert.ok(late.errors.some(error => error.code === 'runtime-owner-after-app'));

    const typo = analyze(MAIN, {
        'app.js': `${APP}\nwindow.Qisi.Utiils.findNode([], 'x');`
    });
    assert.ok(typo.errors.some(error => error.code === 'runtime-namespace-undefined'));

    const missingFile = analyze(MAIN.replace('./qisi-ui-events.js', './qisi-ui-events-404.js'));
    assert.ok(missingFile.errors.some(error => error.code === 'runtime-script-missing'));

    const duplicate = analyze(MAIN.replace(
        /(<script[^>]+app\.js[^>]*><\/script>)/,
        '<script src="./duplicate-owner.js"></script>\n$1'
    ), {
        'duplicate-owner.js':
            'globalThis.Qisi = globalThis.Qisi || {}; globalThis.Qisi.Utils = {};'
    });
    assert.ok(duplicate.errors.some(error => error.code === 'runtime-duplicate-owner'));

    const previousDocument = globalThis.document;
    const previousConsoleError = console.error;
    const dependencyNames = ['Vue', 'Dexie', 'JSZip', 'pdfjsLib', 'katex'];
    const previousDependencies = Object.fromEntries(
        dependencyNames.map(name => [name, globalThis[name]])
    );
    const appRoot = { innerHTML: '' };
    globalThis.document = { getElementById: () => appRoot };
    dependencyNames.forEach(name => { globalThis[name] = {}; });
    console.error = () => {};
    try {
        Runtime.boot(() => {
            throw new Error('<script>project init failed</script>');
        });
        assert.match(appRoot.innerHTML, /System initialization failed/);
        assert.doesNotMatch(appRoot.innerHTML, /<script>project init failed<\/script>/);
        assert.match(appRoot.innerHTML, /&lt;script&gt;project init failed&lt;\/script&gt;/);
    } finally {
        globalThis.document = previousDocument;
        console.error = previousConsoleError;
        dependencyNames.forEach(name => {
            if (previousDependencies[name] === undefined) delete globalThis[name];
            else globalThis[name] = previousDependencies[name];
        });
    }
});

test('JSON and LaTeX attacks only receive narrow repair and remain schema-gated', () => {
    const unsafeCandidates = [
        '```json\n{"questions":[]}\n```',
        '{"questions":[],}',
        '{"questions":[{"stem":"truncated"}]',
        '{"questions":{"nested":true}}',
        '"\\uD800"',
        'x'.repeat(1024 * 1024)
    ];
    for (const candidate of unsafeCandidates) {
        const attempt = Repair.tryRepairedCandidate({
            candidate,
            escapeLatexBackslashesInJsonCandidate:
                Repair.escapeLatexBackslashesInJsonCandidate,
            extractQuestionArray: parsed => Array.isArray(parsed?.questions)
                ? parsed.questions
                : []
        });
        assert.equal(attempt.result, false);
    }

    const latex = Repair.escapeLatexBackslashesInJsonCandidate(
        '{"stem":"\\therefore x\\to y","tab":"\\t"}'
    );
    assert.equal(latex.changed, true);
    assert.ok(latex.repairCount >= 1);
    const parsedLatex = JSON.parse(latex.text);
    assert.ok(parsedLatex.stem.includes('\\therefore'));
    assert.equal(parsedLatex.tab, '\t');

    const duplicateKey = JSON.parse(
        '{"stem":"safe","stem":"{\\"questions\\":[1]}"}'
    );
    const draft = Contracts.createStructuredQuestionDraft({
        sourceId: 'attack-json', sourceOrder: 1, questionNumber: '1',
        type: '解答题', stem: duplicateKey.stem, options: [], answer: '',
        solution: '', images: [], provenance: {}, confidenceByField: {},
        warnings: [], rawEvidence: { original: 'preserved' }
    });
    const validation = Contracts.validateStructuredQuestionDraft(draft);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some(error => error.code === 'unsafe-wrapper'));
    assert.deepEqual(draft.rawEvidence, { original: 'preserved' });
});

test('question-number and ownership attacks never produce unsafe full alignment', () => {
    const sequences = [
        { answers: [1, 2, 4], solutions: [1, 2, 4], expected: [1, 2, 3, 4] },
        { answers: [1, 2, 2, 3], solutions: [1, 2, 2, 3], expected: [1, 2, 3] },
        { answers: [5, 4, 3], solutions: [5, 4, 3], expected: [3, 4, 5] },
        { answers: [1, 2, 10, 3], solutions: [1, 2, 10, 3], expected: [1, 2, 3, 10] },
        { answers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], solutions: [1, 2], expected: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        { answers: [1, 2, 3], solutions: [1, 2, 1], expected: [1, 2, 3] },
        { answers: [1, 3], solutions: [1, 2, 3], expected: [1, 2, 3] },
        { answers: [1, 2, 1, 2], solutions: [1, 2, 1, 2], expected: [1, 2] }
    ];
    const item = question => ({ question: String(question) });
    for (const vector of sequences) {
        const aligned = Aligner.alignPdfSupport({
            answerItems: vector.answers.map(item),
            solutionItems: vector.solutions.map(item),
            expectedQuestionNumbers: vector.expected.map(String)
        });
        assert.notEqual(aligned.mode, 'full');
        assert.equal(aligned.reliable, false);
        assert.ok(aligned.warnings.length > 0);
    }
});

test('synthetic OCR image attacks remain isolated RecognitionCandidates', async () => {
    const transforms = [
        'rotate', 'perspective', 'low-contrast', 'blur', 'two-column',
        'watermark', 'handwriting', 'multiline-formula', 'image-over-text',
        'circled-number', 'formula-options', 'page-order-shuffle'
    ];
    const seen = [];
    const adapter = createLocalAdapter({
        maxBytes: 1024,
        transport: async (_endpoint, input) => {
            seen.push(input.syntheticTransform);
            return {
                rawText: `candidate:${input.syntheticTransform}`,
                engineVersion: 'synthetic-counterfactual',
                warnings: ['manual-review-required']
            };
        }
    });
    for (const [index, syntheticTransform] of transforms.entries()) {
        const candidate = await adapter.recognizePage({
            sourceId: 'synthetic-only', page: index + 1,
            mimeType: 'image/png', bytes: 64, syntheticTransform
        }, { requestId: `cf-${index}` });
        assert.equal(Contracts.validateRecognitionCandidate(candidate).valid, true);
        assert.equal(candidate.answer, undefined);
        assert.equal(candidate.provenance, undefined);
        assert.deepEqual(candidate.warnings, ['manual-review-required']);
    }
    assert.deepEqual(seen, transforms);
});

test('storage attacks roll back, conflict, remain idempotent, and survive delete-refresh', async () => {
    const unavailable = Storage.createRepository({
        table() { throw Object.assign(new Error('blocked'), { name: 'InvalidStateError' }); }
    });
    await assert.rejects(unavailable.loadLibrary(), error => error.code === 'storage-failure');

    const database = new FakeDatabase();
    const repository = Storage.createRepository(database, { clock: () => 100 });
    await repository.saveQuestion(
        { id: 'q1', stem: 'stable', images: [{ id: 'missing-image' }] },
        { confirmationToken: 'once' }
    );
    const duplicate = await repository.saveQuestion(
        { id: 'q1', stem: 'must not overwrite' },
        { confirmationToken: 'once' }
    );
    assert.equal(duplicate.idempotent, true);
    await assert.rejects(
        repository.updateQuestion('q1', { stem: 'stale' }, { expectedUpdatedAt: 1 }),
        error => error.code === 'write-conflict'
    );
    await repository.softDeleteQuestion('q1');
    const refreshed = Storage.createRepository(database);
    assert.deepEqual(await refreshed.loadLibrary(), []);
    assert.equal((await refreshed.get('questions', 'q1')).stem, 'stable');

    const interruptedDb = new FakeDatabase();
    interruptedDb.failAfterWork = true;
    await assert.rejects(
        Storage.createRepository(interruptedDb).saveQuestion(
            { id: 'q2', stem: 'rollback' },
            { imageRecords: [{ id: 'i2', blob: 'bytes' }] }
        ),
        error => error.code === 'interrupted-write'
    );
    assert.equal(await interruptedDb.table('questions').get('q2'), undefined);
});

test('security attacks are escaped or rejected without local path disclosure', async () => {
    assert.equal(Export.safeFilename('../private/<script>:teacher'), '.._private__script__teacher');
    const adapter = createLocalAdapter({
        maxBytes: 8,
        transport: async () => ({ rawText: '' })
    });
    await assert.rejects(
        adapter.recognizePage({ path: 'C:/private/answer.png', mimeType: 'image/png', bytes: 1 }),
        error => error.code === 'local-path-forbidden' && !error.message.includes('C:/')
    );
    await assert.rejects(
        adapter.recognizePage({ mimeType: 'text/html', bytes: 1 }),
        error => error.code === 'mime-rejected'
    );
    await assert.rejects(
        adapter.recognizePage({ mimeType: 'image/png', bytes: 9 }),
        error => error.code === 'size-rejected'
    );
    const components = fs.readFileSync(path.join(ROOT, 'qisi-components.js'), 'utf8');
    assert.match(components, /replace\(\/<\/g, '&lt;'\)/);
    assert.match(components, /trust:\s*false/);
    assert.doesNotMatch(components, /trust:\s*true/);
});

test('performance attacks stay bounded and cancellation remains responsive', async () => {
    const questions = Array.from({ length: 5000 }, (_, index) => ({
        id: `q${index}`,
        stem: `question ${index} ${'detail '.repeat(20)}`,
        type: index % 2 ? '解答题' : '单选题',
        createdAt: index,
        images: index < 100 ? [{ id: `i${index}` }] : []
    }));
    const library = Library.createLibraryService({
        matchesFilters: (item, { keyword }) => !keyword || item.stem.includes(keyword)
    });
    const started = performance.now();
    for (let index = 0; index < 50; index += 1) {
        const result = library.query(questions, {
            keyword: String(index % 10), page: (index % 5) + 1, pageSize: 25
        });
        assert.ok(result.items.length <= 25);
    }
    assert.ok(performance.now() - started < 5000);

    const exportService = Export.createExportService({
        resolveImages: async ids => ids.map(id => ({ id, blob: 'bytes' }))
    });
    for (let index = 0; index < 3; index += 1) {
        const plan = await exportService.build(questions.slice(0, 100));
        assert.equal(plan.questions.length, 100);
    }

    const controller = new AbortController();
    controller.abort();
    const importer = Import.createImportOrchestrator({
        handlers: { batch: async () => questions }
    });
    await assert.rejects(
        importer.run({ id: 'cancelled-performance-attack', type: 'batch' }, {
            signal: controller.signal
        }),
        error => error.code === 'cancelled'
    );
});
