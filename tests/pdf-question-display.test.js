const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const NodeDisplay=require('../qisi-pdf-question-display'),Utils=require('../qisi-utils'),S=require('../qisi-paper-segmenter');

test('pure display module loads without IO globals and behaves identically in Node and browser scope',()=>{
    const context={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../qisi-pdf-question-display.js'),'utf8'),context);
    const BrowserDisplay=context.Qisi.PdfQuestionDisplay;
    assert.equal(Object.isFrozen(NodeDisplay),true);assert.equal(Object.isFrozen(BrowserDisplay),true);
    for(const display of [NodeDisplay,BrowserDisplay]){
        const split=display.projectQuestionText('求值（）A.甲B.乙C.丙D.丁','single_choice',Utils);
        assert.equal(split.stem,'求值（）');assert.equal(JSON.stringify(split.options),JSON.stringify(['甲','乙','丙','丁']));
        assert.equal(display.tableDisplayText('<table><tr><td>颜色</td><td>数量</td></tr><tr><td>棕色</td><td>2</td></tr></table>'),'颜色 | 数量\n棕色 | 2');
    }
});

test('display-only caption ordering is equivalent across runtimes and never mutates source blocks',()=>{
    const blocks=[
        {id:'q',type:'text',text:'1. 图像题。'},{id:'a',type:'text',text:'A.'},{id:'ia',type:'image',image:'a.png'},
        {id:'b',type:'text',text:'B.'},{id:'ib',type:'image',image:'b.png'},
        {id:'ic',type:'image',image:'c.png'},{id:'c',type:'text',text:'C.',parentId:'ic',origin:{field:'image_caption'}},
        {id:'d',type:'text',text:'D.'},{id:'id',type:'image',image:'d.png'}
    ];
    const before=JSON.stringify(blocks),context={};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../qisi-pdf-question-display.js'),'utf8'),context);
    for(const display of [NodeDisplay,context.Qisi.PdfQuestionDisplay]){
        const ordered=display.questionDisplayBlocks(blocks,'single_choice',Utils,S.NUMBER_START);
        assert.equal(JSON.stringify(ordered.map(block=>block.id)),JSON.stringify(['q','a','ia','b','ib','c','ic','d','id']));
        assert.equal(JSON.stringify(blocks),before);
    }
});
