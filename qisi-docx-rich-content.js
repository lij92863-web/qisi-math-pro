(function (root, factory) {
    const api = factory(root);

    root.Qisi = root.Qisi || {};
    root.Qisi.DocxRichContent = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined' ? globalThis : this,
    function (root) {
        'use strict';

        const oleReader = root?.Qisi?.DocxOleReader || (
            typeof require === 'function' ? require('./qisi-docx-ole-reader.js') : null
        );
        const mtefReader = root?.Qisi?.DocxMtefReader || (
            typeof require === 'function' ? require('./qisi-docx-mtef-reader.js') : null
        );

        const decodeXmlEntities = (value = '') => String(value || '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
            .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));

        const stripOnlyOuterMathDelimiters = (value = '') => {
            let source = String(value || '').trim();
            let changed = true;

            while (changed) {
                changed = false;
                const pairs = [
                    ['$$', '$$'],
                    ['$', '$'],
                    ['\\[', '\\]'],
                    ['\\(', '\\)']
                ];

                for (const [start, end] of pairs) {
                    if (source.startsWith(start) && source.endsWith(end) && source.length >= start.length + end.length) {
                        source = source.slice(start.length, -end.length).trim();
                        changed = true;
                        break;
                    }
                }
            }

            return source;
        };

        const canonicalizeMathCommands = (value = '') => {
            let source = String(value || '')
                .replace(/\r\n?/g, '\n')
                .replace(/[＝]/g, '=')
                .replace(/[−﹣]/g, '-')
                .replace(/π/g, '\\pi ')
                .replace(/∈/g, '\\in ')
                .replace(/∩/g, '\\cap ')
                .replace(/∪/g, '\\cup ')
                .replace(/⊆/g, '\\subseteq ')
                .replace(/≠/g, '\\ne ')
                .replace(/≤/g, '\\le ')
                .replace(/≥/g, '\\ge ')
                .replace(/×/g, '\\times ')
                .replace(/÷/g, '\\div ')
                .replace(/°/g, '^{\\circ}');

            source = source
                .replace(/\\(?:rm|mathrm|text)\s*\{\s*\\pi\s*\}/g, '\\pi')
                .replace(/\\(?:bf|mathbf)\s*\{\s*Z\s*\}/g, '\\mathbb{Z}')
                .replace(/\{\s*(\\mathbb\{Z\}|\\pi)\s*\}/g, '$1')
                .replace(/\\sqrt\s*([0-9A-Za-z])/g, '\\sqrt{$1}')
                .replace(/([A-Za-z0-9}])\|([A-Za-z])/g, '$1\\mid $2');

            for (let pass = 0; pass < 4; pass += 1) {
                const next = source
                    .replace(/\{\s*\{([^{}]*)\}\s*\}/g, '{$1}')
                    .replace(/\\(?:rm|mathrm)\s*\{([^{}]*)\}/g, '$1');
                if (next === source) break;
                source = next;
            }

            return source
                .replace(/[ \t]+/g, ' ')
                .replace(/\s*([=+,:])\s*/g, '$1')
                .replace(/\s*([{}])\s*/g, '$1')
                .replace(/\\pi(?=[A-Za-z0-9])/g, '\\pi ')
                .trim();
        };

        const readBalancedGroup = (source, start) => {
            if (source[start] !== '{') return -1;
            let depth = 0;
            for (let index = start; index < source.length; index += 1) {
                if (source[index] === '{' && source[index - 1] !== '\\') depth += 1;
                if (source[index] === '}' && source[index - 1] !== '\\') depth -= 1;
                if (depth === 0) return index + 1;
                if (depth < 0) return -1;
            }
            return -1;
        };

        const validateLatexBalance = (value = '') => {
            const source = String(value || '');
            const stack = [];
            const pairs = { '}': '{', ']': '[', ')': '(' };

            for (let index = 0; index < source.length; index += 1) {
                const char = source[index];
                if (source[index - 1] === '\\') continue;
                if ('{[('.includes(char)) stack.push(char);
                if ('}])'.includes(char) && stack.pop() !== pairs[char]) {
                    return { ok: false, code: 'UNBALANCED_LATEX', diagnostics: [`unexpected-${char}@${index}`] };
                }
            }

            if (stack.length) {
                return { ok: false, code: 'UNBALANCED_LATEX', diagnostics: [`unclosed-${stack.join('')}`] };
            }

            const environments = new Map();
            source.replace(/\\(begin|end)\s*\{([^}]+)\}/g, (_, kind, name) => {
                environments.set(name, (environments.get(name) || 0) + (kind === 'begin' ? 1 : -1));
                return '';
            });
            const mismatch = [...environments.entries()].find(([, count]) => count !== 0);
            if (mismatch) return { ok: false, code: 'UNBALANCED_LATEX', diagnostics: [`environment-${mismatch[0]}`] };

            return { ok: true, code: 'LATEX_BALANCED', diagnostics: [] };
        };

        const validateCommandArguments = (value = '') => {
            const source = String(value || '');
            const failures = [];

            for (const command of ['frac', 'sqrt']) {
                const regex = new RegExp(`\\\\${command}\\b`, 'g');
                let match;
                while ((match = regex.exec(source)) !== null) {
                    let cursor = regex.lastIndex;
                    while (/\s/.test(source[cursor] || '')) cursor += 1;
                    if (command === 'sqrt' && source[cursor] === '[') {
                        const optionalEnd = source.indexOf(']', cursor + 1);
                        cursor = optionalEnd >= 0 ? optionalEnd + 1 : cursor;
                        while (/\s/.test(source[cursor] || '')) cursor += 1;
                    }
                    const firstEnd = readBalancedGroup(source, cursor);
                    if (firstEnd < 0) {
                        failures.push(`missing-${command}-arg@${match.index}`);
                        continue;
                    }
                    if (command === 'frac') {
                        cursor = firstEnd;
                        while (/\s/.test(source[cursor] || '')) cursor += 1;
                        if (readBalancedGroup(source, cursor) < 0) failures.push(`missing-frac-den@${match.index}`);
                    }
                }
            }

            return failures.length
                ? { ok: false, code: 'MISSING_COMMAND_ARGUMENT', diagnostics: failures }
                : { ok: true, code: 'COMMAND_ARGUMENTS_OK', diagnostics: [] };
        };

        const normalizeLatexFragment = (input) => {
            const source = String(input ?? '').trim();
            if (!source) return { ok: false, code: 'EMPTY_MATH_FRAGMENT', latex: '', diagnostics: [] };

            const stripped = stripOnlyOuterMathDelimiters(source);
            if (/\$|\\\(|\\\)|\\\[|\\\]/.test(stripped)) {
                return {
                    ok: false,
                    code: 'NESTED_MATH_DELIMITER',
                    latex: '',
                    diagnostics: ['math delimiter remained inside fragment']
                };
            }

            const latex = canonicalizeMathCommands(stripped);
            const balance = validateLatexBalance(latex);
            if (!balance.ok) return { ...balance, latex: '' };
            const args = validateCommandArguments(latex);
            if (!args.ok) return { ...args, latex: '' };
            if (/\[object Object\]|undefined|null|<[^>]+>|[{}]\s*:\s*["']/.test(latex)) {
                return { ok: false, code: 'INVALID_LATEX_PAYLOAD', latex: '', diagnostics: ['non-math payload'] };
            }

            return { ok: true, code: 'LATEX_OK', latex, diagnostics: [] };
        };

        const normalizePlainText = (value = '') => String(value || '')
            .replace(/\r\n?/g, '\n')
            .replace(/\u00a0/g, ' ');

        const serializeRichRuns = (runs = [], diagnostics = []) => (runs || []).map((run, index) => {
            if (run?.kind === 'text') return normalizePlainText(run.text);
            if (run?.kind === 'tab') return '\t';
            if (run?.kind === 'break') return '\n';
            if (run?.kind === 'image') return run.token || (run.assetId ? `[[IMAGE:${run.assetId}]]` : '');
            if (run?.kind !== 'math') return '';

            const normalized = normalizeLatexFragment(run.latex);
            if (normalized.ok) return `$${normalized.latex}$`;
            diagnostics.push({
                kind: 'formula-error',
                source: String(run.rawSource || run.latex || ''),
                code: normalized.code,
                runIndex: index,
                paragraphIndex: run.paragraphIndex ?? null
            });
            return '公式需要人工复核';
        }).join('');

        const parseXmlTree = (xml = '') => {
            const root = { name: 'root', attrs: '', children: [] };
            const stack = [root];
            const token = /<([^>]+)>|([^<]+)/g;
            let match;

            while ((match = token.exec(String(xml || ''))) !== null) {
                if (match[2] !== undefined) {
                    if (match[2]) stack[stack.length - 1].children.push({ name: '#text', text: decodeXmlEntities(match[2]) });
                    continue;
                }

                const raw = match[1].trim();
                if (!raw || raw.startsWith('?') || raw.startsWith('!')) continue;
                if (raw.startsWith('/')) {
                    if (stack.length > 1) stack.pop();
                    continue;
                }

                const selfClosing = raw.endsWith('/');
                const body = selfClosing ? raw.slice(0, -1).trim() : raw;
                const firstSpace = body.search(/\s/);
                const qualified = firstSpace < 0 ? body : body.slice(0, firstSpace);
                const node = {
                    name: qualified.includes(':') ? qualified.split(':').pop() : qualified,
                    attrs: firstSpace < 0 ? '' : body.slice(firstSpace + 1),
                    children: []
                };
                stack[stack.length - 1].children.push(node);
                if (!selfClosing) stack.push(node);
            }

            return root;
        };

        const xmlAttr = (node, localName) => {
            const regex = new RegExp(`(?:\\b|:)${localName}=["']([^"']*)["']`);
            return String(node?.attrs || '').match(regex)?.[1] || '';
        };

        const childByName = (node, name) => (node?.children || []).find(child => child.name === name);

        const mathTextToLatex = (value = '') => canonicalizeMathCommands(String(value || '')
            .replace(/\\/g, '\\backslash '));

        const ommlNodeToLatex = (node) => {
            if (!node) return '';
            if (node.name === '#text') return mathTextToLatex(node.text);
            if (/Pr$/.test(node.name) || ['ctrlPr', 'rPr'].includes(node.name)) return '';

            const body = () => (node.children || []).map(ommlNodeToLatex).join('');
            const valueOf = name => ommlNodeToLatex(childByName(node, name));

            if (node.name === 'f') return `\\frac{${valueOf('num')}}{${valueOf('den')}}`;
            if (node.name === 'rad') {
                const degree = valueOf('deg');
                const expression = valueOf('e');
                return degree ? `\\sqrt[${degree}]{${expression}}` : `\\sqrt{${expression}}`;
            }
            if (node.name === 'sSup') return `{${valueOf('e')}}^{${valueOf('sup')}}`;
            if (node.name === 'sSub') return `{${valueOf('e')}}_{${valueOf('sub')}}`;
            if (node.name === 'sSubSup') return `{${valueOf('e')}}_{${valueOf('sub')}}^{${valueOf('sup')}}`;
            if (node.name === 'bar') return `\\overline{${valueOf('e')}}`;
            if (node.name === 'd') return `\\left(${valueOf('e')}\\right)`;
            if (node.name === 'nary') return `\\sum ${valueOf('sub')}${valueOf('sup')}${valueOf('e')}`;
            if (node.name === 'chr') return mathTextToLatex(xmlAttr(node, 'val'));
            return body();
        };

        const ommlToLatexBody = (xml = '') => {
            const tree = parseXmlTree(xml);
            const raw = (tree.children || []).map(ommlNodeToLatex).join('');
            const normalized = normalizeLatexFragment(raw);
            return normalized.ok ? normalized.latex : '';
        };

        const toUint8Array = (value) => {
            if (value instanceof Uint8Array) return value;
            if (value instanceof ArrayBuffer) return new Uint8Array(value);
            if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
            return new Uint8Array(value || []);
        };

        const findAscii = (bytes, text) => {
            const needle = Array.from(String(text || '')).map(char => char.charCodeAt(0));
            for (let index = 0; index <= bytes.length - needle.length; index += 1) {
                let matches = true;
                for (let offset = 0; offset < needle.length; offset += 1) {
                    if (bytes[index + offset] !== needle[offset]) {
                        matches = false;
                        break;
                    }
                }
                if (matches) return index;
            }
            return -1;
        };

        const readInt32LE = (bytes, offset) => (
            bytes[offset] |
            (bytes[offset + 1] << 8) |
            (bytes[offset + 2] << 16) |
            (bytes[offset + 3] << 24)
        ) >>> 0;

        const extractMtefFromWmf = (value) => {
            const bytes = toUint8Array(value);
            const signatureOffset = findAscii(bytes, 'AppsMFC');
            if (signatureOffset < 0 || signatureOffset + 18 >= bytes.length) return new Uint8Array();

            const dataLength = readInt32LE(bytes, signatureOffset + 14);
            let payloadStart = signatureOffset + 18;
            while (payloadStart < bytes.length && bytes[payloadStart] !== 0) payloadStart += 1;
            payloadStart += 1;

            if (!dataLength || payloadStart >= bytes.length) return new Uint8Array();
            const payloadEnd = Math.min(bytes.length, payloadStart + dataLength);
            const payload = bytes.slice(payloadStart, payloadEnd);
            return payload[0] === 5 ? payload : new Uint8Array();
        };

        const dataUrlToBytes = (dataUrl = '') => {
            const base64 = String(dataUrl || '').split(',', 2)[1] || '';
            if (!base64) return new Uint8Array();
            if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(base64, 'base64'));
            const binary = globalThis.atob(base64);
            return Uint8Array.from(binary, char => char.charCodeAt(0));
        };

        const bytesToBase64 = (bytes) => {
            const value = toUint8Array(bytes);
            if (typeof Buffer !== 'undefined') return Buffer.from(value).toString('base64');
            let binary = '';
            for (let index = 0; index < value.length; index += 0x8000) {
                binary += String.fromCharCode(...value.subarray(index, index + 0x8000));
            }
            return globalThis.btoa(binary);
        };

        const collectMathTypeObjectLinks = (documentXml = '') => {
            const links = [];
            String(documentXml || '').replace(/<w:object\b[\s\S]*?<\/w:object>/gi, objectXml => {
                const previewRid = objectXml.match(/<v:imagedata\b[^>]*(?:r:id|o:relid)=["']([^"']+)["']/i)?.[1] || '';
                const oleRid = objectXml.match(/<o:OLEObject\b[^>]*(?:r:id|o:relid)=["']([^"']+)["']/i)?.[1] || '';
                if (previewRid && oleRid) links.push({ previewRid, oleRid });
                return '';
            });
            return links;
        };

        const collectMathTypeMtef = (mediaMap, options = {}) => {
            const entries = mediaMap instanceof Map
                ? [...mediaMap.entries()]
                : Object.entries(mediaMap || {});
            const equationsById = new Map();
            const diagnostics = [];

            for (const [rid, media] of entries) {
                if (String(media?.ext || '').toLowerCase() !== 'wmf') continue;
                const mtef = extractMtefFromWmf(dataUrlToBytes(media?.url || ''));
                if (!mtef.length) {
                    diagnostics.push({ rid, code: 'WMF_MTEF_NOT_FOUND', target: media?.target || '' });
                    continue;
                }
                equationsById.set(String(rid), { id: String(rid), mtefBase64: bytesToBase64(mtef), source: 'wmf-preview' });
            }

            for (const link of options.objectLinks || []) {
                const media = mediaMap instanceof Map ? mediaMap.get(link.oleRid) : mediaMap?.[link.oleRid];
                if (!media?.url || !oleReader?.extractMtefFromOle) continue;
                try {
                    const mtef = oleReader.extractMtefFromOle(dataUrlToBytes(media.url));
                    if (mtef.length) {
                        equationsById.set(String(link.previewRid), {
                            id: String(link.previewRid),
                            mtefBase64: bytesToBase64(mtef),
                            source: 'ole-equation-native',
                            oleRid: String(link.oleRid)
                        });
                    } else {
                        diagnostics.push({ rid: link.previewRid, oleRid: link.oleRid, code: 'OLE_MTEF_NOT_FOUND' });
                    }
                } catch (error) {
                    diagnostics.push({
                        rid: link.previewRid,
                        oleRid: link.oleRid,
                        code: 'OLE_MTEF_READ_FAILED',
                        message: error?.message || String(error)
                    });
                }
            }

            return { equations: [...equationsById.values()], diagnostics };
        };

        const translateMathTypeMedia = async (mediaMap, options = {}) => {
            const collected = collectMathTypeMtef(mediaMap, options);
            const mathByRid = new Map();
            if (!collected.equations.length) {
                return { mathByRid, diagnostics: collected.diagnostics, requested: 0, translated: 0 };
            }

            const fetchImpl = options.fetchImpl || globalThis.fetch;
            if (typeof fetchImpl !== 'function') {
                return {
                    mathByRid,
                    diagnostics: [...collected.diagnostics, { code: 'MATHTYPE_FETCH_UNAVAILABLE' }],
                    requested: collected.equations.length,
                    translated: 0
                };
            }

            const response = await fetchImpl(options.endpoint || '/api/convert/mathtype-mtef', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ equations: collected.equations })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !Array.isArray(payload?.equations)) {
                const error = new Error(payload?.error || payload?.code || `MathType translation failed (${response.status}).`);
                error.code = payload?.code || 'MATHTYPE_TRANSLATION_FAILED';
                throw error;
            }

            const diagnostics = [...collected.diagnostics];
            const equationById = new Map(collected.equations.map(row => [String(row.id), row]));
            for (const row of payload.equations || []) {
                const normalized = normalizeLatexFragment(row?.latex || '');
                if (row?.ok && normalized.ok) {
                    mathByRid.set(String(row.id), normalized.latex);
                } else {
                    const source = equationById.get(String(row?.id || ''));
                    const mtef = source ? dataUrlToBytes(`data:application/octet-stream;base64,${source.mtefBase64}`) : new Uint8Array();
                    const fallback = mtefReader?.mtefToLatex?.(mtef) || { ok: false, code: 'MTEF_FALLBACK_UNAVAILABLE' };
                    const fallbackNormalized = fallback.ok ? normalizeLatexFragment(fallback.latex) : fallback;
                    if (fallback.ok && fallbackNormalized.ok) {
                        mathByRid.set(String(row.id), fallbackNormalized.latex);
                        diagnostics.push({ rid: String(row.id), code: 'MATHTYPE_MTEF_FALLBACK_USED' });
                        continue;
                    }
                    diagnostics.push({
                        rid: String(row?.id || ''),
                        code: normalized.ok ? (row?.code || 'MATHTYPE_TRANSLATION_FAILED') : normalized.code,
                        fallbackCode: fallbackNormalized.code,
                        fallbackDiagnostics: fallback.diagnostics || []
                    });
                }
            }

            return {
                mathByRid,
                diagnostics,
                requested: collected.equations.length,
                translated: mathByRid.size
            };
        };

        const mapValue = (map, key) => map instanceof Map ? map.get(key) : map?.[key];

        const stableHash = (value = '') => {
            let hash = 2166136261;
            const source = String(value || '');
            for (let index = 0; index < source.length; index += 1) {
                hash ^= source.charCodeAt(index);
                hash = Math.imul(hash, 16777619);
            }
            return (hash >>> 0).toString(16).padStart(8, '0');
        };

        const extractRid = (xml = '') => String(xml || '').match(/(?:r:embed|r:id|o:relid)=["']([^"']+)["']/)?.[1] || '';

        const extractDimensions = (xml = '') => {
            const extent = String(xml || '').match(/<(?:wp:)?extent\b[^>]*\bcx=["'](\d+)["'][^>]*\bcy=["'](\d+)["']/i);
            return extent ? { cx: Number(extent[1]), cy: Number(extent[2]) } : null;
        };

        const createImageRun = (xml, context, paragraphIndex, runIndex) => {
            const rid = extractRid(xml);
            const media = mapValue(context.mediaMap, rid) || {};
            const anchorType = /<(?:wp:)?anchor\b/i.test(xml) ? 'anchor' : 'inline';
            const assetId = `${context.fileId || 'docx'}:p${paragraphIndex}:r${runIndex}:${rid || 'missing'}`;
            const asset = {
                assetId,
                rid,
                target: media.target || media.mediaPath || '',
                mediaPath: media.mediaPath || media.target || '',
                relationshipType: media.type || media.relationshipType || 'image',
                ext: media.ext || '',
                mime: media.mime || '',
                url: media.url || '',
                anchorType,
                dimensions: extractDimensions(xml),
                paragraphIndex,
                runIndex,
                contentHash: stableHash(media.url || media.target || `${rid}:${paragraphIndex}:${runIndex}`)
            };
            return { kind: 'image', assetId, token: `[[IMAGE:${assetId}]]`, paragraphIndex, asset };
        };

        const tokenPattern = () => /<m:oMathPara\b[\s\S]*?<\/m:oMathPara>|<m:oMath\b[\s\S]*?<\/m:oMath>|<w:object\b[\s\S]*?<\/w:object>|<w:drawing\b[\s\S]*?<\/w:drawing>|<w:pict\b[\s\S]*?<\/w:pict>|<w:t\b[^>]*>[\s\S]*?<\/w:t>|<w:tab\b[^>]*\/?\s*>|<w:br\b[^>]*\/?\s*>/gi;

        const tokenToRun = (token, context, paragraphIndex, runIndex, diagnostics) => {
            if (/^<w:t\b/i.test(token)) {
                const text = token.replace(/^<w:t\b[^>]*>/i, '').replace(/<\/w:t>$/i, '');
                return { kind: 'text', text: decodeXmlEntities(text), paragraphIndex };
            }
            if (/^<w:tab\b/i.test(token)) return { kind: 'tab', paragraphIndex };
            if (/^<w:br\b/i.test(token)) return { kind: 'break', breakType: /w:type=["']page["']/i.test(token) ? 'page' : 'line', paragraphIndex };
            if (/^<m:oMath/i.test(token)) {
                const latex = ommlToLatexBody(token);
                if (!latex) diagnostics.push({ kind: 'formula-error', code: 'OMML_TRANSLATION_FAILED', paragraphIndex, runIndex });
                return { kind: 'math', latex, rawSource: token, sourceType: 'omml', paragraphIndex };
            }
            if (/^<w:object/i.test(token)) {
                const previewRid = token.match(/<v:imagedata\b[^>]*(?:r:id|o:relid)=["']([^"']+)["']/i)?.[1] || extractRid(token);
                const latex = mapValue(context.mathByRid, previewRid) || '';
                if (!latex) diagnostics.push({ kind: 'formula-error', code: 'MATHTYPE_TRANSLATION_MISSING', rid: previewRid, paragraphIndex, runIndex });
                return { kind: 'math', latex, rawSource: token, sourceType: 'mathtype', previewRid, paragraphIndex };
            }
            return createImageRun(token, context, paragraphIndex, runIndex);
        };

        const extractParagraphRuns = (xml, context, paragraphIndex) => {
            const runs = [];
            const assets = [];
            const diagnostics = [];
            let match;
            const pattern = tokenPattern();
            while ((match = pattern.exec(xml)) !== null) {
                const run = tokenToRun(match[0], context, paragraphIndex, runs.length, diagnostics);
                runs.push(run);
                if (run.asset) {
                    assets.push(run.asset);
                    delete run.asset;
                }
            }
            return { runs, assets, diagnostics };
        };

        const extractParagraphMetadata = (xml = '') => ({
            style: String(xml).match(/<w:pStyle\b[^>]*w:val=["']([^"']+)["']/i)?.[1] || '',
            numbering: {
                numId: String(xml).match(/<w:numId\b[^>]*w:val=["']([^"']+)["']/i)?.[1] || '',
                level: String(xml).match(/<w:ilvl\b[^>]*w:val=["']([^"']+)["']/i)?.[1] || ''
            },
            pageBreak: /<w:br\b[^>]*w:type=["']page["']/i.test(xml),
            sectionBreak: /<w:sectPr\b/i.test(xml)
        });

        const extractDocxRichBlocks = (documentXml = '', options = {}) => {
            const context = {
                fileId: options.fileId || 'docx',
                mediaMap: options.mediaMap || new Map(),
                mathByRid: options.mathByRid || new Map()
            };
            const paragraphs = String(documentXml || '').match(/<w:p\b[\s\S]*?<\/w:p>/gi) || [];
            return paragraphs.map((xml, paragraphIndex) => {
                const extracted = extractParagraphRuns(xml, context, paragraphIndex);
                const diagnostics = [...extracted.diagnostics];
                return {
                    kind: 'paragraph',
                    paragraphIndex,
                    ...extractParagraphMetadata(xml),
                    runs: extracted.runs,
                    assets: extracted.assets,
                    diagnostics,
                    serialized: serializeRichRuns(extracted.runs, diagnostics),
                    sourceXmlHash: stableHash(xml)
                };
            });
        };

        const sectionHeading = (value = '') => {
            const source = String(value || '').replace(/\s+/g, ' ').trim();
            const match = source.match(/^(?:[一二三四五六七八九十百]+|\d+)\s*[、.．]\s*([^：:]*?(?:单项选择题|单选题|多项选择题|多选题|填空题|解答题|简答题|判断题))(?=\s*(?:[（(：:]|$))/);
            if (!match) return null;
            const label = match[1];
            let type = '未知题型';
            if (/单项选择题|单选题/.test(label)) type = '单选题';
            else if (/多项选择题|多选题/.test(label)) type = '多选题';
            else if (/填空题/.test(label)) type = '填空题';
            else if (/解答题|简答题/.test(label)) type = '解答题';
            else if (/判断题/.test(label)) type = '判断题';
            return { label, type };
        };

        const splitOptions = (value = '') => {
            const source = String(value || '');
            const regex = /(^|[\s　])([A-D])\s*[.．、:：]\s*/g;
            const markers = [];
            let match;
            while ((match = regex.exec(source)) !== null) {
                markers.push({ label: match[2], start: match.index + match[1].length, contentStart: regex.lastIndex });
            }
            if (!markers.length) return null;
            return {
                before: source.slice(0, markers[0].start).trim(),
                options: markers.map((marker, index) => ({
                    label: marker.label,
                    value: source.slice(marker.contentStart, markers[index + 1]?.start ?? source.length).trim()
                }))
            };
        };

        const appendText = (current, value) => [current, String(value || '').trim()].filter(Boolean).join('\n');

        const consumeQuestionContent = (question, value) => {
            const split = splitOptions(value);
            if (split) {
                if (split.before) question.stem = appendText(question.stem, split.before);
                for (const option of split.options) {
                    question.optionMap[option.label] = appendText(question.optionMap[option.label], option.value);
                    question.currentOption = option.label;
                }
                return;
            }
            if (question.currentOption) question.optionMap[question.currentOption] = appendText(question.optionMap[question.currentOption], value);
            else question.stem = appendText(question.stem, value);
        };

        const finishQuestion = (question, questions) => {
            if (!question) return;
            const options = ['A', 'B', 'C', 'D'].map(label => question.optionMap[label] || '');
            while (options.length && !options[options.length - 1]) options.pop();
            questions.push({
                questionKey: `section-${question.sectionIndex}/q-${question.number}`,
                sectionIndex: question.sectionIndex,
                number: question.number,
                type: question.type,
                stem: question.stem.trim(),
                options,
                optionMap: { ...question.optionMap },
                richBlocks: question.richBlocks,
                assets: question.richBlocks.flatMap(block => block.assets || []),
                diagnostics: question.richBlocks.flatMap(block => block.diagnostics || []),
                sourceParagraphRange: [question.startParagraph, question.endParagraph]
            });
        };

        const parseQuestionRichBlocks = (blocks = []) => {
            const questions = [];
            const diagnostics = [];
            let sectionIndex = 0;
            let type = '未知题型';
            let current = null;
            for (const block of blocks || []) {
                const value = String(block?.serialized || '').trim();
                const heading = sectionHeading(value);
                if (heading) {
                    finishQuestion(current, questions);
                    current = null;
                    sectionIndex += 1;
                    type = heading.type;
                    continue;
                }
                const marker = value.match(/^\s*(\d+)\s*[.．、]\s*([\s\S]*)$/);
                if (marker) {
                    finishQuestion(current, questions);
                    if (!sectionIndex) sectionIndex = 1;
                    current = {
                        sectionIndex,
                        type,
                        number: Number(marker[1]),
                        stem: '',
                        optionMap: {},
                        currentOption: '',
                        richBlocks: [block],
                        startParagraph: block.paragraphIndex,
                        endParagraph: block.paragraphIndex
                    };
                    consumeQuestionContent(current, marker[2]);
                    continue;
                }
                if (!current || !value) continue;
                current.richBlocks.push(block);
                current.endParagraph = block.paragraphIndex;
                consumeQuestionContent(current, value);
            }
            finishQuestion(current, questions);
            const duplicate = questions.find((question, index) => questions.findIndex(row => row.questionKey === question.questionKey) !== index);
            if (duplicate) diagnostics.push({ code: 'DUPLICATE_QUESTION_KEY', questionKey: duplicate.questionKey });
            return { questions, diagnostics, ok: diagnostics.length === 0 };
        };

        return {
            canonicalizeMathCommands,
            collectMathTypeMtef,
            collectMathTypeObjectLinks,
            decodeXmlEntities,
            extractDocxRichBlocks,
            extractMtefFromWmf,
            normalizeLatexFragment,
            ommlToLatexBody,
            parseQuestionRichBlocks,
            serializeRichRuns,
            stripOnlyOuterMathDelimiters,
            translateMathTypeMedia,
            validateLatexBalance
        };
    }
);
