(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.Qisi = root.Qisi || {};
    root.Qisi.PdfMultimodalContract = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const PROTOCOL = 'pdf-multimodal-v1';
    const TYPES = Object.freeze({ single: '单选题', multi: '多选题', fill: '填空题', long: '解答题', proof: '证明题', unknown: '待确认' });
    const clone = value => JSON.parse(JSON.stringify(value));
    const isV1 = q => q?.producer?.routeId === PROTOCOL && q?.pdfV1?.protocol === PROTOCOL;
    const fail = (code, details) => Object.assign(new Error(code), { code, details });
    const assert = (condition, path) => { if (!condition) throw fail('PDF_V1_SCHEMA_INVALID', { path }); };
    const record = v => v && typeof v === 'object' && !Array.isArray(v);
    // Comparison only. Never normalize the stored transcription or LaTeX control words.
    const compareText = text => text.replace(/\r\n?/g, '\n').trim().replace(/[ \t]*=[ \t]*/g, '=');
    const unique = values => [...new Set(values)];
    const questionKey = (examId, no) => JSON.stringify([examId, no]);
    function bboxValid(bbox) {
        return Array.isArray(bbox) && bbox.length === 4 && bbox.every(n => Number.isFinite(n) && n >= 0 && n <= 1000) && bbox[0] < bbox[2] && bbox[1] < bbox[3];
    }
    function parseResponse(text, { pages, roles }) {
        let response;
        try { response = JSON.parse(text); } catch (_) { throw fail('PDF_V1_JSON_INVALID'); }
        assert(record(response), '$');
        const pageSet = new Set(pages);
        const streams = { questions: 'question', answers: 'answer', solutions: 'solution' };
        assert(Object.keys(response).every(k => k in streams || k === 'warnings'), '$.keys');
        assert(response.warnings === undefined || Array.isArray(response.warnings) && response.warnings.every(v => typeof v === 'string'), '$.warnings');
        for (const [stream, field] of Object.entries(streams)) {
            assert(Array.isArray(response[stream]), stream);
            const allowed = roles.includes('full') || roles.includes(field);
            assert(allowed || !response[stream].length, stream + '.role');
            const seen = new Set();
            let lastInteger = null;
            for (const [index, item] of response[stream].entries()) {
                const path = `${stream}[${index}]`;
                assert(record(item), path);
                const keys = ['question_no', 'figures', 'source_pages', 'status', 'warnings', ...(field === 'question' ? ['type', 'stem', 'options'] : [field])];
                assert(Object.keys(item).every(k => keys.includes(k)) && keys.every(k => k in item), path + '.keys');
                assert(typeof item.question_no === 'string' && item.question_no.trim().length > 0 && item.question_no.length <= 48, path + '.question_no');
                item.question_no = item.question_no.trim();
                assert(['complete', 'partial', 'unreadable'].includes(item.status), path + '.status');
                assert(Array.isArray(item.warnings) && item.warnings.every(v => typeof v === 'string'), path + '.warnings');
                assert(Array.isArray(item.source_pages) && item.source_pages.length > 0 && item.source_pages.every(p => Number.isInteger(p) && pageSet.has(p)), path + '.source_pages');
                item.source_pages = unique(item.source_pages);
                if (seen.has(item.question_no)) item.warnings.push('同一窗口题号重复：必须确认原卷编号身份');
                if (/^\d+$/.test(item.question_no)) {
                    const number = Number(item.question_no);
                    if (lastInteger !== null && number < lastInteger) item.warnings.push('同一窗口题号回退：必须确认原卷编号身份');
                    lastInteger = number;
                }
                if (seen.has(item.question_no) || item.warnings.some(w => w.includes('题号回退'))) item.status = 'partial';
                seen.add(item.question_no);
                if (field === 'question') {
                    assert(item.type in TYPES && typeof item.stem === 'string' && Array.isArray(item.options), path + '.question');
                    const labels = new Set();
                    for (const option of item.options) {
                        assert(record(option) && Object.keys(option).length === 2 && typeof option.text === 'string' && /^[A-Z]$/.test(option.label) && !labels.has(option.label), path + '.option');
                        labels.add(option.label);
                    }
                    if (item.type === 'unknown' || !item.stem.trim() || ['single', 'multi'].includes(item.type) && (item.options.length < 2 || item.options.some((o, i) => !o.text.trim() || o.label !== String.fromCharCode(65 + i)))) {
                        item.status = 'partial';
                        item.warnings.push('题型、题干或选项不完整，请对照原页');
                    }
                } else assert(typeof item[field] === 'string', path + '.' + field);
                assert(Array.isArray(item.figures), path + '.figures');
                for (const figure of item.figures) {
                    assert(record(figure) && Object.keys(figure).every(k => ['page', 'bbox', 'belongs_to'].includes(k)), path + '.figure');
                    const targetValid = field === 'question' ? figure.belongs_to === 'stem' || item.options.some(o => 'option:' + o.label === figure.belongs_to) : figure.belongs_to === field;
                    if (!Number.isInteger(figure.page) || !pageSet.has(figure.page) || !item.source_pages.includes(figure.page) || !bboxValid(figure.bbox) || !targetValid) {
                        figure.invalid = true;
                        item.warnings.push('图片页码、裁框或归属无效：请人工裁图');
                    }
                }
            }
        }
        return response;
    }
    function body(item, field) {
        return field === 'question'
            ? JSON.stringify([item.type, compareText(item.stem), item.options.map(o => [o.label, compareText(o.text)])])
            : compareText(item[field]);
    }
    function groupProposals(proposals, examId) {
        const groups = new Map();
        for (const proposal of proposals) {
            const key = questionKey(examId, proposal.item.question_no);
            if (!groups.has(key)) groups.set(key, { key, no: proposal.item.question_no, question: [], answer: [], solution: [] });
            const variants = groups.get(key)[proposal.field];
            const same = variants.find(v => body(v.item, proposal.field) === body(proposal.item, proposal.field));
            if (!same) variants.push(clone(proposal));
            else {
                same.evidence.push(...clone(proposal.evidence));
                same.item.warnings = unique([...same.item.warnings, ...proposal.item.warnings]);
                // Status is not a candidate score. Equal text never erases an incomplete observation.
                if (proposal.item.status !== 'complete') same.item.status = proposal.item.status;
                const leftFigures = JSON.stringify(same.item.figures);
                if (leftFigures !== JSON.stringify(proposal.item.figures) || same.source.sourceId !== proposal.source.sourceId && proposal.item.figures.length) same.figureConflict = true;
            }
        }
        return [...groups.values()];
    }
    const state = variants => !variants.length ? 'missing' : variants.length > 1 ? 'conflict' : variants[0].item.status;
    function insertFigures(item, images, field) {
        const copy = clone(item);
        for (const image of images) {
            const token = `[[IMAGE:${image.id}]]`;
            if (image.position.startsWith('option:')) {
                const option = copy.options.find(o => 'option:' + o.label === image.position);
                if (option) option.text += '\n' + token;
            } else if (image.position === (field === 'question' ? 'stem' : field)) copy[image.position] += '\n' + token;
        }
        return copy;
    }
    function canonicalDraft(group, { batchId, now, identityContract, windowErrors = [] }) {
        const first = group.question[0];
        assert(first, 'question.required');
        const source = first.source;
        const reason = 'single-model-structured-pdf';
        const producer = { mode: 'vision-ai', routeId: PROTOCOL, routeReason: reason, engine: first.model, deterministic: false };
        const id = `${batchId}:pdf-v1:${encodeURIComponent(group.no)}`;
        const draft = {
            id, batchId, version: 1, questionNumber: group.no, question: group.no,
            type: TYPES[first.item.type], stem: '', options: [], answer: '', solution: '', images: [],
            status: 'pending', manualConfirmed: false, imageReviewStatus: 'none',
            source: clone(source), producer, route: { identity: PROTOCOL, reason, transitions: clone(identityContract.PDF_VISION_TRANSITIONS) },
            sourceFileId: source.sourceId, sourceFileName: source.filename, sourcePage: first.item.source_pages[0],
            sourceTrace: { source: PROTOCOL, sourceFileId: source.sourceId, sourceFileName: source.filename, sourcePage: first.item.source_pages[0] },
            fieldProvenance: {}, supportSources: [], warnings: [], createdAt: now, updatedAt: now,
            pdfV1: { protocol: PROTOCOL, examId: batchId, states: {}, candidates: clone(group), windowErrors: clone(windowErrors), sourcePageImages: [] }
        };
        for (const field of ['question', 'answer', 'solution']) {
            const variants = group[field];
            const status = state(variants);
            draft.pdfV1.states[field] = status;
            if (!variants.length) continue;
            const variant = variants[0];
            const images = variant.images || [];
            const item = insertFigures(variant.item, images, field);
            if (field === 'question') {
                draft.stem = item.stem;
                draft.options = item.options.map(o => o.text);
                draft.pdfV1.optionLabels = item.options.map(o => o.label);
            } else draft[field] = item[field];
            draft.images.push(...clone(images));
            if (variant.source.sourceId !== source.sourceId) {
                let support = draft.supportSources.find(s => s.sourceId === variant.source.sourceId);
                if (!support) { support = { ...clone(variant.source), roles: [] }; draft.supportSources.push(support); }
                support.roles.push(field);
            }
            draft.warnings.push(...variant.item.warnings);
            if (status !== 'complete') draft.warnings.push(`${field}: ${status}，请对照来源页确认或修改`);
        }
        const imageProblem = ['question', 'answer', 'solution'].some(f => group[f].some(v => v.figureConflict || v.item.figures.some(fig => fig.invalid) || v.cropErrors?.length));
        for (const field of ['answer', 'solution']) for (const variant of group[field]) {
            if (variant.source.sourceId === source.sourceId) continue;
            let support = draft.supportSources.find(s => s.sourceId === variant.source.sourceId);
            if (!support) { support = { ...clone(variant.source), roles: [] }; draft.supportSources.push(support); }
            support.roles = unique([...support.roles, field]);
        }
        draft.pdfV1.states.images = imageProblem ? 'conflict' : 'complete';
        if (imageProblem) draft.warnings.push('图片裁框、归属冲突或裁图失败，请人工确认或重裁');
        if (draft.images.length) draft.imageReviewStatus = 'need_confirm';
        for (const field of identityContract.FORMAL_FIELDS) {
            const unit = ['questionNumber', 'stem', 'options'].includes(field) ? 'question' : field;
            const variant = (group[unit] || group.question)[0];
            const value = field === 'questionNumber' ? draft.questionNumber : draft[field];
            const present = Array.isArray(value) ? value.length > 0 : Boolean(String(value || '').trim());
            const accepted = (draft.pdfV1.states[unit] || 'complete') === 'complete';
            const kind = !accepted && variant ? 'rejected' : !present ? 'missing' : 'controlled-write';
            const src = field === 'images' ? source : variant?.source || source;
            draft.fieldProvenance[field] = {
                field, kind, status: kind, sourceId: src.sourceId, sourceFormat: 'pdf', producerMode: 'vision-ai', routeId: PROTOCOL,
                engine: producer.engine, page: variant?.item.source_pages[0] || draft.sourcePage, blockIds: [], manuallyEdited: false,
                controlledWriteAccepted: accepted, controlledWriteDecisionId: `${id}:${field}`, reasonCode: `pdf-v1-${draft.pdfV1.states[unit] || 'complete'}`,
                producerBoundary: src.sourceId === source.sourceId ? 'pdf-vision-engine-output-to-candidate' : 'pdf-multimodal-support-to-candidate',
                contractVersion: identityContract.CONTRACT_VERSION
            };
        }
        if (imageProblem) Object.assign(draft.fieldProvenance.images, { kind: 'rejected', status: 'rejected', controlledWriteAccepted: false });
        draft.fieldProvenance.images.imageEvidence = draft.images.map(i => ({ imageId: i.id, sourceId: i.sourceFileId, field: i.position, evidenceRef: `pdf:${i.sourceFileId}:${i.sourcePage}:${JSON.stringify(i.bbox)}` }));
        draft.images.forEach(i => { i.questionId = id; i.batchId = batchId; });
        draft.warnings = unique(draft.warnings);
        return draft;
    }
    function validateCanonical(drafts, batchId, identityContract) {
        const keys = new Set();
        for (const draft of drafts) {
            const key = questionKey(batchId, draft.questionNumber);
            assert(isV1(draft) && draft.batchId === batchId && draft.pdfV1.examId === batchId && !keys.has(key), 'canonical.identity');
            assert(identityContract.validateCanonicalIdentity(draft).valid, 'canonical.producer');
            assert(typeof draft.stem === 'string' && Array.isArray(draft.options) && draft.options.every(o => typeof o === 'string') && typeof draft.answer === 'string' && typeof draft.solution === 'string', 'canonical.fields');
            assert(draft.images.every(i => i.id && /^data:image\//.test(i.url) && i.sourceFileId && bboxValid(i.bbox)), 'canonical.images');
            keys.add(key);
        }
        return drafts;
    }
    function reviewProblem(draft) {
        if (!String(draft.stem || '').trim()) return '题干为空，请对照原页补充。';
        if (!Object.values(TYPES).filter(t => t !== '待确认').includes(draft.type)) return '请选择原卷题型。';
        const rejected = Object.entries(draft.fieldProvenance || {}).filter(([, p]) => p.status === 'rejected').map(([f]) => f);
        if (rejected.length) return `尚未处理不完整或冲突字段：${rejected.join('、')}。请修改或明确采用候选。`;
        if (['单选题', '多选题'].includes(draft.type) && (draft.options.length < 2 || draft.options.some(o => !o.trim()) || draft.pdfV1.optionLabels?.length !== draft.options.length || draft.pdfV1.optionLabels.some((label, i) => label !== String.fromCharCode(65 + i)))) return '选项标签或正文不完整，请对照原页；缺失标签不会自动重编号。';
        if (['单选题', '多选题', '填空题'].includes(draft.type) && !draft.answer.trim()) return '答案缺失，请人工补充。';
        if (['单选题', '多选题'].includes(draft.type)) {
            const labels = draft.pdfV1.optionLabels;
            const answer = draft.answer.replace(/\[\[IMAGE:[^\]]+\]\]/g, '').trim();
            if (!(draft.type === '单选题' ? /^[A-Z]$/ : /^[A-Z]+$/).test(answer) || [...answer].some(label => !labels.includes(label)) || new Set(answer).size !== answer.length) return '答案标签与当前题型或选项不一致，请对照原 PDF；程序不会猜改题型。';
        }
        if (draft.images.length && draft.imageReviewStatus !== 'confirmed') return '请确认原 PDF 裁图与归属。';
        const math = mathProblems(draft, root.katex?.renderToString);
        if (math.length) return math[0].message;
        return '';
    }
    function editorSource(draft) {
        return draft.stem + (draft.options.length ? '\n\n' + draft.options.map((o, i) => `${draft.pdfV1.optionLabels[i] || String.fromCharCode(65 + i)}. ${o}`).join('\n') : '');
    }
    // Only explicit teacher editor delimiters are mapped. No legacy math cleaning or exam inference.
    function projectEditorSource(source, draft) {
        if (source === (draft.editorSource || editorSource(draft))) return { stem: draft.stem, options: clone(draft.options), optionLabels: clone(draft.pdfV1.optionLabels || []), type: draft.type, parsedOptions: draft.options.length > 0 };
        const markers = ['单选题', '多选题'].includes(draft.type) ? [...source.matchAll(/(?:^|\n)([A-Z])\.[ \t]/g)] : [];
        const stem = markers.length ? source.slice(0, markers[0].index).replace(/\n{1,2}$/, '') : source;
        const options = markers.map((marker, i) => source.slice(marker.index + marker[0].length, markers[i + 1]?.index ?? source.length));
        return { stem, options, optionLabels: markers.map(m => m[1]), type: draft.type, parsedOptions: markers.length > 0 };
    }
    function applyEditorSource(draft, source, reviewController) {
        const projection = projectEditorSource(source, draft);
        const labelsChanged = JSON.stringify(projection.optionLabels) !== JSON.stringify(draft.pdfV1.optionLabels || []);
        let next = reviewController.editFields(draft, { stem: projection.stem, options: projection.options });
        if (labelsChanged) next = reviewController.markFieldsManual(next, ['options']);
        next.pdfV1.optionLabels = projection.optionLabels;
        next.editorSource = source;
        return next;
    }
    function removeImage(draft, imageId, reviewController) {
        const copy = clone(draft), token = `[[IMAGE:${imageId}]]`;
        copy.stem = copy.stem.split(token).join('');
        copy.options = copy.options.map(o => o.split(token).join(''));
        copy.answer = copy.answer.split(token).join(''); copy.solution = copy.solution.split(token).join('');
        copy.images = copy.images.filter(i => i.id !== imageId);
        copy.editorSource = editorSource(copy);
        const changed = ['stem', 'options', 'answer', 'solution'].filter(f => JSON.stringify(copy[f]) !== JSON.stringify(draft[f]));
        const next = reviewController.markFieldsManual(copy, [...changed, 'images']);
        if (!next.images.length) { next.imageReviewStatus = 'none'; next.fieldProvenance.images = { kind: 'missing', status: 'missing' }; }
        // Empty optional fields stay missing, never pretend an empty manual value is evidence.
        for (const f of changed) if (!next[f].length) next.fieldProvenance[f] = { kind: 'missing', status: 'missing' };
        return next;
    }
    function applyManualCrop(draft, image, target, reviewController) {
        const copy = clone(draft), token = `[[IMAGE:${image.id}]]`;
        const field = target.startsWith('option:') ? 'options' : target;
        assert(['stem', 'options', 'answer', 'solution'].includes(field), 'review.crop.target');
        if (field === 'options') {
            const index = copy.pdfV1.optionLabels.indexOf(target.slice(7));
            assert(index >= 0, 'review.crop.option'); copy.options[index] += '\n' + token;
        } else copy[field] += '\n' + token;
        copy.images.push({ ...image, position: target });
        copy.editorSource = editorSource(copy); copy.imageReviewStatus = 'need_confirm';
        return reviewController.markFieldsManual(copy, [field, 'images']);
    }
    function mathProblems(draft, renderMath) {
        const problems = [];
        for (const field of ['stem', 'options', 'answer', 'solution']) {
            const texts = Array.isArray(draft[field]) ? draft[field] : [draft[field]];
            for (const text of texts) for (const match of String(text).matchAll(/\$\$([\s\S]*?)\$\$|(?<!\\)\$([^$\n]+)\$/g)) {
                const math = match[1] ?? match[2];
                try {
                    if (/\\\\[a-zA-Z]/.test(math)) throw new Error('公式反斜杠重复转义');
                    if (renderMath) renderMath(math, { throwOnError: true, strict: 'ignore' });
                } catch (error) { problems.push({ field, message: '公式需要对照原卷修正：' + error.message }); break; }
            }
        }
        return problems;
    }
    function chooseCandidate(draft, field, index, reviewController) {
        assert(isV1(draft) && ['question', 'answer', 'solution'].includes(field), 'review.candidate');
        const variant = draft.pdfV1.candidates[field][index];
        assert(variant && !variant.cropErrors?.length && !variant.item.figures.some(f => f.invalid), 'review.candidate.figure');
        const copy = clone(draft);
        const fields = field === 'question' ? ['questionNumber', 'stem', 'options'] : [field];
        const item = insertFigures(variant.item, variant.images || [], field);
        if (field === 'question') {
            copy.stem = item.stem; copy.options = item.options.map(o => o.text); copy.type = TYPES[item.type];
            copy.pdfV1.optionLabels = item.options.map(o => o.label);
        } else copy[field] = item[field];
        const belongs = i => field === 'question' ? i.position === 'stem' || i.position.startsWith('option:') : i.position === field;
        copy.images = [...copy.images.filter(i => !belongs(i)), ...clone(variant.images || [])].map(i => ({ ...i, questionId: copy.id, batchId: copy.batchId }));
        copy.pdfV1.states[field] = 'manual';
        copy.editorSource = editorSource(copy);
        copy.imageReviewStatus = copy.images.length ? 'need_confirm' : 'none';
        if (!copy.images.length) copy.fieldProvenance.images = { field: 'images', kind: 'missing', status: 'missing' };
        const next = reviewController.markFieldsManual(copy, [...fields, ...(copy.images.length ? ['images'] : [])]);
        for (const target of fields) Object.assign(next.fieldProvenance[target], {
            sourceId: variant.source.sourceId, sourceFormat: 'pdf', page: variant.item.source_pages[0]
        });
        return next;
    }
    return Object.freeze({ PROTOCOL, TYPES, isV1, parseResponse, bboxValid, compareText, questionKey, groupProposals, canonicalDraft, validateCanonical, reviewProblem, editorSource, projectEditorSource, applyEditorSource, chooseCandidate, removeImage, applyManualCrop, mathProblems });
});
