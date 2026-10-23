(function initReviewImageCommands(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ReviewImageCommands = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Review image planning, guarded persistence commands and browser pixel port.
    const CONFIRM_WARNING_MARKERS = Object.freeze(['图片需要确认', '图片尚未确认']);

    const planConfirmImages = ({ question, images = [] } = {}) => {
        if (!question) return null;
        return {
            warnings: (question.warnings || []).filter(warning =>
                !CONFIRM_WARNING_MARKERS.some(marker => String(warning).includes(marker))),
            imageUpdates: (Array.isArray(images) ? images : []).map(image => ({
                id: image?.id,
                status: 'bound',
                confidence: Math.max(image?.confidence || 0, 0.9)
            }))
        };
    };

    const planImageDeletion = ({ question, imageId, currentSource, removeToken } = {}) => {
        if (!question || !imageId) return null;
        const remove = typeof removeToken === 'function' ? removeToken : null;
        if (!remove) {
            const error = new Error('REVIEW_IMAGE_COMMAND_TOKEN_HELPER_REQUIRED');
            error.code = 'REVIEW_IMAGE_COMMAND_TOKEN_HELPER_REQUIRED';
            throw error;
        }
        return {
            images: (question.images || []).filter(image => image.id !== imageId),
            stem: remove(question.stem || '', imageId),
            editorSource: remove(String(currentSource || ''), imageId)
        };
    };

    const requireDependency = (port, code) => {
        if (typeof port !== 'function') throw Object.assign(new Error(code), { code });
    };

    // Browser pixels are an explicit port; commands below never inspect DOM.
    const createCropPort = ({ ImageClass, document, pdfRenderer } = {}) => {
        for (const port of [ImageClass, document?.createElement, pdfRenderer?.renderPdfRegion])
            requireDependency(port, 'REVIEW_CROP_PORT_REQUIRED');
        const load = url => new Promise((resolve, reject) => {
            const image = new ImageClass();
            image.onload = () => { image.onload = image.onerror = null; resolve(image); };
            image.onerror = () => { image.onload = image.onerror = null; reject(new Error('来源原图加载失败，无法裁剪。')); };
            image.src = url;
        });
        const render = async ({ source, file, region, display, pdf }) => {
            const { x, y, w, h } = region;
            const width = Number(display.width), height = Number(display.height);
            if (![x, y, w, h, width, height].every(Number.isFinite) || width <= 0 || height <= 0 ||
                x < 0 || y < 0 || w < 20 || h < 20 || x + w > width + 1 || y + h > height + 1) {
                throw new Error('裁剪区域或图片尺寸无效，请重新框选。');
            }
            if (pdf) {
                const bbox = [x / width * 1000, y / height * 1000,
                    Math.min(1000, (x + w) / width * 1000), Math.min(1000, (y + h) / height * 1000)];
                return { ...await pdfRenderer.renderPdfRegion(file, { pageNo: source.sourcePage, bbox }), bbox };
            }
            const image = await load(source.url);
            if (!image.naturalWidth || !image.naturalHeight) throw new Error('图片尺寸异常，无法裁剪。');
            const sx = Math.max(0, Math.round(x * image.naturalWidth / width));
            const sy = Math.max(0, Math.round(y * image.naturalHeight / height));
            const sw = Math.min(image.naturalWidth - sx, Math.round(w * image.naturalWidth / width));
            const sh = Math.min(image.naturalHeight - sy, Math.round(h * image.naturalHeight / height));
            if (sw <= 0 || sh <= 0) throw new Error('裁剪区域无效，请重新框选。');
            const canvas = document.createElement('canvas'); canvas.width = sw; canvas.height = sh;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('浏览器不支持图片裁剪。');
            ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
            return { url: canvas.toDataURL('image/png'), width: sw, height: sh, bbox: [sx, sy, sx + sw, sy + sh] };
        };
        return Object.freeze({ render });
    };

    const createImageCommands = ({ session, controller, persistence, utils, pdfContract,
        sourceFor, realImagesFor, sourceImagesFor, appendTokens, removeToken,
        cropPort, makeId, refreshStats, notify, clock = Date.now } = {}) => {
        for (const port of [session?.capture, session?.isCurrent, session?.acceptImageResult,
            controller?.open, controller?.editFields, persistence?.persistReviewDraftCommand,
            persistence?.persistReviewImageCommand, utils?.preserveRawEvidence, utils?.cleanDisplayFieldsOnly,
            pdfContract, sourceFor, realImagesFor, sourceImagesFor, appendTokens, removeToken,
            cropPort?.render, makeId, refreshStats, notify])
            requireDependency(port, 'REVIEW_IMAGE_COMMAND_PORT_REQUIRED');
        const clone = value => controller.open(value).draft;
        const editable = q => q && q.batchId === session.refs.activeBatchId.value && q.status !== 'submitted';
        const ready = q => {
            if (!editable(q)) return false;
            if (session.dirty()) { notify('请先保存或放弃未保存编辑，再操作图片。'); return false; }
            return true;
        };
        const clean = q => {
            if (!pdfContract(q)) { utils.preserveRawEvidence(q); utils.cleanDisplayFieldsOnly(q); }
            q.updatedAt = clock(); return q;
        };
        const commit = async (token, command, message) => {
            let result;
            try {
                result = command.draft ? await persistence.persistReviewDraftCommand(command)
                    : await persistence.persistReviewImageCommand(command);
            } catch (error) {
                if (session.isCurrent(token)) notify('图片操作保存失败：' + (error?.code || error?.message || 'storage-failure'));
                return false;
            }
            const accepted = session.acceptImageResult(token, result, sourceFor);
            try { await refreshStats(command.batchId); }
            catch (error) {
                if (session.isCurrent(token)) notify('图片操作已保存，统计刷新失败：' + (error?.code || error?.message || 'storage-failure'));
                return false;
            }
            if (!session.isCurrent(token) || !accepted) return false;
            notify(message + (session.dirty() ? '仍有新的未保存编辑。' : '')); return true;
        };
        const confirmImages = async () => {
            const q = session.current(); if (!ready(q)) return false;
            const token = session.capture(), images = realImagesFor(q).map(image => ({ ...image }));
            const plan = planConfirmImages({ question: q, images });
            const next = clone(q); next.imageReviewStatus = 'confirmed'; next.warnings = plan.warnings;
            const updates = new Map(plan.imageUpdates.map(row => [row.id, row]));
            images.forEach(image => Object.assign(image, updates.get(image.id)));
            return commit(token, { batchId: q.batchId, draft: clean(next), images, expectedDraftVersion: q.version }, '图片已确认。');
        };
        const deleteImage = async (imageId, confirmDelete) => {
            const q = session.current(); if (!ready(q) || !confirmDelete('确定删除这张图片吗？')) return false;
            const image = session.refs.batchDraftImages.value.find(row => row.id === imageId);
            if (!image || image.batchId !== q.batchId || image.questionId !== q.id || image.status === 'deleted') return false;
            const token = session.capture();
            let next;
            const contract = pdfContract(q);
            if (contract) next = contract.removeImage(clone(q), imageId, controller);
            else {
                const plan = planImageDeletion({ question: q, imageId,
                    currentSource: sourceFor(q), removeToken });
                const changes = { images: plan.images, stem: plan.stem,
                    options: (q.options || []).map(text => removeToken(text, imageId)),
                    answer: removeToken(q.answer || '', imageId), solution: removeToken(q.solution || '', imageId) };
                next = controller.editFields(q, changes);
                next.editorSource = plan.editorSource;
                next.hasImage = realImagesFor(q).some(row => row.id !== imageId && row.status !== 'deleted') || next.images.length > 0;
                if (!next.hasImage) next.imageReviewStatus = 'none';
            }
            return commit(token, { batchId: q.batchId, draft: clean(next),
                images: [{ ...image, status: 'deleted' }], expectedDraftVersion: q.version }, '图片已删除。');
        };
        const bind = async (imageId, questionId) => {
            const q = session.refs.batchDraftQuestions.value.find(row => row.id === questionId);
            if (!ready(q)) return false;
            const image = session.refs.batchDraftImages.value.find(row => row.id === imageId);
            if (!image || image.batchId !== q.batchId || image.questionId || image.status === 'deleted' ||
                image.source === 'source-page' || image.source === 'page-image' ||
                !image.url || (q.images || []).some(row => row.id === image.id)) {
                notify('该图片不是当前批次可绑定的未分配题图。'); return false;
            }
            const token = session.capture(), update = { ...image, questionId: q.id,
                status: 'need_confirm', confidence: image.confidence || 0.78 };
            const contract = pdfContract(q);
            let next = contract ? contract.applyManualCrop(clone(q), update, 'stem', controller)
                : controller.editFields(q, { images: [...(q.images || []), { ...update, align: 'center' }],
                    stem: appendTokens(q.stem || '', [{ ...update, source: image.source || 'uploaded-question-image' }]) });
            if (!contract) next.editorSource = appendTokens(sourceFor(q), [{ ...update, source: image.source || 'uploaded-question-image' }]);
            next.hasImage = true; next.imageReviewStatus = 'need_confirm';
            next.warnings = [...new Set([...(q.warnings || []), '该题图片需要确认后才能入库。'])];
            return commit(token, { batchId: q.batchId, draft: clean(next), images: [update], expectedDraftVersion: q.version }, '图片已绑定，请核对并确认。');
        };
        const deleteUnassigned = async (imageId, confirmDelete) => {
            const image = session.refs.batchDraftImages.value.find(row => row.id === imageId);
            if (!image || image.batchId !== session.refs.activeBatchId.value || image.questionId || image.status === 'deleted' ||
                !confirmDelete('确定删除这张未分配图片吗？')) return false;
            return commit(session.capture(), { batchId: image.batchId, imageId,
                expectedUpdatedAt: image.updatedAt ?? image.createdAt ?? 0,
                updatedAt: clock(), patch: { status: 'deleted' } }, '未分配图片已删除。');
        };
        const captureCrop = source => {
            const q = session.current(); if (!ready(q)) return null;
            const file = session.refs.batchImportFiles.value.find(row => row.id === source?.sourceFileId);
            const evidence = sourceImagesFor(q).some(row => row.id === source?.id && row.url === source.url &&
                row.sourceFileId === source.sourceFileId && row.sourcePage === source.sourcePage);
            if (!source?.url || source.batchId !== q.batchId || source.questionId !== q.id ||
                !Number.isInteger(source.sourcePage) || source.sourcePage < 1 ||
                !file || file.batchId !== q.batchId || (pdfContract(q) && file.fileType !== 'pdf') || !evidence) {
                notify('裁剪来源文件、页号或题目身份不一致，请重新打开原页。'); return null;
            }
            return session.capture();
        };
        const crop = async ({ token, source, region, display, target = 'stem', isCancelled = () => false } = {}) => {
            if (!session.isCurrent(token) || isCancelled()) return false;
            const q = session.current(); if (!ready(q) || !captureCrop(source)) return false;
            const original = clone(q), expectedDraftVersion = q.version;
            const file = session.refs.batchImportFiles.value.find(row => row.id === source.sourceFileId);
            const contract = pdfContract(original);
            let pixels;
            try { pixels = await cropPort.render({ source, file, region, display, pdf: Boolean(contract) }); }
            catch (error) { if (session.isCurrent(token)) notify('裁剪失败：' + error.message); return false; }
            if (!session.isCurrent(token) || isCancelled()) return false;
            const now = clock(), image = { id: makeId('crop'), batchId: original.batchId, questionId: original.id,
                ...pixels, filename: `crop_q${original.questionNumber || original.order || ''}_${now}.png`,
                source: 'manual-crop', description: '人工裁剪题图', sourceFileId: file.id,
                sourceFileName: file.filename, sourcePage: source.sourcePage, status: 'bound', confidence: 1,
                displayable: true, createdAt: now, updatedAt: now };
            image.name = image.filename;
            let next;
            try {
                next = contract ? contract.applyManualCrop(original, image, target, controller)
                : controller.editFields(original, { stem: appendTokens(original.stem || '', [image]),
                    images: [...(original.images || []), { ...image, align: 'center' }] });
            if (!contract) next.editorSource = appendTokens(sourceFor(original), [image]);
            } catch (error) { notify('裁剪目标无效：' + error.message); return false; }
            next.hasImage = true;
            if (!contract) next.imageReviewStatus = 'confirmed';
            return commit(token, { batchId: original.batchId, draft: clean(next), images: [image], expectedDraftVersion }, '已保存当前题裁剪图。');
        };
        return Object.freeze({ confirmImages, deleteImage, bind, deleteUnassigned, captureCrop, crop });
    };

    return Object.freeze({ CONFIRM_WARNING_MARKERS, planConfirmImages, planImageDeletion, createCropPort, createImageCommands });
});
