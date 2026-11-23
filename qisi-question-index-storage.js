(function (root, factory) {
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
        const questionIndexes = 'id, grade, type, diff, knowledge, knowledgeType, systemKnowledge, personalKnowledge, createdAt, duplicateCoreV2, duplicateStemV2, formalRequestId, formalIdempotencyKey';
        const repair = transaction => transaction.table('questions').toCollection().modify(question => {
            const expected = fieldsFor(question, policy);
            let changed = false;
            for (const [field, value] of Object.entries(expected)) {
                if (value === undefined) {
                    if (!Object.prototype.hasOwnProperty.call(question, field)) continue;
                    delete question[field];
                } else {
                    if (question[field] === value) continue;
                    question[field] = value;
                }
                changed = true;
            }
            // Dexie skips the write when a modify callback returns false.
            if (!changed) return false;
        });
        database.version(9).stores({
            questions: questionIndexes,
            draftQuestions: 'id, batchId, order, questionNumber, status, duplicateStatus, selected, createdAt, [batchId+status]'
        });
        const knowledgeIndexes = questionIndexes + ', meta.personalKnowledge, meta.knowledge';
        database.version(10).stores({ questions: knowledgeIndexes });
        // One repair covers both pre-index databases and writes under v10,
        // which rebuilt the table handles after the hooks were installed.
        database.version(11).stores({ questions: knowledgeIndexes }).upgrade(repair);
        // Register after the final stores() call, which recreates Dexie's tables.
        const table = database.table('questions');
        table.hook('creating', (_key, question) => {
            Object.assign(question, fieldsFor(question, policy));
        });
        table.hook('updating', (changes, _key, original) => {
            const indexed = /^(stem|options|deletedAt|admission)(\.|$)/;
            const derived = /^(duplicateCoreV2|duplicateStemV2|formalRequestId|formalIdempotencyKey)(\.|$)/;
            if (!Object.keys(changes).some(key => indexed.test(key) || derived.test(key))) return;
            // Clone only indexed inputs; long solutions and binary evidence are untouched.
            const next = { stem: original.stem, options: Array.isArray(original.options) ? [...original.options] : original.options,
                deletedAt: original.deletedAt, admission: { ...original.admission } };
            for (const [key, value] of Object.entries(changes)) {
                if (indexed.test(key)) {
                    database.constructor.setByKeyPath(next, key, value);
                }
            }
            return fieldsFor(next, policy);
        });
        return database;
    };
    return Object.freeze({ configure });
});
