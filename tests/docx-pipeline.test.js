const test = require('node:test'); const assert = require('node:assert/strict');
const { normalizeDocxPipelineResult } = require('../qisi-docx-pipeline.js');
test('BM11: full mode', () => { const r = normalizeDocxPipelineResult([{q:'1'},{q:'2'}], [{q:'1',a:'A'},{q:'2',a:'B'}], [{q:'1',s:'S1'},{q:'2',s:'S2'}]); assert.equal(r.mode, 'full'); });
test('BM11: partial mode', () => { const r = normalizeDocxPipelineResult([{q:'1'},{q:'2'}], [{q:'1',a:'A'}], []); assert.equal(r.mode, 'partial'); });
