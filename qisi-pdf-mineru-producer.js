(function(root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.Qisi = root.Qisi || {}; root.Qisi.PdfMineruProducer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
    'use strict';
    const dependency = (name, file) => root.Qisi?.[name] || require(file);
    const S = dependency('PaperSegmenter', './qisi-paper-segmenter');
    const E = dependency('MineruEvidence', './qisi-mineru-evidence');
    const C = dependency('PdfMineruContract', './qisi-pdf-mineru-contract');
    const Identity = dependency('DocxProducerIdentityContract', './qisi-docx-producer-identity-contract');
    const Display = dependency('PdfQuestionDisplay', './qisi-pdf-question-display');
    const copy = value => JSON.parse(JSON.stringify(value));
    const fail = code => Object.assign(new Error(code), { code, stage: 'pdf-mineru' });
    const active = signal => { if (signal?.aborted) throw fail('MINERU_CANCELLED'); };
    const digest = async bytes => [...new Uint8Array(await root.crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
    const asDataUrl = async blob => {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        return `data:${blob.type};base64,${btoa(binary)}`;
    };
    function createProducer(ports = {}) {
        for (const name of ['renderPages', 'getRoles']) {
            if (typeof ports[name] !== 'function') {
                throw Object.assign(new Error('PDF_MINERU_PORT_REQUIRED'),
                    { code: 'PDF_MINERU_PORT_REQUIRED', port: name });
            }
        }
        const fetcher = ports.fetch || root.fetch.bind(root);
        const request = async (url, options) => {
            const response = await fetcher(url, options);
            if (!response.ok) {
                let payload; try { payload = await response.json(); } catch { payload = {}; }
                const error = fail(/^MINERU_[A-Z0-9_]+$/.test(payload.code || '') ? payload.code : 'MINERU_REQUEST_FAILED');
                error.stage = /^[a-z-]+$/.test(payload.stage || '') ? payload.stage : 'pdf-mineru';
                throw error;
            }
            return response;
        };
        return async (context, signal) => {
            active(signal);
            const status = await (await request('/api/mineru/status', { signal })).json();
            if (status.configured !== true) throw fail('MINERU_NOT_CONFIGURED');
            const files = [...context.sources, ...(context.supplementalSources || [])].filter((f, i, all) => all.findIndex(x => x.id === f.id) === i);
            const rolesOf = file => ports.getRoles(file);
            const questionFiles = files.filter(f => rolesOf(f).some(r => r === 'question' || r === 'full'));
            if (questionFiles.length !== 1 || files.some(f => f.fileType !== 'pdf' || f.convertedFromDocx)) throw fail('PDF_MINERU_SOURCE_SCOPE_INVALID');
            const previous = await ports.getExistingDrafts?.(context.batchId) || [];
            if (previous.some(d => !C.isRecord(d))) throw fail('PDF_MINERU_EXISTING_PROTOCOL');
            const sourceResults = [], evidence = [], allPages = new Map();
            for (const file of files) {
                active(signal);
                context.reportStage?.({ stage: 'pdf-mineru-task-start', engine: 'mineru' });
                const sourceResponse = await fetcher(file.uploadPath, { signal });
                active(signal);
                if (!sourceResponse.ok) throw fail('MINERU_INPUT_INVALID');
                const blob = await sourceResponse.blob(), sha256 = await digest(await blob.arrayBuffer());
                const form = new FormData(); form.append('file', blob, file.filename);
                const result = await (await request('/api/mineru/parse', { method: 'POST', body: form, signal })).json();
                // The parse may resolve after the caller cancelled (held/ignored fetch
                // signal); never continue into projection or persistence then.
                active(signal);
                if (result.protocol !== 'mineru-blocks-v1' || result.source?.sha256 !== sha256 || result.job !== sha256 || !Array.isArray(result.pages) || !Array.isArray(result.evidence?.items)) throw fail('MINERU_RESPONSE_INVALID');
                const source = { sourceId: file.id, format: 'pdf', filename: file.filename, mimeType: 'application/pdf', sourceOrder: sourceResults.length };
                const pages = await ports.renderPages(file, { sequential: true, requireAllPages: true, suppressCostEstimate: true });
                active(signal);
                const totalPages = pages.totalPages;
                if (!Number.isSafeInteger(totalPages) || totalPages < 1) throw fail('PDF_MINERU_RENDER_CONTRACT_INVALID');
                // Page selection is applied to blocks by exact original page, never renumbered.
                const selected = new Set(pages.map(p => p.pageNo));
                if (!selected.size || pages.some((p, i) => !Number.isSafeInteger(p.pageNo) || p.pageNo < 1 || i && p.pageNo !== pages[i - 1].pageNo + 1) || result.pages.some(p => !Number.isSafeInteger(p.page) || p.page < 1 || p.page > totalPages)) throw fail('PDF_MINERU_PAGE_SCOPE_INVALID');
                allPages.set(file.id, pages);
                const blocks = result.pages.filter(p => selected.has(p.page)).flatMap(p => p.blocks).map(block => ({ ...block,
                    id: file.id + '/' + block.id, ...(block.parentId ? { parentId: file.id + '/' + block.parentId } : {}),
                    origin: { ...block.origin, sourceId: sha256, blockId: file.id + '/' + block.origin.blockId }, sourceFileId: file.id }));
                const row = { file, source, sha256, result, blocks, roles: rolesOf(file) }; sourceResults.push(row);
                const saved = { sourceId: file.id, sha256, job: result.job, receipt: result.receipt, roles: row.roles,
                    selectedPages: [...selected], rawEvidence: copy(result.evidence), blocks: copy(blocks) };
                evidence.push(saved);
                active(signal);
                await ports.persistSourceEvidence?.(file, { protocol: C.PROTOCOL, tasks: [saved], unassigned: [], errors: [] });
            }
            active(signal);
            const primary = sourceResults.find(row => row.file.id === questionFiles[0].id);
            const paper = S.segmentPaper(primary.blocks);
            // Question-only sources cannot silently contribute embedded answers.
            const base = S.assemblePartial({ questionSegment: paper.questionSegment,
                solutionSegment: primary.roles.includes('full') ? paper.solutionSegment : null,
                answerTable: primary.roles.includes('full') ? primary.result.answerTable : null });
            const assemblies = [{ row: primary, built: base }];
            for (const row of sourceResults.filter(row => row !== primary)) {
                const support = S.segment(row.blocks, { numbers: paper.questionSegment.order, role: 'support' });
                assemblies.push({ row, built: S.assemblePartial({ questionSegment: paper.questionSegment, solutionSegment: support, answerTable: row.result.answerTable }) });
            }
            if (!paper.questionSegment.valid || !base.questions.length) throw fail('PDF_MINERU_QUESTION_SEQUENCE_INVALID');
            const issues = assemblies.flatMap(({ row, built }) => built.issues.map(issue => ({ ...issue, sourceId: row.file.id })));
            // A support sequence rejected as a whole leaves even correctly ordered
            // questions without a bound answer. Say so per question instead of only
            // reporting the two backward transitions.
            const supportFailureCodes = [...new Set(assemblies
                .filter(assembly => assembly.row !== primary && !assembly.built.valid)
                .flatMap(assembly => assembly.built.issues.map(issue => issue.code)))];
            for (const assembly of assemblies) assembly.byNo = new Map(assembly.built.questions.map(q => [q.questionNo, q]));
            const runsByNo = new Map(paper.questionSegment.runs.map(run => [run.no, run]));
            const types = new Map();
            let printedType = 'unknown';
            for (const block of primary.blocks) {
                const heading = String(block.text || '').trim().match(/^(?:[一二三四五六七八九十]+[、．.]\s*)?(单项选择题|单选题|多项选择题|多选题|填空题|解答题)(?:[：:（(\s]|$)/);
                if (heading) printedType = ({ 单项选择题: 'single_choice', 单选题: 'single_choice', 多项选择题: 'multiple_choice', 多选题: 'multiple_choice', 填空题: 'fill_blank', 解答题: 'free_response' })[heading[1]];
                const no = S.numberOnBlock(block); if (no && !types.has(no)) types.set(no, printedType);
            }
            const taskProblems = issues.map(issue => `${issue.sourceId}: ${issue.code}${issue.no ? ' (' + issue.no + ')' : ''}`);
            const sourceByFile = new Map(sourceResults.map(row => [row.file.id, row]));
            const assetCache = new Map();
            const drafts = [];
            for (const question of base.questions) {
                const no = question.questionNo, id = context.batchId + ':mineru:' + no;
                const run = runsByNo.get(no);
                const images = [];
                const tableComparisons = new Map();
                const materialize = async (blocks, field) => {
                    const parts = [];
                    for (const block of blocks) {
                        active(signal);
                        if (block.type === 'table' && block.text) {
                            parts.push('表格识别文字（待核对）：\n' + Display.tableDisplayText(block.text));
                            if (block.image) tableComparisons.set(block.id, block);
                        }
                        if (block.image) {
                            const row = sourceByFile.get(block.sourceFileId), key = row.sha256 + '/' + block.image;
                            let url = assetCache.get(key);
                            if (!url) {
                                const response = await request('/api/mineru/image?' + new URLSearchParams({ job: row.result.job, sourceId: row.sha256, name: block.image }), { signal });
                                active(signal);
                                const blob = await response.blob();
                                if (!/^image\/(png|jpeg|webp)$/.test(blob.type) || !blob.size) throw fail('MINERU_IMAGE_INVALID');
                                url = await asDataUrl(blob); assetCache.set(key, url);
                            }
                            // No fabricated crop coordinates: use returned normalized coordinates or whole original asset bounds.
                            const bbox = Array.isArray(block.bbox) && C.bboxValid(block.bbox) ? block.bbox : [0, 0, 1000, 1000];
                            const imageId = id + ':' + field + ':' + encodeURIComponent(block.id);
                            images.push({ id: imageId, questionId: id, batchId: context.batchId, url, position: field,
                                sourceFileId: row.file.id, sourcePage: block.page, sourceSha256: row.sha256, assetPath: block.image,
                                bbox, coordinateSpace: block.bbox ? 'mineru-normalized' : 'asset-full', figureId: block.id });
                            parts.push('[[IMAGE:' + imageId + ']]');
                        } else if (block.text && block.type !== 'table') parts.push(block.text);
                    }
                    return parts.join('\n');
                };
                const Utils = root.Qisi?.Utils || require('./qisi-utils');
                const stem = await materialize(Display.questionDisplayBlocks(run.blocks, types.get(no), Utils, S.NUMBER_START), 'stem');
                const split = Display.projectQuestionText(stem.replace(S.NUMBER_START, ''), types.get(no), Utils);
                const imagePlacementProblems = [];
                for (const image of images) {
                    const token = '[[IMAGE:' + image.id + ']]';
                    const fields = [
                        ...(split.stem.includes(token) ? ['stem'] : []),
                        ...split.options.flatMap((text, index) => text.includes(token) ? ['option:' + split.optionLabels[index]] : [])
                    ];
                    if (fields.length === 1) image.position = fields[0];
                    else imagePlacementProblems.push('图片占位的字段位置不唯一，请对照原页核对归属。');
                }
                if (images.some(image => image.position.startsWith('option:')) &&
                    (split.optionLabels.join('') !== 'ABCD' || split.options.some(text => !text.trim()))) {
                    imagePlacementProblems.push('选项标签或正文不完整，图片仅按当前文本位置保留，请对照原页核对；缺失标签不会自动补齐或重编号。');
                }
                const declarations = [], declarationBlocks = [], solutions = [], comparison = [];
                // A declaration may point at a derived fragment. Resolve it back to the
                // original block so page and block evidence stay tied to the real source.
                const evidenceBlockOf = (row, built, declaration) => {
                    if (declaration.blockId) {
                        const derived = built.blocksById?.[declaration.blockId];
                        const originalId = derived?.origin?.blockId || declaration.blockId;
                        return row.blocks.find(block => block.id === originalId) || derived || null;
                    }
                    if (declaration.kind === 'answer-table') {
                        const tables = row.blocks.filter(block => block.type === 'table');
                        return tables.length === 1 ? tables[0] : null;
                    }
                    return null;
                };
            // A support file is a capability, but explicit roles still win:
            // 题目 + 答案 + 解析 三份文件时，答案文件只交答案、解析文件只交解析，
            // 不允许两份来源互相顶替产生“答案冲突/解析冲突”。
            // 只有某条流没有任何显式来源时，才让另一份支持文件补上它
            // （答案 PDF 顺带带解析、解析 PDF 顺带带“故选”）。
            const supportRows = sourceResults.filter(row => row !== primary);
            const hasExplicitAnswer = supportRows.some(row => row.roles.some(role => ['full', 'answer'].includes(role)));
            const hasExplicitSolution = supportRows.some(row => row.roles.some(role => ['full', 'solution'].includes(role)));
            for (const { row, built, byNo } of assemblies) {
                    const q = byNo.get(no);
                    if (!built.valid || !q) continue;
                    const isSupport = row !== primary;
                    const anySupportRole = row.roles.some(role => ['full', 'answer', 'solution'].includes(role));
                    const contributesAnswer = row.roles.some(role => ['full', 'answer'].includes(role)) ||
                        (isSupport && !hasExplicitAnswer && anySupportRole);
                    const contributesSolution = row.roles.some(role => ['full', 'solution'].includes(role)) ||
                        (isSupport && !hasExplicitSolution && anySupportRole);
                    if (contributesAnswer) {
                        for (const declaration of q.answerEvidence.evidence) {
                            declarations.push({ ...declaration, sourceFileId: row.file.id });
                            declarationBlocks.push({ sourceFileId: row.file.id, block: evidenceBlockOf(row, built, declaration) });
                        }
                    }
                    if (contributesSolution && q.solutionBlocks.length) {
                        solutions.push({ row, blocks: q.solutionBlocks.map(b => built.blocksById[b]) });
                        comparison.push(...E.explicitDeclarations(q.solutionBlocks.map(b => built.blocksById[b])).map(d => ({ ...d, sourceFileId: row.file.id })));
                    }
                }
                const answers = E.aggregateAnswers([...declarations, ...comparison]), conflict = answers.state === 'conflicting' || solutions.length > 1;
                const solution = !conflict && solutions.length === 1 ? await materialize(solutions[0].blocks, 'solution') : '';
                const answer = !conflict ? E.aggregateAnswers(declarations).value : '';
                const reason = 'mineru-evidence-projection';
                const candidates = { question: [], answer: [], solution: [] };
                const variant = (field, text, row, blocks, selectedImages = []) => ({ source: copy(row.source), images: copy(selectedImages), cropErrors: [],
                    item: { type: types.get(no) || 'unknown', stem: field === 'question' ? split.stem : '', options: split.options.map((text, i) => ({ label: split.optionLabels[i], text })),
                        [field]: text, source_pages: [...new Set(blocks.map(b => b.page))], figures: [], issues: [], number_page: blocks[0]?.page || 1 },
                    evidence: blocks.map(b => ({ blockId: b.id, origin: copy(b.origin) })) });
                candidates.question.push(variant('question', '', primary, run.blocks, images.filter(i => i.position === 'stem' || i.position.startsWith('option:'))));
                if (answer) {
                    const resolved = declarationBlocks
                        .map((entry, index) => ({ declaration: declarations[index], entry }))
                        .filter(item => item.entry?.block);
                    const sourceFileId = resolved[0]?.entry.sourceFileId || declarations[0]?.sourceFileId;
                    // Only declarations from the chosen source row are candidate evidence;
                    // the aggregate remains the field value.
                    const evidence = resolved
                        .filter(item => item.entry.sourceFileId === sourceFileId)
                        .map(item => item.entry.block);
                    candidates.answer.push(variant('answer', answer,
                        sourceByFile.get(sourceFileId) || primary, [...new Set(evidence)]));
                }
                if (solution) {
                    const evidenceBlocks = [...new Set(solutions[0].blocks.map(block => {
                        const originalId = block.origin?.blockId;
                        return solutions[0].row.blocks.find(item => item.id === originalId) || block;
                    }))];
                    candidates.solution.push(variant('solution', solution, solutions[0].row, evidenceBlocks, images.filter(i => i.position === 'solution')));
                }
                const tableProblems = assemblies.flatMap(({ built, byNo }) => (byNo.get(no)?.contentIssues || [])
                    .filter(issue => issue.code === 'empty-source-block' && built.blocksById[issue.blockId]?.type === 'table')
                    .map(issue => built.blocksById[issue.blockId]))
                    .map(block => '原PDF“' + sourceByFile.get(block.sourceFileId).file.filename + '”第' + block.page + '页表格内容未读取，请对照原页检查并补全。');
                const draftProblems = [...new Set([
                    ...(!answer && supportFailureCodes.length
                        ? [...taskProblems, `第${no}题答案未绑定：支持文件序列未通过整体校验（${supportFailureCodes.join('、')}），请对照原页确认。`]
                        : taskProblems),
                    ...tableProblems, ...imagePlacementProblems,
                    ...[...tableComparisons.values()].map(block => '原PDF“' + sourceByFile.get(block.sourceFileId).file.filename +
                        '”第' + block.page + '页同时保留表格识别文字和图片，请核对二者及跨页续行。')
                ])];
                const draft = { id, batchId: context.batchId, version: 1, questionNumber: no, question: no, order: drafts.length + 1,
                    stem: split.stem, options: split.options, answer, solution, images, type: C.TYPES[types.get(no) || 'unknown'], status: 'pending', manualConfirmed: false,
                    imageReviewStatus: images.length ? 'need_confirm' : 'none', source: copy(primary.source), sourceFileId: primary.file.id,
                    sourceFileName: primary.file.filename, sourcePage: run.blocks[0].page,
                    producer: { mode: 'vision-ai', routeId: C.PROTOCOL, routeReason: reason, engine: 'mineru', deterministic: false },
                    route: { identity: C.PROTOCOL, reason, transitions: copy(Identity.PDF_VISION_TRANSITIONS) },
                    supportSources: sourceResults.filter(r => r !== primary).map(r => ({ ...r.source, roles: r.roles.filter(role => ['answer', 'solution'].includes(role)) })),
                    fieldProvenance: {}, warnings: [...draftProblems, ...(conflict ? ['答案声明或解析来源冲突，已保留证据并留空'] : [])],
                    pdfReview: { protocol: C.PROTOCOL, examId: context.batchId, sourceSha256: primary.sha256,
                        rawSources: sourceResults.map(r => ({ sourceId: r.file.id, sha256: r.sha256 })), candidates, states: {}, optionLabels: split.optionLabels,
                        answerEvidence: answers, taskProblems: draftProblems, taskIssuesAcknowledged: false, sourcePageImages: [] }, createdAt: Date.now(), updatedAt: Date.now() };
                for (const field of Identity.FORMAL_FIELDS) {
                    const present = field === 'questionNumber' || (Array.isArray(draft[field]) ? draft[field].length : draft[field]);
                    const unit = ['questionNumber', 'stem', 'options'].includes(field) ? 'question' : field;
                    const candidate = candidates[unit]?.[0];
                    const source = candidate?.source || primary.source;
                    const kind = present || conflict && ['answer', 'solution'].includes(field) ? 'rejected' : 'missing';
                    draft.pdfReview.states[unit] = kind;
                    draft.fieldProvenance[field] = { field, kind, status: kind, sourceId: source.sourceId, sourceFormat: 'pdf',
                        producerMode: 'vision-ai', routeId: C.PROTOCOL, engine: 'mineru', page: candidate?.item.number_page || draft.sourcePage,
                        blockIds: candidate?.evidence.map(e => e.blockId) || [], manuallyEdited: false, controlledWriteAccepted: false,
                        controlledWriteDecisionId: id + ':' + field, reasonCode: 'mineru-pending-human-review',
                        producerBoundary: source.sourceId === primary.source.sourceId ? 'pdf-vision-engine-output-to-candidate' : 'pdf-mineru-support-to-candidate', contractVersion: Identity.CONTRACT_VERSION };
                }
                draft.fieldProvenance.images.imageEvidence = images.map(i => ({ imageId: i.id, sourceId: i.sourceFileId, field: i.position, evidenceRef: i.sourceSha256 + '/' + i.assetPath }));
                for (const row of sourceResults) {
                    const usedPages = new Set(Object.values(candidates).flat().filter(v => v.source.sourceId === row.file.id).flatMap(v => v.item.source_pages));
                    for (const page of allPages.get(row.file.id).filter(page => usedPages.has(page.pageNo))) draft.pdfReview.sourcePageImages.push({ ...page, sourcePage: page.pageNo, sourceFileId: row.file.id, sourceFileName: row.file.filename });
                }
                draft.sourcePageImage = draft.pdfReview.sourcePageImages.find(p => p.sourceFileId === primary.file.id && p.sourcePage === draft.sourcePage)?.url || '';
                draft.sourceTrace = { source: C.PROTOCOL, sourceFileId: primary.file.id, sourcePage: draft.sourcePage, sourceSha256: primary.sha256, sourcePageImage: draft.sourcePageImage };
                drafts.push(draft);
            }
            active(signal);
            const retained = C.retainReviewDrafts(drafts, previous);
            C.validateCanonical(retained, context.batchId, Identity);
            active(signal);
            context.reportStage?.({ stage: 'pdf-mineru-canonical-produced', engine: 'mineru', counts: { drafts: retained.length } });
            const unassigned = issues.map(issue => {
                const row = sourceByFile.get(issue.sourceId);
                const exact = issue.blockId ? row.blocks.filter(block => block.id === issue.blockId) : [];
                const blocks = exact.length ? exact : row.blocks;
                return { ...issue, source_id: issue.sourceId, source_pages: [...new Set(blocks.map(block => block.page))],
                    reason: issue.code, text: blocks.map(block => block.text || block.image || '').join('\n') };
            });
            return { pdfProtocol: C.PROTOCOL, drafts: retained, draftImages: retained.flatMap(d => d.images),
                evidence, windowErrors: [], warnings: taskProblems, unmatched: issues, unassigned };
        };
    }
    return Object.freeze({ createProducer });
});
