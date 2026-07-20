const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const appJsPath = path.join(rootDir, 'app.js');

const RISK_KEYWORDS = [
    'document.',
    'window.',
    'localStorage',
    'indexedDB',
    'QisiDb',
    'fetch',
    'await',
    'async',
    'OCR',
    'AI',
    'controlledWrite',
    'buildPdfSupport',
    'parsePdf',
    'render',
    'addEventListener',
    'innerHTML',
    'querySelector'
];

const MODULE_HINT_MAP = {
    'review': 'qisi-review-draft-state.js',
    'draft': 'qisi-review-draft-state.js',
    'view model': 'qisi-review-draft-state.js',
    'batch': 'qisi-batch-engine-v2.js',
    'import': 'qisi-batch-importer.js',
    'file': 'qisi-file-dispatcher.js',
    'dispatch': 'qisi-file-dispatcher.js',
    'storage': 'qisi-db.js',
    'db': 'qisi-db.js',
    'pdf': 'qisi-pdf-safe-partial-pipeline.js',
    'support': 'qisi-support-parser.js',
    'docx': 'qisi-docx-pipeline.js',
    'ui': 'qisi-ui-events.js',
    'component': 'qisi-components.js',
    'backup': 'qisi-backup.js',
    'config': 'qisi-config.js',
    'runtime': 'qisi-runtime.js',
    'utils': 'qisi-utils.js',
    'facade': 'qisi-runtime.js',
    'ocr': 'qisi-pdf-answer-extraction-quality.js',
    'align': 'qisi-pdf-support-aligner.js',
    'parse': 'qisi-support-parser.js',
    'repair': 'qisi-support-repair.js',
    'orchestrat': 'qisi-batch-importer.js',
    'control': 'qisi-pdf-support-controlled-write.js',
    'extract': 'qisi-pdf-answer-only-extraction.js',
    'block': 'qisi-pdf-support-block-parser.js'
};

function getExistingModules() {
    const files = fs.readdirSync(rootDir).filter(f => /^qisi-.*\.js$/.test(f));
    return new Set(files);
}

function suggestModule(funcName) {
    const lower = funcName.toLowerCase();
    for (const [hint, module] of Object.entries(MODULE_HINT_MAP)) {
        if (lower.includes(hint)) {
            return module;
        }
    }
    return 'qisi-utils.js';
}

function isFunctionStart(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('const ')) return false;

    const match = trimmed.match(
        /^const\s+(\w+)\s*=\s*(async\s+)?(?:function\s*\(|\([^)]*\)\s*=>)/
    );
    return match ? match[1] : null;
}

function findFunctionBody(lines, startIdx) {
    // Count braces to find the end of the function body.
    // We look for the pattern: const name = (...) => { ... };
    // or: const name = function(...) { ... };
    let depth = 0;
    let started = false;
    let endIdx = startIdx;

    for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i];

        for (let j = 0; j < line.length; j++) {
            const ch = line[j];
            if (ch === '{') {
                depth++;
                started = true;
            } else if (ch === '}') {
                depth--;
                if (started && depth === 0) {
                    // Check if this line ends with ; or just }
                    // The function body ends at this line
                    return i;
                }
            }
        }

        // If we've started and depth is 0, check for comma or semicolon
        // This handles comma-separated return objects where the function
        // is embedded in a larger object
        if (started && depth === 0 && i > startIdx) {
            return i;
        }
    }

    return lines.length - 1;
}

function checkRiskKeywords(bodyLines) {
    const body = bodyLines.join('\n');
    const found = [];

    for (const keyword of RISK_KEYWORDS) {
        if (body.includes(keyword)) {
            found.push(keyword);
        }
    }

    return found;
}

function hasDomAccess(bodyLines, foundKeywords) {
    return foundKeywords.some(k =>
        ['document.', 'window.', 'localStorage', 'addEventListener', 'innerHTML', 'querySelector', 'render'].includes(k)
    );
}

function hasDbAccess(bodyLines, foundKeywords) {
    return foundKeywords.some(k =>
        ['indexedDB', 'QisiDb'].includes(k)
    );
}

function hasAiOrOcrAccess(bodyLines, foundKeywords) {
    return foundKeywords.some(k =>
        ['OCR', 'AI', 'fetch'].includes(k)
    );
}

function hasControlledWriteAccess(bodyLines, foundKeywords) {
    return foundKeywords.some(k =>
        ['controlledWrite', 'buildPdfSupport', 'parsePdf'].includes(k)
    );
}

function hasAsync(bodyLines, foundKeywords) {
    return foundKeywords.includes('async') || foundKeywords.includes('await');
}

function inventoryAppJs() {
    if (!fs.existsSync(appJsPath)) {
        console.error('app.js not found at', appJsPath);
        process.exit(1);
    }

    const content = fs.readFileSync(appJsPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const existingModules = getExistingModules();

    const candidates = [];
    let i = 0;

    while (i < lines.length) {
        const funcName = isFunctionStart(lines[i]);
        if (funcName) {
            const startLine = i;
            const endLine = findFunctionBody(lines, i);
            const bodyLines = lines.slice(startLine, endLine + 1);
            const lineCount = endLine - startLine + 1;
            const foundKeywords = checkRiskKeywords(bodyLines);

            const domAccess = hasDomAccess(bodyLines, foundKeywords);
            const dbAccess = hasDbAccess(bodyLines, foundKeywords);
            const aiOcrAccess = hasAiOrOcrAccess(bodyLines, foundKeywords);
            const cwAccess = hasControlledWriteAccess(bodyLines, foundKeywords);
            const isAsync = hasAsync(bodyLines, foundKeywords);

            const hasAnyRisk = domAccess || dbAccess || aiOcrAccess || cwAccess || isAsync;

            let suggestedModule = suggestModule(funcName);
            if (!existingModules.has(suggestedModule)) {
                suggestedModule = 'qisi-utils.js';
            }

            let risk = 'low';
            if (hasAnyRisk) {
                if (cwAccess || aiOcrAccess) risk = 'high';
                else if (domAccess || dbAccess) risk = 'high';
                else if (isAsync) risk = 'medium';
                else risk = 'unknown';
            }

            candidates.push({
                name: funcName,
                startLine: startLine + 1, // 1-based line numbers
                endLine: endLine + 1,
                lineCount,
                hasDomAccess: domAccess,
                hasDbAccess: dbAccess,
                hasAiOrOcrAccess: aiOcrAccess,
                hasControlledWriteAccess: cwAccess,
                hasAsync: isAsync,
                eligible: !hasAnyRisk,
                risk,
                suggestedModule
            });

            i = endLine + 1;
        } else {
            i++;
        }
    }

    return {
        appJsLines: lines.length,
        totalFunctionsFound: candidates.length,
        eligibleCount: candidates.filter(c => c.eligible).length,
        functions: candidates
    };
}

const result = inventoryAppJs();

if (require.main === module) {
    console.log(JSON.stringify(result, null, 2));
}

module.exports = { inventoryAppJs, isFunctionStart, checkRiskKeywords, suggestModule };
