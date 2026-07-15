        const safeStorage = {
            get(key, fallback = null) {
                try {
                    const value = localStorage.getItem(key);
                    return value === null ? fallback : value;
                } catch (error) {
                    console.warn(`读取本地缓存失败：${key}`, error);
                    return fallback;
                }
            },
            set(key, value) {
                try {
                    localStorage.setItem(key, value);
                    return true;
                } catch (error) {
                    console.warn(`写入本地缓存失败：${key}`, error);
                    return false;
                }
            },
            remove(key) {
                try {
                    localStorage.removeItem(key);
                } catch (error) {
                    console.warn(`删除本地缓存失败：${key}`, error);
                }
            },
            json(key, fallback) {
                try {
                    const raw = this.get(key, null);
                    return raw === null ? fallback : JSON.parse(raw);
                } catch (error) {
                    console.warn(`解析本地缓存失败：${key}`, error);
                    return fallback;
                }
            }
        };

        const copyText = async (text) => {
            try {
                if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
                await navigator.clipboard.writeText(text);
                return true;
            } catch (error) {
                console.warn('复制失败', error);
                return false;
            }
        };

        const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('图片读取失败'));
            reader.readAsDataURL(blob);
        });

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
            const issues = [];

            let cursor = 0;
            let plainStart = 0;

            const pushPlain = (endIndex) => {
                if (endIndex <= plainStart) return;
                segments.push({
                    type: 'text',
                    raw: text.slice(plainStart, endIndex),
                    start: plainStart,
                    end: endIndex
                });
            };

            while (cursor < text.length) {
                let openToken = '';
                let closeToken = '';
                let displayMode = false;

                if (text.startsWith('$$', cursor) && !isEscapedLatexDelimiterAt(text, cursor)) {
                    openToken = '$$';
                    closeToken = '$$';
                    displayMode = true;
                } else if (text.startsWith('\\[', cursor)) {
                    openToken = '\\[';
                    closeToken = '\\]';
                    displayMode = true;
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
                    issues.push({
                        type: 'unclosed-math',
                        openToken,
                        index: cursor,
                        preview: text.slice(cursor, cursor + 120)
                    });
                    cursor += openToken.length;
                    continue;
                }

                pushPlain(cursor);

                const rawEnd = closeIndex + closeToken.length;
                segments.push({
                    type: 'math',
                    raw: text.slice(cursor, rawEnd),
                    expression: text.slice(expressionStart, closeIndex),
                    openToken,
                    closeToken,
                    displayMode,
                    start: cursor,
                    end: rawEnd
                });

                cursor = rawEnd;
                plainStart = rawEnd;
            }

            pushPlain(text.length);

            return { source: text, segments, issues };
        };

        const rebuildLatexMathSegment = (segment, expression) => {
            if (!segment || segment.type !== 'math') return String(segment?.raw || '');
            return String(segment.openToken || '') + String(expression ?? '') + String(segment.closeToken || '');
        };

        const protectLatexMathSegments = (source = '') => {
            const parsed = tokenizeLatexSource(source);
            const chunks = [];
            const protectedText = parsed.segments.map(segment => {
                if (segment.type !== 'math') return segment.raw;
                const token = `@@QISI_MATH_SEGMENT_${chunks.length}@@`;
                chunks.push(segment.raw);
                return token;
            }).join('');

            return { protectedText, chunks, issues: parsed.issues };
        };

        const restoreLatexMathSegments = (source = '', chunks = []) => {
            let output = String(source || '');
            chunks.forEach((chunk, index) => {
                output = output.replace(`@@QISI_MATH_SEGMENT_${index}@@`, chunk);
            });
            return output;
        };

        const cleanRecognizedText = (value) => {
            if (value === false || value === true || value === null || value === undefined) return '';
            if (Array.isArray(value)) return value.map(cleanRecognizedText).filter(Boolean).join('\n');
            if (typeof value === 'object') return '';

            let s = String(value);
            const {
                protectedText,
                chunks: latexBlocks,
                issues
            } = protectLatexMathSegments(s);
            if (issues.length) {
                console.warn('[TEXT_CLEAN][delimiter-issues]', { source: s, issues });
            }
            s = protectedText;

            s = s
                .replace(/<w:br\s*\/?>/g, '\n')
                .replace(/<\/w:p>/g, '\n')
                .replace(/<\/w:tr>/g, '\n')
                .replace(/<w:[^>]+\/>/g, '')
                .replace(/<[^>]+>/g, '')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'")
                .replace(/&#39;/g, "'")
                .replace(/ /g, ' ')
                .replace(/[ \t]+\n/g, '\n')
                .replace(/[ \t]{2,}/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

            s = restoreLatexMathSegments(s, latexBlocks);

            return s
                .replace(/(?<!\\)\b(triangle|angle|vec|frac|sqrt|overline|cdot|parallel|perp)(?=\s|\{)/g, '\\$1')
                .replace(/\bfalse\b/gi, '')
                .replace(/\btrue\b/gi, '')
                .replace(/\s+([，。；：,.])/g, '$1')
                .trim();
        };

        const mathSignalCount = (text = '') => {
            const source = cleanRecognizedText(text);
            if (!source) return 0;

            const patterns = [
                /\\frac/g,
                /\\sqrt/g,
                /\\vec/g,
                /\\overrightarrow/g,
                /\\angle/g,
                /\\triangle/g,
                /\\sin/g,
                /\\cos/g,
                /\\tan/g,
                /\\theta/g,
                /\\alpha/g,
                /\\beta/g,
                /\\lambda/g,
                /\$/g,
                /[_^=]/g,
                /[≤≥≠∈⊂⊆∪∩√π]/g
            ];

            return patterns.reduce((sum, re) => {
                const matches = source.match(re);
                return sum + (matches ? matches.length : 0);
            }, 0);
        };

        const extractRelevanceTokens = (text) => {
            const source = cleanRecognizedText(text);
            const stopWords = new Set(['因为', '所以', '则', '若', '已知', '求', '下列', '正确', '错误', '答案', '选项', '其中', '关于', '可以', '得到', '可得', '故选', '一个', '存在', '满足', '分别', '如下', '如图', '设为', '的是', '三角', '角A', '角B', '角C', '正弦', '余弦', '定理']);
            const genericMathTokens = new Set(['ABC', 'A', 'B', 'C', 'D', '\\sin', '\\cos', '\\tan', '\\angle', '\\triangle', 'sin', 'cos', 'tan', 'alpha', 'beta']);
            const tokens = [];
            const pushToken = (token) => {
                const clean = String(token || '').trim();
                if (!clean || stopWords.has(clean) || genericMathTokens.has(clean)) return;
                if ((clean.length >= 2 || /^[xyzmnkpqrst]$/i.test(clean))) tokens.push(clean);
            };
            (source.match(/\\[a-zA-Z]+/g) || []).forEach(pushToken);
            (source.match(/(?<![A-Za-z])[a-zxyzmnkpqrst](?![A-Za-z])/gi) || []).forEach(token => {
                if (!/^[A-D]$/i.test(token)) pushToken(token.toLowerCase());
            });
            (source.match(/[A-Z][A-Z_0-9]{0,3}/g) || []).forEach(token => {
                if (!/^[A-D]$/.test(token)) pushToken(token);
            });
            (source.match(/[一-龥]{2,}/g) || []).forEach(phrase => {
                if (phrase.length <= 6) pushToken(phrase);
                for (let idx = 0; idx < phrase.length - 1; idx += 1) pushToken(phrase.slice(idx, idx + 2));
            });
            return [...new Set(tokens)];
        };

        const finalChoiceAnswerText = (value = '') => {
            const raw = cleanRecognizedText(value)
                .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                .toUpperCase();

            const compact = raw
                .replace(/\\[A-Z]+/g, '')
                .replace(/[.\s、，。:：；;()（）【】\[\]{}]/g, '');

            if (/^[A-D]{1,4}$/.test(compact)) return compact;

            const direct = raw.match(/(?:答案|故选|选|应选|正确答案|为|是)\s*[:：]?\s*([A-D]{1,4})(?![A-Z])/);
            if (direct?.[1]) return direct[1];

            const tail = raw.match(/([A-D]{1,4})\s*$/);
            if (tail?.[1] && tail[1].length <= 4) return tail[1];

            return '';
        };

        const cleanFormulaOcrText = (text) => {
            let s = cleanRecognizedText(text || '')
                .replace(/^```(?:latex)?/i, '')
                .replace(/```$/g, '')
                .replace(/^\$\$|\$\$$/g, '')
                .replace(/^\$|\$$/g, '')
                .trim();

            if (!s) return '';

            // 必须像真实 LaTeX，才允许进入文本字段
            if (!/[\\_^{}=+\-*/]|\\frac|\\sqrt|\\angle|\\theta|\\pi|\\sin|\\cos|\\tan|\\log|\\ln/.test(s)) {
                return '';
            }

            return `$${s}$`;
        };

        const normalizeLatexText = (text) => {
            if (!text) return '';
            let out = String(text);
            out = out.replace(/([\u4e00-\u9fa5])\n([\u4e00-\u9fa5])/g, '$1$2');
            out = out.replace(/\n\s*(?=\$\$|\\\[|\$|\\\(|\\begin\{)/g, ' ');
            out = out.replace(/(?<=\$\$|\\\]|\$|\\\)|\\end\{[a-zA-Z*]+\})\s*\n/g, ' ');
            out = out.replace(/\n{2,}/g, '<br><br>');
            return out.replace(/\n/g, '');
        };

        const normalizeBareLatexExpressionForDisplay = (expression = '') => String(expression || '')
            .replace(/鈭歿2\}/g, '\\sqrt{2}')
            .replace(/鈭\?/g, '\\sqrt{2}')
            .replace(/√\s*2/g, '\\sqrt{2}')
            .replace(/蟺/g, '\\pi')
            .replace(/π/g, '\\pi')
            .trim();

        const BARE_LATEX_DISPLAY_SIGNAL_RE =
            /\\(?:frac|dfrac|sqrt|angle|sin|cos|tan|log|ln|pi|theta|alpha|beta|gamma|Delta|overline|vec|overrightarrow)\b|鈭\?|鈭歿2\}|√\s*2|蟺|π/;

        const normalizeBareLatexForDisplaySpan = (span = '') => {
            const source = String(span || '');
            if (!BARE_LATEX_DISPLAY_SIGNAL_RE.test(source)) return source;

            return source.replace(
                /[A-Za-z0-9\\{}()[\]^_+\-*/=.,:;|<>!~ \t鈭歿?√蟺π]+/g,
                (run) => {
                    if (!BARE_LATEX_DISPLAY_SIGNAL_RE.test(run)) return run;

                    const leading = run.match(/^\s*/)?.[0] || '';
                    const trailing = run.match(/\s*$/)?.[0] || '';
                    let body = run.slice(leading.length, run.length - trailing.length);
                    if (!body) return run;

                    if (!BARE_LATEX_DISPLAY_SIGNAL_RE.test(body)) return run;

                    const normalized = normalizeBareLatexExpressionForDisplay(body);
                    if (!normalized || !BARE_LATEX_DISPLAY_SIGNAL_RE.test(normalized)) return run;
                    if (/^\$[\s\S]*\$$/.test(normalized) || /^\\\([\s\S]*\\\)$/.test(normalized) || /^\\\[[\s\S]*\\\]$/.test(normalized)) {
                        return run;
                    }

                    return `${leading}$${normalized}$${trailing}`;
                }
            );
        };

        const normalizeBareLatexForDisplayTextBody = (text) => {
            const source = String(text ?? '');
            if (!source || !BARE_LATEX_DISPLAY_SIGNAL_RE.test(source)) return source;

            const {
                protectedText,
                chunks: latexBlocks,
                issues
            } = protectLatexMathSegments(source);

            if (issues.length) {
                console.warn('[DISPLAY_LATEX_NORMALIZE][delimiter-issues]', { source, issues });
            }

            const tokenPattern = /(@@QISI_MATH_SEGMENT_\d+@@)/g;
            const parts = protectedText.split(tokenPattern);
            const normalized = parts.reduce((result, part, index) => {
                const isProtected = /^@@QISI_MATH_SEGMENT_\d+@@$/.test(part);
                const normalizedPart = isProtected
                    ? part
                    : normalizeBareLatexForDisplaySpan(part);
                const previousWasProtected = index > 0 && /^@@QISI_MATH_SEGMENT_\d+@@$/.test(parts[index - 1]);
                const nextIsProtected = index + 1 < parts.length && /^@@QISI_MATH_SEGMENT_\d+@@$/.test(parts[index + 1]);
                const needsLeadingBoundary = previousWasProtected && normalizedPart.startsWith('$');
                const needsTrailingBoundary = nextIsProtected && normalizedPart.endsWith('$');
                return result + (needsLeadingBoundary ? '\u200B' : '') + normalizedPart + (needsTrailingBoundary ? '\u200B' : '');
            }, '');
            return restoreLatexMathSegments(normalized, latexBlocks);
        };

        const normalizeBareLatexForDisplayOptionLine = (line) => {
            const optionMatch = String(line).match(/^(\s*)([A-FＡ-Ｆ])([.．、:：])(\s*)(.*)$/);
            if (!optionMatch) return null;

            const [, leading, rawLabel, delimiter, spacing, content] = optionMatch;
            const label = rawLabel.replace(/[Ａ-Ｆ]/g, ch =>
                String.fromCharCode(ch.charCodeAt(0) - 65248)
            );
            const normalizedContent = normalizeBareLatexForDisplayTextBody(content);
            return normalizedContent
                ? `${leading}${label}${delimiter}${spacing || ' '}${normalizedContent}`
                : `${leading}${label}${delimiter}`;
        };

        const normalizeBareLatexForDisplayText = (text) => {
            const source = String(text ?? '');
            if (!source) return source;

            return source.split('\n').map(line => {
                const optionLine = normalizeBareLatexForDisplayOptionLine(line);
                return optionLine === null
                    ? normalizeBareLatexForDisplayTextBody(line)
                    : optionLine;
            }).join('\n');
        };

        const normalizeBareLatexForDisplayOptions = (options) => (
            Array.isArray(options)
                ? options.map(option => normalizeBareLatexForDisplayText(option))
                : options
        );

        const splitOptionsFromStem = (text) => {
            if (!text) return null;

            const source = String(text)
                .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                .replace(/\r/g, '\n')
                .replace(/([A-D])\s*[．.、:：]\s*/g, '$1. ');

            const labelRegex = /(^|[\n\r\s　]|[（(])([A-D])\s*(?:[\.．、:：\)）]|(?=\s*[$\\\u4e00-\u9fa5A-Za-z0-9（(]))/g;

            const hits = [];
            let match;

            while ((match = labelRegex.exec(source)) !== null) {
                hits.push({
                    label: match[2],
                    start: match.index + match[1].length,
                    contentStart: labelRegex.lastIndex
                });
            }

            const candidates = [];

            for (let i = 0; i < hits.length; i += 1) {
                if (hits[i].label !== 'A') continue;

                const expected = ['A', 'B', 'C', 'D'];
                const ordered = [];

                for (let j = i; j < hits.length; j += 1) {
                    if (hits[j].label === expected[ordered.length]) {
                        ordered.push(hits[j]);
                        if (ordered.length === 4) break;
                    }
                }

                if (ordered.length >= 2) candidates.push(ordered);
            }

            if (!candidates.length) return null;

            const ordered = candidates[0];

            const stem = source.slice(0, ordered[0].start).trim();
            if (!stem) return null;

            const options = ['', '', '', ''];

            ordered.forEach((item, idx) => {
                const next = ordered[idx + 1];
                const end = next ? next.start : source.length;

                const value = source.slice(item.contentStart, end)
                    .replace(/^[\s　]*[A-D]\s*[\.\．、:：\)）]?\s*/i, '')
                    .trim();

                const optionIndex = item.label.charCodeAt(0) - 65;

                if (optionIndex >= 0 && optionIndex < 4 && !options[optionIndex]) {
                    options[optionIndex] = value;
                }
            });

            const validCount = options.filter(v => {
                const clean = String(v || '')
                    .replace(/[.\s、，。:：；;()（）]/g, '')
                    .trim();

                if (!clean) return false;
                if (/^[A-D]$/i.test(clean)) return false;

                return clean.length >= 1;
            }).length;

            if (validCount < 2) return null;

            return { stem, options };
        };

        const applyOptionSplit = (target) => {
            const split = splitOptionsFromStem(target?.stem);
            if (!split) return false;
            const existingOptions = Array.isArray(target.options) ? target.options : ['', '', '', ''];
            const hasManualOptions = existingOptions.some(opt => String(opt || '').trim());
            target.stem = split.stem;
            if (!hasManualOptions) target.options = split.options;
            if (target.type === '解答题' || target.type === '填空题' || !target.type) target.type = '单选题';
            return true;
        };

        const choiceTypes = ['单选题', '多选题'];

        const hasOptionText = (options) => Array.isArray(options) && options.some(opt => String(opt || '').trim());

        const mergeStemWithOptions = (stem, options, type) => {
            const cleanStem = String(stem || '').trimEnd();
            if (!choiceTypes.includes(type) || !hasOptionText(options)) return cleanStem;
            const alreadyCombined = splitOptionsFromStem(cleanStem);
            if (alreadyCombined) return cleanStem;
            const optionText = options
                .map((opt, idx) => String(opt || '').trim() ? `${String.fromCharCode(65 + idx)}. ${String(opt || '').trim()}` : '')
                .filter(Boolean)
                .join('\n');
            return [cleanStem, optionText].filter(Boolean).join('\n\n');
        };

        const splitQuestionForStorage = (stem, type, fallbackOptions = ['', '', '', '']) => {
            const split = splitOptionsFromStem(stem);
            if (!split) {
                return {
                    stem: String(stem || ''),
                    options: choiceTypes.includes(type) ? [...fallbackOptions] : ['', '', '', ''],
                    type
                };
            }
            const nextType = choiceTypes.includes(type) ? type : '单选题';
            return { stem: split.stem, options: split.options, type: nextType };
        };

        const findNode = (nodes, name) => {
            for (const node of nodes || []) {
                if (node?.name === name) return node;
                if (node?.children) {
                    const found = findNode(node.children, name);
                    if (found) return found;
                }
            }
            return null;
        };

        const validatePageRange = (value) => {
            const text = String(value || '').trim();
            if (!text) return true;
            if (/[，；、\s]/.test(text)) return false;
            const parts = text.split(',');
            return parts.every(part => {
                if (/^\d+$/.test(part)) return Number(part) > 0;
                const range = part.match(/^(\d+)-(\d+)$/);
                if (!range) return false;
                const start = Number(range[1]);
                const end = Number(range[2]);
                return start > 0 && end > 0 && start <= end;
            });
        };

        const isFatalQwenServiceError = (error) => {
            const message = String(error?.message || error || '').toLowerCase();

            return (
                message.includes('qwen 视觉识别接口不可用') ||
                message.includes('dashscope 鉴权失败') ||
                message.includes('余额不足') ||
                message.includes('额度耗尽') ||
                message.includes('api key 无效') ||
                message.includes('权限不足') ||
                message.includes('限流') ||
                message.includes('http 429') ||
                message.includes('quota') ||
                message.includes('balance') ||
                message.includes('billing') ||
                message.includes('unauthorized') ||
                message.includes('forbidden') ||
                message.includes('rate limit')
            );
        };

        const stripAnswerSolution = (text) => {
            let stem = String(text || '');
            let answer = '';
            let solution = '';
            const solutionMatch = stem.match(/(?:【(?:解析|详解|解答|分析)】|(?:解析|详解|解答|分析|解)\s*[:：])([\s\S]*)/);
            if (solutionMatch) {
                solution = solutionMatch[1].trim();
                stem = stem.slice(0, solutionMatch.index).trim();
            }
            const answerMatch = stem.match(/(?:【答案】|参考答案[:：]|答案[:：])\s*([A-DＡ-Ｄ]+|[\s\S]{1,80})/);
            if (answerMatch) {
                answer = answerMatch[1].split('\n')[0].trim();
                stem = stem.slice(0, answerMatch.index).trim();
            }
            return { stem, answer, solution };
        };

        const expandPageRange = (range, maxPage) => {
            const text = String(range || '').trim();
            if (!text) return Array.from({ length: maxPage }, (_, idx) => idx + 1);
            const pages = new Set();
            text.split(',').forEach(part => {
                const rangeMatch = part.match(/^(\d+)-(\d+)$/);
                if (rangeMatch) {
                    const start = Number(rangeMatch[1]);
                    const end = Number(rangeMatch[2]);
                    for (let page = start; page <= end; page++) if (page <= maxPage) pages.add(page);
                } else {
                    const page = Number(part);
                    if (page > 0 && page <= maxPage) pages.add(page);
                }
            });
            return [...pages].sort((a, b) => a - b);
        };

        const normalizeFigureBbox = (bbox) => {
            if (!Array.isArray(bbox) || bbox.length !== 4) return [];

            const values = bbox.map(Number);
            if (values.some(value => !Number.isFinite(value))) return [];

            const [rawX1, rawY1, rawX2, rawY2] = values;
            const x1 = Math.min(rawX1, rawX2);
            const y1 = Math.min(rawY1, rawY2);
            const x2 = Math.max(rawX1, rawX2);
            const y2 = Math.max(rawY1, rawY2);

            if (x2 <= x1 || y2 <= y1) return [];

            return [x1, y1, x2, y2];
        };

        const bboxIntersectionArea = (left, right) => {
            const a = normalizeFigureBbox(left);
            const b = normalizeFigureBbox(right);
            if (!a.length || !b.length) return 0;

            const x1 = Math.max(a[0], b[0]);
            const y1 = Math.max(a[1], b[1]);
            const x2 = Math.min(a[2], b[2]);
            const y2 = Math.min(a[3], b[3]);

            if (x2 <= x1 || y2 <= y1) return 0;

            return (x2 - x1) * (y2 - y1);
        };

        const preserveRawEvidence = (q) => {
            if (!q) return q;

            q.rawTextOriginal = q.rawTextOriginal || q.rawText || '';
            q.rawBlockOriginal = q.rawBlockOriginal || q.rawBlock || '';
            q.pageTextOriginal = q.pageTextOriginal || q.pageText || '';
            q.sourceTextOriginal = q.sourceTextOriginal || q.sourceText || '';

            if (q.sourceTrace) {
                q.sourceTrace.rawBlockOriginal = q.sourceTrace.rawBlockOriginal || q.sourceTrace.rawBlock || '';
                q.sourceTrace.pageTextOriginal = q.sourceTrace.pageTextOriginal || q.sourceTrace.pageText || '';
                q.sourceTrace.sourceTextOriginal = q.sourceTrace.sourceTextOriginal || q.sourceTrace.sourceText || '';
            }

            return q;
        };

        const normalizeAnswerSolutionSource = (text) => cleanRecognizedText(text)
            .replace(/\r/g, '\n')
            .replace(/　/g, ' ')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        const splitAnswerSolutionSections = (text) => {
            const source = normalizeAnswerSolutionSource(text);

            const solutionHeader = source.match(/(^|\n)\s*(?:参考)?(?:解析|详解|解答过程|解答|分析)\s*[:：]?\s*/);

            if (!solutionHeader) {
                return {
                    answerPart: source,
                    solutionPart: source
                };
            }

            return {
                answerPart: source.slice(0, solutionHeader.index).trim(),
                solutionPart: source.slice(solutionHeader.index + solutionHeader[0].length).trim()
            };
        };

        const BATCH_MEDIA_TOKEN_RE =
            /(\[\[(?:IMAGE|FORMULA_IMAGE):[^\]]+\]\]|\\includegraphics(?:\[[^\]]*\])?\{[^}]+\})/g;

        const BATCH_BAD_PLACEHOLDER_RE =
            /(\[IMAGE:[^\]]+\]|\[公式图片(?::[^\]]+)?\]|\[公式图片待识别\]|\[公式图片识别\]|\[公?式图片\s*待识别\]|\[图片选项待转换[^\]]*\]|\[公式图片选项待转换[^\]]*\]|\[公式图片选项暂不支持预览[^\]]*\])/g;

        const protectBatchMediaTokens = (text = '') => {
            const tokens = [];
            const protectedText = String(text || '').replace(BATCH_MEDIA_TOKEN_RE, (match) => {
                const key = `__QISI_MEDIA_TOKEN_${tokens.length}__`;
                tokens.push(match);
                return key;
            });
            return { protectedText, tokens };
        };

        const restoreBatchMediaTokens = (text = '', tokens = []) => {
            return String(text || '').replace(/__QISI_MEDIA_TOKEN_(\d+)__/g, (_, idx) => {
                return tokens[Number(idx)] || '';
            });
        };

        const hasBatchMediaToken = (text = '') => {
            BATCH_MEDIA_TOKEN_RE.lastIndex = 0;
            return BATCH_MEDIA_TOKEN_RE.test(String(text || ''));
        };

        const hasBatchImagePlaceholder = (text = '') => {
            BATCH_BAD_PLACEHOLDER_RE.lastIndex = 0;
            return BATCH_BAD_PLACEHOLDER_RE.test(String(text || '')) || hasBatchMediaToken(text);
        };

        const hasUnconvertedImagePlaceholder = (value = '') => {
            const raw = String(value || '');

            // Legal media tokens are not unconverted-image errors.
            const { protectedText } = protectBatchMediaTokens(raw);

            return /公式图片选项待转换|图片选项待转换|待转换[:：]?(?:wmf|emf|ole|bin)|\[object Object\]|\bundefined\b|\bnull\b/i
                .test(protectedText);
        };

        const hasUnconvertedOptionPlaceholder = (q) => {
            const text = [
                q?.stem,
                ...(Array.isArray(q?.options) ? q.options : [])
            ].map(x => String(x || '')).join('\n');

            return /\[公式图片选项待转换[:：]?\s*(wmf|emf|ole|bin|unknown)\]/i.test(text) ||
                /\[图片选项待转换/i.test(text) ||
                hasUnconvertedImagePlaceholder(text);
        };

        const itemHasUnconvertedImagePlaceholder = (item = {}) => [
            item.stem,
            ...(Array.isArray(item.options) ? item.options : []),
            item.answer,
            item.solution
        ].some(hasUnconvertedImagePlaceholder);

        const questionMatchesLibraryFilters = (q, options = {}) => {
            if (!q) return false;

            const keyword = String(options.keyword || '').trim().toLowerCase();
            const filters = options.filters || {};
            const hasTextFn = typeof options.hasText === 'function'
                ? options.hasText
                : (value) => String(value || '').trim().length > 0;

            if (keyword) {
                const haystack = [q.stem, q.answer, q.solution]
                    .map(value => String(value || '').toLowerCase())
                    .join('\n');
                if (!haystack.includes(keyword)) return false;
            }
            if (filters.type && q.type !== filters.type) return false;
            if (filters.diff && (q.diff || q.meta?.diff || '') !== filters.diff) return false;
            if (filters.grade && (q.grade || q.meta?.grade || '') !== filters.grade) return false;
            if (filters.answerState === 'hasAnswer' && !hasTextFn(q.solution)) return false;
            if (filters.answerState === 'noAnswer' && hasTextFn(q.solution)) return false;

            const hasImages = Array.isArray(q.images) && q.images.length > 0;
            if (filters.imageState === 'hasImage' && !hasImages) return false;
            if (filters.imageState === 'noImage' && hasImages) return false;

            return true;
        };

        const stripBatchImagePlaceholders = (text) => {
            const raw = String(text || '');
            const { protectedText, tokens } = protectBatchMediaTokens(raw);

            const cleaned = protectedText
                .replace(BATCH_BAD_PLACEHOLDER_RE, '')
                .replace(/[ \t]{2,}/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .replace(/\s+([，。；：,.、])/g, '$1')
                .trim();

            return restoreBatchMediaTokens(cleaned, tokens).trim();
        };

        const LATEX_WRAPPER_ENV_NAMES = ['description', 'enumerate', 'itemize'];

        const sanitizeLatexWrapperArtifacts = (text) => {
            if (!text) return '';

            let s = String(text);

            // 1. Remove markdown code fences — lines that are ONLY ``` or ```lang
            s = s.replace(/^```[a-z]*\s*$/gm, '');

            // 2. Convert \begin{equation}...\end{equation} to \[...\]
            //    This allows the LaTeX tokenizer to recognize them as display math.
            s = s.replace(/\\begin\{equation\*?\}/g, '\\[');
            s = s.replace(/\\end\{equation\*?\}/g, '\\]');

            // 3. Remove standalone \begin{env} / \end{env} lines for wrapper environments
            LATEX_WRAPPER_ENV_NAMES.forEach((env) => {
                const beginLineRe = new RegExp(`^\\\\begin\\{${env}\\}\\s*$`, 'gm');
                const endLineRe = new RegExp(`^\\\\end\\{${env}\\}\\s*$`, 'gm');
                s = s.replace(beginLineRe, '');
                s = s.replace(endLineRe, '');
            });

            // 4. Remove any remaining \begin{env} / \end{env} fragments (inline or trailing)
            LATEX_WRAPPER_ENV_NAMES.forEach((env) => {
                s = s.replace(new RegExp(`\\\\begin\\{${env}\\}`, 'g'), '');
                s = s.replace(new RegExp(`\\\\end\\{${env}\\}`, 'g'), '');
            });

            // 5. Remove \item (and \item[...]) at line start, keep the content after it
            s = s.replace(/^\\item(?:\[[^\]]*\])?\s*/gm, '');

            // 6. Strip orphaned boundary braces — unmatched { or } at the very
            //    beginning or end that are not part of a balanced LaTeX group.
            {
                const countUnescaped = (char) => {
                    let count = 0;
                    for (let i = 0; i < s.length; i += 1) {
                        if (s[i] === char && (i === 0 || s[i - 1] !== '\\')) {
                            count += 1;
                        }
                    }
                    return count;
                };

                let openCount = countUnescaped('{');
                let closeCount = countUnescaped('}');

                // Leading orphaned } (more } than { overall)
                while (openCount < closeCount && /^\}\s*/.test(s)) {
                    s = s.replace(/^\}\s*/, '');
                    closeCount -= 1;
                }

                // Trailing orphaned } (more } than { overall)
                while (openCount < closeCount && /\s*\}$/.test(s)) {
                    s = s.replace(/\s*\}$/, '');
                    closeCount -= 1;
                }

                // Leading orphaned { (more { than } overall)
                while (openCount > closeCount && /^\{\s*/.test(s)) {
                    s = s.replace(/^\{\s*/, '');
                    openCount -= 1;
                }

                // Trailing orphaned { (more { than } overall)
                while (openCount > closeCount && /\s*\{$/.test(s)) {
                    s = s.replace(/\s*\{$/, '');
                    openCount -= 1;
                }
            }

            // 7. Collapse blank lines and trim
            s = s.replace(/\n{3,}/g, '\n\n');
            s = s.trim();

            // 8. If only braces and whitespace remain, return empty
            if (/^[\s\{\}]*$/.test(s)) {
                return '';
            }

            // 9. Guard against raw JSON payload leakage.
            //    AI structured output (e.g. qwen-plus) can leak its JSON wrapper
            //    into stem / answer / solution when extraction fails.  This is
            //    NOT a general JSON detector — it only fires when ≥3 known AI
            //    JSON field patterns appear together with JSON structural chars.
            if (isRawJsonPayloadText(s)) {
                return '【结构化输出解析失败，需人工复核】';
            }

            return s;
        };

        // Detects text that looks like leaked AI structured-output JSON.
        // Conservative: requires ≥3 known field patterns AND JSON structural
        // characters.  Normal math / Chinese text will never match.
        const AI_JSON_FIELD_PATTERNS = [
            /"questions"\s*:\s*\[/,
            /"questionNumber"\s*:/,
            /"options"\s*:\s*\{/,
            /"stem"\s*:\s*"/,
            /"answer"\s*:\s*"/,
            /"analysis"\s*:\s*"/,
            /"correctAnswer"\s*:/,
            /"type"\s*:\s*"/
        ];

        const isRawJsonPayloadText = (text) => {
            if (!text) return false;

            const s = String(text);

            // Must have JSON structural characters to even consider it.
            const hasJsonStructure = /[\{\}]/.test(s) && /["\[\]:,]/.test(s);
            if (!hasJsonStructure) return false;

            const matchCount = AI_JSON_FIELD_PATTERNS.filter((re) => re.test(s)).length;
            // Require ≥3 distinct AI JSON field patterns — normal text will
            // never match even one of these.
            return matchCount >= 3;
        };

        const cleanDisplayTextForBatchSave = (text) => {
            const raw = cleanRecognizedText(text);
            if (!raw) return '';
            return sanitizeLatexWrapperArtifacts(stripBatchImagePlaceholders(raw));
        };

        const cleanDisplayOptionsForBatchSave = (options) => {
            const arr = Array.isArray(options) ? options : ['', '', '', ''];

            return [0, 1, 2, 3].map(idx => {
                const raw = cleanRecognizedText(arr[idx] || '');
                if (!raw) return '';

                const cleaned = cleanDisplayTextForBatchSave(raw);

                // 关键：纯图片选项也必须保留，不能返回空。
                if (!cleaned && hasBatchMediaToken(raw)) {
                    const mediaTokens = raw.match(BATCH_MEDIA_TOKEN_RE) || [];
                    return mediaTokens.join(' ').trim();
                }

                return cleaned;
            });
        };

        const cleanDisplayFieldsOnly = (q) => {
            if (!q) return q;

            q.stem = cleanDisplayTextForBatchSave(q.stem);
            q.options = cleanDisplayOptionsForBatchSave(q.options);
            q.answer = cleanDisplayTextForBatchSave(q.answer);
            q.solution = cleanDisplayTextForBatchSave(q.solution);

            return q;
        };

        const addWarningOnce = (q, message) => {
            if (!q || !message) return;
            q.warnings = [...new Set([...(q.warnings || []), message])];
        };

        const api = {
            BATCH_BAD_PLACEHOLDER_RE,
            BATCH_MEDIA_TOKEN_RE,
            addWarningOnce,
            bboxIntersectionArea,
            cleanDisplayFieldsOnly,
            cleanDisplayOptionsForBatchSave,
            cleanDisplayTextForBatchSave,
            cleanFormulaOcrText,
            cleanRecognizedText,
            expandPageRange,
            extractRelevanceTokens,
            findNode,
            finalChoiceAnswerText,
            normalizeBareLatexExpressionForDisplay,
            normalizeBareLatexForDisplayOptionLine,
            normalizeBareLatexForDisplayOptions,
            normalizeBareLatexForDisplaySpan,
            normalizeBareLatexForDisplayText,
            normalizeBareLatexForDisplayTextBody,
            hasBatchImagePlaceholder,
            hasBatchMediaToken,
            hasUnconvertedImagePlaceholder,
            hasUnconvertedOptionPlaceholder,
            isFatalQwenServiceError,
            isRawJsonPayloadText,
            itemHasUnconvertedImagePlaceholder,
            mathSignalCount,
            normalizeAnswerSolutionSource,
            normalizeFigureBbox,
            preserveRawEvidence,
            questionMatchesLibraryFilters,
            protectBatchMediaTokens,
            protectLatexMathSegments,
            restoreBatchMediaTokens,
            restoreLatexMathSegments,
            sanitizeLatexWrapperArtifacts,
            splitAnswerSolutionSections,
            stripBatchImagePlaceholders,
            splitQuestionForStorage,
            stripAnswerSolution,
            validatePageRange
        };

        if (typeof globalThis !== 'undefined') {
            globalThis.Qisi = globalThis.Qisi || {};
            globalThis.Qisi.Utils = api;
        }

        if (typeof module !== 'undefined' && module.exports) {
            module.exports = api;
        }
