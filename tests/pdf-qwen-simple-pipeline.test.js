const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../qisi-pdf-external-contract.js');
const E = require('../qisi-pdf-page-evidence.js');
const Provider = require('../qisi-pdf-external-provider.js');
const Producer = require('../qisi-pdf-external-producer.js');
const I = require('../qisi-docx-producer-identity-contract.js');
const fixture = require('./fixtures/pdf-qwen-simple.json');
const clone = v => JSON.parse(JSON.stringify(v));
const profile = 'qwen37-simple-model-led-v1', model = 'qwen3.7-flash-2026-07-15';
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZQAAAAASUVORK5CYII=';
const prices = [{ maxInput: 100000, inputYuanPerMillion: 0.2, outputYuanPerMillion: 0.8 }];
function wire(metadata) {
    const source = metadata.sources[0], source_id = source.source_id, scope_id = source.scope_id;
    const common = { source_id, scope_id, question_no: '7', number_text: '7.', number_page: 1, source_pages: [1,2], status: 'observed_complete', figures: [], issues: [] };
    const entry = (id, field, extra) => ({ ...clone(common), ...extra, item_id: id, occurrence_id: 'occ-' + id, evidence: [{ source_id, page: 1, field, option_label: null, quote: '7.', block_id: metadata.blocks[0].block_id }] });
    const fig = (id, field) => ({ id, page: 1, field, option_label: null, asset_id: metadata.assets[0].asset_id, bbox: null });
    const result={ wire_version: C.WIRE_VERSION, questions: [entry('q','stem',{ type:'free_response', stem:'原题完整正文 [[figure:q-image]]', options:[], figures:[fig('q-image','stem')] })], answers:[entry('a','answer',{text:'原文给出的答案'})], solutions:[entry('s','solution',{text:'前置证明第一步。前置证明第二步。上一页证明的尾段：故结论成立。另一处详解（1）略。 [[figure:s-image]]',figures:[fig('s-image','solution')]})], unassigned:[], pages:source.input_pages.map(page=>({source_id,page,state:'content',issues:[]})), warnings:[], requests:[] };
    for(const stream of ['questions','answers','solutions'])if(!source.allowed_streams.includes(stream))result[stream]=[];
    return result;
}
function review(task, options) {
    const s = task.metadata.sources[0];
    return { review_version:'pdf-external-review-v1', candidate_hash:task.candidateHash, pages:task.candidate.pages.map(p=>({source_id:p.source_id,page:p.page,state:'checked',issues:[]})), items:['questions','answers','solutions'].flatMap(k=>task.candidate[k]).map(i=>({item_id:i.item_id,verdict:options.failedReview?'fail':'pass',issues:options.failedReview?[{code:'omission',field:'item',detail:'原文遗漏',source_pages:[1]}]:[],evidence:[{source_id:s.source_id,page:1,quote:'原文'}]})), unrepresented:options.unrepresented?[{source_id:s.source_id,page:2,quote:'未表达表格',reason:'原页有内容未进候选'}]:[], requests:[], summary:'模拟双向核对' };
}
function harness(options = {}) {
    const calls=[], crops=[], file={id:'s1',filename:'synthetic.pdf',fileType:'pdf',pdfPageCount:2};
    let config={enabled:true,mode:'parse-organize-text',windowMode:'document',wireVersion:C.WIRE_VERSION,model,reviewModel:model,profileVersion:profile,strictTextSchema:true,parserPriceTiers:prices,priceTiers:prices,reviewPriceTiers:prices,...options.config};
    const recognize=async task=>{
        calls.push(clone(task));
        if (options.unknown && options.unknown === task.inputMode) throw Error('accepted unknown');
        if (options.cancel && options.cancel === task.inputMode) options.controller.abort();
        let value, text;
        const s=task.metadata.sources[0], page=s.input_pages[0];
        if (task.inputMode==='page-raw') text=fixture.raw[page-1];
        else if (task.inputMode==='page-regions') {
            value={location_version:'pdf-page-regions-v1',source_id:s.source_id,page,state:'content',regions:clone(fixture.regions[page-1]),issues:[]};
            if(options.locationIssue&&page===2){value.regions=[{kind:'spatial',bbox:null,anchor:'原页数阵',issues:['无法确定范围']}];value.issues=['源符号异常'];}
            if(options.badLocation&&page===1)value.table_data={hidden:2};
            if(options.missingReports){delete value.issues;for(const region of value.regions)delete region.issues;}
            text=JSON.stringify(value);
        } else if(task.inputMode==='text') {
            value=wire(task.metadata);if(options.badWire)value.questions[0].source_id='foreign';if(options.duplicateQuestion){const repeated=clone(value.questions[0]);repeated.item_id='q2';repeated.occurrence_id='occ-q2';repeated.figures=[];repeated.stem='另一次同号原题';value.questions.push(repeated);}if(options.badSequence){value.answers[0].question_no='8';value.answers[0].number_text='8.';}if(options.requests)value.requests=[{source_id:s.source_id,pages:[2],item_ids:['q'],reason:'仍需核对'}];if(options.unassigned)value.unassigned=[{item_id:'tail',source_id:s.source_id,scope_id:s.scope_id,source_pages:[2],kind:'solution',text:'无号原文尾段',figures:[],reason:'归属无法确定'}];text=JSON.stringify(value);
        } else { value=review(task,options);text=options.badReview?'{}':JSON.stringify(value); }
        return {text,ok:true,finishReason:options.truncated&&options.truncated===task.inputMode?'length':'stop',model:options.wrongModel===(task.inputMode||'review')?'wrong':model,usage:{prompt_tokens:10,completion_tokens:20},rawResponse:{original:text}};
    };
    const execute=Provider.createExecutor({contract:C,recognize,getBindings:()=>({parseUsesRecognizer:true,organizeUsesRecognizer:true,reviewUsesRecognizer:true})});
    const producer=Producer.createProducer({contract:C,identityContract:I,execute,getConfig:()=>config,getRoles:f=>options.multisource?(f.id==='s1'?['question']:['answer','solution']):(options.roles||['full']),renderPages:async()=>(options.pages||[1,2]).map(pageNo=>({pageNo,url:options.pageUrl||image,width:1,height:1})),renderRegion:async(_file,region)=>{crops.push(clone(region));if(options.cancelCrop)options.controller.abort();if(options.cropFailure)throw Error('crop failed');return{url:image,width:1,height:1};}});
    const sources=options.multisource?[file,{id:'s2',filename:'support.pdf',fileType:'pdf',pdfPageCount:2}]:[file];
    return {file,calls,crops,execute,setConfig:v=>{config={...config,...v};},run:()=>producer({batchId:'exam1',sources},options.controller?.signal)};
}
test('two pages run fixed R/R/L/L/O/V, preserve opaque evidence, and review all actual regions',async()=>{
    const h=harness(),result=await h.run(),record=h.file.pdfExternalEvidence.tasks[0];
    assert.deepEqual(h.calls.map(t=>t.inputMode||'review'),['page-raw','page-raw','page-regions','page-regions','text','review']);
    assert.deepEqual(record.attempts.map(a=>a.operation),['transcribe','transcribe','locate','locate','organize','review']);
    assert.equal(record.parseResult.protocol,'pdf-page-evidence-v2');
    assert.deepEqual(record.parseResult.rawPages.map(p=>p.raw_text),fixture.raw);
    assert.equal(record.parseResult.assets.length,2,'embedded raw bbox cannot create an asset');
    assert.equal(record.parseResult.rawPages[0].source_id,'s1');
    assert.ok(record.parseResult.rawPages.every(p=>p.attempt_id&&p.page_image_hash));
    const org=h.calls[4];assert.equal(Object.hasOwn(org,'pages'),false);assert.equal(Object.hasOwn(org,'crops'),false);
    assert.deepEqual(org.parsedPages.map(p=>p.text),fixture.raw);assert.equal(org.responseFormat.type,'json_schema');
    assert.equal(h.calls[0].responseFormat.type,'text');assert.equal(h.calls[2].prompt.includes(fixture.raw[0]),false);
    assert.equal(h.crops.length,2);assert.deepEqual(h.crops[0].bbox,[100,200,400,500]);
    assert.equal(h.calls[5].crops.length,2);assert.equal(h.calls[5].crops[0].placements.length,2);assert.deepEqual(h.calls[5].crops[1].placements,[]);
    assert.equal(record.attempts.at(-1).pageAppearances,4);assert.equal(record.calls,6);
    assert.ok(record.attempts.every(a=>a.cost.known));
    assert.ok(Math.abs(record.cost.parserCost.yuan-record.attempts.slice(0,4).reduce((n,a)=>n+a.cost.yuan,0))<1e-12);
    assert.equal(result.drafts[0].manualConfirmed,false);assert.equal(result.drafts[0].images.length,2);assert.equal(result.drafts[0].pdfExternal.reviewStates.modelReview,'pass');
    await h.run();assert.equal(h.calls.length,6);assert.equal(h.crops.length,2);
});
test('strict location failure preserves charged receipt and fences an explicit rerun',async()=>{
    const h=harness({badLocation:true});await assert.rejects(h.run());await assert.rejects(h.run());
    assert.equal(h.calls.length,3);const r=h.file.pdfExternalEvidence.tasks[0];assert.equal(r.attempts[2].state,'received');assert.ok(r.attempts[2].cost.yuan>0);assert.equal(r.state,'invalid');assert.equal(r.parseValidated,undefined);
});
for(const inputMode of ['page-raw','page-regions'])test(inputMode+' truncation never continues or automatically retries',async()=>{
    const h=harness({truncated:inputMode});await assert.rejects(h.run());await assert.rejects(h.run());assert.equal(h.calls.length,inputMode==='page-raw'?1:3);assert.equal(h.file.pdfExternalEvidence.tasks[0].attempts.at(-1).state,'received');
});
test('unknown request remains reserved and cannot be replayed',async()=>{
    const h=harness({unknown:'page-regions'});await assert.rejects(h.run());await assert.rejects(h.run());assert.equal(h.calls.length,3);const row=h.file.pdfExternalEvidence.tasks[0];assert.equal(row.state,'submission_unknown');assert.equal(row.attempts.at(-1).cost.known,false);assert.equal(row.attempts.at(-1).reservedYuan,0.25);
});
test('null location and source issues survive organizer and reviewer pass',async()=>{
    const h=harness({locationIssue:true}),result=await h.run(),draft=result.drafts[0];
    assert.equal(h.crops.length,2);assert.equal(h.file.pdfExternalEvidence.tasks[0].parseResult.assets.length,2);
    assert.ok(draft.pdfExternal.taskProblems.some(t=>t.includes('无法确定范围')));assert.ok(C.reviewPanel(draft).findings.some(f=>f.text.includes('源符号异常')));assert.equal(draft.manualConfirmed,false);
});

test('missing diagnostic reports stay visible after model pass and cached reload without fabricating model claims',async()=>{
    const h=harness({missingReports:true}),result=await h.run(),r=h.file.pdfExternalEvidence.tasks[0];
    assert.ok(result.drafts[0].pdfExternal.taskProblems.some(t=>t.includes('未报告')));
    assert.ok(C.reviewPanel(result.drafts[0]).findings.some(f=>f.text.includes('未报告')));
    assert.equal(result.drafts[0].manualConfirmed,false);
    assert.equal(Object.hasOwn(r.parseResult.locations[0],'issues'),false);
    assert.equal(Object.hasOwn(JSON.parse(r.parseResult.pageEvidence.locationResponses[0].response.text),'issues'),false);
    assert.equal(r.parseResult.pageEvidence.issues.length,4,'two pages and two regions with unreported diagnostics');
    const restored=await h.run();assert.equal(h.calls.length,6);
    assert.ok(restored.drafts[0].pdfExternal.taskProblems.some(t=>t.includes('未报告')));
});

test('explicit changed run reuses completed page receipts with original IDs and no duplicate charges',async()=>{
    const options={truncated:'page-regions'},h=harness(options);await assert.rejects(h.run());
    const first=clone(h.file.pdfExternalEvidence.tasks[0]);
    options.truncated=null;h.setConfig({strictTextSchema:false,maxCalls:7});
    const result=await h.run(),next=h.file.pdfExternalEvidence.tasks[1];
    assert.equal(h.calls.length,7);assert.equal(result.drafts.length,1);
    assert.deepEqual(h.file.pdfExternalEvidence.tasks[0],first);
    assert.deepEqual(next.reusedAttempts.map(a=>a.requestId),first.attempts.slice(0,2).map(a=>a.requestId));
    assert.deepEqual(next.parseResult.rawPages.map(p=>p.attempt_id),first.attempts.slice(0,2).map(a=>a.requestId));
    assert.deepEqual(next.attempts.map(a=>a.operation),['locate','locate','organize','review']);
    assert.equal(next.calls,4);assert.equal(first.calls+next.calls,7);
    const cents=h.file.pdfExternalEvidence.tasks.reduce((sum,r)=>sum+r.cost.yuan,0);
    assert.ok(Math.abs(cents-7*(10*0.2+20*0.8)/1e6)<1e-12);
    await h.run();assert.equal(h.calls.length,7);
});

for(const change of ['image','tokens','unsealed'])test('receipt recovery cannot spend against stale '+change+' inputs',async()=>{
    const options={truncated:'page-regions'},h=harness(options);await assert.rejects(h.run());options.truncated=null;
    h.setConfig({strictTextSchema:false,maxCalls:7});
    if(change==='image')options.pageUrl=image+'different';
    if(change==='tokens')h.setConfig({maxTokens:16384});
    if(change==='unsealed')h.file.pdfExternalEvidence.tasks[0].attempts.forEach(a=>delete a.responseHash);
    await assert.rejects(h.run(),{code:'PDF_EXTERNAL_BUDGET_EXHAUSTED'});assert.equal(h.calls.length,3);
});

test('tampered page receipt is detected before any resumed request and never repaired in place',async()=>{
    const options={truncated:'page-regions'},h=harness(options);await assert.rejects(h.run());options.truncated=null;
    h.file.pdfExternalEvidence.tasks[0].attempts[0].response.text+=' forged';h.setConfig({strictTextSchema:false});
    await assert.rejects(h.run(),{code:'PDF_PAGE_EVIDENCE_CACHE_INVALID'});assert.equal(h.calls.length,3);
});

test('unknown receipt blocks changed configurations and successful siblings cannot erase its reservation',async()=>{
    const h=harness({unknown:'page-regions'});await assert.rejects(h.run());const previous=clone(h.file.pdfExternalEvidence.tasks[0]);
    h.setConfig({strictTextSchema:false});await assert.rejects(h.run(),{code:'PDF_EXTERNAL_SUBMISSION_UNKNOWN'});
    assert.equal(h.calls.length,3);assert.deepEqual(h.file.pdfExternalEvidence.tasks[0],previous);
});
test('bad organizer stops before cropping and never spends review or revise',async()=>{
    const h=harness({badWire:true});await assert.rejects(h.run());await assert.rejects(h.run());assert.equal(h.calls.length,5);assert.equal(h.crops.length,0);
});
test('review verdict and unrepresented content remain pending human work without model repair',async()=>{
    const h=harness({failedReview:true,unrepresented:true,requests:true}),result=await h.run();assert.equal(h.calls.length,6);assert.equal(result.drafts[0].pdfExternal.reviewStates.modelReview,'fail');assert.ok(C.reviewPanel(result.drafts[0]).findings.some(f=>f.text==='未表达表格'));await h.run();assert.equal(h.calls.length,6);
});
test('technical crop failure stops before review including unplaced regions',async()=>{
    const h=harness({cropFailure:true}),result=await h.run();assert.equal(h.calls.length,5);assert.equal(result.drafts[0].pdfExternal.reviewStates.modelReview,'pending');await h.run();assert.equal(h.calls.length,5);
});
test('invalid review cannot resume itself or replace the candidate',async()=>{
    const h=harness({badReview:true}),result=await h.run();assert.notEqual(result.drafts[0].pdfExternal.reviewStates.modelReview,'pass');await h.run();assert.equal(h.calls.length,6);
});
test('cancellation after response preserves billing and stops the next step',async()=>{
    const controller=new AbortController(),h=harness({controller,cancel:'page-raw'});await assert.rejects(h.run(),{name:'AbortError'});assert.equal(h.calls.length,1);assert.equal(h.file.pdfExternalEvidence.tasks[0].attempts[0].state,'received');assert.equal(h.file.pdfExternalEvidence.tasks[0].state,'cancelled');assert.equal(h.file.pdfExternalEvidence.tasks[0].cost.known,true);
});
test('planned fixed calls and window mode are rejected before model submission',async()=>{
    for(const config of [{maxCalls:5},{windowMode:'window'},{model:'another-model'},{reviewModel:'another-model'}]){const h=harness({config});await assert.rejects(h.run());assert.equal(h.calls.length,0);}
});
test('text capacity stops without summarizing or adding calls',async()=>{
    const h=harness({config:{maxPromptBytes:1}});await assert.rejects(h.run());assert.equal(h.calls.length,0);
});
test('changed raw bundle/resource cache is rejected without automatic paid recovery',async()=>{
    for(const change of [r=>r.parseResult.rawPages[0].raw_text+='forged',r=>r.parseResult.assets[0].bbox[0]=0.9]){const h=harness();await h.run();change(h.file.pdfExternalEvidence.tasks[0]);await assert.rejects(h.run());assert.equal(h.calls.length,6);}
});
test('changed crop bytes invalidate visual pass while retaining original raw evidence',async()=>{
    const h=harness();await h.run();h.file.pdfExternalEvidence.tasks[0].resolvedAssets[0].value.url='data:image/png;base64,changed';const result=await h.run();assert.equal(h.calls.length,6);assert.notEqual(result.drafts[0].pdfExternal.reviewStates.modelReview,'pass');
});
test('organizer setting change reuses only the complete page bundle',async()=>{
    const h=harness();await h.run();h.setConfig({strictTextSchema:false});await h.run();assert.equal(h.calls.length,8);assert.equal(h.calls.filter(c=>c.inputMode==='page-raw').length,2);assert.equal(h.file.pdfExternalEvidence.tasks.length,2);
});
test('native transport sends plain text R and labels unplaced asset crops',async()=>{
    const Q=require('../qisi-qwen-vision-source-port.js'),requests=[];
    const recognize=Q.createPdfWindowRecognizer({transport:{request:async(_name,req)=>{requests.push(JSON.parse(req.body));return{ok:true,json:async()=>({choices:[{message:{content:'原文'},finish_reason:'stop'}]})};}}});
    await recognize({model,responseFormat:{type:'text'},pages:[{pageNo:1,url:image}],prompt:'raw'});
    await recognize({model,prompt:'review',crops:[{asset_id:'unused',source_id:'s1',page:1,placements:[],url:image}]});
    assert.equal(requests[0].response_format.type,'text');assert.ok(requests[1].messages[0].content.some(c=>c.type==='text'&&c.text.includes('unused')&&c.text.includes('placements')));
});
test('incomplete original-page scope is rejected before any request',async()=>{
    const h=harness({pages:[2]});await assert.rejects(h.run(),{code:'PDF_EXTERNAL_SIMPLE_SCOPE_INVALID'});assert.equal(h.calls.length,0);
});
test('inconsistent answer/solution sequence stops before cropping or review',async()=>{
    const h=harness({badSequence:true});await assert.rejects(h.run());assert.equal(h.calls.length,5);assert.equal(h.crops.length,0);
});
test('returned model mismatch cannot approve organizer or reviewer content',async()=>{
    const h=harness({wrongModel:'text'});await assert.rejects(h.run());assert.equal(h.calls.length,5);
    const reviewed=harness({wrongModel:'review'}),result=await reviewed.run();assert.notEqual(result.drafts[0].pdfExternal.reviewStates.modelReview,'pass');const rerun=await reviewed.run();assert.notEqual(rerun.drafts[0].pdfExternal.reviewStates.modelReview,'pass');assert.equal(reviewed.calls.length,6);
});
test('image-count bound stops review and remains fenced on rerun',async()=>{
    const h=harness({config:{maxRequestImages:1}}),result=await h.run();assert.equal(h.calls.length,5);assert.notEqual(result.drafts[0].pdfExternal.reviewStates.modelReview,'pass');await h.run();assert.equal(h.calls.length,5);
});
test('unassigned raw content remains visible and does not trigger dynamic context calls',async()=>{
    const h=harness({unassigned:true}),result=await h.run();assert.equal(h.calls.length,6);assert.equal(result.unassigned[0].text,'无号原文尾段');assert.ok(result.drafts[0].pdfExternal.taskProblems.some(t=>t.includes('无法归属')));
});
test('question-only duplicate sequence stops before review using the existing gate',async()=>{
    const h=harness({roles:['question'],duplicateQuestion:true});await assert.rejects(h.run());assert.equal(h.calls.length,5);assert.equal(h.crops.length,0);assert.equal(h.file.pdfExternalEvidence.tasks[0].error.code,'PDF_EXTERNAL_SEQUENCE_INVALID');
});
test('question and support sources keep independent fixed stages and original source identities',async()=>{
    const h=harness({multisource:true}),result=await h.run();assert.equal(h.calls.length,12);assert.equal(result.drafts.length,1);assert.equal(result.drafts[0].supportSources[0].sourceId,'s2');assert.equal(result.drafts[0].manualConfirmed,false);await h.run();assert.equal(h.calls.length,12);
});
test('cached invalid review still fences later source calls',async()=>{
    const h=harness({multisource:true,badReview:true});await h.run();assert.equal(h.calls.length,6);await h.run();assert.equal(h.calls.length,6);
});
test('cancellation during mechanical crops cannot resume itself into a new review request',async()=>{
    const options={controller:new AbortController(),cancelCrop:true},h=harness(options);await assert.rejects(h.run(),{name:'AbortError'});assert.equal(h.file.pdfExternalEvidence.tasks[0].state,'cancelled');assert.equal(h.calls.length,5);options.controller=new AbortController();options.cancelCrop=false;await assert.rejects(h.run());assert.equal(h.calls.length,5);
});
