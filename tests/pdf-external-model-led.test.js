const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../qisi-pdf-external-contract.js');
const I = require('../qisi-docx-producer-identity-contract.js');
const fixture = require('./fixtures/pdf-external-v2-evaluation.json');
const clone = value => JSON.parse(JSON.stringify(value));
function candidate() {
    const value = clone(fixture.result);
    value.wire_version = 'pdf-external-v2.2'; value.requests = []; value.unassigned = [];
    for (const stream of ['questions', 'answers', 'solutions']) for (const item of value[stream]) {
        item.item_id = stream + '-1'; item.occurrence_id = 'source-' + stream + '-1';
        item.evidence = [{ source_id: item.source_id, page: item.number_page, field: stream === 'questions' ? 'stem' : stream === 'answers' ? 'answer' : 'solution', option_label: null, quote: item.number_text, block_id: null }];
    }
    return value;
}
const check = value => C.validateWireResult(JSON.stringify(value), fixture.metadata, { ok: true, finishReason: 'stop' });
function review(value, hash = 'candidate-hash') {
    return { review_version: 'pdf-external-review-v1', candidate_hash: hash,
        pages: value.pages.map(p => ({ source_id: p.source_id, page: p.page, state: 'checked', issues: [] })),
        items: ['questions', 'answers', 'solutions', 'unassigned'].flatMap(s => value[s]).map(item => ({ item_id: item.item_id, verdict: 'pass', issues: [], evidence: [{ source_id: item.source_id, page: item.source_pages[0], quote: 'source' }] })),
        unrepresented: [], requests: [], summary: 'model judgement only' };
}
const reviewCheck = (report, value = candidate()) => C.validateReviewResult(JSON.stringify(report), fixture.metadata, value, 'candidate-hash', { ok: true, finishReason: 'stop' });

test('v2.2 has a separate frozen schema and legacy wire remains replayable', () => {
    assert.equal(check(candidate()).valid, true);
    assert.equal(check(clone(fixture.result)).valid, true);
    assert.equal(Object.isFrozen(C.SCHEMA_V22.properties.questions.items), true);
    const wrong = candidate(); wrong.wire_version = 'pdf-external-v9'; assert.equal(check(wrong).valid, false);
});
test('new response cannot pretend to be legacy and expected version cannot be downgraded', () => {
    const value = candidate(); delete value.wire_version; assert.equal(check(value).valid, false);
    assert.equal(C.validateWireResult(JSON.stringify(fixture.result), fixture.metadata, { ok: true, finishReason: 'stop', expectedWireVersion: 'pdf-external-v2.2' }).valid, false);
});
test('number labels and blank-page declarations are checked without understanding mathematics', () => {
    for (const change of [v => { v.answers[0].number_text = '9.'; }, v => { v.pages[1].state = 'blank'; }]) {
        const value = candidate(); change(value); assert.equal(check(value).valid, false);
    }
    const value = candidate(); value.questions[0].number_text = '（１）'; assert.equal(check(value).valid, true);
    value.solutions[0].text = '略'; assert.equal(check(value).valid, true, 'source may legitimately say 略; no keyword policy');
});
test('item IDs, source evidence, block references and context requests cannot invent authority', () => {
    for (const change of [
        v => { v.answers[0].item_id = v.questions[0].item_id; },
        v => { v.solutions[0].evidence[0].source_id = 'foreign'; },
        v => { v.questions[0].evidence[0].block_id = 'invented'; },
        v => { v.requests = [{ source_id: 's1', pages: [4], item_ids: ['questions-1'], reason: 'missing tail' }]; }
    ]) { const value = candidate(); change(value); assert.equal(check(value).valid, false); }
});
test('separate source occurrences never bypass duplicate sequence protection', () => {
    const value = candidate(), duplicate = clone(value.answers[0]);
    duplicate.item_id = 'answers-repeat'; duplicate.occurrence_id = 'another-visible-occurrence'; value.answers.push(duplicate);
    assert.equal(check(value).valid, true, 'preserve separately observed occurrence');
    assert.equal(C.evaluateSequences([value], ['1']).mode, 'fail-closed');
});
test('all source pages and candidate items must be accounted for by an independent review', () => {
    const value = candidate(); const good = review(value);
    const result = reviewCheck(good, value); assert.equal(result.valid, true); assert.equal(result.passed, true);
    for (const change of [r => r.items.pop(), r => r.pages.pop(), r => { r.candidate_hash = 'stale'; }, r => { r.items[0].item_id = 'foreign'; }]) {
        const bad = clone(good); change(bad); assert.equal(reviewCheck(bad, value).valid, false);
    }
});
test('valid review uncertainty and omissions are retained and do not pass', () => {
    const value = candidate();
    for (const change of [
        r => { r.items[0].verdict = 'uncertain'; },
        r => { r.pages[0].state = 'unreadable'; },
        r => { r.unrepresented.push({ source_id: 's1', page: 2, quote: 'unrepresented proof', reason: 'omission' }); },
        r => { r.items[0].issues.push({ code: 'source_conflict', field: 'stem', detail: 'visible glyph disagrees', source_pages: [1] }); }
    ]) { const report = review(value); change(report); const checked = reviewCheck(report, value); assert.equal(checked.valid, true); assert.equal(checked.passed, false); }
});
test('model-reviewed candidate is still not a controlled formal field before human adoption', () => {
    const value = candidate();
    const observation = { result: value, metadata: fixture.metadata, source: { sourceId: 's1', format: 'pdf', filename: 'sample.pdf', sourceOrder: 0 }, model: 'mock', requestId: 'r1', images: [], cropErrors: [], modelReview: { state: 'pass', result: review(value) } };
    const draft = C.buildDrafts([observation], { batchId: 'exam1', identityContract: I }).drafts[0];
    assert.equal(draft.manualConfirmed, false); assert.equal(draft.fieldProvenance.solution.controlledWriteAccepted, false);
    assert.equal(draft.pdfExternal.reviewStates.modelReview, 'pass');
    assert.equal(draft.pdfExternal.reviewStates.humanReview, 'pending');
    assert.equal(draft.pdfExternal.candidates.solution[0].item.text, value.solutions[0].text);
});

const Provider = require('../qisi-pdf-external-provider.js');
const P = require('../qisi-pdf-external-producer.js');
const image = 'data:image/png;base64,aA==';
const prices = [{ maxInput: 32000, inputYuanPerMillion: 0.2, outputYuanPerMillion: 0.8 }];
function producerHarness(bindings, options = {}) {
    const file = { id: 's1', filename: 'sample.pdf', fileType: 'pdf' }, saved = [];
    const wire = () => { const value = candidate(); value.pages.pop(); return value; };
    const response = value => ({ text: JSON.stringify(value), finishReason: 'stop', ok: true, usage: { prompt_tokens: 10, completion_tokens: 20 }, rawResponse: { original: true } });
    let config = { enabled: true, model: 'mock', reviewModel: 'review-mock', wireVersion: C.WIRE_VERSION, outputPages: 2, contextPages: 0, maxYuan: 5, priceTiers: prices, reviewPriceTiers: prices, ...options.config };
    const executor = Provider.createExecutor({ contract: C, ...bindings({ wire, response }) });
    const run = P.createProducer({ contract: C, identityContract: I, getConfig: () => config, getRoles: () => ['full'], renderPages: async () => [1,2].map(pageNo => ({ pageNo, url: image })), renderRegion: async () => ({ url: image, bbox: [1,1,10,10] }), resolveAsset: options.resolveAsset, persistSourceEvidence: async (_f, e) => saved.push(clone(e)), execute: executor });
    return { file, saved, run: signal => run({ batchId: 'exam1', sources: [file] }, signal), setConfig: values => { config = { ...config, ...values }; } };
}
test('pure text organizer receives no pages, file, parser receipt or image request fields', async () => {
    const execute = Provider.createExecutor({ contract: C,
        parse: async () => ({ parsedPages: fixture.metadata.sources[0].input_pages.map(page => ({ source_id: 's1', page, text: 'whole source' })) }),
        organize: async task => { for (const key of ['pages','file','parseReceipt','cachedParse','image_url']) assert.equal(Object.hasOwn(task, key), false); assert.equal(task.inputMode, 'text'); return { text: JSON.stringify(candidate()) }; }
    });
    await execute({ mode: 'parse-organize-text', wireVersion: C.WIRE_VERSION, metadata: clone(fixture.metadata), pages: [{ pageNo: 1, url: image }], file: { binary: true } });
});
test('independent review is a separate billed request tied to the unchanged full candidate', async () => {
    let reads = 0, reviews = 0;
    const h = producerHarness(({ wire, response }) => ({ recognize: async () => { reads++; return response(wire()); }, review: async task => { reviews++; return response(review(task.candidate, task.candidateHash)); } }));
    const first = await h.run(); const record = h.file.pdfExternalEvidence.tasks[0];
    assert.deepEqual(record.attempts.map(a => a.operation), ['direct','review']);
    assert.ok(record.attempts.every(a => a.requestHash && a.requestId && a.cost.known));
    assert.equal(first.drafts[0].pdfExternal.reviewStates.modelReview, 'pass');
    assert.equal(first.drafts[0].fieldProvenance.solution.controlledWriteAccepted, false);
    await h.run(); assert.equal(reads, 1); assert.equal(reviews, 1);
});
test('invalid JSON with usage still settles known cost before content rejection', async () => {
    const h = producerHarness(({ response }) => ({ recognize: async () => ({ ...response({}), text: '{' }), review: async () => { throw Error('must not review invalid candidate'); } }));
    await assert.rejects(h.run()); const record = h.file.pdfExternalEvidence.tasks[0];
    assert.equal(record.state, 'invalid'); assert.equal(record.cost.known, true); assert.ok(record.cost.yuan > 0);
});
test('HTTP error alone stays acceptance unknown and later explicit run cannot resend', async () => {
    let calls = 0;
    const h = producerHarness(() => ({ recognize: async () => { calls++; throw Object.assign(Error('gateway failed'), { status: 503 }); }, review: async () => {} }));
    await assert.rejects(h.run()); await assert.rejects(h.run()); assert.equal(calls, 1);
    assert.equal(h.file.pdfExternalEvidence.tasks[0].state, 'submission_unknown');
});
test('missing review configuration stops before paid recognition', async () => {
    let calls = 0; const h = producerHarness(() => ({ recognize: async () => { calls++; } }));
    await assert.rejects(h.run(), { code: 'PDF_EXTERNAL_REVIEW_NOT_CONFIGURED' }); assert.equal(calls, 0);
});
test('call cap blocks reviewer before dispatch while retaining the recognized candidate', async () => {
    let reads = 0, reviews = 0;
    const h = producerHarness(({ wire, response }) => ({ recognize: async () => { reads++; return response(wire()); }, review: async task => { reviews++; return response(review(task.candidate, task.candidateHash)); } }), { config: { maxCalls: 1 } });
    const result = await h.run(); assert.equal(reads, 1); assert.equal(reviews, 0);
    assert.equal(result.drafts[0].pdfExternal.reviewStates.modelReview, 'pending');
    assert.ok(result.windowErrors.some(e => e.code === 'PDF_EXTERNAL_BUDGET_EXHAUSTED'));
});
test('concurrent runs of one batch cannot dispatch two copies', async () => {
    let release, started; const entered = new Promise(resolve => { started = resolve; });
    const hold = new Promise(resolve => { release = resolve; });
    let calls = 0;
    const h = producerHarness(({ wire, response }) => ({ recognize: async () => { calls++; started(); await hold; return response(wire()); }, review: async task => response(review(task.candidate, task.candidateHash)) }));
    const first = h.run(); await entered;
    try { await assert.rejects(h.run(), { code: 'PDF_EXTERNAL_RUN_ACTIVE' }); } finally { release(); }
    await first; assert.equal(calls, 1);
});
test('source asset bytes and full parse bundle survive cache reuse and shared placements', async () => {
    let parses = 0, organizes = 0, resolves = 0;
    const h = producerHarness(({ wire, response }) => ({
        parse: async task => { parses++; return { parsedPages: task.metadata.sources[0].input_pages.map(page => ({ source_id: 's1', page, text: 'entire original source' })), assets: [{ asset_id: 'diagram', source_id: 's1', page: 2 }], rawResponse: { originalParse: true } }; },
        organize: async () => { organizes++; const value = wire();
            for (const [stream, field] of [['answers','answer'],['solutions','solution']]) { const item = value[stream][0]; item.text += ' [[figure:' + stream + '-diagram]]'; item.figures = [{ id: stream + '-diagram', page: 2, field, option_label: null, asset_id: 'diagram', bbox: null }]; }
            return response(value);
        }, review: async task => response(review(task.candidate, task.candidateHash))
    }), { config: { mode: 'parse-organize-text' }, resolveAsset: async (_id, result) => { resolves++; assert.equal(result.parseResult.rawResponse.originalParse, true); return { url: image, bbox: [10,20,40,60] }; } });
    const first = await h.run(), second = await h.run();
    assert.equal(first.drafts[0].images.length, 2); assert.equal(second.drafts[0].images.length, 2);
    assert.equal(parses, 1); assert.equal(organizes, 1); assert.equal(resolves, 1);
    assert.deepEqual(h.file.pdfExternalEvidence.tasks[0].attempts.map(a => a.operation), ['parse','organize','resource','review']);
});
test('async query budget exhaustion preserves original job instead of allowing a new upload', async () => {
    let uploads = 0, queries = 0;
    const h = producerHarness(() => ({ parse: async () => { uploads++; return { state: 'pending', jobId: 'same-job' }; }, resumeParse: async () => { queries++; }, organize: async () => {}, review: async () => {} }), { config: { mode: 'parse-organize-text', maxQueries: 0 } });
    await assert.rejects(h.run()); await assert.rejects(h.run()); await assert.rejects(h.run());
    assert.equal(uploads, 1); assert.equal(queries, 0);
    assert.equal(h.file.pdfExternalEvidence.tasks[0].state, 'parse_pending');
    assert.equal(h.file.pdfExternalEvidence.tasks[0].parseReceipt.jobId, 'same-job');
});
test('review acceptance unknown preserves candidate and prevents both recognition and review resubmission', async () => {
    let reads = 0, reviews = 0;
    const h = producerHarness(({ wire, response }) => ({ recognize: async () => { reads++; return response(wire()); }, review: async () => { reviews++; throw Error('unknown after sending'); } }));
    const result = await h.run(); assert.equal(result.drafts.length, 1); assert.equal(result.drafts[0].solution, candidate().solutions[0].text);
    await assert.rejects(h.run()); assert.equal(reads, 1); assert.equal(reviews, 1);
    assert.equal(h.file.pdfExternalEvidence.tasks[0].state, 'submission_unknown');
    assert.equal(h.file.pdfExternalEvidence.tasks[0].attempts[1].state, 'submission_unknown');
});
test('new default document scope carries full continuous evidence and never bridges selected-page gaps', () => {
    const config = { ...P.DEFAULT_CONFIG, outputPages: 1 };
    const full = P.tasks([1,2,3,4].map(pageNo => ({ pageNo })), config);
    assert.equal(full.length, 1); assert.deepEqual(full[0].outputPages, [1,2,3,4]); assert.deepEqual(full[0].contextPages, []);
    assert.deepEqual(P.tasks([1,2,8,9].map(pageNo => ({ pageNo })), config).map(t => t.outputPages), [[1,2],[8,9]]);
});
test('model fail leaves original whole proof untouched and blocks automatic acceptance', async () => {
    const h = producerHarness(({ wire, response }) => ({ recognize: async () => response(wire()), review: async task => { const report = review(task.candidate, task.candidateHash); report.items[2].verdict = 'fail'; report.items[2].issues.push({ code: 'omission', field: 'solution', detail: 'check missing proof', source_pages: [2] }); return response(report); } }));
    const result = await h.run(), draft = result.drafts[0];
    assert.equal(draft.solution, candidate().solutions[0].text); assert.equal(draft.pdfExternal.reviewStates.modelReview, 'fail');
    assert.equal(draft.manualConfirmed, false); assert.equal(draft.fieldProvenance.solution.controlledWriteAccepted, false);
    assert.ok(C.reviewProblem(draft));
});
test('cached model review is revalidated against candidate hash instead of trusting its pass flag', async () => {
    let reviews = 0;
    const h = producerHarness(({ wire, response }) => ({ recognize: async () => response(wire()), review: async task => { reviews++; return response(review(task.candidate, task.candidateHash)); } }));
    await h.run();const record = h.file.pdfExternalEvidence.tasks[0], changed = JSON.parse(record.text);
    changed.solutions[0].text = 'different cached version'; record.text = JSON.stringify(changed);
    const result = await h.run(); assert.equal(reviews, 1); assert.equal(record.state, 'validated');
    assert.equal(h.file.pdfExternalEvidence.tasks[0].modelReview.state, 'invalid');
    assert.ok(h.file.pdfExternalEvidence.tasks[0].modelReview.errors.includes('review-candidate-hash'));
    assert.notEqual(result.drafts[0].pdfExternal.reviewStates.modelReview, 'pass');
});
test('completed async job settles original parse fee separately from query fee without double billing', async () => {
    let uploads = 0;
    const h = producerHarness(({ wire, response }) => ({
        parse: async () => { uploads++; return { state: 'pending', jobId: 'billed-job' }; },
        resumeParse: async task => ({ parsedPages: task.metadata.sources[0].input_pages.map(page => ({ source_id: 's1', page, text: 'complete source' })), billing: { currency: 'CNY', known: true, yuan: 0.03 }, queryBilling: { currency: 'CNY', known: true, yuan: 0.002 } }),
        organize: async () => response(wire()), review: async task => response(review(task.candidate, task.candidateHash))
    }), { config: { mode: 'parse-organize-text' } });
    await assert.rejects(h.run()); await h.run(); const record = h.file.pdfExternalEvidence.tasks[0];
    assert.equal(uploads, 1); assert.deepEqual(record.attempts.map(a => a.operation), ['parse','query','organize','review']);
    assert.equal(record.attempts[0].cost.yuan, 0.03); assert.equal(record.attempts[1].cost.yuan, 0.002);
    assert.ok(Math.abs(record.cost.yuan - (0.032 + 2 * 0.000018)) < 1e-12);
});
test('user-selected Qwen 3.7 Flash profile binds separate recognition and review calls', async () => {
    const config = require('../qisi-config.js').pdfExternal;
    assert.equal(config.model, 'qwen3.7-flash-2026-07-15'); assert.equal(config.reviewModel, config.model);
    assert.equal(config.enabled, false); assert.equal(config.bindings.reviewUsesRecognizer, true);
    const calls = [];
    const execute = Provider.createExecutor({ contract: C, getBindings: () => config.bindings, recognize: async task => { calls.push(task); return { text: '{}' }; } });
    assert.equal(execute.supportsReview(), true);
    await execute({ mode: 'direct', wireVersion: C.WIRE_VERSION, metadata: fixture.metadata, pages: [], model: config.model });
    await execute({ mode: 'review-visual', wireVersion: C.WIRE_VERSION, metadata: fixture.metadata, pages: [], model: config.reviewModel, candidate: candidate(), candidateHash: 'hash' });
    assert.equal(calls.length, 2); assert.equal(calls[0].model, calls[1].model);
    assert.notEqual(calls[0].prompt, calls[1].prompt); assert.ok(calls[1].prompt.includes('candidate_hash'));
});
