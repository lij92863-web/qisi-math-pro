(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.QuestionDuplicatePolicy = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const DECISIONS = Object.freeze({
        NONE: 'DUPLICATE_NONE',
        EXACT: 'DUPLICATE_EXACT',
        SIMILAR: 'DUPLICATE_SIMILAR',
        ANSWER_CONFLICT: 'DUPLICATE_ANSWER_CONFLICT'
    });

    const clone = value => {
        if (Array.isArray(value)) return value.map(clone);
        if (value && typeof value === 'object') {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, clone(item)])
            );
        }
        return value;
    };
    const freeze = value => {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
            return value;
        }
        Object.values(value).forEach(freeze);
        return Object.freeze(value);
    };
    const immutable = value => freeze(clone(value));
    const normalizeText = value => String(value || '')
        .replace(/\\left|\\right/g, '')
        .replace(/\s+/g, '')
        .replace(/[，。；：、,.．]/g, '')
        .replace(/[（）]/g, token => token === '（' ? '(' : ')')
        .replace(/[Ａ-Ｄ]/g, token =>
            String.fromCharCode(token.charCodeAt(0) - 65248)
        )
        .toLowerCase();
    const canonicalStemFingerprint = question =>
        normalizeText(question?.stem || '');
    const canonicalCoreFingerprint = question => {
        const stem = canonicalStemFingerprint(question);
        const options = Array.isArray(question?.options)
            ? question.options.map(normalizeText).join('|')
            : '';
        return `${stem}__${options}`;
    };
    const canonicalAnswer = question => normalizeText(question?.answer || '');

    const evaluate = ({ candidate, existingQuestions = [] } = {}) => {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
            const error = new TypeError('Duplicate candidate is required.');
            error.code = 'DUPLICATE_POLICY_INPUT_INVALID';
            throw error;
        }
        if (!Array.isArray(existingQuestions)) {
            const error = new TypeError('Existing questions must be an array.');
            error.code = 'DUPLICATE_POLICY_INPUT_INVALID';
            throw error;
        }
        const active = existingQuestions.filter(question =>
            question && typeof question === 'object' && !question.deletedAt
        );
        const coreFingerprint = canonicalCoreFingerprint(candidate);
        const stemFingerprint = canonicalStemFingerprint(candidate);
        const exact = active.find(question =>
            canonicalCoreFingerprint(question) === coreFingerprint
        );
        let code = DECISIONS.NONE;
        let match = null;
        if (exact) {
            const candidateAnswer = canonicalAnswer(candidate);
            const existingAnswer = canonicalAnswer(exact);
            code = candidateAnswer && existingAnswer &&
                candidateAnswer !== existingAnswer
                ? DECISIONS.ANSWER_CONFLICT
                : DECISIONS.EXACT;
            match = exact;
        } else if (stemFingerprint) {
            match = active.find(question =>
                canonicalStemFingerprint(question) === stemFingerprint
            ) || null;
            if (match) code = DECISIONS.SIMILAR;
        }
        return immutable({
            schemaVersion: 'qisi.question-duplicate-decision.r1',
            code,
            accepted: code === DECISIONS.NONE,
            matchedQuestionId: String(match?.id || ''),
            coreFingerprint,
            stemFingerprint
        });
    };

    return Object.freeze({
        DECISIONS,
        normalizeText,
        canonicalCoreFingerprint,
        canonicalStemFingerprint,
        evaluate
    });
});
