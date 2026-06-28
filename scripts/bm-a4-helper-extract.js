const fs = require('fs');
const crypto = require('crypto');

const HELPERS = [
    'cleanDisplayTextForBatchSave',
    'cleanDisplayOptionsForBatchSave',
    'addWarningOnce',
    'cleanDisplayFieldsOnly'
];

function lineOf(source, index) {
    return source.slice(0, index).split(/\r?\n/).length;
}

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function findArrowHelper(source, name) {
    const re = new RegExp(`\\bconst\\s+${name}\\s*=\\s*`, 'm');
    const match = re.exec(source);
    if (!match) return null;

    const start = match.index;
    const afterEquals = match.index + match[0].length;
    const arrowIndex = source.indexOf('=>', afterEquals);
    if (arrowIndex < 0) {
        throw new Error(`arrow not found for ${name}`);
    }

    let bodyStart = arrowIndex + 2;
    while (bodyStart < source.length && /\s/.test(source[bodyStart])) bodyStart += 1;

    if (source[bodyStart] !== '{') {
        const semi = source.indexOf(';', arrowIndex);
        if (semi < 0) throw new Error(`semicolon not found for ${name}`);
        return {
            name,
            found: true,
            start,
            end: semi + 1,
            kind: 'const-arrow'
        };
    }

    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let i = bodyStart; i < source.length; i += 1) {
        const ch = source[i];
        if (quote) {
            if (escaped) {
                escaped = false;
            } else if (ch === '\\') {
                escaped = true;
            } else if (ch === quote) {
                quote = '';
            }
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') {
            quote = ch;
            continue;
        }
        if (ch === '{') depth += 1;
        if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
                const semi = source.indexOf(';', i);
                if (semi < 0) throw new Error(`terminating semicolon not found for ${name}`);
                return {
                    name,
                    found: true,
                    start,
                    end: semi + 1,
                    kind: 'const-arrow'
                };
            }
        }
    }
    throw new Error(`brace matching failed for ${name}`);
}

function extractHelpers(appPath = 'app.js') {
    const source = fs.readFileSync(appPath, 'utf8');
    const helpers = {};
    const missing = [];
    const errors = [];

    for (const name of HELPERS) {
        try {
            const found = findArrowHelper(source, name);
            if (!found) {
                missing.push(name);
                helpers[name] = { found: false };
                continue;
            }
            const helperSource = source.slice(found.start, found.end);
            const startLine = lineOf(source, found.start);
            const endLine = lineOf(source, found.end);
            helpers[name] = {
                found: true,
                startLine,
                endLine,
                lineCount: endLine - startLine + 1,
                kind: found.kind,
                sourceHash: `sha256:${sha256(helperSource)}`,
                source: helperSource
            };
        } catch (error) {
            errors.push(`${name}: ${error.message}`);
            helpers[name] = { found: false };
        }
    }

    return {
        ok: missing.length === 0 && errors.length === 0,
        helpers,
        missing,
        errors
    };
}

function markdownReport(result) {
    const lines = [
        '# BM-AUTO Chain A A4 Helper Extraction Report',
        '',
        'Stage: BM-AUTO-CHAIN-A-A4-HELPER-EXTRACTION',
        'Branch: main',
        '',
        '## Decision',
        '',
        `Helper extraction passed: ${result.ok ? 'yes' : 'no'}.`,
        '',
        '## Helpers',
        '',
        '| Helper | Found | Lines | Kind | Source hash |',
        '| --- | --- | ---: | --- | --- |'
    ];

    for (const name of HELPERS) {
        const item = result.helpers[name] || { found: false };
        lines.push(`| ${name} | ${item.found ? 'yes' : 'no'} | ${item.lineCount || 0} | ${item.kind || ''} | ${item.sourceHash || ''} |`);
    }

    lines.push('', '## Safety', '', '- app.js executed: no.', '- DOM touched: no.', '- AI/OCR/API called: no.', '');
    if (result.errors.length) {
        lines.push('## Errors', '', ...result.errors.map((error) => `- ${error}`), '');
    }
    return `${lines.join('\n')}\n`;
}

function main(argv = process.argv.slice(2)) {
    const result = extractHelpers('app.js');
    const json = argv.includes('--json');
    const reportIndex = argv.indexOf('--write-report');

    if (reportIndex >= 0) {
        fs.writeFileSync(argv[reportIndex + 1], markdownReport(result));
    }

    if (json || reportIndex < 0) {
        const printable = JSON.parse(JSON.stringify(result));
        for (const item of Object.values(printable.helpers)) delete item.source;
        console.log(JSON.stringify(printable, null, 2));
    }

    if (!result.ok) process.exitCode = 1;
}

if (require.main === module) {
    main();
}

module.exports = {
    HELPERS,
    extractHelpers,
    markdownReport
};
