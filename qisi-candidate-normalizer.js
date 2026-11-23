(function initCandidateNormalizer(root) {
    'use strict';

    const cloneValue = value => {
        if (Array.isArray(value)) return value.map(cloneValue);
        if (value && typeof value === 'object') {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, cloneValue(item)])
            );
        }
        return value;
    };

    const freezeValue = value => {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.values(value).forEach(freezeValue);
        return Object.freeze(value);
    };

    const immutable = value => freezeValue(cloneValue(value));

    const createError = code => {
        const error = new Error(code);
        error.code = code;
        return error;
    };

    const assertHelpers = helpers => {
        for (const name of [
            'hasUnescapedLatexCommandInJsonString',
            'escapeLatexBackslashesInJsonCandidate',
            'tryRepairedCandidate'
        ]) {
            if (typeof helpers?.[name] !== 'function') {
                throw createError('CANDIDATE_NORMALIZER_HELPER_UNAVAILABLE');
            }
        }
    };

    const extractQuestions = parsed => {
        if (!parsed) return [];
        if (Array.isArray(parsed)) return parsed;

        const direct = [
            parsed.questions, parsed.items, parsed.题目,
            parsed.questions_list, parsed.questionList, parsed.question_list,
            parsed.data, parsed.result, parsed.output
        ].find(Array.isArray);
        if (direct) return direct;

        return [
            parsed.data?.questions, parsed.data?.items, parsed.data?.题目,
            parsed.data?.questionList, parsed.result?.questions,
            parsed.result?.items, parsed.result?.题目,
            parsed.result?.questionList, parsed.output?.questions,
            parsed.output?.items
        ].find(Array.isArray) || [];
    };

    const stringCandidates = value => {
        const cleaned = String(value || '')
            .trim()
            .replace(/^```(?:json|javascript|js)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
        if (!cleaned) return [];

        const candidates = [cleaned];
        const objectStart = cleaned.indexOf('{');
        const objectEnd = cleaned.lastIndexOf('}');
        if (objectStart >= 0 && objectEnd > objectStart) {
            candidates.push(cleaned.slice(objectStart, objectEnd + 1));
        }
        const arrayStart = cleaned.indexOf('[');
        const arrayEnd = cleaned.lastIndexOf(']');
        if (arrayStart >= 0 && arrayEnd > arrayStart) {
            candidates.push(cleaned.slice(arrayStart, arrayEnd + 1));
        }
        return [...new Set(candidates.map(candidate => candidate.trim()).filter(Boolean))];
    };

    const normalizeCandidates = (candidates = [], helpers = {}) => {
        assertHelpers(helpers);
        const inputs = Array.isArray(candidates) ? candidates : [candidates];
        const rawEvidence = { candidates: inputs };
        const alternatives = inputs.flatMap(candidate =>
            typeof candidate === 'string'
                ? stringCandidates(candidate)
                : (candidate && typeof candidate === 'object' ? [candidate] : [])
        );

        if (!alternatives.length) {
            return immutable({
                ok: false, parsed: null, questions: [], method: 'none',
                reason: 'empty-response', message: '模型返回内容为空', rawEvidence
            });
        }

        let lastParseError = null;
        let parsedWithoutQuestions = null;
        let repairDiagnostics = null;

        for (const candidate of alternatives) {
            if (candidate && typeof candidate === 'object') {
                const parsed = Array.isArray(candidate) ? { questions: candidate } : candidate;
                const questions = extractQuestions(parsed);
                if (questions.length) {
                    return immutable({
                        ok: true, parsed, questions, method: 'object-contract',
                        reason: '', message: '', rawEvidence
                    });
                }
                parsedWithoutQuestions = parsed;
                continue;
            }

            const needsLatexRepair =
                helpers.hasUnescapedLatexCommandInJsonString(candidate);
            const runRepair = () => {
                const attempt = helpers.tryRepairedCandidate({
                    candidate,
                    lastParseError,
                    escapeLatexBackslashesInJsonCandidate:
                        helpers.escapeLatexBackslashesInJsonCandidate,
                    extractQuestionArray: extractQuestions
                });
                if (attempt.repairDiagnostics) repairDiagnostics = attempt.repairDiagnostics;
                if (attempt.parsedWithoutQuestions) {
                    parsedWithoutQuestions = attempt.parsedWithoutQuestions;
                }
                return attempt.result;
            };

            if (needsLatexRepair) {
                const repaired = runRepair();
                if (repaired) return immutable({ ...repaired, rawEvidence });
                lastParseError = new Error(
                    'JSON 字符串内检测到 LaTeX 单反斜杠命令，但修复后仍无法解析。'
                );
                continue;
            }

            try {
                const rawParsed = JSON.parse(candidate);
                const parsed = Array.isArray(rawParsed)
                    ? { questions: rawParsed }
                    : rawParsed;
                const questions = extractQuestions(parsed);
                if (questions.length) {
                    return immutable({
                        ok: true, parsed, questions, method: 'JSON.parse',
                        reason: '', message: '', rawEvidence
                    });
                }
                parsedWithoutQuestions = parsed;
            } catch (error) {
                lastParseError = error;
            }

            const repaired = runRepair();
            if (repaired) return immutable({ ...repaired, rawEvidence });
        }

        if (parsedWithoutQuestions) {
            return immutable({
                ok: false, parsed: parsedWithoutQuestions, questions: [],
                method: 'JSON.parse', reason: 'json-without-questions',
                message: 'JSON 可以解析，但没有找到非空 questions 数组',
                diagnostics: repairDiagnostics, rawEvidence
            });
        }

        return immutable({
            ok: false, parsed: null, questions: [], method: 'none',
            reason: 'invalid-json',
            message: lastParseError?.message || '返回内容不是合法 JSON',
            diagnostics: repairDiagnostics, rawEvidence
        });
    };

    const api = Object.freeze({ normalizeCandidates });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.CandidateNormalizer = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
