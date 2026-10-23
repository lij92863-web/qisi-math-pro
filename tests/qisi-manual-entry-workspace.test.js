const test=require('node:test');
const assert=require('node:assert/strict');
const {reactive,ref,watch}=require('vue');
const Manual=require('../qisi-manual-entry-model');
const hold=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
function setup(overrides={}){
    const state=Manual.createEntryState({reactive,ref}),images=new Map(),messages=[],saved=[];
    let draft=null,navigations=0,reads=0;
    const workspace=Manual.createWorkspace({state,repository:{async get(_,id){return images.get(id);},async put(_,row){images.set(row.id,row);}},
        library:{async saveQuestion(q,options){saved.push({q,options});return {question:q};}},
        imagePort:{read:async()=> 'data:image/gif;base64,Zml4dHVyZQ==',fromDataUrl:async()=>new Blob(['fixture']),dispose(){}},
        preferences:{read:()=>draft,save:value=>{draft=JSON.parse(JSON.stringify(value));},remove:()=>{draft=null;}},
        splitQuestion:(stem,type,options)=>({stem,type,options}),refreshLibrary:async()=>{reads++;},notify:value=>messages.push(value),
        onSaved:()=>{navigations++;},observeForm:listener=>watch(state.form,listener,{deep:true,flush:'sync'}),clock:()=>100,random:()=>0.5,...overrides});
    return {state,images,messages,saved,workspace,get draft(){return draft;},get navigations(){return navigations;},get reads(){return reads;}};
}
test('upload publishes the image and captured-field token only after durable bytes, and preferences exclude preview bytes',async()=>{
    const gate=hold();const h=setup({imagePort:{read:()=>gate.promise,dispose(){}}});
    const blob=new Blob(['bytes']);h.state.form.stem='question';const pending=h.workspace.upload(blob);
    assert.equal(h.state.form.images.length,0);h.state.tab.value='answer';gate.resolve('data:image/gif;base64,Ynl0ZXM=');
    assert.equal(await pending,true);const image=h.state.form.images[0];assert.equal(h.images.get(image.id).blob,blob);
    assert.ok(h.state.form.stem.includes(image.id));assert.equal(h.state.form.answer,'');assert.equal(h.draft.images[0].url,undefined);
    h.workspace.dispose();
});
test('failed image persistence preserves every source field without an orphan reference',async()=>{
    const h=setup({repository:{async put(){throw new Error('FULL');}}});h.state.form.stem='keep';
    assert.equal(await h.workspace.upload(new Blob(['bytes'])),false);
    assert.equal(h.state.form.stem,'keep');assert.equal(h.state.form.images.length,0);assert.match(h.messages[0],/未插入短码/);h.workspace.dispose();
});
test('failed formal save retains source, options and draft preferences for explicit retry',async()=>{
    let fail=true;const h=setup({library:{async saveQuestion(){if(fail)throw new Error('WRITE_REFUSED');return{question:{id:'saved'}};}}});
    Object.assign(h.state.form,{stem:'keep',answer:'answer',options:['A','B']});
    assert.equal(await h.workspace.submit(),false);assert.equal(h.state.form.stem,'keep');assert.deepEqual(h.draft.options,['A','B']);
    fail=false;assert.equal((await h.workspace.submit()).committed,true);assert.equal(h.state.form.stem,'');assert.equal(h.draft,null);h.workspace.dispose();
});
test('in-flight save has one dispatch and a fixed snapshot while later form changes remain',async()=>{
    const gate=hold(),calls=[];const h=setup({library:{async saveQuestion(q){calls.push(q);await gate.promise;return{question:q};}}});
    h.state.form.stem='before';const first=h.workspace.submit(),second=h.workspace.submit();assert.equal(first,second);
    h.state.form.stem='after';gate.resolve();await first;
    assert.equal(calls.length,1);assert.equal(calls[0].stem,'before');assert.equal(h.state.form.stem,'after');assert.equal(h.draft.stem,'after');assert.equal(h.navigations,0);h.workspace.dispose();
});
test('missing referenced image or bytes refuses formal insertion and retains the editable source',async()=>{
    for(const includeMetadata of [false,true]){
        const h=setup();h.state.form.stem='[[IMAGE:absent]]';if(includeMetadata)h.state.form.images=[{id:'absent'}];
        assert.equal(await h.workspace.submit(),false);assert.equal(h.saved.length,0);assert.equal(h.state.form.stem,'[[IMAGE:absent]]');h.workspace.dispose();
    }
});
test('upload in progress blocks formal save; disposal prevents late token publication',async()=>{
    const gate=hold();let disposed=0;const h=setup({imagePort:{read:()=>gate.promise,dispose(){disposed++;}}});
    h.state.form.stem='keep';const pending=h.workspace.upload(new Blob(['bytes']));
    assert.equal(await h.workspace.submit(),false);assert.equal(h.saved.length,0);
    h.workspace.dispose();h.workspace.dispose();gate.resolve('data:image/gif;base64,YQ==');assert.equal(await pending,false);
    assert.equal(h.state.form.images.length,0);assert.equal(disposed,1);
});
test('manual image editing does not consume neighboring wrappers and also updates option references',()=>{
    const h=setup();Object.assign(h.state.form,{stem:'\\begin{center}[[IMAGE:a]]\\end{center} X \\begin{center}[[IMAGE:b]]\\end{center}',
        options:['[[FORMULA_IMAGE:b]]'],images:[{id:'a'},{id:'b'}]});
    h.workspace.removeImage('b');assert.equal(h.state.form.stem,'\\begin{center}[[IMAGE:a]]\\end{center} X ');assert.deepEqual([...h.state.form.options],['']);h.workspace.dispose();
});
test('clearing a draft removes its persisted text so it cannot reappear on refresh',()=>{
    const h=setup();h.state.form.stem='old';assert.equal(h.draft.stem,'old');h.state.form.stem='';assert.equal(h.draft,null);h.workspace.dispose();
});
test('a refresh failure after formal save is reported as committed and does not submit again',async()=>{
    const h=setup({refreshLibrary:async()=>{throw new Error('READ_REFUSED');}});h.state.form.stem='saved';
    assert.deepEqual(await h.workspace.submit(),{committed:true,refreshed:false});assert.equal(h.saved.length,1);
    assert.equal(h.state.form.stem,'');assert.match(h.messages[0],/题目已保存.*刷新失败/);h.workspace.dispose();
});
