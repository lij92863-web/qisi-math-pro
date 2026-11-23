const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Parts=require('../qisi-exam-paper-parts'),Gate=require('../qisi-handout-formula-gate'),Utils=require('../qisi-utils'),Images=require('../qisi-question-image-policy'),Groups=require('../qisi-exam-groups'),Config=require('../qisi-config'),katex=require('katex');
const cases=require('./fixtures/exam-paper-characterization.json');
const build=extra=>Parts.createDocumentBuilder({prepareSource:Gate.preparePrintSource,normalizeMath:Gate.normalizeForKatex,tokenize:Utils.tokenizeLatexSource,renderMath:katex.renderToString,
    displayImageUrl:Images.displayImageUrl,groupQuestions:Groups.groupQuestions,typeOrder:Config.EXAM_TYPE_ORDER,defaultGroupConfig:Config.DEFAULT_GROUP_CONFIG,typeLabels:Config.QUESTION_TYPE_LABELS,sectionNumbers:Config.CHINESE_SECTION_NUMBERS,...extra});
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
test('untrusted print image and missing-image HTML stays text through the actual formula and document pipeline',()=>{
    const payloads=[
        '<img class="print-image" src="data:image/png;base64,AA==" onerror="window.__audit_marker=1" alt="题图" />',
        '<span class="missing-image"><img src="data:image/png;base64,AA==" onerror="window.__audit_marker=1"></span>'
    ];
    for(const payload of payloads) for(const field of ['stem','answer','solution','option']){
        const paper=structuredClone(cases[0].paper);paper.mode='withAnswers';
        const q=paper.questions[0],source='$'+payload+' [[IMAGE:missing]]$';
        if(field==='option'){q.type='单选题';q.options=[source,'B'];}else q[field]=source;
        const html=build().buildPaper({paper}).documents[0].content;
        assert.ok(html.includes('&lt;img'),field);
        assert.doesNotMatch(html,/<img[^>]*onerror=/,field);
    }
});
test('source placeholder lookalikes cannot steal generated print images',()=>{
    for(const source of ['@@QISI_PRINT_IMAGE_0@@ [[IMAGE:real]]','@@QISI_PRINT_\nIMAGE_0@@ [[IMAGE:real]]']){
        const html=build({prepareSource:x=>x,tokenize:raw=>({issues:[],segments:[{type:'text',raw}]})}).render(source,[{id:'real',url:'data:image/png;base64,YQ=='}]);
        assert.ok(html.startsWith('@@QISI_PRINT_IMAGE_0@@ '));
        assert.equal((html.match(/<img /g)||[]).length,1);
        assert.ok(html.endsWith('alt="题图" />'));
    }
    // A policy-accepted URL for pure rendering only; this test makes no request.
    const data='https://example.invalid/@@QISI_PRINT_IMAGE_1@@';
    const nested=build({prepareSource:x=>x,tokenize:raw=>({issues:[],segments:[{type:'text',raw}]})}).render('[[IMAGE:first]] [[IMAGE:second]]',
        [{id:'first',url:data},{id:'second',url:'data:image/png;base64,YQ=='}]);
    assert.ok(nested.includes(`src="${data}"`));
    assert.equal((nested.match(/<img /g)||[]).length,2);
    const include=build({prepareSource:x=>x,tokenize:raw=>({issues:[],segments:[{type:'text',raw}]})}).render('\\includegraphics{first} [[IMAGE:second]]',
        [{id:'first',url:data},{id:'second',url:'data:image/png;base64,YQ=='}]);
    assert.ok(include.includes(`src="${data}"`));
    assert.equal((include.match(/<img /g)||[]).length,2);
});
for(const fixture of cases)test('complete document is byte-equivalent to pre-migration output: '+fixture.name,()=>{
    const input=structuredClone(fixture.paper),before=structuredClone(input),result=build().buildPaper({paper:freeze(input)});
    assert.deepEqual({questionsContent:result.questionsContent,answersContent:result.answersContent,documents:result.documents},fixture.expected);assert.deepEqual(input,before);
});
test('document renderer keeps explicit safe math options and returns original formula diagnostics',()=>{
    const warnings=[],calls=[],paper=structuredClone(cases[0].paper);paper.questions[0].stem='$\\notACommand{1}$';
    const result=build({warn:(...args)=>warnings.push(args),renderMath:(expression,options)=>{calls.push(options);return katex.renderToString(expression,options);}}).buildPaper({paper});
    assert.ok(result.diagnostics.some(item=>item.event==='[PRINT_LATEX][failed]'));assert.ok(warnings.some(args=>args[0]==='[PRINT_LATEX][failed]'));assert.match(result.questionsContent,/latex-render-error/);
    assert.ok(calls.every(options=>options.trust===false&&options.throwOnError===true&&options.strict==='ignore'));
});
test('document builder refuses unsupported output mode, changed question ID order and missing capability ports',()=>{
    const paper=structuredClone(cases[0].paper);assert.throws(()=>build().buildPaper({paper:{...paper,mode:'unknown'}}),/EXAM_PAPER_MODE_INVALID/);
    assert.throws(()=>build().buildPaper({paper,questions:[...paper.questions].reverse()}),/EXAM_PAPER_SNAPSHOT_MISMATCH/);
    assert.throws(()=>Parts.createDocumentBuilder({}),/EXAM_PAPER_DEPENDENCY_REQUIRED/);
});
test('actual document owner reads no DOM or storage and returns complete question and answer combinations',()=>{
    const source=fs.readFileSync(require.resolve('../qisi-exam-paper-parts'),'utf8');assert.doesNotMatch(source,/\b(?:document|window|db|indexedDB)\s*\./);
    for(const fixture of cases){const output=build().buildPaper({paper:fixture.paper});assert.equal(output.documents.length,fixture.paper.mode==='split'?2:1);assert.ok(output.documents.every(doc=>doc.content&&doc.title));}
});
