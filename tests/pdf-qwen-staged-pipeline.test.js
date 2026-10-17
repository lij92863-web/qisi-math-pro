const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../qisi-pdf-external-contract.js');
const E = require('../qisi-pdf-page-evidence.js');
const Provider = require('../qisi-pdf-external-provider.js');
const Producer = require('../qisi-pdf-external-producer.js');
const I = require('../qisi-docx-producer-identity-contract.js');
const fixture = require('./fixtures/pdf-qwen-staged.json');
const clone = value => JSON.parse(JSON.stringify(value));
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZQAAAAASUVORK5CYII=';
const prices = [{ maxInput: 100000, inputYuanPerMillion: 0.2, outputYuanPerMillion: 0.8 }];
function wire(metadata) {
    const common = { source_id: 's1', scope_id: 'exam1', question_no: '41', number_text: '41.', number_page: 2, source_pages: [2,3], status: 'observed_complete', figures: [], issues: [] };
    const entry = (id, field, body) => ({ ...clone(common), ...body, item_id: id, occurrence_id: 'occ-' + id, evidence: [{ source_id: 's1', page: 2, field, option_label: null, quote: '41.', block_id: metadata.blocks.find(block => block.page === 2).block_id }] });
    const fig = (id, field) => ({ id, page: 2, field, option_label: null, asset_id: metadata.assets[0].asset_id, bbox: null });
    return { wire_version: C.WIRE_VERSION, questions: [entry('q', 'stem', { type: 'free_response', stem: '已知 $x^2=1$。 [[figure:q-fig]]', options: [], figures: [fig('q-fig','stem')] })], answers: [entry('a','answer',{ text: '$x=\\pm1$' })], solutions: [entry('s','solution',{ text: '前置完整证明：原文第一步。原文第二步。\n上一页证明的尾段：故结论成立。\n另一处详解（1）略。 [[figure:s-fig]]', figures: [fig('s-fig','solution')] })], unassigned: [], pages: metadata.sources[0].input_pages.map(page => ({ source_id: 's1', page, state: metadata.sources[0].context_only_pages.includes(page) ? 'context_only' : 'content', issues: [] })), warnings: [], requests: [] };
}
function modelReview(candidate, candidateHash, failed = false) {
    return { review_version: 'pdf-external-review-v1', candidate_hash: candidateHash, pages: candidate.pages.map(row => ({ source_id: row.source_id, page: row.page, state: 'checked', issues: [] })), items: ['questions','answers','solutions','unassigned'].flatMap(stream => candidate[stream]).map(item => ({ item_id: item.item_id, verdict: failed ? 'fail' : 'pass', issues: failed ? [{ code: 'omission', field: 'item', detail: '候选未完整表达原文', source_pages: [2] }] : [], evidence: [{ source_id: 's1', page: 2, quote: '原文' }] })), unrepresented: [], requests: [], summary: '独立复核' };
}
function harness(options = {}) {
    const calls = [], crops = [], file = { id: 's1', filename: 'synthetic.pdf', fileType: 'pdf', pdfPageCount: 3 };
    let config = { enabled: true, mode: 'parse-organize-text', wireVersion: C.WIRE_VERSION, model: 'mock', reviewModel: 'mock', parserVersion: E.VERSION, strictTextSchema: true, parserPriceTiers: prices, priceTiers: prices, reviewPriceTiers: prices, ...options.config };
    const recognize = async task => {
        calls.push(clone(task));
        if (task.inputMode === 'page-transcription') {
            if (options.unknownParse) throw Error('accepted unknown');
            const result = clone(fixture.transcript); if (options.badParse) result.pages.pop(); if (options.parseIssue) result.pages[1].issues = ['源页字符异常'];
            return { text: JSON.stringify(result), finishReason: 'stop', model: 'mock', usage: { prompt_tokens: 10, completion_tokens: 20 }, rawResponse: { parsed: result } };
        }
        if (task.inputMode === 'text') return { text: JSON.stringify(wire(task.metadata)), finishReason: 'stop', model: 'mock', usage: { prompt_tokens: 10, completion_tokens: 20 }, rawResponse: { organized: true } };
        assert.ok(crops.length >= 1); assert.equal(task.crops.length, 2); assert.equal(task.pages.length, 3);
        return { text: JSON.stringify(modelReview(task.candidate, task.candidateHash, options.failedReview)), finishReason: 'stop', model: 'mock', usage: { prompt_tokens: 10, completion_tokens: 20 } };
    };
    const execute = Provider.createExecutor({ contract: C, recognize, getBindings: () => ({ parseUsesRecognizer: true, organizeUsesRecognizer: true, reviewUsesRecognizer: true }) });
    const producer = Producer.createProducer({ contract: C, identityContract: I, execute, getConfig: () => config, getRoles: () => ['full'], renderPages: async () => [1,2,3].map(pageNo => ({ pageNo, url: image })), renderRegion: async (_file, region) => { crops.push(region); return { url: image, ...(options.rendererOmitsBox ? {} : { bbox: region.bbox }) }; } });
    return { calls, crops, file, execute, config, setConfig: changes => { config = { ...config, ...changes }; }, run: () => producer({ batchId: 'exam1', sources: [file] }) };
}
test('one selected model runs transcription/text organization/review with actual crops and independent billing', async () => {
    const h = harness(), result = await h.run(), record = h.file.pdfExternalEvidence.tasks[0];
    assert.equal(h.calls.length, 3); assert.deepEqual(record.attempts.map(row => row.operation), ['parse','organize','review']);
    assert.ok(record.attempts.every(row => row.requestHash && row.cost.known));
    assert.equal(record.attempts[2].pageAppearances, 5);
    assert.equal(h.calls[1].responseFormat.type, 'json_schema');
    assert.equal(Object.hasOwn(h.calls[1], 'pages'), false); assert.equal(Object.hasOwn(h.calls[1], 'crops'), false);
    assert.ok(h.calls[1].parsedPages[0].text.includes('40.')); assert.ok(h.calls[1].parsedPages[1].text.includes('原文第二步'));
    assert.equal(result.drafts[0].manualConfirmed, false); assert.equal(result.drafts[0].pdfExternal.reviewStates.modelReview, 'pass');
    assert.equal(result.drafts[0].images.length, 2); assert.deepEqual(h.crops[0].bbox, [100,200,400,500]);
    await h.run(); assert.equal(h.calls.length, 3); assert.equal(h.crops.length, 1);
});
test('invalid transcription charges received usage and never asks organizer/reviewer to repair it', async () => {
    const h = harness({ badParse: true }); await assert.rejects(h.run());
    const record = h.file.pdfExternalEvidence.tasks[0]; assert.equal(h.calls.length, 1);
    assert.equal(record.attempts[0].state, 'received'); assert.equal(record.attempts[0].cost.known, true); assert.ok(record.attempts[0].cost.yuan > 0);
    assert.ok(record.attempts[0].response.rawResponse.parsed); assert.equal(record.state, 'invalid');
});
test('validated resource coordinates survive renderers that return only crop bytes', async () => {
    const h = harness({ rendererOmitsBox: true }), result = await h.run();
    assert.equal(result.drafts[0].pdfExternal.reviewStates.modelReview, 'pass');
    assert.deepEqual(result.drafts[0].images.map(row => row.bbox), [[100,200,400,500],[100,200,400,500]]);
    await h.run(); assert.equal(h.crops.length, 1); assert.equal(h.calls.length, 3);
});
test('unknown transcription fences all later phases and explicit reruns', async () => {
    const h = harness({ unknownParse: true }); await assert.rejects(h.run()); await assert.rejects(h.run());
    assert.equal(h.calls.length, 1); assert.equal(h.file.pdfExternalEvidence.tasks[0].state, 'submission_unknown');
});
test('modified cached transcription fails closed without new model calls or silent correction', async () => {
    const h = harness(); await h.run(); h.file.pdfExternalEvidence.tasks[0].parseResult.parsedPages[1].text += 'forged';
    await assert.rejects(h.run()); assert.equal(h.calls.length, 3);
});
test('organizer profile change reuses complete raw transcription but re-organizes and re-reviews', async () => {
    const h = harness(); await h.run(); h.setConfig({ profileVersion: 'new-organizer' }); const second = await h.run();
    assert.equal(h.calls.filter(task => task.inputMode === 'page-transcription').length, 1);
    assert.equal(h.calls.filter(task => task.inputMode === 'text').length, 2);
    assert.equal(h.calls.filter(task => !['page-transcription','text'].includes(task.inputMode)).length, 2);
    assert.equal(second.drafts[0].pdfExternal.reviewStates.modelReview, 'pass');
});
test('model judgment and raw transcription issues cannot silently approve teacher fields', async () => {
    const h = harness({ parseIssue: true, failedReview: true }), result = await h.run();
    assert.equal(result.drafts[0].pdfExternal.reviewStates.modelReview, 'fail');
    assert.ok(result.drafts[0].pdfExternal.taskProblems.some(text => text.includes('源页字符异常')));
    assert.ok(C.reviewPanel(result.drafts[0]).findings.some(row => row.text.includes('源页字符异常')));
    assert.equal(result.drafts[0].manualConfirmed, false);
});
test('changing actual crop bytes invalidates an old pass without silently spending another request', async () => {
    const h = harness(); await h.run(); const record = h.file.pdfExternalEvidence.tasks[0];
    record.resolvedAssets[0].value.url = 'data:image/png;base64,different-cache-bytes';
    const result = await h.run(); assert.equal(h.calls.length, 3);
    assert.notEqual(result.drafts[0].pdfExternal.reviewStates.modelReview, 'pass');
    assert.ok(h.file.pdfExternalEvidence.tasks[0].modelReview.errors.includes('review-crop-version'));
});
test('parser model changes invalidate raw cache while retaining previous receipt evidence', async () => {
    const h = harness(); await h.run(); h.setConfig({ model: 'mock-next', reviewModel: 'mock-next' }); await h.run();
    assert.equal(h.calls.filter(task => task.inputMode === 'page-transcription').length, 2);
    assert.equal(h.file.pdfExternalEvidence.tasks.length, 2);
    assert.equal(h.file.pdfExternalEvidence.tasks[0].attempts[0].model, 'mock');
});
test('an unavailable cached crop cannot replay an old visual pass when no crop images remain', async () => {
    const h = harness(); await h.run(); h.file.pdfExternalEvidence.tasks[0].resolvedAssets[0].value.url = '';
    const result = await h.run(); assert.equal(h.calls.length, 3);
    assert.notEqual(result.drafts[0].pdfExternal.reviewStates.modelReview, 'pass');
    assert.ok(h.file.pdfExternalEvidence.tasks[0].modelReview.errors.includes('review-crop-version'));
    assert.equal(result.drafts[0].images.length, 0);
});
test('direct routes ignore inactive parser bindings and remain compatible with explicit staged configuration', async () => {
    const calls = [], file = { id: 's1', filename: 'direct.pdf', fileType: 'pdf', pdfPageCount: 3 };
    const recognize = async task => {
        calls.push(task.mode);
        if (task.mode !== 'direct') return { text: JSON.stringify(modelReview(task.candidate, task.candidateHash)), finishReason: 'stop' };
        const value = wire({ ...task.metadata, assets: [{ asset_id: 'unused' }], blocks: [{ block_id: 'unused', page: 2 }] });
        for (const stream of ['questions','answers','solutions']) for (const item of value[stream]) { item.figures = []; item.evidence.forEach(ref => { ref.block_id = null; }); if (item.stem) item.stem = 'Original $x^2=1$.'; if (item.text) item.text = 'Original answer or full proof.'; }
        return { text: JSON.stringify(value), finishReason: 'stop' };
    };
    const execute = Provider.createExecutor({ contract: C, recognize, getBindings: () => ({ parseUsesRecognizer: true, organizeUsesRecognizer: true, reviewUsesRecognizer: true }) });
    const producer = Producer.createProducer({ contract: C, identityContract: I, execute, getConfig: () => ({ enabled: true, mode: 'direct', wireVersion: C.WIRE_VERSION, model: 'mock', reviewModel: 'mock' }), getRoles: () => ['full'], renderPages: async () => [1,2,3].map(pageNo => ({ pageNo, url: image })), renderRegion: async () => { throw Error('No crop requested'); } });
    const result = await producer({ batchId: 'exam1', sources: [file] });
    assert.equal(result.drafts.length, 1); assert.equal(result.drafts[0].pdfExternal.reviewStates.modelReview, 'pass');
    assert.deepEqual(calls, ['direct', undefined]); assert.equal(file.pdfExternalEvidence.tasks[0].parseResult, undefined);
});
test('same recognizer is never an implicit parser or organizer fallback', async () => {
    let calls = 0; const execute = Provider.createExecutor({ contract: C, recognize: async () => { calls++; } });
    await assert.rejects(execute({ mode: 'parse-organize-text', wireVersion: C.WIRE_VERSION, metadata: fixture.metadata }), { code: 'PDF_EXTERNAL_NOT_CONFIGURED' });
    assert.equal(calls, 0);
});
test('native Qwen transport serializes text-only organization and separately labelled actual crops', async () => {
    const Q = require('../qisi-qwen-vision-source-port.js'), requests = [];
    const recognize = Q.createPdfWindowRecognizer({ transport: { request: async (_name, request) => { requests.push(JSON.parse(request.body)); return { ok: true, json: async () => ({ choices: [{ message: { content: '{}' }, finish_reason: 'stop' }] }) }; } } });
    await recognize({ model: 'mock', prompt: 'text', responseFormat: { type: 'json_schema', json_schema: {} } });
    await recognize({ model: 'mock', prompt: 'review', pages: [{ pageNo: 2, url: image }], crops: [{ item_id: 's', placement_id: 's-fig', source_id: 's1', page: 2, field: 'solution', option_label: null, url: image }] });
    const first = requests[0].messages[0].content, second = requests[1].messages[0].content;
    assert.equal(first.some(part => part.type === 'image_url'), false);
    assert.equal(requests[0].response_format.type, 'json_schema');
    assert.equal(second.filter(part => part.type === 'image_url').length, 2);
    assert.ok(second.some(part => part.type === 'text' && part.text.includes('placement_id') && part.text.includes('s-fig')));
});
