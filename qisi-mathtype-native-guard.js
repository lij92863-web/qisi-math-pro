'use strict';

const DEFAULT_FAILURE_CODE = 'MATHTYPE_NATIVE_ITEM_FAILED';

const normalizeFailureCode = (value, fallback = DEFAULT_FAILURE_CODE) => {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z][A-Z0-9_]{2,79}$/.test(code) ? code : fallback;
};

const safeFailureMessage = code => {
  const normalized = normalizeFailureCode(code);
  if (normalized.includes('TIMEOUT')) {
    return 'MathType conversion timed out. The formula was isolated for local fallback or manual review.';
  }
  if (normalized.includes('DLL_NOT_FOUND')) {
    return 'MathType is unavailable. The formula was kept for local fallback or manual review.';
  }
  if (normalized.includes('CONNECT_FAILED')) {
    return 'MathType could not be started. The formula was kept for local fallback or manual review.';
  }
  return 'MathType could not translate this formula. It was isolated for local fallback or manual review.';
};

const normalizeFailure = error => {
  const code = normalizeFailureCode(error?.code);
  return {
    code,
    message: safeFailureMessage(code),
    isolatable: error?.isolatable === true
  };
};

const failedRows = (rows, failure) => (rows || []).map(row => ({
  id: String(row?.id || ''),
  ok: false,
  code: failure.code,
  latex: '',
  message: failure.message
}));

const normalizeSuccessfulPayload = (rows, payload) => {
  if (!Array.isArray(payload?.equations)) {
    const error = new Error('MathType helper returned an invalid response.');
    error.code = 'MATHTYPE_INVALID_RESPONSE';
    error.isolatable = true;
    throw error;
  }

  const expectedIds = (rows || []).map(row => String(row?.id || ''));
  const expected = new Set(expectedIds);
  const byId = new Map();

  for (const row of payload.equations) {
    const id = String(row?.id || '');
    if (!expected.has(id) || byId.has(id)) {
      const error = new Error('MathType helper returned an inconsistent equation set.');
      error.code = 'MATHTYPE_INVALID_RESPONSE';
      error.isolatable = true;
      throw error;
    }
    byId.set(id, row);
  }

  if (byId.size !== expectedIds.length) {
    const error = new Error('MathType helper omitted one or more equations.');
    error.code = 'MATHTYPE_INVALID_RESPONSE';
    error.isolatable = true;
    throw error;
  }

  const equations = expectedIds.map(id => {
    const row = byId.get(id);
    if (row?.ok) {
      return {
        id,
        ok: true,
        code: normalizeFailureCode(row.code, 'MATHTYPE_LATEX_OK'),
        latex: String(row.latex || '')
      };
    }
    const failure = normalizeFailure(row);
    return {
      id,
      ok: false,
      code: failure.code,
      latex: '',
      message: failure.message
    };
  });

  return {
    ok: equations.every(row => row.ok),
    code: equations.every(row => row.ok)
      ? 'MATHTYPE_BATCH_COMPLETE'
      : 'MATHTYPE_BATCH_PARTIAL',
    equations
  };
};

const translateWithFaultIsolation = async (rows, invokeBatch) => {
  const equations = Array.isArray(rows) ? rows : [];
  if (!equations.length) {
    return {
      ok: true,
      code: 'MATHTYPE_BATCH_EMPTY',
      equations: []
    };
  }
  if (typeof invokeBatch !== 'function') {
    throw new TypeError('invokeBatch must be a function.');
  }

  try {
    return normalizeSuccessfulPayload(equations, await invokeBatch(equations));
  } catch (error) {
    const failure = normalizeFailure(error);
    if (!failure.isolatable || equations.length === 1) {
      return {
        ok: false,
        code: failure.code,
        equations: failedRows(equations, failure)
      };
    }

    const splitAt = Math.ceil(equations.length / 2);
    const left = await translateWithFaultIsolation(
      equations.slice(0, splitAt),
      invokeBatch
    );
    const right = await translateWithFaultIsolation(
      equations.slice(splitAt),
      invokeBatch
    );
    const isolated = [...left.equations, ...right.equations];

    return {
      ok: isolated.every(row => row.ok),
      code: isolated.every(row => row.ok)
        ? 'MATHTYPE_BATCH_RECOVERED'
        : 'MATHTYPE_BATCH_PARTIAL',
      equations: isolated
    };
  }
};

module.exports = {
  normalizeFailure,
  normalizeSuccessfulPayload,
  safeFailureMessage,
  translateWithFaultIsolation
};
