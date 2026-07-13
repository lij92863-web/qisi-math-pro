(function initPdfCandidateProjection(root) {
    'use strict';

    const FIELDS = Object.freeze([
        'questionNumber', 'stem', 'options', 'answer', 'solution', 'images'
    ]);
    const SUPPORT_FIELDS = new Set(['answer', 'solution']);
    const ALLOWED_SOURCE_MODES = new Set([
        'pdf-ai',
        'pdf-deterministic',
        'manual',
        'docx-deterministic',
        'imported-package'
    ]);
    const VOLATILE_KEYS = new Set([
        'requestId', 'timestamp', 'timestamps', 'createdAt', 'updatedAt',
        'durationMs', 'temporaryFilePath', 'tempFilePath', 'filePath'
    ]);

    class PdfCandidateProjectionError extends Error {
        constructor(code) {
            super(code);
            this.name = 'PdfCandidateProjectionError';
            this.code = code;
            this.stage = 'pdf-candidate-projection';
        }
    }

    const isRecord = value => Boolean(
        value && typeof value === 'object' && !Array.isArray(value)
    );

    const clone = value => {
        if (Array.isArray(value)) return value.map(clone);
        if (isRecord(value)) {
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
    const cleanString = value => String(value ?? '').trim();
    const normalizeQuestionNumber = value => {
        const match = cleanString(value).match(/\d{1,3}/);
        return match ? String(Number(match[0])) : '';
    };
    const fieldValue = (question, field) => {
        if (field === 'options' || field === 'images') {
            return Array.isArray(question?.[field]) ? clone(question[field]) : [];
        }
        return cleanString(question?.[field]);
    };
    const hasValue = value => Array.isArray(value)
        ? value.length > 0
        : Boolean(cleanString(value));

    function createError(code) {
        return new PdfCandidateProjectionError(code);
    }

    function deriveSourceMode(source, engineResult) {
        const explicit = [
            source?.mode,
            source?.manifest?.mode,
            source?.executionContext?.sourceMode,
            engineResult?.sourceMode,
            engineResult?.executionContext?.sourceMode,
            engineResult?.actualImportRoute
        ].map(cleanString).find(Boolean);
        if (explicit) {
            if (!ALLOWED_SOURCE_MODES.has(explicit)) {
                throw createError('source-mode-invalid');
            }
            return explicit;
        }

        const sourceKind = cleanString(
            engineResult?.sourceKind ||
            engineResult?.executionContext?.sourceKind
        ).toLowerCase().replace(/[\s_-]+/g, '');
        if (/^(textlayer|pdftext|deterministictext)$/.test(sourceKind)) {
            return 'pdf-deterministic';
        }
        if (/^(ocrmarkdown|ocr|vision|pdfocr|aimarkdown)$/.test(sourceKind)) {
            return 'pdf-ai';
        }
        throw createError('source-mode-missing');
    }

    function assertControlledWrite(decision) {
        if (
            !isRecord(decision) ||
            !Array.isArray(decision.fieldDecisions) ||
            !Array.isArray(decision.effectiveAnswerItems) ||
            !Array.isArray(decision.effectiveSolutionItems) ||
            !isRecord(decision.controlledWriteSummary)
        ) {
            throw createError('controlled-write-missing');
        }
        return decision;
    }

    function decisionFor(decision, questionNumber, field) {
        return decision.fieldDecisions.find(item =>
            normalizeQuestionNumber(item?.questionNumber) === questionNumber &&
            item?.field === field
        ) || null;
    }

    function supportItemFor(decision, questionNumber, field) {
        const items = field === 'answer'
            ? decision.effectiveAnswerItems
            : decision.effectiveSolutionItems;
        return items.find(item =>
            normalizeQuestionNumber(
                item?.questionNumber ?? item?.question ?? item?.no ?? item?.order
            ) === questionNumber
        ) || null;
    }

    function supportItemValue(item, field) {
        if (!isRecord(item)) return '';
        if (field === 'answer') {
            return cleanString(item.answer ?? item.answerRaw ?? item.value);
        }
        return cleanString(item.solution ?? item.solutionRaw ?? item.explanation);
    }

    function stableCode(value, fallback = 'pdf-projection-warning') {
        const raw = cleanString(value);
        return /^[a-zA-Z0-9_.:-]{1,100}$/.test(raw) ? raw : fallback;
    }

    function warningOf(value) {
        if (typeof value === 'string') return { code: stableCode(value) };
        if (!isRecord(value)) return null;
        const warning = { code: stableCode(value.code || value.reason) };
        if (value.field && FIELDS.includes(value.field)) warning.field = value.field;
        const questionNumber = normalizeQuestionNumber(value.questionNumber);
        if (questionNumber) warning.questionNumber = questionNumber;
        return warning;
    }

    function stableWarnings(...lists) {
        const seen = new Set();
        const warnings = [];
        for (const value of lists.flat()) {
            const warning = warningOf(value);
            if (!warning) continue;
            const key = JSON.stringify(warning);
            if (seen.has(key)) continue;
            seen.add(key);
            warnings.push(warning);
        }
        return warnings;
    }

    function evidencePage(fieldEvidence, item, pageContext) {
        const values = [
            fieldEvidence?.page,
            item?.page,
            item?.sourceTrace?.page,
            item?.evidence?.page,
            pageContext?.page
        ];
        const page = values.find(value => Number.isInteger(Number(value)) && Number(value) > 0);
        return page === undefined ? null : Number(page);
    }

    function evidenceBlockIds(fieldEvidence, item) {
        const values = [
            ...(Array.isArray(fieldEvidence?.blockIds) ? fieldEvidence.blockIds : []),
            ...(Array.isArray(item?.blockIds) ? item.blockIds : []),
            ...(Array.isArray(item?.sourceTrace?.blockIds) ? item.sourceTrace.blockIds : []),
            item?.evidenceId,
            item?.evidence?.evidenceId,
            item?.sourceTrace?.blockId
        ];
        return [...new Set(values.map(cleanString).filter(Boolean))];
    }

    function provenanceEntry({
        kind,
        sourceId,
        page,
        blockIds,
        engine,
        decisionId,
        manuallyEdited = false,
        reason
    }) {
        return {
            kind,
            status: kind,
            sourceId,
            page,
            blockIds,
            engine,
            controlledWriteDecisionId: decisionId,
            manuallyEdited,
            reason,
            reasonCode: reason
        };
    }

    function projectionForField({
        field,
        mode,
        rawValue,
        fieldEvidence,
        item,
        decision,
        sourceId,
        pageContext,
        engine,
        decisionId
    }) {
        const accepted = decision && decision.source !== 'none' && item;
        const rejected = decision && decision.source === 'none';
        const page = evidencePage(fieldEvidence, item, pageContext);
        const blockIds = evidenceBlockIds(fieldEvidence, item);

        if (SUPPORT_FIELDS.has(field)) {
            if (accepted) {
                return {
                    value: supportItemValue(item, field),
                    provenance: provenanceEntry({
                        kind: 'controlled-write', sourceId, page, blockIds,
                        engine, decisionId, reason: cleanString(decision.reason) ||
                            'controlled-write-accepted'
                    })
                };
            }
            return {
                value: '',
                provenance: provenanceEntry({
                    kind: rejected ? 'rejected' : 'missing',
                    sourceId, page, blockIds, engine, decisionId,
                    reason: rejected
                        ? cleanString(decision.reason) || 'controlled-write-rejected'
                        : `${field}-missing`
                })
            };
        }

        if (mode === 'pdf-ai') {
            if (accepted) {
                return {
                    value: rawValue,
                    provenance: provenanceEntry({
                        kind: 'controlled-write', sourceId, page, blockIds,
                        engine, decisionId, reason: cleanString(decision.reason) ||
                            'controlled-write-accepted'
                    })
                };
            }
            return {
                value: Array.isArray(rawValue) ? [] : '',
                provenance: provenanceEntry({
                    kind: hasValue(rawValue) ? 'rejected' : 'missing',
                    sourceId, page, blockIds, engine, decisionId,
                    reason: hasValue(rawValue)
                        ? 'pdf-ai-controlled-write-field-missing'
                        : `${field}-missing`
                })
            };
        }

        if (
            mode === 'manual' &&
            fieldEvidence?.manuallyEdited === true
        ) {
            return {
                value: rawValue,
                provenance: provenanceEntry({
                    kind: 'manual', sourceId, page, blockIds, engine,
                    decisionId, manuallyEdited: true, reason: 'manual-field-edit'
                })
            };
        }

        const evidenceExists = isRecord(fieldEvidence);
        const kind = evidenceExists && (hasValue(rawValue) || Array.isArray(rawValue))
            ? 'deterministic-source'
            : 'missing';
        return {
            value: kind === 'missing'
                ? (Array.isArray(rawValue) ? [] : '')
                : rawValue,
            provenance: provenanceEntry({
                kind, sourceId, page, blockIds, engine, decisionId,
                reason: kind === 'deterministic-source'
                    ? 'deterministic-source-evidence'
                    : `${field}-missing`
            })
        };
    }

    function evidenceReferences(evidence, fieldRows) {
        const refs = Array.isArray(evidence?.rawEvidenceRefs)
            ? evidence.rawEvidenceRefs.map(clone)
            : [];
        for (const row of Object.values(fieldRows)) {
            for (const blockId of row.provenance.blockIds) {
                refs.push({ evidenceId: blockId });
            }
        }
        const seen = new Set();
        return refs.filter(ref => {
            if (!isRecord(ref)) return false;
            const identity = cleanString(
                ref.evidenceId || ref.imageId || ref.blockId || ref.id
            );
            const key = identity || JSON.stringify(ref);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function projectPdfCandidate(input = {}) {
        const sourceId = cleanString(input.source?.sourceId || input.source?.id);
        if (!sourceId) throw createError('source-id-missing');
        const sourceMode = deriveSourceMode(input.source, input.engineResult);
        const controlledWrite = assertControlledWrite(
            input.controlledWriteDecision
        );
        const question = isRecord(input.parsedQuestion)
            ? input.parsedQuestion
            : {};
        const rawQuestionNumber = normalizeQuestionNumber(
            question.questionNumber ?? question.question ?? question.no ?? question.order
        );
        const engine = cleanString(
            input.engineResult?.engine ||
            input.engineResult?.executionContext?.engine
        );
        const decisionId = cleanString(controlledWrite.decisionId);
        const fieldRows = {};

        for (const field of FIELDS) {
            const decision = decisionFor(
                controlledWrite, rawQuestionNumber, field
            );
            const item = SUPPORT_FIELDS.has(field)
                ? supportItemFor(controlledWrite, rawQuestionNumber, field)
                : null;
            fieldRows[field] = projectionForField({
                field,
                mode: sourceMode,
                rawValue: field === 'questionNumber'
                    ? rawQuestionNumber
                    : fieldValue(question, field),
                fieldEvidence: input.evidence?.fields?.[field],
                item,
                decision,
                sourceId,
                pageContext: input.pageContext,
                engine,
                decisionId
            });
        }

        const rawJsonCandidate = question.rawJsonCandidate === true;
        if (rawJsonCandidate) {
            for (const field of FIELDS) {
                const row = fieldRows[field];
                row.value = Array.isArray(row.value) ? [] : '';
                row.provenance.kind = 'rejected';
                row.provenance.status = 'rejected';
                row.provenance.reason = 'raw-json-candidate';
                row.provenance.reasonCode = 'raw-json-candidate';
            }
        }

        const safeQuestionNumbers = new Set(
            (input.alignmentResult?.safeQuestionNumbers || [])
                .map(normalizeQuestionNumber)
                .filter(Boolean)
        );
        const fusedQuestionNumbers = new Set(
            (input.alignmentResult?.fusedQuestionNumbers || [])
                .map(normalizeQuestionNumber)
                .filter(Boolean)
        );
        const alignmentMode = cleanString(input.alignmentResult?.mode);
        const isAligned = Boolean(
            rawQuestionNumber &&
            safeQuestionNumbers.has(rawQuestionNumber) &&
            !fusedQuestionNumbers.has(rawQuestionNumber) &&
            alignmentMode !== 'fail-closed'
        );
        const validation = {
            schemaValid: input.validation?.schemaValid === true &&
                !rawJsonCandidate &&
                Boolean(cleanString(question.type)) &&
                isRecord(question),
            sequenceValid: input.validation?.sequenceValid === true && isAligned,
            ownershipValid: input.validation?.ownershipValid === true
        };

        const provenance = Object.fromEntries(
            FIELDS.map(field => [field, fieldRows[field].provenance])
        );
        const kinds = Object.values(provenance).map(item => item.kind);
        const coreRejected = ['questionNumber', 'stem'].some(field =>
            ['rejected', 'missing'].includes(provenance[field].kind)
        );
        const validityRejected = !validation.schemaValid ||
            !validation.sequenceValid ||
            !validation.ownershipValid;
        let supportLevel = 'rejected';
        if (!coreRejected && !validityRejected) {
            if (alignmentMode === 'prefix') {
                supportLevel = 'prefix';
            } else if (kinds.some(kind => ['rejected', 'missing'].includes(kind))) {
                supportLevel = 'safe-partial';
            } else {
                supportLevel = 'full';
            }
        }

        const warnings = stableWarnings(
            input.engineResult?.warnings || [],
            input.alignmentResult?.warnings || [],
            input.alignmentResult?.fusedWarnings || [],
            controlledWrite.warnings || [],
            input.evidence?.formulaFallback ? [{ code: 'formula-fallback' }] : [],
            input.evidence?.engineConflict ? [{ code: 'engine-conflict' }] : [],
            rawJsonCandidate ? [{ code: 'raw-json-candidate' }] : []
        );
        const acceptedFields = [];
        const rejectedFields = [];
        for (const field of FIELDS) {
            const decision = decisionFor(controlledWrite, rawQuestionNumber, field);
            if (decision?.source && decision.source !== 'none') {
                acceptedFields.push(field);
            } else if (decision?.source === 'none') {
                rejectedFields.push(field);
            }
        }
        const incompleteProvenance = Object.values(provenance).some(item =>
            !item.sourceId || item.page === null ||
            (item.kind === 'controlled-write' && !item.controlledWriteDecisionId)
        );
        const manualReviewRequired = supportLevel !== 'full' ||
            kinds.some(kind => ['rejected', 'missing'].includes(kind)) ||
            input.evidence?.formulaFallback === true ||
            alignmentMode === 'prefix' ||
            input.evidence?.engineConflict === true ||
            incompleteProvenance ||
            input.evidence?.userInterventionRequired === true;

        return immutable({
            id: cleanString(question.id),
            source: {
                sourceId,
                sourceType: cleanString(input.source?.sourceType) || 'pdf',
                mode: sourceMode,
                page: evidencePage(null, null, input.pageContext),
                sourceOrder: Number.isFinite(Number(
                    input.source?.sourceOrder ?? input.pageContext?.sourceOrder
                ))
                    ? Number(input.source?.sourceOrder ?? input.pageContext?.sourceOrder)
                    : null
            },
            questionNumber: fieldRows.questionNumber.value,
            type: rawJsonCandidate ? '' : cleanString(question.type),
            stem: fieldRows.stem.value,
            options: fieldRows.options.value,
            answer: fieldRows.answer.value,
            solution: fieldRows.solution.value,
            images: fieldRows.images.value,
            fieldProvenance: provenance,
            supportLevel,
            manualReviewRequired,
            controlledWrite: {
                evaluated: true,
                decisionId,
                acceptedFields,
                rejectedFields,
                errors: validityRejected
                    ? [
                        !validation.schemaValid ? { code: 'schema-invalid' } : null,
                        !validation.sequenceValid ? { code: 'sequence-invalid' } : null,
                        !validation.ownershipValid ? { code: 'ownership-invalid' } : null
                    ].filter(Boolean)
                    : [],
                warnings: stableWarnings(controlledWrite.warnings || [])
            },
            validation,
            warnings,
            rawEvidenceRefs: evidenceReferences(input.evidence, fieldRows),
            diagnostics: {
                requestId: cleanString(
                    input.engineResult?.requestId || input.evidence?.requestId
                ),
                controlledWriteDecisionId: decisionId
            }
        });
    }

    function stripVolatile(value) {
        if (Array.isArray(value)) return value.map(stripVolatile);
        if (!isRecord(value)) return value;
        return Object.fromEntries(
            Object.entries(value)
                .filter(([key]) => !VOLATILE_KEYS.has(key))
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, item]) => [key, stripVolatile(item)])
        );
    }

    function stableWarningCodes(candidate) {
        return [...new Set((candidate?.warnings || []).map(item =>
            typeof item === 'string' ? stableCode(item) : stableCode(item?.code)
        ))].sort();
    }

    function stableEvidenceIdentities(candidate) {
        return [...new Set((candidate?.rawEvidenceRefs || []).map(ref => {
            if (!isRecord(ref)) return cleanString(ref);
            const identity = cleanString(
                ref.evidenceId || ref.imageId || ref.blockId || ref.id
            );
            return identity || JSON.stringify(stripVolatile(ref));
        }).filter(Boolean))].sort();
    }

    function same(left, right) {
        return JSON.stringify(stripVolatile(left)) ===
            JSON.stringify(stripVolatile(right));
    }

    function compareCanonicalPdfCandidates(legacy, bridge) {
        const checks = [
            ['source.mode', legacy?.source?.mode, bridge?.source?.mode, 'error'],
            ['source.sourceOrder', legacy?.source?.sourceOrder, bridge?.source?.sourceOrder, 'error'],
            ['questionNumber', legacy?.questionNumber, bridge?.questionNumber, 'error'],
            ['type', legacy?.type, bridge?.type, 'error'],
            ['stem', legacy?.stem, bridge?.stem, 'error'],
            ['options', legacy?.options, bridge?.options, 'error'],
            ['answer', legacy?.answer, bridge?.answer, 'error'],
            ['solution', legacy?.solution, bridge?.solution, 'error'],
            ['images', legacy?.images, bridge?.images, 'error'],
            ...FIELDS.map(field => [
                `fieldProvenance.${field}.kind`,
                legacy?.fieldProvenance?.[field]?.kind ||
                    legacy?.fieldProvenance?.[field]?.status,
                bridge?.fieldProvenance?.[field]?.kind ||
                    bridge?.fieldProvenance?.[field]?.status,
                'error'
            ]),
            [
                'controlledWrite.acceptedFields',
                legacy?.controlledWrite?.acceptedFields,
                bridge?.controlledWrite?.acceptedFields,
                'error'
            ],
            [
                'controlledWrite.rejectedFields',
                legacy?.controlledWrite?.rejectedFields,
                bridge?.controlledWrite?.rejectedFields,
                'error'
            ],
            ['supportLevel', legacy?.supportLevel, bridge?.supportLevel, 'error'],
            [
                'manualReviewRequired',
                legacy?.manualReviewRequired,
                bridge?.manualReviewRequired,
                'error'
            ],
            [
                'validation.schemaValid',
                legacy?.validation?.schemaValid,
                bridge?.validation?.schemaValid,
                'error'
            ],
            [
                'validation.sequenceValid',
                legacy?.validation?.sequenceValid,
                bridge?.validation?.sequenceValid,
                'error'
            ],
            [
                'validation.ownershipValid',
                legacy?.validation?.ownershipValid,
                bridge?.validation?.ownershipValid,
                'error'
            ],
            [
                'warnings',
                stableWarningCodes(legacy),
                stableWarningCodes(bridge),
                'warning'
            ],
            [
                'rawEvidenceRefs',
                stableEvidenceIdentities(legacy),
                stableEvidenceIdentities(bridge),
                'warning'
            ]
        ];

        return checks.filter(([, left, right]) => !same(left, right))
            .map(([path, left, right, severity]) => ({
                path,
                legacyValue: clone(left),
                bridgeValue: clone(right),
                severity
            }));
    }

    const api = Object.freeze({
        FIELDS,
        PdfCandidateProjectionError,
        projectPdfCandidate,
        compareCanonicalPdfCandidates
    });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.PdfCandidateProjection = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
