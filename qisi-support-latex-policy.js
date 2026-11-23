(function initSupportLatexPolicy(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.SupportLatexPolicy = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    function createSupportLatexPolicy(ports = {}) {
        if (typeof ports.repairCommonLatexOcrErrors !== 'function') {
            const error = new TypeError(
                'Support LaTeX policy requires repairCommonLatexOcrErrors.'
            );
            error.code = 'SUPPORT_LATEX_POLICY_PORT_REQUIRED';
            throw error;
        }
        const repairCommonLatexOcrErrors =
            ports.repairCommonLatexOcrErrors;

        const hasBalancedSupportLatexBraces = (
            source = ''
        ) => {
            const text = String(source || '');
            let depth = 0;

            for (
                let index = 0;
                index < text.length;
                index += 1
            ) {
                const char = text[index];

                if (
                    char !== '{' &&
                    char !== '}'
                ) {
                    continue;
                }

                let slashCount = 0;

                for (
                    let cursor = index - 1;
                    cursor >= 0 &&
                    text[cursor] === '\\';
                    cursor -= 1
                ) {
                    slashCount += 1;
                }

                // Escaped braces are display characters, not grouping braces.
                if (slashCount % 2 === 1) {
                    continue;
                }

                if (char === '{') {
                    depth += 1;
                } else {
                    depth -= 1;

                    if (depth < 0) {
                        return false;
                    }
                }
            }

            return depth === 0;
        };

        const normalizeRecognizedSupportLatex = (
            value,
            field = 'solution'
        ) => {
            let text =
                root.Qisi.Utils.cleanDisplayTextForBatchSave(
                    repairCommonLatexOcrErrors(
                        value
                    )
                );

            if (!text) {
                return '';
            }

            const {
                protectedText,
                chunks,
                issues
            } = protectLatexMathSegments(text);

            if (issues.length) {
                console.warn(
                    '[SUPPORT_LATEX][delimiter-issues]',
                    {
                        field,
                        issues
                    }
                );
            }

            let normalized =
                protectedText
                    .replace(
                        /\\begin\{(equation\*?)\}([\s\S]*?)\\end\{\1\}/g,
                        (
                            match,
                            environment,
                            body
                        ) =>
                            `$$${String(body || '').trim()}$$`
                    )
                    .replace(
                        /\\begin\{(align\*?)\}([\s\S]*?)\\end\{\1\}/g,
                        (
                            match,
                            environment,
                            body
                        ) =>
                            `$$\\begin{aligned}${String(body || '').trim()}\\end{aligned}$$`
                    )
                    .replace(
                        /\\begin\{(gather\*?)\}([\s\S]*?)\\end\{\1\}/g,
                        (
                            match,
                            environment,
                            body
                        ) =>
                            `$$\\begin{gathered}${String(body || '').trim()}\\end{gathered}$$`
                    );

            text =
                restoreLatexMathSegments(
                    normalized,
                    chunks
                )
                    .replace(/\n{3,}/g, '\n\n')
                    .trim();

            if (field !== 'answer') {
                return text;
            }

            const choice =
                text
                    .replace(
                        /[Ａ-Ｄ]/g,
                        char =>
                            String.fromCharCode(
                                char.charCodeAt(0) -
                                65248
                            )
                    )
                    .replace(
                        /[.\s、，。:：；;()（）]/g,
                        ''
                    )
                    .toUpperCase();

            if (/^[A-D]{1,4}$/.test(choice)) {
                return choice;
            }

            const tokenized =
                root.Qisi.Utils.tokenizeLatexSource(text);

            const alreadyHasMath =
                tokenized.segments.some(
                    segment =>
                        segment.type === 'math'
                );

            const containsChinese =
                /[\u3400-\u9fff]/.test(text);

            const containsSentencePunctuation =
                /[。；：！？]/.test(text);

            const hasMathSignal =
                /\\(?:d?frac|sqrt|vec|overline|overrightarrow|sin|cos|tan|log|ln|alpha|beta|gamma|theta|lambda|pi)|[_^=<>≤≥]/.test(
                    text
                );

            if (
                !alreadyHasMath &&
                !containsChinese &&
                !containsSentencePunctuation &&
                hasMathSignal &&
                hasBalancedSupportLatexBraces(
                    text
                )
            ) {
                return `$${text}$`;
            }

            return text;
        };

        const normalizeAnswerForLatex = (
            value
        ) =>
            normalizeRecognizedSupportLatex(
                value,
                'answer'
            );


        return Object.freeze({
            normalizeRecognizedSupportLatex,
            normalizeAnswerForLatex
        });
    }

    return Object.freeze({ createSupportLatexPolicy });
});
