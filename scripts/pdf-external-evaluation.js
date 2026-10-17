'use strict';
// Offline evaluation reuses the same production wire/sequence boundary.
const contract = require('../qisi-pdf-external-contract.js');
module.exports = Object.freeze(Object.fromEntries(['validateRequest','validateWireResult','evaluateSequences','assemblePrompt','projectQwenStrictSchema','calculateUsageCost','reserveAttempt','settleAttempt'].map(name => [name, contract[name]])));
