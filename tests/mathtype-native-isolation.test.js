const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createQisiLocalServer
} = require('../qisi-local-server.js');
const {
  normalizeFailure,
  translateWithFaultIsolation
} = require('../qisi-mathtype-native-guard.js');

const rows = (...ids) => ids.map(id => ({
  id,
  mtefBase64: 'BQ=='
}));

test('native crash isolation preserves good equations and quarantines only the bad item', async () => {
  const calls = [];
  const payload = await translateWithFaultIsolation(
    rows('good-1', 'bad', 'good-2'),
    async equations => {
      calls.push(equations.map(row => row.id));
      if (equations.some(row => row.id === 'bad')) {
        const error = new Error([
          'System.AccessViolationException:',
          'at QisiMathTypeNative.MTXFormEqn(...)',
          'at System.Management.Automation.Interpreter...'
        ].join('\n'));
        error.code = 'MATHTYPE_NATIVE_PROCESS_FAILED';
        error.isolatable = true;
        throw error;
      }
      return {
        equations: equations.map(row => ({
          id: row.id,
          ok: true,
          code: 'MATHTYPE_LATEX_OK',
          latex: 'x'
        }))
      };
    }
  );

  assert.deepEqual(payload.equations.map(row => row.id), ['good-1', 'bad', 'good-2']);
  assert.deepEqual(payload.equations.map(row => row.ok), [true, false, true]);
  assert.equal(payload.equations[1].code, 'MATHTYPE_NATIVE_PROCESS_FAILED');
  assert.doesNotMatch(JSON.stringify(payload), /AccessViolationException|MTXFormEqn|Automation\.Interpreter/);
  assert.deepEqual(calls, [
    ['good-1', 'bad', 'good-2'],
    ['good-1', 'bad'],
    ['good-1'],
    ['bad'],
    ['good-2']
  ]);
});

test('non-isolatable native availability failure does not fan out into repeated processes', async () => {
  let calls = 0;
  const payload = await translateWithFaultIsolation(
    rows('one', 'two', 'three'),
    async () => {
      calls += 1;
      const error = new Error('sensitive local path');
      error.code = 'MATHTYPE_DLL_NOT_FOUND';
      error.isolatable = false;
      throw error;
    }
  );

  assert.equal(calls, 1);
  assert.equal(payload.equations.every(row => !row.ok), true);
  assert.equal(payload.equations.every(row => row.code === 'MATHTYPE_DLL_NOT_FOUND'), true);
  assert.doesNotMatch(JSON.stringify(payload), /sensitive local path/);
});

test('failure normalization exposes only stable codes and safe messages', () => {
  assert.deepEqual(
    normalizeFailure({
      code: 'not valid!!!',
      message: 'C:\\secret\\stack',
      isolatable: true
    }),
    {
      code: 'MATHTYPE_NATIVE_ITEM_FAILED',
      message: 'MathType could not translate this formula. It was isolated for local fallback or manual review.',
      isolatable: true
    }
  );
});

test('local endpoint returns partial rows without leaking native stack text', async t => {
  const service = createQisiLocalServer({
    port: 0,
    mathTypeBatchInvoker: async equations => {
      if (equations.some(row => row.id === 'bad')) {
        const error = new Error('System.AccessViolationException at QisiMathTypeNative.MTXFormEqn C:\\private');
        error.code = 'MATHTYPE_NATIVE_PROCESS_FAILED';
        error.isolatable = true;
        throw error;
      }
      return {
        equations: equations.map(row => ({
          id: row.id,
          ok: true,
          code: 'MATHTYPE_LATEX_OK',
          latex: 'x'
        }))
      };
    }
  });
  await service.start();
  t.after(() => service.close());

  const response = await fetch(
    `http://127.0.0.1:${service.port}/api/convert/mathtype-mtef`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equations: rows('good', 'bad') })
    }
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.equations.map(row => row.ok), [true, false]);
  assert.doesNotMatch(
    JSON.stringify(payload),
    /AccessViolationException|MTXFormEqn|C:\\\\private/
  );
});
