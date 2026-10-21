const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Client=require('../qisi-mineru-client').internals,Producer=require('../qisi-pdf-mineru-producer');
const Contract=require('../qisi-pdf-mineru-contract');
const item=text=>({page_idx:0,type:'text',text});
const image=Buffer.from('offline-image');
async function produce(items){
    const bytes=fs.readFileSync(path.join(__dirname,'fixtures/true-import/pdf-question.pdf'));
    const hash=crypto.createHash('sha256').update(bytes).digest('hex');
    const parsed=Client.parseContentList(items,{sourceId:hash});
    const pages=[{pageNo:1,url:'data:image/png;base64,AA=='}];pages.totalPages=1;
    const source={id:'question-source',filename:'fixture.pdf',fileType:'pdf',roles:['question'],uploadPath:'fixture:pdf'};
    const result=await Producer.createProducer({
        getRoles:file=>file.roles,renderPages:async()=>pages,
        fetch:async(url,options)=>{
            if(url==='/api/mineru/status')return Response.json({configured:true});
            if(url==='fixture:pdf')return new Response(bytes,{headers:{'content-type':'application/pdf'}});
            if(url==='/api/mineru/parse'){
                assert.equal(crypto.createHash('sha256').update(Buffer.from(await options.body.get('file').arrayBuffer())).digest('hex'),hash);
                return Response.json({protocol:'mineru-blocks-v1',job:hash,source:{sha256:hash,pages:1},...parsed,receipt:{state:'ready'}});
            }
            if(url.startsWith('/api/mineru/image?'))return new Response(image,{headers:{'content-type':'image/png'}});
            throw new Error('Unexpected transport in offline fixture');
        }
    })({batchId:'projection-fixture',sources:[source],supplementalSources:[]});
    assert.deepEqual(result.evidence[0].rawEvidence.items,items);
    for(const draft of result.drafts){assert.equal(draft.manualConfirmed,false);assert.equal(draft.fieldProvenance.stem.status,'rejected');}
    return result.drafts;
}

test('printed non-choice questions retain named points and all subquestions as stem',async()=>{
    for(const heading of ['三、填空题','四、解答题']){
        const stem='已知 A、B 分别为两轴上的动点，(1)求轨迹；(2)求面积。';
        const [q]=await produce([item(heading),item('1. '+stem)]);
        assert.equal(q.stem,stem);assert.deepEqual(q.options,[]);assert.deepEqual(q.pdfReview.optionLabels,[]);
    }
});

test('explicit complete A-D labels recover Chinese punctuation and glued Chinese text boundaries',async()=>{
    for(const text of [
        '1. 求值（）A.甲B.乙C.丙D.丁',
        '1. 求值 A.甲 B.乙的直径C.丙 D.丁',
        '1. 求值（）Ａ．甲Ｂ．乙Ｃ．丙Ｄ．丁'
    ]){
        const [q]=await produce([item('一、单项选择题'),item(text)]);
        assert.deepEqual(q.pdfReview.optionLabels,['A','B','C','D']);assert.equal(q.options.length,4);
        assert.ok(!q.stem.includes('A.'));assert.ok(q.options[2].includes('丙'));
    }
});

test('standalone next-section heading is excluded from display while its raw evidence survives',async()=>{
    const [first,second]=await produce([
        item('一、单选题'),item('1. 求值 A.甲 B.乙 C.丙 D.丁'),item('二、多选题'),
        item('2. 下列正确 A.一 B.二 C.三 D.四'),item('三、填空题')
    ]);
    assert.equal(first.options[3],'丁');assert.equal(second.options[3],'四');
    assert.equal(first.type,'单选题');assert.equal(second.type,'多选题');
    assert.ok(first.pdfReview.candidates.question[0].evidence.length>=2,'source evidence must retain the excluded heading block');
});

test('math spans and image tokens cannot supply labels for glued-label recovery',async()=>{
    for(const math of ['$A.甲 B.乙 C.丙 D.丁$','$$A.甲 B.乙 C.丙 D.丁$$','\\(A.甲 B.乙 C.丙 D.丁\\)','\\[A.甲 B.乙 C.丙 D.丁\\]']){
        const [q]=await produce([item('一、单选题'),item('1. 公式 '+math+' 求值（）A.甲B.乙C.丙D.丁')]);
        assert.ok(q.stem.includes(math));assert.deepEqual(q.options,['甲','乙','丙','丁']);
    }
});

test('missing or duplicated labels and broken math never fabricate a complete option sequence',async()=>{
    for(const text of ['1. 求值（）A.甲B.乙D.丁','1. 点A.说明 求值（）A.甲B.乙C.丙D.丁',
        '1. 公式 $A.甲B.乙C.丙D.丁']){
        const [q]=await produce([item('一、单选题'),item(text)]);
        assert.notDeepEqual(q.pdfReview.optionLabels,['A','B','C','D']);
    }
});

test('ordinary explicit, unpunctuated and incomplete labels keep existing lexical behavior',async()=>{
    for(const text of ['1. 题 A.甲 B.乙 C.丙 D.丁','1. 题 A 甲 B 乙 C 丙 D 丁']){
        const [q]=await produce([item('一、单选题'),item(text)]);
        assert.deepEqual(q.pdfReview.optionLabels,['A','B','C','D']);assert.deepEqual(q.options,['甲','乙','丙','丁']);
    }
    const [q]=await produce([item('一、单选题'),item('1. 题 A.甲 C.丙 D.丁')]);
    assert.deepEqual(q.pdfReview.optionLabels,['A','C','D']);
    assert.ok(Contract.reviewProblem(q),'incomplete source labels remain review-blocked');
});

test('image-bearing table keeps both existing cell text and original crop pending source review',async()=>{
    const html='<table><tr><td></td><td>红色</td><td>蓝色</td></tr><tr><td>米色</td><td>8</td><td>12</td></tr><tr><td>棕色</td><td>2</td><td>3</td></tr></table>';
    const [q]=await produce([item('四、解答题'),item('1. 根据下表回答。'),
        {page_idx:0,type:'table',table_body:html,img_path:'images/table.png'}]);
    assert.match(q.stem,/米色.*8.*12/);assert.match(q.stem,/棕色.*2.*3/);
    assert.ok(!q.stem.includes('<table>'),'simple cells should be readable rather than literal HTML');
    assert.equal(q.images.length,1);assert.equal(q.images[0].url,'data:image/png;base64,'+image.toString('base64'));
    assert.ok(q.stem.includes('[[IMAGE:'+q.images[0].id+']]'));
    assert.match(q.pdfReview.taskProblems.join('\n'),/表格.*文字.*图片.*核对/);
    assert.equal(q.pdfReview.taskIssuesAcknowledged,false);
    assert.equal(q.pdfReview.candidates.question[0].item.stem,q.stem);
});

test('table text without a crop remains readable and unsupported table layout is retained literally',async()=>{
    const [plain]=await produce([item('四、解答题'),item('1. 表格题。'),
        {page_idx:0,type:'table',table_body:'<table><tr><td>条件</td><td>$x &lt; 2$</td></tr></table>'}]);
    assert.match(plain.stem,/条件.*\$x < 2\$/);assert.equal(plain.images.length,0);
    const complex='<table><tr><td rowspan="2">跨行</td><td>原文</td></tr><tr><td>续行</td></tr></table>';
    const [q]=await produce([item('四、解答题'),item('1. 复杂表。'),{page_idx:0,type:'table',table_body:complex,img_path:'images/table.png'}]);
    assert.ok(q.stem.includes(complex),'unsupported spans must not be flattened or guessed');
    assert.equal(q.manualConfirmed,false);
});

test('malformed cells and unsupported active markup remain literal instead of losing source text',async()=>{
    for(const html of [
        '<table><tr><td>第一格</th><td>第二格</td></tr></table>',
        '<table><tr><td><img src="https://invalid.example/x" onerror="alert(1)">原文</td></tr></table>'
    ]){
        const [q]=await produce([item('四、解答题'),item('1. 原表。'),{page_idx:0,type:'table',table_body:html}]);
        assert.ok(q.stem.includes(html));
    }
});

test('a caption that resembles a section heading remains attached to its image',async()=>{
    const [q]=await produce([item('四、解答题'),item('1. 阅读图中分类后作答。'),
        {page_idx:0,type:'image',img_path:'images/caption.png',image_caption:['三、填空题']}]);
    assert.ok(q.stem.includes('三、填空题'));assert.equal(q.images.length,1);
});

test('option image metadata and candidate adoption retain their exact token fields',async()=>{
    const blocks=[item('一、单选题'),item('1. 根据题图选择正确选项。'),{page_idx:0,type:'image',img_path:'images/stem.png'}];
    for(const label of ['A','B','C','D'])blocks.push(item(label+'.'),{page_idx:0,type:'image',img_path:'images/'+label+'.png'});
    const [q]=await produce(blocks);
    assert.deepEqual(q.images.map(image=>image.position),['stem','option:A','option:B','option:C','option:D']);
    assert.deepEqual(q.fieldProvenance.images.imageEvidence.map(image=>image.field),q.images.map(image=>image.position));
    assert.equal(q.pdfReview.candidates.question[0].images.length,5);
    const Review=require('../qisi-review-controller'),Identity=require('../qisi-docx-producer-identity-contract');
    const adopted=Contract.chooseCandidate(q,'question',0,Review.createReviewController({formalFields:Identity.FORMAL_FIELDS}));
    assert.equal(adopted.images.length,5);
    for(const image of adopted.images){
        const target=image.position==='stem'?adopted.stem:adopted.options[adopted.pdfReview.optionLabels.indexOf(image.position.slice(7))];
        assert.ok(target.includes('[[IMAGE:'+image.id+']]'));
    }
});

test('incomplete option labels retain their source names and make image ownership doubt visible',async()=>{
    const blocks=[item('一、单选题'),item('1. 图像选择题。')];
    for(const label of ['A','B','D'])blocks.push(item(label+'.'),{page_idx:0,type:'image',img_path:'images/'+label+'.png'});
    const [q]=await produce(blocks);
    assert.deepEqual(q.pdfReview.optionLabels,['A','B','D']);
    assert.deepEqual(q.images.map(image=>image.position),['option:A','option:B','option:D']);
    assert.match(q.pdfReview.taskProblems.join('\n'),/选项.*不完整.*图片.*核对/);
    assert.equal(q.pdfReview.taskIssuesAcknowledged,false);
});

test('a printed C marker after its image leaves an empty C option and requires ownership review',async()=>{
    const blocks=[item('一、单选题'),item('1. 图像选择题。'),item('A.'),{page_idx:0,type:'image',img_path:'images/A.png'},
        item('B.'),{page_idx:0,type:'image',img_path:'images/B.png'},{page_idx:0,type:'image',img_path:'images/uncertain.png'},
        item('C. D.'),{page_idx:0,type:'image',img_path:'images/D.png'}];
    const [q]=await produce(blocks);
    assert.deepEqual(q.pdfReview.optionLabels,['A','B','C','D']);assert.equal(q.options[2].trim(),'');
    assert.equal(q.images[2].position,'option:B','do not guess that a preceding image belongs to a later printed C');
    assert.match(q.pdfReview.taskProblems.join('\n'),/选项.*不完整.*图片.*核对/);
    assert.equal(q.manualConfirmed,false);
});

test('an exact parent-bound option caption may precede its own image in display only',async()=>{
    const blocks=[item('一、单选题'),item('1. 图像选择题。'),item('A.'),{page_idx:0,type:'image',img_path:'images/A.png'},
        item('B.'),{page_idx:0,type:'image',img_path:'images/B.png'},
        {page_idx:0,type:'image',img_path:'images/C.png',image_caption:['C.']},
        item('D.'),{page_idx:0,type:'image',img_path:'images/D.png'}];
    const [q]=await produce(blocks);
    assert.deepEqual(q.pdfReview.optionLabels,['A','B','C','D']);
    assert.deepEqual(q.images.map(image=>image.position),['option:A','option:B','option:C','option:D']);
    for(const option of q.options)assert.equal((option.match(/\[\[IMAGE:/g)||[]).length,1);
    assert.ok(q.pdfReview.candidates.question[0].evidence.some(e=>e.origin.field==='image_caption'));
});

test('option figures survive explicit review, admission and reload in an isolated real UI', {timeout:60000},async()=>{
    const H=require('./e2e/browser-harness'),h=await H.startBrowserApp(32752);
    try{
        const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
        const blocks=[item('一、单选题'),item('1. 选择正确的图形。')],images={};
        for(const label of ['A','B','C','D']){
            if(label!=='C')blocks.push(item(label+'.'));
            const name='images/'+label+'.png';images[name]={type:'image/png',bytes:png};
            blocks.push({page_idx:0,type:'image',img_path:name,...(label==='C'?{image_caption:['C.']}:{})});
        }
        blocks.push(item('参考答案'),item('1【答案】A'),item('【解析】甲是正确选项。'));
        const file=path.join(__dirname,'fixtures/true-import/pdf-question.pdf');
        await require('./harness/mineru-replay').installMineruReplay(h.page,[{file,items:blocks,images}]);
        const imported=await H.createImportThroughUi(h.page,{files:[{file,roles:['full']}]});
        let q=imported.snapshot.drafts[0];
        assert.deepEqual(q.images.map(i=>i.position),['option:A','option:B','option:C','option:D']);
        assert.equal(imported.snapshot.questions.length,0);
        await H.callProxy(h.page,'openBatchReview',imported.batchId);
        for(const field of ['question','answer','solution'])await H.callProxy(h.page,'choosePdfCandidate',field,0);
        await H.callProxy(h.page,'confirmDraftImages');await H.callProxy(h.page,'markDraftReviewed');
        let snapshot=await H.getDbSnapshot(h.page);q=snapshot.drafts.find(d=>d.id===q.id);
        assert.equal(q.status,'reviewed');assert.equal(q.images.length,4);assert.equal(snapshot.questions.length,0);
        assert.equal(await H.callProxy(h.page,'submitDraftQuestion',q.id,true),true);
        const formal=(await H.getDbSnapshot(h.page)).questions;assert.equal(formal.length,1);assert.equal(formal[0].answer,'A');
        await h.page.reload();snapshot=await H.getDbSnapshot(h.page);
        assert.deepEqual(snapshot.questions,formal);
        const restored=snapshot.drafts.find(d=>d.id===q.id);
        assert.equal(restored.status,'submitted');assert.deepEqual(restored.images.map(i=>i.position),['option:A','option:B','option:C','option:D']);
        for(let index=0;index<4;index++)assert.ok(restored.options[index].includes('[[IMAGE:'+restored.images[index].id+']]'));
        H.assertNoRuntimeErrors(h);
    }finally{await h.close();}
});
