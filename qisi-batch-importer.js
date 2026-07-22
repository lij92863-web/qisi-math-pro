(function () {
    const console = window.Qisi?.Runtime?.console || globalThis.console;

    const dataUrlToArrayBuffer = async (dataUrl) => {
        const res = await fetch(dataUrl);
        return await res.arrayBuffer();
    };

    const loadDocxZip = async (fileRecord) => {
        if (!window.JSZip) throw new Error('JSZip not loaded, cannot parse DOCX.');
        const buffer = await dataUrlToArrayBuffer(fileRecord.uploadPath);
        return await window.JSZip.loadAsync(buffer);
    };

    const readDocxCoreXml = async (zip) => {
        const documentXml = await zip.file('word/document.xml')?.async('text') || '';
        const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('text').catch(() => '') || '';
        const numberingXml = await zip.file('word/numbering.xml')?.async('text').catch(() => '') || '';
        return { documentXml, relsXml, numberingXml };
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

    const parseLeadingQuestionMarker = (
        value = ''
    ) => {
        const source =
            normalizeDocxText(value);

        const imagePrefixLength =
            consumeLeadingImageTokens(source);

        const markerSource =
            source.slice(imagePrefixLength);

        const match = markerSource.match(
            /^\s*((?:\d\s*){1,3})[.\uFF0E\u3001\u3002)\uFF09]\s*/
        );
        if (!match) {
            return {
                source,
                questionNumber: '',
                markerLength: 0,
                rawMarker: ''
            };
        }

        const compactDigits =
            String(match[1] || '')
                .replace(/\s+/g, '');

        const numericValue =
            Number(compactDigits);

        if (
            !Number.isInteger(numericValue) ||
            numericValue <= 0 ||
            numericValue > 999
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
        // Keep unsupported vector evidence explicit and machine-detectable. The
        // deterministic importer remains the primary source; a later visual
        // supplement may replace this marker under the question-number contract.
        return `[公式图片待转换:${ext}]`;
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
        const richFlow = window.Qisi?.DocxRichContent?.extractTopLevelWordBlocks?.(documentXml);
        const paragraphXml = Array.isArray(richFlow)
            ? richFlow.filter(block => block?.kind === 'paragraph').map(block => block.xml)
            : (String(documentXml || '').match(/<w:p[\s\S]*?<\/w:p>/g) || []);

        paragraphXml.forEach(pXml => {
            const text = extractTextFromXmlFragment(pXml);
            const hasObject = /<w:object\b|<w:drawing\b|<v:imagedata\b|<o:OLEObject\b/.test(pXml);

            if (text || hasObject) {
                paragraphs.push({
                    text,
                    rawXml: pXml,
                    hasObject
                });
            }

        });

        return paragraphs;
    };

    const getQuestionNoFromLine = (
        line = ''
    ) => {
        return parseLeadingQuestionMarker(
            line
        ).questionNumber;
    };

    const isQuestionSectionHeading = (value = '') => /^(?:(?:第[一二三四五六七八九十ⅠⅡⅢIVX]+卷)|(?:[一二三四五六七八九十]+|\d+)\s*[、.．]\s*)?(?:单项选择题|多项选择题|单选题|多选题|选择题|填空题|解答题|计算题|证明题|综合题)(?=\s*(?:[（(:：]|$))/u.test(
        normalizeDocxText(value)
    );

    const hasSubstantiveQuestionStart = (paragraph = {}) => {
        const source = normalizeDocxText(paragraph?.text || paragraph?.serialized || '');
        const marker = parseLeadingQuestionMarker(source);
        const content = marker.questionNumber
            ? source.slice(marker.markerLength)
            : Number.isInteger(paragraph?.numbering?.value) && Number(paragraph?.numbering?.level) === 0
                ? source
                : '';
        return /[A-Za-z\u3400-\u9fff]|\\[A-Za-z]+|\[\[IMAGE(?::|\])/u.test(content);
    };

    const questionSectionBody = (paragraphs = []) => {
        const partition = window.Qisi?.DocxSupportContent
            ?.partitionQuestionAndSupportBlocks?.(paragraphs);
        const questionParagraphs = partition?.hasSupportHeading
            ? partition.questionBlocks
            : paragraphs;
        const firstSectionIndex = questionParagraphs.findIndex(paragraph =>
            isQuestionSectionHeading(paragraph?.text || paragraph?.serialized || '')
        );
        const hasQuestionBeforeSection = firstSectionIndex > 0 && questionParagraphs
            .slice(0, firstSectionIndex)
            .some(hasSubstantiveQuestionStart);
        return firstSectionIndex >= 0 && !hasQuestionBeforeSection
            ? questionParagraphs.slice(firstSectionIndex)
            : questionParagraphs;
    };

    const buildQuestionBlocksFromDocumentXml = (documentXml = '', numberingXml = '') => {
        const resolveNumbering = window.Qisi?.DocxRichContent?.createDocxNumberingResolver?.(numberingXml);
        const paragraphs = splitDocxParagraphs(documentXml).map(paragraph => ({
            ...paragraph,
            numbering: typeof resolveNumbering === 'function'
                ? resolveNumbering(paragraph.rawXml || '')
                : null
        }));
        const blocks = [];
        let current = null;

        for (const p of questionSectionBody(paragraphs)) {
            if (isQuestionSectionHeading(p.text || '')) {
                if (current) blocks.push(current);
                current = null;
                continue;
            }
            const qNo = getQuestionNoFromLine(p.text || '') || (
                Number.isInteger(p.numbering?.value) && Number(p.numbering?.level) === 0
                    && (!p.numbering?.numFmt || p.numbering.numFmt === 'decimal')
                    ? String(p.numbering.value)
                    : ''
            );

            if (qNo) {
                if (current) blocks.push(current);

                current = {
                    q: qNo,
                    lines: [p.text || p.numbering?.display || ''],
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

    const buildDocxQuestionSkeletonFromXml = (documentXml = '', numberingXml = '') => (
        buildQuestionSkeletonFromBlocks(
            buildQuestionBlocksFromDocumentXml(documentXml, numberingXml)
        )
    );

    const prepareDocxQuestionRichBlocks = (richBlocks = []) => (
        questionSectionBody(richBlocks).map(block => {
            const numbering = block.numbering || {};
            const serialized = String(block.serialized || '');
            if (
                !Number.isInteger(numbering.value) ||
                Number(numbering.level) !== 0 ||
                getQuestionNoFromLine(serialized)
            ) {
                return block;
            }

            if (!numbering.numFmt || numbering.numFmt === 'decimal') {
                return {
                    ...block,
                    serialized: `${numbering.display || `${numbering.value}.`} ${serialized}`.trim()
                };
            }

            if (numbering.numFmt === 'upperLetter') {
                const optionLabel = String(numbering.display || '')
                    .match(/^\s*([A-D])(?:\s*[.．、)])?\s*$/)?.[1] || '';
                const alreadyLabelled = /^\s*[A-D]\s*[.．、)]/i.test(serialized);
                if (optionLabel && !alreadyLabelled) {
                    return {
                        ...block,
                        serialized: `${optionLabel}. ${serialized}`.trim()
                    };
                }
            }

            return block;
        })
    );

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
            documentXml,
            numberingXml
        } = await readDocxCoreXml(zip);

        if (!documentXml) {
            throw new Error(
                'DOCX missing word/document.xml.'
            );
        }

        const skeleton = buildDocxQuestionSkeletonFromXml(
            documentXml,
            numberingXml
        );

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

        const labelRe = /(^|[\n\r\s,;，；。:：、])([A-D])\s*(?:[.\uFF0E\u3001\u3002)\uFF09]|(?=\s*(?:\$|\\|\[\[IMAGE:|\[[^\]]+\]|[0-9\u4e00-\u9fffA-Za-z])))/g;
        const hits = [];
        let match;

        while ((match = labelRe.exec(joined)) !== null) {
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
                options[idx] = `[公式图片选项待转换:${ext}]`;
                continue;
            }
        }

        return { options, optionImages, hasUndisplayable };
    };

    const hasUndisplayableFormulaPlaceholder = value => (
        /\[公式图片(?:选项)?待转换:[^\]]+\]/i.test(String(value || ''))
    );

    const parseOptionsFromBlock = (block, mediaMap, helpers = {}) => {
        const blockRawXml = block.rawXmlParts.join('\n');
        const blockText = block.lines.join('\n');
        const inlineImages = [];

        const renderableText = xmlFragmentToRenderableText(blockRawXml, mediaMap, inlineImages, block.q);

        let options = parseInlineTextOptions(renderableText, helpers);
        if (optionCount(options) >= 2) {
            return {
                options,
                optionImages: inlineImages,
                hasUndisplayable: options.some(hasUndisplayableFormulaPlaceholder),
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
        const idx = source.search(/(?:^|\s)A\s*[.\uFF0E\u3001\u3002)\uFF09]/);
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
        const blockText = renderableText || block.lines.join('\n');
        return stripQuestionNo(stripOptionsFromStemText(blockText));
    };

    const assertRichMathIntegrity = (rich, documentXml, translation) => {
        const expectedPreviewRids = [...new Set(
            rich.collectMathTypeObjectLinks(documentXml).map(link => String(link.previewRid))
        )];
        const missing = expectedPreviewRids.filter(rid => !translation.mathByRid.has(rid));
        const conflicts = (translation.diagnostics || []).filter(row => row.code === 'OLE_PREVIEW_CONTENT_CONFLICT');
        if (!missing.length && !conflicts.length) return expectedPreviewRids;

        const error = new Error(`DOCX MathType content integrity failed: ${missing.length} formula(s) unresolved.`);
        error.code = 'DOCX_MATHTYPE_INTEGRITY_BLOCKED';
        error.diagnostics = { missingPreviewRids: missing, conflicts };
        throw error;
    };

    const imageFromRichAsset = asset => ({
        id: asset.assetId,
        filename: `${asset.assetId}.${asset.ext || 'png'}`,
        name: `${asset.assetId}.${asset.ext || 'png'}`,
        url: asset.url,
        align: 'center',
        source: 'docx-rich-content',
        displayable: true,
        ext: asset.ext,
        mime: asset.mime,
        rid: asset.rid,
        target: asset.target,
        anchorType: asset.anchorType,
        dimensions: asset.dimensions,
        layout: asset.layout || null,
        paragraphIndex: asset.paragraphIndex,
        contentHash: asset.contentHash
    });

    const buildRichDraft = (question, index, fileRecord, helpers, defaultMeta) => {
        const assets = question.assets || [];
        const undisplayable = assets.filter(asset => !asset.url || !/^(png|jpe?g|gif|webp|svg)$/i.test(asset.ext || ''));
        if (undisplayable.length) {
            const error = new Error(`DOCX contains ${undisplayable.length} non-renderable anchored image(s).`);
            error.code = 'DOCX_IMAGE_INTEGRITY_BLOCKED';
            error.diagnostics = undisplayable.map(asset => ({ rid: asset.rid, target: asset.target, ext: asset.ext }));
            throw error;
        }

        const id = helpers.makeBatchId
            ? helpers.makeBatchId('dq')
            : `dq_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`;
        const rawBlock = (question.richBlocks || []).map(block => block.serialized || '').join('\n');
        const questionLayout = window.Qisi?.DocxLayout?.buildQuestionLayout
            ? window.Qisi.DocxLayout.buildQuestionLayout({
                options: question.options || [],
                richBlocks: question.richBlocks || []
            })
            : null;
        return {
            id,
            batchId: fileRecord.batchId || '',
            order: index + 1,
            questionNumber: String(question.number),
            questionKey: question.questionKey,
            type: question.type === '未知题型' ? (defaultMeta.defaultType || '解答题') : question.type,
            stem: question.stem,
            options: question.options,
            answer: '',
            solution: '',
            images: assets.map(imageFromRichAsset),
            questionImages: assets.map(imageFromRichAsset),
            layout: questionLayout,
            richBlocks: question.richBlocks,
            rawBlock,
            renderableText: rawBlock,
            sourceFileId: fileRecord.id || '',
            sourceFileName: fileRecord.filename || '',
            sourcePage: 1,
            sourceTrace: {
                source: 'docx-rich-content',
                sourceFileId: fileRecord.id || '',
                sourceFileName: fileRecord.filename || '',
                questionNo: String(question.number),
                questionKey: question.questionKey,
                sourceParagraphRange: question.sourceParagraphRange,
                imageIds: assets.map(asset => asset.assetId),
                blockTextHead: rawBlock.slice(0, 2000)
            },
            warnings: [],
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
    };

    const parseDocxFile = async (fileRecord, context = {}) => {
        const helpers = context.helpers || {};
        const defaultMeta = context.defaultMeta || {};
        const rich = window.Qisi?.DocxRichContent;
        if (!rich) throw new Error('Qisi.DocxRichContent is not loaded.');
        const zip = await loadDocxZip(fileRecord);
        const { documentXml, relsXml, numberingXml } = await readDocxCoreXml(zip);
        const mediaMap = await buildMediaMaps(zip, relsXml, fileRecord.filename);
        const objectLinks = rich.collectMathTypeObjectLinks(documentXml);
        const translation = await rich.translateMathTypeMedia(mediaMap, { objectLinks });
        const expectedFormulaRids = assertRichMathIntegrity(rich, documentXml, translation);
        const richBlocks = rich.extractDocxRichBlocks(documentXml, {
            fileId: fileRecord.id || fileRecord.filename || 'docx',
            mediaMap,
            mathByRid: translation.mathByRid,
            numberingXml
        });
        const support = window.Qisi?.DocxSupportContent;
        const documentPartition = support?.partitionQuestionAndSupportBlocks?.(richBlocks) || {
            hasSupportHeading: false,
            questionBlocks: richBlocks,
            supportBlocks: []
        };
        const questionBlocks = prepareDocxQuestionRichBlocks(richBlocks);
        const parsed = rich.parseQuestionRichBlocks(questionBlocks);
        const formulaErrors = richBlocks.flatMap(block => block.diagnostics || []).filter(row => row.kind === 'formula-error');
        if (!parsed.ok || formulaErrors.length) {
            const error = new Error('DOCX rich-content state machine could not preserve every formula or question boundary.');
            error.code = 'DOCX_RICH_CONTENT_INTEGRITY_BLOCKED';
            error.diagnostics = { parser: parsed.diagnostics, formulaErrors };
            throw error;
        }
        let alignedSupport = null;
        let embeddedSupportWarnings = [];
        let embeddedUnmatchedAnswers = [];
        const roles = Array.isArray(fileRecord?.roles)
            ? fileRecord.roles
            : [fileRecord?.role].filter(Boolean);
        if (roles.includes('full') && documentPartition.hasSupportHeading) {
            if (!support) throw new Error('Qisi.DocxSupportContent is not loaded.');
            const parsedSupport = support.parseAnswerRichBlocks(documentPartition.supportBlocks, {
                allowNumberedAnswerMarkers: true
            });
            if (!parsedSupport.ok) {
                const recoverableCodes = new Set([
                    'DOCX_SUPPORT_DUPLICATE_KEY',
                    'DOCX_SUPPORT_ANSWER_MISSING'
                ]);
                const recoverable = parsedSupport.diagnostics.every(row => recoverableCodes.has(row?.code));
                if (!recoverable || !support.alignQuestionAndSupportSafePartial) {
                    const error = new Error('Combined DOCX answer/analysis section failed explicit-boundary validation.');
                    error.code = 'DOCX_SUPPORT_CONTENT_INTEGRITY_BLOCKED';
                    error.diagnostics = parsedSupport.diagnostics;
                    throw error;
                }
                alignedSupport = support.alignQuestionAndSupportSafePartial(
                    parsed.questions,
                    parsedSupport.items
                );
                if (alignedSupport.ok) {
                    const unresolvedNumbers = alignedSupport.diagnostics.missingKeys
                        .map(key => key.match(/\/q-(\d+)$/)?.[1] || '')
                        .filter(Boolean);
                    embeddedSupportWarnings = [
                        `合并 DOCX 的答案区存在重复、缺失或空答案题号；已按显式题号安全挂载，其余留待复核：${unresolvedNumbers.join('、') || '未知'}`
                    ];
                    embeddedUnmatchedAnswers = (alignedSupport.rejected || []).map(row => ({
                        question: String(row?.support?.number || ''),
                        answer: String(row?.support?.answer || ''),
                        sourceFile: fileRecord.filename || '',
                        reason: row.reason
                    }));
                }
            } else {
                alignedSupport = support.alignQuestionAndSupportByKey(parsed.questions, parsedSupport.items);
            }
            if (!alignedSupport?.ok) {
                const error = new Error('Combined DOCX answer/analysis sequence does not match the question skeleton.');
                error.code = alignedSupport.code || 'DOCX_SUPPORT_KEY_MISMATCH';
                error.diagnostics = alignedSupport.diagnostics;
                throw error;
            }
        }

        const supportByQuestionKey = new Map((alignedSupport?.items || []).map(row => [
            row.question.questionKey,
            row.support
        ]));
        const drafts = parsed.questions.map((question, index) => {
            const draft = buildRichDraft(question, index, fileRecord, helpers, defaultMeta);
            const supportItem = supportByQuestionKey.get(question.questionKey);
            if (!supportItem) return draft;
            return {
                ...draft,
                answer: supportItem.answer,
                solution: supportItem.solution,
                solutionRichBlocks: supportItem.richBlocks,
                recognizedSolutionImages: supportItem.analysisImages.map(imageFromRichAsset)
            };
        });

        return {
            drafts,
            draftImages: [],
            unmatchedAnswers: embeddedUnmatchedAnswers,
            warnings: embeddedSupportWarnings,
            debug: {
                blockCount: richBlocks.length,
                mediaCount: mediaMap.size,
                questionCount: drafts.length,
                embeddedSupportCount: supportByQuestionKey.size,
                hasEmbeddedSupportHeading: documentPartition.hasSupportHeading,
                embeddedSupportAlignmentCode: alignedSupport?.code || '',
                embeddedSupportDiagnostics: alignedSupport?.diagnostics || null,
                expectedFormulaCount: expectedFormulaRids.length,
                translatedFormulaCount: translation.mathByRid.size,
                formulaDiagnostics: translation.diagnostics
            }
        };
    };

    const parseDocxSupportFile = async (fileRecord) => {
        const rich = window.Qisi?.DocxRichContent;
        const support = window.Qisi?.DocxSupportContent;
        if (!rich || !support) throw new Error('DOCX rich/support content modules are not loaded.');

        const zip = await loadDocxZip(fileRecord);
        const { documentXml, relsXml, numberingXml } = await readDocxCoreXml(zip);
        const mediaMap = await buildMediaMaps(zip, relsXml, fileRecord.filename);
        const objectLinks = rich.collectMathTypeObjectLinks(documentXml);
        const translation = await rich.translateMathTypeMedia(mediaMap, { objectLinks });
        assertRichMathIntegrity(rich, documentXml, translation);
        const richBlocks = rich.extractDocxRichBlocks(documentXml, {
            fileId: fileRecord.id || fileRecord.filename || 'docx-support',
            mediaMap,
            mathByRid: translation.mathByRid,
            numberingXml
        });
        const documentPartition = support.partitionQuestionAndSupportBlocks(richBlocks);
        const supportBlocks = documentPartition.hasSupportHeading
            ? documentPartition.supportBlocks
            : richBlocks;
        const parsed = support.parseAnswerRichBlocks(supportBlocks, {
            allowNumberedAnswerMarkers: documentPartition.hasSupportHeading
        });
        if (!parsed.ok) {
            const error = new Error('DOCX answer/analysis content failed explicit-boundary validation.');
            error.code = 'DOCX_SUPPORT_CONTENT_INTEGRITY_BLOCKED';
            error.diagnostics = parsed.diagnostics;
            throw error;
        }

        const supportItems = parsed.items.map(item => {
            const undisplayable = item.analysisImages.filter(asset => !asset.url || !/^(png|jpe?g|gif|webp|svg)$/i.test(asset.ext || ''));
            if (undisplayable.length) {
                const error = new Error(`DOCX support contains ${undisplayable.length} non-renderable analysis image(s).`);
                error.code = 'DOCX_SUPPORT_IMAGE_INTEGRITY_BLOCKED';
                error.diagnostics = undisplayable;
                throw error;
            }
            return {
                ...item,
                question: String(item.number),
                questionNumber: String(item.number),
                images: item.analysisImages.map(imageFromRichAsset),
                sourceFileId: fileRecord.id || '',
                sourceFileName: fileRecord.filename || '',
                sourceTrace: {
                    source: 'docx-support-content',
                    questionKey: item.questionKey,
                    sourceParagraphRange: item.sourceParagraphRange
                }
            };
        });

        return {
            supportItems,
            answers: supportItems.map(item => ({
                question: item.question,
                questionNumber: item.questionNumber,
                questionKey: item.questionKey,
                answer: item.answer,
                sourceFileId: item.sourceFileId,
                sourceFileName: item.sourceFileName,
                sourceTrace: item.sourceTrace
            })),
            solutions: supportItems.map(item => ({
                question: item.question,
                questionNumber: item.questionNumber,
                questionKey: item.questionKey,
                solution: item.solution,
                richBlocks: item.richBlocks,
                images: item.images,
                imageRefs: item.images.map(image => image.id),
                sourceFileId: item.sourceFileId,
                sourceFileName: item.sourceFileName,
                sourceTrace: item.sourceTrace
            })),
            debug: {
                supportCount: supportItems.length,
                hasSupportHeading: documentPartition.hasSupportHeading,
                mediaCount: mediaMap.size,
                translatedFormulaCount: translation.mathByRid.size,
                formulaDiagnostics: translation.diagnostics
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
        parseDocxSupportFile,
        parsePdfFile,
        extractDocxQuestionSkeleton,
        buildDocxQuestionSkeletonFromXml,
        prepareDocxQuestionRichBlocks,
        hasUndisplayableFormulaPlaceholder
    };
})();
