(function initDraftPersistenceService(root) {
    'use strict';

    const repositoryLocks = new WeakMap();

    const isRecord = value => Boolean(
        value && typeof value === 'object' && !Array.isArray(value)
    );
    const cloneValue = value => {
        if (Array.isArray(value)) return value.map(cloneValue);
        if (isRecord(value)) {
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

    class DraftPersistenceError extends Error {
        constructor(code, causeCode = '') {
            super(code);
            this.name = 'DraftPersistenceError';
            this.code = code;
            this.stage = 'draft-persistence';
            if (causeCode) this.causeCode = String(causeCode);
        }
    }

    const createError = (code, causeCode = '') =>
        new DraftPersistenceError(code, causeCode);

    const rethrowOrWrap = (error, fallbackCode) => {
        if (error instanceof DraftPersistenceError) throw error;
        const normalizedCode = String(error?.message || '');
        if (/^DRAFT_(?:PERSISTENCE|BATCH)_[A-Z_]+$/.test(normalizedCode)) {
            throw createError(normalizedCode);
        }
        throw createError(
            fallbackCode,
            error?.code || error?.name || 'storage-failure'
        );
    };

    const requireId = (value, code = 'DRAFT_PERSISTENCE_INPUT_INVALID') => {
        const id = String(value || '').trim();
        if (!id) throw createError(code);
        return id;
    };

    const requirePorts = (repository, names) => {
        if (!repository || names.some(name => typeof repository[name] !== 'function')) {
            throw createError('DRAFT_PERSISTENCE_REPOSITORY_REQUIRED');
        }
    };

    const withRepositoryLock = (repository, work) => {
        const previous = repositoryLocks.get(repository) || Promise.resolve();
        const current = previous.catch(() => undefined).then(work);
        repositoryLocks.set(repository, current);
        return current.finally(() => {
            if (repositoryLocks.get(repository) === current) {
                repositoryLocks.delete(repository);
            }
        });
    };

    const metadataSignature = commandValue => JSON.stringify({
        batch: {
            id: commandValue.batch.id,
            status: commandValue.batch.status,
            progress: commandValue.batch.progress,
            updatedAt: commandValue.batch.updatedAt
        },
        files: commandValue.files.map(file => ({
            id: file.id,
            batchId: file.batchId,
            parseStatus: file.parseStatus,
            updatedAt: file.updatedAt
        })).sort((left, right) => String(left.id).localeCompare(String(right.id))),
        drafts: commandValue.drafts.map(draft => ({
            id: draft.id,
            batchId: draft.batchId,
            version: draft.version,
            order: draft.order,
            status: draft.status,
            updatedAt: draft.updatedAt
        })).sort((left, right) => String(left.id).localeCompare(String(right.id)))
    });

    const normalizeCommand = commandValue => {
        if (
            !isRecord(commandValue) || !isRecord(commandValue.batch) ||
            !Array.isArray(commandValue.files) ||
            !Array.isArray(commandValue.drafts) || !commandValue.drafts.length
        ) {
            throw createError('DRAFT_PERSISTENCE_INPUT_INVALID');
        }
        const command = cloneValue(commandValue);
        const batchId = requireId(command.batch.id);
        const idempotencyKey = requireId(
            command.idempotencyKey,
            'DRAFT_PERSISTENCE_IDEMPOTENCY_KEY_REQUIRED'
        );
        if (
            !Number.isInteger(command.expectedVersion) ||
            command.expectedVersion < 0
        ) {
            throw createError('DRAFT_PERSISTENCE_VERSION_REQUIRED');
        }
        for (const rows of [command.files, command.drafts]) {
            for (const row of rows) {
                if (!isRecord(row) || !String(row.id || '').trim()) {
                    throw createError('DRAFT_PERSISTENCE_INPUT_INVALID');
                }
                if (String(row.batchId || '').trim() !== batchId) {
                    throw createError('DRAFT_PERSISTENCE_ASSOCIATION_INVALID');
                }
            }
            const ids = rows.map(row => String(row.id));
            if (new Set(ids).size !== ids.length) {
                throw createError('DRAFT_PERSISTENCE_DUPLICATE_ID');
            }
        }
        return {
            ...command,
            batchId,
            idempotencyKey,
            signature: metadataSignature(command)
        };
    };

    const currentVersion = batch => Number.isInteger(batch?.draftPersistence?.version)
        ? batch.draftPersistence.version
        : 0;

    const persistDraftBatch = async (rawCommand, repository) => {
        requirePorts(repository, [
            'get', 'persistReviewDraftBatch', 'loadDraftBatch'
        ]);
        const command = normalizeCommand(rawCommand);
        return withRepositoryLock(repository, async () => {
            try {
                const existing = await repository.get(
                    'draftImportBatches', command.batchId
                );
                if (!existing) throw createError('DRAFT_BATCH_NOT_FOUND');
                const persistence = existing.draftPersistence || {};
                if (persistence.idempotencyKey === command.idempotencyKey) {
                    if (persistence.signature !== command.signature) {
                        throw createError(
                            'DRAFT_PERSISTENCE_IDEMPOTENCY_CONFLICT'
                        );
                    }
                    const loaded = await repository.loadDraftBatch(command.batchId);
                    return immutable({
                        batch: loaded.batch,
                        draftCount: loaded.questions.length,
                        idempotent: true,
                        version: currentVersion(existing)
                    });
                }
                const version = currentVersion(existing);
                if (version !== command.expectedVersion) {
                    throw createError('DRAFT_PERSISTENCE_VERSION_CONFLICT');
                }
                const nextVersion = version + 1;
                const batch = {
                    ...command.batch,
                    draftPersistence: {
                        version: nextVersion,
                        idempotencyKey: command.idempotencyKey,
                        signature: command.signature
                    }
                };
                const result = await repository.persistReviewDraftBatch({
                    batch,
                    files: command.files,
                    drafts: command.drafts
                });
                const verified = await repository.get(
                    'draftImportBatches', command.batchId
                );
                if (
                    currentVersion(verified) !== nextVersion ||
                    verified?.draftPersistence?.idempotencyKey !==
                        command.idempotencyKey ||
                    verified?.draftPersistence?.signature !== command.signature
                ) {
                    throw createError('DRAFT_PERSISTENCE_VERSION_CONFLICT');
                }
                return immutable({
                    ...result,
                    idempotent: false,
                    version: nextVersion
                });
            } catch (error) {
                rethrowOrWrap(error, 'DRAFT_PERSISTENCE_WRITE_FAILED');
            }
        });
    };

    const reloadDraftBatch = async (batchIdValue, repository) => {
        requirePorts(repository, ['loadDraftBatch']);
        const batchId = requireId(batchIdValue, 'DRAFT_BATCH_ID_REQUIRED');
        let loaded;
        try {
            loaded = await repository.loadDraftBatch(batchId);
        } catch (error) {
            throw createError(
                'DRAFT_PERSISTENCE_RELOAD_FAILED',
                error?.code || error?.name || 'storage-failure'
            );
        }
        if (!loaded?.batch) throw createError('DRAFT_BATCH_NOT_FOUND');
        for (const rows of [loaded.files, loaded.questions, loaded.images]) {
            if (!Array.isArray(rows) || rows.some(row => row?.batchId !== batchId)) {
                throw createError('DRAFT_PERSISTENCE_ASSOCIATION_INVALID');
            }
        }
        return cloneValue(loaded);
    };

    const deleteDraftBatch = async (batchIdValue, repository, options = {}) => {
        requirePorts(repository, ['get', 'deleteDraftBatch']);
        const batchId = requireId(batchIdValue, 'DRAFT_BATCH_ID_REQUIRED');
        return withRepositoryLock(repository, async () => {
            try {
                const existing = await repository.get('draftImportBatches', batchId);
                if (!existing) {
                    return immutable({ deleted: true, idempotent: true });
                }
                if (
                    options.expectedVersion !== undefined &&
                    options.expectedVersion !== currentVersion(existing)
                ) {
                    throw createError('DRAFT_PERSISTENCE_VERSION_CONFLICT');
                }
                await repository.deleteDraftBatch(batchId);
                return immutable({ deleted: true, idempotent: false });
            } catch (error) {
                rethrowOrWrap(error, 'DRAFT_PERSISTENCE_DELETE_FAILED');
            }
        });
    };

    const api = Object.freeze({
        DraftPersistenceError,
        persistDraftBatch,
        reloadDraftBatch,
        deleteDraftBatch
    });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.DraftPersistenceService = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
