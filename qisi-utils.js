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

        const api = {
            cleanFormulaOcrText,
            cleanRecognizedText,
            extractRelevanceTokens,
            findNode,
            finalChoiceAnswerText,
            mathSignalCount,
            protectLatexMathSegments,
            restoreLatexMathSegments,
            splitQuestionForStorage
        };

        if (typeof globalThis !== 'undefined') {
            globalThis.Qisi = globalThis.Qisi || {};
            globalThis.Qisi.Utils = api;
        }

        if (typeof module !== 'undefined' && module.exports) {
            module.exports = api;
        }
