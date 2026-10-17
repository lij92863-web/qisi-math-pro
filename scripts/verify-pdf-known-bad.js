const { spawnSync } = require('child_process');

const result = spawnSync(
    process.execPath,
    [
        '--test',
        'tests/pdf-support-aligner.test.js',
        'tests/pdf-multimodal-v1.test.js',
        'tests/production-import-bridge.test.js',
        'tests/pdf-projection-single-owner.test.js',
        'tests/batch-smoke-mock.test.js'
    ],
    {
        stdio: 'inherit',
        shell: false
    }
);

if (result.status === 0) {
    console.log('[verify-pdf-known-bad] passed');
} else {
    console.log('[verify-pdf-known-bad] failed');
    process.exitCode = result.status || 1;
}
