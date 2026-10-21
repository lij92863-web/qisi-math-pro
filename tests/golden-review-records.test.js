const test = require('node:test'), assert = require('node:assert/strict');
const { createBlankRecords, inspectRecords } = require('../scripts/golden/review-records.cjs');
const packet = Buffer.from(JSON.stringify({ schema: 'qisi.review-packet.v1', sourceSha256: 'a'.repeat(64),
    workspaceSha256: 'b'.repeat(64), questions: [{ number: '1' }, { number: '2' }] }));
const blank = () => createBlankRecords(packet);

test('blank review preserves pending status and cannot become certified gold', () => {
    const r = inspectRecords(packet, blank());
    assert.equal(r.ok, true); assert.equal(r.humanReviewRecorded, false);
    assert.equal(r.readyForIndependentVerification, false); assert.equal(r.goldPromotionAllowed, false);
    assert.equal(r.counts.assessedQuestions, 0); assert.equal(r.wrongAttachmentCount, null);
});

test('review for changed source, workspace or packet is rejected', () => {
    for (const field of ['packetSha256', 'sourceSha256', 'workspaceSha256']) {
        const r = blank(); r[field] = 'c'.repeat(64);
        assert.equal(inspectRecords(packet, r).ok, false);
    }
    assert.equal(inspectRecords(Buffer.concat([packet, Buffer.from(' ')]), blank()).ok, false);
});

test('missing, duplicated, numeric and unexpected question identities are rejected', () => {
    for (const change of [r => r.questions.pop(), r => r.questions[1] = r.questions[0],
        r => r.questions[0].number = 1, r => r.questions[0].number = '3']) {
        const r = blank(); change(r); assert.equal(inspectRecords(packet, r).ok, false);
    }
});

test('unknown fields and implicit confirmation cannot replace explicit assessments', () => {
    for (const change of [r => r.questions[0].assessment.answer = true,
        r => delete r.questions[0].assessment.source, r => r.questions[0].assessment.score = 0.99]) {
        const r = blank(); change(r); assert.equal(inspectRecords(packet, r).ok, false);
    }
});

test('source issues and corrections require notes without being counted as matching', () => {
    const r = blank(); r.questions[0].assessment.figures = 'source-issue';
    assert.equal(inspectRecords(packet, r).ok, false);
    r.questions[0].notes = 'Source diagram crosses the page boundary.';
    const checked = inspectRecords(packet, r);
    assert.equal(checked.ok, true); assert.equal(checked.counts.allFieldsMatchQuestions, 0);
    assert.equal(checked.readyForIndependentVerification, false);
});

test('reviewer record alone and fully checked boxes without transcription remain incomplete', () => {
    const r = blank(); r.reviewer = { name: 'Fixture human', type: 'human', reviewedAt: '2026-10-20T12:00:00+08:00', originalPdfChecked: true };
    for (const row of r.questions) for (const field of Object.keys(row.assessment)) row.assessment[field] = 'matches';
    let checked = inspectRecords(packet, r);
    assert.equal(checked.humanReviewRecorded, true); assert.equal(checked.readyForIndependentVerification, false);
    for (const row of r.questions) row.correctedExpected = { stemAndOptions: 'Independent stem', figureNotes: 'No figure', answer: 'A', solution: 'Independent solution' };
    checked = inspectRecords(packet, r);
    assert.equal(checked.readyForIndependentVerification, true);
    assert.equal(checked.goldPromotionAllowed, false); assert.equal(checked.wrongAttachmentCount, null);
});

test('agent identity, invalid time and non-boolean attestation cannot claim a human review', () => {
    for (const change of [r => r.reviewer.type = 'agent', r => r.reviewer.reviewedAt = 'yesterday',
        r => r.reviewer.originalPdfChecked = 'yes']) {
        const r = blank(); change(r); assert.equal(inspectRecords(packet, r).ok, false);
    }
});

test('malformed packets and absent records fail closed', () => {
    for (const packetObject of [{}, { schema: 'qisi.review-packet.v1', sourceSha256: 'a'.repeat(64), workspaceSha256: 'b'.repeat(64), questions: [{ number: '1' }, { number: '1' }] }]) {
        assert.throws(() => createBlankRecords(Buffer.from(JSON.stringify(packetObject))), /REVIEW_PACKET_/);
    }
    assert.equal(inspectRecords(packet, null).ok, false);
});
