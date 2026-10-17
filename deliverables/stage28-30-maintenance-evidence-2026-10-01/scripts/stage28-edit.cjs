const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = 'C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统';
const out = 'C:/Users/Administrator/AppData/Local/Temp/qisi-stage28-maintenance';
const allowed = ['qisi-question-duplicate-policy.js','qisi-library-service.js','qisi-question-index-storage.js','qisi-db.js','qisi-storage-repository.js','qisi-draft-persistence-service.js','main.html','architecture/runtime-modules.json','architecture/layers.json','docs/architecture/owners.json','docs/architecture/layers.json','tests/question-duplicate-policy.test.js','tests/draft-stats-transaction.test.js','tests/question-index-transaction.test.js'];
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'TASK.md'), `# Stages 28–30: three authorized offline maintenance objectives\nUser explicitly selected other batch mutation safety, formal full-scan performance, and fingerprint collisions, postponing Shenzhen. No subagents.\nSource baseline e522a7098e6fa3373c8fd4cb6c3851d528322d13; desktop baseline 21ac97fb005fd78c215a6fcd916acc4bf61f0493.\nAllowed files: ${allowed.join(', ')}; final existing ai/DESKTOP_AUDIT_RECHECK_2026-09-30.md and desktop mirror/evidence. main.html permits new module load and cache tokens only; qisi-db.js permits schema module glue only.\nForbidden: E runtime, app.js, dependencies/lock/vendor, production DB/profile/uploads/backups/.env, original audit and Qwen ledgers. v9 migration only exercised in isolated fixture DB. No real AI calls, no ledger resets.\nRequired: native race/rollback/index upgrade and mutation/legacy tests, verify:safe, batch-safety, scope/runtime/architecture, native full workflow comparison, write and upgrade cost, verified backed-up desktop sync and actual desktop acceptance.\nStop: unrelated diffs, unexplained gate failure, unauthorized data access, completed selected objectives. User's explicit three objectives override stale C8A and do-not-next-stage restriction within this scoped task.\n`);
function edit(name, work) {
 assert(allowed.includes(name)); const file=path.join(root,name), exists=fs.existsSync(file), before=exists?fs.readFileSync(file,'utf8'):'';
 const backup=path.join(out,'source-before',name); assert(!fs.existsSync(backup),'already edited '+name);
 if(exists){fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,before);}
 const result=work(before.replace(/\r\n/g,'\n')); fs.writeFileSync(file, result.replace(/\n/g,before.includes('\r\n')?'\r\n':'\n'));
}
function replace(s,a,b){assert.equal(s.split(a).length,2,a.slice(0,80));return s.replace(a,b);}
edit('qisi-question-duplicate-policy.js',s=>replace(s,`        const options = Array.isArray(question?.options)
            ? question.options.map(normalizeText).join('|')
            : '';
        return \`\${stem}__\${options}\`;`,`        const options = Array.isArray(question?.options)
            ? question.options.map(normalizeText)
            : [];
        return 'qisi-core-v2:' + JSON.stringify([stem, options]);`));
edit('qisi-library-service.js',s=>replace(s,`        return \`\${normalize(question?.stem)}__\${(question?.options || [])
            .map(normalize).join('|')}\`;`,`        const stem = normalize(question?.stem);
        const options = (question?.options || []).map(normalize);
        return !stem && !options.length ? ''
            : 'qisi-library-core-v2:' + JSON.stringify([stem, options]);`));
edit('qisi-question-index-storage.js',()=>`(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.QuestionIndexStorage = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // These are derived fields, never trusted imported fingerprints.
    const fieldsFor = (question, policy) => ({
        duplicateCoreV2: question.deletedAt ? undefined : policy.canonicalCoreFingerprint(question),
        duplicateStemV2: question.deletedAt ? undefined : policy.canonicalStemFingerprint(question),
        formalRequestId: question.deletedAt ? undefined : (question.admission?.requestId || undefined),
        formalIdempotencyKey: question.deletedAt ? undefined : (question.admission?.idempotencyKey || undefined)
    });
    const configure = (database, { policy }) => {
        database.version(9).stores({
            questions: 'id, grade, type, diff, knowledge, knowledgeType, systemKnowledge, personalKnowledge, createdAt, duplicateCoreV2, duplicateStemV2, formalRequestId, formalIdempotencyKey',
            draftQuestions: 'id, batchId, order, questionNumber, status, duplicateStatus, selected, createdAt, [batchId+status]'
        }).upgrade(transaction => transaction.table('questions').toCollection().modify(question => {
            Object.assign(question, fieldsFor(question, policy));
        }));
        const table = database.table('questions');
        table.hook('creating', (_key, question) => {
            Object.assign(question, fieldsFor(question, policy));
        });
        table.hook('updating', (changes, _key, original) => {
            // Clone only indexed inputs; long solutions and binary evidence are untouched.
            const next = { stem: original.stem, options: Array.isArray(original.options) ? [...original.options] : original.options,
                deletedAt: original.deletedAt, admission: { ...original.admission } };
            for (const [key, value] of Object.entries(changes)) {
                if (/^(stem|options|deletedAt|admission)(\\.|$)/.test(key)) {
                    database.constructor.setByKeyPath(next, key, value);
                }
            }
            return fieldsFor(next, policy);
        });
        return database;
    };
    return Object.freeze({ configure });
});
`);
edit('qisi-db.js',s=>replace(s,`        const getQuestionKnowledge = (q, type) => {`,`        window.Qisi.QuestionIndexStorage.configure(db, {
            policy: window.Qisi.QuestionDuplicatePolicy
        });

        const getQuestionKnowledge = (q, type) => {`));
edit('qisi-storage-repository.js',s=>{
 s=replace(s,`        const deleteDraftBatch = batchId => transaction(`,`        const deleteDraftBatch = (batchId, { expectedVersion, signal } = {}) => transaction(`);
 s=replace(s,`                await table('draftImportBatches').delete(batchId);`,`                const assertActive = () => {
                    if (signal?.aborted) throw Object.assign(new Error('DRAFT_PERSISTENCE_CANCELLED'), { name: 'AbortError' });
                };
                assertActive();
                const current = await table('draftImportBatches').get(batchId);
                const actualVersion = current?.draftPersistence?.version || 0;
                if (Number.isInteger(expectedVersion) && actualVersion !== expectedVersion) {
                    throw new StorageRepositoryError('version-mismatch', 'Draft batch persistence version changed.',
                        { batchId, expectedVersion, actualVersion });
                }
                await table('draftImportBatches').delete(batchId);
                assertActive();`);
 s=replace(s,`                        .equals(batchId)
                        .delete();
                }
            }
        );`,`                        .equals(batchId)
                        .delete();
                    assertActive();
                }
            }
        );`);
 s=replace(s,`                    const existingQuestions = await questionTable.toArray();
                    const conflictingRequest = existingQuestions.find(question =>
                        !question?.deletedAt &&
                        (
                            question?.admission?.requestId === requestId ||
                            question?.admission?.idempotencyKey === idempotencyKey
                        ) &&
                        question?.admission?.draftId !== id
                    );`,`                    const indexed = ['duplicateCoreV2', 'duplicateStemV2', 'formalRequestId', 'formalIdempotencyKey']
                        .every(key => questionTable.schema?.idxByName?.[key]) &&
                        typeof duplicatePolicy.canonicalCoreFingerprint === 'function' &&
                        typeof duplicatePolicy.canonicalStemFingerprint === 'function';
                    let existingQuestions, conflictingRequest;
                    if (indexed) {
                        const requestMatches = await questionTable.where('formalRequestId').equals(requestId)
                            .filter(question => question.admission?.draftId !== id).first();
                        const keyMatches = await questionTable.where('formalIdempotencyKey').equals(idempotencyKey)
                            .filter(question => question.admission?.draftId !== id).first();
                        conflictingRequest = [requestMatches, keyMatches].filter(Boolean)
                            .sort((left, right) => database.constructor.cmp(left.id, right.id))[0];
                        const exact = await questionTable.where('duplicateCoreV2')
                            .equals(duplicatePolicy.canonicalCoreFingerprint(fresh)).first();
                        const stem = duplicatePolicy.canonicalStemFingerprint(fresh);
                        const similar = !exact && stem ? await questionTable.where('duplicateStemV2').equals(stem).first() : null;
                        existingQuestions = exact ? [exact] : similar ? [similar] : [];
                    } else {
                        // Older repository ports/schemas retain the same transaction-local scan.
                        existingQuestions = await questionTable.toArray();
                        conflictingRequest = existingQuestions.find(question => !question?.deletedAt &&
                            (question?.admission?.requestId === requestId || question?.admission?.idempotencyKey === idempotencyKey) &&
                            question?.admission?.draftId !== id);
                    }`);
 s=replace(s,`                        const drafts = await draftTable
                            .where('batchId')
                            .equals(fresh.batchId)
                            .toArray();
                        const submittedCount = drafts.filter(
                            item => item.status === 'submitted'
                        ).length;
                        await batchTable.update(fresh.batchId, {
                            submittedCount,
                            updatedAt: clockValue,
                            lastAdmissionDecisionId: evaluated.decisionId
                        });`,`                        const submittedCount = draftTable.schema?.idxByName?.['[batchId+status]']
                            ? await draftTable.where('[batchId+status]').equals([fresh.batchId, 'submitted']).count()
                            : (await draftTable.where('batchId').equals(fresh.batchId).toArray())
                                .filter(item => item.status === 'submitted').length;
                        const batch = await batchTable.get(fresh.batchId);
                        const batchVersion = batch?.draftPersistence?.version || 0;
                        await batchTable.update(fresh.batchId, {
                            submittedCount,
                            updatedAt: clockValue,
                            lastAdmissionDecisionId: evaluated.decisionId,
                            draftPersistence: { ...batch?.draftPersistence, version: batchVersion + 1,
                                idempotencyKey: 'formal-commit:' + idempotencyKey,
                                signature: JSON.stringify([id, formalId, actualVersion + 1]) }
                        });`);
 return s;
});
edit('qisi-draft-persistence-service.js',s=>{
 s=replace(s,`                await repository.deleteDraftBatch(batchId);`,`                assertActive(options.signal);
                await repository.deleteDraftBatch(batchId, {
                    expectedVersion: currentVersion(existing), signal: options.signal
                });`);
 return replace(s,`                rethrowOrWrap(error, 'DRAFT_PERSISTENCE_DELETE_FAILED');`,`                assertActive(options.signal);
                rethrowOrWrap(error, 'DRAFT_PERSISTENCE_DELETE_FAILED');`);
});
edit('main.html',s=>{
 s=replace(s,`    <script src="./qisi-question-duplicate-policy.js?v=duplicate-single-pass-01"></script>`,`    <script src="./qisi-question-duplicate-policy.js?v=tuple-index-v2-01"></script>
    <script src="./qisi-question-index-storage.js?v=tuple-index-v2-01"></script>`);
 for(const file of ['qisi-db.js','qisi-library-service.js','qisi-storage-repository.js','qisi-draft-persistence-service.js']) {
  const re=new RegExp('('+file.replace(/\./g,'\\.')+'\\?v=)[^"\\s]+','g'); assert.equal([...s.matchAll(re)].length,1); s=s.replace(re,'$1tuple-index-v2-01');
 }
 return s;
});
edit('architecture/runtime-modules.json',s=>replace(s,`    {
      "file": "qisi-question-image-policy.js",`,`    {
      "file": "qisi-question-index-storage.js",
      "runtime": "browser"
    },
    {
      "file": "qisi-question-image-policy.js",`));
edit('architecture/layers.json',s=>replace(s,`      "id": "formal-admission", "file": "qisi-formal-admission-policy.js",`,`      "id": "question-index-storage", "file": "qisi-question-index-storage.js",
      "layer": 1, "domainOwner": "questionIndexStorageOwner",
      "publicApi": ["configure"], "allowedDependencies": ["question-duplicate-policy"],
      "forbiddenDependencies": ["app-shell"], "status": "production-wired"
    },
    {
      "id": "formal-admission", "file": "qisi-formal-admission-policy.js",`));
edit('docs/architecture/owners.json',s=>{
 s=replace(s,`      "ownerId": "formal-admission", "module": "qisi-formal-admission-policy.js",`,`      "ownerId": "question-index-storage", "module": "qisi-question-index-storage.js", "layer": 1,
      "responsibilities": ["atomic-derived-question-index-maintenance"],
      "allowedCallers": [], "allowedDependencies": ["question-duplicate-policy"],
      "forbiddenDependencies": ["ui-shell"], "productionEntry": true,
      "writeAuthority": "derived-index-fields-only", "status": "production"
    },
    {
      "ownerId": "formal-admission", "module": "qisi-formal-admission-policy.js",`);
 return replace(s,`"allowedCallers": ["question-repository"], "allowedDependencies": [],`,`"allowedCallers": ["question-repository", "question-index-storage"], "allowedDependencies": [],`);
});
edit('docs/architecture/layers.json',s=>replace(s,`"formal-admission", "question-repository", "support-aligner",`,`"formal-admission", "question-repository", "question-index-storage", "support-aligner",`));
edit('tests/question-duplicate-policy.test.js',s=>{
 s=s.replace('and legacy delimiters','and collision-free tuple delimiters');
 s=s.replace('// Legacy concatenation may collide across stem/options; retain its behavior in this optimization.','// Distinct normalized tuples must not match through legacy separator collisions.');
 s=replace(s,'assert.equal(collision.code, Policy.DECISIONS.EXACT);','assert.equal(collision.code, Policy.DECISIONS.NONE);');
 return s+`\ntest('tuple fingerprints preserve option boundaries and ignore old exported keys', () => {
    const pairs = [
        [{ stem: 'a__b', options: [] }, { stem: 'a', options: ['b__'] }],
        [{ stem: 's', options: ['A|B', 'C'] }, { stem: 's', options: ['A', 'B|C'] }],
        [{ stem: 's', options: [] }, { stem: 's', options: [''] }]
    ];
    for (const [left, right] of pairs) {
        assert.notEqual(Policy.canonicalCoreFingerprint(left), Policy.canonicalCoreFingerprint(right));
        assert.notEqual(Policy.evaluate({ candidate: { ...left, exportFingerprint: 'legacy__same' },
            existingQuestions: [{ ...right, id: 'old-export', exportFingerprint: 'legacy__same' }] }).code, Policy.DECISIONS.EXACT);
    }
    assert.equal(Policy.canonicalCoreFingerprint(question()), Policy.canonicalCoreFingerprint(question({ stem: ' FIND $x$。 ' })));
});\n`;
});
edit('tests/draft-stats-transaction.test.js',s=>replace(s,'assert.equal(result.secondVersion, 2);','assert.equal(result.secondVersion, 3); // stats + formal commit + stats each advance the batch.'));
fs.writeFileSync(path.join(out,'allowed.json'),JSON.stringify(allowed,null,2));
console.log(JSON.stringify({edited:allowed.length-1,out}));
