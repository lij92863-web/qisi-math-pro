(function(root,factory){ const api=factory(root); if(typeof module!=='undefined'&&module.exports)module.exports=api; root.Qisi=root.Qisi||{}; root.Qisi.PdfExternalContract=api; })(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const schema={"$schema":"https://json-schema.org/draft/2020-12/schema","title":"PDF external recognition wire v2.1","type":"object","additionalProperties":false,"required":["questions","answers","solutions","unassigned","pages","warnings"],"properties":{"questions":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["source_id","scope_id","question_no","number_text","number_page","source_pages","status","figures","issues","type","stem","options"],"properties":{"source_id":{"type":"string"},"scope_id":{"type":"string"},"question_no":{"type":"string","minLength":1},"number_text":{"type":"string","minLength":1},"number_page":{"type":"integer","minimum":1},"source_pages":{"type":"array","minItems":1,"uniqueItems":true,"items":{"type":"integer","minimum":1}},"status":{"enum":["observed_complete","open_start","open_end","open_both","uncertain"]},"figures":{"type":"array","items":{"$ref":"#/$defs/figure"}},"issues":{"type":"array","items":{"type":"string"}},"type":{"enum":["single_choice","multiple_choice","fill_blank","free_response","unknown"]},"stem":{"type":"string"},"options":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["label","text"],"properties":{"label":{"type":"string"},"text":{"type":"string"}}}}}}},"answers":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["source_id","scope_id","question_no","number_text","number_page","source_pages","status","figures","issues","text"],"properties":{"source_id":{"type":"string"},"scope_id":{"type":"string"},"question_no":{"type":"string","minLength":1},"number_text":{"type":"string","minLength":1},"number_page":{"type":"integer","minimum":1},"source_pages":{"type":"array","minItems":1,"uniqueItems":true,"items":{"type":"integer","minimum":1}},"status":{"enum":["observed_complete","open_start","open_end","open_both","uncertain"]},"figures":{"type":"array","items":{"$ref":"#/$defs/figure"}},"issues":{"type":"array","items":{"type":"string"}},"text":{"type":"string"}}}},"solutions":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["source_id","scope_id","question_no","number_text","number_page","source_pages","status","figures","issues","text"],"properties":{"source_id":{"type":"string"},"scope_id":{"type":"string"},"question_no":{"type":"string","minLength":1},"number_text":{"type":"string","minLength":1},"number_page":{"type":"integer","minimum":1},"source_pages":{"type":"array","minItems":1,"uniqueItems":true,"items":{"type":"integer","minimum":1}},"status":{"enum":["observed_complete","open_start","open_end","open_both","uncertain"]},"figures":{"type":"array","items":{"$ref":"#/$defs/figure"}},"issues":{"type":"array","items":{"type":"string"}},"text":{"type":"string"}}}},"unassigned":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["source_id","scope_id","source_pages","kind","text","figures","reason"],"properties":{"source_id":{"type":"string"},"scope_id":{"type":"string"},"source_pages":{"type":"array","minItems":1,"uniqueItems":true,"items":{"type":"integer","minimum":1}},"kind":{"enum":["question","answer","solution","unknown"]},"text":{"type":"string"},"figures":{"type":"array","items":{"$ref":"#/$defs/figure"}},"reason":{"type":"string"}}}},"pages":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["source_id","page","state","issues"],"properties":{"source_id":{"type":"string"},"page":{"type":"integer","minimum":1},"state":{"enum":["content","blank","unreadable","context_only"]},"issues":{"type":"array","items":{"type":"string"}}}}},"warnings":{"type":"array","items":{"type":"string"}}},"$defs":{"figure":{"type":"object","additionalProperties":false,"required":["id","page","field","option_label","asset_id","bbox"],"properties":{"id":{"type":"string"},"page":{"type":"integer","minimum":1},"field":{"enum":["stem","option","answer","solution","unassigned"]},"option_label":{"type":["string","null"]},"asset_id":{"type":["string","null"]},"bbox":{"anyOf":[{"type":"array","minItems":4,"maxItems":4,"items":{"type":"number","minimum":0,"maximum":1}},{"type":"null"}]}}}}};
const STREAMS = ['questions', 'answers', 'solutions'];
const clone = value => JSON.parse(JSON.stringify(value));
const WIRE_VERSION = 'pdf-external-v2.2';
const LEGACY_WIRE_VERSION = 'pdf-external-v2.1';
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const objectSchema = properties => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const stringSchema = { type: 'string', minLength: 1 }, pageSchema = { type: 'integer', minimum: 1 };
const listSchema = items => ({ type: 'array', items });
const contextRequestSchema = objectSchema({ source_id: stringSchema, pages: { ...listSchema(pageSchema), minItems: 1, uniqueItems: true }, item_ids: { ...listSchema(stringSchema), uniqueItems: true }, reason: stringSchema });
const evidenceSchema = objectSchema({ source_id: stringSchema, page: pageSchema, field: { enum: ['stem','option','answer','solution'] }, option_label: { type: ['string','null'] }, quote: stringSchema, block_id: { type: ['string','null'] } });
const schemaV22 = clone(schema);
schemaV22.title = 'PDF external recognition wire v2.2';
Object.assign(schemaV22.properties, { wire_version: { enum: [WIRE_VERSION] }, requests: listSchema(contextRequestSchema) });
schemaV22.required.push('wire_version', 'requests');
for (const stream of [...STREAMS, 'unassigned']) {
    const item = schemaV22.properties[stream].items;
    item.required.push('item_id'); item.properties.item_id = stringSchema;
    if (stream !== 'unassigned') {
        item.required.push('occurrence_id', 'evidence');
        Object.assign(item.properties, { occurrence_id: stringSchema, evidence: { ...listSchema(evidenceSchema), minItems: 1 } });
    }
}
const reviewSchema = objectSchema({
    review_version: { enum: ['pdf-external-review-v1'] }, candidate_hash: stringSchema,
    pages: listSchema(objectSchema({ source_id: stringSchema, page: pageSchema, state: { enum: ['checked','unreadable','missing'] }, issues: listSchema(stringSchema) })),
    items: listSchema(objectSchema({ item_id: stringSchema, verdict: { enum: ['pass','fail','uncertain'] },
        issues: listSchema(objectSchema({ code: { enum: ['omission','ownership','transcription','formula','table','figure','source_conflict','display','other'] }, field: { enum: ['questionNumber','stem','option','options','answer','solution','images','type','item'] }, detail: stringSchema, source_pages: { ...listSchema(pageSchema), minItems: 1, uniqueItems: true } })),
        evidence: { ...listSchema(objectSchema({ source_id: stringSchema, page: pageSchema, quote: stringSchema })), minItems: 1 } })),
    unrepresented: listSchema(objectSchema({ source_id: stringSchema, page: pageSchema, quote: stringSchema, reason: stringSchema })),
    requests: listSchema(contextRequestSchema), summary: { type: 'string' }
});
freeze(schema); freeze(schemaV22); freeze(reviewSchema);
function getWireSchema(version = WIRE_VERSION) {
    if (version === WIRE_VERSION) return schemaV22;
    if (version === LEGACY_WIRE_VERSION) return schema;
    throw new Error('PDF_EXTERNAL_WIRE_VERSION_UNSUPPORTED');
}
function normalizedNumberLabel(text) {
    const match = text.normalize('NFKC').trim().match(/^(?:([1-9]\d*)[.、。]?|\(([1-9]\d*)\)[.、。]?)$/);
    return match ? match[1] || match[2] : null;
}
function contextRequestErrors(requests, metadata, itemIds, errors) {
    for (const request of requests) {
        const source = metadata.sources.find(s => s.source_id === request.source_id);
        if (!source || !orderedPages(request.pages) || request.pages.some(p => p > source.total_pages) || request.item_ids.some(id => !itemIds.has(id))) errors.push('context-request-reference');
    }
}
const orderedPages = value => Array.isArray(value) && value.length > 0 && value.every((n, i) => Number.isSafeInteger(n) && n > 0 && (!i || n > value[i - 1]));

function validateRequest(metadata) {
    const errors = [], ids = new Set();
    if (!metadata || !Array.isArray(metadata.sources) || !metadata.sources.length || !Array.isArray(metadata.assets)) return { valid: false, errors: ['request-shape'] };
    for (const source of metadata.sources) {
        if (!source || typeof source.source_id !== 'string' || !source.source_id || ids.has(source.source_id)) { errors.push('source-id'); continue; }
        ids.add(source.source_id);
        if (typeof source.scope_id !== 'string' || !source.scope_id || !['question', 'support', 'full'].includes(source.document_role)) errors.push('source-scope-role');
        const allowed = source.allowed_streams;
        if (!Array.isArray(allowed) || !allowed.length || new Set(allowed).size !== allowed.length || allowed.some(s => !STREAMS.includes(s)) || source.document_role === 'question' && allowed.some(s => s !== 'questions') || source.document_role === 'support' && allowed.includes('questions')) errors.push('allowed-streams');
        if (!Number.isSafeInteger(source.total_pages) || source.total_pages < 1 || !orderedPages(source.input_pages) || !orderedPages(source.output_pages) || !Array.isArray(source.context_only_pages) || source.context_only_pages.length && !orderedPages(source.context_only_pages)) { errors.push('request-pages'); continue; }
        const input = new Set(source.input_pages), output = new Set(source.output_pages), context = new Set(source.context_only_pages);
        if (source.input_pages.some(p => p > source.total_pages) || source.output_pages.some(p => !input.has(p) || context.has(p)) || source.context_only_pages.some(p => !input.has(p)) || input.size !== output.size + context.size) errors.push('request-page-partition');
    }
    const assetIds = new Set();
    for (const asset of metadata.assets) {
        if (!asset || typeof asset.asset_id !== 'string' || !asset.asset_id || assetIds.has(asset.asset_id) || !ids.has(asset.source_id) || !metadata.sources.find(s => s.source_id === asset.source_id)?.input_pages.includes(asset.page)) errors.push('request-asset');
        else assetIds.add(asset.asset_id);
    }
    if (metadata.blocks !== undefined) {
        const blocks = new Set();
        if (!Array.isArray(metadata.blocks)) errors.push('request-blocks');
        else for (const block of metadata.blocks) {
            const key = JSON.stringify([block?.source_id, block?.page, block?.block_id]);
            if (!block || typeof block.block_id !== 'string' || !block.block_id || blocks.has(key) || !metadata.sources.some(s => s.source_id === block.source_id && s.input_pages.includes(block.page))) errors.push('request-block');
            blocks.add(key);
        }
    }
    return { valid: !errors.length, errors };
}

// Only this frozen wire schema's small keyword subset is evaluated here.
function schemaErrors(rule, value, at = '$', errors = [], definitions = schema.$defs) {
    if (rule.$ref) return schemaErrors(definitions[rule.$ref.split('/').pop()], value, at, errors, definitions);
    if (rule.anyOf && !rule.anyOf.some(r => !schemaErrors(r, value, at, [], definitions).length)) errors.push(at + ':anyOf');
    if (rule.enum && !rule.enum.includes(value)) errors.push(at + ':enum');
    const matches = t => t === 'null' ? value === null : t === 'array' ? Array.isArray(value) : t === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value) : t === 'integer' ? Number.isSafeInteger(value) : t === 'number' ? Number.isFinite(value) : typeof value === t;
    if (rule.type && !(Array.isArray(rule.type) ? rule.type : [rule.type]).some(matches)) { errors.push(at + ':type'); return errors; }
    if (typeof value === 'number' && (rule.minimum !== undefined && value < rule.minimum || rule.maximum !== undefined && value > rule.maximum)) errors.push(at + ':range');
    if (typeof value === 'string' && rule.minLength !== undefined && [...value].length < rule.minLength) errors.push(at + ':minLength');
    if (Array.isArray(value)) {
        if (rule.minItems !== undefined && value.length < rule.minItems || rule.maxItems !== undefined && value.length > rule.maxItems) errors.push(at + ':length');
        if (rule.uniqueItems && new Set(value.map(v => JSON.stringify(v))).size !== value.length) errors.push(at + ':unique');
        if (rule.items) value.forEach((v, i) => schemaErrors(rule.items, v, `${at}[${i}]`, errors, definitions));
    }
    if (rule.properties && value && typeof value === 'object' && !Array.isArray(value)) {
        for (const name of rule.required) if (!Object.hasOwn(value, name)) errors.push(at + '.' + name + ':required');
        for (const [name, v] of Object.entries(value)) {
            if (!Object.hasOwn(rule.properties, name)) errors.push(at + '.' + name + ':additional');
            else schemaErrors(rule.properties[name], v, at + '.' + name, errors, definitions);
        }
    }
    return errors;
}

function validateWireResult(text, metadata, transport = {}) {
    const request = validateRequest(metadata);
    if (!request.valid) return { valid: false, errors: request.errors, result: null };
    if (transport.finishReason !== 'stop' || transport.refusal || transport.ok !== true) return { valid: false, errors: ['provider-terminal'], result: null };
    let result;
    try { result = JSON.parse(text); } catch (_) { return { valid: false, errors: ['json-invalid'], result: null }; }
    const version = result?.wire_version || LEGACY_WIRE_VERSION;
    if (![WIRE_VERSION, LEGACY_WIRE_VERSION].includes(version) || transport.expectedWireVersion && transport.expectedWireVersion !== version) return { valid: false, errors: ['wire-version'], result: null };
    // Historical v2.1 has no version field; an injected version is never silently ignored.
    const activeSchema = version === WIRE_VERSION ? schemaV22 : schema;
    const errors = schemaErrors(activeSchema, result);
    if (errors.length) return { valid: false, errors, result: null };
    const sourceMap = new Map(metadata.sources.map(s => [s.source_id, s]));
    const assets = new Map(metadata.assets.map(a => [a.asset_id, a]));
    const figureIds = new Set(), pageKeys = new Set(), itemIds = new Set();
    for (const page of result.pages) {
        const source = sourceMap.get(page.source_id), key = JSON.stringify([page.source_id, page.page]);
        if (!source || !source.input_pages.includes(page.page) || pageKeys.has(key)) errors.push('page-membership');
        if (source && source.context_only_pages.includes(page.page) !== (page.state === 'context_only')) errors.push('page-context-state');
        pageKeys.add(key);
    }
    for (const source of metadata.sources) for (const page of source.input_pages) if (!pageKeys.has(JSON.stringify([source.source_id, page]))) errors.push('page-missing');
    for (const stream of [...STREAMS, 'unassigned']) for (const item of result[stream]) {
        const source = sourceMap.get(item.source_id);
        if (!source || source.scope_id !== item.scope_id || item.source_pages.some(p => !source.input_pages.includes(p))) { errors.push('item-source'); continue; }
        if (stream !== 'unassigned') {
            if (!source.allowed_streams.includes(stream)) errors.push('item-role');
            if (!item.source_pages.includes(item.number_page) || !source.output_pages.includes(item.number_page)) errors.push('item-owner');
            if (version === WIRE_VERSION && normalizedNumberLabel(item.number_text) !== item.question_no) errors.push('item-number-label');
        }
        if (item.source_pages.some(p => result.pages.some(page => page.source_id === item.source_id && page.page === p && page.state === 'blank'))) errors.push('blank-page-content');
        if (version === WIRE_VERSION) {
            if (itemIds.has(item.item_id)) errors.push('item-id-duplicate');
            itemIds.add(item.item_id);
            for (const ref of item.evidence || []) {
                const fieldValid = stream === 'questions' ? ref.field === 'stem' && ref.option_label === null || ref.field === 'option' && item.options.some(o => o.label === ref.option_label) : ref.field === (stream === 'answers' ? 'answer' : 'solution') && ref.option_label === null;
                if (ref.source_id !== item.source_id || !item.source_pages.includes(ref.page) || !fieldValid) errors.push('item-evidence-reference');
                if (ref.block_id !== null && !(metadata.blocks || []).some(b => b.block_id === ref.block_id && b.source_id === ref.source_id && b.page === ref.page)) errors.push('item-block-reference');
            }
        }
        const fields = stream === 'questions' ? [{ field: 'stem', text: item.stem, label: null }, ...item.options.map(o => ({ field: 'option', text: o.text, label: o.label }))] : [{ field: stream === 'answers' ? 'answer' : stream === 'solutions' ? 'solution' : 'unassigned', text: item.text, label: null }];
        if (stream === 'questions') {
            const labels = item.options.map(o => o.label);
            if (labels.some((label, i) => !/^[A-Z]$/.test(label) || label !== String.fromCharCode(65 + i)) || new Set(labels).size !== labels.length) errors.push('option-labels');
        }
        const tokens = fields.flatMap(field => [...field.text.matchAll(/\[\[figure:([^\]]+)\]\]/g)].map(m => ({ ...field, id: m[1] })));
        for (const figure of item.figures) {
            if (!figure.id || figureIds.has(figure.id) || !item.source_pages.includes(figure.page)) errors.push('figure-identity-page');
            figureIds.add(figure.id);
            const token = tokens.filter(t => t.id === figure.id);
            if (token.length !== 1 || token[0].field !== figure.field || token[0].label !== figure.option_label) errors.push('figure-placement');
            if ((figure.asset_id !== null) === (figure.bbox !== null)) errors.push('figure-resource-choice');
            if (figure.bbox && !(figure.bbox[0] < figure.bbox[2] && figure.bbox[1] < figure.bbox[3])) errors.push('figure-bbox');
            if (figure.asset_id !== null) {
                const asset = assets.get(figure.asset_id);
                if (!asset || asset.source_id !== item.source_id || asset.page !== figure.page) errors.push('figure-asset');
            }
        }
        if (tokens.some(t => !item.figures.some(f => f.id === t.id))) errors.push('figure-token-unresolved');
    }
    if (version === WIRE_VERSION) contextRequestErrors(result.requests, metadata, itemIds, errors);
    return { valid: !errors.length, errors, result: clone(result), semanticQuality: 'not-evaluated' };
}

function validateReviewResult(text, metadata, candidate, candidateHash, transport = {}) {
    if (!validateRequest(metadata).valid || transport.ok !== true || transport.finishReason !== 'stop' || transport.refusal) return { valid: false, passed: false, errors: ['review-terminal-or-request'], result: null };
    let result;
    try { result = JSON.parse(text); } catch (_) { return { valid: false, passed: false, errors: ['review-json-invalid'], result: null }; }
    const errors = schemaErrors(reviewSchema, result);
    if (errors.length) return { valid: false, passed: false, errors, result: null };
    const checkedCandidate = validateWireResult(JSON.stringify(candidate), metadata, { ok: true, finishReason: 'stop', expectedWireVersion: WIRE_VERSION });
    if (!checkedCandidate.valid) return { valid: false, passed: false, errors: ['review-candidate-invalid'], result: clone(result) };
    const expectedItems = new Map([...STREAMS,'unassigned'].flatMap(s => candidate[s]).map(i => [i.item_id, i]));
    const seenPages = new Set(), seenItems = new Set();
    const pageExists = ref => metadata.sources.some(s => s.source_id === ref.source_id && s.input_pages.includes(ref.page));
    if (result.candidate_hash !== candidateHash) errors.push('review-candidate-hash');
    for (const page of result.pages) {
        const key = JSON.stringify([page.source_id,page.page]);
        if (!pageExists(page) || seenPages.has(key)) errors.push('review-page-reference');
        seenPages.add(key);
    }
    for (const source of metadata.sources) for (const page of source.input_pages) if (!seenPages.has(JSON.stringify([source.source_id,page]))) errors.push('review-page-missing');
    for (const item of result.items) {
        const original = expectedItems.get(item.item_id);
        if (!original || seenItems.has(item.item_id)) errors.push('review-item-reference');
        seenItems.add(item.item_id);
        if (item.evidence.some(ref => !pageExists(ref) || original && (ref.source_id !== original.source_id || !original.source_pages.includes(ref.page))) || item.issues.some(issue => original && issue.source_pages.some(p => !metadata.sources.find(s => s.source_id === original.source_id).input_pages.includes(p)))) errors.push('review-evidence-reference');
    }
    for (const id of expectedItems.keys()) if (!seenItems.has(id)) errors.push('review-item-missing');
    if (result.unrepresented.some(ref => !pageExists(ref))) errors.push('review-unrepresented-reference');
    contextRequestErrors(result.requests, metadata, new Set(expectedItems.keys()), errors);
    const passed = !errors.length && result.pages.every(p => p.state === 'checked' && !p.issues.length) && result.items.every(i => i.verdict === 'pass' && !i.issues.length) && !result.unrepresented.length && !result.requests.length;
    return { valid: !errors.length, passed, errors, result: clone(result), semanticQuality: 'model-judgement-not-proof' };
}

function sequenceOf(items) {
    const values = items.map(i => i.question_no), valid = values.every((v, i) => /^[1-9]\d*$/.test(v) && Number.isSafeInteger(Number(v)) && (!i || Number(v) > Number(values[i - 1])));
    return { valid, values };
}

// 可信前缀：从期望首题起，严格递增、不重复、且都属于本卷；第一处违规即截断。
// 违规点本身也要扣留（重号的两条都算不可判定），截断之后的题不再挂答案，
// 但题目本身照旧保留。
function scanStream(values, expectedSet) {
    const accepted = new Set();
    const ambiguous = new Set();
    const seen = new Set();
    for (const raw of values) {
        const value = String(raw);
        if (!/^[1-9]\d*$/.test(value) || !expectedSet.has(value)) break;
        if (seen.has(value)) { ambiguous.add(value); break; }
        accepted.add(value);
        seen.add(value);
    }
    // 重号的那道题本身不可判定：两条都可能是它的，也都不一定，两条都不认。
    for (const value of ambiguous) accepted.delete(value);
    return { accepted, ambiguous };
}

function evaluateSequences(observations, expected, requiredStreams = ['answers', 'solutions']) {
    // Observations must already be supplied in trusted owner page order, never completion order.
    const sequences = Object.fromEntries(STREAMS.map(s => [s, sequenceOf(observations.flatMap(o => o[s]))]));
    const errors = [];
    if (!Array.isArray(expected) || !expected.length || !sequenceOf(expected.map(n => ({ question_no: n }))).valid) errors.push('expected-sequence');
    if (!requiredStreams.length || new Set(requiredStreams).size !== requiredStreams.length || requiredStreams.some(s => !['answers', 'solutions'].includes(s))) errors.push('required-streams');
    if (errors.length) return { mode: 'fail-closed', safeQuestionNumbers: [], withheld: [], errors, sequences };
    const expectedSet = new Set(expected);

    // 题面本身出现重号：该题号的归属不可判定，逐题扣留，不牵连其它题。
    const repeated = new Set();
    const seenQuestions = new Set();
    for (const value of sequences.questions.values) {
        if (seenQuestions.has(value)) repeated.add(value);
        else seenQuestions.add(value);
    }

    // 身份判定：support 流首项必须是本卷首题，且不得出现外来题号。
    // 这种情况说明"这份答案不是这张卷的"，逐题判没有意义，必须整卷停。
    const identityFailures = [];
    for (const stream of requiredStreams) {
        const values = sequences[stream].values;
        if (!values.length) continue;
        if (values[0] !== expected[0]) identityFailures.push(stream + '-identity-unanchored');
        else if (values.some(value => !expectedSet.has(value))) identityFailures.push(stream + '-foreign-question-number');
    }
    if (identityFailures.length) {
        return {
            mode: 'fail-closed',
            safeQuestionNumbers: [],
            withheld: expected.map(question => ({ question, reason: 'identity-untrusted' })),
            errors: identityFailures,
            sequences,
            anchors: Object.fromEntries(requiredStreams.map(stream => [stream, {
                expectedFirst: expected[0],
                observedFirst: sequences[stream].values[0] ?? null
            }]))
        };
    }

    const scans = new Map(requiredStreams.map(stream => [
        stream,
        { values: sequences[stream].values, ...scanStream(sequences[stream].values, expectedSet) }
    ]));
    const present = question => requiredStreams.some(stream => scans.get(stream).values.includes(question));
    const safeQuestionNumbers = [];
    const withheld = [];
    for (const question of expected) {
        if (repeated.has(question)) {
            withheld.push({ question, reason: 'duplicate-question-number' });
            continue;
        }
        const broken = requiredStreams.find(stream => {
            const scan = scans.get(stream);
            return scan.values.includes(question) && !scan.accepted.has(question);
        });
        if (broken) {
            withheld.push({ question, stream: broken, reason: 'sequence-break' });
            continue;
        }
        if (present(question)) safeQuestionNumbers.push(question);
    }
    const covered = expected.filter(question => present(question));
    const leadingRun = safeQuestionNumbers.every((value, index) => value === expected[index]);
    const mode = !safeQuestionNumbers.length ? 'fail-closed'
        : withheld.length ? (leadingRun ? 'prefix' : 'subset')
        : covered.length === expected.length ? 'full' : 'subset';
    return {
        mode,
        safeQuestionNumbers,
        withheld,
        errors: [],
        sequences,
        anchors: Object.fromEntries(requiredStreams.map(stream => [stream, {
            expectedFirst: expected[0],
            observedFirst: sequences[stream].values[0] ?? null,
            anchored: sequences[stream].values.length > 0 && sequences[stream].values[0] === expected[0]
        }]))
    };
}

function assemblePrompt(template, replacements) {
    return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
        if (!Object.hasOwn(replacements, key)) throw new Error('PROMPT_VARIABLE_MISSING:' + key);
        return typeof replacements[key] === 'string' ? replacements[key] : JSON.stringify(replacements[key]);
    });
}

function projectQwenStrictSchema(inputSchema = schema) {
    const dropped = [];
    function project(value, at) {
        if (Array.isArray(value)) return value.map((v, i) => project(v, at + '[' + i + ']'));
        if (!value || typeof value !== 'object') return value;
        return Object.fromEntries(Object.entries(value).filter(([key]) => {
            if (key === 'uniqueItems') { dropped.push(at + '.uniqueItems'); return false; }
            return true;
        }).map(([key, child]) => [key, project(child, at + '.' + key)]));
    }
    return { schema: project(inputSchema, '$'), dropped, localSchemaRequired: true };
}

function calculateUsageCost(usage, tiers) {
    if (!usage || !Number.isSafeInteger(usage.prompt_tokens) || usage.prompt_tokens < 0 || !Number.isSafeInteger(usage.completion_tokens) || usage.completion_tokens < 0) return { known: false, yuan: null, reason: 'usage-missing' };
    const tier = tiers.find(t => usage.prompt_tokens <= t.maxInput);
    if (!tier || !Number.isFinite(tier.inputYuanPerMillion) || !Number.isFinite(tier.outputYuanPerMillion) || tier.inputYuanPerMillion < 0 || tier.outputYuanPerMillion < 0) return { known: false, yuan: null, reason: 'price-tier-missing' };
    return { known: true, yuan: (usage.prompt_tokens * tier.inputYuanPerMillion + usage.completion_tokens * tier.outputYuanPerMillion) / 1e6, tier: tier.maxInput, note: 'Usage-price estimate, not provider invoice; image tokens already included in prompt_tokens.' };
}

function reserveAttempt(ledger, attempt) {
    const next = clone(ledger);
    if (!Array.isArray(next.attempts) || !Number.isSafeInteger(next.maxCalls) || !Number.isSafeInteger(next.maxPageAppearances) || !Number.isFinite(next.maxYuan) || next.maxYuan < 0 || !attempt.id || !Number.isSafeInteger(attempt.pageAppearances) || attempt.pageAppearances < 1 || !Number.isFinite(attempt.reservedYuan) || attempt.reservedYuan < 0) throw new Error('EXPERIMENT_BUDGET_INVALID');
    if (next.attempts.some(a => a.id === attempt.id)) throw new Error('EXPERIMENT_ATTEMPT_ALREADY_REGISTERED');
    const pageAppearances = next.attempts.reduce((n, a) => n + a.pageAppearances, 0);
    const spentAndReserved = next.attempts.reduce((n, a) => n + (a.actualYuan === null ? a.reservedYuan : a.actualYuan), 0);
    if (next.attempts.length + 1 > next.maxCalls || pageAppearances + attempt.pageAppearances > next.maxPageAppearances || spentAndReserved + attempt.reservedYuan > next.maxYuan + Number.EPSILON) throw new Error('EXPERIMENT_BUDGET_EXHAUSTED');
    next.attempts.push({ ...clone(attempt), actualYuan: null, state: 'registered-before-dispatch' });
    return next;
}

function settleAttempt(ledger, id, outcome) {
    const next = clone(ledger), row = next.attempts.find(a => a.id === id);
    if (!row || row.state !== 'registered-before-dispatch') throw new Error('EXPERIMENT_ATTEMPT_STATE_INVALID');
    if (!['received', 'rejected', 'submission_unknown'].includes(outcome.state) || outcome.actualYuan !== null && (!Number.isFinite(outcome.actualYuan) || outcome.actualYuan < 0)) throw new Error('EXPERIMENT_OUTCOME_INVALID');
    Object.assign(row, clone(outcome));
    return next;
}


    const PROTOCOL = 'pdf-external-v2';
    const TYPES = Object.freeze({ single_choice: '单选题', multiple_choice: '多选题', fill_blank: '填空题', free_response: '解答题', unknown: '待确认' });
    const isExternal = q => q?.producer?.routeId === PROTOCOL && q?.pdfExternal?.protocol === PROTOCOL && !q.pdfV1;
    const assert = (ok, at) => { if (!ok) throw Object.assign(new Error('PDF_EXTERNAL_CONTRACT_INVALID'), { code: 'PDF_EXTERNAL_CONTRACT_INVALID', details: { path: at } }); };
    const questionKey = (exam, no) => JSON.stringify([exam, no]);
    const bboxValid = box => Array.isArray(box) && box.length === 4 && box.every(v => Number.isFinite(v) && v >= 0 && v <= 1000) && box[0] < box[2] && box[1] < box[3];
    function insertFigures(item, images, field) {
        const copy = clone(item);
        const replace = text => images.reduce((value, image) => value.split('[[figure:' + image.figureId + ']]').join('[[IMAGE:' + image.id + ']]'), text);
        if (field === 'question') { copy.stem = replace(copy.stem); copy.options = copy.options.map(o => ({ ...o, text: replace(o.text) })); }
        else copy[field] = replace(copy[field] || copy.text || '');
        return copy;
    }
    function buildDrafts(observations, { batchId, identityContract, now = Date.now(), taskProblems = [] } = {}) {
        const questions = observations.flatMap(o => o.result.questions);
        const expected = questions.map(q => q.question_no);
        assert(expected.length && sequenceOf(questions).valid, 'whole-question-sequence');
        const required = [...new Set(observations.flatMap(o => o.metadata.sources.flatMap(s => s.allowed_streams.filter(v => v !== 'questions'))))];
        const gate = required.length ? evaluateSequences(observations.map(o => o.result), expected, required) : { mode: 'fail-closed', safeQuestionNumbers: [], withheld: [], errors: [] };
        const safe = new Set(gate.safeQuestionNumbers), groups = new Map();
const withheldByQuestion = new Map((gate.withheld || []).map(row => [row.question, row]));
        for (const observation of observations) for (const [stream, field] of [['questions','question'],['answers','answer'],['solutions','solution']]) for (const raw of observation.result[stream]) {
            assert(raw.scope_id === batchId, 'source-scope');
            const group = groups.get(raw.question_no) || { no: raw.question_no, question: [], answer: [], solution: [] };
            const item = clone(raw); if (field !== 'question') item[field] = item.text;
            const images = observation.images?.filter(i => i.itemKey === JSON.stringify([stream, raw.question_no])) || [];
            const cropErrors = observation.cropErrors?.filter(i => i.itemKey === JSON.stringify([stream, raw.question_no])) || [];
            group[field].push({ item, wireVersion: observation.result.wire_version || LEGACY_WIRE_VERSION, contextRequests: clone(observation.result.requests || []), transcriptionIssues: clone(observation.transcriptionIssues || []), modelReview: clone(observation.modelReview || { state: 'not_run' }), source: clone(observation.source), model: observation.model, images: clone(images), cropErrors: clone(cropErrors), evidence: [{ requestId: observation.requestId, sourceId: raw.source_id, pages: clone(raw.source_pages) }] });
            groups.set(raw.question_no, group);
        }
        const drafts = [], unmatched = [];
        const observedState = variants => !variants.length ? 'missing' : variants.length > 1 ? 'conflict' : variants[0].item.status === 'observed_complete' && !variants[0].item.issues.length ? 'complete' : 'partial';
        for (const group of groups.values()) {
            if (!group.question.length) { unmatched.push({ questionNumber: group.no, reason: '没有同号主试题', evidence: clone(group) }); continue; }
            const first = group.question[0], source = first.source, reason = 'external-pdf-structured-output';
            const versioned = ['question','answer','solution'].some(field => group[field].some(v => v.wireVersion === WIRE_VERSION));
            const id = batchId + ':pdf-external:' + encodeURIComponent(group.no);
            const draft = { id, batchId, version: 1, questionNumber: group.no, question: group.no, order: drafts.length + 1,
                type: TYPES[first.item.type], stem: '', options: [], answer: '', solution: '', images: [], status: 'pending', manualConfirmed: false, imageReviewStatus: 'none',
                source: clone(source), sourceFileId: source.sourceId, sourceFileName: source.filename, sourcePage: first.item.number_page,
                producer: { mode: 'vision-ai', routeId: PROTOCOL, routeReason: reason, engine: first.model, deterministic: false },
                route: { identity: PROTOCOL, reason, transitions: clone(identityContract.PDF_VISION_TRANSITIONS) },
                sourceTrace: { source: PROTOCOL, sourceFileId: source.sourceId, sourceFileName: source.filename, sourcePage: first.item.number_page },
                fieldProvenance: {}, supportSources: [], warnings: [], createdAt: now, updatedAt: now,
                pdfExternal: { protocol: PROTOCOL, examId: batchId, states: {}, candidates: clone(group), sourcePageImages: [], optionLabels: [], sequenceGate: clone(gate), taskProblems: clone(taskProblems), taskIssuesAcknowledged: false } };
            if (versioned) {
                const variants = ['question','answer','solution'].flatMap(f => group[f]);
                draft.pdfExternal.wireVersion = WIRE_VERSION;
                draft.pdfExternal.reviewStates = { transportState: 'received', schemaState: 'valid', modelObservation: Object.fromEntries(['question','answer','solution'].map(f => [f, observedState(group[f])])), modelReview: variants.every(v => v.modelReview.state === 'pass') ? 'pass' : variants.some(v => v.modelReview.state === 'fail') ? 'fail' : 'pending', humanReview: 'pending' };
            }
            for (const field of ['question','answer','solution']) {
                let status = observedState(group[field]);
                const withheldReason = withheldByQuestion.get(group.no);
                if (field !== 'question' && group[field].length && (!safe.has(group.no) || withheldReason)) status = 'rejected';
                const variant = group[field][0]; draft.pdfExternal.states[field] = versioned && status === 'complete' ? 'observed_complete' : status;
                if (!variant) continue;
                const item = insertFigures(variant.item, variant.images, field);
                if (field === 'question') { draft.stem = item.stem; draft.options = item.options.map(o => o.text); draft.pdfExternal.optionLabels = item.options.map(o => o.label); if (!draft.stem.trim() || draft.type === '待确认') draft.pdfExternal.states.question = 'partial'; }
                // 被判定不可信的取值不进展示字段：留空并交给审核页补，界面不显示"看着有、其实没挂上"的内容。
                else if (status !== 'rejected') draft[field] = item[field];
                draft.images.push(...clone(variant.images));
                draft.warnings.push(...variant.item.issues);
                if (status !== 'complete') draft.warnings.push(field + ': ' + status + (withheldReason ? `（${withheldReason.reason}${withheldReason.stream ? '/' + withheldReason.stream : ''}）` : '') + '，请对照原页处理');
                for (const candidate of group[field]) if (candidate.source.sourceId !== source.sourceId) {
                    let support = draft.supportSources.find(s => s.sourceId === candidate.source.sourceId);
                    if (!support) { support = { ...clone(candidate.source), roles: [] }; draft.supportSources.push(support); }
                    support.roles = [...new Set([...support.roles, field])];
                }
            }
            const imageProblem = ['question','answer','solution'].some(field => group[field].some(v => v.cropErrors.length));
            draft.pdfExternal.states.images = imageProblem ? 'rejected' : 'complete';
            if (imageProblem) draft.warnings.push('原图未全部准备成功，请重裁或明确处理缺图');
            if (draft.images.length) draft.imageReviewStatus = 'need_confirm';
            for (const field of identityContract.FORMAL_FIELDS) {
                const unit = ['questionNumber','stem','options'].includes(field) ? 'question' : field;
                const variant = (group[unit] || group.question)[0], src = field === 'images' ? source : variant?.source || source;
                const value = field === 'questionNumber' ? draft.questionNumber : draft[field];
                const present = Array.isArray(value) ? value.length > 0 : Boolean(String(value || '').trim());
                const accepted = !versioned && draft.pdfExternal.states[unit] === 'complete';
                // 被判定不可信的字段是"有来源但拒绝采用"，凭证必须是 rejected，
                // 不能因为展示字段留空就退化成 missing（missing 会被当成"本来就没有"）。
                const kind = draft.pdfExternal.states[unit] === 'rejected'
                    ? 'rejected'
                    : !present ? 'missing'
                    : accepted ? 'controlled-write'
                    : 'rejected';
                draft.fieldProvenance[field] = { field, kind, status: kind, sourceId: src.sourceId, sourceFormat: 'pdf', producerMode: 'vision-ai', routeId: PROTOCOL, engine: first.model, page: variant?.item.number_page || draft.sourcePage, blockIds: [], manuallyEdited: false, controlledWriteAccepted: accepted && present, controlledWriteDecisionId: id + ':' + field, reasonCode: versioned ? 'pdf-external-pending-human-review' : 'pdf-external-' + draft.pdfExternal.states[unit], producerBoundary: src.sourceId === source.sourceId ? 'pdf-vision-engine-output-to-candidate' : 'pdf-external-support-to-candidate', contractVersion: identityContract.CONTRACT_VERSION };
            }
            draft.fieldProvenance.images.imageEvidence = draft.images.map(i => ({ imageId: i.id, sourceId: i.sourceFileId, field: i.position, evidenceRef: 'pdf:' + i.sourceFileId + ':' + i.sourcePage + ':' + JSON.stringify(i.bbox) }));
            draft.images.forEach(i => { i.questionId = id; i.batchId = batchId; });
            if (versioned) draft.pdfExternal.reviewNotice = '模型候选需要对照原页人工采用；模型复核不替代人工确认。';
            draft.warnings = [...new Set(draft.warnings)]; drafts.push(draft);
        }
        validateCanonical(drafts, batchId, identityContract);
        return { drafts, unmatched, sequenceGate: gate };
    }
    function validateCanonical(drafts, batchId, identityContract) {
        const keys = new Set();
        for (const draft of drafts) {
            const key = questionKey(batchId, draft.questionNumber);
            assert(isExternal(draft) && draft.batchId === batchId && draft.pdfExternal.examId === batchId && !keys.has(key), 'canonical.identity');
            assert(identityContract.validateCanonicalIdentity(draft).valid, 'canonical.producer');
            assert(typeof draft.stem === 'string' && Array.isArray(draft.options) && draft.options.every(v => typeof v === 'string') && typeof draft.answer === 'string' && typeof draft.solution === 'string', 'canonical.fields');
            assert(draft.images.every(i => i.id && /^data:image\//.test(i.url) && i.sourceFileId && bboxValid(i.bbox)), 'canonical.images'); keys.add(key);
        }
        return drafts;
    }
    function retainReviewDrafts(drafts, previous) {
        const protectedDraft = q => q.status === 'submitted' || q.userEdited || q.manualEdited || Object.values(q.fieldProvenance || {}).some(p => p.status === 'manual');
        const byId = new Map(previous.filter(protectedDraft).map(q => [q.id, q]));
        const result = drafts.map(fresh => {
            const prior = byId.get(fresh.id);
            if (!prior) return fresh;
            byId.delete(fresh.id);
            if (prior.status === 'submitted') return clone(prior);
            const kept = clone(prior);
            // Preserve teacher fields; fresh machine output remains selectable evidence.
            for (const field of ['question', 'answer', 'solution']) {
                const variants = kept.pdfExternal.candidates[field];
                for (const variant of fresh.pdfExternal.candidates[field]) if (!variants.some(v => JSON.stringify(v) === JSON.stringify(variant))) variants.push(clone(variant));
            }
            kept.pdfExternal.sourcePageImages = [...kept.pdfExternal.sourcePageImages, ...fresh.pdfExternal.sourcePageImages].filter((p, i, all) => all.findIndex(q => q.sourceFileId === p.sourceFileId && q.sourcePage === p.sourcePage) === i);
            kept.pdfExternal.taskProblems = [...new Set([...kept.pdfExternal.taskProblems, ...fresh.pdfExternal.taskProblems])];
            kept.pdfExternal.taskIssuesAcknowledged = false;
            kept.manualConfirmed = false; kept.confirmedAt = null; kept.status = 'pending';
            return kept;
        });
        // A model omission cannot erase a teacher edit or a submitted draft.
        for (const prior of byId.values()) {
            const kept = clone(prior);
            if (kept.status !== 'submitted') {
                kept.manualConfirmed = false; kept.confirmedAt = null; kept.status = 'pending';
                kept.pdfExternal.taskProblems = [...kept.pdfExternal.taskProblems, '本次识别未返回这道已人工处理的题，请对照原卷'];
                kept.pdfExternal.taskIssuesAcknowledged = false;
            }
            result.push(kept);
        }
        return result;
    }
    function acknowledgeTaskIssues(draft, reviewController) {
        assert(isExternal(draft), 'review.task');
        const next = reviewController.markFieldsManual(draft, ['questionNumber']);
        next.pdfExternal.taskIssuesAcknowledged = true;
        return next;
    }
    function reviewPanel(draft) {
        if (!isExternal(draft) || draft.pdfExternal.wireVersion !== WIRE_VERSION) return null;
        const labels = { question: '题目', answer: '答案', solution: '解析' };
        const reviewLabels = { pass: '原模型候选复核通过', fail: '模型复核发现问题', invalid: '复核结果需要检查', pending: '复核尚未完成', not_run: '尚未复核' };
        const findings = [], summaries = [], seen = new Set();
        const addFinding = finding => { const key = JSON.stringify(finding); if (!seen.has(key)) { seen.add(key); findings.push(finding); } };
        const fields = ['question','answer','solution'].map(field => ({ field, label: labels[field], candidates: draft.pdfExternal.candidates[field].map((variant, index) => {
            const item = insertFigures(variant.item, variant.images || [], field), report = variant.modelReview?.result;
            const review = report?.items?.find(entry => entry.item_id === variant.item.item_id);
            const sourceId = variant.source.sourceId;
            if (report?.summary && !summaries.includes(report.summary)) summaries.push(report.summary);
            for (const ref of report?.unrepresented || []) addFinding({ sourceFileId: ref.source_id, sourcePage: ref.page, label: '本次识别未表达的来源内容', text: ref.quote, detail: ref.reason });
            for (const request of report?.requests || []) for (const page of request.pages) addFinding({ sourceFileId: request.source_id, sourcePage: page, label: '模型请求补充来源页', text: '', detail: request.reason });
            for (const request of variant.contextRequests || []) for (const page of request.pages) addFinding({ sourceFileId: request.source_id, sourcePage: page, label: '模型请求补充来源页', text: '', detail: request.reason });
            for (const issue of variant.transcriptionIssues || []) addFinding({ sourceFileId: issue.source_id || sourceId, sourcePage: issue.page, label: issue.stage === 'locate' ? '原页定位标疑' : '原页转写标疑', text: issue.message, detail: issue.block_id || '' });
            return { index, sourceName: variant.source.filename, sourceFileId: sourceId, sourcePages: clone(variant.item.source_pages),
                stem: field === 'question' ? item.stem : '', options: field === 'question' ? clone(item.options) : [], text: field === 'question' ? '' : item[field], images: clone(variant.images || []),
                reviewLabel: reviewLabels[variant.modelReview?.state] || '尚未复核', issues: (review?.issues || []).map(issue => ({ ...clone(issue), sourceFileId: sourceId })),
                evidence: clone(review?.evidence || []), sourceIssues: clone(variant.item.issues || []),
                resourceIssues: (variant.cropErrors || []).map(problem => problem.error || '原图尚未准备完成'),
                canAdopt: draft.status !== 'submitted' && !variant.cropErrors?.length && !variant.item.figures.some(f => f.invalid) };
        }) }));
        return { fields, sources: clone(draft.pdfExternal.sourcePageImages || []), findings, summaries, humanLabel: draft.status === 'submitted' ? '已入库' : draft.manualConfirmed ? '已人工确认' : '待人工核对' };
    }
    function reviewProblem(draft) {
        if (draft.pdfExternal.taskProblems.length && !draft.pdfExternal.taskIssuesAcknowledged) return '本任务存在未归属内容或未完成页，请先对照来源并确认本题范围。';
        if (!String(draft.stem || '').trim()) return '题干为空，请对照原页补充。';
        if (!Object.values(TYPES).filter(t => t !== '待确认').includes(draft.type)) return '请选择原卷题型。';
        const rejected = Object.entries(draft.fieldProvenance || {}).filter(([, p]) => p.status === 'rejected').map(([f]) => f);
        if (rejected.length) return `尚未处理不完整或冲突字段：${rejected.join('、')}。请修改或明确采用候选。`;
        if (['单选题', '多选题'].includes(draft.type) && (draft.options.length < 2 || draft.options.some(o => !o.trim()) || draft.pdfExternal.optionLabels?.length !== draft.options.length || draft.pdfExternal.optionLabels.some((label, i) => label !== String.fromCharCode(65 + i)))) return '选项标签或正文不完整，请对照原页；缺失标签不会自动重编号。';
        if (['单选题', '多选题', '填空题'].includes(draft.type) && !draft.answer.trim()) return '答案缺失，请人工补充。';
        if (['单选题', '多选题'].includes(draft.type)) {
            const labels = draft.pdfExternal.optionLabels;
            const answer = draft.answer.replace(/\[\[IMAGE:[^\]]+\]\]/g, '').trim();
            if (!(draft.type === '单选题' ? /^[A-Z]$/ : /^[A-Z]+$/).test(answer) || [...answer].some(label => !labels.includes(label)) || new Set(answer).size !== answer.length) return '答案标签与当前题型或选项不一致，请对照原 PDF；程序不会猜改题型。';
        }
        if (draft.images.length && draft.imageReviewStatus !== 'confirmed') return '请确认原 PDF 裁图与归属。';
        const math = mathProblems(draft, root.katex?.renderToString);
        if (math.length) return math[0].message;
        return '';
    }
    function editorSource(draft) {
        return draft.stem + (draft.options.length ? '\n\n' + draft.options.map((o, i) => `${draft.pdfExternal.optionLabels[i] || String.fromCharCode(65 + i)}. ${o}`).join('\n') : '');
    }
    // Only explicit teacher editor delimiters are mapped. No legacy math cleaning or exam inference.
    function projectEditorSource(source, draft) {
        if (source === (draft.editorSource || editorSource(draft))) return { stem: draft.stem, options: clone(draft.options), optionLabels: clone(draft.pdfExternal.optionLabels || []), type: draft.type, parsedOptions: draft.options.length > 0 };
        const markers = ['单选题', '多选题'].includes(draft.type) ? [...source.matchAll(/(?:^|\n)([A-Z])\.[ \t]/g)] : [];
        const stem = markers.length ? source.slice(0, markers[0].index).replace(/\n{1,2}$/, '') : source;
        const options = markers.map((marker, i) => source.slice(marker.index + marker[0].length, markers[i + 1]?.index ?? source.length));
        return { stem, options, optionLabels: markers.map(m => m[1]), type: draft.type, parsedOptions: markers.length > 0 };
    }
    function applyEditorSource(draft, source, reviewController) {
        const projection = projectEditorSource(source, draft);
        const labelsChanged = JSON.stringify(projection.optionLabels) !== JSON.stringify(draft.pdfExternal.optionLabels || []);
        let next = reviewController.editFields(draft, { stem: projection.stem, options: projection.options });
        if (labelsChanged) next = reviewController.markFieldsManual(next, ['options']);
        next.pdfExternal.optionLabels = projection.optionLabels;
        next.editorSource = source;
        return next;
    }
    function removeImage(draft, imageId, reviewController) {
        const copy = clone(draft), token = `[[IMAGE:${imageId}]]`;
        copy.stem = copy.stem.split(token).join('');
        copy.options = copy.options.map(o => o.split(token).join(''));
        copy.answer = copy.answer.split(token).join(''); copy.solution = copy.solution.split(token).join('');
        copy.images = copy.images.filter(i => i.id !== imageId);
        copy.editorSource = editorSource(copy);
        const changed = ['stem', 'options', 'answer', 'solution'].filter(f => JSON.stringify(copy[f]) !== JSON.stringify(draft[f]));
        const next = reviewController.markFieldsManual(copy, [...changed, 'images']);
        if (!next.images.length) { next.imageReviewStatus = 'none'; next.fieldProvenance.images = { kind: 'missing', status: 'missing' }; }
        // Empty optional fields stay missing, never pretend an empty manual value is evidence.
        for (const f of changed) if (!next[f].length) next.fieldProvenance[f] = { kind: 'missing', status: 'missing' };
        return next;
    }
    function applyManualCrop(draft, image, target, reviewController) {
        const copy = clone(draft), token = `[[IMAGE:${image.id}]]`;
        const field = target.startsWith('option:') ? 'options' : target;
        assert(['stem', 'options', 'answer', 'solution'].includes(field), 'review.crop.target');
        if (field === 'options') {
            const index = copy.pdfExternal.optionLabels.indexOf(target.slice(7));
            assert(index >= 0, 'review.crop.option'); copy.options[index] += '\n' + token;
        } else copy[field] += '\n' + token;
        copy.images.push({ ...image, position: target });
        copy.editorSource = editorSource(copy); copy.imageReviewStatus = 'need_confirm';
        return reviewController.markFieldsManual(copy, [field, 'images']);
    }
    const MATH_FIELD_LABEL = { stem: '题干', options: '选项', answer: '答案', solution: '解析' };
    // Everything that must reach the page as typeset math, not as typed text.
    // Only unambiguous patterns are listed: a bare LaTeX command, an unwrapped
    // superscript/subscript, a math glyph, a relation between math operands and
    // a named function applied to an operand. Ordinary prose ("第 2 题", "（1）",
    // "A. 3 万元") must never be reported, or the gate becomes unusable.
    const BARE_MATH_RULES = [
        { kind: '未包裹的 LaTeX 命令', pattern: /\\[a-zA-Z]+/ },
        { kind: '未包裹的上下标', pattern: /[A-Za-z0-9)\]}】]\s*[\^_]\s*\{?[A-Za-z0-9]/ },
        { kind: '未包裹的数学符号', pattern: /[√∠△□≤≥≠≈≌∽∈∉⊆⊂∪∩∅⊥∥∑∏∫∞παβγθλμσφωΔΣΠ]/ },
        { kind: '未包裹的关系式', pattern: /[A-Za-z][A-Za-z0-9]*\s*[=<>]\s*[-+]?[A-Za-z0-9(（]/ },
        { kind: '未包裹的函数名', pattern: /\b(?:sin|cos|tan|cot|sec|csc|log|ln|lg|lim|max|min)(?:\s+(?=[A-Za-z0-9(（∠√πθαβ])|(?=[A-Z0-9(（πθαβ]))/ }
    ];
    // Machine tokens ([[IMAGE:...]], [[figure:...]], [[asset:...]]) are placeholders,
    // never visible math, so they must not trigger the typed-math gate.
    const stripMathSegments = text => String(text ?? '')
        .replace(/\[\[[^\]\n]*\]\]/g, ' ')
        .replace(/\$\$[\s\S]*?\$\$/g, ' $$ ')
        .replace(/(^|[^\\])\$[^$\n]*?\$/g, '$1 $$ ');
    function bareMath(text) {
        const visible = stripMathSegments(text);
        for (const rule of BARE_MATH_RULES) {
            const match = visible.match(rule.pattern);
            if (match) return { token: match[0].trim(), kind: rule.kind };
        }
        return null;
    }
    function mathProblems(draft, renderMath) {
        const problems = [];
        for (const field of ['stem', 'options', 'answer', 'solution']) {
            const texts = Array.isArray(draft[field]) ? draft[field] : [draft[field]];
            for (const text of texts) {
                const bare = bareMath(text);
                if (bare) {
                    problems.push({ field, message: '公式必须写成 LaTeX：' + MATH_FIELD_LABEL[field] + '中有' + bare.kind + '“' + bare.token + '”，请对照原卷改为 $…$ 形式' });
                    break;
                }
                for (const match of String(text).matchAll(/\$\$([\s\S]*?)\$\$|(?<!\\)\$([^$\n]+)\$/g)) {
                    const math = match[1] ?? match[2];
                    try {
                        if (/\\\\[a-zA-Z]/.test(math)) throw new Error('公式反斜杠重复转义');
                        if (renderMath) renderMath(math, { throwOnError: true, strict: 'ignore' });
                    } catch (error) { problems.push({ field, message: '公式需要对照原卷修正：' + error.message }); break; }
                }
            }
        }
        return problems;
    }
    function chooseCandidate(draft, field, index, reviewController) {
        assert(isExternal(draft) && ['question', 'answer', 'solution'].includes(field), 'review.candidate');
        const variant = draft.pdfExternal.candidates[field][index];
        assert(variant && !variant.cropErrors?.length && !variant.item.figures.some(f => f.invalid), 'review.candidate.figure');
        const copy = clone(draft);
        const fields = field === 'question' ? ['questionNumber', 'stem', 'options'] : [field];
        const item = insertFigures(variant.item, variant.images || [], field);
        if (field === 'question') {
            copy.stem = item.stem; copy.options = item.options.map(o => o.text); copy.type = TYPES[item.type];
            copy.pdfExternal.optionLabels = item.options.map(o => o.label);
        } else copy[field] = item[field];
        const belongs = i => field === 'question' ? i.position === 'stem' || i.position.startsWith('option:') : i.position === field;
        copy.images = [...copy.images.filter(i => !belongs(i)), ...clone(variant.images || [])].map(i => ({ ...i, questionId: copy.id, batchId: copy.batchId }));
        copy.pdfExternal.states[field] = 'manual';
        copy.editorSource = editorSource(copy);
        copy.imageReviewStatus = copy.images.length ? 'need_confirm' : 'none';
        if (!copy.images.length) copy.fieldProvenance.images = { field: 'images', kind: 'missing', status: 'missing' };
        const next = reviewController.markFieldsManual(copy, [...fields, ...(copy.images.length ? ['images'] : [])]);
        for (const target of fields) Object.assign(next.fieldProvenance[target], {
            sourceId: variant.source.sourceId, sourceFormat: 'pdf', page: variant.item.source_pages[0]
        });
        for (const target of fields) if (Array.isArray(next[target]) ? !next[target].length : !String(next[target] || '').trim()) next.fieldProvenance[target] = { field: target, kind: 'missing', status: 'missing' };
        return next;
    }
    return Object.freeze({ PROTOCOL, TYPES, WIRE_VERSION, LEGACY_WIRE_VERSION, SCHEMA: schema, SCHEMA_V22: schemaV22, REVIEW_SCHEMA: reviewSchema, schemaErrors, getWireSchema, isExternal, validateRequest, validateWireResult, validateReviewResult, evaluateSequences, assemblePrompt, projectQwenStrictSchema, calculateUsageCost, reserveAttempt, settleAttempt, buildDrafts, validateCanonical, retainReviewDrafts, bboxValid, reviewPanel, reviewProblem, editorSource, projectEditorSource, applyEditorSource, chooseCandidate, removeImage, applyManualCrop, mathProblems, bareMath, acknowledgeTaskIssues });
});
