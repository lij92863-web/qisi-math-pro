const test=require('node:test');
const assert=require('node:assert/strict');
const Library=require('../qisi-library-service');
function model(local){return Library.createExternalQuestionModel({
    coreFingerprint:q=>q.stem+'|'+JSON.stringify(q.options||[]),stemFingerprint:q=>q.stem,
    getIndexes:()=>({core:new Map(local.map(q=>[q.stem+'|'+JSON.stringify(q.options||[]),q])),stem:new Map(local.map(q=>[q.stem,q]))}),
    getKnowledge:(q,type)=>q[type+'Knowledge']||q.meta?.[type+'Knowledge']||'',hasText:value=>String(value||'').trim().length>0,
    sameText:(a,b)=>String(a).replace(/\s/g,'')===String(b).replace(/\s/g,''),clock:()=>100,random:()=>0.5});}
test('external matching preserves new, answer-conflict, fillable, existing and similar decisions',()=>{
    const q={id:'q',stem:'s',options:['A'],answer:'1',solution:'proof',personalKnowledge:'p',systemKnowledge:'s'};
    const m=model([q]); assert.equal(m.getMatchInfo({...q,stem:'other'}).status,'new');
    assert.equal(m.getMatchInfo({...q,answer:'2'}).status,'answerConflict');
    assert.equal(m.getMatchInfo({...q,answer:' 1 '}).status,'existing');
    assert.equal(m.getMatchInfo({...q,options:['B']}).status,'similar');
    assert.equal(model([{...q,answer:''}]).getMatchInfo(q).status,'fillable');
    assert.equal(model([{...q,personalKnowledge:''}]).getMatchInfo(q).status,'fillable');
});
test('external copy and fill retain provenance, knowledge precedence, images and input immutability',()=>{
    const m=model([]), external={id:'e',batchId:'b',sourceTeacher:'teacher',stem:'s',answer:'answer',solution:'solution',
        images:[{id:'img',url:'blob:temporary',align:'left'}],personalKnowledge:'personal',systemKnowledge:'system',meta:{tags:['original']}};
    const before=structuredClone(external), copy=m.copyQuestion(external,{personalKnowledge:'chosen'});
    assert.equal(copy.knowledge,'chosen'); assert.equal(copy.meta.sources[0].externalId,'e');
    assert.deepEqual(copy.images,[{id:'img',align:'left'}]); assert.ok(copy.meta.tags.includes('来源_teacher'));
    const local={id:'q',stem:'s',answer:'teacher answer',solution:'',images:[],meta:{tags:['local']}};
    const localBefore=structuredClone(local), filled=m.fillQuestion(local,external,{});
    assert.equal(filled.answer,'teacher answer'); assert.equal(filled.solution,'solution');
    assert.equal(filled.meta.sources[0].type,'external-fill'); assert.deepEqual(local,localBefore); assert.deepEqual(external,before);
});
test('external fill carries only exact images referenced by fields actually copied and preserves inputs',()=>{
    const local={id:'local',stem:'S [[IMAGE:local]]',answer:'teacher answer',solution:'',images:[{id:'local',align:'flushleft',caption:'keep'}],meta:{}};
    const external={id:'e',answer:'[[IMAGE:ignored]]',solution:'proof [[FORMULA_IMAGE:solution]] \\includegraphics{other} [[IMAGE:solution]]',
        images:[{id:'ignored'},{id:'unused'},{id:'solution',align:'center',sourceFileId:'source',url:'blob:preview'},{id:'other',align:'flushright'}]};
    const before=structuredClone({local,external}),result=model([]).fillQuestion(local,external,{});
    assert.equal(result.answer,'teacher answer');assert.equal(result.solution,external.solution);
    assert.deepEqual(result.images,[local.images[0],{id:'solution',align:'center',sourceFileId:'source'},{id:'other',align:'flushright'}]);
    assert.deepEqual({local,external},before);
});
test('external fill rejects missing or conflicting image declarations before publication',()=>{
    const local={id:'local',stem:'S',answer:'',solution:'',images:[],meta:{}};
    for(const images of [[],[{id:'x'},{id:'x',align:'flushright'}]]){
        assert.throws(()=>model([]).fillQuestion(local,{id:'e',answer:'[[IMAGE:x]]',images},{}),error=>error.code==='EXTERNAL_FILL_IMAGE_INVALID');
    }
    assert.throws(()=>model([]).fillQuestion({...local,images:[{id:'x',align:'flushleft'}]},
        {id:'e',solution:'[[IMAGE:x]]',images:[{id:'x',align:'flushright'}]},{}),error=>error.code==='EXTERNAL_FILL_IMAGE_INVALID');
    assert.deepEqual(local.images,[]);
});
