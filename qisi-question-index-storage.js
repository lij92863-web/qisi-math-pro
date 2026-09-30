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
                if (/^(stem|options|deletedAt|admission)(\.|$)/.test(key)) {
                    database.constructor.setByKeyPath(next, key, value);
                }
            }
            return fieldsFor(next, policy);
        });
        return database;
    };
    return Object.freeze({ configure });
});
