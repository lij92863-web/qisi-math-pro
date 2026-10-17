(function () {
    const dataUrlToArrayBuffer = async (dataUrl) => {
        const res = await fetch(dataUrl);
        return await res.arrayBuffer();
    };

    const loadDocxZip = async (fileRecord) => {
        if (!window.JSZip) throw new Error('JSZip not loaded, cannot parse DOCX.');
        const buffer = await dataUrlToArrayBuffer(fileRecord.uploadPath);
        return await window.Qisi.ArchiveSecurity.load(
            window.JSZip,
            buffer,
            'office-document',
            {
                name: fileRecord.filename || fileRecord.name || 'document.docx',
                type: fileRecord.mime || fileRecord.type || ''
            }
        );
    };

    const readDocxCoreXml = async (zip) => {
        const documentXml = await zip.file('word/document.xml')?.async('text') || '';
        const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('text').catch(() => '') || '';
        return { documentXml, relsXml };
    };

    const parseRelationships = (relsXml = '') => {
        const map = new Map();

        String(relsXml || '').replace(/<Relationship\b([^>]+?)\/>/g, (_, attrs) => {
            const id = attrs.match(/\bId=["']([^"']+)["']/)?.[1] || '';
            const target = attrs.match(/\bTarget=["']([^"']+)["']/)?.[1] || '';
            const type = attrs.match(/\bType=["']([^"']+)["']/)?.[1] || '';

            if (!id || !target) return '';

            const normalizedTarget = target.startsWith('/')
                ? target.replace(/^\/+/, '')
                : `word/${target.replace(/^(\.\.\/)+/, '')}`;

            map.set(id, { id, target: normalizedTarget.replace(/\\/g, '/'), type });
            return '';
        });

        return map;
    };

    const getExt = (path = '') => {
        const m = String(path || '').match(/\.([a-zA-Z0-9]+)$/);
        return m ? m[1].toLowerCase() : '';
    };

    const getMime = (path = '') => {
        const ext = getExt(path);
        return {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            gif: 'image/gif',
            webp: 'image/webp',
            svg: 'image/svg+xml',
            bmp: 'image/bmp',
            emf: 'image/emf',
            wmf: 'image/wmf',
            bin: 'application/octet-stream'
        }[ext] || 'application/octet-stream';
    };

    const isDisplayableImage = (ext = '') =>
        /^(png|jpg|jpeg|gif|webp|svg)$/i.test(ext);

    const readMediaAsDataUrl = async (zip, targetPath = '') => {
        const normalized = String(targetPath || '').replace(/^\/+/, '');
        const file = zip.file(normalized);
        if (!file) return '';

        const blob = await file.async('blob');
        const mime = getMime(normalized);

        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('Failed to read DOCX media.'));
            reader.readAsDataURL(new Blob([blob], { type: mime }));
        });
    };

    const buildMediaMaps = async (zip, relsXml = '', filename = '') => {
        const relMap = parseRelationships(relsXml);
        const mediaMap = new Map();

        for (const [rid, rel] of relMap.entries()) {
            const target = rel.target || '';
            const ext = getExt(target);
            const isMedia =
                /\/image/i.test(rel.type || '') ||
                /oleObject/i.test(rel.type || '') ||
                /\.(png|jpe?g|gif|bmp|webp|svg|emf|wmf|bin)$/i.test(target);

            if (!isMedia) continue;

            const mime = getMime(target);
            const displayable = isDisplayableImage(ext);

            let dataUrl = '';
            try {
                dataUrl = await readMediaAsDataUrl(zip, target);
            } catch (error) {
                console.warn('[BATCH_IMPORTER][docx-media-read-failed]', {
                    filename,
                    rid,
                    target,
                    ext,
                    message: error?.message || String(error)
                });
            }

            mediaMap.set(rid, {
                rid,
                target,
                type: rel.type,
                ext,
                mime,
                displayable,
                url: dataUrl,
                hasUrl: Boolean(dataUrl)
            });
        }

        console.groupCollapsed('[BATCH_IMPORTER][docx-media-summary]');
        console.log('filename =', filename);
        console.log('mediaCount =', mediaMap.size);
        console.table([...mediaMap.values()].slice(0, 80).map(x => ({
            rid: x.rid,
            target: x.target,
            ext: x.ext,
            displayable: x.displayable,
            hasUrl: x.hasUrl
        })));
        console.groupEnd();

        return mediaMap;
    };

    const decodeXmlEntitiesSafe = (value = '') => String(value || '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

    const normalizeDocxText = (value = '') => String(value || '')
        .replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
        .replace(/\u00A0/g, ' ')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    const consumeLeadingImageTokens = (value = '') => {
        const source =
            String(value || '');

        const match =
            source.match(
                /^(?:\s*\[\[IMAGE(?::[^\]\r\n]+)?\]\]\s*)+/
            );

        return match
            ? match[0].length
            : 0;
    };

    // Explicit Chinese markers up to 99 use a finite, unambiguous lookup.
    const chineseQuestionNumbers = new Map(Array.from({ length: 99 }, (_, index) => {
        const number = index + 1, digits = '零一二三四五六七八九';
        const tens = Math.floor(number / 10), ones = number % 10;
        const marker = tens ? (tens === 1 ? '' : digits[tens]) + '十' + (ones ? digits[ones] : '') : digits[ones];
        return [marker, String(number)];
    }));
    const parseLeadingQuestionMarker = (
        value = ''
    ) => {
        const source =
            normalizeDocxText(value);

        const imagePrefixLength =
            consumeLeadingImageTokens(source);

        const markerSource =
            source.slice(imagePrefixLength);

        const chinese = markerSource.match(/^\s*(?:第\s*)?([一二三四五六七八九十]+)\s*(?:题|[、.．])\s*/);
        const match = chinese && chineseQuestionNumbers.has(chinese[1]) ? chinese : markerSource.match(
            /^\s*(?:第\s*)?((?:\d\s*)+)(?:题|[.\uFF0E](?!\d)|[\u3001\u3002)\uFF09])\s*/
        );
        if (!match) {
            return {
                source,
                questionNumber: '',
                markerLength: 0,
                rawMarker: ''
            };
        }

        if (chinese && /^(?:单项选择题|多项选择题|选择题|单选题|多选题|填空题|解答题|证明题)(?=\s*$|\s*[（(:：])/.test(markerSource.slice(chinese[0].length))) {
            return { source, questionNumber: '', markerLength: 0, rawMarker: '' };
        }
        const compactDigits =
            String(chineseQuestionNumbers.get(match[1]) || match[1] || '')
                .replace(/\s+/g, '');

        const numericValue =
            Number(compactDigits);

        if (
            !Number.isSafeInteger(numericValue) ||
            numericValue <= 0
        ) {
            return {
                source,
                questionNumber: '',
                markerLength: 0,
                rawMarker: ''
            };
        }

        return {
            source,
            questionNumber:
                String(numericValue),
            markerLength:
                imagePrefixLength + match[0].length,
            rawMarker:
                source.slice(0, imagePrefixLength + match[0].length)
        };
    };

    const extractRelationshipIdsFromXml = (xml = '') => {
        const ids = [];

        String(xml || '').replace(/\br:embed=["']([^"']+)["']/g, (_, rid) => {
            if (rid) ids.push(rid);
            return '';
        });

        String(xml || '').replace(/\br:id=["']([^"']+)["']/g, (_, rid) => {
            if (rid) ids.push(rid);
            return '';
        });

        String(xml || '').replace(/\bo:relid=["']([^"']+)["']/g, (_, rid) => {
            if (rid) ids.push(rid);
            return '';
        });

        return [...new Set(ids)];
    };

    const ommlChildren = (node, localName) => Array.from(node?.childNodes || [])
        .filter(child => child.nodeType === 1 && child.localName === localName);

    const ommlFirst = (node, localName) => ommlChildren(node, localName)[0] || null;

    const ommlNodeText = (node) => {
        if (!node) return '';
        if (node.nodeType === 3) return node.nodeValue || '';
        if (node.nodeType !== 1) return '';

        const name = node.localName;

        if (name === 't') return node.textContent || '';
        if (name === 'r') return Array.from(node.childNodes).map(ommlNodeText).join('');

        if (name === 'f') {
            const num = ommlNodeText(ommlFirst(node, 'num'));
            const den = ommlNodeText(ommlFirst(node, 'den'));
            return `\\frac{${num}}{${den}}`;
        }

        if (name === 'sSup') {
            return `${ommlNodeText(ommlFirst(node, 'e'))}^{${ommlNodeText(ommlFirst(node, 'sup'))}}`;
        }

        if (name === 'sSub') {
            return `${ommlNodeText(ommlFirst(node, 'e'))}_{${ommlNodeText(ommlFirst(node, 'sub'))}}`;
        }

        if (name === 'sSubSup') {
            return `${ommlNodeText(ommlFirst(node, 'e'))}_{${ommlNodeText(ommlFirst(node, 'sub'))}}^{${ommlNodeText(ommlFirst(node, 'sup'))}}`;
        }

        if (name === 'rad') {
            const deg = ommlNodeText(ommlFirst(node, 'deg'));
            const body = ommlNodeText(ommlFirst(node, 'e'));
            return deg ? `\\sqrt[${deg}]{${body}}` : `\\sqrt{${body}}`;
        }

        if (name === 'bar') {
            return `\\overline{${ommlNodeText(ommlFirst(node, 'e'))}}`;
        }

        if (name === 'd') {
            const body = ommlNodeText(ommlFirst(node, 'e'));
            return `\\left(${body}\\right)`;
        }

        if (name === 'nary') {
            const pr = ommlFirst(node, 'naryPr');
            const chr = pr?.getElementsByTagName?.('m:chr')?.[0]?.getAttribute('m:val') || '\\sum';
            const sub = ommlNodeText(ommlFirst(node, 'sub'));
            const sup = ommlNodeText(ommlFirst(node, 'sup'));
            const body = ommlNodeText(ommlFirst(node, 'e'));
            return `${chr}${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''}${body}`;
        }

        if (['num', 'den', 'e', 'sub', 'sup', 'deg', 'oMath', 'oMathPara'].includes(name)) {
            return Array.from(node.childNodes).map(ommlNodeText).join('');
        }

        return Array.from(node.childNodes).map(ommlNodeText).join('');
    };

    const ommlToLatex = (xml = '') => {
        try {
            const wrapped = `<root xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${xml}</root>`;
            const doc = new DOMParser().parseFromString(wrapped, 'application/xml');
            const latex = ommlNodeText(doc.documentElement).replace(/\s+/g, ' ').trim();
            return latex ? `$${latex}$` : '';
        } catch (error) {
            console.warn('[BATCH_IMPORTER][omml-to-latex-failed]', error);
            return '';
        }
    };

    const makeDocxImageToken = (rid, mediaMap, imageBucket, q = '') => {
        if (!rid) return '';

        const media = mediaMap.get(rid);
        if (!media) return '';

        const existing = imageBucket.find(img => img.rid === rid);
        if (existing) return `[[IMAGE:${existing.id}]]`;

        if (media.displayable && media.url) {
            const safeRid = String(rid).replace(/[^a-zA-Z0-9_-]/g, '_');
            const id = `docx_img_${q || 'q'}_${safeRid}_${imageBucket.length}_${Date.now()}`;

            imageBucket.push({
                id,
                url: media.url,
                filename: `${id}.${media.ext || 'png'}`,
                name: `${id}.${media.ext || 'png'}`,
                source: 'docx-inline-image',
                rid,
                ext: media.ext,
                mime: media.mime,
                displayable: true
            });

            return `[[IMAGE:${id}]]`;
        }

        const ext = media.ext || 'unknown';
        return `${UNDISPLAYABLE_IMAGE_PREFIX}${ext}]`;
    };

    const xmlFragmentToRenderableText = (xml = '', mediaMap = new Map(), imageBucket = [], q = '') => {
        const parts = [];
        const source = String(xml || '');

        source.replace(
            /<m:oMathPara[\s\S]*?<\/m:oMathPara>|<m:oMath[\s\S]*?<\/m:oMath>|<(?:w:drawing|w:object)\b[\s\S]*?<\/(?:w:drawing|w:object)>|<v:imagedata\b[^>]*\/>|<o:OLEObject\b[^>]*\/>|<(?:w:t|m:t|w:instrText|w:delText)\b[^>]*>([\s\S]*?)<\/(?:w:t|m:t|w:instrText|w:delText)>|<w:tab\s*\/>|<w:br\s*\/>|<m:chr[^>]*m:val=["']([^"']+)["'][^>]*\/>/g,
            (match, textNode, mathChar) => {
                if (match.startsWith('<m:oMath')) {
                    const latex = ommlToLatex(match);
                    if (latex) parts.push(latex);
                    return '';
                }

                if (match.startsWith('<w:drawing') || match.startsWith('<w:object') || match.startsWith('<v:imagedata') || match.startsWith('<o:OLEObject')) {
                    const rids = extractRelationshipIdsFromXml(match);
                    const displayableRid = rids.find(rid => mediaMap.get(rid)?.displayable && mediaMap.get(rid)?.url);
                    const fallbackRid =
                        displayableRid ||
                        rids.find(rid => /^(wmf|emf)$/i.test(mediaMap.get(rid)?.ext || '')) ||
                        rids.find(rid => mediaMap.get(rid));

                    const token = makeDocxImageToken(fallbackRid, mediaMap, imageBucket, q);
                    if (token) parts.push(token);
                    return '';
                }

                if (match.startsWith('<w:tab')) {
                    parts.push(' ');
                    return '';
                }

                if (match.startsWith('<w:br')) {
                    parts.push('\n');
                    return '';
                }

                if (mathChar) {
                    parts.push(mathChar);
                    return '';
                }

                const text = decodeXmlEntitiesSafe(textNode || '');
                if (text) parts.push(text);
                return '';
            }
        );

        return normalizeDocxText(parts.join(' '));
    };

    const extractTextFromXmlFragment = (xml = '') => {
        return xmlFragmentToRenderableText(xml, new Map(), [], '');
    };

    const splitDocxParagraphs = (documentXml = '') => {
        const paragraphs = [];

        String(documentXml || '').replace(/<w:p[\s\S]*?<\/w:p>/g, (pXml) => {
            const text = extractTextFromXmlFragment(pXml);
            const hasObject = /<w:object\b|<w:drawing\b|<v:imagedata\b|<o:OLEObject\b/.test(pXml);

            if (text || hasObject) {
                paragraphs.push({
                    text,
                    rawXml: pXml,
                    hasObject
                });
            }

            return '';
        });

        return paragraphs;
    };

    const UNDISPLAYABLE_IMAGE_PREFIX = '[DOCX不可显示图片:';

    const getQuestionNoFromLine = (
        line = ''
    ) => {
        return parseLeadingQuestionMarker(
            line
        ).questionNumber;
    };
    const buildQuestionBlocksFromDocumentXml = (documentXml = '') => {
        const paragraphs = splitDocxParagraphs(documentXml);
        const blocks = [];
        let current = null;
        let sectionType = '';

        for (const p of paragraphs) {
            if (/^(?:《[^》]+》\s*)?(?:参考答案(?:及|与)?(?:解析|详解)?|答案(?:及|与)(?:解析|详解))$/.test(p.text)) break;
            // Blank answer-form labels are not question stems.
            if (/^(?:\d+\s*[.．、]\s*){2,}$/.test(p.text) && !p.hasObject) continue;
            const section = p.text.match(/^(?:[一二三四五六七八九十]+[、.．]\s*)?(单项选择题|单选题|多项选择题|多选题|填空题|解答题|证明题)(?:\s*[(:：]|\s*$)/);
            if (section) {
                if (current) blocks.push(current);
                current = null;
                sectionType = /多/.test(section[1]) ? '多选题'
                    : /单/.test(section[1]) ? '单选题' : section[1];
                continue;
            }
            const qNo = getQuestionNoFromLine(p.text || '');

            if (qNo) {
                if (current) blocks.push(current);

                current = {
                    q: qNo,
                    sectionType,
                    lines: [p.text || ''],
                    rawXmlParts: [p.rawXml || '']
                };
            } else if (current) {
                current.lines.push(p.text || '');
                current.rawXmlParts.push(p.rawXml || '');
            }
        }

        if (current) blocks.push(current);

        console.groupCollapsed('[BATCH_IMPORTER][docx-blocks]');
        console.log('paragraphCount =', paragraphs.length);
        console.log('blockCount =', blocks.length);
        console.table(blocks.map(block => ({
            q: block.q,
            textLen: block.lines.join('\n').length,
            head: block.lines.join('\n').slice(0, 160)
        })));
        console.groupEnd();

        return blocks;
    };

    const buildQuestionSkeletonFromBlocks = (blocks = []) => {
        const entries = (blocks || [])
            .map((block, index) => {
                const rawQuestionNumber =
                    normalizeDocxText(block?.q || '');

                const match =
                    rawQuestionNumber.match(/\d{1,3}/);

                if (!match) return null;

                const numericQuestionNumber =
                    Number(match[0]);

                if (
                    !Number.isInteger(numericQuestionNumber) ||
                    numericQuestionNumber <= 0
                ) {
                    return null;
                }

                return {
                    questionNumber:
                        String(numericQuestionNumber),
                    order: index + 1,
                    textHead: String(
                        block?.lines?.join('\n') || ''
                    ).slice(0, 240)
                };
            })
            .filter(Boolean);

        const numericNumbers = entries.map(entry =>
            Number(entry.questionNumber)
        );

        const uniqueNumbers = [
            ...new Set(numericNumbers)
        ];

        const noDuplicates =
            uniqueNumbers.length === numericNumbers.length;

        const strictlyIncreasing =
            numericNumbers.every((value, index) =>
                index === 0 ||
                value > numericNumbers[index - 1]
            );

        const contiguous =
            numericNumbers.every((value, index) =>
                index === 0 ||
                value === numericNumbers[index - 1] + 1
            );

        const authoritative =
            entries.length >= 2 &&
            noDuplicates &&
            strictlyIncreasing &&
            contiguous;

        let reason = 'ok';

        if (!entries.length) {
            reason =
                'no-explicit-question-markers';
        } else if (entries.length < 2) {
            reason =
                'too-few-explicit-question-markers';
        } else if (!noDuplicates) {
            reason =
                'duplicate-question-numbers';
        } else if (!strictlyIncreasing) {
            reason =
                'question-numbers-not-increasing';
        } else if (!contiguous) {
            reason =
                'question-numbers-not-contiguous';
        }

        return {
            authoritative,
            questionNumbers:
                entries.map(
                    entry =>
                        entry.questionNumber
                ),
            entries,
            diagnostics: {
                reason,
                entryCount: entries.length,
                noDuplicates,
                strictlyIncreasing,
                contiguous
            }
        };
    };

    const extractDocxQuestionSkeleton = async (
        fileRecord
    ) => {
        if (!fileRecord?.uploadPath) {
            throw new Error(
                'DOCX question skeleton extraction missing uploadPath.'
            );
        }

        const zip =
            await loadDocxZip(fileRecord);

        const {
            documentXml
        } = await readDocxCoreXml(zip);

        if (!documentXml) {
            throw new Error(
                'DOCX missing word/document.xml.'
            );
        }

        const blocks =
            buildQuestionBlocksFromDocumentXml(
                documentXml
            );

        const skeleton =
            buildQuestionSkeletonFromBlocks(blocks);

        console.groupCollapsed(
            '[BATCH_IMPORTER][docx-question-skeleton]'
        );

        console.log({
            filename: fileRecord?.filename || '',
            authoritative:
                skeleton.authoritative,
            questionNumbers:
                skeleton.questionNumbers,
            diagnostics:
                skeleton.diagnostics
        });

        console.table(
            skeleton.entries.map(entry => ({
                order: entry.order,
                questionNumber:
                    entry.questionNumber,
                textHead:
                    entry.textHead
            }))
        );

        console.groupEnd();

        return skeleton;
    };

    const cleanOptionText = (text = '', helpers = {}) => {
        const cleanDisplayTextForBatchSave = helpers.cleanDisplayTextForBatchSave || ((x) => String(x || '').trim());

        return cleanDisplayTextForBatchSave(String(text || '')
            .replace(/\s+/g, ' ')
            .trim()
        );
    };

    const optionCount = (options = []) =>
        Array.isArray(options)
            ? options.filter(x => String(x || '').trim()).length
            : 0;

    // Option labels are text outside a complete math span, never symbols inside a formula.
    const maskMathSpans = text => text.replace(/(?<!\\)\$(?:\\.|[^$])*?(?<!\\)\$/g,
        match => '$' + ' '.repeat(match.length - 1));

    const parseInlineTextOptions = (blockRawXml = '', helpers = {}) => {
        const textNodes = [];

        String(blockRawXml || '').replace(/<(?:w:t|m:t|w:instrText|w:delText)\b[^>]*>([\s\S]*?)<\/(?:w:t|m:t|w:instrText|w:delText)>/g, (_, textNode) => {
            const text = decodeXmlEntitiesSafe(textNode || '')
                .replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                .replace(/\u00A0/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            if (text) textNodes.push(text);
            return '';
        });

        const joined = (textNodes.length ? textNodes.join(' ') : String(blockRawXml || ''))
            .replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const labelRe = /(^|[\n\r\s,;，；。])([A-D])\s*(?:[.\uFF0E\u3001\u3002)\uFF09]|(?=\s*(?:\$|\\|\[\[IMAGE:|\[[^\]]+\]|[0-9\u4e00-\u9fffA-Za-z])))/g;
        const hits = [];
        let match;

        const labelText = maskMathSpans(joined);
        while ((match = labelRe.exec(labelText)) !== null) {
            const label = String(match[2] || '').toUpperCase();
            hits.push({
                label,
                start: match.index + (match[1] || '').length,
                contentStart: labelRe.lastIndex
            });
        }

        const labels = hits.map(hit => hit.label).join('');
        if (!labels.includes('A') || !labels.includes('B')) return ['', '', '', ''];

        const options = ['', '', '', ''];

        for (let i = 0; i < hits.length; i += 1) {
            const hit = hits[i];
            const idx = hit.label.charCodeAt(0) - 65;
            if (idx < 0 || idx > 3) continue;

            const nextHit = hits[i + 1];
            const raw = joined.slice(hit.contentStart, nextHit ? nextHit.start : joined.length).trim();
            options[idx] = cleanOptionText(raw, helpers);
        }

        return [0, 1, 2, 3].map(idx => options[idx] || '');
    };

    const parseXmlSegmentOptions = (blockRawXml = '', mediaMap = new Map(), helpers = {}, q = '') => {
        const source = String(blockRawXml || '');
        const options = ['', '', '', ''];
        const optionImages = [];
        let hasUndisplayable = false;

        const labelRegex = /<w:t\b[^>]*>\s*([A-D\uFF21-\uFF24])\s*[.\uFF0E\u3001\u3002)\uFF09]\s*<\/w:t>/g;
        const hits = [];
        let match;

        while ((match = labelRegex.exec(source)) !== null) {
            hits.push({
                label: String(match[1] || '')
                    .replace(/[\uFF21-\uFF24]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                    .toUpperCase(),
                start: match.index,
                end: labelRegex.lastIndex
            });
        }

        if (hits.length < 2) {
            return { options, optionImages, hasUndisplayable };
        }

        for (let i = 0; i < hits.length; i += 1) {
            const hit = hits[i];
            const idx = hit.label.charCodeAt(0) - 65;
            if (idx < 0 || idx > 3) continue;

            const nextHit = hits[i + 1];
            const segment = source.slice(hit.end, nextHit ? nextHit.start : source.length);

            const text = extractTextFromXmlFragment(segment);
            const textOption = cleanOptionText(
                text.replace(/^[A-D]\\s*[.\\uFF0E\\u3001\\u3002)\\uFF09]\\s*/i, ''),
                helpers
            );

            if (textOption) {
                options[idx] = textOption;
                continue;
            }

            const rids = extractRelationshipIdsFromXml(segment);
            const displayableRid = rids.find(rid => mediaMap.get(rid)?.displayable && mediaMap.get(rid)?.url);
            const fallbackRid =
                displayableRid ||
                rids.find(rid => /^(wmf|emf)$/i.test(mediaMap.get(rid)?.ext || '')) ||
                rids.find(rid => mediaMap.get(rid));

            if (!fallbackRid) continue;

            const media = mediaMap.get(fallbackRid);

            if (media?.displayable && media.url) {
                const id = `docx_opt_${q || 'q'}_${hit.label}_${optionImages.length}_${Date.now()}`;

                optionImages.push({
                    id,
                    url: media.url,
                    filename: `${id}.${media.ext || 'png'}`,
                    name: `${id}.${media.ext || 'png'}`,
                    source: 'docx-option-object',
                    rid: fallbackRid,
                    ext: media.ext,
                    mime: media.mime,
                    displayable: true
                });

                options[idx] = `[[IMAGE:${id}]]`;
            } else {
                hasUndisplayable = true;
                const ext = media?.ext || 'unknown';
                options[idx] = `${UNDISPLAYABLE_IMAGE_PREFIX}${ext}]`;
            }
        }

        return { options, optionImages, hasUndisplayable };
    };

    const exposeExplicitMathOptionLabels = text => {
        const provisional = text.replace(/(?<!\\)\$(?:\\.|[^$])*?(?<!\\)\$/g, formula => {
            const body = formula.slice(1, -1).trim();
            const prefix = body.match(/^(?:\{\\rm\{([A-D])\}\}|\\(?:mathrm|text)\{([A-D])\}|([A-D]))(?:\{\\rm\{\.\}\}|\.)\s*([\s\S]*)$/);
            if (!prefix) return formula;
            const label = prefix[1] || prefix[2] || prefix[3];
            return label + '.' + (prefix[4] ? ' $' + prefix[4] + '$' : '');
        });
        const labels = [...maskMathSpans(provisional).matchAll(/(?:^|\s)([A-D])\s*[.．、]/g)]
            .map(match => match[1]).join('');
        // The literal label is stored in the formula. Require the complete ordered row.
        return labels === 'ABCD' ? provisional : text;
    };

    const parseOptionsFromBlock = (block, mediaMap, helpers = {}) => {
        const blockRawXml = block.rawXmlParts.join('\n');
        const blockText = block.lines.join('\n');
        const inlineImages = [];

        const renderableText = exposeExplicitMathOptionLabels(
            xmlFragmentToRenderableText(blockRawXml, mediaMap, inlineImages, block.q));
        const questionText = renderableText.split(/【(?:答案|参考答案|解析|详解|解答|分析)】/)[0];

        let options = parseInlineTextOptions(questionText, helpers);
        if (optionCount(options) >= 2) {
            return {
                options,
                optionImages: inlineImages,
                hasUndisplayable: options.some(opt => String(opt || '').includes(UNDISPLAYABLE_IMAGE_PREFIX)),
                source: 'renderable-xml',
                renderableText
            };
        }

        const segmented = parseXmlSegmentOptions(blockRawXml, mediaMap, helpers, block.q);
        if (optionCount(segmented.options) >= 2) {
            return {
                options: segmented.options,
                optionImages: [...inlineImages, ...(segmented.optionImages || [])],
                hasUndisplayable: segmented.hasUndisplayable,
                source: 'xml-segment',
                renderableText
            };
        }

        options = parseInlineTextOptions(blockText, helpers);
        if (optionCount(options) >= 2) {
            return {
                options,
                optionImages: inlineImages,
                hasUndisplayable: false,
                source: 'plain-text',
                renderableText
            };
        }

        return {
            options: ['', '', '', ''],
            optionImages: inlineImages,
            hasUndisplayable: false,
            source: 'none',
            renderableText
        };
    };

    const stripOptionsFromStemText = (text = '') => {
        const source = normalizeDocxText(text || '');
        const idx = maskMathSpans(source).search(/(?:^|\s)A\s*[.\uFF0E\u3001\u3002)\uFF09]/);
        if (idx >= 0) return source.slice(0, idx).trim();
        return source.trim();
    };

    const stripQuestionNo = (
        text = ''
    ) => {
        const parsed =
            parseLeadingQuestionMarker(text);

        if (
            !parsed.questionNumber ||
            parsed.markerLength <= 0
        ) {
            return parsed.source.trim();
        }

        return parsed.source
            .slice(parsed.markerLength)
            .trim();
    };
    const parseStemFromBlock = (block, renderableText = '') => {
        const blockText = (renderableText || block.lines.join('\n')).split(/【(?:答案|参考答案|解析|详解|解答|分析)】/)[0];
        return stripQuestionNo(stripOptionsFromStemText(blockText));
    };

    const expandWordLetterNumbering = (xml, numberingXml) => {
        if (!numberingXml) return xml;
        const document = new DOMParser().parseFromString(numberingXml, 'application/xml');
        const abstracts = new Map(Array.from(document.getElementsByTagName('w:abstractNum'))
            .map(node => [node.getAttribute('w:abstractNumId'), node]));
        const lists = new Map();
        for (const node of document.getElementsByTagName('w:num')) {
            const abstractId = node.getElementsByTagName('w:abstractNumId')[0]?.getAttribute('w:val');
            const level = abstracts.get(abstractId)?.getElementsByTagName('w:lvl')[0];
            if (level?.getAttribute('w:ilvl') !== '0' ||
                level.getElementsByTagName('w:numFmt')[0]?.getAttribute('w:val') !== 'upperLetter' ||
                level.getElementsByTagName('w:lvlText')[0]?.getAttribute('w:val') !== '%1.') continue;
            const start = Number(node.getElementsByTagName('w:startOverride')[0]?.getAttribute('w:val') ||
                level.getElementsByTagName('w:start')[0]?.getAttribute('w:val') || 1);
            lists.set(node.getAttribute('w:numId'), {next:start});
        }
        return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, paragraph => {
            const properties = paragraph.match(/<w:numPr>[\s\S]*?<\/w:numPr>/)?.[0] || '';
            if (!/<w:ilvl\s+w:val="0"/.test(properties)) return paragraph;
            const id = properties.match(/<w:numId\s+w:val="(\d+)"/)?.[1], list = lists.get(id);
            if (!list) return paragraph;
            const value = list.next++;
            if (!Number.isInteger(value) || value < 1 || value > 26) return paragraph;
            const label = String.fromCharCode(64 + value);
            const text = extractTextFromXmlFragment(paragraph);
            if (new RegExp('^' + label + '\\s*[.．]').test(text)) return paragraph;
            const prefix = '<w:r><w:t>' + label + '. </w:t></w:r>';
            return paragraph.includes('</w:pPr>')
                ? paragraph.replace('</w:pPr>', () => '</w:pPr>' + prefix)
                : paragraph.replace(/<w:p\b[^>]*>/, tag => tag + prefix);
        });
    };

    const parseDocxFile = async (fileRecord, context = {}) => {
        const helpers = context.helpers || {};
        const defaultMeta = context.defaultMeta || {};
        const warnings = [];
        const draftImages = [];

        const zip = await loadDocxZip(fileRecord);
        const { documentXml, relsXml } = await readDocxCoreXml(zip);
        const expanded = await window.Qisi.DocxFormulaSource.expand(
            documentXml, parseRelationships(relsXml), zip, { signal: context.signal });
        const numberingEntry = zip.file('word/numbering.xml');
        expanded.xml = expandWordLetterNumbering(expanded.xml, numberingEntry ? await numberingEntry.async('string') : '');
        const mediaMap = await buildMediaMaps(zip, relsXml, fileRecord.filename);
        const blocks = buildQuestionBlocksFromDocumentXml(expanded.xml);
        const originalBlocks = new Map(buildQuestionBlocksFromDocumentXml(documentXml)
            .map(block => [block.q, block.rawXmlParts.join('\n')]));
        const supportImages = [];
        const supportParagraphs = splitDocxParagraphs(expanded.xml);
        const supportHeading = supportParagraphs.findIndex(paragraph =>
            /^(?:《[^》]+》\s*)?(?:参考答案(?:及|与)?(?:解析|详解)?|答案(?:及|与)(?:解析|详解))$/.test(paragraph.text));
        const supportText = (supportHeading >= 0 ? supportParagraphs.slice(supportHeading + 1) : supportParagraphs).map(paragraph =>
            xmlFragmentToRenderableText(paragraph.rawXml, mediaMap, supportImages, 'support')
        ).join('\n');

        const drafts = blocks.map((block, index) => {
            const parsedOptions = parseOptionsFromBlock(block, mediaMap, helpers);
            const optionImages = parsedOptions.optionImages || [];
            const stem = parseStemFromBlock(block, parsedOptions.renderableText || '');

            const type = block.sectionType || (optionCount(parsedOptions.options) >= 2
                ? '\u5355\u9009\u9898'
                : (defaultMeta.defaultType || '\u89e3\u7b54\u9898'));

            const id = helpers.makeBatchId
                ? helpers.makeBatchId('dq')
                : `dq_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`;

            const draft = {
                id,
                batchId: fileRecord.batchId || '',
                order: index + 1,
                questionNumber: block.q,
                type,
                stem,
                options: parsedOptions.options,
                answer: '',
                solution: '',
                images: optionImages,
                questionImages: [],
                rawBlock: block.lines.join('\n'),
                renderableText: parsedOptions.renderableText || '',
                sourceFileId: fileRecord.id || '',
                sourceFileName: fileRecord.filename || '',
                sourcePage: 1,
                sourceTrace: {
                    source: 'docx-importer',
                    sourceFileId: fileRecord.id || '',
                    sourceFileName: fileRecord.filename || '',
                    questionNo: block.q,
                    rawXml: originalBlocks.get(block.q) || '',
                    formulas: expanded.formulas.filter(formula =>
                        extractRelationshipIdsFromXml(originalBlocks.get(block.q) || '').includes(formula.rid)),
                    optionSource: parsedOptions.source,
                    hasUndisplayableOption: parsedOptions.hasUndisplayable,
                    blockTextHead: block.lines.join('\n').slice(0, 500)
                },
                warnings: [
                    ...(parsedOptions.hasUndisplayable
                        ? ['DOCX contains WMF/EMF/OLE option images; placeholders are shown for review.']
                        : [])
                ],
                status: 'pending',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            console.log('[BATCH_IMPORTER][docx-draft]', {
                q: draft.questionNumber,
                type: draft.type,
                optionCount: optionCount(draft.options),
                optionA: draft.options[0] || '',
                optionB: draft.options[1] || '',
                optionC: draft.options[2] || '',
                optionD: draft.options[3] || '',
                stemHead: draft.stem.slice(0, 120),
                optionImageCount: optionImages.length,
                warningCount: draft.warnings.length
            });

            return draft;
        });

        return {
            drafts,
            draftImages,
            unmatchedAnswers: [],
            warnings,
            supportText,
            supportSectionDeclared: supportHeading >= 0,
            supportImages,
            formulaEvidence: expanded.formulas,
            rawDocumentXml: documentXml,
            debug: {
                blockCount: blocks.length,
                mediaCount: mediaMap.size
            }
        };
    };

    const parsePdfFile = async (fileRecord, context = {}) => {
        const helper = context.helpers?.parsePdfFileLegacy;
        if (typeof helper === 'function') return await helper(fileRecord, context);
        return {
            drafts: [],
            draftImages: [],
            unmatchedAnswers: [],
            warnings: ['PDF parsing is delegated to the legacy app parser.'],
            debug: {}
        };
    };

    const processBatch = async ({
        batch,
        files,
        defaultMeta = {},
        helpers = {}
    }) => {
        const result = {
            drafts: [],
            draftImages: [],
            unmatchedAnswers: [],
            warnings: [],
            debug: {}
        };

        for (const file of files || []) {
            if (file.fileType === 'docx') {
                const docxResult = await parseDocxFile(file, { batch, defaultMeta, helpers });
                result.drafts.push(...(docxResult.drafts || []));
                result.draftImages.push(...(docxResult.draftImages || []));
                result.unmatchedAnswers.push(...(docxResult.unmatchedAnswers || []));
                result.warnings.push(...(docxResult.warnings || []));
                Object.assign(result.debug, docxResult.debug || {});
                continue;
            }

            if (file.fileType === 'pdf') {
                const pdfResult = await parsePdfFile(file, { batch, defaultMeta, helpers });
                result.drafts.push(...(pdfResult.drafts || []));
                result.draftImages.push(...(pdfResult.draftImages || []));
                result.unmatchedAnswers.push(...(pdfResult.unmatchedAnswers || []));
                result.warnings.push(...(pdfResult.warnings || []));
                Object.assign(result.debug, pdfResult.debug || {});
            }
        }

        return result;
    };

    window.QisiBatchImporter = {
        processBatch,
        parseDocxFile,
        parsePdfFile,
        extractDocxQuestionSkeleton
    };
})();
