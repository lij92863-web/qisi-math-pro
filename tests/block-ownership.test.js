const test=require('node:test'),assert=require('node:assert/strict');
const BO=require('../qisi-block-ownership');

const pages=[
 {page:1,blocks:[
  {id:'p1b0',type:'text',text:'广东深圳 2026 届高三数学试卷'},
  {id:'p1b1',type:'text',text:'1. 复数 $z$ 满足'},
  {id:'p1b2',type:'equation',text:'$$z(1+\\mathrm{i})=2\\mathrm{i}$$'},
  {id:'p1b3',type:'image',image:'images/fig1.jpg'},
  {id:'p1b4',type:'text',text:'A. $-1$'},
  {id:'p1b5',type:'text',text:'B. $1$'},
  {id:'p1b6',type:'text',text:'C. $-\\mathrm{i}$'},
  {id:'p1b7',type:'text',text:'D. $\\mathrm{i}$'},
  {id:'p1b8',type:'table',text:'<table><tr><td>1</td><td>D</td></tr></table>',image:'images/t1.jpg'}
 ]},
 {page:2,blocks:[
  {id:'p2b1',type:'text',text:'2. 已知集合 $A=\\{x\\mid x>1\\}$'},
  {id:'p2b2',type:'chart',image:'images/chart2.png'},
  {id:'p2b3',type:'text',text:'解析：由题意得 $z=\\mathrm{i}$。'}
 ]}
];
const index=()=>BO.blockIndex(pages.flatMap(page=>page.blocks));
const answerTable={1:'D',2:'A'};
const q1=()=>({question_no:'1',type:'single_choice',stem:['p1b1','p1b2'],options:{A:['p1b4'],B:['p1b5'],C:['p1b6'],D:['p1b7']},answer:['p1b7'],solution:['p2b3'],figures:['p1b3'],issues:[]});
const result=questions=>({protocol:BO.PROTOCOL,questions,unassigned:[]});

test('buildOwnershipPayload 只给占位图/表，正文原文下发且不丢 LaTeX',()=>{
 const payload=BO.buildOwnershipPayload({pages,answerTable,questionNumbers:['1','2']}, {maxTextChars:4000});
 assert.deepEqual(payload.exam,{pages:2,question_numbers:['1','2']});
 assert.deepEqual(payload.answer_table,answerTable);
 assert.equal(payload.blocks.length,12);
 const image=payload.blocks.find(b=>b.id==='p1b3');
 assert.deepEqual(image,{id:'p1b3',p:1,kind:'image',alt:'图'});
 assert.deepEqual(payload.blocks.find(b=>b.id==='p1b8'),{id:'p1b8',p:1,kind:'table',alt:'表格'});
 assert.deepEqual(payload.blocks.find(b=>b.id==='p2b2'),{id:'p2b2',p:2,kind:'chart',alt:'图'});
 assert.deepEqual(payload.blocks.find(b=>b.id==='p1b2'),{id:'p1b2',p:1,kind:'equation',text:'$$z(1+\\mathrm{i})=2\\mathrm{i}$$'});
 assert.deepEqual(payload.blocks.find(b=>b.id==='p1b0'),{id:'p1b0',p:1,kind:'text',text:'广东深圳 2026 届高三数学试卷'});
});

test('正文过长时保留首尾并标记 truncated，不静默丢内容',()=>{
 const long={page:1,blocks:[{id:'p1b0',type:'text',text:'头'.repeat(100)+'尾'.repeat(100)}]};
 const payload=BO.buildOwnershipPayload({pages:[long]},{maxTextChars:40});
 const block=payload.blocks[0];
 assert.equal(block.truncated,true);
 assert.equal(block.text.startsWith('头'),true);
 assert.equal(block.text.endsWith('尾'),true);
 assert.equal(block.text.includes('truncated'),true);
});

test('块 id 缺失或重复时 fail fast，不静默覆盖',()=>{
 assert.throws(()=>BO.buildOwnershipPayload({pages:[{page:1,blocks:[{type:'text',text:'无 id'}]}]}),/BLOCK_OWNERSHIP_BLOCK_ID_REQUIRED/);
 assert.throws(()=>BO.buildOwnershipPayload({pages:[{page:1,blocks:[{id:'p1b0',type:'text',text:'a'}]},{page:2,blocks:[{id:'p1b0',type:'text',text:'b'}]}]}),/BLOCK_OWNERSHIP_DUPLICATE_BLOCK_ID:p1b0/);
});

test('合法归属结果通过校验并原样返回',()=>{
 const value=result([q1()]);
 const outcome=BO.validateOwnership(value,{blocksById:index(),questionNumbers:['1','2']});
 assert.equal(outcome.valid,true);
 assert.deepEqual(outcome.errors,[]);
 assert.deepEqual(outcome.result,value);
});

test('不存在的块 id 判 invalid，不猜测修补',()=>{
 const value=result([{...q1(),stem:['p9b9']}]);
 const outcome=BO.validateOwnership(value,{blocksById:index(),questionNumbers:['1']});
 assert.equal(outcome.valid,false);
 assert.equal(outcome.result,null);
 assert.equal(outcome.errors.some(error=>error.includes('unknown-block:p9b9')),true);
});

test('同一字段内重复 id 判 invalid，跨字段引用同一块仍然合法',()=>{
 const duplicated=BO.validateOwnership(result([{...q1(),stem:['p1b1','p1b1']}]),{blocksById:index(),questionNumbers:['1']});
 assert.equal(duplicated.valid,false);
 assert.equal(duplicated.errors.some(error=>error.includes('duplicate-block:p1b1')),true);
 const duplicatedOption=BO.validateOwnership(result([{...q1(),options:{A:['p1b4','p1b4'],B:['p1b5'],C:['p1b6'],D:['p1b7']}}]),{blocksById:index(),questionNumbers:['1']});
 assert.equal(duplicatedOption.valid,false);
 assert.equal(duplicatedOption.errors.some(error=>error.includes('options.A:duplicate-block:p1b4')),true);
 assert.equal(BO.validateOwnership(result([{...q1(),answer:['p1b7']}]),{blocksById:index(),questionNumbers:['1']}).valid,true);
});

test('非数组字段、缺 protocol、版本不符、题号越界都判 invalid',()=>{
 const nonArray=BO.validateOwnership(result([{...q1(),stem:'p1b1'}]),{blocksById:index(),questionNumbers:['1']});
 assert.equal(nonArray.valid,false);
 assert.equal(nonArray.errors.includes('questions[0].stem:not-array'),true);
 const nonArrayOptions=BO.validateOwnership(result([{...q1(),options:['p1b4']}]),{blocksById:index(),questionNumbers:['1']});
 assert.equal(nonArrayOptions.valid,false);
 assert.equal(nonArrayOptions.errors.includes('questions[0].options:not-object'),true);
 const missing=BO.validateOwnership({questions:[q1()]},{blocksById:index(),questionNumbers:['1']});
 assert.equal(missing.valid,false);
 assert.equal(missing.errors.includes('missing-protocol'),true);
 const wrongVersion=BO.validateOwnership({protocol:'block-ownership-v2',questions:[q1()]},{blocksById:index(),questionNumbers:['1']});
 assert.equal(wrongVersion.valid,false);
 assert.equal(wrongVersion.errors.some(error=>error.startsWith('protocol-version:')),true);
 const outOfRange=BO.validateOwnership(result([q1()]),{blocksById:index(),questionNumbers:['2']});
 assert.equal(outOfRange.valid,false);
 assert.equal(outOfRange.errors.some(error=>error.includes('question-no-not-allowed:1')),true);
});

test('非对象输入不抛异常',()=>{
 for(const value of [null,undefined,'x',42,[]]){
  const outcome=BO.validateOwnership(value,{blocksById:index()});
  assert.equal(outcome.valid,false);
  assert.deepEqual(outcome.result,null);
  assert.equal(outcome.errors.length>0,true);
 }
});

test('一题（题干+4选项+答案+解析）按块原文拼装正确',()=>{
 const draft=BO.assembleQuestion(q1(),index(),{answerTable});
 assert.equal(draft.questionNo,'1');
 assert.equal(draft.type,'single_choice');
 assert.equal(draft.stem,'1. 复数 $z$ 满足\n$$z(1+\\mathrm{i})=2\\mathrm{i}$$');
 assert.deepEqual(draft.options.map(option=>option.label),['A','B','C','D']);
 assert.equal(draft.options[3].text,'D. $\\mathrm{i}$');
 assert.equal(draft.answer,'D');
 assert.equal(draft.solution,'解析：由题意得 $z=\\mathrm{i}$。');
 assert.deepEqual(draft.images,[{blockId:'p1b3',name:'fig1.jpg'}]);
 assert.deepEqual(draft.issues,[]);
});

test('图片块转 [[IMAGE:<文件名>]]，表块取 HTML',()=>{
 const draft=BO.assembleQuestion({...q1(),stem:['p1b1','p1b3','p1b8']},index(),{answerTable});
 assert.equal(draft.stem.includes('[[IMAGE:fig1.jpg]]'),true);
 assert.equal(draft.stem.includes('<table><tr><td>1</td><td>D</td></tr></table>'),true);
 assert.deepEqual(draft.images,[{blockId:'p1b3',name:'fig1.jpg'}]);
});

test('答案表与模型冲突时采用表并记录 answer-table-conflict',()=>{
 const draft=BO.assembleQuestion({...q1(),question_no:'2',answer:['p1b6']},index(),{answerTable});
 assert.equal(draft.answer,'A');
 assert.equal(draft.issues.includes('answer-table-conflict'),true);
 const agreed=BO.assembleQuestion(q1(),index(),{answerTable});
 assert.equal(agreed.answer,'D');
 assert.equal(agreed.issues.includes('answer-table-conflict'),false);
});

test('缺号/重号只报告不补号',()=>{
 const questions=[q1(),{...q1(),question_no:'3'},{...q1(),question_no:'3'}];
 const outcome=BO.assembleExam(result(questions),index(),{answerTable,questionNumbers:['1','2','3'],reportUnreferenced:false});
 assert.deepEqual(outcome.drafts.map(draft=>draft.questionNo),['1','3','3']);
 assert.equal(outcome.issues.includes('missing-question-no:2'),true);
 assert.equal(outcome.issues.includes('duplicate-question-no:3'),true);
 assert.equal(outcome.issues.includes('missing-question-no:3'),false);
});

test('未归属块如实上报，不塞进任何题',()=>{
 const outcome=BO.assembleExam(result([q1()]),index(),{answerTable,questionNumbers:['1'],reportUnreferenced:false});
 assert.deepEqual(outcome.unassigned,[]);
 const withUnassigned=BO.assembleExam({protocol:BO.PROTOCOL,questions:[q1()],unassigned:[{blocks:['p1b0'],reason:'无法判断归属'}]},index(),{answerTable,questionNumbers:['1'],reportUnreferenced:false});
 assert.deepEqual(withUnassigned.unassigned,[{blocks:['p1b0'],reason:'无法判断归属'}]);
 assert.equal(withUnassigned.drafts.length,1);
});

test('拼装阶段遇到不存在的块只记 issue，不抛异常也不替换',()=>{
 const draft=BO.assembleQuestion({...q1(),stem:['p9b9'],answer:['p9b9']},index(),{answerTable});
 assert.equal(draft.stem,'');
 assert.equal(draft.issues.includes('stem:unknown-block:p9b9'),true);
 assert.equal(draft.issues.includes('answer:unknown-block:p9b9'),true);
});
