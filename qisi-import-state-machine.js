(function initImportStateMachine(globalScope) {
    'use strict';

    const STATES = Object.freeze([
        'IDLE', 'PREPARING', 'LOADING_SOURCE', 'RECOGNIZING', 'NORMALIZING',
        'STRUCTURING', 'VALIDATING', 'BUILDING_REVIEW', 'PERSISTING_DRAFT',
        'WAITING_CONFIRMATION', 'FORMAL_ADMISSION', 'COMMITTING', 'COMPLETED',
        'CANCELLED', 'FAILED'
    ]);

    const rawTransitions = [
        ['IDLE', 'start', 'PREPARING', 'IMPORT_START_INVALID'],
        ['PREPARING', 'prepared', 'LOADING_SOURCE', 'IMPORT_CONTEXT_INVALID'],
        ['LOADING_SOURCE', 'recognition-source-loaded', 'RECOGNIZING', 'IMPORT_RECOGNITION_FAILED'],
        ['LOADING_SOURCE', 'deterministic-source-loaded', 'NORMALIZING', 'IMPORT_SOURCE_LOAD_FAILED'],
        ['LOADING_SOURCE', 'draft-already-committed', 'WAITING_CONFIRMATION', 'IMPORT_DRAFT_PERSIST_FAILED'],
        ['RECOGNIZING', 'recognition-complete', 'NORMALIZING', 'IMPORT_RECOGNITION_FAILED'],
        ['NORMALIZING', 'normalized', 'STRUCTURING', 'IMPORT_NORMALIZATION_FAILED'],
        ['STRUCTURING', 'structured', 'VALIDATING', 'IMPORT_STRUCTURE_FAILED'],
        ['VALIDATING', 'validation-complete', 'BUILDING_REVIEW', 'IMPORT_VALIDATION_FAILED'],
        ['BUILDING_REVIEW', 'review-built', 'PERSISTING_DRAFT', 'IMPORT_REVIEW_BUILD_FAILED'],
        ['PERSISTING_DRAFT', 'draft-transaction-committed', 'WAITING_CONFIRMATION', 'IMPORT_DRAFT_PERSIST_FAILED'],
        ['WAITING_CONFIRMATION', 'teacher-confirm', 'FORMAL_ADMISSION', 'IMPORT_CONFIRMATION_STALE'],
        ['FORMAL_ADMISSION', 'admitted', 'COMMITTING', 'IMPORT_ADMISSION_REJECTED'],
        ['COMMITTING', 'repository-committed', 'COMPLETED', 'IMPORT_COMMIT_FAILED'],
        ['PREPARING', 'cancel', 'CANCELLED', 'IMPORT_CANCELLED_PREPARING'],
        ['LOADING_SOURCE', 'cancel', 'CANCELLED', 'IMPORT_CANCELLED_LOADING'],
        ['RECOGNIZING', 'cancel', 'CANCELLED', 'IMPORT_CANCELLED_RECOGNITION'],
        ['NORMALIZING', 'cancel', 'CANCELLED', 'IMPORT_CANCELLED_NORMALIZING'],
        ['STRUCTURING', 'cancel', 'CANCELLED', 'IMPORT_CANCELLED_STRUCTURING'],
        ['VALIDATING', 'cancel', 'CANCELLED', 'IMPORT_CANCELLED_VALIDATING'],
        ['BUILDING_REVIEW', 'cancel', 'CANCELLED', 'IMPORT_CANCELLED_REVIEW_BUILD'],
        ['PERSISTING_DRAFT', 'cancel', 'CANCELLED', 'IMPORT_CANCELLED_PERSISTING'],
        ['WAITING_CONFIRMATION', 'cancel', 'CANCELLED', 'IMPORT_CANCELLED_REVIEW'],
        ['FORMAL_ADMISSION', 'cancel', 'CANCELLED', 'IMPORT_CANCELLED_ADMISSION'],
        ['RECOGNIZING', 'command-failed', 'FAILED', 'IMPORT_RECOGNITION_FAILED'],
        ['PERSISTING_DRAFT', 'transaction-failed', 'FAILED', 'IMPORT_DRAFT_PERSIST_FAILED'],
        ['FORMAL_ADMISSION', 'admission-rejected', 'WAITING_CONFIRMATION', 'IMPORT_ADMISSION_REJECTED'],
        ['FAILED', 'retry', 'PREPARING', 'IMPORT_RETRY_EXHAUSTED'],
        ['CANCELLED', 'reset', 'IDLE', 'IMPORT_RESET_UNSAFE'],
        ['COMPLETED', 'reset', 'IDLE', 'IMPORT_RESET_UNSAFE']
    ];

    const TRANSITIONS = Object.freeze(rawTransitions.map(([from, trigger, to, errorCode]) =>
        Object.freeze({ from, trigger, to, errorCode })
    ));
    const transitionByKey = new Map(TRANSITIONS.map(item => [`${item.from}:${item.trigger}`, item]));
    const PROGRESS = Object.freeze({
        IDLE: 0, PREPARING: 2, LOADING_SOURCE: 10, RECOGNIZING: 25,
        NORMALIZING: 45, STRUCTURING: 55, VALIDATING: 65,
        BUILDING_REVIEW: 75, PERSISTING_DRAFT: 85, WAITING_CONFIRMATION: 90,
        FORMAL_ADMISSION: 94, COMMITTING: 98, COMPLETED: 100
    });

    function stableError(code) {
        const error = new Error(code);
        error.code = code;
        return error;
    }

    function freezeSnapshot(value) {
        if (value.error) Object.freeze(value.error);
        return Object.freeze(value);
    }

    function createImportStateMachine(options = {}) {
        const commands = options.commands && typeof options.commands === 'object'
            ? options.commands
            : {};
        const initialState = options.initialState || 'IDLE';
        if (!['IDLE', 'WAITING_CONFIRMATION'].includes(initialState)) {
            throw stableError('IMPORT_INITIAL_STATE_INVALID');
        }
        const maxRetries = Number.isInteger(options.maxRetries) && options.maxRetries >= 0
            ? options.maxRetries
            : 2;
        const clock = typeof options.clock === 'function' ? options.clock : Date.now;
        let abortController = new AbortController();
        let activeToken = null;
        let retryCount = 0;
        let data = {
            state: initialState,
            progress: PROGRESS[initialState] || 0,
            sequence: 0, retryCount: 0,
            error: null, updatedAt: clock()
        };

        const snapshot = () => freezeSnapshot({
            state: data.state,
            progress: data.progress,
            sequence: data.sequence,
            retryCount: data.retryCount,
            error: data.error ? { ...data.error } : null,
            updatedAt: data.updatedAt
        });

        const setState = (state, error = null, resetProgress = false) => {
            const nextProgress = PROGRESS[state];
            data = {
                state,
                progress: resetProgress ? (nextProgress || 0) : Math.max(
                    data.progress,
                    Number.isFinite(nextProgress) ? nextProgress : data.progress
                ),
                sequence: data.sequence + 1,
                retryCount,
                error,
                updatedAt: clock()
            };
            return snapshot();
        };

        const cancel = () => {
            const edge = transitionByKey.get(`${data.state}:cancel`);
            if (!edge) {
                throw stableError(data.state === 'COMMITTING'
                    ? 'IMPORT_COMMIT_NOT_CANCELLABLE'
                    : 'IMPORT_INVALID_TRANSITION');
            }
            abortController.abort();
            activeToken = Symbol('cancelled');
            return setState('CANCELLED', { code: edge.errorCode, retryable: true });
        };

        const transition = async (trigger, payload) => {
            if (trigger === 'cancel') return cancel();
            const edge = transitionByKey.get(`${data.state}:${trigger}`);
            if (!edge) throw stableError('IMPORT_INVALID_TRANSITION');
            if (trigger === 'retry') {
                if (!data.error?.retryable || retryCount >= maxRetries) {
                    throw stableError('IMPORT_RETRY_EXHAUSTED');
                }
                retryCount += 1;
                abortController = new AbortController();
            }
            if (trigger === 'reset') {
                retryCount = 0;
                abortController = new AbortController();
            }

            const token = Symbol(trigger);
            activeToken = token;
            setState(edge.to, null, trigger === 'reset');
            const command = commands[trigger];
            if (typeof command !== 'function') return snapshot();

            try {
                await command({ snapshot: snapshot(), payload, signal: abortController.signal });
                return snapshot();
            } catch (cause) {
                if (activeToken !== token || data.state === 'CANCELLED') return snapshot();
                const error = { code: edge.errorCode, retryable: cause?.retryable === true };
                setState('FAILED', error);
                throw stableError(edge.errorCode);
            }
        };

        return Object.freeze({ snapshot, transition, cancel });
    }

    const api = Object.freeze({ STATES, TRANSITIONS, createImportStateMachine });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (globalScope) {
        globalScope.Qisi = globalScope.Qisi || {};
        globalScope.Qisi.ImportStateMachine = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
