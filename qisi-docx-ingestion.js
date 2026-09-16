(function (root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.DocxIngestion = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const number = item => String(item?.questionNumber || item?.question || '');
    const markImageGaps = draft => {
        const fields = ['stem', 'options', 'answer', 'solution'];
        const affected = fields.filter(field => /\[\[IMAGE_UNRESOLVED:/.test(JSON.stringify(draft[field] || '')));
        if (!affected.length) return draft;
        draft.withheld = true;
        draft.withheldReason = draft.withheldReason || 'unresolved-image';
        draft.fieldProvenance = { ...(draft.fieldProvenance || {}) };
        for (const field of affected) draft.fieldProvenance[field] = {
            field, status: 'rejected', reasonCode: 'unresolved-image'
        };
        draft.warnings = [...new Set([...(draft.warnings || []), '原文中的部分图形暂不支持显示，已保留位置并暂缓入库，请对照原件补全。'])];
        return draft;
    };
    const ingest = async ({ file, questionRole, supportRole, fullRole, expectedNumbers = [], helpers }) => {
        const context = await root.Qisi.IngestionContext.getDocx(file);
        const { trace } = context;
        const text = await trace.measure('text-math-media', () => helpers.extractText(file));
        const lines = text.split('\n');
        // One rule decides what an answer-key heading is (qisi-utils), so the question text, the key
        // reader and the skeleton can never disagree about where the key starts.
        const supportHeading = lines.findIndex((line, index) =>
            root.Qisi.Utils.isAnswerKeyHeadingLine(line) &&
            root.Qisi.Utils.collectQuestionEvidenceMarkers(lines.slice(0, index).join('\n')).length > 0);
        const questionText = supportHeading >= 0 ? lines.slice(0, supportHeading).join('\n') : text;
        const supportText = supportHeading >= 0 ? lines.slice(supportHeading).join('\n') : text;
        const skeleton = questionRole
            ? await trace.measure('skeleton', () => helpers.extractSkeleton(file)) : null;
        const questions = questionRole
            ? await trace.measure('questions', () => helpers.parseQuestions(questionText, file, fullRole)) : [];
        // Never synthesize identity from the array position. Duplicate identities stay visible
        // to the shared merge/coverage gate; support outside a proved contract is withheld.
        const expected = new Set((skeleton?.authoritative ? skeleton.questionNumbers : expectedNumbers).map(String));
        const parsed = (supportRole || fullRole)
            ? await trace.measure('support', () => helpers.parseSupport(supportText, file))
            : { answers: [], solutions: [] };
        const unmatched = [];
        const keyValues = new Map();
        for (const entry of root.Qisi.Utils.extractInlineAnswerKey(supportText)) {
            const values = keyValues.get(entry.questionNumber) || new Set();
            values.add(entry.answer);
            keyValues.set(entry.questionNumber, values);
        }
        const filter = (rows, field) => (rows || []).filter(item => {
            const conflicting = field === 'answer' && keyValues.get(number(item))?.size > 1;
            const accepted = expected.has(number(item)) && !conflicting;
            if (!accepted) unmatched.push({ ...item, field,
                reason: conflicting ? 'conflicting-explicit-answers' : 'unproved-question-identity',
                evidence: conflicting ? [...keyValues.get(number(item))] : [] });
            return accepted;
        });
        const answers = filter(parsed.answers, 'answer');
        const solutions = filter(parsed.solutions, 'solution');
        return { questions, answers, solutions, skeleton, unmatched, timings: trace.stages };
    };
    return { ingest, markImageGaps };
});
