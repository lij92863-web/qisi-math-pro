(function initImportValidationService(root) {
    'use strict';

    const PORTS = Object.freeze([
        ['validateSequence', 'sequence', false],
        ['validateSchema', 'schema', true],
        ['validateOwnership', 'ownership', true],
        ['validateSafePartial', 'safe-partial', true],
        ['validateControlledWriteEvidence', 'controlled-write-evidence', true]
    ]);
    const productionDependencies = Object.freeze({
        supportAligner: root?.Qisi?.PdfSupportAligner || (
            typeof module !== 'undefined' && module.exports
                ? require('./qisi-pdf-support-aligner.js') : null
        ),
        contracts: root?.Qisi?.RecognitionContracts || (
            typeof module !== 'undefined' && module.exports
                ? require('./qisi-recognition-contracts.js') : null
        )
    });

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

    const createError = (code, failures = []) => {
        const error = new Error(code);
        error.code = code;
        if (failures.length) error.failures = immutable(failures);
        return error;
    };

    const assertResult = (result, stage) => {
        if (
            !result || typeof result !== 'object' || Array.isArray(result) ||
            typeof result.valid !== 'boolean' ||
            (result.errors !== undefined && !Array.isArray(result.errors)) ||
            (result.warnings !== undefined && !Array.isArray(result.warnings))
        ) {
            throw createError('IMPORT_VALIDATOR_MALFORMED', [
                { stage, index: null, code: 'validator-result-malformed' }
            ]);
        }
        return result;
    };

    const failuresOf = (result, stage, index) => {
        if (result.valid) return [];
        const errors = Array.isArray(result.errors) && result.errors.length
            ? result.errors
            : [{ code: 'validator-rejected' }];
        return errors.map(item => ({
            stage,
            index,
            code: String(item?.code || 'validator-rejected')
        }));
    };

    const validateImportDrafts = (drafts, validatorPorts = {}) => {
        if (!Array.isArray(drafts) || !drafts.length) {
            throw createError('IMPORT_VALIDATION_INPUT_INVALID');
        }
        for (const [name, stage] of PORTS) {
            if (typeof validatorPorts[name] !== 'function') {
                throw createError('IMPORT_VALIDATOR_REQUIRED', [
                    { stage, index: null, code: 'validator-required' }
                ]);
            }
        }

        const candidates = immutable(drafts);
        const context = immutable(validatorPorts.context || {});
        const failures = [];
        const invoke = (name, stage, value, index) => {
            let result;
            try {
                result = validatorPorts[name](value, {
                    index,
                    drafts: candidates,
                    context
                });
            } catch (_error) {
                throw createError('IMPORT_VALIDATOR_FAILED', [
                    { stage, index, code: 'validator-threw' }
                ]);
            }
            failures.push(...failuresOf(assertResult(result, stage), stage, index));
        };

        invoke('validateSequence', 'sequence', candidates, null);
        candidates.forEach((candidate, index) => {
            for (const [name, stage, perDraft] of PORTS) {
                if (perDraft) invoke(name, stage, candidate, index);
            }
        });

        if (failures.length) {
            throw createError('IMPORT_VALIDATION_REJECTED', failures);
        }
        return immutable(candidates);
    };

    const createProductionValidationPorts = (dependencies = {}) => {
        const supportAligner = dependencies.supportAligner ||
            productionDependencies.supportAligner;
        const contracts = dependencies.contracts ||
            productionDependencies.contracts;
        const reviewValidator = dependencies.reviewValidator;
        if (
            typeof supportAligner?.validatePdfSupportSequence !== 'function' ||
            typeof contracts?.createStructuredQuestionDraft !== 'function' ||
            typeof contracts?.validateStructuredQuestionDraft !== 'function' ||
            typeof reviewValidator?.validate !== 'function'
        ) throw createError('IMPORT_PRODUCTION_VALIDATION_DEPENDENCY_REQUIRED');

        const canonicalPdf = draft =>
            draft.source?.format === 'pdf' ||
            draft.source?.mode === 'pdf-ai' ||
            String(draft.producer?.routeId || '').startsWith('pdf-');
        const rejectedPdf = () => ({ valid: false, errors: [{ code: 'pdf-v1-producer-required' }], warnings: [] });
        const hasValue = value => Array.isArray(value)
            ? value.length > 0
            : typeof value === 'string'
                ? Boolean(value.trim())
                : value !== null && value !== undefined;
        const reviewableMissingFields = (draft, result) =>
            result.errors.length > 0 &&
            result.errors.every(error =>
                error.code === 'admission-required-field-missing' &&
                draft.fieldProvenance?.[error.field]?.status === 'missing' &&
                !hasValue(draft[error.field])
            );

        const validateOwnership = (draft, { context, index }) => {
            if (canonicalPdf(draft)) return rejectedPdf();
            const canonicalFormat = String(draft.source?.format || '');
            const requiredFileType = ['docx', 'pdf'].includes(canonicalFormat)
                ? canonicalFormat
                : draft.source?.mode === 'docx-deterministic'
                    ? 'docx'
                    : draft.source?.mode === 'pdf-ai' ? 'pdf' : '';
            if (
                !requiredFileType ||
                !(context.files || []).some(file =>
                    file.fileType === requiredFileType
                )
            ) {
                return {
                    valid: false,
                    errors: [{ code: 'wrong-attachment' }],
                    warnings: []
                };
            }
            const result = reviewValidator.validate({
                ...draft,
                id: draft.id || `validation-draft-${index + 1}`,
                version: Number.isInteger(draft.version) ? draft.version : 1
            });
            const acceptedMissing = reviewableMissingFields(draft, result);
            const supportDecisions = Array.isArray(
                draft.controlledWrite?.supportDecisions
            ) ? draft.controlledWrite.supportDecisions : [];
            const reviewableDocxSupport =
                draft.source?.format === 'docx' &&
                draft.producer?.routeId === 'docx-rendered-to-pdf-vision' &&
                draft.manualReviewRequired === true &&
                result.errors.length > 0 &&
                result.errors.every(error => {
                    if (
                        error.code !== 'admission-producer-provenance-invalid' ||
                        !['answer', 'solution'].includes(error.field)
                    ) return false;
                    const provenance = draft.fieldProvenance?.[error.field];
                    return supportDecisions.some(decision =>
                        decision.field === error.field &&
                        decision.sourceId === provenance?.sourceId &&
                        decision.decisionId ===
                            provenance?.controlledWriteDecisionId
                    );
                });
            return {
                valid: result.valid || acceptedMissing ||
                    reviewableDocxSupport,
                errors: acceptedMissing || reviewableDocxSupport
                    ? [] : result.errors,
                warnings: result.warnings || []
            };
        };

        const ports = {
            validateSequence(drafts, { context }) {
                if (drafts.some(canonicalPdf)) return rejectedPdf();
                const expected = context.expectedQuestionNumbers || [];
                if (!expected.length) {
                    return { valid: true, errors: [], warnings: [] };
                }
                const items = drafts.map(draft => ({
                    question: draft.questionNumber
                }));
                const result = supportAligner.validatePdfSupportSequence({
                    answerItems: items,
                    solutionItems: items,
                    expectedQuestionNumbers: expected
                });
                const valid = result.mode === 'full' || (
                    ['prefix', 'subset'].includes(result.mode) &&
                    result.safeQuestionNumbers.length === drafts.length
                );
                return {
                    valid,
                    errors: valid ? [] : [{ code: 'sequence-invalid' }],
                    warnings: []
                };
            },
            validateSchema(draft, { index }) {
                if (canonicalPdf(draft)) return rejectedPdf();
                const structured = contracts.createStructuredQuestionDraft({
                    sourceId: draft.source?.sourceId || '',
                    sourceOrder: Number.isInteger(draft.order)
                        ? draft.order : index + 1,
                    questionNumber: draft.questionNumber,
                    type: draft.type,
                    stem: draft.stem,
                    options: draft.options,
                    answer: draft.answer,
                    solution: draft.solution,
                    images: draft.images,
                    provenance: draft.fieldProvenance || {},
                    confidenceByField: draft.confidenceByField || {},
                    warnings: draft.warnings || [],
                    rawEvidence: draft.rawText ?? null
                });
                const result = contracts.validateStructuredQuestionDraft(structured);
                const errors = result.errors || [];
                return {
                    valid: errors.length === 0,
                    errors,
                    warnings: result.warnings || []
                };
            },
            validateOwnership,
            validateSafePartial(draft) {
                if (canonicalPdf(draft)) return rejectedPdf();
                return { valid: true, errors: [], warnings: [] };
            },
            validateControlledWriteEvidence(draft, input) {
                return validateOwnership(draft, input);
            }
        };
        return Object.freeze(ports);
    };

    const api = Object.freeze({
        validateImportDrafts,
        createProductionValidationPorts
    });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.ImportValidationService = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
