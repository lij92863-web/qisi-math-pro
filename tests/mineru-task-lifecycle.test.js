const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const JSZip = require('jszip');
const { createMineruClient, internals } = require('../qisi-mineru-client');
const { createMineruTaskStore } = require('../qisi-mineru-task-store');
const { memoryStore } = require('../qisi-mineru-task-service');
const pdf = Buffer.from('%PDF- offline lifecycle fixture');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const response = body => ({ status: 200, json: async () => body });
async function archive(extra = {}) {
    const zip = new JSZip();
    zip.file('paper_content_list.json', JSON.stringify([{ page_idx: 0, type: 'text', text: '1. 题' },
        { page_idx: 0, type: 'image', img_path: 'first/a.png' }, { page_idx: 0, type: 'image', img_path: 'second/a.png' }]));
    zip.file('first/a.png', 'first'); zip.file('second/a.png', 'second');
    for (const [name, data] of Object.entries(extra)) zip.file(name, data);
    return zip.generateAsync({ type: 'nodebuffer' });
}
function network(zip, override) {
    const calls = [];
    const fetchImpl = async (url, init = {}) => {
        calls.push({ url, method: init.method || 'GET', signal: init.signal });
        if (override) { const result = override(url, init); if (result) return result; }
        if (init.method === 'POST') return response({ code: 0, data: { batch_id: 'batch-1', file_urls: ['https://upload.invalid/pdf'] } });
        if (init.method === 'PUT') return { status: 200 };
        if (url.includes('extract-results')) return response({ code: 0, data: { extract_result: [{ state: 'done', full_zip_url: 'https://download.invalid/result' }] } });
        return { status: 200, arrayBuffer: async () => zip };
    };
    return { calls, fetchImpl };
}

test('concurrent submissions coalesce; disk receipts recover after restart and retain more than three assets', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'qisi-mineru-'));
    try {
        const net = network(await archive()), store = createMineruTaskStore(dir);
        const client = createMineruClient({ token: 'offline-token', ...net, store });
        const [a, b] = await Promise.all([client.parse(pdf), client.parse(pdf)]);
        assert.deepEqual(a, b); assert.equal(net.calls.filter(c => c.method === 'POST').length, 1);
        for (let i = 0; i < 4; i++) await client.parse(Buffer.concat([pdf, Buffer.from(String(i))]));
        const restarted = createMineruClient({ store, fetchImpl: () => { throw new Error('network forbidden'); } });
        const cached = await restarted.parse(pdf);
        assert.equal(cached.source.sha256, sha(pdf));
        const identity = { job: a.job, sourceId: sha(pdf) };
        assert.equal(Buffer.from((await restarted.readImage('first/a.png', identity)).bytes).toString(), 'first');
        assert.equal(Buffer.from((await restarted.readImage('second/a.png', identity)).bytes).toString(), 'second');
        for (const bad of [undefined, { job: a.job }, { job: a.job, sourceId: 'f'.repeat(64) }]) {
            await assert.rejects(restarted.readImage('first/a.png', bad), { code: 'MINERU_ASSET_IDENTITY_REQUIRED' });
        }
        await fs.writeFile(path.join(dir, a.job + '.zip'), 'corrupted');
        await assert.rejects(restarted.parse(pdf), { code: 'MINERU_CACHE_INTEGRITY_FAILED' });
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('lost submission response is durable and can never replay POST', async () => {
    const store = memoryStore();
    const net = network(await archive(), (url, init) => init.method === 'POST' ? Promise.reject(new Error('lost response private-data')) : null);
    await assert.rejects(createMineruClient({ token: 'test', store, ...net }).parse(pdf), { code: 'MINERU_SUBMISSION_UNKNOWN' });
    await assert.rejects(createMineruClient({ token: 'test', store, ...net }).parse(pdf), { code: 'MINERU_SUBMISSION_UNKNOWN' });
    assert.equal(net.calls.length, 1); assert.ok(!JSON.stringify(await store.read(sha(pdf))).includes('private-data'));
});

test('lost upload response recovers by querying the exact accepted batch, never resubmitting or reuploading', async () => {
    const store = memoryStore();
    const net = network(await archive(), (url, init) => init.method === 'PUT' ? Promise.reject(new Error('lost')) : null);
    await assert.rejects(createMineruClient({ token: 'test', store, ...net }).parse(pdf), { code: 'MINERU_UPLOAD_UNKNOWN' });
    const resumed = network(await archive());
    const result = await createMineruClient({ token: 'test', store, ...resumed }).parse(pdf);
    assert.equal(result.job, sha(pdf)); assert.ok(resumed.calls.every(c => c.method === 'GET'));
    assert.ok(resumed.calls[0].url.endsWith('/batch-1'));
});

test('one deadline covers hung POST, PUT, poll and ZIP response body', async () => {
    for (const phase of ['POST', 'PUT', 'poll', 'body']) {
        const never = () => new Promise(() => {});
        const net = network(await archive(), (url, init) => {
            if (init.method === phase || phase === 'poll' && url.includes('extract-results')) return never();
            if (phase === 'body' && url.includes('download.invalid')) return Promise.resolve({ status: 200, arrayBuffer: never });
            return null;
        });
        const start = Date.now();
        const store = memoryStore();
        await assert.rejects(createMineruClient({ token: 'test', store, ...net, timeoutMs: 40 }).parse(pdf), {
            code: phase === 'POST' ? 'MINERU_SUBMISSION_UNKNOWN' : phase === 'PUT' ? 'MINERU_UPLOAD_UNKNOWN' : 'MINERU_PARSE_TIMEOUT'
        });
        assert.ok(Date.now() - start < 1500); assert.ok(net.calls.every(c => c.signal.aborted));
        // A deadline is not a caller cancellation: the durable receipt must say so.
        const receipt = await store.read(sha(pdf));
        assert.equal(receipt.state, phase === 'POST' ? 'unknown' : phase === 'PUT' ? 'unknown' : 'interrupted');
        assert.equal(receipt.errorCode, phase === 'POST' ? 'MINERU_SUBMISSION_UNKNOWN' : phase === 'PUT' ? 'MINERU_UPLOAD_UNKNOWN' : 'MINERU_PARSE_TIMEOUT');
    }
});

test('a batch that never received the file re-uploads the same bytes instead of blocking forever', async () => {
    const zip = await archive();
    const store = memoryStore();
    const first = network(zip, (url, init) => init.method === 'PUT' ? Promise.reject(new Error('lost')) : null);
    await assert.rejects(createMineruClient({ token: 'test', store, ...first }).parse(pdf), { code: 'MINERU_UPLOAD_UNKNOWN' });
    assert.equal(first.calls.filter(call => call.method === 'POST').length, 1);

    let puts = 0;
    let polls = 0;
    const second = network(zip, (url, init) => {
        if (init.method === 'PUT') { puts += 1; return { status: 200 }; }
        if (url.includes('extract-results')) {
            polls += 1;
            // The uploaded bytes only land after the recovery PUT.
            const state = polls === 1 ? 'waiting-file' : 'done';
            return Promise.resolve(response({ code: 0, data: { extract_result: [{
                state,
                ...(state === 'done' ? { full_zip_url: 'https://download.invalid/result' } : {})
            }] } }));
        }
        return null;
    });
    const result = await createMineruClient({ token: 'test', store, ...second }).parse(pdf);
    assert.equal(result.job, sha(pdf));
    assert.equal(second.calls.filter(call => call.method === 'POST').length, 0, 'no second batch');
    assert.equal(puts, 1, 'exactly one recovery upload');
    assert.ok(polls >= 2);
});

test('cancelled caller, mismatched result and missing referenced image cannot become ready', async () => {
    const ctrl = new AbortController(); ctrl.abort();
    const net = network(await archive());
    await assert.rejects(createMineruClient({ token: 'test', ...net }).parse(pdf, { signal: ctrl.signal }), { code: 'MINERU_CANCELLED' });
    assert.equal(net.calls.length, 0);
    const mismatch = network(await archive(), url => url.includes('extract-results') ? Promise.resolve(response({ code: 0, data: { extract_result: [{ data_id: 'wrong', state: 'done' }] } })) : null);
    await assert.rejects(createMineruClient({ token: 'test', ...mismatch }).parse(pdf), { code: 'MINERU_RESPONSE_INVALID' });
    const bad = new JSZip(); bad.file('a_content_list.json', JSON.stringify([{ type: 'image', page_idx: 0, img_path: 'missing.png' }]));
    await assert.rejects(createMineruClient({ token: 'test', ...network(await bad.generateAsync({ type: 'nodebuffer' })) }).parse(pdf), { code: 'MINERU_IMAGE_NOT_FOUND' });
});

test('ZIP ambiguity, path traversal, CRC corruption and expansion limits fail closed', async () => {
    const parse = zip => createMineruClient({ token: 'test', ...network(zip) }).parse(pdf);
    await assert.rejects(parse(await archive({ 'other_content_list.json': '[]' })), { code: 'MINERU_ZIP_INVALID' });
    await assert.rejects(parse(await archive({ '../escape.txt': 'bad' })), { code: 'MINERU_ZIP_INVALID' });
    const bytes = await archive();
    const entry = internals.readZipDirectory(bytes).get('first/a.png');
    bytes[entry.localOffset + 30 + Buffer.byteLength(entry.name)] ^= 1;
    await assert.rejects(parse(bytes), { code: 'MINERU_ZIP_INVALID' });
    const huge = new JSZip(); huge.file('a_content_list.json', ' '.repeat(100000));
    await assert.rejects(parse(await huge.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })), { code: 'MINERU_ZIP_INVALID' });
});

test('canonical projection resolves fragment answer evidence back to its source block and page', async () => {
    const producer = require('../qisi-pdf-mineru-producer').createProducer;
    const bytes = Buffer.from('%PDF-1.4\n%%EOF\n');
    const digest = sha(bytes);
    const upload = 'data:application/pdf;base64,' + bytes.toString('base64');
    const origin = (index, text) => ({ sourceId: digest, itemIndex: index, field: 'text', blockId: '', range: [0, text.length] });
    const questionBlock = (id, index, text) => ({ id, page: 1, type: 'text', text,
        origin: { ...origin(index, text), blockId: id } });
    const page = blocks => ({ page: 1, blocks });
    const question = { id: 'file_question', filename: 'question.pdf', fileType: 'pdf', uploadPath: upload, roles: ['question'] };
    const support = { id: 'file_answer', filename: 'answer.pdf', fileType: 'pdf', uploadPath: upload, roles: ['answer'] };
    const responses = [
        { protocol: 'mineru-blocks-v1', job: digest, source: { sha256: digest, pages: 1 },
            pages: [page([
                questionBlock('p1b0', 0, '一、单项选择题'),
                questionBlock('p1b1', 1, '1. 第一题 A.甲 B.乙 C.丙 D.丁'),
                questionBlock('p1b2', 2, '2. 第二题 A.甲 B.乙 C.丙 D.丁')
            ])], evidence: { items: [] }, answerTable: null, receipt: { state: 'ready' } },
        { protocol: 'mineru-blocks-v1', job: digest, source: { sha256: digest, pages: 1 },
            pages: [page([
                questionBlock('p1b0', 0, '参考答案'),
                questionBlock('p1b1', 1, '1【答案】A\n2【答案】B')
            ])], evidence: { items: [] }, answerTable: null, receipt: { state: 'ready' } }
    ];
    let call = 0;
    const pages = [{ pageNo: 1, url: 'data:image/png;base64,AA==', width: 1, height: 1 }];
    Object.defineProperty(pages, 'totalPages', { value: 1 });
    const run = producer({
        fetch: async url => {
            if (url === '/api/mineru/status') return { ok: true, json: async () => ({ configured: true }) };
            if (url === '/api/mineru/parse') return { ok: true, json: async () => responses[call++] };
            if (url.startsWith('data:')) return { ok: true, blob: async () => new Blob([bytes], { type: 'application/pdf' }) };
            throw new Error('unexpected request ' + url);
        },
        renderPages: async () => pages,
        getRoles: file => file.roles,
        getExistingDrafts: async () => [],
        persistSourceEvidence: async () => {}
    });
    const output = await run({ batchId: 'batch_mineru_fragment', sources: [question, support] });
    assert.equal(output.pdfProtocol, 'pdf-mineru-v1');
    assert.deepEqual(output.drafts.map(draft => draft.answer), ['A', 'B']);
    for (const draft of output.drafts) {
        assert.equal(draft.source.sourceId, 'file_question');
        assert.equal(draft.pdfReview.sourceSha256, digest);
        assert.deepEqual(draft.fieldProvenance.answer.blockIds, ['file_answer/p1b1']);
        assert.equal(draft.fieldProvenance.answer.page, 1);
        assert.deepEqual(draft.pdfReview.candidates.answer[0].item.source_pages, [1]);
        assert.equal(draft.pdfReview.candidates.answer[0].evidence.length, 1);
    }
});

test('a definite submission rejection is reported as an API failure, not as an unknown receipt', async () => {
    const store = memoryStore();
    const net = network(await archive(), (url, init) => init.method === 'POST'
        ? { status: 401, json: async () => ({ code: 1001, msg: 'invalid token' }) } : null);
    await assert.rejects(createMineruClient({ token: 'bad', store, ...net }).parse(pdf), {
        code: 'MINERU_API_ERROR', httpStatus: 401
    });
    const receipt = await store.read(sha(pdf));
    assert.equal(receipt.state, 'failed');
    assert.equal(receipt.errorCode, 'MINERU_API_ERROR');
    assert.equal(receipt.httpStatus, 401);
    assert.equal(receipt.mineruCode, 1001);
    await assert.rejects(createMineruClient({ token: 'bad', store, ...net }).parse(pdf), {
        code: 'MINERU_API_ERROR', httpStatus: 401, mineruCode: 1001
    });
    assert.equal(net.calls.filter(call => call.method === 'POST').length, 1);
});

function producerHarness({ configured = true, questionRoles = ['question'], supportRoles = ['answer', 'solution'],
    withTotalPages = true, twoQuestionSources = false, abortedAtParse = false, responseOverride = null,
    separateSupports = false, threeQuestions = false, descendingSupport = false } = {}) {
    const { createProducer } = require('../qisi-pdf-mineru-producer');
    const bytes = Buffer.from('%PDF-1.4\n%%EOF\n');
    const digest = sha(bytes);
    const upload = 'data:application/pdf;base64,' + bytes.toString('base64');
    const block = (id, index, text) => ({ id, page: 1, type: 'text', text,
        origin: { sourceId: digest, itemIndex: index, field: 'text', blockId: id, range: [0, text.length] } });
    const question = { id: 'file_question', filename: 'question.pdf', fileType: 'pdf', uploadPath: upload, roles: questionRoles };
    const second = { id: 'file_second', filename: 'second.pdf', fileType: 'pdf', uploadPath: upload, roles: questionRoles };
    const support = { id: 'file_answer', filename: 'answer.pdf', fileType: 'pdf', uploadPath: upload, roles: supportRoles };
    const solutionSupport = { id: 'file_solution', filename: 'solution.pdf', fileType: 'pdf', uploadPath: upload, roles: ['solution'] };
    const questionBlocks = threeQuestions
        ? [block('p1b0', 0, '一、单项选择题'),
            block('p1b1', 1, '1. 第一题 A.甲 B.乙 C.丙 D.丁'),
            block('p1b2', 2, '2. 第二题 A.甲 B.乙 C.丙 D.丁'),
            block('p1b3', 3, '3. 第三题 A.甲 B.乙 C.丙 D.丁')]
        : [block('p1b0', 0, '一、单项选择题'), block('p1b1', 1, '1. 第一题 A.甲 B.乙 C.丙 D.丁')];
    const supportBlocks = descendingSupport
        ? [block('p1b0', 0, '参考答案'), block('p1b1', 1, '3【答案】C\n2【答案】B\n1【答案】A')]
        : [block('p1b0', 0, '参考答案'), block('p1b1', 1, '1【答案】A')];
    const questionResult = { protocol: 'mineru-blocks-v1', job: digest, source: { sha256: digest, pages: 1 },
        pages: [{ page: 1, blocks: questionBlocks }], evidence: { items: [] }, answerTable: null, receipt: { state: 'ready' } };
    const supportResult = { protocol: 'mineru-blocks-v1', job: digest, source: { sha256: digest, pages: 1 },
        pages: [{ page: 1, blocks: supportBlocks }], evidence: { items: [] }, answerTable: null, receipt: { state: 'ready' } };
    const solutionResult = { protocol: 'mineru-blocks-v1', job: digest, source: { sha256: digest, pages: 1 },
        pages: [{ page: 1, blocks: [block('p1b0', 0, '参考答案'), block('p1b1', 1, '1【解析】甲符合题意。')] }],
        evidence: { items: [] }, answerTable: null, receipt: { state: 'ready' } };
    const responses = twoQuestionSources ? [questionResult, questionResult]
        : separateSupports ? [questionResult, supportResult, solutionResult] : [questionResult, supportResult];
    let call = 0;
    const persisted = [];
    const controller = new AbortController();
    const pages = [{ pageNo: 1, url: 'data:image/png;base64,AA==', width: 1, height: 1 }];
    if (withTotalPages) Object.defineProperty(pages, 'totalPages', { value: 1 });
    const run = createProducer({
        fetch: async url => {
            if (url === '/api/mineru/status') return { ok: true, json: async () => ({ configured }) };
            if (url === '/api/mineru/parse') {
                if (abortedAtParse) controller.abort();
                return { ok: true, json: async () => responseOverride || responses[call++] };
            }
            if (url.startsWith('data:')) return { ok: true, blob: async () => new Blob([bytes], { type: 'application/pdf' }) };
            throw new Error('unexpected request ' + url);
        },
        renderPages: async () => pages,
        getRoles: file => file.roles,
        getExistingDrafts: async () => [],
        persistSourceEvidence: async () => { persisted.push(true); }
    });
    return {
        persisted,
        controller,
        run: () => run({ batchId: 'batch_mineru_contract',
            sources: twoQuestionSources ? [question, second]
                : separateSupports ? [question, { ...support, roles: ['answer'] }, solutionSupport] : [question, support] },
            controller.signal)
    };
}

test('producer ports and page-count contract fail closed at the boundary', async () => {
    const { createProducer } = require('../qisi-pdf-mineru-producer');
    assert.throws(() => createProducer({}), { code: 'PDF_MINERU_PORT_REQUIRED', port: 'renderPages' });
    assert.throws(() => createProducer({ renderPages() {} }), { code: 'PDF_MINERU_PORT_REQUIRED', port: 'getRoles' });
    await assert.rejects(producerHarness({ withTotalPages: false }).run(), { code: 'PDF_MINERU_RENDER_CONTRACT_INVALID' });
    await assert.rejects(producerHarness({ configured: false }).run(), { code: 'MINERU_NOT_CONFIGURED' });
    await assert.rejects(producerHarness({ twoQuestionSources: true }).run(), { code: 'PDF_MINERU_SOURCE_SCOPE_INVALID' });
    await assert.rejects(producerHarness({ responseOverride: { protocol: 'wrong' } }).run(), { code: 'MINERU_RESPONSE_INVALID' });
});

test('cancelling while the parse response is held stops projection and source persistence', async () => {
    const harness = producerHarness({ abortedAtParse: true });
    await assert.rejects(harness.run(), { code: 'MINERU_CANCELLED' });
    assert.equal(harness.persisted.length, 0);
});

test('separate answer and solution PDFs both contribute without one replacing the other', async () => {
    const harness = producerHarness({ separateSupports: true });
    const output = await harness.run();
    assert.equal(output.drafts.length, 1);
    assert.equal(output.drafts[0].answer, 'A');
    assert.match(output.drafts[0].solution, /甲符合题意/);
    assert.deepEqual(output.drafts[0].supportSources.map(source => source.roles.join('+')).sort(),
        ['answer', 'solution']);
});

test('MinerU review records keep manual crops and teacher-protected drafts', async () => {
    const C = require('../qisi-pdf-mineru-contract');
    const record = (no, extra = {}) => ({ id: 'b:mineru:' + no, batchId: 'b', questionNumber: no,
        status: 'pending', pdfReview: { protocol: 'pdf-mineru-v1',
            candidates: { question: [], answer: [], solution: [] },
            sourcePageImages: [{ sourceFileId: 'f', sourcePage: 1 }], taskProblems: [] }, ...extra });
    const draft = { ...record('1'), stem: '题干', options: ['甲', '乙'], type: '单选题', answer: 'A', solution: '',
        images: [], fieldProvenance: {}, producer: { routeId: 'pdf-mineru-v1' },
        pdfReview: { protocol: 'pdf-mineru-v1', optionLabels: ['A', 'B'], states: {},
            candidates: { question: [], answer: [], solution: [] }, sourcePageImages: [], taskProblems: [] } };
    const controller = { markFieldsManual: (value, fields) => ({ ...value, marked: fields }) };
    const crop = { id: 'img', url: 'data:image/png;base64,AA==', bbox: [0, 0, 10, 10],
        sourceFileId: 'f', sourceSha256: 'a'.repeat(64), assetPath: 'x.png' };
    const cropped = C.applyManualCrop(draft, crop, 'option:B', controller);
    assert.match(cropped.options[1], /\[\[IMAGE:img\]\]$/);
    assert.equal(cropped.images[0].position, 'option:B');
    assert.deepEqual(cropped.marked, ['options', 'images']);

    const submitted = { ...record('1'), status: 'submitted' };
    const manual = { ...record('2'), fieldProvenance: { stem: { status: 'manual' } } };
    const retained = C.retainReviewDrafts([record('1')], [submitted, manual]);
    assert.equal(retained.find(item => item.id === 'b:mineru:1').status, 'submitted');
    const missing = retained.find(item => item.id === 'b:mineru:2');
    assert.equal(missing.status, 'pending');
    assert.ok(missing.pdfReview.taskProblems.some(problem => /未返回/.test(problem)));
});

test('a descending support sequence leaves every question unbound with per-question evidence', async () => {
    const harness = producerHarness({ threeQuestions: true, descendingSupport: true });
    const output = await harness.run();
    assert.deepEqual(output.drafts.map(draft => draft.answer), ['', '', '']);
    for (const draft of output.drafts) {
        assert.ok(draft.pdfReview.taskProblems.some(problem => /答案未绑定/.test(problem)),
            JSON.stringify({ no: draft.questionNumber, problems: draft.pdfReview.taskProblems }));
    }
    assert.ok(output.unmatched.some(issue => issue.code === 'number-not-increasing'));
});
