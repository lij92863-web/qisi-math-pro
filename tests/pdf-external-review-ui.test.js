const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../qisi-pdf-external-contract.js');
const Controller=require('../qisi-normal-ui-import-controller.js');
const fixture=require('./fixtures/pdf-external-v2-evaluation.json');
const I=require('../qisi-docx-producer-identity-contract.js');
const R=require('../qisi-review-controller.js');
const clone=v=>JSON.parse(JSON.stringify(v));
function draft(){
 const value=clone(fixture.result);value.unassigned=[];value.wire_version=C.WIRE_VERSION;value.requests=[];
 for(const stream of ['questions','answers','solutions'])for(const item of value[stream]){item.item_id=stream+'-1';item.occurrence_id=stream+'-source';item.evidence=[{source_id:'s1',page:item.number_page,field:stream==='questions'?'stem':stream==='answers'?'answer':'solution',option_label:null,quote:'1.',block_id:null}];}
 const q=C.buildDrafts([{result:value,metadata:fixture.metadata,source:{sourceId:'s1',format:'pdf',filename:'source.pdf',sourceOrder:0},requestId:'r1',model:'qwen3.7-flash-2026-07-15',images:[],cropErrors:[],modelReview:{state:'fail',result:{items:[{item_id:'solutions-1',verdict:'fail',issues:[{code:'omission',field:'solution',detail:'缺少第二种解法',source_pages:[2]}],evidence:[{source_id:'s1',page:2,quote:'解法二'}]}],pages:[],unrepresented:[{source_id:'s1',page:3,quote:'无号尾段',reason:'未表达'}],requests:[{source_id:'s1',pages:[3],item_ids:['solutions-1'],reason:'需要续页'}],summary:'请核对长证明'}}}],{batchId:'exam1',identityContract:I}).drafts[0];
 q.pdfExternal.sourcePageImages=[{sourceFileId:'s1',sourceFileName:'source.pdf',pageNo:2,url:'data:image/png;base64,aA=='}];return q;
}
test('review view keeps complete candidates and explicit source issues without mutating evidence',()=>{
 const q=draft(),before=JSON.stringify(q),panel=C.reviewPanel(q);
 assert.equal(panel.fields[2].candidates[0].text,q.pdfExternal.candidates.solution[0].item.text);
 assert.equal(panel.fields[2].candidates[0].issues[0].detail,'缺少第二种解法');
 assert.equal(panel.fields[0].candidates[0].issues.length,0,'no issue guessed from another item');
 assert.equal(panel.findings[0].sourceFileId,'s1');assert.equal(panel.findings[0].sourcePage,3);
 assert.equal(panel.sources[0].pageNo,2);assert.equal(JSON.stringify(q),before);
});
test('model verdict and human confirmation remain separate even after display fields change',()=>{
 const q=draft();assert.ok(q.pdfExternal.reviewNotice);assert.equal(q.warnings.includes(q.pdfExternal.reviewNotice),false,'instructional notice cannot become a permanent unresolved source warning');q.solution='teacher modified source';q.pdfExternal.candidates.solution[0].modelReview.state='pass';
 let panel=C.reviewPanel(q);assert.equal(panel.humanLabel,'待人工核对');assert.notEqual(panel.fields[2].candidates[0].text,q.solution);
 q.manualConfirmed=true;q.status='reviewed';assert.equal(C.reviewPanel(q).humanLabel,'已人工确认');
 q.status='submitted';assert.equal(C.reviewPanel(q).fields[0].candidates[0].canAdopt,false);
});
test('legacy and DOCX drafts do not acquire new model-review UI by inference',()=>{
 const q=draft();delete q.pdfExternal.wireVersion;assert.equal(C.reviewPanel(q),null);assert.equal(C.reviewPanel({producer:{routeId:'docx-deterministic'}}),null);
});
test('adopting a response without options preserves missing provenance for the absent optional field',()=>{
 const q=C.chooseCandidate(draft(),'question',0,R.createReviewController({formalFields:I.FORMAL_FIELDS}));
 assert.deepEqual(q.options,[]);assert.equal(q.fieldProvenance.options.kind,'missing');assert.equal(q.fieldProvenance.stem.status,'manual');
});
test('cross-window lock covers load, bridge persistence and final readback before allowing a new run',async()=>{
 let busy=false,loads=0,bridges=0,release,entered;
 const hold=new Promise(resolve=>{release=resolve;}),ready=new Promise(resolve=>{entered=resolve;});
 const locks={async request(_name,options,callback){assert.equal(options.ifAvailable,true);if(busy)return callback(null);busy=true;try{return await callback({name:_name});}finally{busy=false;}}};
 const result={mode:'production',state:{state:'WAITING_CONFIRMATION'},readback:{batch:{id:'b'},questions:[]}};
 const ports={lockManager:locks,loadBatch:async()=>{loads++;return{id:'b'};},bridge:{run:async()=>{bridges++;return result;}},applyReviewModel:async()=>{entered();await hold;}};
 const first=Controller.createNormalUiImportController(ports),second=Controller.createNormalUiImportController(ports);
 const pending=first.run('b');await ready;let blockedCode;
 const competing=second.run('b').catch(error=>{blockedCode=error.code;});
 try{await new Promise(resolve=>setImmediate(resolve));assert.equal(blockedCode,'IMPORT_RUNNING_IN_ANOTHER_WINDOW');assert.equal(loads,1);assert.equal(bridges,1);}
 finally{release();await pending;await competing;}
 await second.run('b');assert.equal(loads,2);assert.equal(bridges,2);assert.equal(busy,false);
});
