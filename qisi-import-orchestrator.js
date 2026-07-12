(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.ImportOrchestrator = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    class ImportError extends Error {
        constructor(code, message, stage, cause = null) {
            super(message);
            this.name = 'ImportError';
            this.code = code;
            this.stage = stage;
            this.recoverable = code !== 'validation-failed';
            this.cause = cause;
        }
    }

    const choosePath = source => {
        const type = String(source?.type || source?.fileType || '').toLowerCase();
        const name = String(source?.name || source?.filename || '').toLowerCase();
        if (type === 'docx' || /\.docx?$/.test(name)) return 'docx';
        if (type === 'pdf' || /\.pdf$/.test(name)) return 'pdf';
        if (type === 'batch') return 'batch';
        return 'unsupported';
    };

    const createImportOrchestrator = ({
        handlers = {},
        validate,
        handoff = async result => result
    } = {}) => {
        const running = new Set();

        const run = async (source, {
            signal,
            onProgress = () => {},
            path: requestedPath = ''
        } = {}) => {
            const id = String(source?.id || source?.batchId || source?.name || '');
            if (!id) throw new ImportError('missing-source', 'Source ID is required.', 'intake');
            if (running.has(id)) {
                throw new ImportError('duplicate-run', `Import ${id} is already running.`, 'intake');
            }
            const ensureActive = stage => {
                if (signal?.aborted) {
                    throw new ImportError('cancelled', 'Import was cancelled.', stage);
                }
            };
            const path = requestedPath || choosePath(source);
            const handler = handlers[path];
            if (typeof handler !== 'function') {
                throw new ImportError(
                    'unsupported-source',
                    `No import handler for ${path}.`,
                    'routing'
                );
            }
            running.add(id);
            try {
                ensureActive('intake');
                onProgress({ stage: 'intake', progress: 0, path });
                let candidates;
                try {
                    candidates = await handler(source, { signal, onProgress });
                } catch (error) {
                    if (error instanceof ImportError) throw error;
                    throw new ImportError(
                        'handler-failed',
                        error?.message || 'Import handler failed.',
                        path,
                        error
                    );
                }
                ensureActive('validation');
                const aggregated = Array.isArray(candidates)
                    ? candidates.flat().filter(Boolean)
                    : candidates;
                if (typeof validate !== 'function') {
                    throw new ImportError(
                        'validator-required',
                        'An import validator is required.',
                        'validation'
                    );
                }
                let validation;
                try {
                    validation = await validate(aggregated, { source, path });
                } catch (error) {
                    if (error instanceof ImportError) throw error;
                    throw new ImportError(
                        'validator-failed',
                        'Import validator failed.',
                        'validation',
                        error
                    );
                }
                if (
                    !validation ||
                    typeof validation !== 'object' ||
                    Array.isArray(validation) ||
                    typeof validation.valid !== 'boolean' ||
                    (
                        validation.errors !== undefined &&
                        !Array.isArray(validation.errors)
                    ) ||
                    (
                        validation.warnings !== undefined &&
                        !Array.isArray(validation.warnings)
                    )
                ) {
                    throw new ImportError(
                        'validator-malformed',
                        'Import validator returned a malformed result.',
                        'validation'
                    );
                }
                if (!validation?.valid) {
                    throw new ImportError(
                        'validation-failed',
                        validation?.errors?.[0]?.message || 'Candidate validation failed.',
                        'validation'
                    );
                }
                ensureActive('handoff');
                onProgress({ stage: 'handoff', progress: 90, path });
                const review = await handoff(
                    validation.value ?? aggregated,
                    { source, path, validation }
                );
                ensureActive('complete');
                onProgress({ stage: 'complete', progress: 100, path });
                return { path, candidates: aggregated, validation, review };
            } finally {
                running.delete(id);
            }
        };

        return Object.freeze({ run, choosePath, isRunning: id => running.has(String(id)) });
    };

    return Object.freeze({ ImportError, choosePath, createImportOrchestrator });
});
