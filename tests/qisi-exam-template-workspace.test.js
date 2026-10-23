const test=require('node:test');
const assert=require('node:assert/strict');
const {ref,reactive,watch}=require('vue');
const Model=require('../qisi-exam-template-model');
const Storage=require('../qisi-storage-repository');
const {FakeDatabase}=require('./storage-test-harness');
const presets={a:{name:'A',code:'code a'},b:{name:'B',code:'code b'}};
const layoutPresets={a:{name:'A',config:{fontFamily:'宋体',fontSize:'小四',title:'A'}},b:{name:'B',config:{fontFamily:'黑体',fontSize:'五号',title:'B'}}};
function setup({records=[],saved={},repositoryChange=repo=>repo}={}){
    const data=new Map(Object.entries(saved)),messages=[];
    const preferences={get:(key,fallback)=>data.has(key)?data.get(key):fallback,json:(key,fallback)=>data.has(key)?structuredClone(data.get(key)):fallback,
        set:(key,value)=>{data.set(key,value);return true;},setJson:(key,value)=>{data.set(key,structuredClone(value));return true;}};
    const database=new FakeDatabase({customTemplates:records});const repository=repositoryChange(Storage.createRepository(database));
    const state=Model.createState({ref,reactive,preferences,defaultKey:'a',layoutPresets,defaultTemplate:'code a'});
    let stops=0;
    const workspace=Model.createWorkspace({state,repository,preferences,presets,layoutPresets,defaultKey:'a',defaultTemplate:'code a',ensurePackages:code=>code.startsWith('PKG:')?code:'PKG:'+code,
        notify:message=>messages.push(message),clock:()=>10,random:()=>0.5,
        observeConfig:fn=>{const stop=watch(state.config,fn,{deep:true,flush:'sync'});return()=>{stops++;stop();};},
        observeSelected:fn=>{const stop=watch(state.selected,fn,{flush:'sync'});return()=>{stops++;stop();};}});
    workspace.acceptLoadedTemplates(records);return {database,repository,preferences,state,workspace,messages,data,stops:()=>stops};
}
test('restore resolves selected custom layout and tagged temporary preferences before watchers persist anything',()=>{
    const tpl={id:'custom',name:'saved',code:'custom code',config:{fontFamily:'楷体',fontSize:'三号',title:'custom title'},createdAt:1};
    const h=setup({records:[tpl],saved:{qisi_exam_template:'custom',qisi_exam_config:{template:'custom',config:{fontSize:'二号'}},qisi_template:'custom code'}});
    h.workspace.restore();h.workspace.restoreEditor();assert.equal(h.state.selected.value,'custom');assert.equal(h.state.config.fontFamily,'楷体');assert.equal(h.state.config.fontSize,'二号');
    assert.equal(h.state.mode.value,'custom');assert.equal(h.state.current.value,'custom');assert.deepEqual(h.data.get('qisi_exam_config'),{template:'custom',config:{fontSize:'二号'}});
    h.workspace.selectPreset('b');assert.equal(h.state.config.fontFamily,'黑体');assert.equal(h.state.config.fontSize,'五号');
    h.workspace.selectCustom(tpl);assert.equal(h.state.config.fontFamily,'楷体');assert.equal(h.state.config.fontSize,'三号');h.workspace.dispose();
});
test('mismatched tagged config and deleted selected template never bleed into another layout',()=>{
    const h=setup({saved:{qisi_exam_template:'b',qisi_exam_config:{template:'a',config:{fontSize:'huge',extra:'wrong'}}}});h.workspace.restore();assert.equal(h.state.config.fontSize,'五号');assert.equal(h.state.config.extra,undefined);
    h.state.config.extra='transient';h.workspace.selectPreset('a');assert.equal(h.state.config.extra,undefined);
    h.workspace.dispose();const missing=setup({saved:{qisi_exam_template:'gone',qisi_exam_config:{fontSize:'huge'}}});missing.workspace.restore();assert.equal(missing.state.config.fontSize,'小四');missing.workspace.dispose();
});
test('failed new template persistence preserves entered name/code/config and has no success receipt',async()=>{
    const h=setup({repositoryChange:base=>({...base,put:async()=>{throw new Error('DISK_REFUSED');}})});h.workspace.startNew();h.state.code.value='typed';h.state.name.value='typed name';h.state.config.fontSize='三号';
    assert.equal(await h.workspace.saveNew(),false);assert.equal(h.state.code.value,'typed');assert.equal(h.state.name.value,'typed name');assert.equal(h.state.mode.value,'new');assert.equal(h.state.templates.value.length,0);assert.match(h.messages[0],/DISK_REFUSED/);h.workspace.dispose();
});
test('refused preference writes leave system cards and global editor text untouched',async()=>{
    const h=setup();h.workspace.selectPreset('a');h.state.name.value='edited';h.state.code.value='typed';h.preferences.setJson=()=>false;
    assert.equal(await h.workspace.update(),false);assert.equal(h.workspace.card('a').name,'A');assert.equal(h.state.code.value,'typed');assert.deepEqual(h.state.overrides.value,{});
    h.preferences.set=()=>false;assert.equal(h.workspace.setGlobal(),false);assert.equal(h.state.code.value,'typed');assert.ok(!h.messages.some(message=>message.includes('已更新')));h.workspace.dispose();
});
test('pending save captures detached config, dispatches once and never overrides a later template choice',async()=>{
    let release;const gate=new Promise(resolve=>{release=resolve;});let calls=0;
    const h=setup({repositoryChange:base=>({...base,async put(...args){calls++;await gate;return base.put(...args);}})});
    h.workspace.startNew();h.state.name.value='captured';h.state.config.fontSize='三号';const first=h.workspace.saveNew(),second=h.workspace.saveNew();assert.equal(first,second);
    await Promise.resolve();h.workspace.selectPreset('b');release();assert.equal(await first,true);assert.equal(calls,1);
    assert.equal(h.state.current.value,'b');assert.equal(h.state.code.value,'code b');assert.equal(h.state.config.fontSize,'五号');const record=[...h.database.table('customTemplates').rows.values()][0];assert.equal(record.name,'captured');assert.equal(record.config.fontSize,'三号');h.workspace.dispose();
});
test('durable save plus read failure preserves the receipt and changes new mode so retry cannot create another template',async()=>{
    const h=setup({repositoryChange:base=>({...base,listTable:async()=>{throw new Error('READ_REFUSED');}})});h.workspace.startNew();
    assert.equal(await h.workspace.saveNew(),true);assert.equal(h.state.templates.value.length,1);assert.equal(h.state.mode.value,'custom');assert.ok(h.state.current.value.startsWith('tpl_'));assert.match(h.messages[0],/已写入.*刷新失败.*READ_REFUSED/);h.workspace.dispose();
});
test('update and deletion reject unseen record changes and failed transaction leaves selection intact',async()=>{
    const record={id:'custom',name:'saved',code:'old',config:{fontSize:'三号'},createdAt:1};const h=setup({records:[record]});h.workspace.selectCustom(record);h.state.name.value='new';
    await h.database.table('customTemplates').put({...record,name:'another writer'});assert.equal(await h.workspace.update(),false);assert.equal(await h.workspace.remove('custom'),false);
    assert.equal(h.database.table('customTemplates').rows.get('custom').name,'another writer');assert.equal(h.state.current.value,'custom');assert.equal(h.state.name.value,'new');h.workspace.dispose();
});
test('successful delete removes just its template and selects default only when still viewing it',async()=>{
    const record={id:'custom',name:'saved',code:'old',config:{fontSize:'三号'},createdAt:1};const h=setup({records:[record]});h.workspace.selectCustom(record);
    assert.equal(await h.workspace.remove('custom'),true);assert.equal(h.state.templates.value.length,0);assert.equal(h.state.selected.value,'a');assert.equal(h.state.current.value,'a');h.workspace.dispose();
});
test('dispose prevents queued writes and releases both observers exactly once',async()=>{
    const h=setup();h.workspace.startNew();const pending=h.workspace.saveNew();h.workspace.dispose();h.workspace.dispose();assert.equal(await pending,false);assert.equal(h.database.table('customTemplates').rows.size,0);assert.equal(h.stops(),2);
});
test('late deletion keeps newer edits while removing the deleted active template identity',async()=>{
    let release;const gate=new Promise(resolve=>{release=resolve;});
    const record={id:'custom',name:'saved',code:'old',config:{fontSize:'三号'},createdAt:1};
    const h=setup({records:[record],repositoryChange:base=>({...base,async applyCustomTemplateChange(...args){await gate;return base.applyCustomTemplateChange(...args);}})});
    h.workspace.selectCustom(record);const pending=h.workspace.remove('custom');await Promise.resolve();h.state.code.value='newer draft';h.state.name.value='keep name';release();
    assert.equal(await pending,true);assert.equal(h.state.code.value,'newer draft');assert.equal(h.state.name.value,'keep name');assert.equal(h.state.current.value,'');assert.equal(h.state.mode.value,'new');assert.equal(h.state.selected.value,'a');h.workspace.dispose();
});
