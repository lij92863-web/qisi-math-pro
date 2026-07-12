(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.RecognitionContracts = api;

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

        const SCHEMA_VERSION = 'qisi.question.v1';

        const isRecord = value => Boolean(
            value &&
            typeof value === 'object' &&
            !Array.isArray(value)
        );

        const cloneValue = value => {
            if (Array.isArray(value)) {
                return value.map(cloneValue);
            }
            if (isRecord(value)) {
                return Object.fromEntries(
                    Object.entries(value).map(
                        ([key, item]) => [key, cloneValue(item)]
                    )
                );
            }
            return value;
        };

        const freezeValue = value => {
            if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
                return value;
            }
            Object.values(value).forEach(freezeValue);
            return Object.freeze(value);
        };

        const immutable = value => freezeValue(cloneValue(value));

        const valueOrDefault = (input, key, fallback) =>
            Object.prototype.hasOwnProperty.call(input, key)
                ? cloneValue(input[key])
                : cloneValue(fallback);

        const errorOf = (code, path, message, evidence) => {
            const error = { code, path, message };
            if (evidence !== undefined) {
                error.evidence = cloneValue(evidence);
            }
            return error;
        };

        const validateSchema = (value, errors) => {
            if (value !== SCHEMA_VERSION) {
                errors.push(errorOf(
                    'unsupported-schema',
                    'schemaVersion',
                    `Expected schema ${SCHEMA_VERSION}.`,
                    value
                ));
            }
        };

        const requireString = (
            value,
            path,
            errors,
            { allowEmpty = false } = {}
        ) => {
            if (typeof value !== 'string') {
                errors.push(errorOf(
                    value == null ? 'missing-field' : 'invalid-type',
                    path,
                    `${path} must be a string.`
                ));
                return;
            }
            if (!allowEmpty && !value.trim()) {
                errors.push(errorOf(
                    'missing-field',
                    path,
                    `${path} is required.`
                ));
            }
        };

        const requireArray = (value, path, errors) => {
            if (!Array.isArray(value)) {
                errors.push(errorOf(
                    value == null ? 'missing-field' : 'invalid-type',
                    path,
                    `${path} must be an array.`
                ));
                return false;
            }
            return true;
        };

        const requireRecord = (value, path, errors) => {
            if (!isRecord(value)) {
                errors.push(errorOf(
                    value == null ? 'missing-field' : 'invalid-type',
                    path,
                    `${path} must be an object.`
                ));
                return false;
            }
            return true;
        };

        const validatePositiveInteger = (value, path, errors) => {
            if (!Number.isInteger(value) || value < 1) {
                errors.push(errorOf(
                    value == null ? 'missing-field' : 'invalid-type',
                    path,
                    `${path} must be a positive integer.`,
                    value
                ));
            }
        };

        const validateConfidence = (value, path, errors) => {
            if (
                value !== null &&
                (!Number.isFinite(value) || value < 0 || value > 1)
            ) {
                errors.push(errorOf(
                    'invalid-confidence',
                    path,
                    `${path} must be null or between 0 and 1.`,
                    value
                ));
            }
        };

        const looksLikeUnsafeWrapper = value => {
            if (typeof value !== 'string') return false;
            const text = value.trim();
            if (/^```(?:json)?(?:\s|$)/i.test(text)) return true;
            if (!/^[\[{]/.test(text)) return false;
            try {
                const parsed = JSON.parse(text);
                return Boolean(parsed && typeof parsed === 'object');
            } catch (_error) {
                return false;
            }
        };

        const isObjectiveType = value =>
            /(?:choice|select|单选|多选|选择)/i.test(String(value || ''));

        const isLabelAnswer = value =>
            /^[A-D](?:[\s,，、]*[A-D])*$/i.test(String(value || '').trim());

        const resultOf = (errors, warnings = []) => immutable({
            valid: errors.length === 0,
            errors,
            warnings
        });

        const createRecognitionCandidate = (input = {}) => immutable({
            schemaVersion: valueOrDefault(
                input,
                'schemaVersion',
                SCHEMA_VERSION
            ),
            engine: valueOrDefault(input, 'engine', ''),
            engineVersion: valueOrDefault(input, 'engineVersion', ''),
            requestId: valueOrDefault(input, 'requestId', ''),
            sourceId: valueOrDefault(input, 'sourceId', ''),
            page: valueOrDefault(input, 'page', null),
            rawText: valueOrDefault(input, 'rawText', ''),
            blocks: valueOrDefault(input, 'blocks', []),
            formulas: valueOrDefault(input, 'formulas', []),
            images: valueOrDefault(input, 'images', []),
            rawEvidence: valueOrDefault(input, 'rawEvidence', null),
            engineConfidence: valueOrDefault(
                input,
                'engineConfidence',
                null
            ),
            warnings: valueOrDefault(input, 'warnings', []),
            durationMs: valueOrDefault(input, 'durationMs', 0)
        });

        const validateRecognitionCandidate = candidate => {
            const errors = [];
            const warnings = [];

            if (!isRecord(candidate)) {
                return resultOf([
                    errorOf(
                        'invalid-type',
                        '$',
                        'RecognitionCandidate must be an object.'
                    )
                ]);
            }

            validateSchema(candidate.schemaVersion, errors);
            requireString(candidate.engine, 'engine', errors);
            requireString(
                candidate.engineVersion,
                'engineVersion',
                errors,
                { allowEmpty: true }
            );
            requireString(candidate.requestId, 'requestId', errors);
            requireString(candidate.sourceId, 'sourceId', errors);
            if (candidate.page !== null) {
                validatePositiveInteger(candidate.page, 'page', errors);
            }
            requireString(
                candidate.rawText,
                'rawText',
                errors,
                { allowEmpty: true }
            );
            requireArray(candidate.blocks, 'blocks', errors);
            requireArray(candidate.formulas, 'formulas', errors);
            requireArray(candidate.images, 'images', errors);
            requireArray(candidate.warnings, 'warnings', errors);
            validateConfidence(
                candidate.engineConfidence,
                'engineConfidence',
                errors
            );
            if (
                !Number.isFinite(candidate.durationMs) ||
                candidate.durationMs < 0
            ) {
                errors.push(errorOf(
                    'invalid-type',
                    'durationMs',
                    'durationMs must be a finite non-negative number.',
                    candidate.durationMs
                ));
            }

            return resultOf(errors, warnings);
        };

        const createStructuredQuestionDraft = (input = {}) => immutable({
            schemaVersion: valueOrDefault(
                input,
                'schemaVersion',
                SCHEMA_VERSION
            ),
            sourceId: valueOrDefault(input, 'sourceId', ''),
            sourceOrder: valueOrDefault(input, 'sourceOrder', null),
            questionNumber: valueOrDefault(input, 'questionNumber', ''),
            type: valueOrDefault(input, 'type', ''),
            stem: valueOrDefault(input, 'stem', ''),
            options: valueOrDefault(input, 'options', []),
            answer: valueOrDefault(input, 'answer', ''),
            solution: valueOrDefault(input, 'solution', ''),
            images: valueOrDefault(input, 'images', []),
            provenance: valueOrDefault(input, 'provenance', {}),
            confidenceByField: valueOrDefault(
                input,
                'confidenceByField',
                {}
            ),
            warnings: valueOrDefault(input, 'warnings', []),
            rawEvidence: valueOrDefault(input, 'rawEvidence', null)
        });

        const validateStructuredQuestionDraft = draft => {
            const errors = [];
            const warnings = [];

            if (!isRecord(draft)) {
                return resultOf([
                    errorOf(
                        'invalid-type',
                        '$',
                        'StructuredQuestionDraft must be an object.'
                    )
                ]);
            }

            validateSchema(draft.schemaVersion, errors);
            requireString(draft.sourceId, 'sourceId', errors);
            validatePositiveInteger(draft.sourceOrder, 'sourceOrder', errors);
            requireString(draft.questionNumber, 'questionNumber', errors);
            requireString(draft.type, 'type', errors);
            requireString(draft.stem, 'stem', errors);
            requireString(draft.answer, 'answer', errors, { allowEmpty: true });
            requireString(
                draft.solution,
                'solution',
                errors,
                { allowEmpty: true }
            );

            if (looksLikeUnsafeWrapper(draft.stem)) {
                errors.push(errorOf(
                    'unsafe-wrapper',
                    'stem',
                    'Raw JSON or fenced content cannot be used as a stem.'
                ));
            }

            if (requireArray(draft.options, 'options', errors)) {
                draft.options.forEach((option, index) => {
                    requireString(
                        option,
                        `options.${index}`,
                        errors,
                        { allowEmpty: true }
                    );
                    if (looksLikeUnsafeWrapper(option)) {
                        errors.push(errorOf(
                            'unsafe-wrapper',
                            `options.${index}`,
                            'Raw JSON or fenced content cannot be an option.'
                        ));
                    }
                });
            }
            requireArray(draft.images, 'images', errors);
            requireArray(draft.warnings, 'warnings', errors);
            requireRecord(draft.provenance, 'provenance', errors);

            if (
                requireRecord(
                    draft.confidenceByField,
                    'confidenceByField',
                    errors
                )
            ) {
                Object.entries(draft.confidenceByField).forEach(
                    ([field, confidence]) => validateConfidence(
                        confidence,
                        `confidenceByField.${field}`,
                        errors
                    )
                );
            }

            if (
                isObjectiveType(draft.type) &&
                typeof draft.answer === 'string' &&
                draft.answer.trim() &&
                !isLabelAnswer(draft.answer)
            ) {
                errors.push(errorOf(
                    'ownership-invalid',
                    'answer',
                    'Objective answers must contain labels only.'
                ));
            }

            return resultOf(errors, warnings);
        };

        const validateConfirmedQuestion = question => {
            const errors = [];
            const warnings = [];

            if (!isRecord(question)) {
                return resultOf([
                    errorOf(
                        'invalid-type',
                        '$',
                        'ConfirmedQuestion must be an object.'
                    )
                ]);
            }

            validateSchema(question.schemaVersion, errors);
            [
                'id',
                'questionNumber',
                'type',
                'stem',
                'recognitionEngine',
                'confirmedAt',
                'createdAt',
                'updatedAt'
            ].forEach(path => requireString(question[path], path, errors));
            ['answer', 'solution', 'difficulty'].forEach(path =>
                requireString(
                    question[path],
                    path,
                    errors,
                    { allowEmpty: true }
                )
            );
            ['options', 'images', 'knowledgePoints', 'tags'].forEach(path =>
                requireArray(question[path], path, errors)
            );
            requireRecord(question.sourceMetadata, 'sourceMetadata', errors);
            const provenanceValid = requireRecord(
                question.provenance,
                'provenance',
                errors
            );

            if (
                typeof question.manualEdited !== 'boolean'
            ) {
                errors.push(errorOf(
                    'invalid-type',
                    'manualEdited',
                    'manualEdited must be a boolean.'
                ));
            }
            if (
                provenanceValid &&
                question.provenance.controlledWriteAccepted !== true
            ) {
                errors.push(errorOf(
                    'controlled-write-required',
                    'provenance.controlledWriteAccepted',
                    'Confirmed data requires an accepted controlled-write decision.'
                ));
            }
            if (
                provenanceValid &&
                question.provenance.manualConfirmed !== true
            ) {
                errors.push(errorOf(
                    'manual-confirmation-required',
                    'provenance.manualConfirmed',
                    'Confirmed data requires explicit manual confirmation.'
                ));
            }
            if (
                isObjectiveType(question.type) &&
                typeof question.answer === 'string' &&
                question.answer.trim() &&
                !isLabelAnswer(question.answer)
            ) {
                errors.push(errorOf(
                    'ownership-invalid',
                    'answer',
                    'Objective answers must contain labels only.'
                ));
            }

            return resultOf(errors, warnings);
        };

        const legacyDraftToStructuredDraft = (legacyDraft = {}) => {
            const source = isRecord(legacyDraft) ? legacyDraft : {};
            const legacyWarnings = Array.isArray(source.warnings)
                ? source.warnings
                : [];
            const sourceOrder = Number.isInteger(source.sourceOrder)
                ? source.sourceOrder
                : Number.isInteger(source.order)
                    ? source.order
                    : null;

            return createStructuredQuestionDraft({
                schemaVersion: SCHEMA_VERSION,
                sourceId: source.sourceId || 'legacy:unknown',
                sourceOrder,
                questionNumber:
                    source.questionNumber ??
                    source.question ??
                    '',
                type: source.type ?? '',
                stem: source.stem ?? '',
                options: valueOrDefault(source, 'options', []),
                answer: source.answer ?? '',
                solution: source.solution ?? '',
                images: valueOrDefault(source, 'images', []),
                provenance: {
                    ...(isRecord(source.provenance)
                        ? cloneValue(source.provenance)
                        : {}),
                    compatibilitySource: 'legacy',
                    sourceKnown: Boolean(source.sourceId),
                    manualConfirmed: false
                },
                confidenceByField: isRecord(source.confidenceByField)
                    ? source.confidenceByField
                    : {},
                warnings: [
                    ...legacyWarnings,
                    'legacy-compatibility-manual-review-required'
                ],
                rawEvidence: Object.prototype.hasOwnProperty.call(
                    source,
                    'rawEvidence'
                )
                    ? source.rawEvidence
                    : { legacyDraft: source }
            });
        };

        const structuredDraftToLegacyReviewDraft = draft => {
            const source = isRecord(draft) ? draft : {};
            return immutable({
                question: source.questionNumber ?? '',
                questionNumber: source.questionNumber ?? '',
                order: source.sourceOrder ?? null,
                type: source.type ?? '',
                stem: source.stem ?? '',
                options: valueOrDefault(source, 'options', []),
                answer: source.answer ?? '',
                solution: source.solution ?? '',
                images: valueOrDefault(source, 'images', []),
                sourceId: source.sourceId ?? '',
                sourceOrder: source.sourceOrder ?? null,
                provenance: valueOrDefault(source, 'provenance', {}),
                confidenceByField: valueOrDefault(
                    source,
                    'confidenceByField',
                    {}
                ),
                warnings: valueOrDefault(source, 'warnings', []),
                rawEvidence: valueOrDefault(source, 'rawEvidence', null),
                schemaVersion: source.schemaVersion ?? SCHEMA_VERSION
            });
        };

        return Object.freeze({
            SCHEMA_VERSION,
            createRecognitionCandidate,
            validateRecognitionCandidate,
            createStructuredQuestionDraft,
            validateStructuredQuestionDraft,
            validateConfirmedQuestion,
            legacyDraftToStructuredDraft,
            structuredDraftToLegacyReviewDraft
        });
    }
);
