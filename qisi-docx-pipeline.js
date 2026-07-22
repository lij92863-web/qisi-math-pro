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
