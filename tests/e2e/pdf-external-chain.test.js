const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {startBrowserApp,installBrowserEngineInjection,createImportThroughUi,clearE2eData,callProxy,getDbSnapshot,assertNoRuntimeErrors}=require('./browser-harness.js');
const fixture=path.resolve(__dirname,'../fixtures/true-import/pdf-question.pdf');
function nativeResponse({body},options={}){
 const text=body.messages.find(m=>m.role==='user').content.find(c=>c.type==='text').text;
 const metadata=JSON.parse(text.match(/request_metadata:\r?\n([\s\S]*?)\r?\n\r?\nresult_schema:/)[1]),s=metadata.sources[0],page=s.output_pages[0];
 const item={source_id:s.source_id,scope_id:s.scope_id,question_no:'1',number_text:'1.',number_page:page,source_pages:[page],status:'observed_complete',figures:[],issues:[]};
 const question={...item,type:'single_choice',stem:'Original math $x^2=1$; select the supplied option.',options:['A','B','C','D'].map(label=>({label,text:label+' original option'}))};
 if(options.image){question.options[0].text+=' [[figure:f1]]';question.figures=[{id:'f1',page,field:'option',option_label:'A',asset_id:null,bbox:[0.1,0.1,0.3,0.3]}];}
 return {value:{questions:[question],answers:[{...item,text:'A'}],solutions:[{...item,text:'Original proof step 1.\nOriginal final equation and conclusion.\nOriginal second method retained.'}],unassigned:options.tail?[{source_id:s.source_id,scope_id:s.scope_id,source_pages:[page],kind:'solution',text:'Unnumbered source tail retained for review.',figures:[],reason:'Missing visible parent number'}]:[],pages:s.input_pages.map(p=>({source_id:s.source_id,page:p,state:s.context_only_pages.includes(p)?'context_only':'content',issues:[]})),warnings:[]}};
}

test('V2 normal UI keeps unassigned source text, exact original crops, edits, confirmation and formal readback', {timeout:120000},async()=>{
 const h=await startBrowserApp(32171);
 try{
  await clearE2eData(h.page);
  const engine=await installBrowserEngineInjection(h.page,{defaultResponse:request=>nativeResponse(request,{image:true,tail:true})});
  const imported=await createImportThroughUi(h.page,{files:[{file:fixture,roles:['full']}]});
  let q=imported.snapshot.drafts.find(q=>q.batchId===imported.batchId);
  assert.ok(q,'V2 draft should exist');assert.equal(q.producer.routeId,'pdf-external-v2');assert.equal(q.pdfV1,undefined);assert.equal(q.images.length,1);assert.equal(q.images[0].position,'option:A');assert.ok(q.options[0].includes('[[IMAGE:'+q.images[0].id+']]'));assert.ok(q.pdfExternal.taskProblems.length);assert.equal(q.manualConfirmed,false);
  assert.ok(imported.snapshot.files.find(f=>f.batchId===imported.batchId).pdfExternalEvidence.unassigned[0].text.includes('Unnumbered'));
  await callProxy(h.page,'openBatchReview',imported.batchId);
  await callProxy(h.page,'markDraftReviewed');q=(await getDbSnapshot(h.page)).drafts.find(x=>x.id===q.id);assert.equal(q.manualConfirmed,false,'task issues block confirmation');
  await callProxy(h.page,'acknowledgePdfTaskIssues');await callProxy(h.page,'confirmDraftImages');
  await callProxy(h.page,'markDraftReviewed');
  await callProxy(h.page,'openSourcePageCrop',q.pdfExternal.sourcePageImages[0]);
  const cropImage=h.page.locator('.batch-crop-stage img');await cropImage.waitFor({state:'visible'});
  await h.page.locator('label:has-text("裁图归属") select').selectOption('option:B');
  const box=await cropImage.boundingBox();assert.ok(box.width>100&&box.height>100);
  await h.page.mouse.move(box.x+box.width*0.1,box.y+box.height*0.1);await h.page.mouse.down();await h.page.mouse.move(box.x+box.width*0.3,box.y+box.height*0.3,{steps:5});await h.page.mouse.up();
  await callProxy(h.page,'saveManualCropToDraft');q=(await getDbSnapshot(h.page)).drafts.find(x=>x.id===q.id);
  assert.equal(q.manualConfirmed,false);assert.equal(q.images.length,2);const manualImage=q.images.find(i=>i.source==='manual-crop');assert.equal(manualImage.position,'option:B');assert.ok(q.options[1].includes('[[IMAGE:'+manualImage.id+']]'));assert.ok(manualImage.url.startsWith('data:image/'));assert.ok(Math.abs(manualImage.bbox[0]-100)<5&&Math.abs(manualImage.bbox[2]-300)<5);
  await callProxy(h.page,'confirmDraftImages');
  await callProxy(h.page,'updateDraftQuestionField','solution','Teacher correction preserves all required proof steps.');
  await callProxy(h.page,'markDraftReviewed');q=(await getDbSnapshot(h.page)).drafts.find(x=>x.id===q.id);
  assert.equal(q.manualConfirmed,true);assert.equal(q.fieldProvenance.solution.status,'manual');assert.equal(q.fieldProvenance.stem.status,'controlled-write');assert.ok(q.pdfExternal.candidates.solution[0].item.text.includes('second method retained'));
  await callProxy(h.page,'updateDraftQuestionField','answer','B');q=(await getDbSnapshot(h.page)).drafts.find(x=>x.id===q.id);assert.equal(q.manualConfirmed,false,'actual edit invalidates confirmation');
  const requestCount=engine.calls.length;await callProxy(h.page,'runBatchRecognition',imported.batchId);await callProxy(h.page,'openBatchReview',imported.batchId);
  q=(await getDbSnapshot(h.page)).drafts.find(x=>x.id===q.id);assert.equal(q.answer,'B');assert.equal(q.solution,'Teacher correction preserves all required proof steps.');assert.equal(q.images.length,2);assert.equal(q.manualConfirmed,false);assert.equal(engine.calls.length,requestCount,'rerun uses response cache');
  await callProxy(h.page,'acknowledgePdfTaskIssues');
  await callProxy(h.page,'markDraftReviewed');q=(await getDbSnapshot(h.page)).drafts.find(x=>x.id===q.id);assert.equal(q.manualConfirmed,true);
  assert.equal(await callProxy(h.page,'submitDraftQuestion',q.id,true),true);
  const dbSnapshot=await h.page.evaluate(async()=>{const db=new window.Dexie('QisiMathVueDB');await db.open();try{const rows=await db.table('questions').toArray(),images=await db.table('images').toArray();return{questions:rows,images:await Promise.all(images.map(async image=>({id:image.id,blobBytes:image.blob instanceof Blob?image.blob.size:0,url:image.url||null})))}}finally{db.close()}});
  assert.equal(dbSnapshot.questions.length,1);assert.equal(dbSnapshot.questions[0].answer,'B');assert.equal(dbSnapshot.questions[0].provenance.solution.status,'manual');assert.equal(dbSnapshot.images.length,2);assert.ok(dbSnapshot.images.every(i=>i.blobBytes>0||i.url?.startsWith('data:image/')));
  await h.page.reload();const reopened=await getDbSnapshot(h.page);assert.equal(reopened.questions.length,1);assert.equal(reopened.questions[0].answer,'B');assert.equal(reopened.drafts.find(x=>x.id===q.id).status,'submitted');
  assert.equal(engine.realApiCalled,false);assert.equal(h.forbiddenRequests.length,0);assertNoRuntimeErrors(h);
 }finally{await h.close();}
});

test('V2 unconfigured UI fails before any external recognition request', {timeout:90000},async()=>{
 const h=await startBrowserApp(32172);
 try{await clearE2eData(h.page);const engine=await installBrowserEngineInjection(h.page,{externalDisabled:true,defaultResponse:nativeResponse});const imported=await createImportThroughUi(h.page,{files:[{file:fixture,roles:['full']}]});assert.equal(imported.snapshot.drafts.filter(q=>q.batchId===imported.batchId).length,0);assert.equal(engine.calls.filter(c=>!c.endpoint.endsWith('/health')).length,0);assert.equal(imported.snapshot.questions.length,0);assert.deepEqual(h.pageErrors,[]);for(const message of h.consoleErrors)assert.match(message,/normal-ui-import-controller.*IMPORT_RECOGNITION_FAILED/);}finally{await h.close();}
});

test('v2.2 normal UI persists independent model review while human adoption remains required', {timeout:120000},async()=>{
 const h=await startBrowserApp(32174);
 try{
  await clearE2eData(h.page);const engine=await installBrowserEngineInjection(h.page,{});
  await h.page.evaluate(()=>{
   window.modelLedCalls={recognize:0,review:0};
   Object.assign(window.Qisi.Config.pdfExternal,{wireVersion:'pdf-external-v2.2',reviewModel:'mock-review',profileVersion:'model-led-v22',bindings:{
    recognize:async task=>{
     window.modelLedCalls.recognize++;const s=task.metadata.sources[0],page=s.output_pages[0];
     const item={source_id:s.source_id,scope_id:s.scope_id,question_no:'1',number_text:'1.',number_page:page,source_pages:[page],status:'observed_complete',figures:[],issues:[]};
     const entry=(stream,extra)=>({...item,...extra,item_id:stream+'-1',occurrence_id:'source-'+stream+'-1',evidence:[{source_id:s.source_id,page,field:stream==='question'?'stem':stream,option_label:null,quote:'1.',block_id:null}]});
     return{text:JSON.stringify({wire_version:'pdf-external-v2.2',requests:[],questions:[entry('question',{type:'free_response',stem:'Original source $x+1=2$.',options:[]})],answers:[entry('answer',{text:'$x=1$'})],solutions:[entry('solution',{text:'Original full proof and original conclusion.'})],unassigned:[],pages:s.input_pages.map(page=>({source_id:s.source_id,page,state:'content',issues:[]})),warnings:[]}),ok:true,finishReason:'stop',usage:{prompt_tokens:10,completion_tokens:20},rawResponse:{originalCandidate:true}};
    },
    review:async task=>{
     window.modelLedCalls.review++;
     return{text:JSON.stringify({review_version:'pdf-external-review-v1',candidate_hash:task.candidateHash,pages:task.candidate.pages.map(p=>({source_id:p.source_id,page:p.page,state:'checked',issues:[]})),items:['questions','answers','solutions'].flatMap(s=>task.candidate[s]).map(i=>({item_id:i.item_id,verdict:'pass',issues:[],evidence:[{source_id:i.source_id,page:i.number_page,quote:'source'}]})),unrepresented:[],requests:[],summary:'mock source check'}),ok:true,finishReason:'stop',rawResponse:{originalReview:true}};
    }
   }});
  });
  const imported=await createImportThroughUi(h.page,{files:[{file:fixture,roles:['full']}]});
  let q=imported.snapshot.drafts.find(q=>q.batchId===imported.batchId);assert.ok(q);
  assert.equal(q.pdfExternal.wireVersion,'pdf-external-v2.2');assert.equal(q.pdfExternal.reviewStates.modelReview,'pass');assert.equal(q.manualConfirmed,false);assert.equal(q.fieldProvenance.solution.controlledWriteAccepted,false);
  await callProxy(h.page,'openBatchReview',imported.batchId);await callProxy(h.page,'markDraftReviewed');
  q=(await getDbSnapshot(h.page)).drafts.find(x=>x.id===q.id);assert.equal(q.manualConfirmed,false,'model pass cannot bypass human field adoption');
  const reviewPanel=h.page.getByTestId('pdf-model-review');await reviewPanel.waitFor({state:'visible'});
  assert.match(await reviewPanel.innerText(),/来源原页|原模型候选复核通过/);
  const adoptQuestion=reviewPanel.getByRole('button',{name:'已核对原页，采用此题目候选'});
  await h.page.locator('.batch-latex-source-editor').fill('Unsaved teacher buffer');assert.equal(await adoptQuestion.isDisabled(),true);
  await callProxy(h.page,'discardActiveDraftEditorChanges');
  for(const [field,label]of [['stem','题目'],['answer','答案'],['solution','解析']]){
   await reviewPanel.getByRole('button',{name:'已核对原页，采用此'+label+'候选'}).click();
   await h.page.waitForFunction(field=>{const proxy=window.Qisi.Runtime.getRuntimeDependency('AppProxy');return proxy.activeDraftQuestion.fieldProvenance[field].status==='manual'&&!proxy.activeDraftEditorDirty;},field);
  }
  q=(await getDbSnapshot(h.page)).drafts.find(x=>x.id===q.id);assert.equal(q.fieldProvenance.solution.status,'manual');assert.equal(q.manualConfirmed,false);assert.equal((await getDbSnapshot(h.page)).questions.length,0);
  await callProxy(h.page,'markDraftReviewed');q=(await getDbSnapshot(h.page)).drafts.find(x=>x.id===q.id);assert.equal(q.manualConfirmed,true,JSON.stringify({problems:await callProxy(h.page,'draftQuestionProblems',q),validation:await h.page.evaluate(q=>window.Qisi.ProductionReviewValidator.createProductionReviewValidator({policy:window.Qisi.FormalAdmissionPolicy}).validate(q),q),toast:await h.page.evaluate(()=>window.Qisi.Runtime.getRuntimeDependency('AppProxy').batchToast)}));
  assert.match(await reviewPanel.innerText(),/已人工确认/);
  if(process.env.QISI_REVIEW_SCREENSHOT){await reviewPanel.evaluate(element=>{element.querySelector('.pdf-model-review-candidates').scrollTop=0;});await reviewPanel.screenshot({path:process.env.QISI_REVIEW_SCREENSHOT});}
  await callProxy(h.page,'runBatchRecognition',imported.batchId);
  assert.deepEqual(await h.page.evaluate(()=>window.modelLedCalls),{recognize:1,review:1});
  await h.page.reload();const reopened=await getDbSnapshot(h.page),saved=reopened.files.find(f=>f.batchId===imported.batchId).pdfExternalEvidence.tasks[0];
  assert.deepEqual(saved.attempts.map(a=>a.operation),['direct','review']);assert.equal(saved.modelReview.rawResponse.originalReview,true);assert.equal(reopened.questions.length,0);assert.equal(engine.realApiCalled,false);assert.equal(h.forbiddenRequests.length,0);assertNoRuntimeErrors(h);
 }finally{await h.close();}
});

test('two actual browser pages cannot rerun one import while its cross-window lock is held', {timeout:120000},async()=>{
 const h=await startBrowserApp(32175);let second;
 try{
  await clearE2eData(h.page);const engine=await installBrowserEngineInjection(h.page,{defaultResponse:nativeResponse});
  const imported=await createImportThroughUi(h.page,{files:[{file:fixture,roles:['full']}]});
  second=await h.context.newPage();await second.goto(h.origin+'/main.html',{waitUntil:'domcontentloaded'});
  await second.evaluate(batchId=>{window.lockEntered=false;window.heldImportLock=navigator.locks.request('qisi-normal-import:'+batchId,{mode:'exclusive'},async()=>{window.lockEntered=true;await new Promise(resolve=>{window.releaseImportLock=resolve;});});},imported.batchId);
  await second.waitForFunction(()=>window.lockEntered===true);
  const before=engine.calls.length;await assert.rejects(callProxy(h.page,'runBatchRecognition',imported.batchId),/IMPORT_RUNNING_IN_ANOTHER_WINDOW/);assert.equal(engine.calls.length,before);
  assert.match(await h.page.locator('body').innerText(),/另一个窗口处理中/);
  await second.evaluate(async()=>{window.releaseImportLock();await window.heldImportLock;});
  await callProxy(h.page,'runBatchRecognition',imported.batchId);assert.equal(engine.calls.length,before,'completed source evidence is reloaded and reused under the lock');
  assert.equal(engine.realApiCalled,false);assert.equal(h.forbiddenRequests.length,0);assertNoRuntimeErrors(h);
 }finally{if(second)await second.close();await h.close();}
});

test('V2 normal UI runs generic parser-organizer bindings and resolves declared original-source assets', {timeout:120000},async()=>{
 const h=await startBrowserApp(32173);
 try{
  await clearE2eData(h.page);const engine=await installBrowserEngineInjection(h.page,{});
  await h.page.evaluate(()=>{
   let sourceAsset;window.externalMockCalls={parse:0,organize:0,resolve:0};
   Object.assign(window.Qisi.Config.pdfExternal,{mode:'parse-organize',parserVersion:'mock-parser-v1',bindings:{
    parse:async task=>{window.externalMockCalls.parse++;const s=task.metadata.sources[0];sourceAsset=task.pages[0].url;return{parsedPages:s.input_pages.map(page=>({source_id:s.source_id,page,text:'原解析全文：Question 1, answer A, full original proof.'})),assets:[{asset_id:'source-resource',source_id:s.source_id,page:s.input_pages[0]}],rawResponse:{originalParser:true}};},
    organize:async task=>{window.externalMockCalls.organize++;if(!task.prompt.includes('原解析全文'))throw Error('Parser text lost');const s=task.metadata.sources[0],page=s.output_pages[0],base={source_id:s.source_id,scope_id:s.scope_id,question_no:'1',number_text:'1.',number_page:page,source_pages:[page],status:'observed_complete',figures:[],issues:[]};return{finishReason:'stop',model:'mock-organizer',rawResponse:{originalOrganizer:true},text:JSON.stringify({questions:[{...base,type:'single_choice',stem:'Question with original-source image [[figure:resource1]]',options:['A','B','C','D'].map(label=>({label,text:label+' supplied option'})),figures:[{id:'resource1',page,field:'stem',option_label:null,asset_id:'source-resource',bbox:null}]}],answers:[{...base,text:'A'}],solutions:[{...base,text:'Full original proof retained from parser.'}],unassigned:[],pages:s.input_pages.map(page=>({source_id:s.source_id,page,state:s.context_only_pages.includes(page)?'context_only':'content',issues:[]})),warnings:[]})};},
    resolveAsset:async id=>{window.externalMockCalls.resolve++;if(id!=='source-resource')throw Error('Unknown asset');return{url:sourceAsset,bbox:[0,0,1000,1000]};}
   }});
  });
  const imported=await createImportThroughUi(h.page,{files:[{file:fixture,roles:['full']}]});const draft=imported.snapshot.drafts.find(q=>q.batchId===imported.batchId);assert.ok(draft);assert.equal(draft.producer.routeId,'pdf-external-v2');assert.equal(draft.images.length,1);assert.equal(draft.images[0].sourceFileId,draft.source.sourceId);assert.ok(draft.stem.includes('[[IMAGE:'+draft.images[0].id+']]'));assert.equal(draft.solution,'Full original proof retained from parser.');
  const record=imported.snapshot.files.find(f=>f.batchId===imported.batchId).pdfExternalEvidence.tasks[0];assert.equal(record.state,'validated');assert.equal(record.parseValidated,true);assert.equal(record.parseResult.rawResponse.originalParser,true);assert.equal(record.rawResponse.originalOrganizer,true);assert.equal(record.cost.known,false);assert.deepEqual(await h.page.evaluate(()=>window.externalMockCalls),{parse:1,organize:1,resolve:1});
  await h.page.reload();assert.equal((await getDbSnapshot(h.page)).drafts.find(q=>q.id===draft.id).images[0].url,draft.images[0].url);assert.equal(engine.calls.filter(c=>!c.endpoint.endsWith('/health')).length,0);assert.equal(h.forbiddenRequests.length,0);assertNoRuntimeErrors(h);
 }finally{await h.close();}
});

test('fixed Qwen staged UI preserves raw issues, actual crops and all three receipts across rerun and reload', {timeout:120000},async()=>{
 const h=await startBrowserApp(32176);
 try{
  await clearE2eData(h.page);const engine=await installBrowserEngineInjection(h.page,{});
  await h.page.evaluate(()=>{
   const model='qwen3.7-flash-2026-07-15';window.stagedCalls=[];
   Object.assign(window.Qisi.Config.pdfExternal,{mode:'parse-organize-text',wireVersion:'pdf-external-v2.2',model,reviewModel:model,profileVersion:'browser-staged-v1',bindings:{
    parseUsesRecognizer:true,organizeUsesRecognizer:true,reviewUsesRecognizer:true,
    recognize:async task=>{
     if(task.model!==model)throw Error('Selected model changed');
     const s=task.metadata.sources[0],page=s.input_pages[0];
     window.stagedCalls.push({mode:task.inputMode||'review',model:task.model});
     let value;
     if(task.inputMode==='page-transcription'){
      value={transcript_version:'pdf-page-evidence-v1',pages:s.input_pages.map(page=>({source_id:s.source_id,page,state:'content',blocks:[{kind:'text',text:'1. Original question $x+1=2$.\nAnswer $x=1$.\nFull original first proof step.\nFull original final proof step.\nLater proof says omitted.',bbox:null,issues:[]},{kind:'figure',text:'Original supplied diagram',bbox:[0.1,0.1,0.3,0.3],issues:[]}],issues:['源页符号需人工核对']})),warnings:[]};
     }else if(task.inputMode==='text'){
      if(task.pages||task.crops||task.responseFormat.type!=='json_schema')throw Error('Organizer received images or lost structured output');
      if(!task.parsedPages[0].text.includes('Full original final proof step'))throw Error('Raw proof lost');
      const base={source_id:s.source_id,scope_id:s.scope_id,question_no:'1',number_text:'1.',number_page:page,source_pages:[page],status:'observed_complete',figures:[],issues:[]};
      const entry=(stream,extra)=>({...base,...extra,item_id:stream+'-1',occurrence_id:'occ-'+stream,evidence:[{source_id:s.source_id,page,field:stream==='question'?'stem':stream,option_label:null,quote:'1.',block_id:task.metadata.blocks[0].block_id}]});
      value={wire_version:'pdf-external-v2.2',requests:[],questions:[entry('question',{type:'free_response',stem:'Original question $x+1=2$. [[figure:stem-image]]',options:[],figures:[{id:'stem-image',page,field:'stem',option_label:null,asset_id:task.metadata.assets[0].asset_id,bbox:null}]})],answers:[entry('answer',{text:'$x=1$'})],solutions:[entry('solution',{text:'Full original first proof step.\nFull original final proof step.\nLater proof says omitted.'})],unassigned:[],pages:s.input_pages.map(page=>({source_id:s.source_id,page,state:'content',issues:[]})),warnings:[]};
     }else{
      if(task.pages.length!==1||task.crops.length!==1||!task.crops[0].url.startsWith('data:image/')||task.crops[0].placement_id!=='stem-image')throw Error('Actual crop unavailable before review');
      value={review_version:'pdf-external-review-v1',candidate_hash:task.candidateHash,pages:task.candidate.pages.map(p=>({source_id:p.source_id,page:p.page,state:'checked',issues:[]})),items:['questions','answers','solutions'].flatMap(stream=>task.candidate[stream]).map(i=>({item_id:i.item_id,verdict:'pass',issues:[],evidence:[{source_id:i.source_id,page:i.number_page,quote:'original'}]})),unrepresented:[],requests:[],summary:'Mock original and actual crop checked'};
     }
     return{text:JSON.stringify(value),ok:true,finishReason:'stop',model,usage:{prompt_tokens:10,completion_tokens:20},rawResponse:{stage:task.inputMode||'review',value}};
    }
   }});
  });
  const imported=await createImportThroughUi(h.page,{files:[{file:fixture,roles:['full']}]});
  const q=imported.snapshot.drafts.find(q=>q.batchId===imported.batchId);assert.ok(q,JSON.stringify({batches:imported.snapshot.batches,files:imported.snapshot.files.map(file=>({errors:file.pdfExternalEvidence?.errors,tasks:file.pdfExternalEvidence?.tasks.map(task=>({state:task.state,error:task.error,validationErrors:task.validationErrors}))})),consoleErrors:h.consoleErrors}));assert.equal(q.manualConfirmed,false);assert.equal(q.images.length,1);assert.equal(q.pdfExternal.reviewStates.modelReview,'pass');assert.match(q.solution,/Full original final proof step/);assert.ok(q.pdfExternal.taskProblems.some(text=>text.includes('源页符号需人工核对')));
  await callProxy(h.page,'openBatchReview',imported.batchId);const panel=h.page.getByTestId('pdf-model-review');await panel.waitFor({state:'visible'});assert.match(await panel.innerText(),/原页转写标疑/);assert.match(await panel.innerText(),/源页符号需人工核对/);
  await callProxy(h.page,'markDraftReviewed');assert.equal((await getDbSnapshot(h.page)).drafts.find(row=>row.id===q.id).manualConfirmed,false);
  await callProxy(h.page,'runBatchRecognition',imported.batchId);assert.deepEqual((await h.page.evaluate(()=>window.stagedCalls)).map(row=>row.mode),['page-transcription','text','review']);
  await h.page.reload();const reopened=await getDbSnapshot(h.page),record=reopened.files.find(f=>f.batchId===imported.batchId).pdfExternalEvidence.tasks[0];
  assert.deepEqual(record.attempts.map(row=>row.operation),['parse','organize','review']);assert.ok(record.attempts.every(row=>row.model==='qwen3.7-flash-2026-07-15'&&row.cost.known));assert.equal(record.attempts[2].pageAppearances,2);assert.equal(record.parseResult.pageEvidence.response.rawResponse.stage,'page-transcription');assert.equal(record.modelReview.rawResponse.stage,'review');
  const restored=reopened.drafts.find(row=>row.id===q.id);assert.equal(restored.images[0].url,q.images[0].url);assert.equal(restored.manualConfirmed,false);assert.ok(restored.pdfExternal.taskProblems.some(text=>text.includes('源页符号需人工核对')));assert.equal(reopened.questions.length,0);assert.equal(engine.calls.filter(c=>!c.endpoint.endsWith('/health')).length,0);assert.equal(h.forbiddenRequests.length,0);assertNoRuntimeErrors(h);
 }finally{await h.close();}
});

for(const recovery of [false,true])test('simple fixed Qwen UI preserves evidence, crops and cache'+(recovery?' after receipt recovery':''), {timeout:120000},async()=>{
 const h=await startBrowserApp(32177);
 try{
  await clearE2eData(h.page);const engine=await installBrowserEngineInjection(h.page,{});
  await h.page.evaluate(recovery=>{
   const model='qwen3.7-flash-2026-07-15';window.simpleCalls=[];window.simpleFail=recovery;
   Object.assign(window.Qisi.Config.pdfExternal,{mode:'parse-organize-text',strictTextSchema:true,wireVersion:'pdf-external-v2.2',model,reviewModel:model,profileVersion:'qwen37-simple-model-led-v1',bindings:{parseUsesRecognizer:true,organizeUsesRecognizer:true,reviewUsesRecognizer:true,recognize:async task=>{
    const s=task.metadata.sources[0],page=s.input_pages[0];window.simpleCalls.push(task.inputMode||'review');let value;
    if(task.inputMode==='page-raw')return{text:'```json\n{"table_data":{"cells":[2,3]}}\n```\n1. Original $x+1=2$.\nFull first proof. Full final proof. Later proof says omitted.',finishReason:'stop',model,usage:{prompt_tokens:10,completion_tokens:20},rawResponse:{raw:true}};
    if(task.inputMode==='page-regions')value={location_version:'pdf-page-regions-v1',source_id:s.source_id,page,state:'content',regions:[{kind:'figure',bbox:[0.1,0.1,0.3,0.3],anchor:'Original supplied diagram',issues:[]},{kind:'table',bbox:[0.1,0.1,0.3,0.3],anchor:'Unplaced original table',issues:['源表格需要核对']}],issues:[]};
    else if(task.inputMode==='text'){
     if(task.pages||task.crops||!task.parsedPages[0].text.includes('table_data'))throw Error('Opaque evidence lost or images leaked');
     const base={source_id:s.source_id,scope_id:s.scope_id,question_no:'1',number_text:'1.',number_page:page,source_pages:[page],status:'observed_complete',figures:[],issues:[]};
     const entry=(stream,extra)=>({...base,...extra,item_id:stream+'-1',occurrence_id:'occ-'+stream,evidence:[{source_id:s.source_id,page,field:stream==='question'?'stem':stream,option_label:null,quote:'1.',block_id:task.metadata.blocks[0].block_id}]});
     value={wire_version:'pdf-external-v2.2',requests:[],questions:[entry('question',{type:'free_response',stem:'Original $x+1=2$. [[figure:stem-image]]',options:[],figures:[{id:'stem-image',page,field:'stem',option_label:null,asset_id:task.metadata.assets[0].asset_id,bbox:null}]})],answers:[entry('answer',{text:'$x=1$'})],solutions:[entry('solution',{text:'Full first proof. Full final proof. Later proof says omitted.'})],unassigned:[],pages:s.input_pages.map(page=>({source_id:s.source_id,page,state:'content',issues:[]})),warnings:[]};
    }else{
     if(task.pages.length!==1||task.crops.length!==2||task.crops[1].placements.length||task.crops.some(c=>!c.url.startsWith('data:image/')))throw Error('All actual resources missing from review');
     value={review_version:'pdf-external-review-v1',candidate_hash:task.candidateHash,pages:task.candidate.pages.map(p=>({source_id:p.source_id,page:p.page,state:'checked',issues:[]})),items:['questions','answers','solutions'].flatMap(stream=>task.candidate[stream]).map(i=>({item_id:i.item_id,verdict:'pass',issues:[],evidence:[{source_id:i.source_id,page:i.number_page,quote:'original'}]})),unrepresented:[],requests:[],summary:'Mock all actual regions reviewed'};
    }
    if(recovery&&task.inputMode==='page-regions')delete value.regions[0].issues;
    return{text:JSON.stringify(value),finishReason:window.simpleFail&&task.inputMode==='page-regions'?'length':'stop',model,usage:{prompt_tokens:10,completion_tokens:20},rawResponse:{stage:task.inputMode||'review',original:value}};
   }}});
  },recovery);
  const imported=await createImportThroughUi(h.page,{files:[{file:fixture,roles:['full']}]});
  let prior;
  if(recovery){
   assert.equal(imported.snapshot.drafts.length,0);prior=imported.snapshot.files[0].pdfExternalEvidence.tasks[0];assert.equal(prior.attempts.length,2);
   await h.page.evaluate(()=>{window.simpleFail=false;Object.assign(window.Qisi.Config.pdfExternal,{strictTextSchema:false,maxCalls:5});});
   await callProxy(h.page,'runBatchRecognition',imported.batchId);imported.snapshot=await getDbSnapshot(h.page);
   assert.deepEqual(imported.snapshot.files[0].pdfExternalEvidence.tasks[0],prior);
   assert.equal(imported.snapshot.files[0].pdfExternalEvidence.tasks[1].reusedAttempts[0].requestId,prior.attempts[0].requestId);
   for(const message of h.consoleErrors)assert.match(message,/normal-ui-import-controller.*IMPORT_RECOGNITION_FAILED/);h.consoleErrors.length=0;
  }
  const q=imported.snapshot.drafts.find(q=>q.batchId===imported.batchId);assert.ok(q,JSON.stringify(imported.snapshot.files.map(f=>f.pdfExternalEvidence?.errors)));assert.equal(q.manualConfirmed,false);assert.equal(q.images.length,1);assert.equal(q.pdfExternal.reviewStates.modelReview,'pass');assert.ok(q.pdfExternal.taskProblems.some(t=>t.includes('源表格需要核对')));
  await callProxy(h.page,'openBatchReview',imported.batchId);const panel=h.page.getByTestId('pdf-model-review');await panel.waitFor({state:'visible'});assert.match(await panel.innerText(),/源表格需要核对/);
  if(recovery)assert.match(await panel.innerText(),/未报告/);
  await callProxy(h.page,'markDraftReviewed');assert.equal((await getDbSnapshot(h.page)).drafts.find(d=>d.id===q.id).manualConfirmed,false);
  await callProxy(h.page,'runBatchRecognition',imported.batchId);assert.deepEqual(await h.page.evaluate(()=>window.simpleCalls),recovery?['page-raw','page-regions','page-regions','text','review']:['page-raw','page-regions','text','review']);
  await h.page.reload();const reopened=await getDbSnapshot(h.page),record=reopened.files.find(f=>f.batchId===imported.batchId).pdfExternalEvidence.tasks.at(-1);
  assert.deepEqual(record.attempts.map(a=>a.operation),recovery?['locate','organize','review']:['transcribe','locate','organize','review']);assert.equal(record.parseResult.protocol,'pdf-page-evidence-v2');assert.match(record.parseResult.rawPages[0].raw_text,/table_data/);assert.equal(record.resolvedAssets.length,2);assert.equal(record.attempts.at(-1).pageAppearances,3);assert.ok(record.attempts.every(a=>a.cost.known));assert.equal(reopened.questions.length,0);assert.equal(reopened.drafts.find(d=>d.id===q.id).images[0].url,q.images[0].url);
  if(recovery){assert.equal(record.reusedAttempts[0].requestId,prior.attempts[0].requestId);assert.ok(reopened.drafts.find(d=>d.id===q.id).pdfExternal.taskProblems.some(t=>t.includes('未报告')));}
  assert.equal(engine.calls.filter(c=>!c.endpoint.endsWith('/health')).length,0);assert.equal(h.forbiddenRequests.length,0);assertNoRuntimeErrors(h);
 }finally{await h.close();}
});

test('existing PDF renderer crops model coordinates consistently through scaling and page rotation', {timeout:120000},async()=>{
 const h=await startBrowserApp(32178);
 try{
  const results=await h.page.evaluate(async()=>{
   const pdf=(rotation)=>{
    const stream='1 0 0 rg\n24 40 24 24 re f\n',objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 80] /Rotate ${rotation} /Resources << >> /Contents 4 0 R >>`,`<< /Length ${stream.length} >>\nstream\n${stream}endstream`];
    let text='%PDF-1.4\n',offsets=[0];objects.forEach((body,i)=>{offsets.push(text.length);text+=`${i+1} 0 obj\n${body}\nendobj\n`;});const xref=text.length;text+='xref\n0 5\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return{filename:'synthetic-rectangle.pdf',uploadPath:'data:application/pdf;base64,'+btoa(text)};
   };
   const renderer=window.Qisi.BrowserPdfRenderer.createBrowserPdfRenderer({dataUrlToBlob:async url=>new Blob([Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0))],{type:'application/pdf'}),getBatchFileRoles:()=>['full'],logBatchPdfDiag:()=>{},batchHasQuestionRole:()=>true,estimateVisionCalls:()=>0,recordRenderedPages:()=>{},showBatchToast:()=>{},getRecognitionMode:()=> 'mock'});
   const output=[];
   for(const rotation of [0,90])for(const scale of [2,3]){
    const region={protocol:'pdf-page-evidence-v2',coordinate_space:'normalized-page-0-1',source_id:'synthetic',page:1,bbox:rotation?[0.5,0.2,0.8,0.4]:[0.2,0.2,0.4,0.5]};
    const crop=await renderer.renderPdfRegion(pdf(rotation),{pageNo:1,bbox:window.Qisi.PdfPageEvidence.cropBox(region,'synthetic',1),scale});
    const image=new Image();image.src=crop.url;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);output.push({rotation,scale,width:crop.width,height:crop.height,pixel:Array.from(ctx.getImageData(Math.floor(image.width/2),Math.floor(image.height/2),1,1).data)});
   }
   return output;
  });
  for(const row of results){assert.equal(row.width,24*row.scale);assert.equal(row.height,24*row.scale);assert.deepEqual(row.pixel,[255,0,0,255]);}
  assert.equal(h.forbiddenRequests.length,0);assertNoRuntimeErrors(h);
 }finally{await h.close();}
});
