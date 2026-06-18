const { spawnSync } = require('child_process');

const npmCommand =
    process.platform === 'win32'
        ? 'npm.cmd'
        : 'npm';

const commands = [
    ['run', 'verify:docx-stable'],
    ['run', 'verify:pdf-known-bad'],
    ['run', 'verify:no-real-ai'],
    ['run', 'smoke:batch:mock']
];

for (const args of commands) {
    const result =
        process.platform === 'win32'
            ? spawnSync(
                [npmCommand, ...args].join(' '),
                {
                    stdio: 'inherit',
                    shell: true
                }
            )
            : spawnSync(
                npmCommand,
                args,
                {
                    stdio: 'inherit',
                    shell: false
                }
            );

    if (result.error || result.status !== 0) {
        console.log('[verify-batch-safety] failed');
        if (result.error) {
            console.error(result.error.message);
        }
        process.exitCode = result.status || 1;
        return;
    }
}

console.log('[verify-batch-safety] passed');
