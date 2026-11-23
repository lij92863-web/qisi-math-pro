const path = require('node:path');
const { probeLocalInstance } = require('../qisi-local-instance');

const port = Number(process.argv[2] || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  process.exitCode = 1;
} else {
  probeLocalInstance({ root: path.resolve(__dirname, '..'), port })
    .then(state => {
      process.exitCode = { same: 0, absent: 2, other: 3 }[state] ?? 1;
    })
    .catch(() => { process.exitCode = 1; });
}
