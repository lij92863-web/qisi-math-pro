const test=require('node:test'),assert=require('node:assert/strict');
const {traceStep,caseFailure,closeTrace}=require('../scripts/golden/run.cjs');

test('a failed replay step preserves its error and stage and never retries the operation',async()=>{
    const trace=[],original=Object.freeze(Object.assign(new Error('execution context lost'),{code:'FIXTURE_CONTEXT_LOST'}));
    let calls=0,caught;
    try{await traceStep(trace,'draft-readback',async()=>{calls++;throw original;});}catch(error){caught=error;}
    assert.equal(calls,1);assert.equal(caught,original);
    const result=caseFailure('fixture-case',caught);
    assert.equal(result.ok,false);assert.equal(result.failureStage,'draft-readback');
    assert.equal(result.error,'execution context lost');assert.match(result.errorStack,/execution context lost/);
    assert.deepEqual(result.stepTrace.map(step=>[step.stage,step.status]),[['draft-readback','failed']]);
    assert.ok(result.stepTrace[0].durationMs>=0);assert.equal(result.counts,undefined);
});

test('successful steps preserve exact values and a later failure retains prior successful evidence',async()=>{
    const trace=[],value={drafts:['untouched']};
    assert.equal(await traceStep(trace,'import',()=>value),value);
    const original=new Error('fixture rejection');
    await assert.rejects(traceStep(trace,'reload',()=>Promise.reject(original)),error=>error===original);
    const result=caseFailure('fixture-case',original);
    assert.deepEqual(result.stepTrace.map(step=>[step.stage,step.status]),[['import','passed'],['reload','failed']]);
    assert.equal(result.failureStage,'reload');assert.deepEqual(value,{drafts:['untouched']});
});

test('unclassified failures remain explicit and contain no manufactured success metrics',()=>{
    const result=caseFailure('fixture-case',new Error('startup failed'));
    assert.equal(result.failureStage,'unknown');assert.equal(result.ok,false);
    assert.deepEqual(result.stepTrace,[]);assert.equal(result.counts,undefined);
});

test('cleanup failure cannot replace the original replay failure',async()=>{
    const trace=[],original=Object.freeze(new Error('readback failed'));
    await assert.rejects(traceStep(trace,'draft-readback',()=>{throw original;}),error=>error===original);
    let cleanupCalls=0;
    await closeTrace(trace,()=>{cleanupCalls++;throw new Error('close failed');},original);
    const result=caseFailure('fixture-case',original);
    assert.equal(cleanupCalls,1);assert.equal(result.error,'readback failed');
    assert.equal(result.failureStage,'draft-readback');assert.equal(result.cleanupError,'close failed');
    assert.deepEqual(result.stepTrace.map(step=>step.status),['failed','failed']);
});

test('cleanup failure after a successful operation still fails the case',async()=>{
    const trace=[],cleanup=new Error('close failed');
    await traceStep(trace,'ui-import',()=>({ok:true}));
    await assert.rejects(closeTrace(trace,()=>{throw cleanup;}),error=>error===cleanup);
    const result=caseFailure('fixture-case',cleanup);
    assert.equal(result.ok,false);assert.equal(result.failureStage,'browser-close');
    assert.deepEqual(result.stepTrace.map(step=>step.status),['passed','failed']);
});
