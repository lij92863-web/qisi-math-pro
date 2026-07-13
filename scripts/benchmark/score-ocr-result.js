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

const SAFETY_EVENT_FIELDS = Object.freeze({
    'raw-json-leakage': 'rawJsonLeakage',
    'placeholder-leakage': 'placeholderLeakage',
    'unsafe-sequence-accepted': 'unsafeSequenceAccepted',
    'ownership-mismatch-accepted': 'ownershipMismatchAccepted',
    'controlled-write-bypass': 'controlledWriteBypass',
    'formal-admission-bypass': 'formalAdmissionBypass'
});

const emptySafetyR1 = () => ({
    wrongAnswerAttachment: 0,
    wrongSolutionAttachment: 0,
    fabricatedQuestion: 0,
    rawJsonLeakage: 0,
    placeholderLeakage: 0,
    unsafeSequenceAccepted: 0,
    ownershipMismatchAccepted: 0,
    controlledWriteBypass: 0,
    formalAdmissionBypass: 0
});

const r1QuestionKey = (documentId, row) => [
    String(documentId || ''),
    Number(row?.page),
    Number(row?.sourceOrder),
    String(row?.questionNumber || '')
].join('::');

const optionText = option => typeof option === 'object' && option !== null
    ? option.rawText ?? option.normalizedText ?? ''
    : option ?? '';

const formulaText = formula => typeof formula === 'object' && formula !== null
    ? formula.latex ?? formula.rawText ?? ''
    : formula ?? '';

const combineR1Text = row => [
    row?.stem,
    ...(row?.options || []).map(optionText),
    row?.answer,
    row?.solution
].map(value => String(value ?? '')).join('\n');

const ratio = (numerator, denominator, emptyValue = 1) => denominator
    ? numerator / denominator
    : emptyValue;

const exactNormalized = (left, right) => normalized(left) === normalized(right);

const countPresent = (expectedRows, actualMap, field, predicate = value => String(value ?? '').trim() !== '') => {
    let expected = 0;
    let present = 0;
    for (const [key, row] of expectedRows) {
        if (!predicate(row?.[field])) continue;
        expected += 1;
        if (predicate(actualMap.get(key)?.[field])) present += 1;
    }
    return ratio(present, expected);
};

const countExact = (expectedRows, actualMap, field) => {
    let exact = 0;
    for (const [key, row] of expectedRows) {
        if (actualMap.has(key) && exactNormalized(row?.[field], actualMap.get(key)?.[field])) {
            exact += 1;
        }
    }
    return ratio(exact, expectedRows.length);
};

const isLatexRenderable = value => {
    const text = String(value ?? '');
    let depth = 0;
    for (const character of text) {
        if (character === '{') depth += 1;
        if (character === '}') depth -= 1;
        if (depth < 0) return false;
    }
    return depth === 0;
};

const sanitizeHumanCost = value => {
    if (!value || typeof value !== 'object') return null;
    const numeric = field => Number.isFinite(Number(value[field]))
        ? Math.max(0, Number(value[field]))
        : 0;
    return {
        correctedQuestions: numeric('correctedQuestions'),
        correctedFields: numeric('correctedFields'),
        correctionTimeMs: numeric('correctionTimeMs'),
        reRecognitionCount: numeric('reRecognitionCount'),
        manualReviewRate: Math.min(1, numeric('manualReviewRate'))
    };
};

const scoreDocumentR1 = (truthDocument, resultDocument = {}) => {
    const documentId = String(truthDocument?.documentId || '');
    const qualityTags = Array.isArray(truthDocument?.qualityTags)
        ? [...new Set(truthDocument.qualityTags.map(String))].sort()
        : [];
    const status = String(resultDocument?.status || 'ok');
    const safety = emptySafetyR1();
    if (status !== 'ok') {
        return {
            documentId,
            qualityTags,
            status,
            failure: { code: String(resultDocument?.failure?.code || `ocr-${status}`) },
            metrics: null,
            safety,
            humanCost: null
        };
    }

    const truthQuestions = Array.isArray(truthDocument?.questions) ? truthDocument.questions : [];
    const resultQuestions = Array.isArray(resultDocument?.questions) ? resultDocument.questions : [];
    const truthMap = new Map(truthQuestions.map(row => [r1QuestionKey(documentId, row), row]));
    const resultMap = new Map(resultQuestions.map(row => [r1QuestionKey(documentId, row), row]));
    const matchedKeys = [...truthMap.keys()].filter(key => resultMap.has(key));
    const matchedTruth = matchedKeys.map(key => [key, truthMap.get(key)]);

    const rawTruth = truthQuestions.map(combineR1Text).join('\n');
    const rawResult = matchedKeys.map(key => combineR1Text(resultMap.get(key))).join('\n');
    const truthFormulas = truthQuestions.flatMap(row => (row.formulas || []).map(formulaText));
    const resultFormulas = matchedKeys.flatMap(key =>
        (resultMap.get(key)?.formulas || []).map(formulaText)
    );
    const formulaTokenScore = multisetF1(
        truthFormulas.flatMap(latexTokens),
        resultFormulas.flatMap(latexTokens)
    );
    const formulaSlots = Math.max(truthFormulas.length, resultFormulas.length);
    let formulaExact = 0;
    let renderable = 0;
    for (let index = 0; index < formulaSlots; index += 1) {
        if (exactNormalized(truthFormulas[index], resultFormulas[index])) formulaExact += 1;
        if (isLatexRenderable(resultFormulas[index])) renderable += 1;
    }

    safety.fabricatedQuestion = [...resultMap.keys()].filter(key => !truthMap.has(key)).length;
    for (const key of matchedKeys) {
        const expected = truthMap.get(key);
        const actual = resultMap.get(key);
        if (actual?.answer != null && String(actual.answer).trim() !== '' &&
            !exactNormalized(expected?.answer, actual.answer)) {
            safety.wrongAnswerAttachment += 1;
        }
        if (actual?.solution != null && String(actual.solution).trim() !== '' &&
            !exactNormalized(expected?.solution, actual.solution)) {
            safety.wrongSolutionAttachment += 1;
        }
    }
    for (const event of resultDocument?.safetyEvents || []) {
        const field = SAFETY_EVENT_FIELDS[String(event?.code || event)];
        if (field) safety[field] += 1;
    }

    const expectedOptionCount = truthQuestions.reduce((sum, row) => sum + (row.options || []).length, 0);
    const presentOptionCount = matchedKeys.reduce((sum, key) =>
        sum + (resultMap.get(key)?.options || []).filter(value => String(optionText(value)).trim()).length, 0
    );
    const expectedImageCount = truthQuestions.reduce((sum, row) => sum + (row.images || []).length, 0);
    const exactImageCount = matchedKeys.reduce((sum, key) => {
        const expected = truthMap.get(key)?.images || [];
        const actual = resultMap.get(key)?.images || [];
        return sum + Math.min(expected.length, actual.length);
    }, 0);
    const ownershipErrors = safety.wrongAnswerAttachment + safety.wrongSolutionAttachment +
        safety.ownershipMismatchAccepted;

    return {
        documentId,
        qualityTags,
        status: 'ok',
        metrics: {
            rawCer: cer(rawTruth, rawResult, nfc),
            normalizedCer: cer(rawTruth, rawResult, normalized),
            formula: {
                tokenPrecision: formulaTokenScore.precision,
                tokenRecall: formulaTokenScore.recall,
                tokenF1: formulaTokenScore.f1,
                exactMatch: ratio(formulaExact, formulaSlots),
                renderability: ratio(renderable, formulaSlots)
            },
            structure: {
                matchedQuestions: matchedKeys.length,
                truthQuestions: truthQuestions.length,
                resultQuestions: resultQuestions.length,
                questionPrecision: ratio(matchedKeys.length, resultQuestions.length),
                questionRecall: ratio(matchedKeys.length, truthQuestions.length),
                questionNumberAccuracy: ratio(matchedKeys.length, truthQuestions.length),
                stemCompleteness: countPresent(matchedTruth, resultMap, 'stem'),
                optionCompleteness: ratio(
                    Math.min(presentOptionCount, expectedOptionCount),
                    expectedOptionCount
                ),
                answerAccuracy: countExact(matchedTruth, resultMap, 'answer'),
                solutionAccuracy: countExact(matchedTruth, resultMap, 'solution'),
                imageAttachmentAccuracy: ratio(exactImageCount, expectedImageCount),
                ownershipAccuracy: ratio(
                    Math.max(0, matchedKeys.length - ownershipErrors),
                    truthQuestions.length
                )
            }
        },
        safety,
        humanCost: sanitizeHumanCost(resultDocument?.humanCost)
    };
};

const seededRandom = seed => {
    let state = (Number(seed) >>> 0) || 1;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
};

const mean = values => values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

const quantile = (values, probability) => {
    if (!values.length) return null;
    const sorted = [...values].sort((left, right) => left - right);
    const index = (sorted.length - 1) * probability;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
};

const bootstrapMeanByStratum = (rows, metric, seed, iterations) => {
    if (!rows.length) return null;
    const strata = new Map();
    for (const row of rows) {
        const key = row.qualityTags[0] || 'untagged';
        if (!strata.has(key)) strata.set(key, []);
        strata.get(key).push(row);
    }
    const random = seededRandom(seed);
    const samples = [];
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const selected = [];
        for (const stratum of strata.values()) {
            for (let index = 0; index < stratum.length; index += 1) {
                selected.push(stratum[Math.floor(random() * stratum.length)]);
            }
        }
        samples.push(mean(selected.map(metric)));
    }
    return { low: quantile(samples, 0.025), high: quantile(samples, 0.975) };
};

const summarizeMetric = (rows, metric, seed, iterations) => {
    const values = rows.map(metric).filter(Number.isFinite);
    if (!values.length) return null;
    return {
        mean: mean(values),
        median: quantile(values, 0.5),
        p95: quantile(values, 0.95),
        ci95: bootstrapMeanByStratum(rows, metric, seed, iterations)
    };
};

const aggregateDocumentsR1 = (documentScores, { seed = 1, bootstrapIterations = 10000 } = {}) => {
    const rows = Array.isArray(documentScores) ? documentScores : [];
    const completed = rows.filter(row => row?.status === 'ok' && row.metrics);
    const statusCounts = {};
    for (const row of rows) statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
    const safety = emptySafetyR1();
    for (const row of rows) {
        for (const field of Object.keys(safety)) safety[field] += Number(row?.safety?.[field] || 0);
    }
    const failures = rows.filter(row => row?.status !== 'ok').map(row => ({
        documentId: row.documentId,
        status: row.status,
        code: row.failure?.code || `ocr-${row.status}`
    }));
    const categoryNames = [...new Set(rows.flatMap(row => row.qualityTags || []))].sort();
    const perCategory = Object.fromEntries(categoryNames.map(category => {
        const categoryRows = rows.filter(row => (row.qualityTags || []).includes(category));
        const categoryCompleted = categoryRows.filter(row => row.status === 'ok' && row.metrics);
        return [category, {
            documentCount: categoryRows.length,
            completedDocumentCount: categoryCompleted.length,
            rawCerMean: mean(categoryCompleted.map(row => row.metrics.rawCer))
        }];
    }));
    const fatalSafetyCount = Object.values(safety).reduce((sum, value) => sum + value, 0);
    const iterations = Math.max(1, Math.floor(Number(bootstrapIterations) || 1));
    return {
        documentCount: rows.length,
        completedDocumentCount: completed.length,
        statusCounts,
        failures,
        safety,
        statistics: {
            rawCer: summarizeMetric(completed, row => row.metrics.rawCer, seed, iterations),
            normalizedCer: summarizeMetric(completed, row => row.metrics.normalizedCer, seed + 1, iterations),
            formulaTokenF1: summarizeMetric(completed, row => row.metrics.formula.tokenF1, seed + 2, iterations),
            questionRecall: summarizeMetric(completed, row => row.metrics.structure.questionRecall, seed + 3, iterations),
            ownershipAccuracy: summarizeMetric(completed, row => row.metrics.structure.ownershipAccuracy, seed + 4, iterations)
        },
        perCategory,
        promotionEligible: rows.length >= 10 && failures.length === 0 && fatalSafetyCount === 0
    };
};

if (require.main === module) {
    const truth = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const result = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
    process.stdout.write(`${JSON.stringify(score(truth, result), null, 2)}\n`);
}

module.exports = {
    nfc,
    normalized,
    editDistance,
    cer,
    latexTokens,
    multisetF1,
    keyOf,
    score,
    emptySafetyR1,
    r1QuestionKey,
    scoreDocumentR1,
    aggregateDocumentsR1
};
