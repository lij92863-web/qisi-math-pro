const test=require('node:test');
const assert=require('node:assert/strict');
const api=require('../qisi-video-workspace');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {repairCropOcrEcho} = require('../qisi-crop-ocr-text');
const {splitQuestionForStorage, tokenizeLatexSource} = require('../qisi-utils');
test('crop source restores explicit labels from paragraph/list markup and only merges matching option lines',()=>{
 const raw='html\n<p>$$$A . k_{n}=3^n$$$</p><ol start="2"><li>$$$B . k_n=3^{n+1}$$$</li><li>C. $x&lt;3$</li></ol>';
 const cleaned=api.normalizeCropOcr(raw);
 assert.equal(cleaned,'A. $k_{n}=3^n$\nB. $k_n=3^{n+1}$\nC. $x<3$');
 assert.equal(api.mergeCropStem('题干\nA. 1\nB. 2\nD. 4',cleaned).text,'题干\n'+cleaned+'\nD. 4');
 assert.equal(api.mergeCropStem('题干\nA. 1\nB. 2','B. $2$').changes.length,0);
 assert.ok(api.mergeCropStem('A. 1\nB. 2\n另一行','B. 3').error);
 assert.ok(api.mergeCropStem('A. 1\nA. 2','A. 3').error);
 assert.ok(api.mergeCropStem('A. 1','A. 2\nA. 3').error);
 assert.equal(api.withoutDuplicateOcrTail('题干\nA. 3\nB. 2\nhtml\n<ol><li>A. 3</li><li>B. $2$</li></ol>'),'题干\nA. 3\nB. 2');
 assert.equal(api.withoutDuplicateOcrTail('A. 3\nhtml\n<ol><li>A. 4</li></ol>'),null);
});
test('crop OCR collapses a repeated stem prefix and identical choices without changing the interval endpoints', () => {
 const raw = readFileSync(join(__dirname, 'fixtures/crop-ocr-echo.txt'), 'utf8');
 const clean = api.normalizeCropOcr(raw);
 const stem = String.raw`2. [2025 江西九江检测]已知椭圆 $\frac{x^2}{a^2} + \frac{y^2}{b^2} = 1 (a > b > 0)$ 的右焦点为 F(c, 0)，上顶点为 A(0, b)，直线 x = $\frac{a^2}{c}$ 上存在一点 P 满足 (FP + FA) · AP = 0，则椭圆离心率的取值范围为`;
 const options = [
  String.raw`$[\frac{1}{2}, 1)$`,
  String.raw`$[\frac{\sqrt{2}}{2}, 1)$`,
  String.raw`$[\frac{\sqrt{5}-1}{2}, 1)$`,
  String.raw`$(0, \frac{\sqrt{2}}{2}]$`
 ];
 assert.equal(clean, [stem, ...options.map((value, i) => 'ABCD'[i] + '. ' + value)].join('\n'));
 assert.deepEqual(splitQuestionForStorage(clean, '解答题'), {stem, options, type: '单选题'});
 assert.deepEqual(tokenizeLatexSource(clean).issues, []);
 assert.equal(repairCropOcrEcho(raw), clean);
 assert.equal(repairCropOcrEcho(clean), null);
 assert.equal(api.normalizeCropOcr(clean), clean);
});

test('crop OCR preserves conflicting choices, distinct questions, and standalone display math', () => {
 const options = 'A. 1\nB. 2\nC. 3\nD. 4';
 const stem = '2. [例题]已知函数满足下列条件，请选出该函数的最小值';
 const separateQuestion = [stem, options, '3. [例题]请选择函数的最大值', options].join('\n');
 const conflictingChoices = [stem, options, options.replace('B. 2', 'B. 5')].join('\n');
 const extraContent = [stem, options, options, '答案见下方'].join('\n');
 for (const text of [separateQuestion, conflictingChoices, extraContent]) {
  assert.equal(api.normalizeCropOcr(text), text);
  assert.equal(repairCropOcrEcho(text), null);
 }
 const display = '计算下式\n' + String.raw`$$\frac{1}{2}+\frac{1}{3}$$`;
 assert.equal(api.normalizeCropOcr(display), display);
 const coordinates = '顶点为 A(0,b)，坐标是？';
 const lineChoices = coordinates + '\nA. A(0,b) B. A(1,b) C. B(0,a) D. B(1,a)';
 assert.deepEqual(splitQuestionForStorage(lineChoices, '单选题'), {
  stem: coordinates, options: ['A(0,b)', 'A(1,b)', 'B(0,a)', 'B(1,a)'], type: '单选题'
 });
});
test('question labels avoid both printed ink and adjacent frames on a crowded paper',()=>{
 const raster={width:500,height:500,data:new Uint8ClampedArray(500*500*4).fill(255)};
 const frames=[{box:[.1,.10,.9,.29]}, {box:[.1,.3,.9,.44]}, {box:[.02,.6,.9,.8]}];
 for(let y=275;y<300;y++)for(let x=0;x<65;x++) raster.data[(y*500+x)*4]=0;
 const labels=api.layoutQuestionLabels(frames,raster,500,500);
 assert.ok(parseFloat(labels[0].labelStyle.top)<10);
 assert.ok(parseFloat(labels[1].labelStyle.left)<10 && parseFloat(labels[1].labelStyle.top)>=29);
 assert.equal(labels[2].labelStyle.left,'-50px');
});
test('crop coordinates preserve scale, clamp edges and reject invalid rectangles',()=>{
 assert.deepEqual(api.normalizeRect({x:100,y:200,width:200,height:100},1000,1000),[.1,.2,.3,.3]);
 assert.deepEqual(api.normalizeRect({x:900,y:950,width:300,height:200},1000,1000),[.9,.95,1,1]);
 assert.equal(api.normalizeRect({x:0,y:0,width:NaN,height:1},10,10),null);
 assert.equal(api.normalizeRect({x:0,y:0,width:0,height:1},10,10),null);
});
test('video filters never mutate drafts or equate reviewed with submitted',()=>{
 const q={stem:'',status:'reviewed',warnings:['疑似重复']},before=JSON.stringify(q);
 assert.equal(api.matchesFilter(q,'submitted'),false);assert.equal(api.matchesFilter(q,'reviewed'),true);
 assert.equal(api.matchesFilter(q,'empty'),true);assert.equal(api.matchesFilter(q,'duplicate'),true);
 assert.equal(JSON.stringify(q),before);assert.equal(api.append('原题\n','漏掉的小问'),'原题\n漏掉的小问');
});


test('source anchors keep individual blocks scoped to the original page and hash',()=>{
 const q={id:'q',batchId:'b',questionNumber:'2',pdfReview:{protocol:'pdf-mineru-v1',rawSources:[{sourceId:'f',sha256:'hash'}],candidates:{question:[{source:{sourceId:'f'},evidence:[{blockId:'f/a'},{blockId:'f/b'},{blockId:'f/c'}]}]}}};
 const file={id:'f',batchId:'b',pdfMineruEvidence:{protocol:'pdf-mineru-v1',tasks:[{sourceId:'f',sha256:'hash',blocks:[{id:'f/a',page:2,bbox:[100,200,800,300]},{id:'f/b',page:2,bbox:[150,300,850,400]},{id:'f/c',page:3,bbox:[100,20,800,100]},{id:'foreign',page:2,bbox:[0,0,1000,1000]}]}]}};
 const before=JSON.stringify([q,file]);
 assert.deepEqual(api.sourceMarks([q],[file],{number:2,sourceFileId:'f'}),[
  {questionId:'q',label:'题 2',top:.2,regions:[[.1,.2,.8,.3],[.15,.3,.85,.4]]}
 ]);
 assert.deepEqual(api.sourceMarks([q],[file],{number:1,sourceFileId:'f'}),[]);
 assert.deepEqual(api.sourceMarks([q],[{...file,batchId:'other'}],{number:2,sourceFileId:'f'}),[]);
 assert.deepEqual(api.sourceMarks([q],[{...file,pdfMineruEvidence:{...file.pdfMineruEvidence,tasks:[{...file.pdfMineruEvidence.tasks[0],sha256:'wrong'}]}}],{number:2,sourceFileId:'f'}),[]);
 assert.equal(JSON.stringify([q,file]),before);
});

test('a page click selects only an unambiguous evidence block',()=>{
 const marks=[
  {questionId:'q1',regions:[[.1,.1,.9,.25],[.1,.4,.9,.5]]},
  {questionId:'q2',regions:[[.5,.45,.9,.65]]}
 ];
 assert.equal(api.questionAtPoint(marks,.5,.2),'q1');
 assert.equal(api.questionAtPoint(marks,.5,.6),'q2');
 assert.equal(api.questionAtPoint(marks,.5,.3),null,'blank gap is not part of a question');
 assert.equal(api.questionAtPoint(marks,.7,.47),null,'overlapping evidence cannot choose a question');
});
