(function (root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.DocxPipeline = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined' ? globalThis : this,
    function (root) {
        'use strict';

        const console = root.Qisi?.Runtime?.console || root.console;
        const utils = () => root.Qisi?.Utils || {};

        const cleanRecognizedText = (value) => {
            const fn = utils().cleanRecognizedText;
            if (typeof fn === 'function') return fn(value);
            if (value === false || value === true || value === null || value === undefined) return '';
            if (Array.isArray(value)) return value.map(cleanRecognizedText).filter(Boolean).join('\n');
            if (typeof value === 'object') return '';
            return String(value)
                .replace(/<w:br\s*\/?>/g, '\n')
                .replace(/<\/w:p>/g, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'")
                .replace(/\u00A0/g, ' ')
                .replace(/[ \t]+\n/g, '\n')
                .replace(/[ \t]{2,}/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        };

        const protectBatchMediaTokens = (text = '') => {
            const fn = utils().protectBatchMediaTokens;
            if (typeof fn === 'function') return fn(text);
            const tokens = [];
            const protectedText = String(text || '').replace(
                /(\[\[(?:IMAGE|FORMULA_IMAGE):[^\]]+\]\]|\\includegraphics(?:\[[^\]]*\])?\{[^}]+\})/g,
                match => {
                    const key = `__QISI_MEDIA_TOKEN_${tokens.length}__`;
                    tokens.push(match);
                    return key;
                }
            );
            return { protectedText, tokens };
        };

        const restoreBatchMediaTokens = (text = '', tokens = []) => {
            const fn = utils().restoreBatchMediaTokens;
            if (typeof fn === 'function') return fn(text, tokens);
            return String(text || '').replace(/__QISI_MEDIA_TOKEN_(\d+)__/g, (_, idx) => {
                return tokens[Number(idx)] || '';
            });
        };

        const normalizeDocxPipelineResult = (questions, answers, solutions) => ({
            questionCount: (questions || []).length,
            answerCount: (answers || []).length,
            solutionCount: (solutions || []).length,
            mode: (questions || []).length === (answers || []).length &&
                (questions || []).length === (solutions || []).length
                ? 'full'
                : 'partial'
        });

        const normalizeQuestionKey = (value) => {
            const text = String(value || '')
                .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                .replace(/第|题|[.．、:：\s]/g, '')
                .trim();

            const num = text.match(/\d{1,3}/)?.[0] || '';
            return num ? String(Number(num)) : '';
        };

        const normalizeDocxOptionEvidenceText = (text = '') => {
            return cleanRecognizedText(text)
                .replace(/\r/g, '\n')
                .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                .replace(/[①②③④]/g, m => ({ '①': 'A.', '②': 'B.', '③': 'C.', '④': 'D.' }[m] || m))
                .replace(/([A-D])\s*[．.、:：]\s*/g, '$1. ')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        };

        const extractDocxQuestionBlockByNumber = (fullText = '', questionNo = '') => {
            const source = normalizeDocxOptionEvidenceText(fullText);
            const qno = normalizeQuestionKey(questionNo);

            if (!source || !qno) return '';

            const startPatterns = [
                new RegExp(`(?:^|\\n)\\s*(?:第\\s*)?${qno}\\s*(?:题)?\\s*[\\.．、:：\\)）]?\\s*`, 'g'),
                new RegExp(`(?:^|\\n)\\s*[（(]\\s*${qno}\\s*[）)]\\s*`, 'g')
            ];

            let startMatch = null;
            let startRe = null;

            for (const re of startPatterns) {
                const m = re.exec(source);
                if (m) {
                    startMatch = m;
                    startRe = re;
                    break;
                }
            }

            if (!startMatch || !startRe) return '';

            const cur = Number(qno);
            const start = startMatch.index + (startMatch[0].startsWith('\n') ? 1 : 0);
            const afterStart = startRe.lastIndex;

            const nextQuestionRe = /(?:^|\n)\s*(?:第\s*)?[（(]?\s*(\d{1,3})\s*[）)]?\s*(?:题)?\s*[\.．、:：\)）]?\s*/g;
            nextQuestionRe.lastIndex = afterStart;

            let end = source.length;
            let m;

            while ((m = nextQuestionRe.exec(source)) !== null) {
                const n = Number(m[1]);
                if (Number.isFinite(n) && Number.isFinite(cur) && n > cur) {
                    end = m.index;
                    break;
                }
            }

            return source.slice(start, end).trim();
        };

        const decodeXmlEntitiesSafe = (value = '') => String(value || '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");

        const stripXmlTagsForDocxText = (value = '') => {
            return decodeXmlEntitiesSafe(String(value || ''))
                .replace(/<w:tab\s*\/>/g, ' ')
                .replace(/<w:br\s*\/>/g, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        };

        const extractPlainTextFromDocxXmlFragment = (xmlFragment = '') => {
            const source = String(xmlFragment || '');
            const parts = [];

            source.replace(/<(?:w:t|m:t|w:instrText|w:delText)[^>]*>([\s\S]*?)<\/(?:w:t|m:t|w:instrText|w:delText)>/g, (_, textNode) => {
                const text = stripXmlTagsForDocxText(textNode);
                if (text) parts.push(text);
                return '';
            });

            source.replace(/<m:chr[^>]*m:val="([^"]+)"[^>]*\/>/g, (_, mathChar) => {
                if (mathChar) parts.push(mathChar);
                return '';
            });

            if (!parts.length) {
                const fallback = stripXmlTagsForDocxText(source);
                if (fallback) parts.push(fallback);
            }

            return cleanRecognizedText(parts.join(' '));
        };

        const normalizeDocxOptionCellText = (text = '') => {
            return cleanRecognizedText(String(text || '')
                .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                .replace(/^[A-D]\s*[.．、:：)）]\s*/i, '')
                .replace(/\s+/g, ' ')
                .trim()
            );
        };

        const extractDocxTableTextFallback = (documentXml = '') => {
            const source = String(documentXml || '');
            const tableBlocks = [];

            source.replace(/<w:tbl[\s\S]*?<\/w:tbl>/g, (tableXml) => {
                const rowTexts = [];

                tableXml.replace(/<w:tr[\s\S]*?<\/w:tr>/g, (rowXml) => {
                    const cells = [];

                    rowXml.replace(/<w:tc[\s\S]*?<\/w:tc>/g, (cellXml) => {
                        const cellText = extractPlainTextFromDocxXmlFragment(cellXml);
                        if (cellText) cells.push(cellText);
                        return '';
                    });

                    if (!cells.length) return '';

                    if (cells.length === 4) {
                        const normalized = cells.map(normalizeDocxOptionCellText);
                        if (normalized.filter(Boolean).length >= 2) {
                            rowTexts.push(`A. ${normalized[0] || ''} B. ${normalized[1] || ''} C. ${normalized[2] || ''} D. ${normalized[3] || ''}`);
                        } else {
                            rowTexts.push(cells.join(' '));
                        }
                        return '';
                    }

                    if (cells.length === 2) {
                        rowTexts.push(cells.map(normalizeDocxOptionCellText).join('    '));
                        return '';
                    }

                    rowTexts.push(cells.join(' '));
                    return '';
                });

                if (rowTexts.length) {
                    const block = rowTexts.join('\n').trim();
                    if (block) tableBlocks.push(block);
                }

                return '';
            });

            const tableText = tableBlocks.join('\n\n').trim();

            console.groupCollapsed?.('[BATCH_DEBUG][docx-table-fallback-extract]');
            console.log?.('tableCount =', tableBlocks.length);
            console.log?.('tableTextLength =', tableText.length);
            console.log?.('tableTextHead =', tableText.slice(0, 2000));
            console.groupEnd?.();

            return tableText;
        };

        const parseDocxRelationshipMap = (relsXml = '') => {
            const map = new Map();

            String(relsXml || '').replace(/<Relationship\b([^>]+?)\/>/g, (_, attrs) => {
                const id = attrs.match(/\bId=["']([^"']+)["']/)?.[1] || '';
                const target = attrs.match(/\bTarget=["']([^"']+)["']/)?.[1] || '';
                const type = attrs.match(/\bType=["']([^"']+)["']/)?.[1] || '';

                if (!id || !target) return '';

                let normalizedTarget = target.replace(/\\/g, '/');
                if (!/^word\//.test(normalizedTarget)) {
                    normalizedTarget = normalizedTarget.startsWith('/')
                        ? normalizedTarget.replace(/^\/+/, '')
                        : `word/${normalizedTarget.replace(/^(\.\.\/)+/, '')}`;
                }

                map.set(id, { id, target: normalizedTarget, type });
                return '';
            });

            return map;
        };

        const getExtensionFromPath = (path = '') => {
            const match = String(path || '').match(/\.([a-zA-Z0-9]+)$/);
            return match ? match[1].toLowerCase() : '';
        };

        const mimeFromDocxMediaPath = (path = '') => {
            const ext = getExtensionFromPath(path);
            return {
                png: 'image/png',
                jpg: 'image/jpeg',
                jpeg: 'image/jpeg',
                gif: 'image/gif',
                bmp: 'image/bmp',
                webp: 'image/webp',
                svg: 'image/svg+xml',
                emf: 'image/emf',
                wmf: 'image/wmf'
            }[ext] || 'application/octet-stream';
        };

        const debugDocxXmlStructure = (documentXml = '', filename = '') => {
            const source = String(documentXml || '');

            const count = (regex) => (source.match(regex) || []).length;

            const sampleAround = (keyword, radius = 500) => {
                const idx = source.indexOf(keyword);
                if (idx < 0) return '';
                return source.slice(Math.max(0, idx - radius), Math.min(source.length, idx + keyword.length + radius));
            };

            const textNodes = [];
            source.replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, (_, text) => {
                const clean = decodeXmlEntitiesSafe(text).trim();
                if (clean) textNodes.push(clean);
                return '';
            });

            const textJoined = textNodes.join('\n');

            console.groupCollapsed?.('[BATCH_DEBUG][docx-xml-structure]');
            console.log?.('filename =', filename);
            console.table?.([{
                length: source.length,
                w_t_count: count(/<w:t\b/g),
                w_tbl_count: count(/<w:tbl\b/g),
                w_tr_count: count(/<w:tr\b/g),
                w_tc_count: count(/<w:tc\b/g),
                w_drawing_count: count(/<w:drawing\b/g),
                w_pict_count: count(/<w:pict\b/g),
                v_textbox_count: count(/<v:textbox\b/g),
                wps_txbx_count: count(/<wps:txbx\b/g),
                w_txbxContent_count: count(/<w:txbxContent\b/g),
                mc_alternate_count: count(/<mc:AlternateContent\b/g),
                m_oMath_count: count(/<m:oMath\b/g),
                has_A_label: /(?:^|[>\s])A[.．、:：)）]/.test(source),
                has_B_label: /(?:^|[>\s])B[.．、:：)）]/.test(source),
                has_C_label: /(?:^|[>\s])C[.．、:：)）]/.test(source),
                has_D_label: /(?:^|[>\s])D[.．、:：)）]/.test(source)
            }]);

            console.log?.('textNodesHead =', textJoined.slice(0, 2000));
            console.log?.('sampleAround A. =', sampleAround('A.'));
            console.log?.('sampleAround B. =', sampleAround('B.'));
            console.log?.('sampleAround C. =', sampleAround('C.'));
            console.log?.('sampleAround D. =', sampleAround('D.'));
            console.log?.('sampleAround txbxContent =', sampleAround('w:txbxContent'));
            console.log?.('sampleAround drawing =', sampleAround('w:drawing'));
            console.log?.('sampleAround pict =', sampleAround('w:pict'));
            console.groupEnd?.();
        };

        const normalizeDocxTextSpace = (value = '') => {
            return cleanRecognizedText(String(value || '')
                .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                .replace(/\u00A0/g, ' ')
                .replace(/[ \t]{2,}/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .trim()
            );
        };

        const extractPlainTextFromDocxOptionXmlFragment = (xml = '') => {
            const source = String(xml || '');
            const parts = [];

            source.replace(/<(?:w:t|m:t|w:instrText|w:delText)[^>]*>([\s\S]*?)<\/(?:w:t|m:t|w:instrText|w:delText)>/g, (_, textNode) => {
                const text = decodeXmlEntitiesSafe(textNode || '');
                if (text) parts.push(text);
                return '';
            });

            source.replace(/<w:tab\s*\/>/g, () => {
                parts.push(' ');
                return '';
            });

            source.replace(/<w:br\s*\/>/g, () => {
                parts.push('\n');
                return '';
            });

            source.replace(/<m:chr[^>]*m:val=["']([^"']+)["'][^>]*\/>/g, (_, ch) => {
                if (ch) parts.push(ch);
                return '';
            });

            return normalizeDocxTextSpace(parts.join(''));
        };

        const splitDocxParagraphsForOptionMap = (documentXml = '') => {
            const paragraphs = [];

            String(documentXml || '').replace(/<w:p[\s\S]*?<\/w:p>/g, (pXml) => {
                const text = extractPlainTextFromDocxOptionXmlFragment(pXml);

                if (text || /<w:object\b|<w:drawing\b|<v:imagedata\b/.test(pXml)) {
                    paragraphs.push({
                        text,
                        rawXml: pXml
                    });
                }

                return '';
            });

            return { paragraphs };
        };

        const fileBaseNameForMatch = (filename = '') => String(filename || '')
            .replace(/\.[^.]+$/, '')
            .replace(/[\\/:*?"<>|]+/g, '_')
            .trim()
            .toLowerCase();

        const getBatchFileRoles = (file) => {
            const roles = Array.isArray(file?.roles) ? file.roles.filter(Boolean) : [];
            if (roles.length) return [...new Set(roles)];
            return file?.role ? [file.role] : [];
        };

        const batchHasQuestionRole = (file) => {
            const external = root.Qisi?.FileDispatcher?.batchHasQuestionRole;
            if (typeof external === 'function') return external(file);
            const roles = getBatchFileRoles(file);
            return roles.includes('question') || roles.includes('full');
        };

        const batchIsFullRole = (file) => {
            const external = root.Qisi?.FileDispatcher?.batchIsFullRole;
            if (typeof external === 'function') return external(file);
            return getBatchFileRoles(file).includes('full');
        };

        const isVisualQuestionFile = (file) => {
            if (!file) return false;
            if (!['pdf', 'image'].includes(file.fileType)) return false;
            return batchHasQuestionRole(file) || batchIsFullRole(file);
        };

        const findUploadedVisualCompanionForDocx = (docxFile, allFiles = []) => {
            const docxBase = fileBaseNameForMatch(docxFile?.filename || '');
            const candidates = (allFiles || [])
                .filter(file => file?.id !== docxFile?.id)
                .filter(isVisualQuestionFile);

            if (!candidates.length) return null;

            const sameBase = candidates.find(file =>
                fileBaseNameForMatch(file.filename || '') === docxBase
            );

            if (sameBase) return sameBase;
            if (/^1$/i.test(docxBase) && candidates.length === 1) return candidates[0];
            if (candidates.length === 1) return candidates[0];

            return null;
        };

        const selectDocxSourceRoute = (file, allFiles = []) => {
            if (!file || file.fileType !== 'docx') {
                return {
                    producerIdentity: '',
                    routePolicyDecision: 'not-docx',
                    selectedSourcePort: '',
                    visualCompanionFileId: '',
                    allowAutomaticVision: false
                };
            }

            const roles = getBatchFileRoles(file);
            const hasQuestion = roles.includes('question') || roles.includes('full');
            const visualCompanion = hasQuestion
                ? findUploadedVisualCompanionForDocx(file, allFiles)
                : null;

            if (visualCompanion) {
                return {
                    producerIdentity: 'docx-xml-importer',
                    routePolicyDecision: 'explicit-visual-companion',
                    selectedSourcePort: 'uploaded-visual-companion',
                    visualCompanionFileId: visualCompanion.id || '',
                    allowAutomaticVision: true
                };
            }

            if (hasQuestion) {
                return {
                    producerIdentity: 'docx-xml-importer',
                    routePolicyDecision: 'deterministic-docx-primary',
                    selectedSourcePort: 'docx-importer',
                    visualCompanionFileId: '',
                    allowAutomaticVision: false
                };
            }

            return {
                producerIdentity: 'docx-text-support-parser',
                routePolicyDecision: 'deterministic-docx-support',
                selectedSourcePort: 'docx-support-text',
                visualCompanionFileId: '',
                allowAutomaticVision: false
            };
        };

        const resolveDocxSourceRoute = async (
            file,
            allFiles = [],
            options = {}
        ) => {
            const route = selectDocxSourceRoute(file, allFiles);
            const supportsVisualPageProbe = [
                'deterministic-docx-primary',
                'deterministic-docx-support'
            ].includes(route.routePolicyDecision);
            if (
                !supportsVisualPageProbe ||
                typeof options.extractQuestionSkeleton !== 'function'
            ) {
                return route;
            }

            const skeleton = await options.extractQuestionSkeleton(file);
            if (
                skeleton?.diagnostics?.reason !== 'no-explicit-question-markers' ||
                skeleton?.diagnostics?.visualPageCandidate !== true
            ) {
                return {
                    ...route,
                    questionSkeleton: skeleton || null
                };
            }

            const isSupportRoute =
                route.routePolicyDecision ===
                'deterministic-docx-support';

            return {
                producerIdentity:
                    isSupportRoute
                        ? 'docx-visual-page-support-importer'
                        : 'docx-visual-page-importer',
                routePolicyDecision:
                    isSupportRoute
                        ? 'visual-page-docx-support'
                        : 'visual-page-docx',
                selectedSourcePort: 'docx-convert-strict-vision',
                visualCompanionFileId: '',
                allowAutomaticVision: true,
                questionSkeleton: skeleton
            };
        };

        const selectDocxVisualPageSource = ({
            questionSkeleton = null,
            embeddedPageCount = 0
        } = {}) => {
            const diagnostics = questionSkeleton?.diagnostics || {};
            const visualPageCandidate =
                diagnostics.visualPageCandidate === true;
            const drawingCount =
                Math.max(0, Number(diagnostics.drawingCount || 0)) || 0;
            const pageLikeDrawingCount =
                Math.max(
                    0,
                    Number(diagnostics.pageLikeDrawingCount || 0)
                ) || 0;
            const pageCount =
                Math.max(0, Number(embeddedPageCount || 0)) || 0;

            if (!visualPageCandidate) {
                return {
                    route: 'converted-pdf',
                    pageCount: 0,
                    reason: 'not-visual-page-docx'
                };
            }

            if (
                pageCount <= 0 ||
                drawingCount <= 0 ||
                pageLikeDrawingCount !== drawingCount ||
                pageCount !== drawingCount
            ) {
                return {
                    route: 'reject',
                    pageCount,
                    reason: 'visual-page-count-mismatch',
                    expectedPageCount: drawingCount
                };
            }

            return {
                route: 'embedded-pages',
                pageCount,
                reason: 'all-drawings-are-ordered-page-images'
            };
        };

        const orderDocxMediaRefsByDocumentUsage = (
            documentXml = '',
            mediaRefs = []
        ) => {
            const refs = Array.isArray(mediaRefs)
                ? mediaRefs.filter(Boolean)
                : [];
            const byRid = new Map(
                refs
                    .filter(ref => String(ref?.rid || '').trim())
                    .map(ref => [String(ref.rid).trim(), ref])
            );
            const ordered = [];
            const referencedRids = new Set();
            const drawingBlocks =
                String(documentXml || '').match(
                    /<w:(?:drawing|pict)\b[\s\S]*?<\/w:(?:drawing|pict)>/g
                ) || [];

            for (const block of drawingBlocks) {
                const rid = String(
                    block.match(
                        /\br:(?:embed|id)=["']([^"']+)["']/
                    )?.[1] || ''
                ).trim();
                const ref = rid ? byRid.get(rid) : null;
                if (!ref) continue;
                ordered.push(ref);
                referencedRids.add(rid);
            }

            for (const ref of refs) {
                const rid = String(ref?.rid || '').trim();
                if (rid && referencedRids.has(rid)) continue;
                ordered.push(ref);
            }

            return ordered;
        };

        const foldUnnumberedVisualQuestionFragments = (items = []) => {
            const rows =
                Array.isArray(items)
                    ? items
                    : [];
            const output = [];
            const normalizePage = item =>
                Math.max(
                    0,
                    Number(
                        item?.sourcePage ??
                        item?.pageIndex ??
                        item?.sourceTrace?.sourcePage ??
                        item?.sourceTrace?.pageIndex ??
                        0
                    )
                ) || 0;
            const questionNumberOf = item => {
                const raw =
                    String(
                    item?.questionNumber ??
                    item?.question ??
                    item?.no ??
                    ''
                    ).trim();

                return /^\d{1,3}$/.test(raw)
                    ? String(Number(raw))
                    : '';
            };
            const joinUniqueText = (left, right) => {
                const first =
                    String(left || '').trim();
                const second =
                    String(right || '').trim();

                if (!first) return second;
                if (!second || first === second) return first;
                if (first.includes(second)) return first;
                if (second.includes(first)) return second;
                return `${first}\n${second}`;
            };
            const mergeOptions = (left = [], right = []) =>
                Array.from(
                    {
                        length:
                            Math.max(
                                4,
                                left.length || 0,
                                right.length || 0
                            )
                    },
                    (_, index) =>
                        joinUniqueText(
                            left[index],
                            right[index]
                        )
                );

            for (const row of rows) {
                if (!row) continue;

                const questionNumber =
                    questionNumberOf(row);

                if (questionNumber) {
                    output.push({
                        ...row
                    });
                    continue;
                }

                const anchor =
                    output[output.length - 1];
                const fragmentPage =
                    normalizePage(row);
                const anchorPage =
                    normalizePage(anchor);
                const canFold =
                    Boolean(anchor) &&
                    Boolean(
                        questionNumberOf(anchor)
                    ) &&
                    fragmentPage > 0 &&
                    anchorPage === fragmentPage;

                if (!canFold) {
                    output.push({
                        ...row
                    });
                    continue;
                }

                anchor.stem =
                    joinUniqueText(
                        anchor.stem,
                        row.stem
                    );
                anchor.rawBlock =
                    joinUniqueText(
                        anchor.rawBlock,
                        row.rawBlock
                    );
                anchor.rawText =
                    joinUniqueText(
                        anchor.rawText,
                        row.rawText
                    );
                anchor.options =
                    mergeOptions(
                        Array.isArray(anchor.options)
                            ? anchor.options
                            : [],
                        Array.isArray(row.options)
                            ? row.options
                            : []
                    );
                anchor.sourcePages =
                    [
                        ...new Set(
                            [
                                ...(anchor.sourcePages || []),
                                ...(row.sourcePages || []),
                                anchorPage,
                                fragmentPage
                            ].filter(Boolean)
                        )
                    ].sort(
                        (left, right) =>
                            left - right
                    );
                anchor.recognizedImages =
                    [
                        ...(
                            Array.isArray(
                                anchor.recognizedImages
                            )
                                ? anchor.recognizedImages
                                : []
                        ),
                        ...(
                            Array.isArray(
                                row.recognizedImages
                            )
                                ? row.recognizedImages
                                : []
                        )
                    ];
                anchor.warnings =
                    [
                        ...new Set([
                            ...(
                                Array.isArray(anchor.warnings)
                                    ? anchor.warnings
                                    : []
                            ),
                            ...(
                                Array.isArray(row.warnings)
                                    ? row.warnings
                                    : []
                            )
                        ])
                    ];
                anchor.sourceTrace = {
                    ...(anchor.sourceTrace || {}),
                    foldedVisualFragmentCount:
                        Number(
                            anchor
                                .sourceTrace
                                ?.foldedVisualFragmentCount ||
                            0
                        ) + 1
                };
            }

            return output;
        };

        const mergeVisualSupportPageResultsFailClosed = ({
            pageResults = [],
            allowedQuestionNumbers = []
        } = {}) => {
            const allowed =
                new Set(
                    (allowedQuestionNumbers || [])
                        .map(normalizeQuestionKey)
                        .filter(Boolean)
                );
            const answerByQuestion =
                new Map();
            const solutionByQuestion =
                new Map();
            const conflicts = [];
            const unknownQuestionNumbers =
                new Set();
            const joinSolution = (
                left,
                right
            ) => {
                const first =
                    String(left || '').trim();
                const second =
                    String(right || '').trim();

                if (!first) return second;
                if (!second || first === second) return first;
                if (first.includes(second)) return first;
                if (second.includes(first)) return second;
                return `${first}\n${second}`;
            };
            const mergeSourcePages = (
                current,
                item,
                pageNo
            ) =>
                [
                    ...new Set(
                        [
                            ...(current?.sourcePages || []),
                            ...(item?.sourcePages || []),
                            current?.sourcePage,
                            item?.sourcePage,
                            pageNo
                        ]
                            .map(page =>
                                Math.max(
                                    0,
                                    Number(page || 0)
                                ) || 0
                            )
                            .filter(Boolean)
                    )
                ].sort(
                    (left, right) =>
                        left - right
                );

            for (
                const pageResult of pageResults || []
            ) {
                const pageNo =
                    Math.max(
                        0,
                        Number(pageResult?.pageNo || 0)
                    ) || 0;

                for (
                    const item of pageResult?.answers || []
                ) {
                    const questionNumber =
                        normalizeQuestionKey(
                            item?.question ??
                            item?.questionNumber
                        );
                    const answer =
                        String(item?.answer || '')
                            .trim();

                    if (
                        !questionNumber ||
                        (
                            allowed.size > 0 &&
                            !allowed.has(
                                questionNumber
                            )
                        )
                    ) {
                        if (questionNumber) {
                            unknownQuestionNumbers
                                .add(questionNumber);
                        }
                        continue;
                    }

                    if (!answer) continue;

                    const existing =
                        answerByQuestion.get(
                            questionNumber
                        );

                    if (
                        existing &&
                        String(existing.answer || '')
                            .replace(/\s+/g, '') !==
                        answer.replace(/\s+/g, '')
                    ) {
                        conflicts.push({
                            questionNumber,
                            kind: 'answer',
                            left:
                                existing.answer,
                            right:
                                answer,
                            sourcePages:
                                mergeSourcePages(
                                    existing,
                                    item,
                                    pageNo
                                )
                        });
                        continue;
                    }

                    answerByQuestion.set(
                        questionNumber,
                        {
                            ...(existing || {}),
                            ...item,
                            question:
                                questionNumber,
                            sourcePage:
                                existing?.sourcePage ||
                                item?.sourcePage ||
                                pageNo,
                            sourcePages:
                                mergeSourcePages(
                                    existing,
                                    item,
                                    pageNo
                                )
                        }
                    );
                }

                for (
                    const item of pageResult?.solutions || []
                ) {
                    const questionNumber =
                        normalizeQuestionKey(
                            item?.question ??
                            item?.questionNumber
                        );
                    const solution =
                        String(item?.solution || '')
                            .trim();

                    if (
                        !questionNumber ||
                        (
                            allowed.size > 0 &&
                            !allowed.has(
                                questionNumber
                            )
                        )
                    ) {
                        if (questionNumber) {
                            unknownQuestionNumbers
                                .add(questionNumber);
                        }
                        continue;
                    }

                    if (!solution) continue;

                    const existing =
                        solutionByQuestion.get(
                            questionNumber
                        );

                    solutionByQuestion.set(
                        questionNumber,
                        {
                            ...(existing || {}),
                            ...item,
                            question:
                                questionNumber,
                            solution:
                                joinSolution(
                                    existing?.solution,
                                    solution
                                ),
                            sourcePage:
                                existing?.sourcePage ||
                                item?.sourcePage ||
                                pageNo,
                            sourcePages:
                                mergeSourcePages(
                                    existing,
                                    item,
                                    pageNo
                                )
                        }
                    );
                }
            }

            const unknown =
                [...unknownQuestionNumbers]
                    .sort(
                        (left, right) =>
                            Number(left) -
                            Number(right)
                    );

            return {
                authoritative:
                    conflicts.length === 0 &&
                    unknown.length === 0,
                answers:
                    [...answerByQuestion.values()],
                solutions:
                    [...solutionByQuestion.values()],
                diagnostics: {
                    conflicts,
                    unknownQuestionNumbers:
                        unknown
                }
            };
        };

        const buildVisualSupportCoverage = ({
            merged = {},
            expectedQuestionNumbers = [],
            requiredKinds = {}
        } = {}) => {
            const expected =
                [
                    ...new Set(
                        (expectedQuestionNumbers || [])
                            .map(normalizeQuestionKey)
                            .filter(Boolean)
                    )
                ];
            const answerNumbers =
                new Set(
                    (merged.answers || [])
                        .map(item =>
                            normalizeQuestionKey(
                                item?.question ??
                                item?.questionNumber
                            )
                        )
                        .filter(Boolean)
                );
            const solutionNumbers =
                new Set(
                    (merged.solutions || [])
                        .map(item =>
                            normalizeQuestionKey(
                                item?.question ??
                                item?.questionNumber
                            )
                        )
                        .filter(Boolean)
                );
            const missingAnswers =
                requiredKinds.answers === true
                    ? expected.filter(
                        questionNumber =>
                            !answerNumbers.has(
                                questionNumber
                            )
                    )
                    : [];
            const unresolvedMissingAnswers =
                missingAnswers.filter(
                    questionNumber =>
                        !solutionNumbers.has(
                            questionNumber
                        )
                );
            const acceptedMissingAnswersWithSolution =
                missingAnswers.filter(
                    questionNumber =>
                        solutionNumbers.has(
                            questionNumber
                        )
                );
            const missingSolutions =
                requiredKinds.solutions === true
                    ? expected.filter(
                        questionNumber =>
                            !solutionNumbers.has(
                                questionNumber
                            )
                    )
                    : [];
            const missingBlocks =
                expected.filter(
                    questionNumber =>
                        !answerNumbers.has(
                            questionNumber
                        ) &&
                        !solutionNumbers.has(
                            questionNumber
                        )
                );

            return {
                ok:
                    unresolvedMissingAnswers.length === 0 &&
                    missingSolutions.length === 0 &&
                    missingBlocks.length === 0 &&
                    merged.authoritative === true,
                expectedQuestionNumbers:
                    expected,
                expectedAnswers:
                    requiredKinds.answers === true
                        ? expected
                        : [],
                expectedSolutions:
                    requiredKinds.solutions === true
                        ? expected
                        : [],
                missingBlocks,
                missingAnswers,
                unresolvedMissingAnswers,
                acceptedMissingAnswersWithSolution,
                missingSolutions,
                unknownBlocks:
                    merged.diagnostics
                        ?.unknownQuestionNumbers ||
                    [],
                duplicateQuestionNumbers: [],
                conflicts:
                    merged.diagnostics
                        ?.conflicts ||
                    []
            };
        };

        const summarizeVisualSupportPageResults = (
            pageResults = []
        ) =>
            (pageResults || []).map(
                pageResult => ({
                    pageNo:
                        Math.max(
                            0,
                            Number(
                                pageResult?.pageNo ||
                                0
                            )
                        ) || 0,
                    answerQuestions:
                        (
                            pageResult?.answers ||
                            []
                        )
                            .map(item =>
                                normalizeQuestionKey(
                                    item?.question ??
                                    item?.questionNumber
                                )
                            )
                            .filter(Boolean),
                    solutionQuestions:
                        (
                            pageResult?.solutions ||
                            []
                        )
                            .map(item =>
                                normalizeQuestionKey(
                                    item?.question ??
                                    item?.questionNumber
                                )
                            )
                            .filter(Boolean)
                })
            );

        const partitionVisualSupportPages = ({
            pages = [],
            allowedQuestionNumbers = [],
            maxQuestionsPerChunk = 4,
            maxCharactersPerChunk = 6500
        } = {}) => {
            const allowed =
                new Set(
                    (allowedQuestionNumbers || [])
                        .map(normalizeQuestionKey)
                        .filter(Boolean)
                );
            const normalizedPages =
                (pages || [])
                    .map((page, index) => ({
                        ...page,
                        pageNo:
                            Math.max(
                                1,
                                Number(
                                    page?.pageNo ||
                                    index + 1
                                )
                            ),
                        rawText:
                            String(
                                page?.rawText || ''
                            )
                    }))
                    .sort(
                        (left, right) =>
                            left.pageNo -
                            right.pageNo
                    );
            const chunks = [];
            let previousExplicitQuestion =
                '';
            const markerPattern =
                /(^|\n)[ \t]*(?:第[ \t]*)?([1-9]\d{0,2})[ \t]*[.．、][ \t]*(?=\S)/g;
            const normalizeLimit = (
                value,
                fallback
            ) =>
                Math.max(
                    1,
                    Number(value || fallback)
                );
            const questionLimit =
                normalizeLimit(
                    maxQuestionsPerChunk,
                    4
                );
            const characterLimit =
                normalizeLimit(
                    maxCharactersPerChunk,
                    6500
                );

            for (
                const page of normalizedPages
            ) {
                const markers = [];
                let match;

                markerPattern.lastIndex = 0;

                while (
                    (
                        match =
                            markerPattern.exec(
                                page.rawText
                            )
                    )
                ) {
                    const questionNumber =
                        normalizeQuestionKey(
                            match[2]
                        );

                    if (
                        !questionNumber ||
                        (
                            allowed.size > 0 &&
                            !allowed.has(
                                questionNumber
                            )
                        )
                    ) {
                        continue;
                    }

                    markers.push({
                        questionNumber,
                        index:
                            match.index +
                            String(
                                match[1] || ''
                            ).length
                    });
                }

                const firstAllowedNumber =
                    [...allowed]
                        .map(Number)
                        .filter(
                            Number.isFinite
                        )
                        .sort(
                            (left, right) =>
                                left - right
                        )[0] || 1;
                let markerCursor =
                    Number(
                        previousExplicitQuestion
                    ) ||
                    firstAllowedNumber - 1;
                let markerGapDetected =
                    false;
                const deduplicatedMarkers =
                    [];

                for (
                    const marker of markers
                ) {
                    const markerNumber =
                        Number(
                            marker.questionNumber
                        );

                    if (
                        !Number.isFinite(
                            markerNumber
                        ) ||
                        markerNumber <=
                            markerCursor
                    ) {
                        continue;
                    }

                    if (
                        markerNumber !==
                        markerCursor + 1
                    ) {
                        markerGapDetected =
                            true;
                        break;
                    }

                    deduplicatedMarkers
                        .push(marker);

                    markerCursor =
                        markerNumber;
                }

                if (
                    deduplicatedMarkers.length ===
                        0 ||
                    markerGapDetected
                ) {
                    chunks.push({
                        pageNo:
                            page.pageNo,
                        rawText:
                            page.rawText,
                        questionNumbers: [],
                        continuationQuestionNumber:
                            previousExplicitQuestion,
                        sourcePageImage:
                            page.imageUrl ||
                            page.sourcePageImage ||
                            '',
                        recognitionSource:
                            'image',
                        diagnostics: {
                            reason:
                                markerGapDetected
                                    ? 'question-marker-gap'
                                    : 'question-markers-missing',
                            observedQuestionNumbers:
                                markers.map(
                                    marker =>
                                        marker
                                            .questionNumber
                                ),
                            previousExplicitQuestion
                        }
                    });
                    continue;
                }

                const segments = [];
                const firstMarker =
                    deduplicatedMarkers[0];
                const prefix =
                    page.rawText
                        .slice(
                            0,
                            firstMarker.index
                        )
                        .trim();
                const firstQuestionNumber =
                    Number(
                        firstMarker.questionNumber
                    );
                const previousQuestionNumber =
                    Number(
                        previousExplicitQuestion
                    );
                const hasContinuationPrefix =
                    Boolean(
                        prefix &&
                        prefix.length >= 24 &&
                        previousExplicitQuestion &&
                        Number.isFinite(
                            firstQuestionNumber
                        ) &&
                        Number.isFinite(
                            previousQuestionNumber
                        ) &&
                        firstQuestionNumber >
                            previousQuestionNumber
                    );

                if (hasContinuationPrefix) {
                    segments.push({
                        questionNumber:
                            previousExplicitQuestion,
                        rawText:
                            prefix,
                        isContinuation:
                            true
                    });
                }

                for (
                    let index = 0;
                    index <
                        deduplicatedMarkers
                            .length;
                    index += 1
                ) {
                    const marker =
                        deduplicatedMarkers[
                            index
                        ];
                    const nextMarker =
                        deduplicatedMarkers[
                            index + 1
                        ];

                    segments.push({
                        questionNumber:
                            marker.questionNumber,
                        rawText:
                            page.rawText
                                .slice(
                                    marker.index,
                                    nextMarker
                                        ?.index ??
                                        page.rawText
                                            .length
                                )
                                .trim(),
                        isContinuation:
                            false
                    });
                }

                let current = null;

                const flushCurrent =
                    () => {
                        if (
                            !current ||
                            !current.rawText.trim()
                        ) {
                            current = null;
                            return;
                        }

                        chunks.push({
                            ...current,
                            questionNumbers: [
                                ...new Set(
                                    current
                                        .questionNumbers
                                )
                            ]
                        });

                        current = null;
                    };

                for (
                    const segment of segments
                ) {
                    const nextQuestionNumbers =
                        [
                            ...new Set([
                                ...(
                                    current
                                        ?.questionNumbers ||
                                    []
                                ),
                                segment
                                    .questionNumber
                            ])
                        ];
                    const nextRawText =
                        [
                            current?.rawText ||
                                '',
                            segment.rawText
                        ]
                            .filter(Boolean)
                            .join('\n');
                    const exceedsLimit =
                        Boolean(current) &&
                        (
                            nextQuestionNumbers
                                .length >
                                questionLimit ||
                            nextRawText.length >
                                characterLimit
                        );

                    if (exceedsLimit) {
                        flushCurrent();
                    }

                    if (!current) {
                        current = {
                            pageNo:
                                page.pageNo,
                            rawText:
                                segment.rawText,
                            questionNumbers: [
                                segment
                                    .questionNumber
                            ],
                            continuationQuestionNumber:
                                segment
                                    .isContinuation
                                    ? segment
                                        .questionNumber
                                    : '',
                            sourcePageImage:
                                page.imageUrl ||
                                page.sourcePageImage ||
                                '',
                            recognitionSource:
                                'text'
                        };
                    } else {
                        current.rawText =
                            [
                                current.rawText,
                                segment.rawText
                            ]
                                .filter(Boolean)
                                .join('\n');
                        current.questionNumbers =
                            nextQuestionNumbers;

                        if (
                            segment
                                .isContinuation
                        ) {
                            current
                                .continuationQuestionNumber =
                                segment
                                    .questionNumber;
                        }
                    }
                }

                flushCurrent();

                previousExplicitQuestion =
                    deduplicatedMarkers[
                        deduplicatedMarkers
                            .length - 1
                    ]
                        .questionNumber;
            }

            return chunks;
        };

        const validateVisualSupportPageIndex = ({
            observedQuestionNumbers = [],
            allowedQuestionNumbers = [],
            lastSeenQuestionNumber = 0,
            continuesPrevious = false
        } = {}) => {
            const allowed =
                new Set(
                    (allowedQuestionNumbers || [])
                        .map(normalizeQuestionKey)
                        .filter(Boolean)
                );
            const observed =
                [
                    ...new Set(
                        (
                            observedQuestionNumbers ||
                            []
                        )
                            .map(
                                normalizeQuestionKey
                            )
                            .filter(Boolean)
                        )
                ];
            const lastSeen =
                Math.max(
                    0,
                    Number(
                        lastSeenQuestionNumber ||
                        0
                    )
                ) || 0;
            const sequenceObserved =
                (
                    continuesPrevious &&
                    lastSeen > 0 &&
                    Number(
                        observed[0]
                    ) === lastSeen
                )
                    ? observed.slice(1)
                    : observed;
            const reasons = [];

            if (
                observed.some(
                    questionNumber =>
                        allowed.size > 0 &&
                        !allowed.has(
                            questionNumber
                        )
                )
            ) {
                reasons.push(
                    'unknown-question-number'
                );
            }

            const numericObserved =
                sequenceObserved
                    .map(Number);

            if (
                numericObserved.some(
                    (
                        questionNumber,
                        index
                    ) =>
                        !Number.isFinite(
                            questionNumber
                        ) ||
                        (
                            index > 0 &&
                            questionNumber !==
                                numericObserved[
                                    index - 1
                                ] + 1
                        )
                )
            ) {
                reasons.push(
                    'non-contiguous-page-sequence'
                );
            }

            const firstExpected =
                lastSeen > 0
                    ? lastSeen + 1
                    : Math.min(
                        ...(
                            [...allowed]
                                .map(Number)
                                .filter(
                                    Number
                                        .isFinite
                                )
                        )
                    );

            if (
                sequenceObserved.length >
                    0 &&
                Number.isFinite(
                    firstExpected
                ) &&
                Number(
                    sequenceObserved[0]
                ) !==
                    firstExpected
            ) {
                reasons.push(
                    'page-sequence-does-not-follow-contract'
                );
            }

            if (
                sequenceObserved.length ===
                    0 &&
                !(
                    continuesPrevious &&
                    lastSeen > 0
                )
            ) {
                reasons.push(
                    'page-index-empty'
                );
            }

            const targetQuestionNumbers =
                [
                    ...new Set([
                        ...(
                            continuesPrevious &&
                            lastSeen > 0
                                ? [
                                    String(
                                        lastSeen
                                    )
                                ]
                                : []
                        ),
                        ...sequenceObserved
                    ])
                ];

            return {
                authoritative:
                    reasons.length === 0,
                questionNumbers:
                    sequenceObserved,
                targetQuestionNumbers,
                continuesPrevious:
                    continuesPrevious ===
                        true,
                diagnostics: {
                    reasons,
                    lastSeenQuestionNumber:
                        lastSeen,
                    allowedQuestionNumbers: [
                        ...allowed
                    ]
                }
            };
        };

        const buildVisualSupportIndexRetryPlan = ({
            validation = {},
            allowedQuestionNumbers = [],
            lastSeenQuestionNumber = 0,
            previousAttemptNumbers = []
        } = {}) => {
            const allowed =
                [
                    ...new Set(
                        (allowedQuestionNumbers || [])
                            .map(normalizeQuestionKey)
                            .filter(Boolean)
                    )
                ];
            const lastSeen =
                Math.max(
                    0,
                    Number(
                        lastSeenQuestionNumber ||
                        0
                    )
                ) || 0;
            const requiredFirstQuestionNumber =
                String(
                    lastSeen > 0
                        ? lastSeen + 1
                        : Math.min(
                            ...allowed
                                .map(Number)
                                .filter(
                                    Number.isFinite
                                )
                        )
                );
            const reasons =
                new Set(
                    validation
                        ?.diagnostics
                        ?.reasons ||
                    []
                );
            const retryableReasons =
                new Set([
                    'page-sequence-does-not-follow-contract',
                    'non-contiguous-page-sequence',
                    'page-index-empty'
                ]);
            const hasRetryableReason =
                [...reasons].some(
                    reason =>
                        retryableReasons.has(
                            reason
                        )
                );
            const requiredFirstIsAllowed =
                requiredFirstQuestionNumber &&
                requiredFirstQuestionNumber !==
                    'Infinity' &&
                allowed.includes(
                    requiredFirstQuestionNumber
                );

            return {
                shouldRetry:
                    validation.authoritative !== true &&
                    lastSeen > 0 &&
                    requiredFirstIsAllowed &&
                    hasRetryableReason &&
                    !reasons.has(
                        'unknown-question-number'
                    ),
                requiredFirstQuestionNumber:
                    requiredFirstIsAllowed
                        ? requiredFirstQuestionNumber
                        : '',
                previousAttemptNumbers:
                    [
                        ...new Set(
                            (previousAttemptNumbers || [])
                                .map(normalizeQuestionKey)
                                .filter(Boolean)
                        )
                    ],
                allowedQuestionNumbers:
                    allowed,
                reasons:
                    [...reasons]
            };
        };

        const buildValidatedVisualQuestionContract = ({
            items = [],
            expectedQuestionCount = 0,
            expectedSourcePageCount = 0,
            check = null
        } = {}) => {
            const expected =
                Math.max(
                    0,
                    Number(expectedQuestionCount || 0)
                ) || 0;
            const expectedPages =
                Math.max(
                    0,
                    Number(expectedSourcePageCount || 0)
                ) || 0;
            const rows =
                Array.isArray(items)
                    ? items
                    : [];
            const questionNumbers =
                rows.map(item => {
                    const raw = String(
                        item?.questionNumber ??
                        item?.question ??
                        item?.no ??
                        ''
                    ).trim();
                    return /^\d{1,3}$/.test(raw)
                        ? String(Number(raw))
                        : '';
                });
            const numericNumbers =
                questionNumbers.map(Number);
            const sourcePageSets =
                rows.map(item => {
                    const pages =
                        [
                            ...(
                                Array.isArray(item?.sourcePages)
                                    ? item.sourcePages
                                    : []
                            ),
                            item?.sourcePage,
                            item?.pageIndex,
                            item?.sourceTrace?.sourcePage,
                            item?.sourceTrace?.pageIndex
                        ]
                            .map(page =>
                                Math.max(
                                    0,
                                    Number(page || 0)
                                ) || 0
                            )
                            .filter(page => page > 0);

                    return [
                        ...new Set(pages)
                    ].sort(
                        (left, right) =>
                            left - right
                    );
                });
            const sourcePages =
                sourcePageSets.map(
                    pages =>
                        pages[0] || 0
                );
            const inferredExpected =
                expected ||
                rows.length;
            const exactSequence =
                inferredExpected > 0 &&
                rows.length === inferredExpected &&
                questionNumbers.every(Boolean) &&
                numericNumbers.every(
                    (value, index) =>
                        value === index + 1
                );
            const observedPages =
                [
                    ...new Set(
                        sourcePages.filter(
                            page => page > 0
                        )
                            .concat(
                                sourcePageSets.flat()
                            )
                    )
                ];
            const completePageCoverage =
                expectedPages > 0 &&
                observedPages.length === expectedPages &&
                observedPages.every(
                    (page, index) =>
                        page === index + 1
                );
            const sourcePagesProven =
                sourcePages.every(
                    page => page > 0
                ) &&
                sourcePages.every(
                    (page, index) =>
                        index === 0 ||
                        page >=
                            sourcePages[index - 1]
                );
            const qualityPassed =
                check &&
                check.fatal === false;
            const authoritative =
                exactSequence &&
                sourcePagesProven &&
                completePageCoverage &&
                qualityPassed;

            let reason =
                'ok';

            if (!exactSequence) {
                reason =
                    'question-sequence-invalid';
            } else if (!sourcePagesProven) {
                reason =
                    'source-page-order-invalid';
            } else if (!completePageCoverage) {
                reason =
                    'source-page-coverage-incomplete';
            } else if (!qualityPassed) {
                reason =
                    'quality-check-not-passed';
            }

            return {
                authoritative,
                evidence:
                    authoritative
                        ? (
                            expected
                                ? 'strict-visual-explicit-count-and-page-coverage'
                                : 'strict-visual-contiguous-sequence-and-page-coverage'
                        )
                        : '',
                questionNumbers:
                    authoritative
                        ? questionNumbers
                        : [],
                diagnostics: {
                    reason,
                    expectedQuestionCount:
                        expected,
                    inferredQuestionCount:
                        inferredExpected,
                    expectedSourcePageCount:
                        expectedPages,
                    actualQuestionCount:
                        rows.length,
                    observedQuestionNumbers:
                        questionNumbers,
                    sourcePages,
                    sourcePageSets,
                    observedPages,
                    exactSequence,
                    sourcePagesProven,
                    completePageCoverage,
                    qualityPassed
                }
            };
        };

        const partitionDocxSupportByQuestionContract = (items = [], allowedQuestionNumbers = []) => {
            const allowed = new Set(
                (allowedQuestionNumbers || [])
                    .map(normalizeQuestionKey)
                    .filter(Boolean)
            );
            const accepted = [];
            const unmatched = [];
            const unknownNumberItems = [];

            for (const item of items || []) {
                const questionNumber = normalizeQuestionKey(
                    item?.questionNumber || item?.question || item?.order || ''
                );

                if (!questionNumber) {
                    unknownNumberItems.push(item);
                } else if (allowed.has(questionNumber)) {
                    accepted.push(item);
                } else {
                    unmatched.push(item);
                }
            }

            return { accepted, unmatched, unknownNumberItems };
        };

        const repairDocxSupportQuestionMarkerArtifacts = (text = '', allowedQuestionNumbers = []) => {
            const allowed = [...new Set(
                (allowedQuestionNumbers || [])
                    .map(normalizeQuestionKey)
                    .filter(Boolean)
            )].sort((left, right) => right.length - left.length);
            const repairs = [];

            const repairedText = String(text || '').replace(
                /(^|\n)(\d{4,})(?=\s*【(?:答案|答)】)/g,
                (match, lineStart, rawMarker) => {
                    const questionNumber = allowed.find(number =>
                        rawMarker.endsWith(number) &&
                        rawMarker.length - number.length >= 3
                    );
                    if (!questionNumber) return match;

                    repairs.push({ rawMarker, questionNumber });
                    return `${lineStart}${questionNumber}`;
                }
            );

            return { text: repairedText, repairs };
        };

        const isEscapedLatexDelimiterAt = (source = '', index = 0) => {
            const text = String(source || '');
            let slashCount = 0;

            for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
                slashCount += 1;
            }

            return slashCount % 2 === 1;
        };

        const findLatexClosingDelimiter = (source = '', token = '', startIndex = 0) => {
            const text = String(source || '');

            for (let index = startIndex; index <= text.length - token.length; index += 1) {
                if (!text.startsWith(token, index) || isEscapedLatexDelimiterAt(text, index)) {
                    continue;
                }

                if (token === '$' && (text.startsWith('$$', index) || text[index - 1] === '$')) {
                    continue;
                }

                return index;
            }

            return -1;
        };

        const tokenizeLatexSource = (source = '') => {
            const text = String(source || '').replace(/\r\n?/g, '\n');
            const segments = [];
            let cursor = 0;
            let plainStart = 0;

            const pushPlain = (endIndex) => {
                if (endIndex <= plainStart) return;
                segments.push({
                    type: 'text',
                    raw: text.slice(plainStart, endIndex)
                });
            };

            while (cursor < text.length) {
                let openToken = '';
                let closeToken = '';

                if (text.startsWith('$$', cursor) && !isEscapedLatexDelimiterAt(text, cursor)) {
                    openToken = '$$';
                    closeToken = '$$';
                } else if (text.startsWith('\\[', cursor)) {
                    openToken = '\\[';
                    closeToken = '\\]';
                } else if (text.startsWith('\\(', cursor)) {
                    openToken = '\\(';
                    closeToken = '\\)';
                } else if (text[cursor] === '$' && !isEscapedLatexDelimiterAt(text, cursor) && !text.startsWith('$$', cursor)) {
                    openToken = '$';
                    closeToken = '$';
                } else {
                    cursor += 1;
                    continue;
                }

                const expressionStart = cursor + openToken.length;
                const closeIndex = findLatexClosingDelimiter(text, closeToken, expressionStart);
                if (closeIndex < 0) {
                    cursor += openToken.length;
                    continue;
                }

                pushPlain(cursor);
                const rawEnd = closeIndex + closeToken.length;
                segments.push({
                    type: 'math',
                    raw: text.slice(cursor, rawEnd)
                });
                cursor = rawEnd;
                plainStart = rawEnd;
            }

            pushPlain(text.length);
            return { source: text, segments };
        };

        const cleanDocxImporterTextForV2 = (text = '') => {
            const raw = cleanRecognizedText(text || '');
            if (!raw) return '';

            const { protectedText, tokens } = protectBatchMediaTokens(raw);

            const cleaned = protectedText
                .replace(/\[公式图片待识别\]|\[公式图片识别\]|\[公?式图片\s*待识别\]/g, '')
                .replace(/[ \t]{2,}/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .replace(/\s+([，。；：,.、])/g, '$1')
                .trim();

            return restoreBatchMediaTokens(cleaned, tokens).trim();
        };

        const DOCX_FORMULA_PLACEHOLDER_RE = /\[(?:公式图片(?:选项)?待转换|图片选项待转换)[^\]]*\]/g;

        const dedupeStringArrayForV2 = (arr = []) => {
            return [...new Set((arr || []).filter(Boolean).map(item => String(item)))];
        };

        const hasDocxFormulaPlaceholderForV2 = (text = '') => {
            DOCX_FORMULA_PLACEHOLDER_RE.lastIndex = 0;
            return DOCX_FORMULA_PLACEHOLDER_RE.test(String(text || ''));
        };

        const countDocxFormulaPlaceholdersForV2 = (text = '') => {
            const matches = String(text || '').match(DOCX_FORMULA_PLACEHOLDER_RE);
            return matches ? matches.length : 0;
        };

        const countLatexSignalsForV2 = (text = '') => {
            const source = String(text || '');
            const matches = source.match(/\\frac|\\sqrt|\\sin|\\cos|\\tan|\\log|\\ln|\\angle|\\triangle|\\vec|\\overrightarrow|\\overline|\\overset|\\subset|\\subseteq|\\in|\\cap|\\cup|\\pi|\\theta/g);
            const mathCount = tokenizeLatexSource(source).segments.filter(segment => segment.type === 'math').length;
            return (matches ? matches.length : 0) + mathCount;
        };

        const extractBatchImageTokensForV2 = (text = '') => {
            const matches = String(text || '').match(/\[\[(?:IMAGE|FORMULA_IMAGE):[^\]]+\]\]/g);
            return matches ? dedupeStringArrayForV2(matches) : [];
        };

        const hasBatchImageTokenForV2 = (text = '') => {
            return extractBatchImageTokensForV2(text).length > 0;
        };

        const appendMissingImageTokensForV2 = (baseText = '', tokenSourceText = '') => {
            let output = String(baseText || '').trim();
            const existing = new Set(extractBatchImageTokensForV2(output));
            const sourceTokens = extractBatchImageTokensForV2(tokenSourceText);

            for (const token of sourceTokens) {
                if (!existing.has(token)) {
                    output = `${output}\n${token}`.trim();
                }
            }

            return output;
        };

        const docxVisualTextIsBetterForV2 = (xmlText = '', visualText = '') => {
            const xml = cleanDocxImporterTextForV2(xmlText || '');
            const visual = cleanDocxImporterTextForV2(visualText || '');

            if (!visual) return false;

            const xmlPlaceholderCount = countDocxFormulaPlaceholdersForV2(xml);
            const visualPlaceholderCount = countDocxFormulaPlaceholdersForV2(visual);

            const xmlLatexSignals = countLatexSignalsForV2(xml);
            const visualLatexSignals = countLatexSignalsForV2(visual);

            if (xmlPlaceholderCount > 0 && visualPlaceholderCount === 0 && visual.length >= 2) {
                return true;
            }

            if (
                visualLatexSignals >= xmlLatexSignals + 2 &&
                visualPlaceholderCount <= xmlPlaceholderCount
            ) {
                return true;
            }

            return false;
        };

        const mergeDocxVisualOptionsForV2 = (xmlOptions = [], visualOptions = []) => {
            const xml = Array.isArray(xmlOptions) ? xmlOptions : ['', '', '', ''];
            const visual = Array.isArray(visualOptions) ? visualOptions : ['', '', '', ''];

            return [0, 1, 2, 3].map(idx => {
                const xmlOpt = cleanDocxImporterTextForV2(xml[idx] || '');
                const visualOpt = cleanDocxImporterTextForV2(visual[idx] || '');

                if (hasBatchImageTokenForV2(xmlOpt) && !hasDocxFormulaPlaceholderForV2(xmlOpt)) {
                    return xmlOpt;
                }

                if (
                    hasDocxFormulaPlaceholderForV2(xmlOpt) &&
                    visualOpt &&
                    !hasDocxFormulaPlaceholderForV2(visualOpt)
                ) {
                    return appendMissingImageTokensForV2(visualOpt, xmlOpt);
                }

                if (docxVisualTextIsBetterForV2(xmlOpt, visualOpt)) {
                    return appendMissingImageTokensForV2(visualOpt, xmlOpt);
                }

                return xmlOpt;
            });
        };

        const mergeDocxVisualSupplementByQuestionContract = (
            deterministicItems = [],
            visualItems = [],
            allowedQuestionNumbers = []
        ) => {
            const normalizeQuestionNumber = value => {
                const text = String(value ?? '')
                    .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248));
                const match = text.match(/\d{1,3}/);
                return match ? String(Number(match[0])) : '';
            };
            const allowed = new Set(
                (allowedQuestionNumbers || [])
                    .map(normalizeQuestionNumber)
                    .filter(Boolean)
            );
            const visualMap = new Map();
            const unmatchedVisual = [];

            for (const item of visualItems || []) {
                const questionNumber = normalizeQuestionNumber(
                    item?.questionNumber ?? item?.question ?? item?.order
                );
                if (!questionNumber || (allowed.size && !allowed.has(questionNumber))) {
                    unmatchedVisual.push(item);
                    continue;
                }
                if (!visualMap.has(questionNumber)) visualMap.set(questionNumber, item);
            }

            const mergedQuestionNumbers = [];
            const items = (deterministicItems || []).map(item => {
                const questionNumber = normalizeQuestionNumber(
                    item?.questionNumber ?? item?.question ?? item?.order
                );
                const visual = questionNumber ? visualMap.get(questionNumber) : null;
                if (!visual) return item;

                const next = { ...item };
                let changed = false;
                if (docxVisualTextIsBetterForV2(next.stem || '', visual.stem || '')) {
                    next.stem = appendMissingImageTokensForV2(visual.stem || '', next.stem || '');
                    changed = true;
                }

                const beforeOptions = Array.isArray(next.options) ? next.options : ['', '', '', ''];
                const afterOptions = mergeDocxVisualOptionsForV2(beforeOptions, visual.options || []);
                if (afterOptions.some((option, index) => String(option || '') !== String(beforeOptions[index] || ''))) {
                    next.options = afterOptions;
                    changed = true;
                }

                if (!changed) return item;

                mergedQuestionNumbers.push(questionNumber);
                next.sourceTrace = {
                    ...(item.sourceTrace || {}),
                    visualSupplement: 'docx-pdf-strict-vision',
                    visualQuestionNumber: questionNumber
                };
                next.warnings = [
                    ...new Set([
                        ...(Array.isArray(item.warnings) ? item.warnings : []),
                        'DOCX 确定性主链已使用视觉结果补充无法直接解析的公式图片证据。'
                    ])
                ];
                return next;
            });

            return { items, unmatchedVisual, mergedQuestionNumbers };
        };

        const finalizeDocxVisualSupplementForReview = (items = []) => {
            const unresolved = [];
            const placeholderPattern = () => new RegExp(DOCX_FORMULA_PLACEHOLDER_RE.source, 'g');
            const countPlaceholders = value => {
                const matches = String(value || '').match(placeholderPattern());
                return matches ? matches.length : 0;
            };
            const removePlaceholders = value => String(value || '')
                .replace(placeholderPattern(), '')
                .replace(/[ \t]{2,}/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

            const output = (items || []).map(item => {
                if (!item) return item;

                const fields = [];
                let placeholderCount = 0;
                const record = (field, value) => {
                    const count = countPlaceholders(value);
                    if (count) {
                        fields.push(field);
                        placeholderCount += count;
                    }
                    return count;
                };

                record('stem', item.stem);
                (Array.isArray(item.options) ? item.options : []).forEach((option, index) => {
                    record(`options.${index}`, option);
                });
                record('answer', item.answer);
                record('solution', item.solution);

                if (!placeholderCount) return item;

                const questionNumber = String(
                    item.questionNumber ?? item.question ?? item.order ?? ''
                ).trim();
                unresolved.push({ questionNumber, fields, placeholderCount });

                return {
                    ...item,
                    stem: removePlaceholders(item.stem),
                    options: Array.isArray(item.options)
                        ? item.options.map(removePlaceholders)
                        : item.options,
                    answer: removePlaceholders(item.answer),
                    solution: removePlaceholders(item.solution),
                    manualReviewRequired: true,
                    warnings: [
                        ...new Set([
                            ...(Array.isArray(item.warnings) ? item.warnings : []),
                            '本题仍有公式图片证据未能自动补全，已移除占位文本；请对照原始 Word 页面人工补充后再确认。'
                        ])
                    ],
                    sourceTrace: {
                        ...(item.sourceTrace || {}),
                        visualSupplement: 'partial-manual-review',
                        unresolvedFormulaFields: fields,
                        unresolvedFormulaPlaceholderCount: placeholderCount
                    }
                };
            });

            return { items: output, unresolved };
        };

        const partitionDocxMissingAnswersForReview = ({
            missingAnswerNumbers = [],
            questionItems = [],
            solutionNumbers = []
        } = {}) => {
            const questions = new Map(
                (questionItems || []).map(item => [
                    normalizeQuestionKey(
                        item?.questionNumber ?? item?.question ?? item?.order
                    ),
                    item
                ])
            );
            const solutions = new Set(
                (solutionNumbers || []).map(normalizeQuestionKey).filter(Boolean)
            );
            const subjectiveTypes = new Set(['解答题', '证明题', '计算题', '简答题']);
            const reviewOnly = [];
            const fatal = [];

            for (const value of missingAnswerNumbers || []) {
                const questionNumber = normalizeQuestionKey(value);
                const item = questions.get(questionNumber);
                const type = cleanRecognizedText(item?.type || '');

                if (
                    questionNumber &&
                    subjectiveTypes.has(type) &&
                    solutions.has(questionNumber)
                ) {
                    reviewOnly.push(questionNumber);
                } else if (questionNumber) {
                    fatal.push(questionNumber);
                }
            }

            return { fatal, reviewOnly };
        };

        return {
            normalizeDocxPipelineResult,
            extractDocxQuestionBlockByNumber,
            extractDocxTableTextFallback,
            parseDocxRelationshipMap,
            mimeFromDocxMediaPath,
            debugDocxXmlStructure,
            decodeXmlEntitiesSafe,
            stripXmlTagsForDocxText,
            extractPlainTextFromDocxOptionXmlFragment,
            splitDocxParagraphsForOptionMap,
            findUploadedVisualCompanionForDocx,
            selectDocxSourceRoute,
            resolveDocxSourceRoute,
            selectDocxVisualPageSource,
            orderDocxMediaRefsByDocumentUsage,
            foldUnnumberedVisualQuestionFragments,
            mergeVisualSupportPageResultsFailClosed,
            buildVisualSupportCoverage,
            summarizeVisualSupportPageResults,
            partitionVisualSupportPages,
            validateVisualSupportPageIndex,
            buildVisualSupportIndexRetryPlan,
            buildValidatedVisualQuestionContract,
            partitionDocxSupportByQuestionContract,
            repairDocxSupportQuestionMarkerArtifacts,
            docxVisualTextIsBetterForV2,
            mergeDocxVisualOptionsForV2,
            mergeDocxVisualSupplementByQuestionContract,
            finalizeDocxVisualSupplementForReview,
            partitionDocxMissingAnswersForReview
        };
    }
);
