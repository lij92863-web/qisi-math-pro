const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../qisi-pdf-page-evidence.js');
const C = require('../qisi-pdf-external-contract.js');
const fixture = require('./fixtures/pdf-qwen-staged.json');
const clone = value => JSON.parse(JSON.stringify(value));
const response = value => ({ text: JSON.stringify(value), model: 'mock', finishReason: 'stop', usage: { prompt_tokens: 10, completion_tokens: 20 }, rawResponse: { model: 'mock', original: value } });

test('page transcription preserves all context, proof, table and unnamed tail without splitting questions', () => {
    const before = clone(fixture), bundle = E.projectResponse(response(fixture.transcript), fixture.metadata, C);
    assert.equal(bundle.parsedPages.length, 3);
    assert.ok(bundle.parsedPages[0].text.includes('40.'));
    assert.ok(bundle.parsedPages[1].text.includes('原文第二步'));
    assert.ok(bundle.parsedPages[2].text.includes('（1）略'));
    assert.ok(bundle.parsedPages[2].text.includes('没有可见题号'));
    assert.deepEqual(bundle.parsedPages[1].blocks.map(block => block.block_id), ['block:s1:2:1','block:s1:2:2','block:s1:2:3']);
    assert.equal(bundle.assets[0].asset_id, 'asset:s1:2:3');
    assert.deepEqual(bundle.assets[0].bbox, [0.1,0.2,0.4,0.5]);
    assert.deepEqual(E.cropBox(bundle.assets[0], 's1', 2), [100,200,400,500]);
    assert.deepEqual(fixture, before);
});
test('transcription task asks for every input page and gives no output-range filtering duty', () => {
    const task = E.prepareTask({ metadata: fixture.metadata, pages: [{ pageNo: 1, url: 'original' }], model: 'mock', file: { binary: true }, cachedParse: {} }, C);
    assert.equal(task.model, 'mock'); assert.equal(Object.hasOwn(task, 'file'), false);
    assert.ok(task.prompt.includes('input_pages'));
    assert.equal(task.prompt.includes('context_only_pages'), false);
    assert.equal(task.prompt.includes('output_pages'), false);
    assert.equal(task.responseFormat.type, 'json_object');
});
test('missing/duplicate/foreign/reordered pages, false blank and bad boxes fail before projection', () => {
    const cases = [value => value.pages.pop(), value => value.pages.push(clone(value.pages[0])), value => value.pages[0].source_id = 'other', value => value.pages.reverse(), value => value.pages[0].state = 'blank', value => value.pages[1].blocks[2].bbox = [0.4,0.2,0.1,0.5], value => value.pages[1].blocks[2].bbox[0] = Infinity];
    for (const change of cases) { const value = clone(fixture.transcript); change(value); assert.throws(() => E.projectResponse(response(value), fixture.metadata, C), { code: 'PDF_PAGE_EVIDENCE_INVALID' }); }
    assert.throws(() => E.projectResponse({ ...response(fixture.transcript), finishReason: 'length' }, fixture.metadata, C), { code: 'PDF_PAGE_EVIDENCE_INVALID' });
});
test('cache restore revalidates raw page evidence and rejects modified text/resource namespaces', () => {
    const good = E.projectResponse(response(fixture.transcript), fixture.metadata, C);
    assert.deepEqual(E.restore(good, fixture.metadata, C), good);
    for (const change of [b => b.parsedPages[1].text += 'invented', b => b.assets[0].bbox[0] = 0.9, b => b.parsedPages[1].blocks[0].block_id = 'invented']) {
        const bad = clone(good); change(bad); assert.throws(() => E.restore(bad, fixture.metadata, C), { code: 'PDF_PAGE_EVIDENCE_CACHE_INVALID' });
    }
});
test('page/block model issues remain separate source evidence with exact page references', () => {
    const value = clone(fixture.transcript); value.pages[1].blocks[0].issues = ['原文字符无法看清']; value.warnings = ['来源整体异常'];
    const bundle = E.projectResponse(response(value), fixture.metadata, C);
    assert.equal(bundle.pageEvidence.issues[0].page, 2);
    assert.equal(bundle.pageEvidence.issues[0].block_id, 'block:s1:2:1');
    assert.equal(bundle.pageEvidence.issues.at(-1).page, null);
    assert.ok(bundle.parsedPages[1].text.includes('原文第二步'));
});
test('mechanical namespaces preserve distinct arbitrary source strings including surrogate code units', () => {
    const ids = ['s:1', 's%3A1', '\ud800', '\\ud800'], keys = [];
    for (const id of ids) {
        const metadata = clone(fixture.metadata), value = clone(fixture.transcript);
        metadata.sources[0].source_id = id; value.pages.forEach(page => { page.source_id = id; });
        const bundle = E.projectResponse(response(value), metadata, C); keys.push(bundle.assets[0].asset_id);
        assert.equal(bundle.assets[0].source_id, id);
    }
    assert.equal(new Set(keys).size, ids.length);
});

test('raw page identity is request-bound and arbitrary model formats remain opaque', () => {
    const raw = {text:'{"source_id":"forged","table_data":{"cells":[2,3]}}\n<script>material only</script>',finishReason:'stop',model:E.MODEL,attemptId:'r1'};
    const page = E.receiveRaw(raw,'trusted',3,'a'.repeat(64));
    assert.equal(page.source_id,'trusted');assert.equal(page.page,3);assert.equal(page.raw_text,raw.text);
    assert.throws(()=>E.receiveRaw({...raw,finishReason:'length'},'trusted',3,'a'.repeat(64)),{code:'PDF_PAGE_RAW_INVALID'});
    assert.throws(()=>E.receiveRaw({...raw,text:''},'trusted',3,'a'.repeat(64)),{code:'PDF_PAGE_RAW_INVALID'});
});
test('location schema rejects foreign identity, extra fields, invalid geometry and unsupported states', () => {
    const original={location_version:'pdf-page-regions-v1',source_id:'s1',page:1,state:'content',regions:[{kind:'figure',bbox:[0.1,0.2,0.4,0.5],anchor:'原图',issues:[]}],issues:[]};
    const receipt = value => ({text:JSON.stringify(value),finishReason:'stop',model:E.MODEL});
    const changes=[v=>v.source_id='foreign',v=>v.page=2,v=>v.extra='data',v=>v.regions[0].bbox=[0.5,0.2,0.1,0.4],v=>v.regions[0].bbox=[0,0,2,2],v=>v.regions[0].bbox=null,v=>v.state='blank',v=>v.state='unreadable'];
    for(const change of changes){const value=clone(original);change(value);assert.throws(()=>E.receiveLocation(receipt(value),'s1',1,C),{code:'PDF_PAGE_REGIONS_INVALID'});}
    const uncertain=clone(original);uncertain.regions[0].bbox=null;uncertain.regions[0].issues=['边界不可辨'];assert.deepEqual(E.receiveLocation(receipt(uncertain),'s1',1,C),uncertain);
});

test('omitted diagnostic reports remain unknown evidence while geometry stays strictly validated', () => {
    for (const kind of ['figure','table','spatial']) {
        const value={location_version:'pdf-page-regions-v1',source_id:'any-source',page:7,state:'content',regions:[{kind,bbox:[0.1,0.2,0.4,0.5],anchor:'可见邻近原文'}]};
        const receipt={text:JSON.stringify(value),finishReason:'stop',model:E.MODEL};
        assert.deepEqual(E.receiveLocation(receipt,'any-source',7,C),value,'receiver must preserve omitted vs reported-empty');
        for(const change of [v=>v.regions[0].bbox=null,v=>v.state='unreadable',v=>v.issues=null,v=>v.regions[0].issues='none',v=>delete v.regions[0].anchor,v=>delete v.regions[0].bbox]) {
            const bad=clone(value);change(bad);
            assert.throws(()=>E.receiveLocation({...receipt,text:JSON.stringify(bad)},'any-source',7,C),{code:'PDF_PAGE_REGIONS_INVALID'});
        }
    }
});
