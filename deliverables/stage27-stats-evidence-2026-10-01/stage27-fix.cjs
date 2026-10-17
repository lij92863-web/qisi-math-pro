const fs = require('node:fs'), path = require('node:path');
const root = 'C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统';
const name = path.join(root, 'qisi-draft-persistence-service.js');
const originalText = fs.readFileSync(name, 'utf8');
let text = originalText.replace(/\r\n/g, '\n');
const start = text.indexOf('    const refreshDraftBatchStats = async'), end = text.indexOf('    const validateAssociatedRows', start);
let region = text.slice(start, end);
region = region.replace("        } catch (error) {\n            rethrowOrWrap(error, 'DRAFT_PERSISTENCE_WRITE_FAILED');", "        } catch (error) {\n            assertActive(command.signal);\n            rethrowOrWrap(error, 'DRAFT_PERSISTENCE_WRITE_FAILED');");
if (region === text.slice(start, end)) throw new Error('Signal catch anchor');
fs.writeFileSync(name, (text.slice(0, start) + region + text.slice(end)).replace(/\n/g, originalText.includes('\r\n') ? '\r\n' : '\n'));
const testName = path.join(root, 'tests/draft-stats-transaction.test.js');
text = fs.readFileSync(testName, 'utf8');
const anchor = "            const afterFailure = await persistence.reloadDraftBatch('batch-1');";
if (text.split(anchor).length !== 2) throw new Error('Rollback anchor');
text = text.replace(anchor, `            const afterWriteAbort = new AbortController();
            const tablePrototype = Object.getPrototypeOf(fixtureDb.draftImportBatches);
            const originalUpdate = tablePrototype.update;
            tablePrototype.update = function (...args) {
                const name = this.name;
                return originalUpdate.apply(this, args).then(result => {
                    if (name === 'draftImportBatches') afterWriteAbort.abort();
                    return result;
                });
            };
            try {
                await makeMaintenance(() => []).refreshBatchStats({ batchId: 'batch-1', signal: afterWriteAbort.signal });
            } catch (error) { failures.push(error.code); }
            finally { tablePrototype.update = originalUpdate; }
${anchor}`);
text = text.replace("['DRAFT_PERSISTENCE_WRITE_FAILED', 'DRAFT_PERSISTENCE_CANCELLED']", "['DRAFT_PERSISTENCE_WRITE_FAILED', 'DRAFT_PERSISTENCE_CANCELLED', 'DRAFT_PERSISTENCE_CANCELLED']");
fs.writeFileSync(testName, text);
