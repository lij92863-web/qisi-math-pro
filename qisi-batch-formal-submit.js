(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.BatchFormalSubmit = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const dependencyError = message => Object.assign(
        new TypeError(message),
        { code: 'BATCH_FORMAL_SUBMIT_DEPENDENCY_REQUIRED' }
    );

    const createBatchFormalSubmit = ({
        policy,
        repository,
        createStateMachine,
        clock = () => Date.now(),
        random = () => Math.random()
    } = {}) => {
        if (
            typeof policy?.createAdmissionContext !== 'function' ||
            typeof policy?.evaluateDraftAdmission !== 'function'
        ) {
            throw dependencyError('Formal Admission Policy is required.');
        }
        if (
            typeof repository?.loadDraft !== 'function' ||
            typeof repository?.confirmDraftToQuestion !== 'function'
        ) {
            throw dependencyError('Formal question repository is required.');
        }
        if (typeof createStateMachine !== 'function') {
            throw dependencyError('Import State Machine is required.');
        }

        const submit = async ({
            draft,
            draftId: inputDraftId,
            batchId = '',
            expectedDraftVersion: inputExpectedVersion,
            imageRecords = [],
            actorId = 'local-teacher',
            requestId: inputRequestId = '',
            idempotencyKey: inputIdempotencyKey = '',
            questionId: inputQuestionId = '',
            signal
        } = {}) => {
            const draftId = String(inputDraftId || draft?.id || '').trim();
            const expectedDraftVersion = Number.isInteger(inputExpectedVersion)
                ? inputExpectedVersion
                : draft?.version;
            if (!draftId || !Number.isInteger(expectedDraftVersion)) {
                const error = new TypeError('Draft identity and version are required.');
                error.code = 'BATCH_FORMAL_SUBMIT_INPUT_INVALID';
                throw error;
            }
            if (signal?.aborted) {
                const error = new Error('Formal submission was cancelled.');
                error.name = 'AbortError';
                error.code = 'FORMAL_SUBMIT_CANCELLED';
                throw error;
            }
            const freshDraft = await repository.loadDraft(draftId);
            if (
                !freshDraft || freshDraft.id !== draftId ||
                freshDraft.version !== expectedDraftVersion ||
                (batchId && freshDraft.batchId !== batchId)
            ) {
                const error = new Error('Formal submission draft is stale.');
                error.code = 'BATCH_FORMAL_SUBMIT_STALE_DRAFT';
                throw error;
            }
            if (freshDraft.status !== 'reviewed') {
                const error = new Error('Draft must be reviewed before submission.');
                error.code = 'BATCH_FORMAL_SUBMIT_NOT_REVIEWED';
                throw error;
            }
            const clockValue = clock();
            const evaluatedAt = new Date(clockValue).toISOString();
            const requestId = inputRequestId ||
                `batch-submit:${draftId}:${expectedDraftVersion}`;
            const idempotencyKey = inputIdempotencyKey || requestId;
            const context = policy.createAdmissionContext({
                mode: freshDraft?.producer?.mode ||
                    freshDraft?.source?.mode || '',
                actorId,
                explicitConfirmation: true,
                requestId,
                idempotencyKey,
                evaluatedAt,
                source: freshDraft?.source || {},
                producer: freshDraft?.producer || {},
                route: freshDraft?.route || {}
            });
            let decision = null;
            let committed = null;
            const questionId = inputQuestionId ||
                `q_${clockValue}_${random().toString(36).slice(2, 7)}`;
            const machine = createStateMachine({
                initialState: 'WAITING_CONFIRMATION',
                commands: {
                    'teacher-confirm': () => {
                        decision = policy.evaluateDraftAdmission(
                            freshDraft,
                            context
                        );
                    },
                    admitted: async () => {
                        committed = await repository.confirmDraftToQuestion(
                            draftId,
                            decision,
                            {
                                expectedDraftVersion,
                                idempotencyKey,
                                actorId,
                                requestId,
                                questionId,
                                context,
                                imageRecords
                            }
                        );
                    }
                }
            });
            if (
                !machine || typeof machine.transition !== 'function' ||
                typeof machine.snapshot !== 'function'
            ) throw new TypeError('Import State Machine is malformed.');
            const trace = [machine.snapshot()];
            const transition = async trigger => {
                try {
                    const snapshot = await machine.transition(trigger);
                    trace.push(snapshot);
                    return snapshot;
                } catch (error) {
                    trace.push(machine.snapshot());
                    throw error;
                }
            };
            const stopIfCancelled = async () => {
                if (!signal?.aborted) return;
                await transition('cancel');
                const error = new Error('Formal submission was cancelled.');
                error.name = 'AbortError';
                error.code = 'FORMAL_SUBMIT_CANCELLED';
                throw error;
            };
            await stopIfCancelled();
            await transition('teacher-confirm');
            await stopIfCancelled();
            if (!decision.accepted) {
                await transition('admission-rejected');
                return {
                    accepted: false,
                    decision,
                    state: machine.snapshot(),
                    trace: Object.freeze([...trace])
                };
            }
            await transition('admitted');
            await transition('repository-committed');
            return {
                accepted: true,
                decision,
                committed,
                state: machine.snapshot(),
                trace: Object.freeze([...trace])
            };
        };

        return Object.freeze({ submit });
    };

    return Object.freeze({ createBatchFormalSubmit });
});
