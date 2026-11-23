const test=require('node:test'),assert=require('node:assert/strict');
const Formula=require('../qisi-docx-formula-source.js');
const {validateEquations}=require('../qisi-mathtype-local-service.js');
const {buildOleContainer,equationNativeStream}=require('./helpers/ole-container.js');
const tex=source=>{const b=Buffer.from('TeX Input Language\0'+source+'\0','latin1');return Buffer.concat([Buffer.from([5,1,0,7,8]),Buffer.from('DSMT7\0'),Buffer.from([1,102,b.length]),b,Buffer.from([0])]);};
const object=id=>`<w:object><o:OLEObject ProgID="Equation.DSMT4" r:id="${id}"/></w:object>`;
const zipFor=(sources)=>({file(name){const value=sources[name];return value?{async:async()=>value}:null;}});
const bytes=source=>buildOleContainer('Equation Native',equationNativeStream(tex(source)));

test('native results bind by relationship ID and unwrap display delimiters',async()=>{
 const result=await Formula.expand(object('r1')+' then '+object('r2'),new Map([['r1',{target:'one'}],['r2',{target:'two'}]]),zipFor({one:bytes('x'),two:bytes('y')}),{translateNative:async()=>({equations:[{id:'r2',ok:true,latex:'\\[y^2\\]'},{id:'r1',ok:true,latex:'$A=B$'}]})});
 assert.equal(result.xml,'<w:t xml:space="preserve"> $A=B$ </w:t> then <w:t xml:space="preserve"> $y^2$ </w:t>');
 assert.ok(result.formulas.every(f=>f.engine==='mathtype-native'));
});

test('unavailable or inconsistent native output uses exactly one local formula per OLE object',async()=>{
 for(const native of [async()=>{throw Error('unavailable');},async()=>({equations:[{id:'wrong-id',ok:true,latex:'wrong'}]})]){
 const result=await Formula.expand(object('r1'),new Map([['r1',{target:'one'}]]),zipFor({one:bytes('-1')}),{translateNative:native});
 assert.equal(result.formulas[0].latex,'-1');assert.equal(result.formulas[0].engine,'javascript-mtef');assert.equal((result.xml.match(/-1/g)||[]).length,1);
 }
});

test('missing equation bytes remain unresolved and local endpoint rejects bad IDs and oversized batches',async()=>{
 const result=await Formula.expand(object('missing'),new Map(),zipFor({}),{translateNative:async()=>{throw Error('must not call');}});
 assert.equal(result.formulas[0].status,'unresolved');assert.match(result.xml,/DOCX不可显示图片:公式:missing/);
 const row={id:'r1',mtefBase64:tex('x').toString('base64')};assert.equal(validateEquations({equations:[row]}),true);
 assert.equal(validateEquations({equations:[row,row]}),false);assert.equal(validateEquations({equations:[{...row,id:'../ bad'}]}),false);
 assert.equal(validateEquations({equations:Array.from({length:513},(_,i)=>({...row,id:'r'+i}))}),false);
});

test('role-only full DOCX keeps OMML, MathType and formula letters through normal review', {timeout:60000},async()=>{
 const path=require('node:path'),JSZip=require('jszip');
 const {startBrowserApp,createImportThroughUi,assertNoRuntimeErrors}=require('./e2e/browser-harness.js');
 const zip=new JSZip();
 zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 const p=s=>'<w:p><w:r><w:t>'+s.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</w:t></w:r></w:p>';
 const omml='<m:oMath><m:f><m:num><m:sSup><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup><m:r><m:t>+1</m:t></m:r></m:num><m:den><m:r><m:t>x-1</m:t></m:r></m:den></m:f></m:oMath>';
 zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>'+p('一、单选题')+'<w:p><w:r><w:t>1. 已知 </w:t>'+object('r1')+'</w:r>'+omml+'</w:p>'+p('A. $A=B$ B. $B\\subseteq A$ C. $A\\cap B$ D. $C_A B$')+p('【答案】A')+p('【解析】按集合定义判断。')+'</w:body></w:document>');
 zip.file('word/_rels/document.xml.rels','<Relationships><Relationship Id="r1" Target="embeddings/one.bin" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject"/></Relationships>');
 zip.file('word/embeddings/one.bin',bytes('x'));
 const h=await startBrowserApp(32164);let calls=0;
 try{
 await h.page.route('**/api/convert/mathtype-mtef',async route=>{calls++;await route.fulfill({contentType:'application/json',body:JSON.stringify({equations:[{id:'r1',ok:true,latex:'\\[x\\]'}]})});});
 const imported=await createImportThroughUi(h.page,{files:[{file:{name:'structured-full.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:await zip.generateAsync({type:'nodebuffer'})},roles:['full']}]});
 const batch=imported.snapshot.batches.find(b=>b.id===imported.batchId),draft=imported.snapshot.drafts.find(d=>d.batchId===batch.id);
 assert.equal(batch.producerMode,'docx-deterministic');assert.equal(batch.status,'review');assert.equal(calls,1);
 assert.match(draft.stem,/\\frac\{x\^\{2\}\+1\}\{x-1\}/);assert.deepEqual(draft.options,['$A=B$','$B\\subseteq A$','$A\\cap B$','$C_A B$']);
 await h.page.locator('.v-review-right .katex').first().waitFor({state:'visible'});
 await h.page.getByRole('button',{name:/分屏编辑/}).click();
 assert.match(await h.page.locator('textarea').filter({visible:true}).first().inputValue(),/A=B/);
 assert.equal(draft.answer,'A');assert.match(draft.solution,/集合定义/);assert.equal(await h.page.locator('#batch-producer-mode').count(),0);assertNoRuntimeErrors(h);
 }finally{await h.close();}
});

test('byte-identical MTEF is translated once while every relationship retains its own evidence',async()=>{
    let count=0;
    const result=await Formula.expand(object('r1')+object('r2'),new Map([['r1',{target:'one'}],['r2',{target:'two'}]]),zipFor({one:bytes('x'),two:bytes('x')}),{translateNative:async rows=>{count=rows.length;return {equations:[{id:rows[0].id,ok:true,latex:'x'}]}}});
    assert.equal(count,1);assert.deepEqual(result.formulas.map(f=>f.rid),['r1','r2']);
    assert.ok(result.formulas.every(f=>f.latex==='x'&&f.engine==='mathtype-native'));
});

test('later native batch failure preserves prior results and item-level failure evidence', async () => {
    const count = 513, ids = Array.from({ length: count }, (_, i) => 'r' + i);
    const sources = Object.fromEntries(ids.map((id, i) => [id, bytes(String(i))]));
    let calls = 0;
    const result = await Formula.expand(ids.map(object).join(''),
        new Map(ids.map(id => [id, { target: id }])), zipFor(sources), {
            translateNative: async rows => {
                calls++;
                if (calls === 2) throw new Error('MATHTYPE_LOCAL_SERVICE_UNAVAILABLE');
                return { equations: rows.map(row => ({ id: row.id, ok: true, latex: '42' })) };
            }
        });
    assert.equal(calls, 2);
    assert.equal(result.formulas[0].engine, 'mathtype-native');
    assert.equal(result.formulas[0].latex, '42');
    assert.equal(result.formulas[512].engine, 'javascript-mtef');
    assert.equal(result.formulas[512].nativeEvidence.code, 'MATHTYPE_LOCAL_SERVICE_UNAVAILABLE');
});

test('missing native items retain diagnostics even when local JavaScript conversion succeeds', async () => {
    const result = await Formula.expand(object('r1'), new Map([['r1', { target: 'one' }]]),
        zipFor({ one: bytes('x') }), { translateNative: async () => ({ equations: [] }) });
    assert.equal(result.formulas[0].latex, 'x');
    assert.equal(result.formulas[0].nativeEvidence.code, 'MATHTYPE_RESPONSE_ITEM_MISSING');
});
