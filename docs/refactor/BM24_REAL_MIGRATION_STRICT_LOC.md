# BM24 Real Migration with Strict LOC Reduction

## Stage

BM24 — second real migration, must achieve net app.js line reduction >= 10.

## Candidate Selection

| Field | Value |
| --- | --- |
| Selected helper group | `getBatchFileRoles` + 6 derived helpers |
| Original app.js line range | lines 353-377 |
| Reason selected | Pure functions, no side effects, tightly grouped |
| DOM access | No |
| db access | No |
| AI/OCR access | No |
| controlled-write access | No |

## Migrated Functions

| Function | Purpose | Lines saved |
| --- | --- | --- |
| `getBatchFileRoles` | Extract file roles from batch file object | 5 |
| `batchHasRole` | Check if file has specific role | 1 |
| `batchHasQuestionRole` | Check if file has question role | 4 |
| `batchHasAnswerRole` | Check if file has answer role | 4 |
| `batchHasSolutionRole` | Check if file has solution role | 4 |
| `batchIsFullRole` | Check full role | 1 |
| `batchIsSupplementalImage` | Check supplemental image role | 1 |

## Execution Verification

| Metric | Before | After | Delta |
| --- | --- | --- | --- |
| app.js lines | 23,217 | 23,198 | **-19** ✅ |
| Old definitions in app.js | 7 functions | 0 (all removed) | ✅ |
| Module references | 7 aliases to `window.Qisi.FileDispatcher.*` | ✅ |
| >=10 line reduction | Yes (-19) | ✅ |

## Migration Classification

**REAL_MIGRATION** ✅

All nine BM24 acceptance criteria met:
1. app.js 净减少 >= 10 行: ✅ -19
2. 至少 1 组旧 helper 删除: ✅ 7 functions
3. app.js 调用已有 module: ✅ FileDispatcher
4. 新模块承接旧逻辑: ✅ exact copies
5. 行为等价测试: ✅ 11 tests
6. 旧函数不再定义: ✅ verified
7. Route B 未接入: ✅
8. controlled-write 未修改: ✅
9. 安全测试通过: ✅

## Tests

6 originals + 5 new batch role tests = 11 total. All pass.
