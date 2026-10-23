const test=require('node:test'),assert=require('node:assert/strict');
const {ref,reactive,watch}=require('vue');const Model=require('../qisi-exam-groups');
const fixture=[{id:'a',type:'单选题',stem:'A',images:[{id:'image',url:'blob:captured'}],options:['first'],meta:{raw:'original'}},
{id:'b',type:'单选题',stem:'B',images:[],options:[]},{id:'c',type:'解答题',stem:'C',answer:'C answer',images:[],options:[]}];
function setup(saved={}){
    const data=new Map(Object.entries(saved)),preferences={get:(key,fallback)=>data.has(key)?data.get(key):fallback,json:(key,fallback)=>data.has(key)?structuredClone(data.get(key)):fallback,set:(key,value)=>{data.set(key,value);return true;},setJson:(key,value)=>{data.set(key,structuredClone(value));return true;}};
    const state=Model.createState({ref,reactive,preferences}),questions=ref(structuredClone(fixture)),messages=[];
    const layout=reactive({template:'default',config:{title:'captured',fontSize:'小四'},title:'paper title',mode:'questions'});
    let stopCount=0;
    const observe=(source,deep=true)=>fn=>{const stop=watch(source,fn,{deep,flush:'sync'});return()=>{stopCount++;stop();};};
    const workspace=Model.createWorkspace({state,getQuestions:()=>questions.value,getLayout:()=>layout,preferences,typeOrder:['单选题','解答题'],defaultGroupConfig:{单选题:{points:5,title:'选择'},解答题:{points:10,title:'解答'}},typeLabels:{},confirm:()=>true,notify:message=>messages.push(message),observeCart:observe(state.cart),observeMeta:observe(state.questionMeta),observeGroups:observe(state.groupConfig),observeQuestions:observe(questions),observeMode:observe(state.mode,false),observeNavigation:()=>()=>{stopCount++;}});
    return {state,questions,layout,workspace,messages,data,stopCount:()=>stopCount};
}
test('initial question publication cannot erase saved cart before restoration',()=>{
    const h=setup({qisi_exam_cart:['b','a'],qisi_exam_question_meta:{a:{points:0,note:'keep'}}});h.questions.value=[...h.questions.value];assert.deepEqual(h.data.get('qisi_exam_cart'),['b','a']);h.workspace.restore();
    assert.deepEqual(h.state.cart.value,['b','a']);assert.equal(h.state.questionMeta.a.points,0);assert.equal(h.workspace.groups()[0].total,5);h.workspace.dispose();
});
test('cart commands reject stale source and cross-type moves, persist type-local ordering, and remove just corresponding meta',()=>{
    const h=setup();h.workspace.restore();for(const id of ['a','c','b'])assert.equal(h.workspace.toggle(id),true);
    assert.equal(h.workspace.toggle('missing'),false);assert.equal(h.workspace.move('b',-1),true);assert.deepEqual(h.state.cart.value,['b','c','a']);
    h.state.dragging.value='b';assert.equal(h.workspace.drop('c'),false);assert.deepEqual(h.state.cart.value,['b','c','a']);
    assert.equal(h.workspace.reorder('a',0,['a','b']),false);h.workspace.remove('a');assert.equal(h.state.questionMeta.a,undefined);assert.equal(h.workspace.reorder('a',0),false);assert.deepEqual(h.state.cart.value,['b','c']);
    assert.deepEqual(h.data.get('qisi_exam_cart'),['b','c']);h.workspace.dispose();
});
test('paper snapshot freezes detached question/options/image/meta/layout data in actual printed type order',()=>{
    const h=setup();for(const id of ['c','a','b'])h.workspace.toggle(id);h.state.questionMeta.a.points=0;const paper=h.workspace.snapshot();
    assert.deepEqual(paper.cart,['c','a','b']);assert.deepEqual(paper.questions.map(q=>q.id),['a','b','c']);assert.ok(Object.isFrozen(paper.questions[0].images[0]));
    h.questions.value[0].stem='later';h.questions.value[0].options[0]='later option';h.questions.value[0].meta.raw='later raw';h.layout.config.title='later';h.state.questionMeta.a.note='later note';
    assert.equal(paper.questions[0].stem,'A');assert.equal(paper.questions[0].options[0],'first');assert.equal(paper.questions[0].meta.raw,'original');assert.equal(paper.config.title,'captured');assert.equal(paper.questionMeta.a.note,'');assert.equal(paper.questionMeta.a.points,0);h.workspace.dispose();
});
test('snapshot refuses empty, duplicated, deleted questions and invalid scores',()=>{
    const h=setup();assert.throws(()=>h.workspace.snapshot(),/先从题库/);h.workspace.toggle('a');h.state.cart.value=['a','a'];assert.throws(()=>h.workspace.snapshot(),/不存在或重复/);
    h.state.cart.value=['a','missing'];assert.throws(()=>h.workspace.snapshot(),/不存在或重复/);h.state.cart.value=['a'];h.state.questionMeta.a.points=-1;assert.throws(()=>h.workspace.snapshot(),/分值无效/);h.workspace.dispose();
});
test('zero score is real data and pure reorder never inserts a source absent from the cart',()=>{
    const grouped=Model.groupQuestions({questions:fixture.slice(0,1),questionMeta:{a:{points:0}},groupConfig:{单选题:{points:5}}});assert.equal(grouped[0].total,0);
    assert.deepEqual(Model.reorderWithinType({sourceId:'a',targetIndex:0,cart:['b'],questions:fixture}),{cart:['b'],changed:false});
    assert.equal(Model.reorderWithinType({sourceId:'a',targetIndex:NaN,cart:['a','b'],questions:fixture}).changed,false);
});
test('navigation, cart changes and dispose release one pointer owner and all observers',()=>{
    const h=setup();let cancelled=0,disposed=0;h.workspace.attachPointer({cancel(){cancelled++;},dispose(){disposed++;},start(){}});h.workspace.toggle('a');h.workspace.clear();assert.ok(cancelled>=2);
    h.workspace.dispose();h.workspace.dispose();assert.equal(disposed,1);assert.equal(h.stopCount(),6);assert.equal(h.workspace.toggle('b'),false);assert.throws(()=>h.workspace.snapshot(),/已关闭/);
});
