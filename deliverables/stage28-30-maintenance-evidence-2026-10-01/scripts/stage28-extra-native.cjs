const fs=require('node:fs'),path=require('node:path');
const root='C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统';
const file=path.join(root,'tests/question-index-transaction.test.js');
const s=fs.readFileSync(file,'utf8'); if(s.includes('failed native index upgrade'))throw new Error('already appended');
fs.writeFileSync(file,s+`\ntest('failed native index upgrade keeps the complete v8 database and can retry', { timeout: 30000 }, async () => {
    const result = await runNative(page => page.evaluate(async () => {
        const old = await openFixture(false);
        const original = { id: 'legacy-upgrade', stem: 'legacy', options: ['A'], rawText: 'preserve evidence' };
        await old.questions.put(original); old.close();
        const failed = new Dexie('isolated-index-maintenance'); failed.version(8).stores(schema);
        Qisi.QuestionIndexStorage.configure(failed, { policy: { ...Qisi.QuestionDuplicatePolicy,
            canonicalCoreFingerprint: () => { throw new Error('fixture upgrade failure'); } } });
        let failure;
        try { await failed.open(); } catch (_) { failure = true; } finally { failed.close(); }
        const untouched = await openFixture(false);
        const oldVersion = untouched.verno, oldRecord = await untouched.questions.get(original.id);
        untouched.close(); const upgraded = await openFixture();
        try { return { failure, oldVersion, oldRecord, original, newVersion: upgraded.verno,
            key: (await upgraded.questions.get(original.id)).duplicateCoreV2,
            expectedKey: Qisi.QuestionDuplicatePolicy.canonicalCoreFingerprint(original) }; }
        finally { upgraded.close(); await Dexie.delete('isolated-index-maintenance'); }
    }));
    assert.equal(result.failure, true); assert.equal(result.oldVersion, 8); assert.deepEqual(result.oldRecord, result.original);
    assert.equal(result.newVersion, 9); assert.equal(result.key, result.expectedKey);
});\n`);
