const test=require('node:test');
const assert=require('node:assert/strict');
const Export=require('../qisi-export-service');
const JSZip=require('jszip');
const makeService=(zip, overrides={})=>Export.createPackageService({loadArchive:async()=>zip, listImportBatches:async()=>[],
    coreFingerprint:q=>q.stem, stemFingerprint:q=>q.stem, clock:()=>10, random:()=>0.5, ...overrides});
const file={name:'fixture.zip'};
function archive(questions){const zip=new JSZip(); zip.file('questions.json',JSON.stringify(questions)); return zip;}

test('package reads preserve duplicate detection and refuse a failed duplicate-history read',async()=>{
    const zip=archive([{id:'one',stem:'raw',images:[]}]);
    const service=makeService(zip,{listImportBatches:async()=>[{sourceTeacher:'外部教师',title:'fixture',questionCount:1}]});
    const parsed=await service.read(file); assert.equal(parsed.mayDuplicate,true);
    const next=service.project(parsed); assert.equal(next.questions[0].sourceFingerprint,'raw'); assert.equal(next.batch.schemaVersion,'unknown');
    await assert.rejects(makeService(zip,{listImportBatches:async()=>{throw new Error('HISTORY_READ_FAILED');}}).read(file),/HISTORY_READ_FAILED/);
});
test('package refuses missing images and invalid question arrays before any projection',async()=>{
    await assert.rejects(makeService(archive({bad:true})).read(file),/不是数组/);
    await assert.rejects(makeService(archive([{id:'one',images:[{id:'absent'}]}])).read(file),/缺少图片文件/);
});
test('same source image ID in different questions keeps per-question bytes and unique mapped IDs',async()=>{
    const zip=archive([{id:'one',stem:'[[IMAGE:same]]',images:[{id:'same',file:'a.png'}]},
        {id:'two',stem:'[[IMAGE:same]]',images:[{id:'same',file:'b.png'}]}]);
    zip.file('a.png','a-bytes'); zip.file('b.png','b-bytes');
    const service=makeService(zip), parsed=await service.read(file), result=service.project(parsed);
    const [a,b]=result.questions; assert.notEqual(a.images[0].id,b.images[0].id);
    assert.equal(a.stem,`[[IMAGE:${a.images[0].id}]]`); assert.equal(b.stem,`[[IMAGE:${b.images[0].id}]]`);
    assert.equal(await result.images[0].blob.text(),'a-bytes'); assert.equal(await result.images[1].blob.text(),'b-bytes');
    assert.equal(parsed.rawQuestions[0].stem,'[[IMAGE:same]]');
});
test('ambiguous duplicate image IDs within one question fail closed instead of choosing the last bytes',async()=>{
    const zip=archive([{id:'one',stem:'[[IMAGE:same]]',images:[{id:'same',file:'a.png'},{id:'same',file:'b.png'}]}]);
    zip.file('a.png','a'); zip.file('b.png','b'); const service=makeService(zip);
    const parsed=await service.read(file); assert.throws(()=>service.project(parsed),/标识冲突/);
});
