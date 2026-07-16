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

        const latexContent = root?.Qisi?.DocxLatexContent || (
            typeof require === 'function' ? require('./qisi-docx-latex-content.js') : null
        );
        if (!latexContent) throw new Error('Qisi.DocxLatexContent is required.');
        const tableLatex = root?.Qisi?.DocxTableLatex || (
            typeof require === 'function' ? require('./qisi-docx-table-latex.js') : null
        );
        if (!tableLatex) throw new Error('Qisi.DocxTableLatex is required.');
        const docxLayout = root?.Qisi?.DocxLayout || (
            typeof require === 'function' ? require('./qisi-docx-layout.js') : null
        );
        if (!docxLayout) throw new Error('Qisi.DocxLayout is required.');
        const {
            canonicalizeMathCommands,
            decodeXmlEntities,
            normalizeLatexFragment,
            serializeRichRuns,
            stripOnlyOuterMathDelimiters,
            validateLatexBalance
        } = latexContent;
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

        const requestMathTypeTranslations = async (equations = [], options = {}) => {
            const rows = Array.isArray(equations) ? equations : [];
            if (!rows.length) return [];
            const fetchImpl = options.fetchImpl || globalThis.fetch;
            if (typeof fetchImpl !== 'function') {
                const error = new Error('MathType translation fetch is unavailable.');
                error.code = 'MATHTYPE_FETCH_UNAVAILABLE';
                throw error;
            }
            const configuredSize = Number(options.batchSize);
            const batchSize = Number.isInteger(configuredSize) && configuredSize > 0
                ? Math.min(512, configuredSize)
                : 512;
            const translated = [];

            for (let offset = 0; offset < rows.length; offset += batchSize) {
                const batch = rows.slice(offset, offset + batchSize);
                const response = await fetchImpl(options.endpoint || '/api/convert/mathtype-mtef', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ equations: batch })
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || !Array.isArray(payload?.equations)) {
                    const error = new Error(payload?.error || payload?.code || `MathType translation failed (${response.status}).`);
                    error.code = payload?.code || 'MATHTYPE_TRANSLATION_FAILED';
                    error.batchIndex = Math.floor(offset / batchSize);
                    error.batchOffset = offset;
                    error.batchLength = batch.length;
                    throw error;
                }
                translated.push(...payload.equations);
            }

            return translated;
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

            const translatedRows = await requestMathTypeTranslations(collected.equations, {
                ...options,
                fetchImpl
            });

            const diagnostics = [...collected.diagnostics];
            const equationById = new Map(collected.equations.map(row => [String(row.id), row]));
            for (const row of translatedRows) {
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

        const readWordVal = (xml = '', tag = '') => String(xml || '').match(
            new RegExp(`<w:${tag}\\b[^>]*w:val=["']([^"']+)["']`, 'i')
        )?.[1] || '';

        const formatAlphabeticNumber = (value, upper = true) => {
            let cursor = Number(value);
            if (!Number.isInteger(cursor) || cursor <= 0) return '';
            let result = '';
            while (cursor > 0) {
                cursor -= 1;
                result = String.fromCharCode(65 + (cursor % 26)) + result;
                cursor = Math.floor(cursor / 26);
            }
            return upper ? result : result.toLowerCase();
        };

        const formatRomanNumber = (value, upper = true) => {
            let cursor = Number(value);
            if (!Number.isInteger(cursor) || cursor <= 0 || cursor >= 4000) return '';
            const symbols = [
                [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
                [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
                [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
            ];
            let result = '';
            for (const [unit, symbol] of symbols) {
                while (cursor >= unit) {
                    result += symbol;
                    cursor -= unit;
                }
            }
            return upper ? result : result.toLowerCase();
        };

        const formatNumberingValue = (value, numFmt = '') => ({
            decimal: String(value),
            upperLetter: formatAlphabeticNumber(value, true),
            lowerLetter: formatAlphabeticNumber(value, false),
            upperRoman: formatRomanNumber(value, true),
            lowerRoman: formatRomanNumber(value, false)
        }[numFmt] || '');

        const createDocxNumberingResolver = (numberingXml = '') => {
            const abstractLevels = new Map();
            const numDefinitions = new Map();
            const counters = new Map();

            String(numberingXml || '').replace(
                /<w:abstractNum\b([^>]*)>([\s\S]*?)<\/w:abstractNum>/gi,
                (_, attrs, body) => {
                    const abstractId = attrs.match(/w:abstractNumId=["']([^"']+)["']/i)?.[1] || '';
                    const levels = new Map();
                    String(body || '').replace(/<w:lvl\b([^>]*)>([\s\S]*?)<\/w:lvl>/gi, (__, levelAttrs, levelBody) => {
                        const level = Number(levelAttrs.match(/w:ilvl=["'](\d+)["']/i)?.[1] || 0);
                        levels.set(level, {
                            start: Number(readWordVal(levelBody, 'start') || 1),
                            numFmt: readWordVal(levelBody, 'numFmt'),
                            lvlText: readWordVal(levelBody, 'lvlText') || `%${level + 1}.`
                        });
                        return '';
                    });
                    if (abstractId) abstractLevels.set(abstractId, levels);
                    return '';
                }
            );

            String(numberingXml || '').replace(/<w:num\b([^>]*)>([\s\S]*?)<\/w:num>/gi, (_, attrs, body) => {
                const numId = attrs.match(/w:numId=["']([^"']+)["']/i)?.[1] || '';
                const abstractId = readWordVal(body, 'abstractNumId');
                const overrides = new Map();
                String(body || '').replace(/<w:lvlOverride\b([^>]*)>([\s\S]*?)<\/w:lvlOverride>/gi, (__, levelAttrs, levelBody) => {
                    const level = Number(levelAttrs.match(/w:ilvl=["'](\d+)["']/i)?.[1] || 0);
                    const start = Number(readWordVal(levelBody, 'startOverride'));
                    if (Number.isInteger(start) && start > 0) overrides.set(level, start);
                    return '';
                });
                if (numId && abstractId) numDefinitions.set(numId, { abstractId, overrides });
                return '';
            });

            return (paragraphXml = '') => {
                const numPr = String(paragraphXml || '').match(/<w:numPr\b[\s\S]*?<\/w:numPr>/i)?.[0] || '';
                const numId = readWordVal(numPr, 'numId');
                const level = Number(readWordVal(numPr, 'ilvl') || 0);
                if (!numId) return null;

                const definition = numDefinitions.get(numId);
                const levelDefinition = abstractLevels.get(definition?.abstractId)?.get(level);
                if (!definition || !levelDefinition) return { numId, level, display: '', value: null };

                const key = `${numId}:${level}`;
                const start = definition.overrides.get(level) || levelDefinition.start || 1;
                const value = counters.has(key) ? counters.get(key) + 1 : start;
                counters.set(key, value);
                const display = levelDefinition.lvlText.replace(/%(\d+)/g, (match, number) => {
                    const referencedLevel = Number(number) - 1;
                    const referenced = counters.get(`${numId}:${referencedLevel}`);
                    const referencedDefinition = abstractLevels
                        .get(definition.abstractId)
                        ?.get(referencedLevel);
                    const formatted = Number.isInteger(referenced)
                        ? formatNumberingValue(referenced, referencedDefinition?.numFmt || '')
                        : '';
                    return formatted || match;
                });
                const formattedValue = formatNumberingValue(value, levelDefinition.numFmt);
                return {
                    numId,
                    level,
                    numFmt: levelDefinition.numFmt,
                    display: formattedValue ? display : '',
                    value: formattedValue ? value : null
                };
            };
        };

        const extractImageLayout = (xml = '', anchorType = 'inline') => {
            const source = String(xml || '');
            const position = axis => {
                const block = source.match(new RegExp(`<wp:position${axis}\\b[^>]*[\\s\\S]*?<\\/wp:position${axis}>`, 'i'))?.[0] || '';
                return {
                    relativeFrom: block.match(/relativeFrom=["']([^"']+)["']/i)?.[1] || '',
                    align: block.match(/<wp:align>([^<]+)<\/wp:align>/i)?.[1] || '',
                    offsetEmu: Number(block.match(/<wp:posOffset>(-?\d+)<\/wp:posOffset>/i)?.[1]) || 0
                };
            };
            return {
                anchorType,
                dimensions: extractDimensions(source),
                wrapMode: source.match(/<wp:(wrapNone|wrapSquare|wrapTight|wrapThrough|wrapTopAndBottom)\b/i)?.[1] || '',
                behindDocument: /<wp:anchor\b[^>]*behindDoc=["']1["']/i.test(source),
                horizontal: position('H'),
                vertical: position('V')
            };
        };

        const createImageRun = (xml, context, paragraphIndex, runIndex) => {
            const rid = extractRid(xml);
            const media = mapValue(context.mediaMap, rid) || {};
            const anchorType = /<(?:wp:)?anchor\b/i.test(xml) ? 'anchor' : 'inline';
            const layout = extractImageLayout(xml, anchorType);
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
                dimensions: layout.dimensions,
                layout,
                paragraphIndex,
                runIndex,
                contentHash: stableHash(media.url || media.target || `${rid}:${paragraphIndex}:${runIndex}`)
            };
            return { kind: 'image', assetId, token: `[[IMAGE:${assetId}]]`, paragraphIndex, layout, asset };
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

        const extractParagraphMetadata = (xml = '', resolveNumbering = null) => {
            const resolved = typeof resolveNumbering === 'function'
                ? resolveNumbering(xml)
                : null;
            return {
                style: String(xml).match(/<w:pStyle\b[^>]*w:val=["']([^"']+)["']/i)?.[1] || '',
                numbering: resolved || {
                    numId: String(xml).match(/<w:numId\b[^>]*w:val=["']([^"']+)["']/i)?.[1] || '',
                    level: String(xml).match(/<w:ilvl\b[^>]*w:val=["']([^"']+)["']/i)?.[1] || '',
                    display: '',
                    value: null
                },
                pageBreak: /<w:br\b[^>]*w:type=["']page["']/i.test(xml),
                sectionBreak: /<w:sectPr\b/i.test(xml)
            };
        };

        const serializeParagraphWithLayout = (extracted, context, diagnostics = extracted.diagnostics) => docxLayout.serializeParagraphLayout({
            runs: extracted.runs,
            assets: extracted.assets,
            usableWidthTwips: context.usableWidthTwips,
            serializeRuns: runs => serializeRichRuns(runs, diagnostics)
        });

        const serializeTableCellRichContent = (cellXml, context, baseIndex) => {
            const previewParts = [];
            const latexParts = [];
            const assets = [];
            const diagnostics = [];
            const blocks = tableLatex.extractTopLevelWordBlocks(cellXml);

            blocks.forEach((block, childIndex) => {
                const paragraphIndex = baseIndex * 1000 + childIndex;
                if (block.kind === 'paragraph') {
                    const extracted = extractParagraphRuns(block.xml, context, paragraphIndex);
                    const serialized = serializeRichRuns(extracted.runs, extracted.diagnostics);
                    if (serialized) {
                        previewParts.push(serialized);
                        latexParts.push(tableLatex.toLatexCellContent(serialized));
                    }
                    assets.push(...extracted.assets);
                    diagnostics.push(...extracted.diagnostics);
                    return;
                }

                const nested = tableLatex.convertWordTableToLatex(block.xml, {
                    usableWidthTwips: context.usableWidthTwips,
                    serializeCell: (nestedCellXml, location) => serializeTableCellRichContent(
                        nestedCellXml,
                        context,
                        paragraphIndex * 100 + Number(location?.cellIndex || 0)
                    )
                });
                previewParts.push(nested.latex);
                latexParts.push(nested.latex);
                assets.push(...nested.assets);
                diagnostics.push(...nested.diagnostics);
            });

            return {
                previewContent: previewParts.join('\n').trim(),
                latexContent: latexParts.join('\n').trim(),
                assets,
                diagnostics
            };
        };

        const extractDocxRichBlocks = (documentXml = '', options = {}) => {
            const context = {
                fileId: options.fileId || 'docx',
                mediaMap: options.mediaMap || new Map(),
                mathByRid: options.mathByRid || new Map(),
                usableWidthTwips: tableLatex.resolveUsableWidthTwips(documentXml)
            };
            const resolveNumbering = createDocxNumberingResolver(options.numberingXml || '');
            const flowBlocks = tableLatex.extractTopLevelWordBlocks(documentXml);
            return flowBlocks.map((flowBlock, paragraphIndex) => {
                if (flowBlock.kind === 'table') {
                    const converted = tableLatex.convertWordTableToLatex(flowBlock.xml, {
                        usableWidthTwips: context.usableWidthTwips,
                        serializeCell: (cellXml, location) => serializeTableCellRichContent(
                            cellXml,
                            context,
                            paragraphIndex * 100 + Number(location?.cellIndex || 0)
                        )
                    });
                    return {
                        kind: 'table',
                        paragraphIndex,
                        style: '',
                        numbering: null,
                        pageBreak: false,
                        sectionBreak: false,
                        runs: [{ kind: 'latex-table', latex: converted.latex, paragraphIndex }],
                        assets: converted.assets,
                        diagnostics: converted.diagnostics,
                        serialized: converted.latex,
                        tableModel: converted.model,
                        sourceXmlHash: stableHash(flowBlock.xml)
                    };
                }

                const xml = flowBlock.xml;
                const extracted = extractParagraphRuns(xml, context, paragraphIndex);
                const diagnostics = [...extracted.diagnostics];
                return {
                    kind: 'paragraph',
                    paragraphIndex,
                    ...extractParagraphMetadata(xml, resolveNumbering),
                    runs: extracted.runs,
                    assets: extracted.assets,
                    diagnostics,
                    serialized: serializeParagraphWithLayout(extracted, context, diagnostics),
                    sourceXmlHash: stableHash(xml)
                };
            });
        };

        const questionStructure = root?.Qisi?.DocxQuestionStructure || (
            typeof require === 'function' ? require('./qisi-docx-question-structure.js') : null
        );
        if (!questionStructure) throw new Error('Qisi.DocxQuestionStructure is required.');
        const { parseQuestionRichBlocks } = questionStructure;
        return {
            canonicalizeMathCommands,
            createDocxNumberingResolver,
            collectMathTypeMtef,
            collectMathTypeObjectLinks,
            decodeXmlEntities,
            extractDocxRichBlocks,
            extractTopLevelWordBlocks: tableLatex.extractTopLevelWordBlocks,
            extractMtefFromWmf,
            normalizeLatexFragment,
            ommlToLatexBody,
            parseQuestionRichBlocks,
            requestMathTypeTranslations,
            serializeRichRuns,
            stripOnlyOuterMathDelimiters,
            translateMathTypeMedia,
            validateLatexBalance
        };
    }
);
