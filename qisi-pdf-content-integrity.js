(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.PdfContentIntegrity = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined' ? globalThis : this,
    function () {
        'use strict';

        const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

        const normalizeRotation = value => {
            const normalized = ((Number(value) || 0) % 360 + 360) % 360;
            return [0, 90, 180, 270].includes(normalized) ? normalized : 0;
        };

        const normalizeBbox = (bbox, options = {}) => {
            if (!Array.isArray(bbox) || bbox.length !== 4) return [];

            let values = bbox.map(Number);
            if (values.some(value => !Number.isFinite(value))) return [];

            const width = Number(options.width) || 0;
            const height = Number(options.height) || 0;
            const maxCoordinate = Math.max(...values.map(Math.abs));
            const requestedSpace = String(options.space || 'auto');
            const space = requestedSpace === 'auto'
                ? (
                    maxCoordinate <= 1
                        ? 'normalized'
                        : (
                            maxCoordinate <= 1000
                                ? 'thousandths'
                                : 'pixels'
                        )
                )
                : requestedSpace;

            if (space === 'thousandths') {
                values = values.map(value => value / 1000);
            } else if (space === 'pixels' || space === 'points') {
                if (!(width > 0) || !(height > 0)) return [];
                values = [
                    values[0] / width,
                    values[1] / height,
                    values[2] / width,
                    values[3] / height
                ];
            } else if (space !== 'normalized') {
                return [];
            }

            let [x1, y1, x2, y2] = values;
            x1 = clamp01(x1);
            y1 = clamp01(y1);
            x2 = clamp01(x2);
            y2 = clamp01(y2);

            const left = Math.min(x1, x2);
            const top = Math.min(y1, y2);
            const right = Math.max(x1, x2);
            const bottom = Math.max(y1, y2);

            if (right - left <= 0 || bottom - top <= 0) return [];

            const rotation = normalizeRotation(options.rotation);
            if (!rotation) return [left, top, right, bottom];

            const rotatePoint = ([x, y]) => {
                if (rotation === 90) return [y, 1 - x];
                if (rotation === 180) return [1 - x, 1 - y];
                return [1 - y, x];
            };
            const points = [
                rotatePoint([left, top]),
                rotatePoint([right, top]),
                rotatePoint([right, bottom]),
                rotatePoint([left, bottom])
            ];

            return [
                Math.min(...points.map(point => point[0])),
                Math.min(...points.map(point => point[1])),
                Math.max(...points.map(point => point[0])),
                Math.max(...points.map(point => point[1]))
            ].map(clamp01);
        };

        const bboxArea = bbox => {
            const normalized = normalizeBbox(bbox, { space: 'normalized' });
            if (!normalized.length) return 0;
            return Math.max(0, normalized[2] - normalized[0]) *
                Math.max(0, normalized[3] - normalized[1]);
        };

        const normalizeQuestionRegionBbox = bbox => {
            const normalized = normalizeBbox(bbox, { space: 'auto' });
            if (normalized.length) return normalized;
            if (!Array.isArray(bbox) || bbox.length !== 4) return [];

            const values = bbox.map(Number);
            if (
                values.some(value => !Number.isFinite(value)) ||
                Math.max(...values.map(Math.abs)) > 1200 ||
                Math.min(...values) < -200
            ) {
                return [];
            }

            let [left, top, right, bottom] = values.map(value => value / 1000);
            if (right < left) [left, right] = [right, left];
            if (bottom < top) [top, bottom] = [bottom, top];
            const width = right - left;
            const height = bottom - top;
            if (!(width > 0) || !(height > 0) || width > 1 || height > 1) return [];

            if (left < 0) { right -= left; left = 0; }
            if (right > 1) { left -= right - 1; right = 1; }
            if (top < 0) { bottom -= top; top = 0; }
            if (bottom > 1) { top -= bottom - 1; bottom = 1; }

            return normalizeBbox([left, top, right, bottom], { space: 'normalized' });
        };

        const bboxIntersection = (left, right) => {
            const a = normalizeBbox(left, { space: 'normalized' });
            const b = normalizeBbox(right, { space: 'normalized' });
            if (!a.length || !b.length) return [];

            const result = [
                Math.max(a[0], b[0]),
                Math.max(a[1], b[1]),
                Math.min(a[2], b[2]),
                Math.min(a[3], b[3])
            ];
            return result[2] > result[0] && result[3] > result[1]
                ? result
                : [];
        };

        const bboxOverlapRatio = (subject, container) => {
            const subjectArea = bboxArea(subject);
            if (!subjectArea) return 0;
            return bboxArea(bboxIntersection(subject, container)) / subjectArea;
        };

        const toPixelCrop = (bbox, options = {}) => {
            const width = Math.max(0, Number(options.width) || 0);
            const height = Math.max(0, Number(options.height) || 0);
            if (!width || !height) return null;

            const normalized = normalizeBbox(bbox, {
                space: options.space || 'auto',
                width,
                height,
                rotation: options.rotation || 0
            });
            if (!normalized.length) return null;

            const padding = Math.max(0, Number(options.padding) || 0);
            const left = Math.max(0, Math.floor(normalized[0] * width - padding));
            const top = Math.max(0, Math.floor(normalized[1] * height - padding));
            const right = Math.min(width, Math.ceil(normalized[2] * width + padding));
            const bottom = Math.min(height, Math.ceil(normalized[3] * height + padding));

            if (right <= left || bottom <= top) return null;
            return {
                left,
                top,
                right,
                bottom,
                width: right - left,
                height: bottom - top,
                normalized
            };
        };

        const multiplyTransformMatrices = (leftValue, rightValue) => {
            const left = Array.isArray(leftValue) && leftValue.length >= 6
                ? leftValue.map(Number)
                : [1, 0, 0, 1, 0, 0];
            const right = Array.isArray(rightValue) && rightValue.length >= 6
                ? rightValue.map(Number)
                : [1, 0, 0, 1, 0, 0];
            return [
                left[0] * right[0] + left[2] * right[1],
                left[1] * right[0] + left[3] * right[1],
                left[0] * right[2] + left[2] * right[3],
                left[1] * right[2] + left[3] * right[3],
                left[0] * right[4] + left[2] * right[5] + left[4],
                left[1] * right[4] + left[3] * right[5] + left[5]
            ];
        };

        const transformPoint = (matrix, x, y) => ([
            matrix[0] * x + matrix[2] * y + matrix[4],
            matrix[1] * x + matrix[3] * y + matrix[5]
        ]);

        const extractPlacedImageBboxes = (operatorList = {}, options = {}) => {
            const fnArray = Array.isArray(operatorList?.fnArray) ? operatorList.fnArray : [];
            const argsArray = Array.isArray(operatorList?.argsArray) ? operatorList.argsArray : [];
            const opCodes = options.opCodes || {};
            const saveCode = opCodes.save;
            const restoreCode = opCodes.restore;
            const transformCode = opCodes.transform;
            const paintCodes = new Set([
                opCodes.paintImageXObject,
                opCodes.paintJpegXObject,
                opCodes.paintInlineImageXObject
            ].filter(code => code !== undefined && code !== null));
            const viewportTransform = Array.isArray(options.viewportTransform)
                ? options.viewportTransform
                : [1, 0, 0, 1, 0, 0];
            const pageWidth = Math.max(0, Number(options.pageWidth) || 0);
            const pageHeight = Math.max(0, Number(options.pageHeight) || 0);
            if (!pageWidth || !pageHeight || !paintCodes.size) return [];

            let current = [1, 0, 0, 1, 0, 0];
            const stack = [];
            const placements = [];

            fnArray.forEach((fn, opIndex) => {
                const args = Array.isArray(argsArray[opIndex]) ? argsArray[opIndex] : [];
                if (fn === saveCode) {
                    stack.push([...current]);
                    return;
                }
                if (fn === restoreCode) {
                    current = stack.pop() || [1, 0, 0, 1, 0, 0];
                    return;
                }
                if (fn === transformCode && args.length >= 6) {
                    current = multiplyTransformMatrices(current, args.slice(0, 6));
                    return;
                }
                if (!paintCodes.has(fn)) return;

                const device = multiplyTransformMatrices(viewportTransform, current);
                const points = [
                    transformPoint(device, 0, 0),
                    transformPoint(device, 1, 0),
                    transformPoint(device, 0, 1),
                    transformPoint(device, 1, 1)
                ];
                const pixelBbox = [
                    Math.min(...points.map(point => point[0])),
                    Math.min(...points.map(point => point[1])),
                    Math.max(...points.map(point => point[0])),
                    Math.max(...points.map(point => point[1]))
                ];
                const normalizedBbox = normalizeBbox(pixelBbox, {
                    space: 'pixels',
                    width: pageWidth,
                    height: pageHeight
                });
                if (!normalizedBbox.length) return;

                placements.push({
                    opIndex,
                    imageRef: typeof args[0] === 'string' ? args[0] : '',
                    normalizedBbox,
                    bbox: normalizedBbox.map(value => Math.round(value * 1000)),
                    source: 'pdf-embedded-image-placement'
                });
            });

            return placements;
        };

        const isVerifiedPdfQuestionFigure = (figureValue = {}, expectedQuestion = '') => {
            const evidence = figureValue?.sourceEvidence || {};
            const question = normalizeQuestionNumber(expectedQuestion);
            const ownerQuestion = normalizeQuestionNumber(evidence.ownerQuestion);
            const page = Number(figureValue?.sourcePage || evidence.page || 0) || 0;
            const evidencePage = Number(evidence.page || 0) || 0;
            const descriptorSource = figureValue?.image_bbox ||
                figureValue?.normalizedBbox ||
                figureValue?.bbox || [];
            const descriptorBbox = normalizeBbox(descriptorSource, {
                space: !figureValue?.image_bbox && figureValue?.normalizedBbox
                    ? 'normalized'
                    : 'auto'
            });
            const evidenceBbox = normalizeBbox(evidence.bbox || [], {
                space: 'normalized'
            });
            const sameBbox = descriptorBbox.length === 4 && evidenceBbox.length === 4 &&
                descriptorBbox.every((value, index) => Math.abs(value - evidenceBbox[index]) <= 0.002);

            return Boolean(
                figureValue?.source === 'pdf-embedded-image-placement' &&
                figureValue?.contentRole === 'question' &&
                figureValue?.anchorField === 'stem' &&
                evidence.validation === 'pdf-local-layout-v1' &&
                question && ownerQuestion === question &&
                page && page === evidencePage &&
                sameBbox
            );
        };

        const buildSupportQuestionRegions = (layouts = [], options = {}) => {
            const pages = (Array.isArray(layouts) ? layouts : [])
                .map((page, index) => ({
                    ...page,
                    pageNo: Math.max(1, Number(page?.pageNo || page?.page || index + 1))
                }))
                .sort((left, right) => left.pageNo - right.pageNo);
            const expected = (options.expectedQuestionNumbers || [])
                .map(normalizeQuestionNumber)
                .filter(Boolean);
            const expectedSet = new Set(expected);
            const markers = [];

            pages.forEach(page => {
                (page.lines || []).forEach((line, lineIndex) => {
                    const text = String(line?.text || '').trim();
                    const match = text.match(/^\s*(\d{1,3})\s*【\s*答案\s*】/);
                    if (!match) return;
                    const question = normalizeQuestionNumber(match[1]);
                    if (!question || (expectedSet.size && !expectedSet.has(question))) return;
                    const topRaw = Number(line?.ny1 ?? line?.y1 ?? 0);
                    const top = topRaw > 1 ? topRaw / 1000 : topRaw;
                    markers.push({
                        question,
                        page: page.pageNo,
                        top: Math.max(0, Math.min(1, top)),
                        lineIndex,
                        text
                    });
                });
            });
            markers.sort((left, right) => left.page - right.page || left.top - right.top);

            const warnings = [];
            const markerNumbers = markers.map(marker => marker.question);
            const duplicateNumbers = [...new Set(
                markerNumbers.filter((number, index, values) => values.indexOf(number) !== index)
            )];
            if (duplicateNumbers.length) {
                warnings.push({ code: 'duplicate-support-question-marker', questionNumbers: duplicateNumbers });
            }
            if (expected.length) {
                const missing = expected.filter(number => !markerNumbers.includes(number));
                if (missing.length) warnings.push({ code: 'missing-support-question-marker', questionNumbers: missing });
                if (markerNumbers.join(',') !== expected.join(',')) {
                    warnings.push({
                        code: 'support-question-marker-sequence-mismatch',
                        expected,
                        actual: markerNumbers
                    });
                }
            } else if (markerNumbers.some((number, index) => index && Number(number) <= Number(markerNumbers[index - 1]))) {
                warnings.push({ code: 'support-question-marker-sequence-not-increasing', actual: markerNumbers });
            }

            if (warnings.length) return { ok: false, markers, regions: [], warnings };

            const pageNos = pages.map(page => page.pageNo);
            const regions = [];
            markers.forEach((marker, markerIndex) => {
                const next = markers[markerIndex + 1] || null;
                pageNos.forEach(pageNo => {
                    if (pageNo < marker.page) return;
                    if (next && pageNo > next.page) return;
                    const y1 = pageNo === marker.page ? marker.top : 0;
                    const y2 = next && pageNo === next.page ? next.top : 1;
                    if (y2 <= y1) return;
                    regions.push({
                        id: marker.question,
                        question: marker.question,
                        questionNumber: marker.question,
                        page: pageNo,
                        normalizedBbox: [0, y1, 1, y2],
                        boundarySource: next ? 'next-explicit-answer-marker' : 'document-end'
                    });
                });
            });

            return { ok: true, markers, regions, warnings: [] };
        };

        const extractLeadingQuestionMarker = textValue => {
            const text = String(textValue || '')
                .replace(/[\uFF10-\uFF19]/g, char =>
                    String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
                );
            const match = text.match(/^\s*((?:\d\s*){1,3})[.．、]\s*/);
            if (!match) return null;
            const question = normalizeQuestionNumber(match[1].replace(/\s+/g, ''));
            return question ? { question, evidence: match[0] } : null;
        };

        const buildQuestionTextRegions = (layouts = [], options = {}) => {
            const pages = (Array.isArray(layouts) ? layouts : [])
                .map((page, index) => ({
                    ...page,
                    pageNo: Math.max(1, Number(page?.pageNo || page?.page || index + 1))
                }))
                .sort((left, right) => left.pageNo - right.pageNo);
            const expected = (options.expectedQuestionNumbers || [])
                .map(normalizeQuestionNumber)
                .filter(Boolean);
            const expectedSet = new Set(expected);
            const markers = [];

            pages.forEach(page => {
                (page.lines || []).forEach((line, lineIndex) => {
                    const text = String(line?.text || '').trim();
                    const marker = extractLeadingQuestionMarker(text);
                    if (!marker) return;
                    const question = marker.question;
                    if (!question || (expectedSet.size && !expectedSet.has(question))) return;
                    const topRaw = Number(line?.ny1 ?? line?.y1 ?? 0);
                    const top = topRaw > 1 ? topRaw / 1000 : topRaw;
                    markers.push({
                        question,
                        page: page.pageNo,
                        top: Math.max(0, Math.min(1, top)),
                        lineIndex,
                        text
                    });
                });
            });
            markers.sort((left, right) => left.page - right.page || left.top - right.top);

            const actual = markers.map(marker => marker.question);
            const warnings = [];
            const duplicates = [...new Set(
                actual.filter((number, index, values) => values.indexOf(number) !== index)
            )];
            if (duplicates.length) {
                warnings.push({ code: 'duplicate-question-text-marker', questionNumbers: duplicates });
            }
            const sequenceNotIncreasing = actual.some((number, index) =>
                index && Number(number) <= Number(actual[index - 1])
            );
            if (sequenceNotIncreasing) {
                warnings.push({ code: 'question-text-marker-sequence-not-increasing', actual });
            }
            const complete = !expected.length || actual.join(',') === expected.join(',');
            if (expected.length && !complete) {
                warnings.push({ code: 'question-text-marker-sequence-mismatch', expected, actual });
            }
            if (duplicates.length || sequenceNotIncreasing) {
                return { ok: false, complete, markers, regions: [], warnings };
            }

            const pageNos = pages.map(page => page.pageNo);
            const regions = [];
            markers.forEach((marker, markerIndex) => {
                const next = markers[markerIndex + 1] || null;
                if (expected.length) {
                    const expectedIndex = expected.indexOf(marker.question);
                    const nextExpected = expected[expectedIndex + 1] || null;
                    if (nextExpected && next?.question !== nextExpected) return;
                }
                pageNos.forEach(pageNo => {
                    if (pageNo < marker.page) return;
                    if (next && pageNo > next.page) return;
                    const y1 = pageNo === marker.page ? marker.top : 0;
                    const y2 = next && pageNo === next.page ? next.top : 1;
                    if (y2 <= y1) return;
                    regions.push({
                        id: marker.question,
                        question: marker.question,
                        questionNumber: marker.question,
                        page: pageNo,
                        normalizedBbox: [0, y1, 1, y2]
                    });
                });
            });

            return { ok: true, complete, markers, regions, warnings };
        };

        const extractFourLabeledOptions = textValue => {
            const text = String(textValue || '').replace(/\s+/g, ' ').trim();
            const matches = [...text.matchAll(/(?:^|\s)([A-D])[.．、]\s*/g)];
            const sequence = matches.map(match => match[1]);
            if (sequence.join('') !== 'ABCD') return null;

            const options = matches.map((match, index) => {
                const start = Number(match.index) + match[0].length;
                const end = index + 1 < matches.length ? Number(matches[index + 1].index) : text.length;
                return text.slice(start, end)
                    .trim()
                    .replace(/\s*:\s*/g, ':')
                    .replace(/\s+/g, ' ');
            });
            if (options.some(option => !option || option.length > 500)) return null;
            return options;
        };

        const repairMissingOptionsFromPdfText = ({
            questions = [],
            layouts = [],
            expectedQuestionNumbers = []
        } = {}) => {
            const regionReport = buildQuestionTextRegions(layouts, { expectedQuestionNumbers });
            const rows = (Array.isArray(questions) ? questions : []).map(item => ({ ...item }));
            const decisions = [];
            if (!regionReport.ok) {
                return { questions: rows, decisions, rejected: regionReport.warnings, regionReport };
            }

            const pageMap = new Map((layouts || []).map(page => [Number(page?.pageNo || page?.page || 0), page]));
            rows.forEach(item => {
                const question = normalizeQuestionNumber(item?.question || item?.questionNumber || item?.no || '');
                if (!question) return;
                const current = Array.isArray(item.options) ? item.options.map(value => String(value || '').trim()) : [];
                if (current.filter(Boolean).length >= 4) return;

                const regionLines = [];
                regionReport.regions.filter(region => region.question === question).forEach(region => {
                    const page = pageMap.get(Number(region.page));
                    for (const line of (page?.lines || [])) {
                        const lineText = String(line?.text || '');
                        if (/^\s*[一二三四五六七八九十]+\s*[、.．]\s*/.test(lineText)) break;
                        const topRaw = Number(line?.ny1 ?? line?.y1 ?? 0);
                        const bottomRaw = Number(line?.ny2 ?? line?.y2 ?? topRaw);
                        const top = topRaw > 1 ? topRaw / 1000 : topRaw;
                        const bottom = bottomRaw > 1 ? bottomRaw / 1000 : bottomRaw;
                        const middle = (top + bottom) / 2;
                        if (middle >= region.normalizedBbox[1] && middle < region.normalizedBbox[3]) {
                            regionLines.push(lineText);
                        }
                    }
                });
                const extracted = extractFourLabeledOptions(regionLines.join(' '));
                if (!extracted) return;

                const conflicts = current.some((value, index) => value && value !== extracted[index]);
                if (conflicts) return;

                item.options = extracted;
                item.contentIntegrity = {
                    ...(item.contentIntegrity || {}),
                    version: 'pdf-math-region-r1',
                    sourceEvidence: {
                        ...(item.contentIntegrity?.sourceEvidence || {}),
                        options: extracted
                    }
                };
                item.sourceTrace = {
                    ...(item.sourceTrace || {}),
                    pdfTextOptionEvidence: {
                        question,
                        options: extracted,
                        source: 'pdf-text-layer-explicit-option-labels'
                    }
                };
                decisions.push({
                    question,
                    options: extracted,
                    source: 'pdf-text-layer-explicit-option-labels'
                });
            });

            return { questions: rows, decisions, rejected: regionReport.warnings || [], regionReport };
        };

        const bindPlacedFiguresToSolutions = ({
            solutions = [],
            layouts = [],
            pageImages = [],
            expectedQuestionNumbers = [],
            minOverlap = 0.9
        } = {}) => {
            const regionReport = buildSupportQuestionRegions(layouts, { expectedQuestionNumbers });
            const decisions = [];
            const rejected = [];
            const rows = (Array.isArray(solutions) ? solutions : []).map(item => ({ ...item }));
            if (!regionReport.ok) {
                return { solutions: rows, decisions, rejected: regionReport.warnings, regionReport };
            }

            const byQuestion = new Map();
            rows.forEach((item, index) => {
                const question = normalizeQuestionNumber(item?.question || item?.questionNumber || item?.no || '');
                if (!question) return;
                if (!byQuestion.has(question)) byQuestion.set(question, []);
                byQuestion.get(question).push({ item, index });
            });
            const imageByPage = new Map(
                (pageImages || []).map(page => [Number(page?.pageNo || page?.page || 0), page?.imageUrl || page?.url || ''])
            );

            (layouts || []).forEach(layout => {
                const page = Number(layout?.pageNo || layout?.page || 0) || 0;
                (layout?.placedImages || []).forEach(figureValue => {
                    const normalizedBbox = normalizeBbox(
                        figureValue?.normalizedBbox || figureValue?.bbox || [],
                        { space: figureValue?.normalizedBbox ? 'normalized' : 'auto' }
                    );
                    const width = normalizedBbox.length ? normalizedBbox[2] - normalizedBbox[0] : 0;
                    const height = normalizedBbox.length ? normalizedBbox[3] - normalizedBbox[1] : 0;
                    const area = bboxArea(normalizedBbox);
                    const figure = { ...figureValue, page, normalizedBbox };
                    if (!normalizedBbox.length || width < 0.08 || height < 0.06 || area < 0.008 || area > 0.35) {
                        rejected.push({ figure, reason: 'implausible-illustration-geometry' });
                        return;
                    }

                    const ownership = assignFigureOwner({
                        figure,
                        candidates: regionReport.regions,
                        minOverlap
                    });
                    if (ownership.status !== 'assigned') {
                        rejected.push({ figure, reason: ownership.reason, matches: ownership.matches });
                        return;
                    }

                    const question = normalizeQuestionNumber(ownership.owner.question || ownership.owner.id || '');
                    const solutionRows = byQuestion.get(question) || [];
                    if (solutionRows.length !== 1) {
                        rejected.push({
                            figure,
                            question,
                            reason: solutionRows.length ? 'duplicate-solution-owner' : 'solution-owner-missing'
                        });
                        return;
                    }

                    const contamination = detectCropContamination({
                        cropBbox: normalizedBbox,
                        ownerId: question,
                        page,
                        regions: regionReport.regions
                    });
                    const textContamination = detectFigureTextContamination({
                        cropBbox: normalizedBbox,
                        ownerQuestion: question,
                        lines: layout?.lines || []
                    });
                    if (contamination.contaminated || textContamination.contaminated) {
                        rejected.push({
                            figure,
                            question,
                            reason: textContamination.reason || contamination.reason,
                            contamination: textContamination.contaminated
                                ? textContamination
                                : contamination
                        });
                        return;
                    }

                    const target = solutionRows[0].item;
                    const image = {
                        image_bbox: normalizedBbox.map(value => Math.round(value * 1000)),
                        normalizedBbox,
                        image_description: 'PDF 解析原图',
                        image_confidence: 1,
                        source: 'pdf-embedded-image-placement',
                        sourcePage: page,
                        contentRole: 'solution',
                        anchorField: 'solution',
                        sourceEvidence: {
                            validation: 'pdf-local-solution-layout-v1',
                            imageRef: figureValue?.imageRef || '',
                            page,
                            bbox: normalizedBbox,
                            ownerQuestion: question,
                            ownerRegionBbox: ownership.owner.normalizedBbox,
                            ownershipSource: regionReport.source,
                            overlap: ownership.overlap
                        }
                    };
                    target.images = [...(Array.isArray(target.images) ? target.images : []), image];
                    target.sourcePage = page;
                    target.sourcePageImage = imageByPage.get(page) || target.sourcePageImage || '';
                    target.sourceTrace = {
                        ...(target.sourceTrace || {}),
                        sourcePage: page,
                        sourcePageImage: target.sourcePageImage,
                        figureSource: image.source
                    };
                    decisions.push({
                        question,
                        page,
                        bbox: image.image_bbox,
                        overlap: ownership.overlap,
                        source: image.source
                    });
                });
            });

            return { solutions: rows, decisions, rejected, regionReport };
        };

        const deriveQuestionOwnershipRegions = (candidates = []) => {
            const groups = new Map();
            (Array.isArray(candidates) ? candidates : []).forEach(candidate => {
                const normalizedBbox = normalizeBbox(
                    candidate.normalizedBbox || candidate.bbox || candidate.question_bbox || candidate.sourceBbox || [],
                    { space: candidate.normalizedBbox ? 'normalized' : (candidate.space || 'auto') }
                );
                if (!normalizedBbox.length) return;
                const page = Number(candidate.page || candidate.pageNo || candidate.sourcePage || 0) || 0;
                const sourceFileId = String(candidate.sourceFileId || '');
                const key = `${sourceFileId}::${page}`;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push({ ...candidate, page, sourceFileId, normalizedBbox });
            });

            const regions = [];
            groups.forEach(rows => {
                rows.sort((left, right) =>
                    left.normalizedBbox[1] - right.normalizedBbox[1] ||
                    left.normalizedBbox[0] - right.normalizedBbox[0]
                );
                rows.forEach((row, index) => {
                    const next = rows[index + 1];
                    const raw = row.normalizedBbox;
                    const nextTop = next?.normalizedBbox?.[1];
                    const boundaryIsOrdered = Number.isFinite(nextTop) && nextTop >= raw[3];
                    regions.push({
                        ...row,
                        rawNormalizedBbox: raw,
                        normalizedBbox: [
                            raw[0],
                            raw[1],
                            raw[2],
                            boundaryIsOrdered ? nextTop : (next ? raw[3] : 1)
                        ],
                        boundarySource: boundaryIsOrdered
                            ? 'next-question-start'
                            : (next ? 'raw-question-bbox-overlap' : 'page-end'),
                        boundaryAmbiguous: Boolean(next && !boundaryIsOrdered)
                    });
                });
            });
            return regions;
        };

        const buildValidatedQuestionBboxRegions = (
            questions = [],
            expectedQuestionNumbers = []
        ) => {
            const rows = Array.isArray(questions) ? questions : [];
            const expected = (expectedQuestionNumbers || [])
                .map(normalizeQuestionNumber)
                .filter(Boolean);
            const actual = rows
                .map(item => normalizeQuestionNumber(
                    item?.question || item?.questionNumber || item?.no || ''
                ))
                .filter(Boolean);
            const warnings = [];

            if (!expected.length || actual.join(',') !== expected.join(',')) {
                warnings.push({
                    code: 'question-bbox-sequence-mismatch',
                    expected,
                    actual
                });
            }

            const candidates = rows.map(item => {
                const question = normalizeQuestionNumber(
                    item?.question || item?.questionNumber || item?.no || ''
                );
                const normalizedBbox = normalizeBbox(
                    item?.normalizedQuestionBbox || item?.question_bbox || item?.sourceBbox || [],
                    { space: item?.normalizedQuestionBbox ? 'normalized' : 'auto' }
                );
                const page = Number(item?.sourcePage || item?.page || item?.pageNo || 0) || 0;
                return {
                    id: question,
                    question,
                    questionNumber: question,
                    sourceFileId: String(item?.sourceFileId || item?.sourceQuestionFileId || ''),
                    page,
                    normalizedBbox
                };
            });
            const invalid = candidates.filter(candidate =>
                !candidate.question || !candidate.page || !candidate.normalizedBbox.length
            );
            if (invalid.length) {
                warnings.push({
                    code: 'question-bbox-evidence-missing',
                    questionNumbers: invalid.map(candidate => candidate.question).filter(Boolean)
                });
            }

            const regions = deriveQuestionOwnershipRegions(candidates);
            const ambiguous = regions.filter(region => region.boundaryAmbiguous);
            const safeRegions = regions.filter(region => !region.boundaryAmbiguous);
            if (ambiguous.length) {
                warnings.push({
                    code: 'question-bbox-boundary-ambiguous',
                    questionNumbers: ambiguous.map(region => region.question)
                });
            }

            const ok = Boolean(expected.length) &&
                actual.join(',') === expected.join(',') &&
                !invalid.length &&
                safeRegions.length > 0;
            return {
                ok,
                complete: ok && safeRegions.length === expected.length,
                source: 'validated-question-bbox-sequence',
                regions: ok ? safeRegions : [],
                warnings
            };
        };

        const assignFigureOwner = ({ figure = {}, candidates = [], minOverlap = 0.9 } = {}) => {
            const page = Number(figure.page || figure.pageNo || figure.sourcePage || 0) || 0;
            const figureBbox = normalizeBbox(
                figure.normalizedBbox || figure.bbox || figure.image_bbox || [],
                { space: figure.normalizedBbox ? 'normalized' : (figure.space || 'auto') }
            );
            if (!figureBbox.length) {
                return { status: 'rejected', reason: 'invalid-figure-bbox', owner: null, matches: [] };
            }

            const matches = (candidates || []).map(candidate => {
                const candidatePage = Number(
                    candidate.page || candidate.pageNo || candidate.sourcePage || 0
                ) || 0;
                if (page && candidatePage && page !== candidatePage) return null;

                const bbox = normalizeBbox(
                    candidate.normalizedBbox || candidate.bbox || candidate.question_bbox || candidate.sourceBbox || [],
                    { space: candidate.normalizedBbox ? 'normalized' : (candidate.space || 'auto') }
                );
                if (!bbox.length) return null;

                return {
                    candidate,
                    overlap: bboxOverlapRatio(figureBbox, bbox)
                };
            }).filter(Boolean).sort((a, b) => b.overlap - a.overlap);

            const eligible = matches.filter(match => match.overlap >= minOverlap);
            if (eligible.length !== 1) {
                return {
                    status: 'rejected',
                    reason: eligible.length ? 'ambiguous-owner' : 'owner-overlap-below-threshold',
                    owner: null,
                    matches
                };
            }

            return {
                status: 'assigned',
                reason: '',
                owner: eligible[0].candidate,
                overlap: eligible[0].overlap,
                matches
            };
        };

        const detectCropContamination = ({ cropBbox, ownerId, page = 0, regions = [], maxForeignOverlap = 0.02 } = {}) => {
            const normalizedCrop = normalizeBbox(cropBbox, { space: 'normalized' });
            if (!normalizedCrop.length) {
                return { contaminated: true, reason: 'invalid-crop-bbox', foreignRegions: [] };
            }

            const foreignRegions = (regions || []).map(region => {
                if (String(region.id || region.question || '') === String(ownerId || '')) return null;
                const regionPage = Number(
                    region.page || region.pageNo || region.sourcePage || 0
                ) || 0;
                if (page && regionPage && Number(page) !== regionPage) return null;
                const bbox = normalizeBbox(
                    region.normalizedBbox || region.bbox || region.question_bbox || [],
                    { space: region.normalizedBbox ? 'normalized' : (region.space || 'auto') }
                );
                if (!bbox.length) return null;
                const overlap = bboxOverlapRatio(normalizedCrop, bbox);
                return overlap > maxForeignOverlap ? { ...region, overlap } : null;
            }).filter(Boolean);

            return {
                contaminated: foreignRegions.length > 0,
                reason: foreignRegions.length ? 'foreign-question-overlap' : '',
                foreignRegions
            };
        };

        const normalizedLayoutLineBbox = line => normalizeBbox(
            line?.normalizedBbox || [line?.nx1, line?.ny1, line?.nx2, line?.ny2],
            { space: line?.normalizedBbox ? 'normalized' : 'thousandths' }
        );

        const detectFigureTextContamination = ({
            cropBbox,
            ownerQuestion = '',
            lines = [],
            minLineOverlap = 0.2
        } = {}) => {
            const normalizedCrop = normalizeBbox(cropBbox, { space: 'normalized' });
            if (!normalizedCrop.length) {
                return { contaminated: true, reason: 'invalid-crop-bbox', lines: [] };
            }

            const overlapping = (Array.isArray(lines) ? lines : []).map(line => {
                const bbox = normalizedLayoutLineBbox(line);
                if (!bbox.length) return null;
                const overlap = bboxOverlapRatio(bbox, normalizedCrop);
                if (overlap < minLineOverlap) return null;
                return { text: String(line?.text || '').trim(), bbox, overlap };
            }).filter(row => row?.text);
            const owner = normalizeQuestionNumber(ownerQuestion);

            const foreignQuestion = overlapping.find(row => {
                const marker = extractLeadingQuestionMarker(row.text);
                return marker && marker.question !== owner;
            });
            if (foreignQuestion) {
                return {
                    contaminated: true,
                    reason: 'figure-crop-foreign-question',
                    lines: overlapping,
                    foreignQuestion: normalizeQuestionNumber(foreignQuestion.text)
                };
            }

            const optionLabels = new Set();
            overlapping.forEach(row => {
                for (const match of row.text.matchAll(/(?:^|\s)([A-DＡ-Ｄ])\s*[.．、:：)）]/g)) {
                    optionLabels.add(match[1].replace(/[Ａ-Ｄ]/g, char =>
                        String.fromCharCode(char.charCodeAt(0) - 65248)
                    ).toUpperCase());
                }
            });
            if (optionLabels.size >= 2) {
                return {
                    contaminated: true,
                    reason: 'figure-crop-contains-options',
                    lines: overlapping,
                    optionLabels: [...optionLabels]
                };
            }

            if (overlapping.some(row => /选择题|填空题|解答题|【\s*(?:答案|详解|解析)\s*】/.test(row.text))) {
                return { contaminated: true, reason: 'figure-crop-contains-heading', lines: overlapping };
            }

            const proseLines = overlapping.filter(row =>
                (row.text.match(/[\u4e00-\u9fff]/g) || []).length >= 8
            );
            const proseCharacters = proseLines.reduce((total, row) =>
                total + (row.text.match(/[\u4e00-\u9fff]/g) || []).length, 0
            );
            if (proseLines.length >= 2 || proseCharacters >= 18) {
                return { contaminated: true, reason: 'figure-crop-contains-prose', lines: overlapping };
            }

            return { contaminated: false, reason: '', lines: overlapping };
        };

        const bindPlacedFiguresToQuestions = ({
            questions = [],
            layouts = [],
            expectedQuestionNumbers = [],
            minOverlap = 0.9
        } = {}) => {
            const textRegionReport = buildQuestionTextRegions(layouts, { expectedQuestionNumbers });
            const decisions = [];
            const rejected = [];
            const rows = (Array.isArray(questions) ? questions : []).map(item => {
                const originalCandidates = [
                    ...(Array.isArray(item?.recognizedImages) ? item.recognizedImages : []),
                    ...(Array.isArray(item?.images) ? item.images.filter(image => !image?.url) : [])
                ];
                const safeImages = (Array.isArray(item?.images) ? item.images : [])
                    .filter(image => image?.url && image?.source !== 'auto-figure-crop');
                return {
                    ...item,
                    images: safeImages,
                    recognizedImages: [],
                    sourceTrace: {
                        ...(item?.sourceTrace || {}),
                        unverifiedRecognizedImages: originalCandidates
                    }
                };
            });
            const bboxRegionReport = buildValidatedQuestionBboxRegions(
                rows,
                expectedQuestionNumbers
            );
            const regionReport = textRegionReport.ok && textRegionReport.complete
                ? { ...textRegionReport, source: 'pdf-text-question-markers' }
                : (bboxRegionReport.ok
                    ? {
                        ...bboxRegionReport,
                        warnings: [
                            ...(textRegionReport.warnings || []),
                            ...(bboxRegionReport.warnings || [])
                        ],
                        textRegionWarnings: textRegionReport.warnings || []
                    }
                    : {
                        ok: false,
                        complete: false,
                        source: '',
                        regions: [],
                        warnings: [
                            ...(textRegionReport.warnings || []),
                            ...(bboxRegionReport.warnings || [])
                        ]
                    });
            if (!regionReport.ok) {
                return { questions: rows, decisions, rejected: regionReport.warnings, regionReport };
            }

            const byQuestion = new Map();
            rows.forEach(item => {
                const question = normalizeQuestionNumber(item?.question || item?.questionNumber || item?.no || '');
                if (!question) return;
                if (!byQuestion.has(question)) byQuestion.set(question, []);
                byQuestion.get(question).push(item);
            });

            (layouts || []).forEach(layout => {
                const page = Number(layout?.pageNo || layout?.page || 0) || 0;
                (layout?.placedImages || []).forEach(figureValue => {
                    const normalizedBbox = normalizeBbox(
                        figureValue?.normalizedBbox || figureValue?.bbox || [],
                        { space: figureValue?.normalizedBbox ? 'normalized' : 'auto' }
                    );
                    const width = normalizedBbox.length ? normalizedBbox[2] - normalizedBbox[0] : 0;
                    const height = normalizedBbox.length ? normalizedBbox[3] - normalizedBbox[1] : 0;
                    const area = bboxArea(normalizedBbox);
                    const figure = { ...figureValue, page, normalizedBbox };
                    if (!normalizedBbox.length || width < 0.06 || height < 0.04 || area < 0.003 || area > 0.45) {
                        rejected.push({ figure, reason: 'implausible-illustration-geometry' });
                        return;
                    }

                    const ownership = assignFigureOwner({
                        figure,
                        candidates: regionReport.regions,
                        minOverlap
                    });
                    if (ownership.status !== 'assigned') {
                        rejected.push({ figure, reason: ownership.reason, matches: ownership.matches });
                        return;
                    }

                    const question = normalizeQuestionNumber(ownership.owner.question || ownership.owner.id || '');
                    const targets = byQuestion.get(question) || [];
                    if (targets.length !== 1) {
                        rejected.push({
                            figure,
                            question,
                            reason: targets.length ? 'duplicate-question-owner' : 'question-owner-missing'
                        });
                        return;
                    }

                    const regionContamination = detectCropContamination({
                        cropBbox: normalizedBbox,
                        ownerId: question,
                        page,
                        regions: regionReport.regions
                    });
                    const textContamination = detectFigureTextContamination({
                        cropBbox: normalizedBbox,
                        ownerQuestion: question,
                        lines: layout?.lines || []
                    });
                    if (regionContamination.contaminated || textContamination.contaminated) {
                        const target = targets[0];
                        target.manualReviewRequired = true;
                        target.warnings = [...new Set([
                            ...(target.warnings || []),
                            '图片区域识别不可靠，已阻止错误挂载'
                        ])];
                        rejected.push({
                            figure,
                            question,
                            reason: textContamination.reason || regionContamination.reason,
                            contamination: textContamination.contaminated
                                ? textContamination
                                : regionContamination
                        });
                        return;
                    }

                    const descriptor = {
                        image_bbox: normalizedBbox.map(value => Math.round(value * 1000)),
                        normalizedBbox,
                        image_description: 'PDF 内嵌题图',
                        image_confidence: 1,
                        source: 'pdf-embedded-image-placement',
                        sourcePage: page,
                        contentRole: 'question',
                        anchorField: 'stem',
                        sourceEvidence: {
                            validation: 'pdf-local-layout-v1',
                            imageRef: figureValue?.imageRef || '',
                            page,
                            bbox: normalizedBbox,
                            ownerQuestion: question,
                            ownerRegionBbox: ownership.owner.normalizedBbox,
                            ownershipSource: regionReport.source,
                            overlap: ownership.overlap
                        }
                    };
                    targets[0].recognizedImages.push(descriptor);
                    decisions.push({
                        question,
                        page,
                        bbox: descriptor.image_bbox,
                        overlap: ownership.overlap,
                        source: descriptor.source
                    });
                });
            });

            rows.forEach(item => {
                const unverified = item.sourceTrace?.unverifiedRecognizedImages || [];
                if (!unverified.length || item.recognizedImages.length) return;
                item.manualReviewRequired = true;
                item.warnings = [...new Set([
                    ...(item.warnings || []),
                    '图片区域识别不可靠，已阻止错误挂载'
                ])];
                rejected.push({
                    question: normalizeQuestionNumber(item.question || item.questionNumber || ''),
                    reason: 'model-figure-without-local-pdf-evidence',
                    candidateCount: unverified.length
                });
            });

            return { questions: rows, decisions, rejected, regionReport };
        };

        const stripDuplicateOptionLabel = (value, expectedLabel, hasIndependentLabel = true) => {
            const source = String(value ?? '').trim();
            const label = String(expectedLabel || '').trim().toUpperCase();
            if (!hasIndependentLabel || !label) return source;

            const match = source.match(/^([A-FＡ-Ｆ])\s*(?:[.．、:：)）]|\s+)\s*([\s\S]*)$/i);
            if (!match) return source;
            const found = match[1].replace(/[Ａ-Ｆ]/g, char =>
                String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
            ).toUpperCase();
            const remainder = String(match[2] || '').trim();
            if (/^(?:=|[<>≤≥≠∈∉]|\\(?:subseteq?|supseteq?|cap|cup|in|notin|le|ge|ne)\b)/.test(remainder)) {
                return source;
            }
            return found === label ? remainder : source;
        };

        const QUESTION_STATES = Object.freeze({
            OUTSIDE_SECTION: 'OUTSIDE_SECTION',
            IN_SECTION: 'IN_SECTION',
            IN_QUESTION_STEM: 'IN_QUESTION_STEM',
            IN_OPTIONS: 'IN_OPTIONS',
            QUESTION_COMPLETE: 'QUESTION_COMPLETE'
        });

        const buildQuestionRegions = (blocks = []) => {
            const regions = [];
            const warnings = [];
            let state = QUESTION_STATES.OUTSIDE_SECTION;
            let section = '';
            let current = null;

            const finish = reason => {
                if (!current) return;
                current.completeReason = reason;
                current.state = QUESTION_STATES.QUESTION_COMPLETE;
                regions.push(current);
                current = null;
                state = section ? QUESTION_STATES.IN_SECTION : QUESTION_STATES.OUTSIDE_SECTION;
            };

            for (const block of Array.isArray(blocks) ? blocks : []) {
                const kind = String(block?.kind || block?.type || '').toLowerCase();

                if (kind === 'section') {
                    finish('next-section');
                    section = String(block.section || block.text || '').trim();
                    state = QUESTION_STATES.IN_SECTION;
                    continue;
                }

                if (kind === 'answer' || kind === 'analysis' || kind === 'solution') {
                    finish(kind);
                    continue;
                }

                if (kind === 'question') {
                    finish('next-question');
                    const question = String(
                        block.question || block.questionNumber || block.number || ''
                    ).trim();
                    if (!question) {
                        warnings.push({ code: 'QUESTION_NUMBER_MISSING', block });
                        continue;
                    }
                    current = {
                        section,
                        question,
                        subquestionPath: String(block.subquestionPath || ''),
                        pageStart: Number(block.page || block.pageNo || 0) || 0,
                        pageEnd: Number(block.page || block.pageNo || 0) || 0,
                        blocks: [block],
                        optionBlocks: [],
                        figureBlocks: [],
                        state: QUESTION_STATES.IN_QUESTION_STEM
                    };
                    state = QUESTION_STATES.IN_QUESTION_STEM;
                    continue;
                }

                if (!current) {
                    if (!['pagebreak', 'page-break'].includes(kind)) {
                        warnings.push({ code: 'ORPHAN_REGION_BLOCK', block });
                    }
                    continue;
                }

                if (kind === 'option') {
                    state = QUESTION_STATES.IN_OPTIONS;
                    current.state = state;
                    current.optionBlocks.push(block);
                    current.blocks.push(block);
                } else if (kind === 'figure') {
                    current.figureBlocks.push(block);
                    current.blocks.push(block);
                } else if (kind === 'continuation' || kind === 'text' || kind === 'pagebreak' || kind === 'page-break') {
                    const page = Number(block.page || block.pageNo || current.pageEnd || 0) || 0;
                    if (page && current.pageEnd && page > current.pageEnd + 1) {
                        warnings.push({ code: 'DISCONTINUOUS_CONTINUATION', question: current.question, block });
                        finish('discontinuous-continuation');
                        continue;
                    }
                    current.pageEnd = Math.max(current.pageEnd || 0, page);
                    current.blocks.push(block);
                } else {
                    warnings.push({ code: 'UNKNOWN_REGION_EVENT', question: current.question, block });
                }
            }

            finish('end-of-document');
            return { regions, warnings, finalState: state };
        };

        const isEscapedAt = (source, index) => {
            let count = 0;
            for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor -= 1) count += 1;
            return count % 2 === 1;
        };

        const collapseFragmentedLatexDelimiters = sourceValue => {
            const source = String(sourceValue ?? '');
            const asciiMathSpan = /([^\u4e00-\u9fff，。；：！？\n]+)/g;

            return source.replace(asciiMathSpan, span => {
                const leading = span.match(/^\s*/)?.[0] || '';
                const trailing = span.match(/\s*$/)?.[0] || '';
                const body = span.slice(leading.length, span.length - trailing.length);
                const dollarCount = [...body].filter((char, index) =>
                    char === '$' && !isEscapedAt(body, index)
                ).length;

                // A single, already-correct $...$ block is intentionally left alone.
                if (dollarCount < 4 || !/\\[A-Za-z]+/.test(body)) return span;

                const withoutDelimiters = [...body].filter((char, index) =>
                    char !== '$' || isEscapedAt(body, index)
                ).join('').trim();
                if (!withoutDelimiters || validateLatexStructure(withoutDelimiters).length) return span;

                // Do not join prose such as "$x$ and $y$". After commands are removed,
                // only single-letter variables and mathematical punctuation may remain.
                const residual = withoutDelimiters
                    .replace(/\\[A-Za-z]+/g, '')
                    .replace(/\\./g, '')
                    .replace(/\{[^{}]*\}/g, '')
                    .replace(/[0-9\s{}()[\]^_+\-*/=.,:;|<>!~]/g, '');
                if (/[A-Za-z]{2,}/.test(residual)) return span;

                return `${leading}$${withoutDelimiters}$${trailing}`;
            });
        };

        const tokenizeMathDelimiters = sourceValue => {
            const source = collapseFragmentedLatexDelimiters(sourceValue).replace(/\r\n?/g, '\n');
            const runs = [];
            const issues = [];
            let cursor = 0;
            let textStart = 0;

            const pushText = end => {
                if (end > textStart) runs.push({ kind: 'text', text: source.slice(textStart, end) });
            };

            while (cursor < source.length) {
                let open = '';
                let close = '';
                let display = false;
                if (source.startsWith('$$', cursor) && !isEscapedAt(source, cursor)) {
                    open = '$$'; close = '$$'; display = true;
                } else if (source.startsWith('\\[', cursor)) {
                    open = '\\['; close = '\\]'; display = true;
                } else if (source.startsWith('\\(', cursor)) {
                    open = '\\('; close = '\\)';
                } else if (source[cursor] === '$' && !isEscapedAt(source, cursor)) {
                    open = '$'; close = '$';
                } else {
                    cursor += 1;
                    continue;
                }

                let closeAt = -1;
                for (let index = cursor + open.length; index <= source.length - close.length; index += 1) {
                    if (source.startsWith(close, index) && !isEscapedAt(source, index)) {
                        if (close === '$' && source.startsWith('$$', index)) continue;
                        closeAt = index;
                        break;
                    }
                }
                if (closeAt < 0) {
                    issues.push({ code: 'UNCLOSED_MATH_DELIMITER', open, index: cursor });
                    cursor += open.length;
                    continue;
                }

                pushText(cursor);
                runs.push({
                    kind: 'math',
                    latex: source.slice(cursor + open.length, closeAt),
                    display,
                    original: source.slice(cursor, closeAt + close.length)
                });
                cursor = closeAt + close.length;
                textStart = cursor;
            }

            pushText(source.length);
            return { runs, issues };
        };

        const normalizePairedAbsoluteBars = value => {
            const source = String(value ?? '');
            const candidates = [];
            for (let index = 0; index < source.length; index += 1) {
                if (source[index] !== '|' || isEscapedAt(source, index)) continue;
                const prefix = source.slice(Math.max(0, index - 6), index);
                if (/\\(?:left|right)$/.test(prefix)) continue;
                candidates.push(index);
            }
            if (!candidates.length || candidates.length % 2 !== 0) return source;

            const candidateSet = new Set(candidates);
            let opening = true;
            let result = '';
            for (let index = 0; index < source.length; index += 1) {
                if (!candidateSet.has(index)) {
                    result += source[index];
                    continue;
                }
                result += opening ? '\\left|' : '\\right|';
                opening = !opening;
            }
            return result;
        };

        const normalizeKeyboardMath = value => {
            let source = String(value ?? '');
            source = source
                .replace(/\u03c0/g, '\\pi')
                .replace(/\u221a\s*([A-Za-z0-9]+)/g, '\\sqrt{$1}')
                .replace(/\u2234/g, '\\therefore ')
                .replace(/\u2235/g, '\\because ')
                .replace(/\u22a5/g, '\\perp ')
                .replace(/\u2264/g, '\\le ')
                .replace(/\u2265/g, '\\ge ')
                .replace(/\u2260/g, '\\ne ')
                .replace(/\u2208/g, '\\in ')
                .replace(/\u2229/g, '\\cap ')
                .replace(/\u222a/g, '\\cup ')
                .replace(/\bsqrt\s*\(([^()]+)\)/g, '\\sqrt{$1}')
                .replace(/(?<!\\)\b(sin|cos|tan|log|ln)\s*(?=[A-Za-z(])/g, '\\$1 ')
                .replace(/([A-Z]{2})\s*[·⋅]\s*([A-Z]{2})/g, '\\overrightarrow{$1}\\cdot \\overrightarrow{$2}')
                .replace(/∥/g, '\\parallel ')
                .replace(/∠/g, '\\angle ')
                .replace(/[△▲]/g, '\\triangle ')
                .replace(/[·⋅]/g, '\\cdot ')
                .replace(/(\d+(?:\.\d+)?)°/g, '$1^{\\circ}')
                .replace(/(?<!\\)\b(triangle|angle|frac|sqrt|overrightarrow|vec|cdot|parallel|perp|therefore|because|in)\b/g, '\\$1');
            return normalizePairedAbsoluteBars(source)
                .replace(/[ \t]{2,}/g, ' ')
                .trim();
        };

        const looksLikeMathRun = value => {
            const source = String(value || '').trim();
            if (!source) return false;
            return (
                /\\[A-Za-z]+/.test(source) ||
                /(?:^|[^A-Za-z])(sqrt\s*\(|sin\s+[A-Za-z]|cos\s+[A-Za-z]|tan\s+[A-Za-z])/.test(source) ||
                /[∥∠△▲·⋅°]/.test(source) ||
                /[A-Za-z0-9)}\]]\s*(?:=|≤|≥|≠|∈|∉|→|\^|_)\s*[A-Za-z0-9({\[]/.test(source)
            );
        };

        const splitBareMathRuns = value => {
            const source = String(value ?? '');
            const result = [];
            const boundary = /([^\u4e00-\u9fff，。；：！？、\n]+)/g;
            let cursor = 0;
            let match;

            while ((match = boundary.exec(source)) !== null) {
                if (match.index > cursor) {
                    result.push({ kind: 'text', text: source.slice(cursor, match.index) });
                }
                const raw = match[0];
                const leading = raw.match(/^\s*/)?.[0] || '';
                const trailing = raw.match(/\s*$/)?.[0] || '';
                const body = raw.slice(leading.length, raw.length - trailing.length);

                if (looksLikeMathRun(body)) {
                    if (leading) result.push({ kind: 'text', text: leading });
                    result.push({ kind: 'math', latex: normalizeKeyboardMath(body), display: false, original: body });
                    if (trailing) result.push({ kind: 'text', text: trailing });
                } else {
                    result.push({ kind: 'text', text: raw });
                }
                cursor = match.index + raw.length;
            }
            if (cursor < source.length) result.push({ kind: 'text', text: source.slice(cursor) });
            return result;
        };

        const validateLatexStructure = value => {
            const source = String(value ?? '');
            const issues = [];
            let braceDepth = 0;
            for (let index = 0; index < source.length; index += 1) {
                if (source[index] === '{' && !isEscapedAt(source, index)) braceDepth += 1;
                if (source[index] === '}' && !isEscapedAt(source, index)) braceDepth -= 1;
                if (braceDepth < 0) {
                    issues.push({ code: 'UNEXPECTED_CLOSING_BRACE', index });
                    braceDepth = 0;
                }
            }
            if (braceDepth) issues.push({ code: 'UNBALANCED_BRACES', depth: braceDepth });

            const leftCount = (source.match(/\\left\b/g) || []).length;
            const rightCount = (source.match(/\\right\b/g) || []).length;
            if (leftCount !== rightCount) {
                issues.push({ code: 'UNBALANCED_LEFT_RIGHT', leftCount, rightCount });
            }

            const begins = [...source.matchAll(/\\begin\{([^{}]+)\}/g)].map(match => match[1]);
            const ends = [...source.matchAll(/\\end\{([^{}]+)\}/g)].map(match => match[1]);
            if (begins.length !== ends.length || begins.some((name, index) => ends[index] !== name)) {
                issues.push({ code: 'UNBALANCED_ENVIRONMENT', begins, ends });
            }

            if (/\\(?:left|right|begin|end|frac|sqrt)\s*(?:\{)?\s*$/.test(source)) {
                issues.push({ code: 'INCOMPLETE_LATEX_COMMAND' });
            }
            return issues;
        };

        const mergeMathFragments = (fragments = [], options = {}) => {
            const maxGap = Number(options.maxGap) || 0.03;
            const merged = [];
            const issues = [];

            for (const fragment of Array.isArray(fragments) ? fragments : []) {
                const normalized = {
                    ...fragment,
                    latex: normalizeKeyboardMath(fragment.latex || fragment.text || '')
                };
                const previous = merged[merged.length - 1];
                const previousIssues = previous ? validateLatexStructure(previous.latex) : [];
                const canClosePrevious = previousIssues.some(issue =>
                    ['UNBALANCED_BRACES', 'UNBALANCED_LEFT_RIGHT', 'UNBALANCED_ENVIRONMENT', 'INCOMPLETE_LATEX_COMMAND'].includes(issue.code)
                );
                const sameLine = previous &&
                    Number(previous.page || previous.pageNo || 0) === Number(normalized.page || normalized.pageNo || 0) &&
                    String(previous.lineId ?? previous.line ?? '') === String(normalized.lineId ?? normalized.line ?? '');
                const previousBox = normalizeBbox(previous?.bbox || [], { space: previous?.space || 'auto' });
                const nextBox = normalizeBbox(normalized.bbox || [], { space: normalized.space || 'auto' });
                const gap = previousBox.length && nextBox.length
                    ? Math.max(0, nextBox[0] - previousBox[2])
                    : 0;

                if (previous && canClosePrevious && sameLine && gap <= maxGap) {
                    previous.latex += normalized.latex;
                    previous.fragments = [...(previous.fragments || [previous.original || previous.latex]), fragment];
                    if (previousBox.length && nextBox.length) {
                        previous.bbox = [
                            Math.min(previousBox[0], nextBox[0]),
                            Math.min(previousBox[1], nextBox[1]),
                            Math.max(previousBox[2], nextBox[2]),
                            Math.max(previousBox[3], nextBox[3])
                        ];
                        previous.space = 'normalized';
                    }
                } else {
                    merged.push(normalized);
                }
            }

            merged.forEach((fragment, index) => {
                validateLatexStructure(fragment.latex).forEach(issue =>
                    issues.push({ ...issue, fragmentIndex: index })
                );
            });
            return { fragments: merged, issues };
        };

        const serializeRichRuns = runs => (runs || []).map(run => {
            if (run.kind !== 'math') return String(run.text || '');
            const latex = String(run.latex || '').trim();
            return run.display ? `$$${latex}$$` : `$${latex}$`;
        }).join('');

        const normalizeMathContent = value => {
            const parsed = tokenizeMathDelimiters(value);
            const richRuns = [];

            for (const run of parsed.runs) {
                if (run.kind === 'math') {
                    const normalizedLatex = normalizeKeyboardMath(run.latex);
                    const unwrappedMixedText = normalizedLatex
                        .replace(/\\text\s*\{([^{}]*)\}/g, '$1');
                    const isWrappedProseBridge =
                        /^\s*\\text\s*\{[^{}]+\}\s+/.test(normalizedLatex) &&
                        /[，。；：！？]/.test(unwrappedMixedText);
                    if (isWrappedProseBridge && /\\[A-Za-z]+/.test(normalizedLatex)) {
                        richRuns.push(...splitBareMathRuns(unwrappedMixedText));
                    } else {
                        richRuns.push({ ...run, latex: normalizedLatex });
                    }
                } else {
                    const plainTextCommands = String(run.text || '')
                        .replace(/\\text\s*\{([^{}]*)\}/g, '$1');
                    richRuns.push(...splitBareMathRuns(plainTextCommands));
                }
            }

            const compactRuns = [];
            for (const run of richRuns) {
                const previous = compactRuns[compactRuns.length - 1];
                if (previous && previous.kind === 'text' && run.kind === 'text') {
                    previous.text += run.text;
                } else if (run.kind === 'text' ? run.text : run.latex) {
                    compactRuns.push({ ...run });
                }
            }

            const structureIssues = compactRuns.flatMap((run, runIndex) =>
                run.kind === 'math'
                    ? validateLatexStructure(run.latex).map(issue => ({ ...issue, runIndex }))
                    : []
            );
            const valueOut = serializeRichRuns(compactRuns);
            const nakedLatex = compactRuns.some(run => run.kind === 'text' && /\\[A-Za-z]+/.test(run.text || ''));

            return {
                value: valueOut,
                richRuns: compactRuns,
                issues: [...parsed.issues, ...structureIssues],
                rawLatexOutsideMathBlocks: nakedLatex ? 1 : 0
            };
        };

        const normalizeQuestionItem = itemValue => {
            const item = { ...(itemValue || {}) };
            const previousSourceEvidence = item?.contentIntegrity?.sourceEvidence || {};
            const previousOptions = Array.isArray(previousSourceEvidence.options)
                ? previousSourceEvidence.options
                : [];
            const sourceEvidence = {
                stem: String(previousSourceEvidence.stem || item.stem || ''),
                options: previousOptions.some(option => String(option || '').trim())
                    ? [...previousOptions]
                    : (Array.isArray(item.options) ? [...item.options] : []),
                answer: String(item.answer || ''),
                solution: String(item.solution || '')
            };
            const stem = normalizeMathContent(sourceEvidence.stem);
            const answer = normalizeMathContent(sourceEvidence.answer);
            const solution = normalizeMathContent(sourceEvidence.solution);
            const optionResults = [0, 1, 2, 3].map(index => {
                const stripped = stripDuplicateOptionLabel(
                    sourceEvidence.options[index] || '',
                    String.fromCharCode(65 + index),
                    true
                );
                return normalizeMathContent(stripped);
            });
            const allIssues = [
                ...stem.issues.map(issue => ({ ...issue, field: 'stem' })),
                ...answer.issues.map(issue => ({ ...issue, field: 'answer' })),
                ...solution.issues.map(issue => ({ ...issue, field: 'solution' })),
                ...optionResults.flatMap((result, index) =>
                    result.issues.map(issue => ({ ...issue, field: `option${index}` }))
                )
            ];

            item.stem = stem.value;
            item.options = optionResults.map(result => result.value);
            item.answer = answer.value;
            item.solution = solution.value;
            item.normalizedQuestionBbox = normalizeQuestionRegionBbox(
                item.question_bbox || item.sourceBbox || []
            );
            item.richFields = {
                stem: stem.richRuns,
                options: optionResults.map(result => result.richRuns),
                answer: answer.richRuns,
                solution: solution.richRuns
            };
            item.contentIntegrity = {
                version: 'pdf-math-region-r1',
                issues: allIssues,
                sourceEvidence
            };
            if (allIssues.length) {
                item.manualReviewRequired = true;
                item.warnings = [
                    ...new Set([
                        ...(item.warnings || []),
                        '公式需要人工复核'
                    ])
                ];
            }
            return item;
        };

        const applyQuestionLayoutIntegrity = ({
            questions = [],
            layouts = [],
            expectedQuestionNumbers = [],
            minFigureOverlap = 0.9
        } = {}) => {
            const optionRepair = repairMissingOptionsFromPdfText({
                questions,
                layouts,
                expectedQuestionNumbers
            });
            const normalizedQuestions = optionRepair.questions.map(normalizeQuestionItem);
            const figureBinding = bindPlacedFiguresToQuestions({
                questions: normalizedQuestions,
                layouts,
                expectedQuestionNumbers,
                minOverlap: minFigureOverlap
            });

            return {
                questions: figureBinding.questions,
                optionRepair,
                figureBinding
            };
        };

        const normalizeQuestionNumber = value => {
            const match = String(value ?? '').match(/\d{1,3}/);
            if (!match) return '';
            const number = Number(match[0]);
            return Number.isInteger(number) && number > 0 ? String(number) : '';
        };

        const extractExplicitAnswerEvidence = (pages = [], options = {}) => {
            const expected = new Set(
                (options.expectedQuestionNumbers || []).map(normalizeQuestionNumber).filter(Boolean)
            );
            const candidates = [];
            let activeQuestion = '';

            for (const [index, page] of (Array.isArray(pages) ? pages : []).entries()) {
                const pageNo = Number(page?.pageNo || page?.page || index + 1) || index + 1;
                const lines = String(page?.text || page?.pdfTextLayer || page?.rawText || '')
                    .replace(/\r/g, '\n')
                    .split(/\n+/);

                for (const [lineIndex, line] of lines.entries()) {
                    const marker = line.match(
                        /^\s*(\d{1,3})\s*【\s*答案\s*】\s*([A-DＡ-Ｄ]{1,4})?(?![A-Za-z])/i
                    );
                    if (marker) {
                        const question = normalizeQuestionNumber(marker[1]);
                        activeQuestion = question && (!expected.size || expected.has(question))
                            ? question
                            : '';
                        if (!activeQuestion || !marker[2]) continue;
                        const answer = marker[2].replace(/[Ａ-Ｄ]/g, char =>
                            String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
                        ).toUpperCase();
                        candidates.push({
                            question: activeQuestion,
                            answer,
                            pageNo,
                            lineIndex,
                            evidence: line.trim(),
                            source: 'pdf-text-layer-explicit-answer'
                        });
                        continue;
                    }

                    if (!activeQuestion) continue;
                    const conclusionPattern = /(?:故选|答案(?:为|是)|正确答案(?:为|是))\s*[:：]?\s*([A-DＡ-Ｄ]{1,4})(?![A-Za-z])/gi;
                    let conclusion;
                    while ((conclusion = conclusionPattern.exec(line)) !== null) {
                        const answer = conclusion[1].replace(/[Ａ-Ｄ]/g, char =>
                            String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
                        ).toUpperCase();
                        candidates.push({
                            question: activeQuestion,
                            answer,
                            pageNo,
                            lineIndex,
                            evidence: line.trim(),
                            source: 'pdf-text-layer-explicit-solution-conclusion'
                        });
                    }
                }
            }

            const grouped = new Map();
            candidates.forEach(candidate => {
                if (!grouped.has(candidate.question)) grouped.set(candidate.question, []);
                grouped.get(candidate.question).push(candidate);
            });

            const accepted = [];
            const ambiguous = [];
            grouped.forEach((rows, question) => {
                const answers = [...new Set(rows.map(row => row.answer))];
                if (answers.length === 1) accepted.push(rows[0]);
                else ambiguous.push({ question, candidates: rows });
            });

            return { accepted, ambiguous, candidates };
        };

        const reconcileAnswersWithExplicitEvidence = (items = [], evidenceReport = {}) => {
            const evidenceByQuestion = new Map(
                (evidenceReport.accepted || []).map(row => [row.question, row])
            );
            const decisions = [];
            const seenQuestions = new Set();
            const result = (Array.isArray(items) ? items : []).map(itemValue => {
                const item = { ...(itemValue || {}) };
                const question = normalizeQuestionNumber(
                    item.question || item.questionNumber || item.no || ''
                );
                if (question) seenQuestions.add(question);
                const evidence = evidenceByQuestion.get(question);
                if (!evidence) return item;

                const original = String(item.answer || '').replace(/\s/g, '').toUpperCase();
                const decision = {
                    question,
                    originalAnswer: original,
                    evidenceAnswer: evidence.answer,
                    pageNo: evidence.pageNo,
                    action: original === evidence.answer ? 'confirmed' : 'replaced-by-explicit-evidence'
                };
                item.answer = evidence.answer;
                item.answerEvidence = evidence;
                item.sourceTrace = {
                    ...(item.sourceTrace || {}),
                    answerEvidence: evidence
                };
                if (decision.action !== 'confirmed') {
                    item.warnings = [
                        ...new Set([
                            ...(item.warnings || []),
                            '模型答案与 PDF 明文答案冲突，已采用同题号明确答案/解析结论证据。'
                        ])
                    ];
                }
                decisions.push(decision);
                return item;
            });

            evidenceByQuestion.forEach((evidence, question) => {
                if (seenQuestions.has(question)) return;
                const sourceTrace = { answerEvidence: evidence };
                result.push({
                    question,
                    questionNumber: question,
                    answer: evidence.answer,
                    answerEvidence: evidence,
                    sourceTrace,
                    sourcePage: evidence.pageNo,
                    confidence: 1,
                    warnings: []
                });
                decisions.push({
                    question,
                    originalAnswer: '',
                    evidenceAnswer: evidence.answer,
                    pageNo: evidence.pageNo,
                    action: 'added-by-explicit-evidence'
                });
            });

            return {
                items: result,
                decisions,
                ambiguous: evidenceReport.ambiguous || []
            };
        };

        const compositeQuestionKey = item => {
            const section = String(item?.section || item?.questionTypeSection || '').trim();
            const question = normalizeQuestionNumber(
                item?.question || item?.questionNumber || item?.no || ''
            );
            const path = String(item?.subquestionPath || item?.subquestion || '').trim();
            return question ? [section, question, path].join('::') : '';
        };

        const buildAlignmentReport = ({ questionItems = [], supportItems = [] } = {}) => {
            const groupByKey = rows => {
                const map = new Map();
                (rows || []).forEach(row => {
                    const key = compositeQuestionKey(row);
                    if (!key) return;
                    if (!map.has(key)) map.set(key, []);
                    map.get(key).push(row);
                });
                return map;
            };
            const questions = groupByKey(questionItems);
            const supports = groupByKey(supportItems);
            const matched = [];
            const unmatchedQuestions = [];
            const unmatchedSupports = [];
            const duplicates = [];
            const ambiguous = [];

            questions.forEach((rows, key) => {
                if (rows.length > 1) duplicates.push({ side: 'question', key, rows });
                const supportRows = supports.get(key) || [];
                if (rows.length === 1 && supportRows.length === 1) {
                    matched.push({ key, question: rows[0], support: supportRows[0] });
                } else if (!supportRows.length) {
                    unmatchedQuestions.push(...rows);
                } else {
                    ambiguous.push({ key, questionRows: rows, supportRows });
                }
            });
            supports.forEach((rows, key) => {
                if (rows.length > 1) duplicates.push({ side: 'support', key, rows });
                if (!questions.has(key)) unmatchedSupports.push(...rows);
            });

            return {
                ok: !unmatchedQuestions.length && !unmatchedSupports.length && !duplicates.length && !ambiguous.length,
                matched,
                unmatchedQuestions,
                unmatchedSupports,
                duplicates,
                ambiguous,
                rejected: []
            };
        };

        return {
            QUESTION_STATES,
            applyQuestionLayoutIntegrity,
            assignFigureOwner,
            bboxArea,
            bboxIntersection,
            bboxOverlapRatio,
            bindPlacedFiguresToSolutions,
            bindPlacedFiguresToQuestions,
            buildAlignmentReport,
            buildQuestionRegions,
            buildQuestionTextRegions,
            buildValidatedQuestionBboxRegions,
            buildSupportQuestionRegions,
            compositeQuestionKey,
            detectCropContamination,
            detectFigureTextContamination,
            deriveQuestionOwnershipRegions,
            extractExplicitAnswerEvidence,
            extractFourLabeledOptions,
            extractLeadingQuestionMarker,
            extractPlacedImageBboxes,
            isVerifiedPdfQuestionFigure,
            mergeMathFragments,
            multiplyTransformMatrices,
            normalizeBbox,
            normalizeKeyboardMath,
            normalizeMathContent,
            normalizeQuestionItem,
            normalizeQuestionNumber,
            normalizeQuestionRegionBbox,
            normalizeRotation,
            reconcileAnswersWithExplicitEvidence,
            repairMissingOptionsFromPdfText,
            serializeRichRuns,
            splitBareMathRuns,
            stripDuplicateOptionLabel,
            toPixelCrop,
            tokenizeMathDelimiters,
            validateLatexStructure
        };
    }
);
