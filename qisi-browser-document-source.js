(function initBrowserDocumentSource(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.BrowserDocumentSource = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    function createBrowserDocumentSource(ports = {}) {
        const requiredFunctions = [
            'makeBatchId',
            'dataUrlToBlob',
            'resolveFormulaImageTokens',
            'blockImageToken'
        ];
        for (const name of requiredFunctions) {
            if (typeof ports[name] !== 'function') {
                const error = new TypeError(
                    `Browser document source requires ${name}.`
                );
                error.code = 'BROWSER_DOCUMENT_SOURCE_PORT_REQUIRED';
                throw error;
            }
        }

        const makeBatchId = ports.makeBatchId;
        const dataUrlToBlob = ports.dataUrlToBlob;
        const resolveFormulaImageTokens = ports.resolveFormulaImageTokens;
        const BLOCK_IMAGE_TOKEN = ports.blockImageToken;
        const PDF_PROCESS_CONFIG = ports.pdfProcessConfig || {};
        const docxEmbeddedImageCache =
            ports.docxEmbeddedImageCache || new Map();
        const draftFileTextCache =
            ports.draftFileTextCache || new Map();
        const draftFileXmlCache =
            ports.draftFileXmlCache || new Map();
        const draftFileRidImageUrlMapCache =
            ports.draftFileRidImageUrlMapCache || new Map();
        const draftFileRidImageMetaMapCache =
            ports.draftFileRidImageMetaMapCache || new Map();

        const xmlText = (xml) => String(xml || '')
            .replace(/<w:tab\/>/g, ' ')
            .replace(/<\/w:p>/g, '\n')
            .replace(/<\/w:tr>/g, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        const normalizeDocxExtractedText = (text = '') => {
            return String(text || '')
                .replace(/\r/g, '\n')
                .replace(/[ \t]+/g, ' ')
                .replace(/\n[ \t]+/g, '\n')
                .replace(/[ \t]+\n/g, '\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        };


        const normalizeDocxOptionCellText = (text = '') => {
            return root.Qisi.Utils.cleanRecognizedText(String(text || '')
                .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                .replace(/^[A-D]\s*[.．、:：)）]\s*/i, '')
                .replace(/\s+/g, ' ')
                .trim()
            );
        };

        const getExtensionFromPath = (path = '') => {
            const match = String(path || '').match(/\.([a-zA-Z0-9]+)$/);
            return match ? match[1].toLowerCase() : '';
        };

        const isBrowserDisplayableImageExt = (ext = '') =>
            /^(png|jpg|jpeg|gif|webp|svg)$/i.test(String(ext || ''));

        const readDocxMediaAsDataUrl = async (zip, targetPath = '') => {
            const normalized = String(targetPath || '').replace(/^\/+/, '');
            const file = zip.file(normalized);
            if (!file) return '';

            const blob = await file.async('blob');
            const mime = root.Qisi.DocxPipeline.mimeFromDocxMediaPath(normalized);

            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(reader.error || new Error('读取 DOCX 媒体失败'));
                reader.readAsDataURL(new Blob([blob], { type: mime }));
            });
        };

        const buildDocxMediaMaps = async (zip, relsXml = '', filename = '') => {
            const relMap = root.Qisi.DocxPipeline.parseDocxRelationshipMap(relsXml);
            const ridImageUrlMap = new Map();
            const ridImageMetaMap = new Map();

            for (const [rid, rel] of relMap.entries()) {
                if (!rel?.target) continue;

                const isImage =
                    /\/image/i.test(rel.type || '') ||
                    /\.(png|jpe?g|gif|bmp|webp|svg|emf|wmf)$/i.test(rel.target || '');

                if (!isImage) continue;

                const ext = getExtensionFromPath(rel.target);
                const mime = root.Qisi.DocxPipeline.mimeFromDocxMediaPath(rel.target);
                const displayable = isBrowserDisplayableImageExt(ext);
                const id = makeBatchId('dimg');

                let dataUrl = '';
                try {
                    dataUrl = await readDocxMediaAsDataUrl(zip, rel.target);
                } catch (error) {
                    console.warn('[BATCH_DEBUG][docx-media-read-failed]', {
                        filename,
                        rid,
                        target: rel.target,
                        ext,
                        mime,
                        message: error?.message || String(error)
                    });
                }

                ridImageUrlMap.set(rid, dataUrl);
                ridImageMetaMap.set(rid, {
                    id,
                    rid,
                    target: rel.target,
                    filename: rel.target.split('/').pop() || `${id}.${ext || 'bin'}`,
                    ext,
                    mime,
                    displayable,
                    hasUrl: Boolean(dataUrl)
                });

                console.log('[BATCH_DEBUG][docx-media-item]', {
                    filename,
                    rid,
                    target: rel.target,
                    ext,
                    mime,
                    displayable,
                    hasUrl: Boolean(dataUrl),
                    dataUrlHead: String(dataUrl || '').slice(0, 60)
                });
            }

            console.groupCollapsed('[BATCH_DEBUG][docx-media-map]');
            console.log('filename =', filename);
            console.log('relsCount =', relMap.size);
            console.log('imageCount =', ridImageUrlMap.size);
            console.table([...ridImageMetaMap.values()].slice(0, 80));
            console.groupEnd();

            return { relMap, ridImageUrlMap, ridImageMetaMap };
        };

        const extractDocxTextNodesOnly = (documentXml = '') => {
            const nodes = [];
            String(documentXml || '').replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, (_, text) => {
                const clean = root.Qisi.DocxPipeline.decodeXmlEntitiesSafe(text).trim();
                if (clean) nodes.push(clean);
                return '';
            });
            return nodes.join('\n');
        };

        const ommlChildren = (node, localName) => Array.from(node?.childNodes || [])
            .filter(child => child.nodeType === 1 && child.localName === localName);

        const ommlFirst = (node, localName) => ommlChildren(node, localName)[0] || null;

        const ommlText = (node) => {
            if (!node) return '';
            if (node.nodeType === 3) return node.nodeValue || '';
            if (node.nodeType !== 1) return '';
            const name = node.localName;
            if (name === 't') return node.textContent || '';
            if (name === 'r') return Array.from(node.childNodes).map(ommlText).join('');
            if (name === 'f') {
                const num = ommlText(ommlFirst(node, 'num'));
                const den = ommlText(ommlFirst(node, 'den'));
                return `\\frac{${num}}{${den}}`;
            }
            if (name === 'sSup') return `${ommlText(ommlFirst(node, 'e'))}^{${ommlText(ommlFirst(node, 'sup'))}}`;
            if (name === 'sSub') return `${ommlText(ommlFirst(node, 'e'))}_{${ommlText(ommlFirst(node, 'sub'))}}`;
            if (name === 'sSubSup') return `${ommlText(ommlFirst(node, 'e'))}_{${ommlText(ommlFirst(node, 'sub'))}}^{${ommlText(ommlFirst(node, 'sup'))}}`;
            if (name === 'rad') {
                const deg = ommlText(ommlFirst(node, 'deg'));
                const body = ommlText(ommlFirst(node, 'e'));
                return deg ? `\\sqrt[${deg}]{${body}}` : `\\sqrt{${body}}`;
            }
            if (name === 'd') {
                const body = ommlText(ommlFirst(node, 'e'));
                const pr = ommlFirst(node, 'dPr');
                const beg = pr?.getElementsByTagName?.('m:begChr')?.[0]?.getAttribute('m:val') || '(';
                const end = pr?.getElementsByTagName?.('m:endChr')?.[0]?.getAttribute('m:val') || ')';
                return `\\left${beg}${body}\\right${end}`;
            }
            if (name === 'nary') {
                const pr = ommlFirst(node, 'naryPr');
                const chr = pr?.getElementsByTagName?.('m:chr')?.[0]?.getAttribute('m:val') || '\\sum';
                const sub = ommlText(ommlFirst(node, 'sub'));
                const sup = ommlText(ommlFirst(node, 'sup'));
                const body = ommlText(ommlFirst(node, 'e'));
                return `${chr}${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''}${body}`;
            }
            if (name === 'bar') return `\\overline{${ommlText(ommlFirst(node, 'e'))}}`;
            if (['num', 'den', 'e', 'sub', 'sup', 'deg', 'oMath', 'oMathPara'].includes(name)) {
                return Array.from(node.childNodes).map(ommlText).join('');
            }
            return Array.from(node.childNodes).map(ommlText).join('');
        };

        const ommlToLatex = (xml) => {
            try {
                const wrapped = `<root xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${xml}</root>`;
                const doc = new DOMParser().parseFromString(wrapped, 'application/xml');
                const root = doc.documentElement;
                const latex = ommlText(root).replace(/\s+/g, ' ').trim();
                return latex ? `$${latex}$` : '';
            } catch (error) {
                console.warn('OMML 公式转换失败', error);
                return '';
            }
        };

        const extractDocxImageTokensFromXml = (xml = '', imageRefsByRid = {}) => {
            const tokens = [];
            const seen = new Set();
            String(xml || '').replace(/(?:r:embed|r:link|r:id|o:relid)=["']([^"']+)["']/g, (_, rid) => {
                const ref = imageRefsByRid?.[rid];
                if (!ref?.id || seen.has(ref.id)) return '';
                if (ref.displayable === false) return '';
                seen.add(ref.id);
                tokens.push(BLOCK_IMAGE_TOKEN(ref.id));
                return '';
            });
            return tokens;
        };

        const extractDocxTextWithMath = (xml, imageRefsByRid = {}) => {
            const source = String(xml || '');
            if (!source) return '';

            const body = source.match(/<w:body[\s\S]*?>([\s\S]*?)<\/w:body>/)?.[1] || source;
            const paragraphs = [];

            body.replace(/<w:p[\s\S]*?>([\s\S]*?)<\/w:p>/g, (_, paragraph) => {
                const mathTokens = [];

                const withMathTokens = paragraph.replace(
                    /<m:oMathPara[\s\S]*?<\/m:oMathPara>|<m:oMath[\s\S]*?<\/m:oMath>/g,
                    (mathXml) => {
                        const token = `__MATH_TOKEN_${mathTokens.length}__`;
                        mathTokens.push(ommlToLatex(mathXml));
                        return token;
                    }
                );

                const parts = [];

                withMathTokens.replace(
                    /__MATH_TOKEN_(\d+)__|<w:drawing[\s\S]*?<\/w:drawing>|<w:pict[\s\S]*?<\/w:pict>|<w:object[\s\S]*?<\/w:object>|<(?:w:t|m:t|w:instrText|w:delText)[^>]*>([\s\S]*?)<\/(?:w:t|m:t|w:instrText|w:delText)>|<w:tab\/>|<w:br\/>|<m:chr[^>]*m:val="([^"]+)"[^>]*\/>/g,
                    (m, tokenIndex, textNode, mathChar) => {
                        if (m.startsWith('<w:tab')) {
                            parts.push(' ');
                        } else if (m.startsWith('<w:br')) {
                            parts.push('\n');
                        } else if (tokenIndex !== undefined) {
                            parts.push(mathTokens[Number(tokenIndex)] || '');
                        } else if (mathChar) {
                            parts.push(mathChar);
                        } else if (m.startsWith('<w:drawing') || m.startsWith('<w:pict') || m.startsWith('<w:object')) {
                            if (/<w:txbxContent[\s\S]*?>/.test(m)) {
                                const textBoxText = extractDocxTextWithMath(m, imageRefsByRid);
                                if (textBoxText) parts.push(`\n${textBoxText}\n`);
                            }

                            const imageTokens = extractDocxImageTokensFromXml(m, imageRefsByRid);
                            if (imageTokens.length) {
                                parts.push(` ${imageTokens.join(' ')} `);
                            }
                        } else {
                            parts.push(textNode || '');
                        }

                        return '';
                    }
                );

                const text = normalizeDocxExtractedText(parts.join(''));
                if (text) paragraphs.push(text);

                return '';
            });

            return normalizeDocxExtractedText(paragraphs.join('\n'));
        };

        const extractPdfTextWithPdfJs = async (file) => {
            if (!root.pdfjsLib) return '';

            root.pdfjsLib.GlobalWorkerOptions.workerSrc =
                root.pdfjsLib.GlobalWorkerOptions.workerSrc ||
                'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

            const buffer = await (await dataUrlToBlob(file.uploadPath)).arrayBuffer();
            const pdf = await root.pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
            const pages = root.Qisi.Utils.expandPageRange(file.pageRange, pdf.numPages);
            const pageTexts = [];

            for (const pageNo of pages) {
                const page = await pdf.getPage(pageNo);
                const content = await page.getTextContent();
                const items = (content.items || [])
                    .map(item => {
                        const t = item.transform || [1, 0, 0, 1, 0, 0];
                        return {
                            str: item.str || '',
                            x: t[4] || 0,
                            y: t[5] || 0
                        };
                    })
                    .filter(item => item.str.trim());

                items.sort((a, b) => {
                    if (Math.abs(b.y - a.y) > 4) return b.y - a.y;
                    return a.x - b.x;
                });

                const lines = [];
                let current = [];
                let lastY = null;

                for (const item of items) {
                    if (lastY === null || Math.abs(item.y - lastY) <= 4) {
                        current.push(item);
                    } else {
                        lines.push(current);
                        current = [item];
                    }
                    lastY = item.y;
                }

                if (current.length) lines.push(current);

                pageTexts.push(
                    lines
                        .map(line => line.sort((a, b) => a.x - b.x).map(x => x.str).join(' '))
                        .join('\n')
                );
            }

            return pageTexts.join('\n\n');
        };

        const extractPdfLayoutWithPdfJs = async (file) => {
            if (!root.pdfjsLib) return [];

            root.pdfjsLib.GlobalWorkerOptions.workerSrc =
                root.pdfjsLib.GlobalWorkerOptions.workerSrc ||
                'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

            const buffer = await (await dataUrlToBlob(file.uploadPath)).arrayBuffer();
            const pdf = await root.pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
            const pages = root.Qisi.Utils.expandPageRange(file.pageRange, pdf.numPages);
            const layouts = [];

            for (const pageNo of pages) {
                const page = await pdf.getPage(pageNo);
                const viewport = page.getViewport({ scale: PDF_PROCESS_CONFIG.renderScale || 2 });
                const content = await page.getTextContent();

                const items = (content.items || [])
                    .map(item => {
                        const str = String(item.str || '').trim();
                        if (!str) return null;

                        const t = root.pdfjsLib.Util.transform(viewport.transform, item.transform || [1, 0, 0, 1, 0, 0]);
                        const x = t[4] || 0;
                        const y = t[5] || 0;
                        const w = Math.max(1, (item.width || 0) * (PDF_PROCESS_CONFIG.renderScale || 2));
                        const h = Math.max(8, Math.abs(item.height || 10) * (PDF_PROCESS_CONFIG.renderScale || 2));

                        return {
                            str,
                            x1: x,
                            y1: y - h,
                            x2: x + w,
                            y2: y,
                            cx: x + w / 2,
                            cy: y - h / 2
                        };
                    })
                    .filter(Boolean);

                items.sort((a, b) => {
                    if (Math.abs(a.y1 - b.y1) > 5) return a.y1 - b.y1;
                    return a.x1 - b.x1;
                });

                const lines = [];
                let current = [];
                let lastY = null;

                for (const item of items) {
                    if (lastY === null || Math.abs(item.y1 - lastY) <= 6) {
                        current.push(item);
                    } else {
                        if (current.length) lines.push(current);
                        current = [item];
                    }
                    lastY = item.y1;
                }
                if (current.length) lines.push(current);

                const normalizedLines = lines.map(lineItems => {
                    const sorted = [...lineItems].sort((a, b) => a.x1 - b.x1);
                    const text = sorted.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();

                    const x1 = Math.min(...sorted.map(item => item.x1));
                    const y1 = Math.min(...sorted.map(item => item.y1));
                    const x2 = Math.max(...sorted.map(item => item.x2));
                    const y2 = Math.max(...sorted.map(item => item.y2));

                    return {
                        text,
                        x1,
                        y1,
                        x2,
                        y2,
                        nx1: Math.round(x1 / viewport.width * 1000),
                        ny1: Math.round(y1 / viewport.height * 1000),
                        nx2: Math.round(x2 / viewport.width * 1000),
                        ny2: Math.round(y2 / viewport.height * 1000)
                    };
                }).filter(line => line.text);

                layouts.push({
                    pageNo,
                    width: viewport.width,
                    height: viewport.height,
                    lines: normalizedLines
                });
            }

            console.groupCollapsed(`[BATCH_V2][pdf-layout] ${file.filename || ''}`);
            console.table(layouts.flatMap(page => page.lines.map(line => ({
                pageNo: page.pageNo,
                y: `${line.ny1}-${line.ny2}`,
                x: `${line.nx1}-${line.nx2}`,
                text: line.text.slice(0, 120)
            }))));
            console.groupEnd();

            return layouts;
        };

        const extractTextFromDraftFile = async (file) => {
            if (file.fileType === 'text' || file.filename?.toLowerCase().endsWith('.csv')) {
                return await (await dataUrlToBlob(file.uploadPath)).text();
            }
            if (file.fileType === 'docx') {
                if (!root.JSZip) return '';
                const zip = await root.Qisi.ArchiveSecurity.load(root.JSZip, await dataUrlToBlob(file.uploadPath), 'office-document', { name: file.filename || 'document.docx', type: file.mime || '' });
                const doc = await zip.file('word/document.xml')?.async('string');
                root.Qisi.DocxPipeline.debugDocxXmlStructure(doc || '', file.filename);

                const textNodesOnly = extractDocxTextNodesOnly(doc || '');

                console.groupCollapsed('[BATCH_DEBUG][docx-text-nodes-only]');
                console.log('filename =', file.filename);
                console.log('length =', textNodesOnly.length);
                console.log('head =', textNodesOnly.slice(0, 3000));
                console.groupEnd();

                const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('string').catch(() => '') || '';
                const { ridImageUrlMap, ridImageMetaMap } = await buildDocxMediaMaps(zip, relsXml, file.filename);
                const imageRefsByRid = {};
                const imageRefs = [];

                ridImageMetaMap.forEach((meta, rid) => {
                    const ref = {
                        id: meta.id,
                        rid,
                        filename: meta.filename,
                        mediaPath: meta.target,
                        target: meta.target,
                        url: ridImageUrlMap.get(rid) || '',
                        sourceFileId: file.id,
                        ext: meta.ext,
                        mime: meta.mime,
                        displayable: meta.displayable
                    };
                    imageRefsByRid[rid] = ref;
                    imageRefs.push(ref);
                });

                docxEmbeddedImageCache.set(file.id, imageRefs);
                draftFileXmlCache.set(file.id, doc || '');
                draftFileRidImageUrlMapCache.set(file.id, ridImageUrlMap);
                draftFileRidImageMetaMapCache.set(file.id, ridImageMetaMap);

                try {
                    let text = extractDocxTextWithMath(doc || '', imageRefsByRid);
                    text = await resolveFormulaImageTokens(text, docxEmbeddedImageCache.get(file.id) || []);

                    const docxTableText = root.Qisi.DocxPipeline.extractDocxTableTextFallback(doc || '');

                    if (root.Qisi.Utils.cleanRecognizedText(docxTableText)) {
                        text = [
                            text,
                            '\n\n【DOCX表格文本兜底】\n',
                            docxTableText
                        ].filter(Boolean).join('\n');
                    }

                    console.groupCollapsed('[BATCH_DEBUG][docx-text-after-table-fallback]');
                    console.log('filename =', file.filename);
                    console.log('textLength =', String(text || '').length);
                    console.log('textHead =', String(text || '').slice(0, 2000));
                    console.groupEnd();

                    const hasDocxXmlLeak = /<\/?w:[a-zA-Z]+|<\/?m:[a-zA-Z]+|<\/?wp:[a-zA-Z]+|<\/?a:[a-zA-Z]+/.test(String(text || ''));

                    if (hasDocxXmlLeak) {
                        const stripped = xmlText(text || '');
                        const strippedCleanLen = root.Qisi.Utils.cleanRecognizedText(stripped).length;
                        const currentCleanLen = root.Qisi.Utils.cleanRecognizedText(text).length;

                        if (strippedCleanLen >= Math.max(20, currentCleanLen * 0.25)) {
                            console.warn('[BATCH_DEBUG][docx-xml-leak-cleaned]', {
                                filename: file.filename,
                                beforeLength: String(text || '').length,
                                afterLength: String(stripped || '').length,
                                beforeHead: String(text || '').slice(0, 300),
                                afterHead: String(stripped || '').slice(0, 300)
                            });

                            text = stripped;
                        } else {
                            console.warn('[BATCH_DEBUG][docx-xml-leak-detected-but-kept]', {
                                filename: file.filename,
                                beforeLength: String(text || '').length,
                                strippedLength: String(stripped || '').length,
                                beforeHead: String(text || '').slice(0, 300),
                                strippedHead: String(stripped || '').slice(0, 300)
                            });
                        }
                    }

                    draftFileTextCache.set(file.id, text);
                    return text;
                } catch (error) {
                    console.warn('DOCX 公式提取失败，降级为纯文本', error);
                    const text = xmlText(doc || '');
                    draftFileTextCache.set(file.id, text);
                    return text;
                }
            }
            if (file.fileType === 'excel') {
                if (file.filename?.toLowerCase().endsWith('.csv')) return await (await dataUrlToBlob(file.uploadPath)).text();
                if (!root.JSZip) return '';
                const zip = await root.Qisi.ArchiveSecurity.load(root.JSZip, await dataUrlToBlob(file.uploadPath), 'office-document', { name: file.filename || 'spreadsheet.xlsx', type: file.mime || '' });
                const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('string');
                const shared = [];
                String(sharedXml || '').replace(/<si[^>]*>([\s\S]*?)<\/si>/g, (_, si) => {
                    shared.push(xmlText(si));
                    return '';
                });
                const sheet = await zip.file('xl/worksheets/sheet1.xml')?.async('string');
                const rows = [];
                String(sheet || '').replace(/<row[^>]*>([\s\S]*?)<\/row>/g, (_, row) => {
                    const cells = [];
                    row.replace(/<c[^>]*(?:t="s")?[^>]*>([\s\S]*?)<\/c>/g, (cellMatch, cell) => {
                        const isShared = /t="s"/.test(cellMatch);
                        const value = (cell.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || '';
                        cells.push(isShared ? (shared[Number(value)] || '') : value);
                        return '';
                    });
                    if (cells.length) rows.push(cells.join('\t'));
                    return '';
                });
                return rows.join('\n');
            }
            if (file.fileType === 'pdf') {
                try {
                    const pdfText = await extractPdfTextWithPdfJs(file);
                    if (root.Qisi.Utils.cleanRecognizedText(pdfText).length > 20) return pdfText;
                } catch (error) {
                    console.warn('PDF.js 文本提取失败，回退原始 Tj 解析', error);
                }

                const buffer = await (await dataUrlToBlob(file.uploadPath)).arrayBuffer();
                const raw = new TextDecoder('latin1').decode(buffer);
                const chunks = [];
                raw.replace(/\(([^()]{2,})\)\s*Tj/g, (_, text) => {
                    chunks.push(text.replace(/\\([()\\])/g, '$1'));
                    return '';
                });
                return chunks.join('\n');
            }
            return '';
        };


        return Object.freeze({
            extractPdfTextWithPdfJs,
            extractPdfLayoutWithPdfJs,
            extractTextFromDraftFile
        });
    }

    return Object.freeze({ createBrowserDocumentSource });
});
