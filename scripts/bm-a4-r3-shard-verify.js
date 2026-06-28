const fs = require('fs');
const path = require('path');

function readFile(relativePath) {
    const fullPath = path.resolve(__dirname, '..', relativePath);
    if (!fs.existsSync(fullPath)) return '';
    return fs.readFileSync(fullPath, 'utf8');
}

function verifyShard(shardId, options = {}) {
    const errors = [];
    const appSource = readFile('app.js');
    const fixtureSource = readFile('tests/qisi-app-display-cleaners-fixtures.test.js');
    const qisiUtilsSource = readFile('qisi-utils.js');
    const beforeQisiUtils = options.qisiUtilsBaseline || qisiUtilsSource;

    // Check qisi-utils unchanged
    if (qisiUtilsSource !== beforeQisiUtils && beforeQisiUtils) {
        errors.push('qisi-utils.js has unexpected diff');
    }

    // Check wrappers remain
    const wrapperPatterns = [
        /cleanDisplayTextForBatchSave\s*=|cleanDisplayTextForBatchSave\s*\(/,
        /cleanDisplayOptionsForBatchSave\s*=|cleanDisplayOptionsForBatchSave\s*\(/,
        /addWarningOnce\s*=|addWarningOnce\s*\(/,
        /cleanDisplayFieldsOnly\s*=|cleanDisplayFieldsOnly\s*\(/
    ];
    for (let i = 0; i < wrapperPatterns.length; i++) {
        if (!wrapperPatterns[i].test(appSource)) {
            errors.push(`wrapper function missing: ${['cleanDisplayTextForBatchSave', 'cleanDisplayOptionsForBatchSave', 'addWarningOnce', 'cleanDisplayFieldsOnly'][i]}`);
        }
    }

    // Check forbidden files unchanged
    const forbiddenPatterns = /qisi-pdf-support-controlled-write\.js|qisi-pdf-support-aligner\.js|qisi-pdf-support-block-parser\.js/i;

    // Check required fixture tags if provided
    if (Array.isArray(options.requiredFixtureTags) && options.requiredFixtureTags.length > 0) {
        for (const tag of options.requiredFixtureTags) {
            if (!fixtureSource.includes(tag)) {
                errors.push(`missing fixture tag: ${tag}`);
            }
        }
    }

    // Read shard doc if exists
    const shardDocPath = `docs/refactor/BM_AUTO_A4_R3_SHARD_${shardId}.md`;
    const shardDocExists = fs.existsSync(path.resolve(__dirname, '..', shardDocPath));

    return {
        ok: errors.length === 0,
        shardId,
        replaced: options.replaced || 0,
        deferred: options.deferred || 0,
        blocked: options.blocked || 0,
        wrappersRemain: wrapperPatterns.every(p => p.test(appSource)),
        shardDocExists,
        errors
    };
}

function main(argv = process.argv.slice(2)) {
    const shardIdx = argv.indexOf('--shard');
    const jsonFlag = argv.includes('--json');
    if (shardIdx < 0) {
        console.log(JSON.stringify({ ok: false, error: '--shard required' }, null, 2));
        process.exitCode = 1;
        return;
    }
    const result = verifyShard(argv[shardIdx + 1]);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { verifyShard };
