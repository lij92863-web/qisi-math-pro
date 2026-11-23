const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../qisi-pdf-external-contract.js'),I=require('../qisi-docx-producer-identity-contract.js');
const R=require('../qisi-review-controller.js');
const f=require('./fixtures/pdf-external-v2-evaluation.json');
const clone=v=>JSON.parse(JSON.stringify(v));
const observation=result=>({result,metadata:f.metadata,source:{sourceId:'s1',format:'pdf',filename:'one.pdf',mimeType:'application/pdf',sourceOrder:0},model:'mock',requestId:'r1',images:[],cropErrors:[]});
const build=result=>C.buildDrafts([observation(result)],{batchId:'exam1',identityContract:I,taskProblems:[]});

test('V2 drafts have independent explicit identity and keep full source proof',()=>{
 const built=build(clone(f.result)),q=built.drafts[0];assert.equal(q.producer.routeId,'pdf-external-v2');assert.equal(q.pdfV1,undefined);assert.equal(q.pdfExternal.protocol,'pdf-external-v2');assert.equal(q.manualConfirmed,false);assert.equal(I.validateCanonicalIdentity(q).valid,true);assert.equal(q.solution,f.result.solutions[0].text);assert.equal(q.fieldProvenance.solution.controlledWriteAccepted,true);
});
// Identity is the printed number, anchored on the first item: a mid-document
// gap is local information loss and must stay local (ai/ALIGNMENT_ANCHORED_KEY_JOIN_2026-10-17.md).
test('a mid-document gap keeps later support fields instead of rejecting them wholesale',()=>{
 const r=clone(f.result),base=r.questions[0],a=r.answers[0],s=r.solutions[0];r.questions=['1','2','3'].map(n=>({...clone(base),question_no:n}));r.answers=['1','3'].map(n=>({...clone(a),question_no:n}));r.solutions=['1','2','3'].map(n=>({...clone(s),question_no:n}));
 const built=build(r);assert.equal(built.sequenceGate.mode,'full');assert.equal(built.drafts[2].fieldProvenance.answer.controlledWriteAccepted,true);assert.equal(built.drafts[1].fieldProvenance.solution.controlledWriteAccepted,true);
});
// The anchor is what separates a shifted document from a gapped one; without it
// the two are observationally identical, so it must keep failing closed.
test('a globally shifted support document is rejected whole, never attached by exact number',()=>{
 const r=clone(f.result),base=r.questions[0],a=r.answers[0],s=r.solutions[0];r.questions=['1','2','3'].map(n=>({...clone(base),question_no:n}));r.answers=['2','3'].map(n=>({...clone(a),question_no:n}));r.solutions=['2','3'].map(n=>({...clone(s),question_no:n}));
 const built=build(r);assert.equal(built.sequenceGate.mode,'fail-closed');assert.deepEqual(built.sequenceGate.safeQuestionNumbers,[]);assert.equal(built.sequenceGate.anchors.answers.observedFirst,'2');assert.equal(built.drafts[1].fieldProvenance.answer.status,'rejected');
});
test('V2 task issues remain blocking until explicit source-scope review',()=>{
 const q=C.buildDrafts([observation(clone(f.result))],{batchId:'exam1',identityContract:I,taskProblems:['unassigned tail']}).drafts[0];
 assert.match(C.reviewProblem(q),/来源|原页/);const reviewed=C.acknowledgeTaskIssues(q);assert.equal(reviewed.pdfExternal.taskIssuesAcknowledged,true);assert.equal(reviewed.manualConfirmed,false);assert.deepEqual(reviewed.fieldProvenance.questionNumber,q.fieldProvenance.questionNumber);assert.equal(q.pdfExternal.taskIssuesAcknowledged,false);
});
test('V2 edits invalidate prior confirmation and preserve raw machine candidate',()=>{
 const q=build(clone(f.result)).drafts[0];q.manualConfirmed=true;q.status='reviewed';q.confirmedAt=123;const before=clone(q.pdfExternal.candidates);const controller=R.createReviewController({formalFields:I.FORMAL_FIELDS});const changed=controller.editField(q,'solution','teacher corrected');assert.equal(changed.manualConfirmed,false);assert.equal(changed.confirmedAt,null);assert.deepEqual(changed.pdfExternal.candidates,before);assert.equal(changed.fieldProvenance.solution.status,'manual');
});
test('known-bad question duplicates stop before candidate grouping',()=>{
 const r=clone(f.result);r.questions.push(clone(r.questions[0]));assert.throws(()=>build(r),/PDF_EXTERNAL_CONTRACT_INVALID/);
});

test('manual option crop and candidate selection invalidate confirmation without altering raw candidates',()=>{
 const result=clone(f.result);result.questions[0].type='single_choice';result.questions[0].options=['A','B','C','D'].map(label=>({label,text:label+' source option'}));
 const q=build(result).drafts[0];q.manualConfirmed=true;q.status='reviewed';q.confirmedAt=123;
 const raw=clone(q.pdfExternal.candidates),controller=R.createReviewController({formalFields:I.FORMAL_FIELDS});
 const image={id:'manual-figure',url:'data:image/png;base64,aA==',sourceFileId:'s1',sourcePage:1,bbox:[10,20,300,400],status:'bound'};
 const cropped=C.applyManualCrop(q,image,'option:A',controller);
 assert.equal(cropped.manualConfirmed,false);assert.equal(cropped.imageReviewStatus,'need_confirm');assert.ok(cropped.options[0].includes('[[IMAGE:manual-figure]]'));assert.equal(cropped.fieldProvenance.options.status,'manual');assert.deepEqual(cropped.pdfExternal.candidates,raw);
 const selected=C.chooseCandidate(cropped,'question',0,controller);assert.equal(selected.manualConfirmed,false);assert.equal(selected.options[0].includes('manual-figure'),false);assert.deepEqual(selected.pdfExternal.candidates,raw);
});

test('rerun retains teacher fields, selectable machine candidates, omitted edits and submitted drafts',()=>{
 const prior=build(clone(f.result)).drafts[0],controller=R.createReviewController({formalFields:I.FORMAL_FIELDS});
 const edited=controller.editField(prior,'solution','Teacher proof');edited.manualConfirmed=true;edited.status='reviewed';
 const fresh=build(clone(f.result)).drafts[0];fresh.pdfExternal.candidates.solution[0].item.text='New machine proof';
 const kept=C.retainReviewDrafts([fresh],[edited])[0];assert.equal(kept.solution,'Teacher proof');assert.equal(kept.manualConfirmed,false);assert.equal(kept.pdfExternal.candidates.solution.length,2);assert.equal(edited.pdfExternal.candidates.solution.length,1);
 const omitted=C.retainReviewDrafts([],[edited])[0];assert.equal(omitted.solution,'Teacher proof');assert.equal(omitted.manualConfirmed,false);assert.ok(omitted.pdfExternal.taskProblems.some(s=>s.includes('未返回')));
 const submitted={...edited,status:'submitted'};assert.deepEqual(C.retainReviewDrafts([fresh],[submitted])[0],submitted);
});

test('typed math outside delimiters is a blocking problem naming the field',()=>{
 const draft={stem:'已知 x^2=1，求 x。',options:[],answer:'',solution:''};
 const problems=C.mathProblems(draft,()=>{});
 assert.equal(problems.length,1);assert.match(problems[0].message,/题干/);assert.match(problems[0].message,/x\^2/);
});
test('typeset math and ordinary prose are never reported as typed math',()=>{
 const draft={stem:'第 2 题（1）选 A. 3 万元，且 $x^2=1$。',options:['A. 3 万元','B. $\\sqrt{2}$'],answer:'$\\frac{1}{2}$',solution:'由 $AB=3$ 得证。'};
 assert.deepEqual(C.mathProblems(draft,()=>{}),[]);
});
