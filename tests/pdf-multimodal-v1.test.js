const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../qisi-pdf-multimodal-contract.js'),P=require('../qisi-pdf-multimodal-producer.js');
const I=require('../qisi-docx-producer-identity-contract.js'),F=require('../qisi-formal-admission-policy.js'),R=require('../qisi-review-controller.js');
const source={sourceId:'questions',format:'pdf',filename:'unfamiliar.pdf'};
const q=(n,stem='原题 $2^{n-\\frac12}$')=>({question_no:n,type:'single',stem,options:['A','B','C','D'].map(label=>({label,text:label+' 原选项'})),figures:[],source_pages:[1],status:'complete',warnings:[]});
const support=(n,answer='A')=>({question_no:n,answer,figures:[],source_pages:[1],status:'complete',warnings:[]});
const proposal=(field,item,src=source)=>({field,item,source:src,model:'qwen3-vl-plus',evidence:[{requestId:'w1',pages:[1],sourceId:src.sourceId}]});
const draft=group=>C.canonicalDraft(group,{batchId:'exam',now:1,identityContract:I});
test('fatal account errors preserve successful drafts and stop remaining windows and sources',async()=>{
 const calls=[];
 const run=P.createProducer({contract:C,identityContract:I,getRoles:f=>f.roles,renderPages:async()=>Array.from({length:10},(_,i)=>({pageNo:i+1,url:'data:image/png;base64,AA=='})),renderRegion:async()=>{throw Error('no figures')},recognizeWindow:async({pages})=>{
  calls.push(pages.map(p=>p.pageNo));if(calls.length===2)throw Object.assign(Error('Arrearage'),{status:400,code:'Arrearage',details:{type:'Arrearage'}});
  return {text:JSON.stringify({questions:[q('1')],answers:[],solutions:[]}),finishReason:'stop'};
 }});
 const out=await run({batchId:'exam',sources:[{id:'answer',filename:'answer.pdf',fileType:'pdf',roles:['answer']},{id:'questions',filename:'questions.pdf',fileType:'pdf',roles:['question']}]});
 assert.equal(out.drafts.length,1);assert.equal(out.drafts[0].source.sourceId,'questions');assert.equal(calls.length,2);assert.deepEqual(out.windowErrors[0].pages,[4,5,6,7,8,9,10]);assert.equal(out.windowErrors[0].details.type,'Arrearage');assert.equal(out.windowErrors[1].sourceId,'answer');
});
test('persisted successful response cache skips paid recognition',async()=>{
 let calls=0;
 const file={id:'questions',filename:'question.pdf',fileType:'pdf'};
 const run=P.createProducer({contract:C,identityContract:I,getRoles:()=>['question'],renderPages:async()=>[{pageNo:1,url:'data:image/png;base64,AA=='}],renderRegion:async()=>{throw Error('no figures')},recognizeWindow:async()=>{calls++;return {text:JSON.stringify({questions:[q('1')],answers:[],solutions:[]}),finishReason:'stop'}}});
 const first=await run({batchId:'exam',sources:[file]});file.pdfV1Evidence={protocol:C.PROTOCOL,windows:first.evidence};
 const repeat=await run({batchId:'exam',sources:[file]});assert.equal(calls,1);assert.equal(repeat.evidence[0].cached,true);assert.equal(repeat.drafts[0].stem,first.drafts[0].stem);
});
test('rerecognition reuses the successful window and recovers invalid cached windows while retaining raw evidence',async()=>{
 const wire=n=>JSON.stringify({questions:[{...q(String(n)),source_pages:[n]}],answers:[],solutions:[],warnings:[]});
 const wrongPage=JSON.parse(wire(2));wrongPage.questions[0].source_pages=[3];
 const wrongRole=JSON.parse(wire(2));wrongRole.answers=[{...support('2'),source_pages:[2]}];
 const cases=[
  {name:'JSON',text:'invalid JSON',finishReason:'stop'},
  {name:'schema',text:'{"questions":{},"answers":[],"solutions":[]}',finishReason:'stop'},
  {name:'page',text:JSON.stringify(wrongPage),finishReason:'stop'},
  {name:'role',text:JSON.stringify(wrongRole),finishReason:'stop'},
  {name:'truncated',text:wire(2),finishReason:'length'},
  {name:'empty',text:'',finishReason:'stop'}
 ];
 for(const bad of cases){
  let phase=1;const calls=[];const file={id:'cache-source',filename:'offline.pdf',fileType:'pdf'};
  const run=P.createProducer({contract:C,identityContract:I,getRoles:()=>['question'],renderPages:async()=>[1,2].map(pageNo=>({pageNo,url:'data:image/png;base64,'+pageNo})),renderRegion:async()=>{throw Error('no figures')},recognizeWindow:async({pages})=>{
   const page=pages[0].pageNo;calls.push({phase,page});return phase===1&&page===2?{...bad}:{text:wire(page),finishReason:'stop'};
  }},{window_size:1,overlap:0});
  const context={batchId:'cache-exam',sources:[file]};const first=await run(context);
  assert.deepEqual(first.drafts.map(d=>d.questionNumber),['1'],bad.name);assert.equal(first.windowErrors.length,1,bad.name);
  file.pdfV1Evidence={protocol:C.PROTOCOL,windows:first.evidence};phase=2;
  const savedEvidence=JSON.stringify(file.pdfV1Evidence);
  const recovered=await run(context);
  assert.equal(JSON.stringify(file.pdfV1Evidence),savedEvidence,bad.name+' original source evidence is immutable');
  assert.deepEqual(calls.filter(c=>c.phase===2),[{phase:2,page:2}],bad.name);
  assert.deepEqual(recovered.drafts.map(d=>d.questionNumber),['1','2'],bad.name);assert.equal(recovered.windowErrors.length,0,bad.name);
  assert.equal(recovered.evidence.some(e=>e.text===bad.text&&e.finishReason===bad.finishReason),true,bad.name+' raw retained');
  assert.equal(recovered.drafts.every(d=>d.manualConfirmed!==true),true,bad.name);
  file.pdfV1Evidence={protocol:C.PROTOCOL,windows:recovered.evidence};phase=3;
  const repeated=await run(context);assert.equal(calls.filter(c=>c.phase===3).length,0,bad.name+' recovered cache is usable');
  assert.deepEqual(repeated.drafts.map(d=>d.questionNumber),['1','2'],bad.name);
  assert.equal(repeated.evidence.some(e=>e.text===bad.text&&e.finishReason===bad.finishReason),true,bad.name+' raw survives another repeat');
  assert.equal(repeated.evidence.length,recovered.evidence.length,bad.name+' cache-only repeats do not grow history');
 }
});
test('final questions use exact exam+number, missing 8 never moves answer 9; answer-only needs no fictitious solution',()=>{
 const groups=C.groupProposals([proposal('question',q('7')),proposal('question',q('9')),proposal('answer',support('9'),{...source,sourceId:'answers'})],'exam');
 const out=groups.filter(g=>g.question.length).map(draft);assert.equal(out.length,2);assert.equal(out[0].answer,'');assert.equal(out[1].answer,'A');assert.equal(out[1].solution,'');
 assert.equal(C.questionKey('other','9')===C.questionKey('exam','9'),false);assert.equal(I.validateCanonicalIdentity(out[1]).valid,true);
 const decision=F.evaluateDraftAdmission(out[1],{mode:'vision-ai',actorId:'teacher',requestId:'x',idempotencyKey:'x',explicitConfirmation:true});assert.equal(decision.accepted,true,JSON.stringify(decision.errors));
});
test('overlap equals dedup; formula changes and partial versus complete conflict, never splice or pick longer',()=>{
 const a=q('10','AB=2'),b=q('10','AB = 2');const equal=C.groupProposals([proposal('question',a),proposal('question',b)],'exam');assert.equal(equal[0].question.length,1);
 const c=q('10','AB=2；后半题');c.status='partial';const conflict=draft(C.groupProposals([proposal('question',a),proposal('question',c)],'exam')[0]);assert.equal(conflict.stem,'AB=2');assert.equal(conflict.pdfV1.states.question,'conflict');assert.equal(conflict.fieldProvenance.stem.status,'rejected');
 assert.notEqual(C.compareText('2^{n-\\frac12}'),C.compareText('2^{\\frac{n-1}{2}}'));assert.notEqual(C.compareText('\\sin x'),C.compareText('\\sinx'));
});
test('strict JSON/pages/roles fail closed; invalid figure blocks only its image',()=>{
 const unit=q('1');unit.figures=[{page:1,bbox:[0,0,1001,30],belongs_to:'stem'}];
 const raw={questions:[unit],answers:[],solutions:[]};const parsed=C.parseResponse(JSON.stringify(raw),{pages:[1],roles:['question']});assert.equal(parsed.questions[0].figures[0].invalid,true);assert.equal(parsed.questions[0].status,'complete');
 assert.throws(()=>C.parseResponse('{"questions":',[1]));raw.answers=[support('1')];assert.throws(()=>C.parseResponse(JSON.stringify(raw),{pages:[1],roles:['question']}));
});
test('manual PDF editor preserves math and explicit option labels; missing B stays blocked',()=>{
 const controller=R.createReviewController({formalFields:I.FORMAL_FIELDS});
 const item=q('1');item.options=item.options.filter(o=>o.label!=='B');
 const d=draft(C.groupProposals([proposal('question',item),proposal('answer',support('1'))],'exam')[0]);
 assert.deepEqual(C.projectEditorSource(C.editorSource(d),d).optionLabels,['A','C','D']);
 const next=C.applyEditorSource(d,'人工题干 $2^{n-\\frac12}$\n\nA. $\\sin x$\nC. 原 C\nD. 原 D',controller);
 assert.equal(next.stem,'人工题干 $2^{n-\\frac12}$');assert.equal(next.options[0],'$\\sin x$');assert.deepEqual(next.pdfV1.optionLabels,['A','C','D']);assert.match(C.reviewProblem(next),/标签/);
 const mismatch=draft(C.groupProposals([proposal('question',q('10')),proposal('answer',support('10','BCD'))],'exam')[0]);assert.match(C.reviewProblem(mismatch),/题型/);
 const long={...d,type:'解答题',options:[],pdfV1:{...d.pdfV1,optionLabels:[]}};
 assert.equal(C.applyEditorSource(long,'几何点名\nA. $AB = 2$，原文保留',controller).stem,'几何点名\nA. $AB = 2$，原文保留');
});
test('final field selection is explicit manual action and invalidates confirmation; unchanged first candidate can be chosen',()=>{
 const controller=R.createReviewController({formalFields:I.FORMAL_FIELDS});const d=draft(C.groupProposals([proposal('question',q('1')),proposal('question',q('1','不同原文'))],'exam')[0]);d.status='reviewed';d.manualConfirmed=true;
 const next=C.chooseCandidate(d,'question',0,controller);assert.equal(next.stem,d.stem);assert.equal(next.fieldProvenance.stem.status,'manual');assert.equal(next.status,'pending');assert.equal(next.manualConfirmed,false);
 const supported=draft(C.groupProposals([proposal('question',q('1')),proposal('answer',support('1','A'),{...source,sourceId:'support-a'}),proposal('answer',support('1','B'),{...source,sourceId:'support-b'})],'exam')[0]);
 assert.deepEqual(supported.supportSources.map(s=>s.sourceId),['support-a','support-b']);
 const selected=C.chooseCandidate(supported,'answer',1,controller);assert.equal(selected.answer,'B');assert.equal(selected.fieldProvenance.answer.sourceId,'support-b');assert.equal(selected.fieldProvenance.answer.page,1);assert.equal(C.reviewProblem(selected),'');
});
test('configurable windows stop once the last page is reached; one failed window does not retry other pages',async()=>{
 assert.deepEqual(P.windows([1,2,3,4,5,6,7,8,9,10,11]),[[1,2,3,4,5],[4,5,6,7,8],[7,8,9,10,11]]);assert.throws(()=>P.windows([1],{window_size:5,overlap:5}));
 const requests=[];const run=P.createProducer({contract:C,identityContract:I,getRoles:()=>['question'],renderPages:async()=>[1,2,3,4,5,6].map(pageNo=>({pageNo,url:'data:image/png;base64,AA=='})),renderRegion:async()=>{throw Error('no figures')},recognizeWindow:async({pages})=>{requests.push(pages.map(p=>p.pageNo));if(pages[0].pageNo===4)throw Error('network');return {text:JSON.stringify({questions:[q('1')],answers:[],solutions:[]}),model:'qwen3-vl-plus',finishReason:'stop'}}});
 const out=await run({batchId:'exam',sources:[{id:'questions',filename:'unknown.pdf',fileType:'pdf'}]});assert.equal(out.drafts.length,1);assert.equal(out.windowErrors.length,1);assert.deepEqual(requests,[[1,2,3,4,5],[4,5,6],[4,5,6]]);
});
