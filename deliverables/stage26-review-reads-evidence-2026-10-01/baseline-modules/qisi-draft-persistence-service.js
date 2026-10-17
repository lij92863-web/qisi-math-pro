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

    const assertActive = signal => {
        if (!signal?.aborted) return;
        const error = createError('DRAFT_PERSISTENCE_CANCELLED');
        error.name = 'AbortError';
        throw error;
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

    const metadataSignature = commandValue => {
        const metadata = {
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
        };
        if (Array.isArray(commandValue.images)) {
            metadata.images = commandValue.images.map(image => ({
                id: image.id,
                batchId: image.batchId,
                questionId: image.questionId,
                status: image.status,
                updatedAt: image.updatedAt
            })).sort((left, right) => String(left.id).localeCompare(String(right.id)));
        }
        return JSON.stringify(metadata);
    };

    const normalizeCommand = commandValue => {
        if (
            !isRecord(commandValue) || !isRecord(commandValue.batch) ||
            !Array.isArray(commandValue.files) ||
            !Array.isArray(commandValue.drafts) ||
            (
                commandValue.images !== undefined &&
                !Array.isArray(commandValue.images)
            )
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
        for (const rows of [
            command.files,
            command.drafts,
            ...(Array.isArray(command.images) ? [command.images] : [])
        ]) {
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
        const signal = rawCommand?.signal;
        assertActive(signal);
        const command = normalizeCommand(rawCommand);
        return withRepositoryLock(repository, async () => {
            try {
                assertActive(signal);
                const existing = await repository.get(
                    'draftImportBatches', command.batchId
                );
                assertActive(signal);
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
                    drafts: command.drafts,
                    images: command.images,
                    signal,
                    expectedVersion: command.expectedVersion
                });
                assertActive(signal);
                const verified = await repository.get(
                    'draftImportBatches', command.batchId
                );
                assertActive(signal);
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
                if (error?.code === 'version-mismatch') {
                    throw createError('DRAFT_PERSISTENCE_VERSION_CONFLICT');
                }
                rethrowOrWrap(error, 'DRAFT_PERSISTENCE_WRITE_FAILED');
            }
        });
    };

    const persistReviewDraftBatch = async (rawInput, repository) => {
        requirePorts(repository, [
            'get', 'findBy', 'persistReviewDraftBatch', 'loadDraftBatch'
        ]);
        if (
            !isRecord(rawInput) || !isRecord(rawInput.batchPatch) ||
            !Array.isArray(rawInput.drafts) ||
            !Array.isArray(rawInput.images) ||
            (
                rawInput.files !== undefined &&
                !Array.isArray(rawInput.files)
            )
        ) {
            throw createError('DRAFT_PERSISTENCE_INPUT_INVALID');
        }
        const signal = rawInput?.signal;
        assertActive(signal);
        const input = cloneValue(rawInput);
        const batchId = requireId(input.batchId);
        try {
            const currentBatch = await repository.get(
                'draftImportBatches', batchId
            );
            if (!currentBatch) throw createError('DRAFT_BATCH_NOT_FOUND');
            const files = input.files === undefined
                ? await repository.findBy('draftImportFiles', 'batchId', batchId)
                : input.files;
            const current = currentVersion(currentBatch);
            const expectedVersion = input.expectedVersion === undefined
                ? current
                : input.expectedVersion;
            if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
                throw createError('DRAFT_PERSISTENCE_VERSION_REQUIRED');
            }
            const idempotencyKey = input.idempotencyKey === undefined
                ? `review:${batchId}:${expectedVersion + 1}`
                : requireId(
                    input.idempotencyKey,
                    'DRAFT_PERSISTENCE_IDEMPOTENCY_KEY_REQUIRED'
                );
            return await persistDraftBatch({
                batch: {
                    ...currentBatch,
                    ...input.batchPatch,
                    id: batchId
                },
                files,
                drafts: input.drafts,
                images: input.images,
                expectedVersion,
                idempotencyKey,
                signal
            }, repository);
        } catch (error) {
            rethrowOrWrap(error, 'DRAFT_PERSISTENCE_WRITE_FAILED');
        }
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

    const validateAssociatedRows = (rows, batchId) => {
        if (!Array.isArray(rows)) {
            throw createError('DRAFT_PERSISTENCE_INPUT_INVALID');
        }
        const ids = [];
        for (const row of rows) {
            if (!isRecord(row) || !String(row.id || '').trim()) {
                throw createError('DRAFT_PERSISTENCE_INPUT_INVALID');
            }
            if (String(row.batchId || '').trim() !== batchId) {
                throw createError('DRAFT_PERSISTENCE_ASSOCIATION_INVALID');
            }
            ids.push(String(row.id));
        }
        if (new Set(ids).size !== ids.length) {
            throw createError('DRAFT_PERSISTENCE_DUPLICATE_ID');
        }
    };

    const createDraftBatch = async (rawCommand, repository) => {
        requirePorts(repository, ['createDraftBatch', 'loadDraftBatch']);
        if (
            !isRecord(rawCommand) || !isRecord(rawCommand.batch) ||
            !Array.isArray(rawCommand.files)
        ) {
            throw createError('DRAFT_PERSISTENCE_INPUT_INVALID');
        }
        const signal = rawCommand.signal;
        assertActive(signal);
        const command = cloneValue(rawCommand);
        const batchId = requireId(
            command.batch.id,
            'DRAFT_BATCH_ID_REQUIRED'
        );
        validateAssociatedRows(command.files, batchId);
        try {
            await repository.createDraftBatch({
                batch: command.batch,
                files: command.files,
                signal
            });
            const loaded = await repository.loadDraftBatch(batchId);
            if (
                !loaded?.batch || loaded.batch.id !== batchId ||
                !Array.isArray(loaded.files) ||
                loaded.files.length !== command.files.length
            ) {
                throw createError('DRAFT_PERSISTENCE_READBACK_MISMATCH');
            }
            validateAssociatedRows(loaded.files, batchId);
            return immutable({ batch: loaded.batch, files: loaded.files });
        } catch (error) {
            rethrowOrWrap(error, 'DRAFT_BATCH_CREATE_FAILED');
        }
    };

    const replaceRowsById = (currentRows, updates) => {
        const replacements = new Map(
            updates.map(row => [String(row.id), cloneValue(row)])
        );
        const next = currentRows.map(row =>
            replacements.has(String(row.id))
                ? replacements.get(String(row.id))
                : row
        );
        const existing = new Set(currentRows.map(row => String(row.id)));
        for (const update of updates) {
            if (!existing.has(String(update.id))) next.push(cloneValue(update));
        }
        return next;
    };

    const persistReviewDraftCommand = async (rawInput, repository) => {
        requirePorts(repository, [
            'get', 'findBy', 'persistReviewDraftBatch', 'loadDraftBatch'
        ]);
        if (
            !isRecord(rawInput) || !isRecord(rawInput.draft) ||
            (
                rawInput.images !== undefined &&
                !Array.isArray(rawInput.images)
            ) ||
            (
                rawInput.batchPatch !== undefined &&
                !isRecord(rawInput.batchPatch)
            )
        ) {
            throw createError('DRAFT_PERSISTENCE_INPUT_INVALID');
        }
        const signal = rawInput.signal;
        assertActive(signal);
        const input = cloneValue(rawInput);
        const batchId = requireId(input.batchId, 'DRAFT_BATCH_ID_REQUIRED');
        const draftId = requireId(input.draft.id);
        if (String(input.draft.batchId || '').trim() !== batchId) {
            throw createError('DRAFT_PERSISTENCE_ASSOCIATION_INVALID');
        }
        if (
            !Number.isInteger(input.expectedDraftVersion) ||
            input.expectedDraftVersion < 1
        ) {
            throw createError('DRAFT_PERSISTENCE_VERSION_CONFLICT');
        }
        const imageUpdates = input.images === undefined ? [] : input.images;
        validateAssociatedRows(imageUpdates, batchId);
        const idempotencyKey = input.idempotencyKey === undefined
            ? `review-command:${batchId}:${draftId}:${input.expectedDraftVersion}`
            : requireId(
                input.idempotencyKey,
                'DRAFT_PERSISTENCE_IDEMPOTENCY_KEY_REQUIRED'
            );

        try {
            const loaded = await reloadDraftBatch(batchId, repository);
            const currentDraft = loaded.questions.find(row => row.id === draftId);
            if (!currentDraft) throw createError('DRAFT_DRAFT_NOT_FOUND');
            if (imageUpdates.some(image =>
                String(image.questionId || '').trim() &&
                String(image.questionId) !== draftId
            )) {
                throw createError('DRAFT_PERSISTENCE_ASSOCIATION_INVALID');
            }
            if (
                currentDraft.status === 'submitted' ||
                input.draft.status === 'submitted'
            ) {
                throw createError('DRAFT_PERSISTENCE_SUBMITTED_IMMUTABLE');
            }
            const currentDraftVersion = Number(currentDraft.version);
            const persistenceVersion = currentVersion(loaded.batch);
            const isReplay =
                currentDraftVersion === input.expectedDraftVersion + 1 &&
                loaded.batch?.draftPersistence?.idempotencyKey ===
                    idempotencyKey;
            if (
                currentDraftVersion !== input.expectedDraftVersion &&
                !isReplay
            ) {
                throw createError('DRAFT_PERSISTENCE_VERSION_CONFLICT');
            }
            const desiredDraft = {
                ...input.draft,
                id: draftId,
                batchId,
                version: input.expectedDraftVersion + 1
            };
            const nextDrafts = replaceRowsById(
                loaded.questions,
                [desiredDraft]
            );
            const nextImages = replaceRowsById(loaded.images, imageUpdates);
            const expectedVersion = isReplay
                ? Math.max(0, persistenceVersion - 1)
                : persistenceVersion;
            const persisted = await persistReviewDraftBatch({
                batchId,
                drafts: nextDrafts,
                images: nextImages,
                files: loaded.files,
                batchPatch: input.batchPatch || {},
                expectedVersion,
                idempotencyKey,
                signal
            }, repository);
            const readback = await reloadDraftBatch(batchId, repository);
            const verifiedDraft = readback.questions.find(row => row.id === draftId);
            const verifiedImages = imageUpdates.map(update =>
                readback.images.find(row => row.id === update.id)
            );
            if (
                !verifiedDraft ||
                JSON.stringify(verifiedDraft) !== JSON.stringify(desiredDraft) ||
                verifiedImages.some((row, index) =>
                    !row || JSON.stringify(row) !== JSON.stringify(imageUpdates[index])
                )
            ) {
                throw createError('DRAFT_PERSISTENCE_READBACK_MISMATCH');
            }
            return immutable({
                ...persisted,
                batch: readback.batch,
                draft: verifiedDraft,
                images: verifiedImages
            });
        } catch (error) {
            rethrowOrWrap(error, 'DRAFT_PERSISTENCE_WRITE_FAILED');
        }
    };

    const persistReviewImageCommand = async (rawInput, repository) => {
        requirePorts(repository, [
            'get', 'findBy', 'persistReviewDraftBatch', 'loadDraftBatch'
        ]);
        if (!isRecord(rawInput) || !isRecord(rawInput.patch)) {
            throw createError('DRAFT_PERSISTENCE_INPUT_INVALID');
        }
        const signal = rawInput.signal;
        assertActive(signal);
        const input = cloneValue(rawInput);
        const batchId = requireId(input.batchId, 'DRAFT_BATCH_ID_REQUIRED');
        const imageId = requireId(input.imageId);
        if (
            input.expectedUpdatedAt === undefined ||
            !Number.isFinite(Number(input.expectedUpdatedAt)) ||
            ['id', 'batchId', 'questionId'].some(key => key in input.patch)
        ) {
            throw createError('DRAFT_PERSISTENCE_INPUT_INVALID');
        }
        const idempotencyKey = input.idempotencyKey === undefined
            ? `review-image:${batchId}:${imageId}:${input.expectedUpdatedAt}`
            : requireId(
                input.idempotencyKey,
                'DRAFT_PERSISTENCE_IDEMPOTENCY_KEY_REQUIRED'
            );
        try {
            const loaded = await reloadDraftBatch(batchId, repository);
            const currentImage = loaded.images.find(row => row.id === imageId);
            if (!currentImage) throw createError('DRAFT_IMAGE_NOT_FOUND');
            const currentImageVersion = Number.isFinite(
                Number(currentImage.updatedAt)
            )
                ? Number(currentImage.updatedAt)
                : 0;
            const updatedAt = Number.isFinite(Number(input.updatedAt))
                ? Number(input.updatedAt)
                : Date.now();
            const desiredImage = {
                ...currentImage,
                ...input.patch,
                id: imageId,
                batchId,
                updatedAt
            };
            const persistenceVersion = currentVersion(loaded.batch);
            const isReplay =
                currentImageVersion === updatedAt &&
                loaded.batch?.draftPersistence?.idempotencyKey ===
                    idempotencyKey &&
                Object.entries(input.patch).every(
                    ([key, value]) => currentImage[key] === value
                );
            if (
                currentImageVersion !== Number(input.expectedUpdatedAt) &&
                !isReplay
            ) {
                throw createError('DRAFT_PERSISTENCE_VERSION_CONFLICT');
            }
            const persisted = await persistReviewDraftBatch({
                batchId,
                drafts: loaded.questions,
                images: replaceRowsById(loaded.images, [desiredImage]),
                files: loaded.files,
                batchPatch: input.batchPatch || {},
                expectedVersion: isReplay
                    ? Math.max(0, persistenceVersion - 1)
                    : persistenceVersion,
                idempotencyKey,
                signal
            }, repository);
            const readback = await reloadDraftBatch(batchId, repository);
            const verifiedImage = readback.images.find(row => row.id === imageId);
            if (JSON.stringify(verifiedImage) !== JSON.stringify(desiredImage)) {
                throw createError('DRAFT_PERSISTENCE_READBACK_MISMATCH');
            }
            return immutable({
                ...persisted,
                batch: readback.batch,
                image: verifiedImage
            });
        } catch (error) {
            rethrowOrWrap(error, 'DRAFT_PERSISTENCE_WRITE_FAILED');
        }
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
        createDraftBatch,
        persistDraftBatch,
        persistReviewDraftBatch,
        persistReviewDraftCommand,
        persistReviewImageCommand,
        reloadDraftBatch,
        deleteDraftBatch
    });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.DraftPersistenceService = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
