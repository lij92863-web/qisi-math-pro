const fs = require('fs');
const path = require('path');
const { analyzeSources } = require('./bm-a4-staged-migration-verify');

const MAX_SHARD_SIZE = 10;
const DEFAULT_SHARD_SIZE = 5;

function readAnalysisSources({ afterSource, moduleSource, afterPath = 'app.js', modulePath = 'qisi-utils.js' } = {}) {
    const rootPath = path.resolve(__dirname, '..');
    return {
        after: typeof afterSource === 'string'
            ? afterSource
            : fs.readFileSync(path.resolve(rootPath, afterPath), 'utf8'),
        moduleSource: typeof moduleSource === 'string'
            ? moduleSource
            : fs.readFileSync(path.resolve(rootPath, modulePath), 'utf8')
    };
}

function getNakedCallsites(input = {}) {
    const sources = readAnalysisSources(input);
    const data = analyzeSources({ after: sources.after, moduleSource: sources.moduleSource });
    if (!data.ok || !data.naked) return [];
    const sites = [];
    for (const [helper, calls] of Object.entries(data.naked)) {
        for (const call of calls) {
            sites.push({ helper, line: call.line, text: call.text, explicit: false });
        }
    }
    return sites;
}

function readAppContext(line, radius = 3, input = {}) {
    const lines = readAnalysisSources(input).after.split('\n');
    const idx = line - 1;
    const start = Math.max(0, idx - radius);
    const end = Math.min(lines.length, idx + radius + 1);
    return {
        before: lines.slice(start, idx).map((l, i) => ({ line: start + i + 1, text: l })),
        line: { line, text: lines[idx] || '' },
        after: lines.slice(idx + 1, end).map((l, i) => ({ line: idx + i + 2, text: l }))
    };
}

function classifyRisk(site, contextText) {
    const combined = (contextText || site.text || '').toLowerCase();
    const riskMarkers = [];
    if (/controlledwrite|controlled-write|ownership|answerownership|supportownership|writeanswer|writesolution|commitanswer|finalanswer/i.test(combined))
        riskMarkers.push('CONTROLLED_WRITE_ADJACENT');
    if (/\bpdf\b|pdfsupport|pdf_/i.test(combined))
        riskMarkers.push('PDF_PATH');
    else if (/supportitem|supportitems|answeritems|solutionitems|aligner|blockparser/i.test(combined))
        riskMarkers.push('PDF_OWNERSHIP_RISK');
    if (/attach|attachment|image|media|evidence|sourceitem|item\.support/i.test(combined))
        riskMarkers.push('SUPPORT_ATTACHMENT_RISK');
    if (/answer|solution|解析|答案|answersource|solutionsource/i.test(combined))
        riskMarkers.push('ANSWER_SOLUTION_OWNERSHIP_RISK');
    if (/\bsave\b|\bdraft\b|\bbatch\b|persist|store|items|questions/i.test(combined))
        riskMarkers.push('SAVE_DRAFT_RISK');
    if (riskMarkers.length === 0) riskMarkers.push('DISPLAY_ONLY');
    return riskMarkers;
}

function computeInitialDecision(riskMarkers) {
    if (riskMarkers.includes('CONTROLLED_WRITE_ADJACENT')) return 'BLOCKED_CONTROLLED_WRITE';
    if (riskMarkers.includes('PDF_PATH') || riskMarkers.includes('PDF_OWNERSHIP_RISK')) return 'BLOCKED_PDF_OWNERSHIP';
    if (riskMarkers.includes('SUPPORT_ATTACHMENT_RISK')) return 'BLOCKED_SUPPORT_ATTACHMENT';
    if (riskMarkers.includes('ANSWER_SOLUTION_OWNERSHIP_RISK') && riskMarkers.includes('SAVE_DRAFT_RISK')) return 'BLOCKED_ANSWER_SOLUTION_OWNERSHIP';
    if (riskMarkers.length === 1 && riskMarkers[0] === 'DISPLAY_ONLY') return 'POSSIBLE_FIXTURE_CANDIDATE';
    return 'AUDIT_REQUIRED';
}

function shardOrderScore(site) {
    const markers = site.riskMarkers || [];
    if (markers.includes('CONTROLLED_WRITE_ADJACENT')) return 900;
    if (markers.includes('PDF_PATH') || markers.includes('PDF_OWNERSHIP_RISK')) return 800;
    if (markers.includes('SUPPORT_ATTACHMENT_RISK')) return 700;
    if (markers.includes('ANSWER_SOLUTION_OWNERSHIP_RISK')) return 600;
    if (site.helper === 'cleanDisplayTextForBatchSave' || site.helper === 'cleanDisplayOptionsForBatchSave') return 100;
    if (site.helper === 'addWarningOnce') return 200;
    if (site.helper === 'cleanDisplayFieldsOnly') return 300;
    return 500;
}

function planShards(sites, maxSize = MAX_SHARD_SIZE) {
    const sorted = [...sites].sort((a, b) => shardOrderScore(a) - shardOrderScore(b));
    const shards = [];
    for (let i = 0; i < sorted.length; i += maxSize) {
        const chunk = sorted.slice(i, i + maxSize);
        shards.push(chunk);
    }
    return shards.map((chunk, idx) => {
        const shardId = `R3-S${String(idx + 1).padStart(3, '0')}`;
        return {
            shardId,
            callsites: chunk.map((site, ci) => {
                const context = site.context || { before: [], line: { line: site.line, text: site.text }, after: [] };
                const contextText = [
                    ...context.before.map(b => b.text),
                    context.line.text,
                    ...context.after.map(a => a.text)
                ].join('\n');
                const riskMarkers = site.riskMarkers || classifyRisk(site, contextText);
                return {
                    callsiteId: `${shardId}-${String(ci + 1).padStart(2, '0')}`,
                    helper: site.helper,
                    line: site.line,
                    lineText: site.text,
                    contextBefore: context.before.map(b => b.text).join('\n'),
                    contextAfter: context.after.map(a => a.text).join('\n'),
                    classification: site.classification || [],
                    riskMarkers,
                    ownershipRisk: riskMarkers.some(m => m.includes('OWNERSHIP')),
                    controlledWriteAdjacent: riskMarkers.includes('CONTROLLED_WRITE_ADJACENT'),
                    pdfPath: riskMarkers.includes('PDF_PATH'),
                    batchSavePath: riskMarkers.includes('SAVE_DRAFT_RISK'),
                    draftWritePath: riskMarkers.includes('SAVE_DRAFT_RISK'),
                    supportAttachmentRisk: riskMarkers.includes('SUPPORT_ATTACHMENT_RISK'),
                    answerSolutionOwnershipRisk: riskMarkers.includes('ANSWER_SOLUTION_OWNERSHIP_RISK'),
                    initialDecision: site.initialDecision || computeInitialDecision(riskMarkers)
                };
            })
        };
    });
}

function generatePlan(options = false) {
    const json = typeof options === 'boolean' ? options : Boolean(options.json);
    const input = typeof options === 'object' && options ? options : {};
    const sources = readAnalysisSources(input);
    const sourceInput = { afterSource: sources.after, moduleSource: sources.moduleSource };
    const sites = getNakedCallsites(sourceInput);
    const enriched = sites.map(site => {
        const context = readAppContext(site.line, 3, sourceInput);
        const contextText = [
            ...context.before.map(b => b.text),
            context.line.text,
            ...context.after.map(a => a.text)
        ].join('\n');
        const riskMarkers = classifyRisk(site, contextText);
        return { ...site, context, riskMarkers, initialDecision: computeInitialDecision(riskMarkers) };
    });
    const shards = planShards(enriched, MAX_SHARD_SIZE);
    const summary = {
        ok: true,
        totalCallsites: sites.length,
        totalShards: shards.length,
        maxShardSize: MAX_SHARD_SIZE,
        shards: shards.map(s => ({
            shardId: s.shardId,
            count: s.callsites.length,
            blocked: s.callsites.filter(c => c.initialDecision.startsWith('BLOCKED')).length,
            audit: s.callsites.filter(c => c.initialDecision === 'AUDIT_REQUIRED').length,
            candidate: s.callsites.filter(c => c.initialDecision === 'POSSIBLE_FIXTURE_CANDIDATE').length,
            helpers: [...new Set(s.callsites.map(c => c.helper))]
        })),
        callsites: shards.flatMap(s => s.callsites)
    };
    return json ? JSON.stringify(summary, null, 2) : summary;
}

function markdownReport(plan) {
    const lines = [
        '# BM-AUTO A4 R3 Shard Plan',
        '',
        'Stage: BM-AUTO-A4-R3-SHARD-PLAN',
        `Branch: main`,
        '',
        '## Summary',
        '',
        `Total remaining callsites: ${plan.totalCallsites}.`,
        `Total shards: ${plan.totalShards}.`,
        `Max shard size: ${plan.maxShardSize}.`,
        '',
        '## Shards',
        '',
        '| Shard | Sites | Blocked | Audit | Candidate | Helpers |',
        '| --- | ---: | ---: | ---: | ---: | --- |'
    ];
    for (const s of plan.shards) {
        lines.push(`| ${s.shardId} | ${s.count} | ${s.blocked} | ${s.audit} | ${s.candidate} | ${s.helpers.join(', ')} |`);
    }
    lines.push('', '## Shard Details', '');
    for (const s of plan.shards) {
        lines.push(`### ${s.shardId}`, '');
        lines.push('| ID | Helper | Line | Risk | Decision |');
        lines.push('| --- | --- | ---: | --- | --- |');
        const shardCallsites = plan.callsites.filter(c => c.callsiteId.startsWith(s.shardId));
        for (const c of shardCallsites) {
            const riskStr = c.riskMarkers.slice(0, 2).join(', ') || 'none';
            lines.push(`| ${c.callsiteId} | ${c.helper} | ${c.line} | ${riskStr} | ${c.initialDecision} |`);
        }
        lines.push('');
    }
    lines.push('## Decision', '', 'Shard plan accepted. Proceed to ownership audit per shard.', '');
    return lines.join('\n');
}

function main(argv = process.argv.slice(2)) {
    const plan = generatePlan();
    const json = argv.includes('--json');
    const reportIndex = argv.indexOf('--write-report');
    if (reportIndex >= 0) fs.writeFileSync(argv[reportIndex + 1], markdownReport(plan));
    if (json) console.log(JSON.stringify(plan, null, 2));
    else if (reportIndex < 0) console.log(JSON.stringify(plan, null, 2));
    if (!plan.ok) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
    getNakedCallsites,
    classifyRisk,
    computeInitialDecision,
    planShards,
    generatePlan,
    markdownReport
};
