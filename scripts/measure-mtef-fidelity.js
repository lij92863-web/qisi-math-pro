/**
 * Measures how much of the local *real* MathType material the deterministic MTEF reader recovers.
 *
 * The evidence under artifacts/import-reliability is not committed (it contains real material), so
 * this prints a per-corpus report and compares it against the recorded summary that was captured
 * when the reader was first measured. It never calls AI/OCR and never runs MathType.
 *
 *   node scripts/measure-mtef-fidelity.js
 */
const fs = require('node:fs');
const path = require('node:path');

const reader = require('../qisi-docx-mtef-reader.js');

const ROOT = path.resolve(__dirname, '..');
const EVIDENCE_DIR = path.join(ROOT, 'artifacts', 'import-reliability');

const readCorpus = () => {
    if (!fs.existsSync(EVIDENCE_DIR)) return [];
    return fs.readdirSync(EVIDENCE_DIR)
        .filter(name => name.endsWith('.input.json'))
        .map(name => {
            const payload = JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, name), 'utf8'));
            const summaryName = name.replace(/\.input\.json$/, '.summary.json');
            const summaryPath = path.join(EVIDENCE_DIR, summaryName);
            return {
                name,
                equations: payload.equations || [],
                recorded: fs.existsSync(summaryPath)
                    ? JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
                    : null
            };
        });
};

const isDisplaySafe = latex => {
    const source = String(latex || '');
    if (!source.trim()) return false;
    if (/[\u0000-\u001f]/.test(source)) return false;
    let depth = 0;
    for (const character of source) {
        if (character === '{') depth += 1;
        else if (character === '}') {
            depth -= 1;
            if (depth < 0) return false;
        }
    }
    return depth === 0;
};

const measure = corpus => {
    const byOrigin = {};
    const unresolved = [];
    const notDisplaySafe = [];

    for (const row of corpus.equations) {
        const id = String(row?.id || '');
        const base64 = String(row?.mtefBase64 || '');
        if (!base64) {
            unresolved.push({ id, code: 'MTEF_MISSING_PAYLOAD' });
            continue;
        }
        const result = reader.classifyMtef(Buffer.from(base64, 'base64'));
        if (result.status !== 'extracted') {
            unresolved.push({ id, code: result.code });
            continue;
        }
        byOrigin[result.origin] = (byOrigin[result.origin] || 0) + 1;
        if (!isDisplaySafe(result.latex)) notDisplaySafe.push({ id, latex: result.latex });
    }

    const recovered = Object.values(byOrigin).reduce((sum, count) => sum + count, 0);
    const recorded = corpus.recorded || {};
    return {
        name: corpus.name,
        total: corpus.equations.length,
        recovered,
        unresolved: unresolved.length,
        byOrigin,
        unresolvedIds: unresolved.map(row => row.id),
        notDisplaySafe,
        recorded: {
            total: recorded.total ?? null,
            local: recorded.local ?? null,
            unresolved: recorded.unresolved || null
        },
        matchesRecorded: recorded.total === undefined
            ? null
            : recorded.total === corpus.equations.length
                && (recorded.local === undefined || recorded.local === recovered)
    };
};

const corpora = readCorpus();
if (!corpora.length) {
    console.log('[mtef-fidelity] no local evidence under artifacts/import-reliability; nothing to measure');
} else {
    const report = corpora.map(measure);
    console.log(JSON.stringify(report, null, 2));
    const regressed = report.filter(row => row.matchesRecorded === false);
    if (regressed.length) {
        console.error(`[mtef-fidelity] regression against the recorded summary: ${regressed.map(row => row.name).join(', ')}`);
        process.exitCode = 1;
    } else {
        console.log('[mtef-fidelity] matches the recorded recovery and unresolved counts');
    }
}
