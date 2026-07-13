const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('OCR failure taxonomy keeps all ten failure layers separate', () => {
    const taxonomy = read('docs/ocr/OCR_FAILURE_TAXONOMY_R1.md');
    for (const layer of [
        '图像质量', '文字检测', '文字识别', '公式识别', '阅读顺序',
        '题目结构', '答案/解析结构', 'ownership', '安全接受', '人工修正成本'
    ]) {
        assert.match(taxonomy, new RegExp(layer, 'i'));
    }
    assert.match(taxonomy, /evidence/i);
    assert.match(taxonomy, /fail[- ]closed/i);
});

test('corpus protocol prevents page leakage and production promotion below ten documents', () => {
    const protocol = read('docs/ocr/OCR_CORPUS_PROTOCOL_R1.md');
    assert.match(protocol, /local-test-materials\/ocr-quality-r1\//);
    assert.match(protocol, /Calibration set/i);
    assert.match(protocol, /Development set/i);
    assert.match(protocol, /Holdout set/i);
    assert.match(protocol, /按文档划分/);
    assert.match(protocol, /禁止同一.*页面.*跨集合/);
    assert.match(protocol, /少于 10 份.*不得.*production[- ]promot/i);
    assert.match(read('.gitignore'), /^local-test-materials\/$/m);
});

test('R1 ground-truth schema requires document, question, and dual-review evidence', () => {
    const schema = JSON.parse(read('benchmarks/ocr/schema/ground-truth-r1.schema.json'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.type, 'object');
    for (const field of [
        'documentId', 'sourceHash', 'documentType', 'qualityTags', 'pageCount',
        'hardwareProfile', 'split', 'questions', 'annotation'
    ]) {
        assert.ok(schema.required.includes(field), `missing document field: ${field}`);
    }
    const question = schema.$defs.question;
    for (const field of [
        'page', 'sourceOrder', 'questionNumber', 'stem', 'options', 'answer',
        'solution', 'formulas', 'images', 'expectedSafePartial',
        'expectedOwnership', 'notes'
    ]) {
        assert.ok(question.required.includes(field), `missing question field: ${field}`);
    }
    const annotation = schema.$defs.annotation;
    assert.ok(annotation.required.includes('annotatorA'));
    assert.ok(annotation.required.includes('verifierB'));
    assert.ok(annotation.required.includes('disagreementResolution'));
});

test('engine feasibility records five candidates without claiming evaluation or promotion', () => {
    const feasibility = read('docs/ocr/OCR_ENGINE_FEASIBILITY_R1.md');
    for (const candidate of [
        'qwen-vl-plus', 'PP-OCR', 'PaddleOCR-VL', 'olmOCR', 'mock/synthetic'
    ]) {
        assert.match(feasibility, new RegExp(candidate, 'i'));
    }
    for (const field of [
        '官方来源', 'license', '模型体积', 'CPU/GPU/显存', 'Windows',
        'API 成本', '隐私', '输出格式', '失败模式'
    ]) {
        assert.match(feasibility, new RegExp(field, 'i'));
    }
    assert.match(feasibility, /research-only/i);
    assert.match(feasibility, /未评测/);
    assert.match(feasibility, /production-promoted[^\n]*无/i);
});

test('scoring protocol fixes deterministic safety and document-level statistics', () => {
    const scoring = read('docs/benchmark/OCR_SCORING_PROTOCOL_R1.md');
    for (const metric of [
        'raw CER', 'normalized CER', 'token precision', 'token recall',
        'token F1', 'exact match', 'renderability', 'question precision',
        'question number accuracy', 'stem completeness', 'option completeness',
        'answer accuracy', 'solution accuracy', 'image attachment accuracy',
        'ownership accuracy', 'wrong answer attachment',
        'wrong solution attachment', 'fabricated question', 'raw JSON leakage',
        'placeholder leakage', 'unsafe sequence accepted',
        'ownership mismatch accepted', 'controlled-write bypass',
        'manual review rate', 'mean', 'median', 'p95', '95% bootstrap CI',
        'per-category'
    ]) {
        assert.match(scoring, new RegExp(metric, 'i'), `missing metric: ${metric}`);
    }
    assert.match(scoring, /stratified bootstrap/i);
    assert.match(scoring, /按文档/);
    assert.match(scoring, /禁止语义相似度/);
});
