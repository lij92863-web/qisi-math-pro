(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.DocxQuestionStructure = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

        const sectionHeading = (value = '') => {
            const source = String(value || '').replace(/\s+/g, ' ').trim();
            const match = source.match(/^(?:[一二三四五六七八九十百]+|\d+)\s*[、.．]\s*([^：:]*?(?:单项选择题|单选题|多项选择题|多选题|填空题|解答题|简答题|判断题))(?=\s*(?:[（(：:]|$))/);
            if (!match) return null;
            const label = match[1];
            let type = '未知题型';
            if (/单项选择题|单选题/.test(label)) type = '单选题';
            else if (/多项选择题|多选题/.test(label)) type = '多选题';
            else if (/填空题/.test(label)) type = '填空题';
            else if (/解答题|简答题/.test(label)) type = '解答题';
            else if (/判断题/.test(label)) type = '判断题';
            return { label, type };
        };

        const splitOptions = (value = '') => {
            const source = String(value || '').replace(
                /\$\{?([A-D])\}?\s*(?:\{\s*[.．、:：]\s*\}|[.．、:：])\s*(?=[\\A-Za-z0-9{(+-])/g,
                (_, label) => `${label}. $`
            );
            const regex = /(^|[\s　]|\]\])([A-D])\s*[.．、:：]\s*/g;
            const markers = [];
            let match;
            while ((match = regex.exec(source)) !== null) {
                markers.push({ label: match[2], start: match.index + match[1].length, contentStart: regex.lastIndex });
            }
            if (!markers.length) return null;
            return {
                before: source.slice(0, markers[0].start).trim(),
                options: markers.map((marker, index) => ({
                    label: marker.label,
                    value: source.slice(marker.contentStart, markers[index + 1]?.start ?? source.length).trim()
                }))
            };
        };

        const appendText = (current, value) => {
            const previous = String(current || '').trim();
            const next = String(value || '').trim();
            if (!previous) return next;
            if (!next) return previous;
            const beginsMathContinuation = /^(?:\$|\\\(|\\\[|[A-Za-z]\s*[=＝<>≤≥])/.test(next);
            const previousEndsSentence = /[。！？!?；;：:]$/.test(previous);
            const previousEndsImage = /\[\[IMAGE:[^\]]+\]\]$/.test(previous);
            const separator = beginsMathContinuation && !previousEndsSentence && !previousEndsImage
                ? ' '
                : '\n';
            return `${previous}${separator}${next}`;
        };

        const splitLeadingImageTokens = (value = '') => {
            const source = String(value || '');
            const match = source.match(/^((?:\s*\[\[IMAGE:[^\]]+\]\]\s*)+)/);
            return match
                ? { prefix: match[1].trim(), content: source.slice(match[0].length).trim() }
                : { prefix: '', content: source.trim() };
        };

        const consumeQuestionContent = (question, value) => {
            const split = splitOptions(value);
            if (split) {
                if (split.before) question.stem = appendText(question.stem, split.before);
                for (const option of split.options) {
                    question.optionMap[option.label] = appendText(question.optionMap[option.label], option.value);
                    question.currentOption = option.label;
                }
                return;
            }
            if (question.currentOption) question.optionMap[question.currentOption] = appendText(question.optionMap[question.currentOption], value);
            else question.stem = appendText(question.stem, value);
        };

        const finishQuestion = (question, questions) => {
            if (!question) return;
            const options = ['A', 'B', 'C', 'D'].map(label => question.optionMap[label] || '');
            while (options.length && !options[options.length - 1]) options.pop();
            questions.push({
                questionKey: `section-${question.sectionIndex}/q-${question.number}`,
                sectionIndex: question.sectionIndex,
                number: question.number,
                type: question.type,
                stem: question.stem.trim(),
                options,
                optionMap: { ...question.optionMap },
                richBlocks: question.richBlocks,
                assets: question.richBlocks.flatMap(block => block.assets || []),
                diagnostics: question.richBlocks.flatMap(block => block.diagnostics || []),
                sourceParagraphRange: [question.startParagraph, question.endParagraph]
            });
        };

        const parseQuestionRichBlocks = (blocks = []) => {
            const questions = [];
            const diagnostics = [];
            let sectionIndex = 0;
            let type = '未知题型';
            let current = null;
            for (const block of blocks || []) {
                const value = String(block?.serialized || '').trim();
                const leading = splitLeadingImageTokens(value);
                const heading = sectionHeading(leading.content);
                if (heading) {
                    finishQuestion(current, questions);
                    current = null;
                    sectionIndex += 1;
                    type = heading.type;
                    continue;
                }
                const marker = leading.content.match(/^\s*(\d+)\s*[.．、]\s*([\s\S]*)$/);
                if (marker) {
                    finishQuestion(current, questions);
                    if (!sectionIndex) sectionIndex = 1;
                    current = {
                        sectionIndex,
                        type,
                        number: Number(marker[1]),
                        stem: '',
                        optionMap: {},
                        currentOption: '',
                        richBlocks: [block],
                        startParagraph: block.paragraphIndex,
                        endParagraph: block.paragraphIndex
                    };
                    consumeQuestionContent(current, [marker[2], leading.prefix].filter(Boolean).join('\n'));
                    continue;
                }
                if (!current || !value) continue;
                current.richBlocks.push(block);
                current.endParagraph = block.paragraphIndex;
                consumeQuestionContent(current, value);
            }
            finishQuestion(current, questions);
            const duplicate = questions.find((question, index) => questions.findIndex(row => row.questionKey === question.questionKey) !== index);
            if (duplicate) diagnostics.push({ code: 'DUPLICATE_QUESTION_KEY', questionKey: duplicate.questionKey });
            return { questions, diagnostics, ok: diagnostics.length === 0 };
        };

        return { parseQuestionRichBlocks };
    }
);
