const fs = require('node:fs');

const nfc = value => String(value ?? '').normalize('NFC');
const normalized = value => nfc(value).normalize('NFKC').replace(/\s+/g, ' ').trim();

const editDistance = (left, right) => {
    const a = [...String(left)];
    const b = [...String(right)];
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
        const current = [i];
        for (let j = 1; j <= b.length; j += 1) {
            current[j] = Math.min(
                current[j - 1] + 1,
                previous[j] + 1,
                previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
        previous = current;
    }
    return previous[b.length];
};

const cer = (truth, actual, normalizer = nfc) => {
    const expected = normalizer(truth);
    const observed = normalizer(actual);
    return expected.length
        ? editDistance(expected, observed) / [...expected].length
        : observed.length ? 1 : 0;
};

const latexTokens = value => normalized(value).match(
    /\\[A-Za-z]+|[A-Za-z0-9]+|[{}_^]|[^\s]/g
) || [];

const multisetF1 = (truth, actual) => {
    const expected = new Map();
    for (const token of truth) expected.set(token, (expected.get(token) || 0) + 1);
    let matches = 0;
    for (const token of actual) {
        const count = expected.get(token) || 0;
        if (count) {
            matches += 1;
            expected.set(token, count - 1);
        }
    }
    const precision = actual.length ? matches / actual.length : truth.length ? 0 : 1;
    const recall = truth.length ? matches / truth.length : actual.length ? 0 : 1;
    return {
        precision,
        recall,
        f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0
    };
};

const keyOf = row => `${String(row?.questionNumber || '')}::${Number(row?.sourceOrder)}`;
const combineText = row => [
    row?.stem,
    ...(row?.options || []),
    row?.answer,
    row?.solution
].map(value => String(value || '')).join('\n');

const score = (truthRows, resultRows) => {
    const truth = Array.isArray(truthRows) ? truthRows : [];
    const result = Array.isArray(resultRows) ? resultRows : [];
    const truthMap = new Map(truth.map(row => [keyOf(row), row]));
    const resultMap = new Map(result.map(row => [keyOf(row), row]));
    const matchedKeys = [...truthMap.keys()].filter(key => resultMap.has(key));
    const rawTruth = truth.map(combineText).join('\n');
    const rawResult = matchedKeys.map(key => combineText(resultMap.get(key))).join('\n');
    const truthFormulaTokens = truth.flatMap(row => (row.formulas || []).flatMap(latexTokens));
    const resultFormulaTokens = matchedKeys.flatMap(key =>
        (resultMap.get(key).formulas || []).flatMap(latexTokens)
    );
    const detection = multisetF1([...truthMap.keys()], [...resultMap.keys()]);
    let expectedOptions = 0;
    let presentOptions = 0;
    let wrongAttachments = 0;
    let correctionEdits = 0;
    let formulaTotal = 0;
    let formulaExact = 0;
    for (const key of matchedKeys) {
        const expected = truthMap.get(key);
        const actual = resultMap.get(key);
        expectedOptions += (expected.options || []).filter(Boolean).length;
        presentOptions += (actual.options || []).filter(Boolean).length;
        for (const field of ['answer', 'solution']) {
            if (actual[field] && normalized(actual[field]) !== normalized(expected[field])) {
                wrongAttachments += 1;
            }
        }
        correctionEdits += editDistance(normalized(combineText(expected)), normalized(combineText(actual)));
        const count = Math.max(expected.formulas?.length || 0, actual.formulas?.length || 0);
        formulaTotal += count;
        for (let index = 0; index < count; index += 1) {
            if (normalized(expected.formulas?.[index]) === normalized(actual.formulas?.[index])) {
                formulaExact += 1;
            }
        }
    }
    return {
        rawCer: cer(rawTruth, rawResult, nfc),
        normalizedCer: cer(rawTruth, rawResult, normalized),
        latexToken: multisetF1(truthFormulaTokens, resultFormulaTokens),
        formulaExact: formulaTotal ? formulaExact / formulaTotal : 1,
        questionDetection: detection,
        optionCompleteness: expectedOptions
            ? Math.min(presentOptions, expectedOptions) / expectedOptions
            : 1,
        ownershipSafety: {
            wrongAttachments,
            fabricatedQuestions: [...resultMap.keys()].filter(key => !truthMap.has(key)).length
        },
        manualCorrectionCost: correctionEdits,
        matchedQuestions: matchedKeys.length,
        truthQuestions: truth.length,
        resultQuestions: result.length
    };
};

if (require.main === module) {
    const truth = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const result = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
    process.stdout.write(`${JSON.stringify(score(truth, result), null, 2)}\n`);
}

module.exports = { nfc, normalized, editDistance, cer, latexTokens, multisetF1, keyOf, score };
