// Measures how much of the real local MathType material the deterministic MTEF reader can
// convert without the native helper. Reads the local evidence under
// artifacts/import-reliability (not committed: it contains real material content) and prints
// a per-file fidelity report. Safe to run repeatedly; never calls AI/OCR or MathType.
const fs = require('node:fs');
const path = require('node:path');
const mtefReader = require('../qisi-docx-mtef-reader.js');
const rich = require('../qisi-docx-rich-content.js');

const ROOT = path.resolve(__dirname, '..');
const EVIDENCE_DIR = path.join(ROOT, 'artifacts', 'import-reliability');

const readEvidence = () => {
    if (!fs.existsSync(EVIDENCE_DIR)) return [];
    return fs.readdirSync(EVIDENCE_DIR)
        .filter(name => name.endsWith('.input.json'))
        .map(name => ({
            name,
            payload: JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, name), 'utf8'))
        }));
};

const measure = ({ name, payload }) => {
    const equations = (payload.equations || []).map(row => ({
        id: String(row?.id || ''),
        mtefBase64: String(row?.mtefBase64 || '')
    }));
    const failureCodes = new Map();
    const unresolved = [];
    let readable = 0;
    let displaySafe = 0;

    for (const row of equations) {
        if (!row.mtefBase64) {
            unresolved.push({ id: row.id, code: 'MTEF_MISSING_PAYLOAD' });
            continue;
        }
        let result;
        try {
            result = mtefReader.mtefToLatex(Buffer.from(row.mtefBase64, 'base64'));
        } catch (error) {
            result = { ok: false, code: 'MTEF_READER_THREW' };
        }
        if (!result?.ok || !String(result.latex || '').trim()) {
            const code = result?.code || 'MTEF_UNREADABLE';
            failureCodes.set(code, (failureCodes.get(code) || 0) + 1);
            unresolved.push({ id: row.id, code });
            continue;
        }
        readable += 1;
        const normalized = rich.normalizeLatexFragment(result.latex);
        if (normalized?.ok) displaySafe += 1;
        else unresolved.push({ id: row.id, code: 'DISPLAY_INVALID' });
    }

    return {
        name,
        total: equations.length,
        readable,
        displaySafe,
        fidelity: equations.length ? Math.round((readable / equations.length) * 1000) / 10 : 0,
        failureCodes: Object.fromEntries([...failureCodes].sort((a, b) => b[1] - a[1])),
        unresolved
    };
};

const reports = readEvidence().map(measure);

if (!reports.length) {
    console.log('[measure-mtef-fidelity] no local evidence found under artifacts/import-reliability; nothing to measure.');
    process.exit(0);
}

for (const report of reports) {
    console.log(`\n=== ${report.name} ===`);
    console.log(`equations            ${report.total}`);
    console.log(`local reader ok      ${report.readable} (${report.fidelity}%)`);
    console.log(`display-safe LaTeX   ${report.displaySafe}`);
    console.log(`failure codes        ${JSON.stringify(report.failureCodes)}`);
    console.log(`unresolved ids       ${report.unresolved.map(row => `${row.id}:${row.code}`).join(', ') || 'none'}`);
}

const totals = reports.reduce((sum, report) => ({
    total: sum.total + report.total,
    readable: sum.readable + report.readable,
    displaySafe: sum.displaySafe + report.displaySafe
}), { total: 0, readable: 0, displaySafe: 0 });

console.log('\n=== total ===');
console.log(JSON.stringify({
    ...totals,
    fidelity: totals.total ? Math.round((totals.readable / totals.total) * 1000) / 10 : 0
}));
