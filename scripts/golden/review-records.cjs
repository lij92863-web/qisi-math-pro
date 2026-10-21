'use strict';

// Validates a separate review record; never edits labels, imports or databases.
const crypto = require('node:crypto');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fields = ['questionIdentity', 'stemAndOptions', 'figures', 'answer', 'solution', 'source'];
const states = ['pending', 'matches', 'correction-needed', 'source-issue'];
const text = value => typeof value === 'string' && value.trim().length > 0;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const canonicalNumber = value => typeof value === 'string' && /^[1-9]\d{0,2}$/.test(value);
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));

function validatePacket(packet) {
    if (packet?.schema !== 'qisi.review-packet.v1' || !digest(packet.sourceSha256) || !digest(packet.workspaceSha256) ||
        !Array.isArray(packet.questions) || !packet.questions.length) throw new Error('REVIEW_PACKET_INVALID');
    const numbers = packet.questions.map(row => row.number);
    if (numbers.some(no => !canonicalNumber(no)) || new Set(numbers).size !== numbers.length) throw new Error('REVIEW_PACKET_NUMBERS_INVALID');
}

function createBlankRecords(packetBytes) {
    const packet = JSON.parse(packetBytes.toString()); validatePacket(packet);
    return {
        schema: 'qisi.independent-review-records.v1', packetSha256: sha256(packetBytes),
        sourceSha256: packet.sourceSha256, workspaceSha256: packet.workspaceSha256,
        reviewer: { name: '', type: 'human', reviewedAt: '', originalPdfChecked: false },
        questions: packet.questions.map(row => ({ number: row.number,
            assessment: Object.fromEntries(fields.map(field => [field, 'pending'])),
            correctedExpected: { stemAndOptions: '', figureNotes: '', answer: '', solution: '' }, notes: '' }))
    };
}

function inspectRecords(packetBytes, records) {
    const packet = JSON.parse(packetBytes.toString()); validatePacket(packet);
    const errors = [];
    if (records?.schema !== 'qisi.independent-review-records.v1') errors.push('record-schema-invalid');
    if (records?.packetSha256 !== sha256(packetBytes) || records?.sourceSha256 !== packet.sourceSha256 ||
        records?.workspaceSha256 !== packet.workspaceSha256) errors.push('source-or-packet-mismatch');
    const reviewer = records?.reviewer;
    if (!reviewer || reviewer.type !== 'human' || typeof reviewer.name !== 'string' || typeof reviewer.reviewedAt !== 'string' ||
        typeof reviewer.originalPdfChecked !== 'boolean' || (reviewer.reviewedAt !== '' && !timestamp(reviewer.reviewedAt))) errors.push('reviewer-invalid');
    const humanReviewRecorded = Boolean(reviewer?.type === 'human' && text(reviewer.name) && timestamp(reviewer.reviewedAt) && reviewer.originalPdfChecked === true);
    const expectedNumbers = new Set(packet.questions.map(row => row.number));
    const rows = Array.isArray(records?.questions) ? records.questions : [];
    if (!Array.isArray(records?.questions)) errors.push('questions-invalid');
    const observedNumbers = rows.map(row => row?.number);
    if (rows.length !== expectedNumbers.size || observedNumbers.some(no => !expectedNumbers.has(no)) ||
        new Set(observedNumbers).size !== rows.length) errors.push('question-set-mismatch');
    let assessed = 0, allMatch = 0, expectedTranscribed = 0;
    for (const row of rows) {
        if (!row || !fields.every(field => states.includes(row.assessment?.[field])) ||
            Object.keys(row.assessment || {}).some(field => !fields.includes(field))) {
            errors.push('assessment-invalid:' + row?.number); continue;
        }
        if (typeof row.notes !== 'string' || !row.correctedExpected ||
            !['stemAndOptions', 'figureNotes', 'answer', 'solution'].every(field => typeof row.correctedExpected[field] === 'string')) {
            errors.push('expected-or-notes-invalid:' + row.number); continue;
        }
        const values = fields.map(field => row.assessment[field]);
        if (values.some(value => ['correction-needed', 'source-issue'].includes(value)) && !text(row.notes)) errors.push('issue-note-required:' + row.number);
        if (values.every(value => value !== 'pending')) assessed++;
        if (values.every(value => value === 'matches')) allMatch++;
        if (Object.values(row.correctedExpected).every(text)) expectedTranscribed++;
    }
    return {
        schema: 'qisi.review-record-check.v1', ok: errors.length === 0, errors,
        packetSha256: sha256(packetBytes), sourceSha256: packet.sourceSha256,
        counts: { expectedQuestions: expectedNumbers.size, receivedQuestions: rows.length, assessedQuestions: assessed,
            allFieldsMatchQuestions: allMatch, expectedTranscribedQuestions: expectedTranscribed },
        humanReviewRecorded: errors.length === 0 && humanReviewRecorded,
        readyForIndependentVerification: errors.length === 0 && humanReviewRecorded && assessed === expectedNumbers.size && expectedTranscribed === expectedNumbers.size,
        goldPromotionAllowed: false, wrongAttachmentCount: null,
        limits: 'Checks record structure and exact source identity only. Reviewer identity, transcription and mathematical correctness are not authenticated. No labels are promoted and no automatic bindings are changed.'
    };
}

if (require.main === module) {
    const fs = require('node:fs'), path = require('node:path');
    try {
        const args = process.argv.slice(2), options = {};
        for (let i = 0; i < args.length; i += 2) {
            const key = { '--packet': 'packet', '--records': 'records', '--out': 'out' }[args[i]];
            if (!key || !args[i + 1] || options[key]) throw new Error('Use --packet, --records and optional --out once each.');
            options[key] = path.resolve(args[i + 1]);
        }
        if (!options.packet || !options.records) throw new Error('Packet and records required.');
        const result = inspectRecords(fs.readFileSync(options.packet), JSON.parse(fs.readFileSync(options.records)));
        const output = JSON.stringify(result, null, 2) + '\n';
        if (options.out) fs.writeFileSync(options.out, output, { flag: 'wx' });
        process.stdout.write(output); process.exitCode = result.ok ? 0 : 1;
    } catch (error) { process.stderr.write(String(error.message) + '\n'); process.exitCode = 1; }
}
module.exports = { createBlankRecords, inspectRecords, validatePacket, fields, states };
