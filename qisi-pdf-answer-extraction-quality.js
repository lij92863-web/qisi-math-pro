(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.PdfAnswerExtractionQuality = api;

    if (
        typeof module !== 'undefined' &&
        module.exports
    ) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,
    function () {
        'use strict';

        const SAFE_LATEX_COMMAND_ALLOWLIST = new Set([
            'text', 'mathrm', 'mathbf', 'mathit', 'mathsf', 'texttt',
            'textrm', 'textsf', 'textup', 'textnormal',
            'textbf', 'textit', 'emph'
        ]);

        const DIRTY_COMMAND_PATTERNS = [
            'frac', 'sqrt', 'sin', 'cos', 'tan', 'log', 'ln',
            'sum', 'int', 'lim', 'overline', 'underline',
            'vec', 'bar', 'hat', 'dot', 'angle', 'triangle',
            'cdot', 'times', 'boxed'
        ];

        const CLEAN_LABEL_PATTERNS = [
            /^[A-Fa-f]$/,
            /^[（(]\s*[A-Fa-f]\s*[)）]$/,
            /^\{\s*[A-Fa-f]\s*\}$/,
            /^(?:答案|答|选)\s*[:：]?\s*[A-Fa-f]$/,
            /^[A-Fa-f][.。]\s*$/
        ];

        const DIRTY_SHELL_PATTERNS = [
            /^[A-Za-z]_\s*[A-Za-z0-9\\]/,
            /^[\}_]\s*[A-Za-z]?\s*_\s*\\/,
            /\\frac/,
            /\\sqrt/,
            /\\boxed/,
            /\\angle\s*[A-Za-z]/,
            /\\(?:sin|cos|tan)\s*[A-Za-z{]/,
            /[A-Za-z]\s*[+\-=]\s*[A-Za-z0-9]/,
            /^[A-Za-z]{2,}$/
        ];

        const isValidLabel = (label, allowedLabels) => {
            if (!allowedLabels || !allowedLabels.length) return true;

            const upper =
                String(label || '').toUpperCase();

            return allowedLabels.some(
                allowed => String(allowed || '').toUpperCase() === upper
            );
        };

        const normalizeComparableMathText = value =>
            String(value || '')
                .replace(/\s+/g, '')
                .replace(/[，。；：、]/g, '')
                .replace(/−|－/g, '-')
                .replace(/（/g, '(')
                .replace(/）/g, ')')
                .replace(/^\{|\}$/g, '')
                .toLowerCase();

        const isSafeLatexWrapper = value => {
            const text =
                String(value ?? '').trim();

            if (!text.startsWith('\\')) return false;

            const commandMatch =
                text.match(/^\\([A-Za-z]+)\s*\{([^}]*)\}\s*$/);

            if (!commandMatch) return false;

            const command =
                commandMatch[1];
            const commandLower =
                command.toLowerCase();
            const inner =
                commandMatch[2].trim();

            if (!/^[A-Fa-f]$/.test(inner)) return false;

            if (
                DIRTY_COMMAND_PATTERNS.some(pattern =>
                    pattern === commandLower
                )
            ) return false;

            if (command.length === 1) {
                return true;
            }

            if (SAFE_LATEX_COMMAND_ALLOWLIST.has(commandLower)) {
                return true;
            }

            return false;
        };

        const unwrapSafeLatexWrapper = value => {
            if (!isSafeLatexWrapper(value)) return null;

            const inner =
                String(value)
                    .match(/\{([^}]*)\}/)[1]
                    .trim();

            return inner.toUpperCase();
        };

        const isCleanLabelCandidate = value => {
            const text =
                String(value ?? '').trim();

            if (!text) return { pass: false, reason: 'empty' };

            for (const pattern of CLEAN_LABEL_PATTERNS) {
                if (pattern.test(text)) {
                    return { pass: true, reason: 'clean-label-pattern' };
                }
            }

            return { pass: false, reason: 'no-pattern-match' };
        };

        const extractCleanLabel = value => {
            const text =
                String(value ?? '').trim();

            return text
                .replace(/[^A-Fa-f]/g, '')
                .toUpperCase()
                .slice(0, 1) || '';
        };

        const isDirtyStructuralShell = value => {
            const text =
                String(value ?? '').trim();

            if (!text) {
                return { dirty: true, reasonCode: 'empty' };
            }

            if (text.length > 40) {
                return { dirty: true, reasonCode: 'too-long-likely-mixed-content' };
            }

            for (const pattern of DIRTY_SHELL_PATTERNS) {
                if (pattern.test(text)) {
                    return { dirty: true, reasonCode: 'dirty-structural-shell' };
                }
            }

            const compact =
                normalizeComparableMathText(text);

            if (
                /[+\-=×÷<>]/.test(compact) &&
                !/^[A-Fa-f]$/.test(text)
            ) {
                return { dirty: true, reasonCode: 'math-expression' };
            }

            return { dirty: false, reasonCode: '' };
        };

        const classifyAnswerExtractionQuality = (
            rawAnswer,
            options = {}
        ) => {
            const {
                allowedLabels = [],
                maxLength = 40
            } = options;

            const text =
                String(rawAnswer ?? '').trim();

            if (!text) {
                return {
                    original: rawAnswer,
                    status: 'empty',
                    normalizedCandidate: null,
                    reasonCode: 'empty',
                    reasonDetail: 'Answer text is empty.',
                    evidenceLevel: 'candidate-only',
                    canDirectlyAccept: false
                };
            }

            if (text.length > maxLength) {
                return {
                    original: rawAnswer,
                    status: 'rejected',
                    normalizedCandidate: null,
                    reasonCode: 'too-long',
                    reasonDetail: `Answer text exceeds ${maxLength} characters; likely mixed answer and solution content.`,
                    evidenceLevel: 'candidate-only',
                    canDirectlyAccept: false
                };
            }

            const cleanCheck =
                isCleanLabelCandidate(text);

            if (cleanCheck.pass) {
                const label =
                    extractCleanLabel(text);

                return {
                    original: rawAnswer,
                    status: 'clean-label',
                    normalizedCandidate: label,
                    reasonCode: cleanCheck.reason,
                    reasonDetail: `Answer matches a clean label pattern and extracts to '${label}'.`,
                    evidenceLevel: 'candidate-only',
                    canDirectlyAccept: false
                };
            }

            if (isSafeLatexWrapper(text)) {
                const unwrapped =
                    unwrapSafeLatexWrapper(text);

                if (
                    unwrapped &&
                    isValidLabel(unwrapped, allowedLabels)
                ) {
                    return {
                        original: rawAnswer,
                        status: 'safe-wrapper-candidate',
                        normalizedCandidate: unwrapped,
                        reasonCode: 'safe-latex-wrapper',
                        reasonDetail: `Safe LaTeX command wrapper with single A-F label '${unwrapped}' inside.`,
                        evidenceLevel: 'candidate-only',
                        canDirectlyAccept: false
                    };
                }

                return {
                    original: rawAnswer,
                    status: 'rejected',
                    normalizedCandidate: null,
                    reasonCode: 'wrapper-label-invalid',
                    reasonDetail: `LaTeX wrapper detected but inner label is not in the allowed set.`,
                    evidenceLevel: 'candidate-only',
                    canDirectlyAccept: false
                };
            }

            const dirtyCheck =
                isDirtyStructuralShell(text);

            if (dirtyCheck.dirty) {
                return {
                    original: rawAnswer,
                    status: 'dirty-structural-shell',
                    normalizedCandidate: null,
                    reasonCode: dirtyCheck.reasonCode,
                    reasonDetail: `Answer text matches a dirty or unsafe structural pattern. Cannot be safely unwrapped to a clean label. Requires answer-only extraction.`,
                    evidenceLevel: 'candidate-only',
                    canDirectlyAccept: false
                };
            }

            return {
                original: rawAnswer,
                status: 'rejected',
                normalizedCandidate: null,
                reasonCode: 'unknown-format',
                reasonDetail: 'Answer text does not match any known clean or dirty pattern.',
                evidenceLevel: 'candidate-only',
                canDirectlyAccept: false
            };
        };

        return {
            classifyAnswerExtractionQuality,
            isSafeLatexWrapper,
            isDirtyStructuralShell,
            isCleanLabelCandidate,
            unwrapSafeLatexWrapper,
            extractCleanLabel
        };
    }
);
