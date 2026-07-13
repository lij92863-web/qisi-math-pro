(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.OcrStructureExtractor = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const normalizeText = value => String(value ?? '')
        .normalize('NFC')
        .normalize('NFKC')
        .replace(/\s+/g, ' ')
        .trim();

    const parseQuestionNumber = value => {
        const marker = String(value ?? '')
            .normalize('NFC')
            .replace(/[０-９]/g, digit => String(digit.charCodeAt(0) - 0xFF10))
            .replace(/\s+/g, ' ')
            .trim();
        const match = marker.match(/^(?:第\s*)?([0-9]+)(?:\s*题)?\s*[.．、:：)）]?$/);
        return match ? match[1] : '';
    };

    const parseOption = block => {
        const explicit = normalizeText(block.optionLabel).toUpperCase();
        if (explicit && /^[A-H]$/.test(explicit)) {
            return { label: explicit, content: normalizeText(block.rawText) };
        }
        const match = String(block.rawText || '').match(/^\s*([A-H])\s*[.．、:：)）]\s*([\s\S]*)$/i);
        return match
            ? { label: match[1].toUpperCase(), content: normalizeText(match[2]) }
            : null;
    };

    const looksLikeUnsafeWrapper = value => {
        const text = String(value || '').trim();
        if (/^```(?:json)?(?:\s|$)/i.test(text)) return true;
        if (!/^[{[]/.test(text)) return false;
        try {
            const parsed = JSON.parse(text);
            return Boolean(parsed && typeof parsed === 'object');
        } catch (_error) {
            return false;
        }
    };

    const cloneEvidence = block => Object.freeze({
        ...block,
        bbox: Object.freeze([...block.bbox])
    });

    const textField = blocks => Object.freeze({
        rawText: blocks.map(block => block.rawText).join('\n'),
        normalizedText: normalizeText(blocks.map(block => block.rawText).join('\n')),
        blockIds: Object.freeze(blocks.map(block => block.id)),
        confidence: blocks.length
            ? Math.min(...blocks.map(block => block.confidence ?? 0))
            : null
    });

    const optionEvidence = (block, parsed) => Object.freeze({
        label: parsed.label,
        rawText: block.rawText,
        normalizedText: parsed.content,
        bbox: Object.freeze([...block.bbox]),
        confidence: block.confidence,
        missing: false,
        blockId: block.id
    });

    const missingOption = label => Object.freeze({
        label,
        rawText: '',
        normalizedText: '',
        bbox: null,
        confidence: null,
        missing: true,
        blockId: null
    });

    const buildQuestion = (group, expectedOptionLabels, shared) => {
        const anchor = group[0];
        const questionNumber = parseQuestionNumber(anchor.rawText);
        const stems = [];
        const answers = [];
        const solutions = [];
        const formulas = [];
        const images = [];
        const detectedOptions = new Map();
        const questionWarnings = [];

        if (!questionNumber) {
            questionWarnings.push({
                code: 'invalid-question-anchor',
                blockId: anchor.id,
                page: anchor.page
            });
        }

        for (const block of group.slice(1)) {
            if (block.type === 'stem') stems.push(block);
            else if (block.type === 'answer') answers.push(block);
            else if (block.type === 'solution') solutions.push(block);
            else if (block.type === 'formula') {
                formulas.push(Object.freeze({
                    rawText: block.rawText,
                    latex: String(block.latex ?? block.rawText),
                    bbox: Object.freeze([...block.bbox]),
                    confidence: block.confidence,
                    blockId: block.id
                }));
            } else if (block.type === 'image') {
                images.push(Object.freeze({
                    imageId: String(block.imageId || block.id),
                    bbox: Object.freeze([...block.bbox]),
                    role: 'unclassified',
                    confidence: block.confidence,
                    blockId: block.id
                }));
            } else if (block.type === 'option') {
                const parsed = parseOption(block);
                let code = '';
                if (!parsed) code = 'invalid-option-marker';
                else if (looksLikeUnsafeWrapper(parsed.content)) code = 'unsafe-option-wrapper';
                else if (detectedOptions.has(parsed.label)) code = 'duplicate-option-label';
                if (code) {
                    const warning = { code, blockId: block.id, page: block.page };
                    questionWarnings.push(warning);
                    shared.rejectedEvidence.push(cloneEvidence(block));
                } else {
                    detectedOptions.set(parsed.label, optionEvidence(block, parsed));
                }
            } else {
                shared.unassignedBlocks.push(cloneEvidence(block));
                questionWarnings.push({
                    code: 'unclassified-block',
                    blockId: block.id,
                    page: block.page
                });
            }
        }

        const normalizedExpected = Array.isArray(expectedOptionLabels)
            ? [...new Set(expectedOptionLabels.map(label => normalizeText(label).toUpperCase()))]
                .filter(label => /^[A-H]$/.test(label))
            : [];
        const optionLabels = normalizedExpected.length
            ? [...normalizedExpected, ...[...detectedOptions.keys()].filter(label => !normalizedExpected.includes(label))]
            : [...detectedOptions.keys()];
        const options = optionLabels.map(label => detectedOptions.get(label) || missingOption(label));
        const warnings = questionWarnings.map(Object.freeze);
        shared.warnings.push(...warnings);

        return Object.freeze({
            page: anchor.page,
            sourceOrder: anchor.order,
            questionNumber,
            anchorEvidence: Object.freeze({
                blockId: anchor.id,
                rawText: anchor.rawText,
                bbox: Object.freeze([...anchor.bbox]),
                confidence: anchor.confidence
            }),
            stem: textField(stems),
            options: Object.freeze(options),
            answer: answers.length ? textField(answers) : null,
            solution: solutions.length ? textField(solutions) : null,
            formulas: Object.freeze(formulas),
            images: Object.freeze(images),
            rawEvidenceRefs: Object.freeze(group.map(block => block.id)),
            warnings: Object.freeze(warnings),
            ownershipStatus: 'unvalidated',
            eligibleForControlledWrite: false,
            eligibleForFormalAdmission: false
        });
    };

    const extractQuestionStructures = (
        readingOrderResult,
        { expectedOptionLabelsByQuestion = {} } = {}
    ) => {
        if (!readingOrderResult || !Array.isArray(readingOrderResult.orderedBlocks)) {
            const error = new TypeError('A validated reading-order result is required.');
            error.code = 'invalid-reading-order-result';
            throw error;
        }
        const shared = {
            warnings: [...(readingOrderResult.warnings || [])],
            rejectedEvidence: [],
            unassignedBlocks: []
        };
        const groups = [];
        let current = null;
        for (const block of readingOrderResult.orderedBlocks) {
            if (block.type === 'question-anchor') {
                current = [block];
                groups.push(current);
            } else if (current) {
                current.push(block);
            } else {
                shared.unassignedBlocks.push(cloneEvidence(block));
                shared.warnings.push(Object.freeze({
                    code: 'unanchored-block',
                    blockId: block.id,
                    page: block.page
                }));
            }
        }
        const questions = groups.map(group => {
            const number = parseQuestionNumber(group[0].rawText);
            return buildQuestion(group, expectedOptionLabelsByQuestion[number], shared);
        });
        return Object.freeze({
            questions: Object.freeze(questions),
            rejectedEvidence: Object.freeze(shared.rejectedEvidence),
            unassignedBlocks: Object.freeze(shared.unassignedBlocks),
            warnings: Object.freeze(shared.warnings)
        });
    };

    return Object.freeze({
        normalizeText,
        parseQuestionNumber,
        parseOption,
        looksLikeUnsafeWrapper,
        extractQuestionStructures
    });
});
