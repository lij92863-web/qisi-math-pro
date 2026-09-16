// Cross-checks the imported drafts of one group against the *rendered* page text of the original
// document. It cannot replace looking at a page, but it covers every question cheaply: a question
// number that never appears as a marker, a stem whose words are not on that page, an option set the
// page does not show, or an answer the page does not state, all show up here.
//
//   node artifacts/audit-baseline/group-page-crosscheck.cjs <group> <file.pdf> [out.json]
const fs = require('node:fs');
const path = require('node:path');

const { startBrowserApp } = require('../../tests/e2e/browser-harness.js');

const group = process.argv[2];
const pdfFile = process.argv[3];
if (!group || !pdfFile || !fs.existsSync(pdfFile)) {
    console.error('usage: node group-page-crosscheck.cjs <group> <file.pdf> [out.json]');
    process.exit(1);
}
const outFile = process.argv[4] || path.join(__dirname, `page-crosscheck-${group}.json`);

const draftFile = path.join(__dirname, `docx-batch-astra-${group.toUpperCase()}.json`);

// Tokens that carry meaning in a stem: letters/digits/Greek, no LaTeX commands, no punctuation.
const tokensOf = value => String(value || '')
    .replace(/\$[^$]*\$/g, match => match.replace(/\$|\\[A-Za-z]+|[{}\^_]/g, ' '))
    .replace(/\[\[[^\]]+\]\]/g, ' ')
    .replace(/\\[A-Za-z]+/g, ' ')
    .replace(/[^0-9A-Za-z\u0370-\u03ff\u4e00-\u9fa5]+/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 2 || /[0-9]/.test(token));

const main = async () => {
    const harness = await startBrowserApp(Number(process.env.QISI_CROSSCHECK_PORT || 32155));
    const { page } = harness;
    try {
        const pages = await page.evaluate(async payload => {
            const bytes = Uint8Array.from(atob(payload.base64), character => character.charCodeAt(0));
            const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
            const rows = [];
            for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
                const pdfPage = await pdf.getPage(pageNo);
                const content = await pdfPage.getTextContent();
                rows.push({
                    pageNo,
                    text: content.items.map(item => item.str).join(' ')
                });
            }
            return rows;
        }, { base64: fs.readFileSync(pdfFile).toString('base64') });

        const all = pages.map(row => `[[PAGE ${row.pageNo}]] ${row.text}`).join('\n');
        const draft = JSON.parse(fs.readFileSync(draftFile, 'utf8'));
        const findings = [];

        for (const item of draft.drafts) {
            const number = String(item.questionNumber || '');
            const marker = new RegExp(`(?:^|[^0-9])${number}\\s*[.．、]`, 'g');
            const hits = [...all.matchAll(marker)].length;
            const stemTokens = tokensOf(item.stem);
            const pageHit = stemTokens.filter(token => all.includes(token)).length;
            const options = (item.options || []).filter(Boolean);
            const pageOptionLabels = (all.match(/(?:^|\s)[A-D]\s*[.．、]/g) || []).length;
            const answer = String(item.answer || '').replace(/\$/g, '').trim();
            const answerShown = answer ? all.replace(/\s+/g, '').includes(answer.replace(/\s+/g, '')) : null;

            findings.push({
                questionNumber: number,
                type: item.type,
                withheld: Boolean(item.withheld),
                markerHits: hits,
                stemTokens: stemTokens.length,
                stemTokensOnPage: pageHit,
                stemCoverage: stemTokens.length ? Number((pageHit / stemTokens.length).toFixed(2)) : 1,
                options: options.length,
                pageHasOptionLabels: pageOptionLabels,
                answer: answer || '',
                answerAppearsOnPage: answerShown
            });
        }

        const report = {
            group, pdf: path.basename(pdfFile), pages: pages.length,
            drafts: draft.drafts.length,
            suspicious: findings.filter(row => row.markerHits === 0
                || row.stemCoverage < 0.8
                || row.answerAppearsOnPage === false),
            findings
        };
        fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
        console.log(JSON.stringify({
            group, pages: report.pages, drafts: report.drafts,
            suspicious: report.suspicious.map(row => ({
                q: row.questionNumber, type: row.type, withheld: row.withheld,
                marker: row.markerHits, coverage: row.stemCoverage,
                options: row.options, answerOnPage: row.answerAppearsOnPage
            })), report: outFile
        }, null, 1));
    } finally {
        await harness.close();
    }
};

main().catch(error => { console.error('CROSSCHECK_FAILED', error?.stack || error); process.exitCode = 1; });
