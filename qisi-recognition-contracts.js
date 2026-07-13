(function (root, factory) {
    const identityContract = root?.Qisi?.DocxProducerIdentityContract || (
        typeof module !== 'undefined' && module.exports
            ? require('./qisi-docx-producer-identity-contract.js')
            : null
    );
    const api = factory(identityContract);

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
    function (identityContract) {
        'use strict';

        const SCHEMA_VERSION = 'qisi.question.v1';
        const QUESTION_SCHEMA_V2 = 'qisi.question.v2';
        const LEGACY_READ_SCHEMA = 'qisi.question.legacy-read.v1';
        const ADMISSION_SCHEMA_VERSION = 'qisi.admission.v1';
        const ADMISSION_MODES = Object.freeze([
            'manual',
            'docx-deterministic',
            'pdf-ai',
            'imported-package',
            'deterministic-docx',
            'deterministic-pdf',
            'vision-ai'
        ]);
        const FORMAL_FIELDS = Object.freeze([
            'questionNumber',
            'stem',
            'options',
            'answer',
            'solution',
            'images'
        ]);
        const PROVENANCE_STATUSES = Object.freeze([
            'manual',
            'deterministic-source',
            'controlled-write',
            'rejected',
            'missing'
        ]);

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
            rawEvidenceRef: valueOrDefault(
                input,
                'rawEvidenceRef',
                `${String(input.engine || 'ocr')}://${String(input.requestId || 'unknown')}`
            ),
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
            requireString(candidate.rawEvidenceRef, 'rawEvidenceRef', errors);
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

        const isIsoUtcTime = value => {
            if (typeof value !== 'string' || !value) return false;
            try {
                return new Date(value).toISOString() === value;
            } catch (_error) {
                return false;
            }
        };

        const hasFormalValue = value => Array.isArray(value)
            ? value.length > 0
            : typeof value === 'string'
                ? Boolean(value.trim())
                : value !== null && value !== undefined;

        const requiresV2Field = (field, question) => {
            if (field === 'questionNumber' || field === 'stem') return true;
            if (field === 'options') return isObjectiveType(question?.type);
            if (field === 'answer') {
                return isObjectiveType(question?.type) ||
                    /(?:填空|blank)/i.test(String(question?.type || ''));
            }
            return false;
        };

        const validateQuestionV2 = question => {
            const errors = [];
            const warnings = [];
            if (!isRecord(question)) {
                return resultOf([errorOf(
                    'invalid-type',
                    '$',
                    'Question v2 must be an object.'
                )]);
            }
            if (question.schemaVersion !== QUESTION_SCHEMA_V2) {
                errors.push(errorOf(
                    'unsupported-schema',
                    'schemaVersion',
                    `Expected schema ${QUESTION_SCHEMA_V2}.`,
                    question.schemaVersion
                ));
            }
            ['id', 'questionNumber', 'type', 'stem'].forEach(path =>
                requireString(question[path], path, errors)
            );
            ['answer', 'solution'].forEach(path =>
                requireString(
                    question[path],
                    path,
                    errors,
                    { allowEmpty: true }
                )
            );
            ['options', 'images'].forEach(path =>
                requireArray(question[path], path, errors)
            );

            const sourceValid = requireRecord(
                question.source,
                'source',
                errors
            );
            const admissionValid = requireRecord(
                question.admission,
                'admission',
                errors
            );
            const provenanceValid = requireRecord(
                question.provenance,
                'provenance',
                errors
            );

            const identity = typeof identityContract?.resolveIdentity === 'function'
                ? identityContract.resolveIdentity(question, { allowLegacyRead: true })
                : { status: 'invalid', errors: [] };
            const mode = identity.status === 'canonical'
                ? identity.producer?.mode || ''
                : identity.status === 'legacy-exact'
                    ? identity.legacyMode || ''
                    : '';
            if (sourceValid && (
                !ADMISSION_MODES.includes(mode) ||
                ['invalid', 'legacy-unknown'].includes(identity.status)
            )) {
                errors.push(errorOf(
                    'invalid-source-mode',
                    identity.status === 'canonical' ? 'producer.mode' : 'source.mode',
                    'Question producer identity is unsupported.',
                    identity.errors || mode
                ));
            }
            if (sourceValid) {
                requireString(
                    question.source.sourceId,
                    'source.sourceId',
                    errors
                );
            }

            if (admissionValid) {
                if (
                    question.admission.schemaVersion !==
                    ADMISSION_SCHEMA_VERSION
                ) {
                    errors.push(errorOf(
                        'unsupported-schema',
                        'admission.schemaVersion',
                        `Expected schema ${ADMISSION_SCHEMA_VERSION}.`,
                        question.admission.schemaVersion
                    ));
                }
                [
                    'decisionId',
                    'mode',
                    'policyVersion',
                    'draftId',
                    'confirmedBy',
                    'idempotencyKey'
                ].forEach(path => requireString(
                    question.admission[path],
                    `admission.${path}`,
                    errors
                ));
                validatePositiveInteger(
                    question.admission.draftVersion,
                    'admission.draftVersion',
                    errors
                );
                if (
                    sourceValid &&
                    question.admission.mode !== mode
                ) {
                    errors.push(errorOf(
                        'admission-source-mismatch',
                        'admission.mode',
                        'Admission mode must match source mode.'
                    ));
                }
            }

            for (const path of ['createdAt', 'updatedAt', 'confirmedAt']) {
                if (!isIsoUtcTime(question[path])) {
                    errors.push(errorOf(
                        'invalid-time',
                        path,
                        `${path} must be an ISO-8601 UTC string.`,
                        question[path]
                    ));
                }
            }
            if (
                admissionValid &&
                !isIsoUtcTime(question.admission.confirmedAt)
            ) {
                errors.push(errorOf(
                    'invalid-time',
                    'admission.confirmedAt',
                    'admission.confirmedAt must be an ISO-8601 UTC string.'
                ));
            }
            if (
                isIsoUtcTime(question.confirmedAt) &&
                admissionValid &&
                question.admission.confirmedAt !== question.confirmedAt
            ) {
                errors.push(errorOf(
                    'admission-source-mismatch',
                    'admission.confirmedAt',
                    'Admission and question confirmation times must match.'
                ));
            }
            if (
                isIsoUtcTime(question.createdAt) &&
                isIsoUtcTime(question.updatedAt) &&
                new Date(question.createdAt) > new Date(question.updatedAt)
            ) {
                errors.push(errorOf(
                    'time-order-invalid',
                    'updatedAt',
                    'updatedAt cannot precede createdAt.'
                ));
            }
            if (
                isIsoUtcTime(question.confirmedAt) &&
                isIsoUtcTime(question.updatedAt) &&
                new Date(question.confirmedAt) > new Date(question.updatedAt)
            ) {
                errors.push(errorOf(
                    'time-order-invalid',
                    'confirmedAt',
                    'confirmedAt cannot follow updatedAt.'
                ));
            }

            if (provenanceValid) {
                for (const field of FORMAL_FIELDS) {
                    const item = question.provenance[field];
                    if (!isRecord(item)) {
                        errors.push(errorOf(
                            'provenance-missing',
                            `provenance.${field}`,
                            `Provenance is required for ${field}.`
                        ));
                        continue;
                    }
                    if (item.field && item.field !== field) {
                        errors.push(errorOf(
                            'provenance-field-mismatch',
                            `provenance.${field}.field`,
                            `Provenance field must be ${field}.`
                        ));
                    }
                    if (!PROVENANCE_STATUSES.includes(item.status)) {
                        errors.push(errorOf(
                            'provenance-status-invalid',
                            `provenance.${field}.status`,
                            `Provenance status for ${field} is invalid.`
                        ));
                        continue;
                    }
                    const present = hasFormalValue(question[field]);
                    if (
                        item.status === 'rejected' ||
                        (
                            item.status === 'missing' &&
                            (present || requiresV2Field(field, question))
                        ) ||
                        (
                            !['missing', 'rejected'].includes(item.status) &&
                            !present
                        )
                    ) {
                        errors.push(errorOf(
                            'provenance-value-conflict',
                            `provenance.${field}`,
                            `Provenance and value for ${field} conflict.`
                        ));
                    }
                    if (item.status === 'manual') {
                        if (
                            !Number.isInteger(item.manualEditRevision) ||
                            item.manualEditRevision < 1
                        ) {
                            errors.push(errorOf(
                                'manual-revision-required',
                                `provenance.${field}.manualEditRevision`,
                                `Manual field ${field} requires an edit revision.`
                            ));
                        }
                        if (
                            Object.prototype.hasOwnProperty.call(
                                item,
                                'engineConfidence'
                            ) ||
                            Object.prototype.hasOwnProperty.call(
                                item,
                                'controlledWriteDecisionId'
                            )
                        ) {
                            errors.push(errorOf(
                                'manual-engine-evidence-forbidden',
                                `provenance.${field}`,
                                `Manual field ${field} cannot claim engine evidence.`
                            ));
                        }
                    }
                    if (item.status === 'deterministic-source') {
                        if (!item.sourceId || !item.evidenceRef) {
                            errors.push(errorOf(
                                'provenance-evidence-missing',
                                `provenance.${field}`,
                                `Deterministic field ${field} requires source evidence.`
                            ));
                        }
                    }
                    if (item.status === 'controlled-write') {
                        if (!['pdf-ai', 'vision-ai'].includes(mode)) {
                            errors.push(errorOf(
                                'controlled-write-mode-invalid',
                                `provenance.${field}`,
                                'Controlled-write evidence is valid only for PDF/AI mode.'
                            ));
                        }
                        if (
                            item.controlledWriteAccepted !== true ||
                            !item.controlledWriteDecisionId
                        ) {
                            errors.push(errorOf(
                                'controlled-write-evidence-invalid',
                                `provenance.${field}`,
                                `Controlled-write evidence for ${field} is invalid.`
                            ));
                        }
                    }
                    if (
                        identity.status === 'canonical' &&
                        !['manual', 'missing', 'rejected'].includes(item.status)
                    ) {
                        const expectedBoundary = mode === 'vision-ai'
                            ? 'docx-vision-engine-output-to-candidate'
                            : 'docx-deterministic-source-to-candidate';
                        if (
                            item.kind !== item.status ||
                            item.sourceId !== question.source.sourceId ||
                            item.sourceFormat !== question.source.format ||
                            item.producerMode !== mode ||
                            item.routeId !== question.route?.identity ||
                            !item.engine ||
                            item.producerBoundary !== expectedBoundary ||
                            item.contractVersion !== identityContract.CONTRACT_VERSION
                        ) {
                            errors.push(errorOf(
                                'producer-provenance-invalid',
                                `provenance.${field}`,
                                `Canonical producer-time provenance for ${field} is invalid.`
                            ));
                        }
                    }
                }
                for (const field of Object.keys(question.provenance)) {
                    if (!FORMAL_FIELDS.includes(field)) {
                        errors.push(errorOf(
                            'provenance-field-unknown',
                            `provenance.${field}`,
                            `Unknown formal provenance field ${field}.`
                        ));
                    }
                }
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

            if (question.recognition !== null) {
                if (requireRecord(
                    question.recognition,
                    'recognition',
                    errors
                )) {
                    requireString(
                        question.recognition.engine,
                        'recognition.engine',
                        errors
                    );
                    requireString(
                        question.recognition.engineVersion,
                        'recognition.engineVersion',
                        errors,
                        { allowEmpty: true }
                    );
                    requireArray(
                        question.recognition.requestIds,
                        'recognition.requestIds',
                        errors
                    );
                    requireArray(
                        question.recognition.candidateRefs,
                        'recognition.candidateRefs',
                        errors
                    );
                }
            }

            return resultOf(errors, warnings);
        };

        const legacyQuestionToReadableV2 = legacyQuestion => {
            const source = isRecord(legacyQuestion) ? legacyQuestion : {};
            return immutable({
                ...cloneValue(source),
                schemaVersion: LEGACY_READ_SCHEMA,
                admission: null,
                provenance: null,
                recognition: null,
                compatibility: {
                    readOnly: true,
                    originalSchemaVersion: source.schemaVersion || null,
                    source: 'legacy-formal-question'
                }
            });
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
            QUESTION_SCHEMA_V2,
            LEGACY_READ_SCHEMA,
            ADMISSION_SCHEMA_VERSION,
            FORMAL_FIELDS,
            createRecognitionCandidate,
            validateRecognitionCandidate,
            createStructuredQuestionDraft,
            validateStructuredQuestionDraft,
            validateConfirmedQuestion,
            validateQuestionV2,
            legacyQuestionToReadableV2,
            legacyDraftToStructuredDraft,
            structuredDraftToLegacyReviewDraft
        });
    }
);
