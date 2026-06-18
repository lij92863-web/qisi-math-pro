const { spawnSync } = require('child_process');

const result = spawnSync(
    process.execPath,
    ['--test', 'tests/batch-smoke-mock.test.js'],
    {
        stdio: 'inherit',
        shell: false
    }
);

if (result.status === 0) {
    console.log('[verify-docx-stable] passed');
} else {
    console.log('[verify-docx-stable] failed');
    process.exitCode = result.status || 1;
}
