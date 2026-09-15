/**
 * Acceptance for the deterministic MathType/MTEF restoration, using the same two real DOCX files
 * the hardening baseline used (a MathType question file plus its MathType answer file).
 *
 * It is deterministic on purpose: the product's own DOCX pipeline runs in the product runtime
 * (a real browser page with JSZip), formulas are read from the DOCX structure, and no vision model
 * is involved. It never calls AI/OCR and never runs MathType.
 *
 *   node scripts/measure-docx-mtef-acceptance.js \
 *     --question "<question.docx>" --answer "<answer.docx>" \
 *     --reference artifacts/audit-baseline/final-docx-accuracy.json \
 *     --out artifacts/audit-baseline/integration-mtef-acceptance.json
 */
const fs = require('node:fs');
const path = require('node:path');

const { startBrowserApp } = require('../tests/e2e/browser-harness.js');

const PORT = Number(process.env.QISI_MTEF_ACCEPTANCE_PORT || 32132);

const argOf = name => {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : '';
};

const clean = value => String(value ?? '').trim();

const normalizeAnswer = value => clean(value)
    .replace(/\s+/g, '')
    .replace(/[。．]\s*$/, '')
    .toUpperCase();

const main = async () => {
    const questionFile = argOf('question');
    const answerFile = argOf('answer');
    const referencePath = argOf('reference');
    const outPath = argOf('out')
        || path.join('artifacts', 'audit-baseline', 'integration-mtef-acceptance.json');

    for (const [flag, file] of [['question', questionFile], ['answer', answerFile]]) {
        if (!file || !fs.existsSync(file)) throw new Error(`--${flag} must point at an existing DOCX file`);
    }

    const reference = fs.existsSync(referencePath)
        ? JSON.parse(fs.readFileSync(referencePath, 'utf8'))
        : { results: [] };
    const referenceByNumber = new Map(
        (reference.results || []).map(entry => [String(entry.questionNumber), entry])
    );

    const harness = await startBrowserApp(PORT);
    const { page } = harness;

    try {
        const analysed = await page.evaluate(async payload => {
            const pipeline = window.Qisi.DocxPipeline;

            const loadDocx = async base64 => {
                const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
                const zip = await window.JSZip.loadAsync(bytes);
                const documentXml = await zip.file('word/document.xml').async('string');
                const relsXml = await zip.file('word/_rels/document.xml.rels')
                    .async('string').catch(() => '');

                const relMap = pipeline.parseDocxRelationshipMap(relsXml || '');
                const oleBytesByRid = new Map();
                for (const [rid, rel] of relMap.entries()) {
                    if (!rel?.target || !/embeddings\//i.test(rel.target)) continue;
                    const entry = zip.file(String(rel.target).replace(/^\/+/, ''));
                    if (!entry) continue;
                    oleBytesByRid.set(rid, new Uint8Array(await entry.async('arraybuffer')));
                }

                const { text, formulas } = pipeline.expandDocxMathTypeFormulasForV2(
                    documentXml, oleBytesByRid
                );
                // Read the expanded XML back through the product's own paragraph splitter, so the
                // acceptance sees exactly the paragraph text the DOCX path is built on.
                const { paragraphs } = pipeline.splitDocxParagraphsForOptionMap(text);
                return {
                    oleObjectCount: oleBytesByRid.size,
                    formulaCount: formulas.length,
                    formulas,
                    paragraphs: paragraphs.map(paragraph => paragraph.text || '')
                };
            };

            const question = await loadDocx(payload.question);
            const answer = await loadDocx(payload.answer);
            return { question, answer };
        }, {
            question: fs.readFileSync(questionFile).toString('base64'),
            answer: fs.readFileSync(answerFile).toString('base64')
        });

        const questionParagraphs = analysed.question.paragraphs;
        const answerParagraphs = analysed.answer.paragraphs;

        // Deterministic question split: a numbered paragraph opens a question, option paragraphs
        // belong to it, anything else extends the stem.
        const blocks = [];
        for (const paragraph of questionParagraphs) {
            const start = String(paragraph).match(/^\s*(\d{1,2})\s*[.．、]\s*(.*)$/);
            if (start) {
                blocks.push({ questionNumber: String(Number(start[1])), stem: start[2], optionLines: [] });
                continue;
            }
            if (!blocks.length) continue;
            const current = blocks[blocks.length - 1];
            if (/^\s*[A-D]\s*[.．、)）]/.test(paragraph)) current.optionLines.push(paragraph);
            else if (clean(paragraph)) current.stem = `${current.stem} ${clean(paragraph)}`;
        }

        const optionsOf = lines => {
            const source = lines.join(' ');
            // Option labels are often written without spaces ("A．3B．4C．5D．6"), so the labels are
            // located first and then kept only when they run in order from A.
            const hits = [...source.matchAll(/([A-D])\s*[.．、)）]\s*/g)];
            const ordered = hits.filter((hit, index) => hit[1] === 'ABCD'[index]);
            if (ordered.length < 2) return [];

            return ordered.map((hit, index) => {
                const start = hit.index + hit[0].length;
                const end = index + 1 < ordered.length ? ordered[index + 1].index : source.length;
                return { label: hit[1], text: clean(source.slice(start, end)) };
            });
        };

        // Deterministic answer/solution split: "3【答案】B【详解】...".
        const answers = new Map();
        const solutions = new Map();
        let currentNumber = '';
        for (const paragraph of answerParagraphs) {
            const line = clean(paragraph);
            if (!line) continue;
            const head = line.match(/(\d{1,2})\s*【答案】\s*([^【]*)/);
            if (head) {
                currentNumber = String(Number(head[1]));
                answers.set(currentNumber, clean(head[2]));
                if (!solutions.has(currentNumber)) solutions.set(currentNumber, '');
                const rest = line.slice(line.indexOf('【答案】') + 4);
                const detail = rest.match(/【(?:详解|解析)】([\s\S]*)/);
                if (detail) solutions.set(currentNumber, clean(detail[1]));
                continue;
            }
            if (!currentNumber) continue;
            const detail = line.match(/^【(?:详解|解析)】([\s\S]*)/);
            solutions.set(
                currentNumber,
                clean(`${solutions.get(currentNumber) || ''} ${detail ? detail[1] : line}`)
            );
        }

        const results = blocks.map(block => {
            const number = block.questionNumber;
            const expected = referenceByNumber.get(number) || {};
            const options = optionsOf(block.optionLines);
            let answer = answers.get(number) || '';
            const solution = solutions.get(number) || '';
            const body = [block.stem, ...block.optionLines].join(' ');
            const unresolvedTokens = [...body.matchAll(/\[\[MTEF_UNRESOLVED:([^\]]+)\]\]/g)]
                .map(match => match[1]);
            const formulaFragments = (body.match(/\$[^$]{1,120}\$/g) || []).length;

            const notes = [];
            let verdict = 'COMPLETE';
            const inferred = solution.match(/故选\s*[：:]\s*([A-D])/);
            if (!answer && inferred) {
                answer = inferred[1];
                notes.push('answer inferred from the solution text');
            }
            if (unresolvedTokens.length) {
                verdict = 'WITHHELD';
                notes.push(`unresolved formula(s): ${unresolvedTokens.join(', ')}`);
            } else if (!answer) {
                verdict = 'SAFE_PARTIAL';
                notes.push('no answer attached deterministically');
            } else if (
                expected.expectedAnswer
                && normalizeAnswer(expected.expectedAnswer) !== normalizeAnswer(answer)
            ) {
                verdict = 'WRONG_MATCH';
            } else if (!solution) {
                verdict = 'SAFE_PARTIAL';
                notes.push('no solution attached deterministically');
            }
            if (expected.optionsExpected && options.length !== expected.optionsExpected) {
                notes.push(`options ${options.length}/${expected.optionsExpected}`);
                if (verdict === 'COMPLETE') verdict = 'SAFE_PARTIAL';
            }

            return {
                questionNumber: number,
                expectedAnswer: expected.expectedAnswer || '',
                answer,
                solutionPresent: Boolean(solution),
                options: options.map(option => option.text),
                optionCount: options.length,
                formulaFragments,
                unresolvedTokens,
                verdict,
                notes
            };
        });

        // Questions the deterministic path did not produce at all are withheld, not silent.
        const expectedNumbers = [...referenceByNumber.keys()].sort(
            (left, right) => Number(left) - Number(right)
        );
        const producedNumbers = new Set(results.map(row => row.questionNumber));
        for (const number of expectedNumbers) {
            if (producedNumbers.has(number)) continue;
            results.push({
                questionNumber: number,
                expectedAnswer: referenceByNumber.get(number)?.expectedAnswer || '',
                answer: '',
                solutionPresent: false,
                options: [],
                optionCount: 0,
                formulaFragments: 0,
                unresolvedTokens: [],
                verdict: 'WITHHELD',
                notes: ['question not produced deterministically']
            });
        }
        results.sort((left, right) => Number(left.questionNumber) - Number(right.questionNumber));

        const counts = {};
        for (const row of results) counts[row.verdict] = (counts[row.verdict] || 0) + 1;

        const formulaStatus = { extracted: 0, unresolved: 0, conflict: 0 };
        const formulaDetail = [
            ...analysed.question.formulas.map(row => ({ file: 'question', ...row })),
            ...analysed.answer.formulas.map(row => ({ file: 'answer', ...row }))
        ].map(row => {
            const status = row.status === 'extracted' ? 'extracted' : 'unresolved';
            formulaStatus[status] += 1;
            return {
                file: row.file,
                rid: row.rid,
                status,
                origin: row.origin || '',
                code: row.code || '',
                latex: row.latex || '',
                provenance: row.provenance || null
            };
        });

        const report = {
            generatedAt: new Date().toISOString(),
            questionFile: path.basename(questionFile),
            answerFile: path.basename(answerFile),
            hardenedReference: {
                producedDrafts: reference.producedDrafts ?? null,
                counts: reference.counts || null,
                wrongMatches: (reference.wrongMatches || []).length
            },
            oleObjects: {
                question: analysed.question.oleObjectCount,
                answer: analysed.answer.oleObjectCount
            },
            formulas: {
                question: analysed.question.formulaCount,
                answer: analysed.answer.formulaCount,
                status: formulaStatus,
                detail: formulaDetail
            },
            results,
            counts,
            wrongMatches: results.filter(row => row.verdict === 'WRONG_MATCH'),
            controlTextLeak: /(?:\bfalse\b)/.test(questionParagraphs.join('\n'))
                || /(?:\bfalse\b)/.test(answerParagraphs.join('\n')),
            mathTypeProcess: false,
            paidApiCalls: 0
        };

        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

        console.log(JSON.stringify({
            oleObjects: report.oleObjects,
            formulas: {
                question: report.formulas.question,
                answer: report.formulas.answer,
                status: report.formulas.status
            },
            counts: report.counts,
            wrongMatches: report.wrongMatches,
            controlTextLeak: report.controlTextLeak,
            answers: results.map(row => `${row.questionNumber}:${row.answer || '-'}`),
            report: outPath
        }, null, 2));
    } finally {
        await harness.close();
    }
};

main().catch(error => {
    console.error('MTEF_ACCEPTANCE_FAILED', error?.stack || error);
    process.exitCode = 1;
});
