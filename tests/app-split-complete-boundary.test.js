const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),acorn=require('acorn');
const root=path.resolve(__dirname,'..'),files=require('./harness/app-split-owner-inventory');
const {parseScriptSources}=require('../scripts/verify-qisi-runtime-dependencies');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),defs=new Map();
function scan(node){if(!node||typeof node!=='object')return;if(node.type==='VariableDeclarator')defs.set(node.id?.name,node.init);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(scan);else if(value&&typeof value.type==='string')scan(value);}}scan(acorn.parse(app,{ecmaVersion:'latest'}));
const member=node=>node?.type==='MemberExpression'&&!node.computed?node.object.name+'.'+node.property.name:'';
test('all 18 owners are registered once before the actual app and retain Node exports',()=>{
    const scripts=parseScriptSources(fs.readFileSync(path.join(root,'main.html'),'utf8')),runtime=JSON.parse(fs.readFileSync(path.join(root,'architecture/runtime-modules.json'))).modules;
    assert.equal(files.length,18);for(const file of files){assert.equal(scripts.filter(script=>script===file).length,1,file);assert.ok(scripts.indexOf(file)<scripts.indexOf('app.js'),file);assert.equal(runtime.filter(row=>row.file===file&&row.runtime==='browser').length,1,file);const api=require(path.join(root,file));assert.equal(typeof api,'object',file);assert.ok(Object.isFrozen(api),file);}
});
test('new critical handlers are single-owner adapters without another app business implementation',()=>{
    const direct={submitQuestion:'manualWorkspace.submit',handleEntryPaste:'manualWorkspace.paste',handleEntryImgUpload:'manualWorkspace.upload',
        createPersonalL1:'personalWorkspace.create1',createPersonalL2:'personalWorkspace.create2',createPersonalL3:'personalWorkspace.create3',renamePersonalNode:'personalWorkspace.rename',deletePersonalNode:'personalWorkspace.remove',
        saveNewCustomTemplate:'templateWorkspace.saveNew',updateExistingCustomTemplate:'templateWorkspace.update',deleteCustomTemplate:'templateWorkspace.remove',
        toggleCart:'examWorkspace.toggle',moveCartQuestion:'examWorkspace.move',startExamPointerDrag:'examWorkspace.startPointer',printExam:'printWorkspace.print',finishExamBuild:'printWorkspace.print'};
    for(const [name,owner]of Object.entries(direct))assert.equal(member(defs.get(name)),owner,name);
    for(const [name,owner]of Object.entries({confirmAndSubmitDraft:'reviewActions.confirmAndSubmit',confirmSelectedDrafts:'reviewActions.confirmSelected'})){const node=defs.get(name);assert.equal(node.type,'ArrowFunctionExpression');assert.equal(node.body.type,'CallExpression');assert.equal(member(node.body.callee),owner);}
    for(const retired of ['buildQuestionContent','buildPrintOptionsHtml','renderLatexForPrint','renderPrintTextChunk','printImageHtml','openPrintWindow'])assert.equal(defs.has(retired),false,retired);
});
test('form, tree, template, paper and print-busy refs are aliases to their one state owner',()=>{
    for(const [name,owner]of Object.entries({entryForm:'manualState.form',entryTab:'manualState.tab',personalKnowledgeTree:'personalState.tree',personalL1Name:'personalState.name1',selectedPersonalL1Id:'personalState.selected1',customTemplates:'templateState.templates',selectedExamTemplate:'templateState.selected',examConfig:'templateState.config',cart:'examState.cart',examQuestionMeta:'examState.questionMeta',examGroupConfig:'examState.groupConfig',printBusy:'printState.busy'}))assert.equal(member(defs.get(name)),owner,name);
});
test('migrated owners never fetch the app proxy or access a private app runtime dependency',()=>{
    for(const file of files){const source=fs.readFileSync(path.join(root,file),'utf8');assert.doesNotMatch(source,/getRuntimeDependency\s*\(\s*['"]AppProxy['"]|window\.AppProxy|root\.AppProxy/,file);}
});
