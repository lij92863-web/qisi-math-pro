const test=require('node:test');
const assert=require('node:assert/strict');
const Model=require('../qisi-personal-knowledge-model');
const Storage=require('../qisi-storage-repository');
const Ui=require('../qisi-ui-events');
const {FakeDatabase}=require('./storage-test-harness');
const initial=[{id:'r',name:'root',children:[{id:'c',name:'child',children:[{id:'l',name:'leaf'}]}],expanded:true}];
function setup(nodes=initial,repositoryChange=value=>value){
    const database=new FakeDatabase({personalKnowledge:[{id:'tree',nodes}]});
    const repository=repositoryChange(Storage.createRepository(database));
    const state=Model.createState({ref:value=>({value})}),messages=[];
    const workspace=Model.createWorkspace({state,repository,notify:m=>messages.push(m),prompt:()=> 'renamed',confirm:()=>true,
        countTree:Ui.buildKnowledgeCounts,getKnowledge:q=>q.personalKnowledge,clock:()=>100,random:()=>0.5});
    workspace.acceptLoadedTree(nodes);return {database,state,workspace,messages};
}
test('tree commands preserve source immutability and exact parent membership',()=>{
    const before=structuredClone(initial);
    const next=Model.applyTreeCommand(initial,{kind:'add',level:3,parentId:'c',rootId:'r',id:'new',name:' new leaf '});
    assert.equal(next.tree[0].children[0].children[1].name,'new leaf');assert.deepEqual(initial,before);
    for(const command of [{kind:'add',level:3,parentId:'c',rootId:'wrong',id:'new',name:'x'},
        {kind:'add',level:2,parentId:'l',id:'new',name:'x'},{kind:'delete',id:'l',level:3,parentId:'wrong'},
        {kind:'add',level:1,id:'r',name:'duplicate'}])assert.throws(()=>Model.applyTreeCommand(initial,command),error=>error.code==='PERSONAL_KNOWLEDGE_COMMAND_INVALID');
    assert.throws(()=>Model.applyTreeCommand([{id:'r'},{id:'r'}],{kind:'add',level:1,id:'x',name:'x'}),/重复/);
});
test('rename, expand and subtree deletion use detached records and refuse stale node evidence',()=>{
    const renamed=Model.applyTreeCommand(initial,{kind:'rename',level:2,id:'c',parentId:'r',name:'renamed',expectedNode:initial[0].children[0]});
    assert.equal(renamed.tree[0].children[0].name,'renamed');
    assert.throws(()=>Model.applyTreeCommand(renamed.tree,{kind:'delete',level:2,id:'c',parentId:'r',expectedNode:initial[0].children[0]}),/其他操作修改/);
    const deleted=Model.applyTreeCommand(initial,{kind:'delete',id:'c',level:2,parentId:'r'});assert.deepEqual(deleted.tree[0].children,[]);
    const collapsed=Model.applyTreeCommand(initial,{kind:'toggle',id:'r',level:1});assert.equal(collapsed.tree[0].expanded,false);
});
test('failed tree persistence keeps visible tree, selection and name input unchanged',async()=>{
    const h=setup();h.database.failAfterWork=true;h.state.name1.value='new root';h.state.selected1.value='r';h.state.selected2.value='c';
    const before=structuredClone(h.state.tree.value);assert.equal(await h.workspace.create1(),false);
    assert.deepEqual(h.state.tree.value,before);assert.deepEqual(h.database.table('personalKnowledge').rows.get('tree').nodes,before);
    assert.equal(h.state.name1.value,'new root');assert.equal(h.state.selected1.value,'r');assert.equal(h.state.selected2.value,'c');
});
test('new commands read the persisted tree inside the transaction so unseen sibling additions are retained',async()=>{
    const h=setup();const persisted=[...structuredClone(initial),{id:'other',name:'another window'}];
    await h.database.table('personalKnowledge').put({id:'tree',nodes:persisted});h.state.name1.value='local';
    assert.equal(await h.workspace.create1(),true);assert.equal(h.state.tree.value.length,3);
    assert.ok(h.state.tree.value.some(node=>node.id==='other'));assert.equal(h.state.name1.value,'');
    assert.equal(h.workspace.acceptLoadedTree(initial),false);assert.equal(h.state.tree.value.length,3);
});
test('pending duplicate create dispatches once while later input and selections survive',async()=>{
    let release;const gate=new Promise(resolve=>{release=resolve;});let calls=0;
    const h=setup(initial,base=>({...base,async updatePersonalKnowledgeTree(...args){calls++;await gate;return base.updatePersonalKnowledgeTree(...args);}}));
    h.state.name1.value='captured';const first=h.workspace.create1(),second=h.workspace.create1();assert.equal(first,second);
    await Promise.resolve();h.state.name1.value='next input';h.state.selected1.value='r';h.state.selected2.value='c';
    release();assert.equal(await first,true);assert.equal(calls,1);assert.equal(h.state.name1.value,'next input');
    assert.equal(h.state.selected1.value,'r');assert.equal(h.state.selected2.value,'c');
});
test('deleting a selected subtree clears invalid selections and retains formal-question count semantics',async()=>{
    const h=setup();h.state.selected1.value='r';h.state.selected2.value='c';
    assert.deepEqual(h.workspace.counts([{personalKnowledge:'leaf'}]),{leaf:1,child:1,root:1});
    assert.equal(await h.workspace.remove(2,'c','r'),true);assert.equal(h.state.selected1.value,'r');assert.equal(h.state.selected2.value,'');
    assert.deepEqual(h.workspace.counts([{personalKnowledge:'leaf'}]),{leaf:1});
    assert.equal(await h.workspace.remove(1,'r'),true);assert.equal(h.state.selected1.value,'');assert.deepEqual(h.state.tree.value,[]);
});
test('dispose before queued command prevents persistence and publication',async()=>{
    const h=setup();h.state.name1.value='cancelled';const pending=h.workspace.create1();h.workspace.dispose();
    assert.equal(await pending,false);assert.deepEqual(h.database.table('personalKnowledge').rows.get('tree').nodes,initial);
});
