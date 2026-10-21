(function(root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.Qisi = root.Qisi || {}; root.Qisi.PdfReviewRecords = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
'use strict';
const clone = value => JSON.parse(JSON.stringify(value));
// Persisted record editing only: no transport schemas, prompts, budgets or calls.
function createRecordContract(PROTOCOL, metadataKey) {
    const TYPES = Object.freeze({ single_choice: '单选题', multiple_choice: '多选题', fill_blank: '填空题', free_response: '解答题', unknown: '待确认' });
    const isExternal = q => q?.producer?.routeId === PROTOCOL && q?.[metadataKey]?.protocol === PROTOCOL;
    const assert = (ok, at) => { if (!ok) throw Object.assign(new Error('PDF_EXTERNAL_CONTRACT_INVALID'), { code: 'PDF_EXTERNAL_CONTRACT_INVALID', details: { path: at } }); };
    const questionKey = (exam, no) => JSON.stringify([exam, no]);
    const bboxValid = box => Array.isArray(box) && box.length === 4 && box.every(v => Number.isFinite(v) && v >= 0 && v <= 1000) && box[0] < box[2] && box[1] < box[3];
    function insertFigures(item, images, field) {
        const copy = clone(item);
        const replace = text => images.reduce((value, image) => value.split('[[figure:' + image.figureId + ']]').join('[[IMAGE:' + image.id + ']]'), text);
        if (field === 'question') { copy.stem = replace(copy.stem); copy.options = copy.options.map(o => ({ ...o, text: replace(o.text) })); }
        else copy[field] = replace(copy[field] || copy.text || '');
        return copy;
    }
    function validateCanonical(drafts, batchId, identityContract) {
        const keys = new Set();
        for (const draft of drafts) {
            const key = questionKey(batchId, draft.questionNumber);
            assert(isExternal(draft) && draft.batchId === batchId && draft[metadataKey].examId === batchId && !keys.has(key), 'canonical.identity');
            assert(identityContract.validateCanonicalIdentity(draft).valid, 'canonical.producer');
            assert(typeof draft.stem === 'string' && Array.isArray(draft.options) && draft.options.every(v => typeof v === 'string') && typeof draft.answer === 'string' && typeof draft.solution === 'string', 'canonical.fields');
            assert(draft.images.every(i => i.id && /^data:image\//.test(i.url) && i.sourceFileId && bboxValid(i.bbox)), 'canonical.images'); keys.add(key);
        }
        return drafts;
    }
    function retainReviewDrafts(drafts, previous) {
        const protectedDraft = q => q.status === 'submitted' || q.userEdited || q.manualEdited || Object.values(q.fieldProvenance || {}).some(p => p.status === 'manual');
        const byId = new Map(previous.filter(protectedDraft).map(q => [q.id, q]));
        const result = drafts.map(fresh => {
            const prior = byId.get(fresh.id);
            if (!prior) return fresh;
            byId.delete(fresh.id);
            if (prior.status === 'submitted') return clone(prior);
            const kept = clone(prior);
            // Preserve teacher fields; fresh machine output remains selectable evidence.
            for (const field of ['question', 'answer', 'solution']) {
                const variants = kept[metadataKey].candidates[field];
                for (const variant of fresh[metadataKey].candidates[field]) if (!variants.some(v => JSON.stringify(v) === JSON.stringify(variant))) variants.push(clone(variant));
            }
            kept[metadataKey].sourcePageImages = [...kept[metadataKey].sourcePageImages, ...fresh[metadataKey].sourcePageImages].filter((p, i, all) => all.findIndex(q => q.sourceFileId === p.sourceFileId && q.sourcePage === p.sourcePage) === i);
            kept[metadataKey].taskProblems = [...new Set([...kept[metadataKey].taskProblems, ...fresh[metadataKey].taskProblems])];
            kept[metadataKey].taskIssuesAcknowledged = false;
            kept.manualConfirmed = false; kept.confirmedAt = null; kept.status = 'pending';
            return kept;
        });
        // A model omission cannot erase a teacher edit or a submitted draft.
        for (const prior of byId.values()) {
            const kept = clone(prior);
            if (kept.status !== 'submitted') {
                kept.manualConfirmed = false; kept.confirmedAt = null; kept.status = 'pending';
                kept[metadataKey].taskProblems = [...kept[metadataKey].taskProblems, '本次识别未返回这道已人工处理的题，请对照原卷'];
                kept[metadataKey].taskIssuesAcknowledged = false;
            }
            result.push(kept);
        }
        return result;
    }
    function acknowledgeTaskIssues(draft, reviewController) {
        assert(isExternal(draft), 'review.task');
        const next = reviewController.markFieldsManual(draft, ['questionNumber']);
        next[metadataKey].taskIssuesAcknowledged = true;
        return next;
    }
    function reviewPanel(draft) {
        if (!isExternal(draft)) return null;
        const labels = { question: '题目', answer: '答案', solution: '解析' };
        const reviewLabels = { pass: '原模型候选复核通过', fail: '模型复核发现问题', invalid: '复核结果需要检查', pending: '复核尚未完成', not_run: '尚未复核' };
        const findings = [], summaries = [], seen = new Set();
        const addFinding = finding => { const key = JSON.stringify(finding); if (!seen.has(key)) { seen.add(key); findings.push(finding); } };
        const fields = ['question','answer','solution'].map(field => ({ field, label: labels[field], candidates: draft[metadataKey].candidates[field].map((variant, index) => {
            const item = insertFigures(variant.item, variant.images || [], field), report = variant.modelReview?.result;
            const review = report?.items?.find(entry => entry.item_id === variant.item.item_id);
            const sourceId = variant.source.sourceId;
            if (report?.summary && !summaries.includes(report.summary)) summaries.push(report.summary);
            for (const ref of report?.unrepresented || []) addFinding({ sourceFileId: ref.source_id, sourcePage: ref.page, label: '本次识别未表达的来源内容', text: ref.quote, detail: ref.reason });
            for (const request of report?.requests || []) for (const page of request.pages) addFinding({ sourceFileId: request.source_id, sourcePage: page, label: '模型请求补充来源页', text: '', detail: request.reason });
            for (const request of variant.contextRequests || []) for (const page of request.pages) addFinding({ sourceFileId: request.source_id, sourcePage: page, label: '模型请求补充来源页', text: '', detail: request.reason });
            for (const issue of variant.transcriptionIssues || []) addFinding({ sourceFileId: issue.source_id || sourceId, sourcePage: issue.page, label: issue.stage === 'locate' ? '原页定位标疑' : '原页转写标疑', text: issue.message, detail: issue.block_id || '' });
            return { index, sourceName: variant.source.filename, sourceFileId: sourceId, sourcePages: clone(variant.item.source_pages),
                stem: field === 'question' ? item.stem : '', options: field === 'question' ? clone(item.options) : [], text: field === 'question' ? '' : item[field], images: clone(variant.images || []),
                reviewLabel: reviewLabels[variant.modelReview?.state] || '待对照原页人工核对', issues: (review?.issues || []).map(issue => ({ ...clone(issue), sourceFileId: sourceId })),
                evidence: clone(review?.evidence || []), sourceIssues: clone(variant.item.issues || []),
                resourceIssues: (variant.cropErrors || []).map(problem => problem.error || '原图尚未准备完成'),
                canAdopt: draft.status !== 'submitted' && !variant.cropErrors?.length && !variant.item.figures.some(f => f.invalid) };
        }) }));
        return { fields, sources: clone(draft[metadataKey].sourcePageImages || []), findings, summaries, humanLabel: draft.status === 'submitted' ? '已入库' : draft.manualConfirmed ? '已人工确认' : '待人工核对' };
    }
    function reviewProblem(draft) {
        if (draft[metadataKey].taskProblems.length && !draft[metadataKey].taskIssuesAcknowledged) return '本任务存在未归属内容或未完成页，请先对照来源并确认本题范围。';
        if (!String(draft.stem || '').trim()) return '题干为空，请对照原页补充。';
        if (!Object.values(TYPES).filter(t => t !== '待确认').includes(draft.type)) return '请选择原卷题型。';
        const rejected = Object.entries(draft.fieldProvenance || {}).filter(([, p]) => p.status === 'rejected').map(([f]) => f);
        if (rejected.length) return `尚未处理不完整或冲突字段：${rejected.join('、')}。请修改或明确采用候选。`;
        if (['单选题', '多选题'].includes(draft.type) && !draft[metadataKey].optionLabels?.length && resolveUtils().hasUnrecognizedOptionRows(draft.stem || '')) return '选项格式未识别：本题按 A/B/C/D 字母标签切分选项，检测到的是数字标签行，请改成 A. B. C. D. 后再确认。';
        if (['单选题', '多选题'].includes(draft.type) && (draft.options.length < 2 || draft.options.some(o => !o.trim()) || draft[metadataKey].optionLabels?.length !== draft.options.length || draft[metadataKey].optionLabels.some((label, i) => label !== String.fromCharCode(65 + i)))) return '选项标签或正文不完整，请对照原页；缺失标签不会自动重编号。';
        if (['单选题', '多选题', '填空题'].includes(draft.type) && !draft.answer.trim()) return '答案缺失，请人工补充。';
        if (['单选题', '多选题'].includes(draft.type)) {
            const labels = draft[metadataKey].optionLabels;
            const answer = draft.answer.replace(/\[\[IMAGE:[^\]]+\]\]/g, '').trim();
            if (!(draft.type === '单选题' ? /^[A-Z]$/ : /^[A-Z]+$/).test(answer) || [...answer].some(label => !labels.includes(label)) || new Set(answer).size !== answer.length) return '答案标签与当前题型或选项不一致，请对照原 PDF；程序不会猜改题型。';
        }
        if (draft.images.length && draft.imageReviewStatus !== 'confirmed') return '请确认原 PDF 裁图与归属。';
        const math = mathProblems(draft, root.katex?.renderToString);
        if (math.length) return math[0].message;
        return '';
    }
    function editorSource(draft) {
        return draft.stem + (draft.options.length ? '\n\n' + draft.options.map((o, i) => `${draft[metadataKey].optionLabels[i] || String.fromCharCode(65 + i)}. ${o}`).join('\n') : '');
    }
    // Only explicit teacher editor delimiters are mapped. No legacy math cleaning or exam inference.
    function resolveUtils() {
        if (root && root.Qisi && root.Qisi.Utils) return root.Qisi.Utils;
        return require('./qisi-utils.js');
    }
    function projectEditorSource(source, draft) {
        if (source === (draft.editorSource || editorSource(draft))) return { stem: draft.stem, options: clone(draft.options), optionLabels: clone(draft[metadataKey].optionLabels || []), type: draft.type, parsedOptions: draft.options.length > 0 };
        if (!['单选题', '多选题'].includes(draft.type)) return { stem: source, options: [], optionLabels: [], type: draft.type, parsedOptions: false };
        const parsed = resolveUtils().splitOptionLabels(source);
        return { ...parsed, type: draft.type, parsedOptions: parsed.optionLabels.length > 0 };
    }
    function applyEditorSource(draft, source, reviewController) {
        const projection = projectEditorSource(source, draft);
        const labelsChanged = JSON.stringify(projection.optionLabels) !== JSON.stringify(draft[metadataKey].optionLabels || []);
        let next = reviewController.editFields(draft, { stem: projection.stem, options: projection.options });
        if (labelsChanged) next = reviewController.markFieldsManual(next, ['options']);
        next[metadataKey].optionLabels = projection.optionLabels;
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
            const index = copy[metadataKey].optionLabels.indexOf(target.slice(7));
            assert(index >= 0, 'review.crop.option'); copy.options[index] += '\n' + token;
        } else copy[field] += '\n' + token;
        copy.images.push({ ...image, position: target });
        copy.editorSource = editorSource(copy); copy.imageReviewStatus = 'need_confirm';
        return reviewController.markFieldsManual(copy, [field, 'images']);
    }
    const MATH_FIELD_LABEL = { stem: '题干', options: '选项', answer: '答案', solution: '解析' };
    // Everything that must reach the page as typeset math, not as typed text.
    // Only unambiguous patterns are listed: a bare LaTeX command, an unwrapped
    // superscript/subscript, a math glyph, a relation between math operands and
    // a named function applied to an operand. Ordinary prose ("第 2 题", "（1）",
    // "A. 3 万元") must never be reported, or the gate becomes unusable.
    const BARE_MATH_RULES = [
        { kind: '未包裹的 LaTeX 命令', pattern: /\\[a-zA-Z]+/ },
        { kind: '未包裹的上下标', pattern: /[A-Za-z0-9)\]}】]\s*[\^_]\s*\{?[A-Za-z0-9]/ },
        { kind: '未包裹的数学符号', pattern: /[√∠△□≤≥≠≈≌∽∈∉⊆⊂∪∩∅⊥∥∑∏∫∞παβγθλμσφωΔΣΠ]/ },
        { kind: '未包裹的关系式', pattern: /[A-Za-z][A-Za-z0-9]*\s*[=<>]\s*[-+]?[A-Za-z0-9(（]/ },
        { kind: '未包裹的函数名', pattern: /\b(?:sin|cos|tan|cot|sec|csc|log|ln|lg|lim|max|min)(?:\s+(?=[A-Za-z0-9(（∠√πθαβ])|(?=[A-Z0-9(（πθαβ]))/ }
    ];
    // Machine tokens ([[IMAGE:...]], [[figure:...]], [[asset:...]]) are placeholders,
    // never visible math, so they must not trigger the typed-math gate.
    const stripMathSegments = text => String(text ?? '')
        .replace(/\[\[[^\]\n]*\]\]/g, ' ')
        .replace(/\$\$[\s\S]*?\$\$/g, ' $$ ')
        .replace(/(^|[^\\])\$[^$\n]*?\$/g, '$1 $$ ');
    function bareMath(text) {
        const visible = stripMathSegments(text);
        for (const rule of BARE_MATH_RULES) {
            const match = visible.match(rule.pattern);
            if (match) return { token: match[0].trim(), kind: rule.kind };
        }
        return null;
    }
    function mathProblems(draft, renderMath) {
        const problems = [];
        for (const field of ['stem', 'options', 'answer', 'solution']) {
            const texts = Array.isArray(draft[field]) ? draft[field] : [draft[field]];
            for (const text of texts) {
                const bare = bareMath(text);
                if (bare) {
                    problems.push({ field, message: '公式必须写成 LaTeX：' + MATH_FIELD_LABEL[field] + '中有' + bare.kind + '“' + bare.token + '”，请对照原卷改为 $…$ 形式' });
                    break;
                }
                for (const match of String(text).matchAll(/\$\$([\s\S]*?)\$\$|(?<!\\)\$([^$\n]+)\$/g)) {
                    const math = match[1] ?? match[2];
                    try {
                        if (/\\\\[a-zA-Z]/.test(math)) throw new Error('公式反斜杠重复转义');
                        if (renderMath) renderMath(math, { throwOnError: true, strict: 'ignore' });
                    } catch (error) { problems.push({ field, message: '公式需要对照原卷修正：' + error.message }); break; }
                }
            }
        }
        return problems;
    }
    function chooseCandidate(draft, field, index, reviewController) {
        assert(isExternal(draft) && ['question', 'answer', 'solution'].includes(field), 'review.candidate');
        const variant = draft[metadataKey].candidates[field][index];
        assert(variant && !variant.cropErrors?.length && !variant.item.figures.some(f => f.invalid), 'review.candidate.figure');
        const copy = clone(draft);
        const fields = field === 'question' ? ['questionNumber', 'stem', 'options'] : [field];
        const item = insertFigures(variant.item, variant.images || [], field);
        if (field === 'question') {
            copy.stem = item.stem; copy.options = item.options.map(o => o.text); copy.type = TYPES[item.type];
            copy[metadataKey].optionLabels = item.options.map(o => o.label);
        } else copy[field] = item[field];
        const belongs = i => field === 'question' ? i.position === 'stem' || i.position.startsWith('option:') : i.position === field;
        copy.images = [...copy.images.filter(i => !belongs(i)), ...clone(variant.images || [])].map(i => ({ ...i, questionId: copy.id, batchId: copy.batchId }));
        copy[metadataKey].states[field] = 'manual';
        copy.editorSource = editorSource(copy);
        copy.imageReviewStatus = copy.images.length ? 'need_confirm' : 'none';
        if (!copy.images.length) copy.fieldProvenance.images = { field: 'images', kind: 'missing', status: 'missing' };
        const next = reviewController.markFieldsManual(copy, [...fields, ...(copy.images.length ? ['images'] : [])]);
        for (const target of fields) Object.assign(next.fieldProvenance[target], {
            sourceId: variant.source.sourceId, sourceFormat: 'pdf', page: variant.item.source_pages[0]
        });
        for (const target of fields) if (Array.isArray(next[target]) ? !next[target].length : !String(next[target] || '').trim()) next.fieldProvenance[target] = { field: target, kind: 'missing', status: 'missing' };
        return next;
    }

return Object.freeze({ PROTOCOL, TYPES, isRecord: isExternal, validateCanonical, retainReviewDrafts,
    bboxValid, reviewPanel, reviewProblem, editorSource, projectEditorSource, applyEditorSource,
    chooseCandidate, removeImage, applyManualCrop, mathProblems, bareMath, acknowledgeTaskIssues });
}
return Object.freeze({ createRecordContract });
});
