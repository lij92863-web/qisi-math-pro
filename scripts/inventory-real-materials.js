/**
 * Inventories the real acceptance materials and classifies each file by its own content, so files
 * can be paired correctly (question / answer / combined, DOCX / PDF).
 *
 *   node scripts/inventory-real-materials.js "C:\Users\Administrator\Desktop\题目与答案"
 *
 * DOCX files are read the way the product reads them (JSZip in a real browser page); PDF files are
 * read with pdf.js, also in the page. Nothing is uploaded anywhere and no AI is called.
 */
const fs = require('node:fs');
const path = require('node:path');

const { startBrowserApp } = require('../tests/e2e/browser-harness.js');

const directory = process.argv[2] || 'C:\\Users\\Administrator\\Desktop\\题目与答案';
const PORT = Number(process.env.QISI_INVENTORY_PORT || 32142);

const readJsonIfAny = () => null;

const main = async () => {
    const files = fs.readdirSync(directory, { withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => entry.name);

    const harness = await startBrowserApp(PORT);
    const { page } = harness;

    try {
        const results = [];
        for (const name of files) {
            const fullPath = path.join(directory, name);
            const extension = path.extname(name).toLowerCase();
            const base64 = fs.readFileSync(fullPath).toString('base64');
            const bytes = fs.statSync(fullPath).size;

            const analysis = await page.evaluate(async payload => {
                const text = [];
                let oleObjects = 0;
                let mediaFiles = 0;
                let note = '';

                if (payload.extension === '.docx') {
                    const binary = Uint8Array.from(atob(payload.base64), c => c.charCodeAt(0));
                    const zip = await window.JSZip.loadAsync(binary);
                    const documentXml = await zip.file('word/document.xml').async('string');
                    oleObjects = Object.keys(zip.files)
                        .filter(name => /^word\/embeddings\//i.test(name)).length;
                    mediaFiles = Object.keys(zip.files)
                        .filter(name => /^word\/media\//i.test(name)).length;
                    const { paragraphs } = window.Qisi.DocxPipeline
                        .splitDocxParagraphsForOptionMap(documentXml);
                    paragraphs.forEach(paragraph => text.push(paragraph.text || ''));
                } else if (payload.extension === '.pdf') {
                    const binary = Uint8Array.from(atob(payload.base64), c => c.charCodeAt(0));
                    try {
                        const pdf = await window.pdfjsLib.getDocument({ data: binary }).promise;
                        const pages = Math.min(pdf.numPages, 8);
                        for (let pageNo = 1; pageNo <= pages; pageNo += 1) {
                            const pdfPage = await pdf.getPage(pageNo);
                            const content = await pdfPage.getTextContent();
                            text.push(...(content.items || []).map(item => item.str || ''));
                        }
                        note = `pages=${pdf.numPages} scanned=${pages}`;
                    } catch (error) {
                        note = `pdf-read-failed: ${error?.message || String(error)}`;
                    }
                }

                const joined = text.join('\n');
                const markerLines = text.filter(line =>
                    /^\s*((?:\d\s*){1,3})[.．、)）]\s*/.test(String(line || '')));
                const numbers = markerLines
                    .map(line => Number(String(line).match(/^\s*((?:\d\s*){1,3})/)[1].replace(/\s+/g, '')))
                    .filter(value => Number.isInteger(value) && value > 0);

                return {
                    lineCount: text.length,
                    firstLines: text.slice(0, 4).map(line => String(line).slice(0, 90)),
                    questionMarkerLines: markerLines.length,
                    numberRange: numbers.length ? `${Math.min(...numbers)}-${Math.max(...numbers)}` : '',
                    answerFieldCount: (joined.match(/【答案】/g) || []).length,
                    solutionFieldCount: (joined.match(/【(?:详解|解析)】/g) || []).length,
                    choiceAnswerHints: (joined.match(/故选\s*[：:]?\s*[A-D]/g) || []).length,
                    optionLabelCount: (joined.match(/(?:^|\s)[A-D]\s*[.．、)）]/g) || []).length,
                    oleObjects,
                    mediaFiles,
                    note,
                    textHead: joined.replace(/\s+/g, ' ').slice(0, 200)
                };
            }, { base64, extension, name });

            const nature = (() => {
                const hasAnswers = analysis.answerFieldCount > 0 || analysis.solutionFieldCount > 0;
                const hasQuestions = analysis.questionMarkerLines >= 2;
                if (hasAnswers && hasQuestions) return 'question+answer combined';
                if (hasAnswers) return 'answer/solution only';
                if (hasQuestions) return 'question only';
                if (analysis.choiceAnswerHints > 0) return 'answer hints only';
                return 'unclassified';
            })();

            results.push({ name, extension, bytes, nature, ...analysis });
        }

        const out = path.join('artifacts', 'audit-baseline', 'real-material-inventory.json');
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, JSON.stringify({
            generatedAt: new Date().toISOString(), directory, files: results
        }, null, 2));

        console.table = null;
        for (const row of results) {
            console.log([
                row.name,
                row.extension,
                row.nature,
                `q-markers=${row.questionMarkerLines}`,
                `range=${row.numberRange || '-'}`,
                `ansFields=${row.answerFieldCount}`,
                `solFields=${row.solutionFieldCount}`,
                `choiceHints=${row.choiceAnswerHints}`,
                `ole=${row.oleObjects}`,
                `media=${row.mediaFiles}`,
                row.note
            ].join(' | '));
        }
        console.log(`\nwritten: ${out}`);
    } finally {
        await harness.close();
    }
};

main().catch(error => {
    console.error('INVENTORY_FAILED', error?.stack || error);
    process.exitCode = 1;
});
