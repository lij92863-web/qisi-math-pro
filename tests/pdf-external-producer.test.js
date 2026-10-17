const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../qisi-pdf-external-contract.js'),I=require('../qisi-docx-producer-identity-contract.js');
const Provider=require('../qisi-pdf-external-provider.js'),P=require('../qisi-pdf-external-producer.js');
const clone=v=>JSON.parse(JSON.stringify(v));
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF2QAAAAASUVORK5CYII=';
function wire(task,transform){const s=task.metadata.sources[0],raw={questions:[],answers:[],solutions:[],unassigned:[],pages:s.input_pages.map(page=>({source_id:s.source_id,page,state:s.context_only_pages.includes(page)?'context_only':'content',issues:[]})),warnings:[]};for(const n of s.output_pages){const b={source_id:s.source_id,scope_id:s.scope_id,question_no:String(n),number_text:n+'.',number_page:n,source_pages:[n],status:'observed_complete',figures:[],issues:[]};for(const stream of s.allowed_streams)raw[stream].push(stream==='questions'?{...b,type:'single_choice',stem:'Question '+n,options:['A','B','C','D'].map(label=>({label,text:label+' text'}))}:{...b,text:stream==='answers'?'A':'Complete proof ending, all methods retained.'});}transform?.(raw);return {text:JSON.stringify(raw),finishReason:'stop',model:'mock',usage:{prompt_tokens:10,completion_tokens:20},rawResponse:{fixture:'unchanged'}};}
function harness(options={}){let calls=0,config={enabled:true,wireVersion:C.LEGACY_WIRE_VERSION,model:'mock',profileVersion:'fixture-v1',outputPages:1,contextPages:1,...options.config};const file={id:'s1',filename:'fixture.pdf',fileType:'pdf'},saved=[],tasks=[];const ports={contract:C,identityContract:I,getConfig:()=>config,getRoles:()=>['full'],renderPages:async()=>[1,2,3].map(pageNo=>({pageNo,url:image})),renderRegion:async()=>({url:image,width:1,height:1}),persistSourceEvidence:async(f,e)=>saved.push(clone(e)),execute:async task=>{calls++;tasks.push(task);options.before?.(task,saved);return options.execute?options.execute(task):wire(task,options.transform);}};const run=P.createProducer(ports);return {file,saved,tasks,run:signal=>run({batchId:'exam',sources:[file]},signal),calls:()=>calls,setConfig:value=>{config={...config,...value};}};}

test('owner ranges partition pages while retaining two-sided context',()=>{const t=P.tasks([1,2,3,4,5,6,7].map(pageNo=>({pageNo})),{outputPages:3,contextPages:1});assert.deepEqual(t.map(x=>x.outputPages),[[1,2,3],[4,5,6],[7]]);assert.deepEqual(t[1].contextPages,[3,7]);});
test('disabled external configuration stops before rendering or requests',async()=>{const h=harness({config:{enabled:false}});await assert.rejects(h.run(),/待配置/);assert.equal(h.calls(),0);});
test('request is persisted before dispatch, whole draft fields survive successful cache reuse',async()=>{const h=harness({before:(_task,saved)=>assert.equal(saved.at(-1).tasks.at(-1).state,'registered')});const first=await h.run();assert.equal(first.pdfProtocol,'pdf-external-v2');assert.equal(first.drafts.length,3);assert.equal(h.calls(),3);assert.ok(first.drafts.every(q=>!q.manualConfirmed&&q.pdfExternal&&q.solution.endsWith('retained.')));const second=await h.run();assert.equal(h.calls(),3);assert.deepEqual(second.drafts.map(q=>q.solution),first.drafts.map(q=>q.solution));});
test('changed prompt/profile configuration cannot reuse stale successful response',async()=>{const h=harness();await h.run();h.setConfig({profileVersion:'fixture-v2'});await h.run();assert.equal(h.calls(),6);});
test('unknown acceptance is saved and budget/profile changes cannot automatically dispatch twice',async()=>{const h=harness({execute:async()=>{throw Error('connection failed');}});await assert.rejects(h.run());assert.equal(h.calls(),1);assert.equal(h.file.pdfExternalEvidence.tasks[0].state,'submission_unknown');h.setConfig({maxYuan:21,profileVersion:'fixture-v2'});await assert.rejects(h.run());assert.equal(h.calls(),1);});
test('truncation remains failed evidence, not a cache success',async()=>{const h=harness({execute:async t=>({...wire(t),finishReason:'length'})});await assert.rejects(h.run());assert.ok(h.file.pdfExternalEvidence.tasks.every(t=>t.state==='invalid'));});
test('cross-window jump-back and one-sided missing support remain rejected',async()=>{const h=harness({transform:r=>{if(r.answers[0]?.question_no==='2')r.answers=[];}});const result=await h.run();assert.equal(result.drafts[2].pdfExternal.sequenceGate.mode,'prefix');assert.equal(result.drafts[2].fieldProvenance.answer.status,'rejected');});
test('cancellation with late successful response cannot create drafts',async()=>{const controller=new AbortController(),h=harness({execute:async t=>{controller.abort();return wire(t);}});await assert.rejects(h.run(controller.signal),{name:'AbortError'});assert.equal(h.calls(),1);assert.equal(h.file.pdfExternalEvidence.tasks[0].state,'received');});
test('original crop pixels and inline field token are mechanically bound',async()=>{const h=harness({transform:r=>{const q=r.questions[0];q.stem+=' [[figure:f1]]';q.figures=[{id:'f1',page:q.number_page,field:'stem',option_label:null,asset_id:null,bbox:[0.1,0.2,0.4,0.6]}];}});const result=await h.run(),q=result.drafts[0];assert.equal(q.images[0].url,image);assert.deepEqual(q.images[0].bbox,[100,200,400,600]);assert.ok(q.stem.includes('[[IMAGE:'+q.images[0].id+']]'));assert.equal(q.stem.includes('[[figure:'),false);assert.equal(q.imageReviewStatus,'need_confirm');});
test('two-stage external mode preserves parser evidence and full text through organizer',async()=>{const h=harness();const stages=[];const execute=Provider.createExecutor({contract:C,parse:async task=>({parsedPages:task.metadata.sources[0].input_pages.map(page=>({source_id:'s1',page,text:'原解析全文'})),rawResponse:{original:true}}),organize:async task=>{assert.ok(task.prompt.includes('原解析全文'));return wire(task);}});const task={...h.tasks[0],mode:'parse-organize',metadata:{sources:[{source_id:'s1',scope_id:'exam',document_role:'full',allowed_streams:['questions','answers','solutions'],total_pages:1,input_pages:[1],output_pages:[1],context_only_pages:[]}],assets:[]}};const result=await execute(task,s=>stages.push(s));assert.equal(result.parseResult.rawResponse.original,true);assert.equal(stages[0].stage,'parse');assert.equal(JSON.parse(result.text).solutions.length,1);});

test('discontinuous selected pages never become a continuous context window',()=>{const selected=[1,2,8,9].map(pageNo=>({pageNo}));const result=P.tasks(selected,{outputPages:5,contextPages:2});assert.deepEqual(result.map(t=>t.outputPages),[[1,2],[8,9]]);assert.ok(result.every(t=>t.contextPages.length===0));});

function twoStage(ports,config={}){
 const file={id:'s1',filename:'fixture.pdf',fileType:'pdf'},saved=[];
 const run=P.createProducer({contract:C,identityContract:I,getRoles:()=>['full'],renderPages:async()=>[{pageNo:1,url:image}],renderRegion:async()=>({url:image}),persistSourceEvidence:async(_f,e)=>saved.push(clone(e)),execute:Provider.createExecutor({contract:C,...ports})},{enabled:true,wireVersion:C.LEGACY_WIRE_VERSION,model:'mock',mode:'parse-organize',parserVersion:'parser-v1',maxCalls:2,maxYuan:0.5,maxQueryYuan:0,queryYuanPerCall:0,...config});
 return{file,saved,run:()=>run({batchId:'exam',sources:[file]})};
}
const parsed=task=>({parsedPages:task.metadata.sources[0].input_pages.map(page=>({source_id:'s1',page,text:'全文与完整解析'})),rawResponse:{untouched:'parser-original'}});

test('accepted async parse job resumes its receipt without uploading again or double reserving',async()=>{
 let uploads=0,queries=0,organizes=0;
 const h=twoStage({parse:async()=>{uploads++;return{state:'pending',jobId:'job-123',rawResponse:{receipt:'original'}};},resumeParse:async task=>{queries++;assert.equal(task.parseReceipt.jobId,'job-123');return parsed(task);},organize:async task=>{organizes++;return wire(task);}});
 await assert.rejects(h.run());assert.equal(h.file.pdfExternalEvidence.tasks[0].state,'parse_pending');
 const result=await h.run();assert.equal(result.drafts.length,1);assert.equal(uploads,1);assert.equal(queries,1);assert.equal(organizes,1);assert.equal(h.file.pdfExternalEvidence.tasks.length,1);assert.equal(h.file.pdfExternalEvidence.tasks[0].parseEvidence[0].result.rawResponse.receipt,'original');
});
test('known organizer rejection retains validated parser output for a new organizer request',async()=>{
 let parses=0,organizes=0;
 const h=twoStage({parse:async task=>{parses++;return parsed(task);},organize:async task=>{organizes++;if(organizes===1)throw Object.assign(Error('rate limited'),{status:429,submissionAccepted:false});return wire(task);}},{maxCalls:3,maxYuan:0.75});
 await assert.rejects(h.run());assert.equal(h.file.pdfExternalEvidence.tasks[0].state,'rejected');assert.equal(h.file.pdfExternalEvidence.tasks[0].parseValidated,true);
 assert.equal((await h.run()).drafts.length,1);assert.equal(parses,1);assert.equal(organizes,2);
});
test('organizer acceptance unknown blocks retransmission despite valid cached parser output',async()=>{
 let parses=0,organizes=0;
 const h=twoStage({parse:async task=>{parses++;return parsed(task);},organize:async()=>{organizes++;throw Error('connection lost');}});
 await assert.rejects(h.run());await assert.rejects(h.run());assert.equal(h.file.pdfExternalEvidence.tasks[0].state,'submission_unknown');assert.equal(parses,1);assert.equal(organizes,1);
});
test('returned incomplete parser output is invalid evidence rather than acceptance unknown',async()=>{
 let organizes=0;const h=twoStage({parse:async()=>({parsedPages:[],rawResponse:{missingPage:true}}),organize:async()=>{organizes++;}});
 await assert.rejects(h.run());assert.equal(h.file.pdfExternalEvidence.tasks[0].state,'invalid');assert.equal(h.file.pdfExternalEvidence.tasks[0].parseResult.rawResponse.missingPage,true);assert.equal(organizes,0);
});

test('valid-looking JSON from a refused or unsuccessful provider never becomes a cache success',async()=>{
 for(const terminal of [{refusal:'provider refusal'},{ok:false}]){
  const h=harness({execute:async task=>({...wire(task),...terminal})});await assert.rejects(h.run());assert.ok(h.file.pdfExternalEvidence.tasks.every(t=>t.state==='invalid'));assert.ok(h.file.pdfExternalEvidence.tasks.every(t=>t.rawResponse.fixture==='unchanged'));
 }
});
test('known refusal transport retains raw response and stays invalid rather than submission unknown',async()=>{
 const transport=require('../qisi-qwen-vision-source-port.js').createPdfWindowRecognizer({transport:{request:async()=>({ok:true,json:async()=>({id:'refusal-original',choices:[{finish_reason:'stop',message:{refusal:'refused'}}]})})}});
 const h=harness({execute:task=>transport({...task,prompt:'fixture'})});await assert.rejects(h.run());assert.ok(h.file.pdfExternalEvidence.tasks.every(t=>t.state==='invalid'&&t.rawResponse.id==='refusal-original'));
});

test('two-stage cost stays unknown when parser billing is absent, retaining the full reservation',async()=>{
 const h=twoStage({parse:async task=>parsed(task),organize:async task=>wire(task)},{priceTiers:[{maxInput:32000,inputYuanPerMillion:0.2,outputYuanPerMillion:0.8}]});
 await h.run();const record=h.file.pdfExternalEvidence.tasks[0];assert.equal(record.cost.modelCost.known,true);assert.equal(record.cost.known,false);assert.equal(record.cost.yuan,null);assert.equal(record.reservedYuan,0.5);
});

test('provider cannot replace trusted source page mapping through returned metadata',async()=>{
 const h=harness({execute:async task=>({...wire(task),metadata:{...task.metadata,sources:task.metadata.sources.map(s=>({...s,total_pages:99}))}})});
 await assert.rejects(h.run());assert.ok(h.file.pdfExternalEvidence.tasks.every(t=>t.state==='invalid'&&t.validationErrors.includes('provider-source-metadata-changed')));
});
