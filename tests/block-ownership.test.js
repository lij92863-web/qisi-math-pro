const test=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const BO=require('../qisi-block-ownership');
const sha1=text=>createHash('sha1').update(text,'utf8').digest('hex');

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
  {id:'heading',type:'text',text:'参考答案'},
  {id:'a1',type:'text',text:'1【答案】D'},
  {id:'p2b3',type:'text',text:'解析：由题意得 $z=\\mathrm{i}$。'},
  {id:'a2',type:'text',text:'2【答案】A'}
 ]}
];
for (const page of pages) for (const block of page.blocks) block.origin={sourceId:'fixture',blockId:block.id};
const index=()=>BO.blockIndex(pages.flatMap(page=>page.blocks));
const answerTable={1:'D',2:'A'};
const q1=()=>({question_no:'1',type:'single_choice',stem:['p1b1','p1b2'],options:{A:['p1b4'],B:['p1b5'],C:['p1b6'],D:['p1b7']},answer:['a1'],solution:['p2b3'],figures:['p1b3'],issues:[]});
const result=questions=>({protocol:BO.PROTOCOL,questions,unassigned:[]});
// 以下三块为 parse-quality 提供的 content_list.json 原值，sha1 指纹锁定，防止转义/空白走样。
const real21=String.raw`A. $P$ 、 $Q$ 、 $M$ 、 $N$ 四点共面 B.线段 $BC_{1}$ 为直三棱柱 $ABC - A_{1}B_{1}C_{1}$ 外接球的直径C. 三棱锥 $P - A_{1}QN$ 的体积为 $\frac{2}{3}$ D. 直线 $MN$ 与 $AC$ 所成角余弦值为 $\frac{\sqrt{3}}{3}$`;
const real4=[String.raw`2. “ $\varphi = -\frac{\pi}{4} + k\pi (k \in \mathbf{Z})$ ”是“函数 $y = \tan (x + \varphi)$ 的图象关于 $\left(\frac{\pi}{4}, 0\right)$ 对称”的（）`,'A. 充分不必要条件','B. 必要不充分条件','C. 充要条件','D. 既不充分也不必要条件'].join('\n');
const real26=['第n行',String.raw`A. 第2026行共有2026个数`,String.raw`B. 从第4行起到第19行，每一行的第4个数字之和为 $C_{20}^{4}-1$ C. 第48行的所有数字之和被7除的余数为1`,String.raw`D. 去除所有为1的项，依次构成数列2,3,3,4,6,4,5,10,10,5,…，则此数列前135项的和为 $2^{18}-52$`].join('\n');

test('buildOwnershipPayload 只给占位图/表，正文原文下发且不丢 LaTeX',()=>{
 const payload=BO.buildOwnershipPayload({pages,answerTable,questionNumbers:['1','2']}, {maxTextChars:4000});
 assert.deepEqual(payload.exam,{pages:2,question_numbers:['1','2']});
 assert.deepEqual(payload.answer_table,answerTable);
 assert.equal(payload.blocks.length,15);
 const image=payload.blocks.find(b=>b.id==='p1b3');
 assert.deepEqual(image,{id:'p1b3',p:1,kind:'image',alt:'图'});
 assert.deepEqual(payload.blocks.find(b=>b.id==='p1b8'),{id:'p1b8',p:1,kind:'table',text:pages[0].blocks[8].text});
 assert.deepEqual(payload.blocks.find(b=>b.id==='p2b2'),{id:'p2b2',p:2,kind:'chart',alt:'图'});
 assert.deepEqual(payload.blocks.find(b=>b.id==='p1b2'),{id:'p1b2',p:1,kind:'equation',text:'$$z(1+\\mathrm{i})=2\\mathrm{i}$$'});
 assert.deepEqual(payload.blocks.find(b=>b.id==='p1b0'),{id:'p1b0',p:1,kind:'text',text:'广东深圳 2026 届高三数学试卷'});
});

test('正文预算不足必须重新规划，不生成丢失中间题号的输入',()=>{
 const text='头'.repeat(100)+'2【答案】B'+'尾'.repeat(100);
 const input={pages:[{page:1,blocks:[{id:'long',type:'text',text}]}]};
 assert.throws(()=>BO.buildOwnershipPayload(input,{maxTextChars:40}),/TEXT_BUDGET/);
 assert.equal(BO.buildOwnershipPayload(input).blocks[0].text,text);
});

test('块 id 缺失或重复时 fail fast，不静默覆盖',()=>{
 assert.throws(()=>BO.buildOwnershipPayload({pages:[{page:1,blocks:[{type:'text',text:'无 id'}]}]}),/BLOCK_OWNERSHIP_BLOCK_ID_REQUIRED/);
 assert.throws(()=>BO.buildOwnershipPayload({pages:[{page:1,blocks:[{id:'p1b0',type:'text',text:'a'}]},{page:2,blocks:[{id:'p1b0',type:'text',text:'b'}]}]}),/BLOCK_OWNERSHIP_DUPLICATE_BLOCK_ID:p1b0/);
});

test('合法归属结果通过校验并原样返回',()=>{
 const value=result([q1()]);
 const outcome=BO.validateOwnership(value,{blocksById:index(),questionNumbers:['1']});
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
 assert.equal(BO.validateOwnership(result([{...q1(),answer:['a1']}]),{blocksById:index(),questionNumbers:['1']}).valid,true);
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
 assert.equal(draft.images[0].path,'images/fig1.jpg');
 assert.equal(draft.images[0].sourceId,'fixture');
 assert.deepEqual(draft.issues,[]);
});

test('图片块转 [[IMAGE:<文件名>]]，表块取 HTML',()=>{
 const draft=BO.assembleQuestion({...q1(),stem:['p1b1','p1b3','p1b8']},index(),{answerTable});
 assert.equal(draft.stem.includes('[[IMAGE:'+encodeURIComponent(JSON.stringify(['fixture','images/fig1.jpg']))+']]'),true);
 assert.equal(draft.stem.includes('<table><tr><td>1</td><td>D</td></tr></table>'),true);
 assert.equal(draft.images[0].path,'images/fig1.jpg');
 assert.equal(draft.images[0].sourceId,'fixture');
});

test('答案表与原文冲突时两份证据保留、支持绑定为空',()=>{
 const draft=BO.assembleQuestion(q1(),index(),{answerTable:{1:'A'}});
 assert.equal(draft.answer,''); assert.equal(draft.solution,'');
 assert.equal(draft.answerEvidence.state,'conflicting');
 assert.deepEqual(draft.answerEvidence.evidence.map(x=>x.value),['A','D']);
 assert.equal(BO.assembleQuestion(q1(),index(),{answerTable}).answer,'D');
});

test('缺号/重号只报告不补号',()=>{
 const questions=[q1(),{...q1(),question_no:'3'},{...q1(),question_no:'3'}];
 const outcome=BO.assembleExam(result(questions),index(),{answerTable,questionNumbers:['1','2','3'],reportUnreferenced:false});
 assert.deepEqual(outcome.drafts.map(draft=>draft.questionNo),['1','3','3']);
 assert.equal(outcome.issues.includes('missing-question-no:2'),true);
 assert.equal(outcome.issues.includes('duplicate-question-no:3'),true);
 assert.equal(outcome.issues.includes('missing-question-no:3'),false);
 assert.equal(outcome.valid,false);
 assert.ok(outcome.drafts.every(d=>!d.answer&&!d.solution));
});

test('未归属块如实上报，不塞进任何题',()=>{
 const outcome=BO.assembleExam(result([q1()]),index(),{answerTable,questionNumbers:['1'],reportUnreferenced:false});
 assert.deepEqual(outcome.unassigned,[]);
 const withUnassigned=BO.assembleExam({protocol:BO.PROTOCOL,questions:[q1()],unassigned:[{blocks:['p1b0'],reason:'无法判断归属'}]},index(),{answerTable,questionNumbers:['1'],reportUnreferenced:false});
 assert.deepEqual(withUnassigned.unassigned,[{blocks:['p1b0'],reason:'无法判断归属'}]);
 assert.equal(withUnassigned.drafts.length,1);
});

test('一个A选项不能复制成四项，保留原始块供核查',()=>{
 const draft=BO.assembleQuestion({...q1(),options:{A:['p1b4'],B:['p1b4'],C:['p1b4'],D:['p1b4']}},index(),{answerTable});
 assert.ok(draft.issues.some(x=>x.includes('options-unresolved:p1b4')));
 assert.ok(draft.options.every(x=>x.text===''));
 assert.equal(draft.answer,'');assert.equal(draft.solution,'');
});

test('选项文本落在stem时复用同一原文片段投影',()=>{
 const blocks=BO.blockIndex([{id:'x1',type:'text',text:'1. 题干'},{id:'x2',type:'text',text:'A. 甲\nB. 乙\nC. 丙\nD. 丁'}]);
 const draft=BO.assembleQuestion({question_no:'1',type:'single_choice',stem:['x1','x2'],answer:[],solution:[],figures:[],issues:[],options:{}},blocks,{});
 assert.equal(draft.stem,'1. 题干');assert.deepEqual(draft.options.map(x=>x.text),['A. 甲','B. 乙','C. 丙','D. 丁']);
});

test('真实选项块保留字节指纹，投影不同选项且原文可重建',()=>{
 assert.equal(real21.length,166);assert.equal(sha1(real21),'f286cf6522fd4311ab2fbfa25d0b568be51f969d');
 const block={id:'p2b21',type:'text',text:real21};
 const input={question_no:'10',type:'multiple_choice',stem:['q10'],options:{A:['p2b21'],B:['p2b21'],C:['p2b21'],D:['p2b21']},answer:[],solution:[],figures:[],issues:[]};
 const built=BO.assembleExam(result([input]),[{id:'q10',type:'text',text:'10. 原题干'},block],{questionNumbers:['10']});const draft=built.drafts[0];
 assert.equal(draft.stem,'10. 原题干');assert.equal(draft.valid,true);
 assert.equal(new Set(draft.options.map(x=>x.text)).size,4);
 assert.equal(draft.options[1].text.startsWith('B.线段'),true);
 assert.equal(draft.options.map(x=>built.blocksById[x.blocks[0]].text).join(''),real21);
});

test('真实题干含选项的原文不丢失作答括号和公式',()=>{
 assert.equal(real4.length,177);assert.equal(sha1(real4),'daee2b2b60f98c258112572e065f8d8f7f9d6d5d');
 const block={id:'p1b4',type:'text',text:real4};
 const draft=BO.assembleQuestion({question_no:'2',type:'single_choice',stem:['p1b4'],options:{},answer:[],solution:[],figures:[],issues:[]},[block],{answerTable:{2:'B'}});
 assert.equal(draft.stem,real4.split('\n')[0]);assert.equal(draft.stem.endsWith('的（）'),true);
 assert.equal(draft.options.length,4);assert.equal(draft.options[3].text,'D. 既不充分也不必要条件');
 assert.equal(draft.answer,'B');
});

test('真实前导行标保留、同行B/C分开、所有片段拼回原文',()=>{
 assert.equal(real26.length,153);assert.equal(sha1(real26),'cc1aa2364c1b8762e37c08771e791179bc977e59');
 const block={id:'p3b26',type:'text',text:real26};
 const input={question_no:'11',type:'multiple_choice',stem:['q11','p3b26'],options:{A:['p3b26'],B:['p3b26'],C:['p3b26'],D:['p3b26']},answer:[],solution:[],figures:[],issues:[]};
 const built=BO.assembleExam(result([input]),[{id:'q11',type:'text',text:'11. 原题干'},block],{questionNumbers:['11']});const draft=built.drafts[0];
 assert.equal(draft.stem,'11. 原题干\n第n行');assert.equal(draft.options[2].text.startsWith('C. 第48行'),true);
 assert.equal(draft.valid,true);assert.equal(draft.answer,'');
 const fragments=Object.values(built.blocksById).filter(x=>x.origin?.blockId===block.id);
 assert.equal(fragments.length,5);
 assert.equal(fragments.sort((a,b)=>a.origin.range[0]-b.origin.range[0]).map(x=>x.text).join(''),real26);
});

test('缺块时保留诊断且答案表不能绕过来源准入',()=>{
 const draft=BO.assembleQuestion({...q1(),stem:['p9b9'],answer:['p9b9']},index(),{answerTable});
 assert.equal(draft.stem,'');assert.ok(draft.issues.some(x=>x.includes('stem:unknown-block:p9b9')));
 assert.ok(draft.issues.some(x=>x.includes('answer:unknown-block:p9b9')));
 assert.equal(draft.answer,'');assert.equal(draft.solution,'');
});
