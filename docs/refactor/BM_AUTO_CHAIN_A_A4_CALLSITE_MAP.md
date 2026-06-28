# BM-AUTO Chain A A4 Callsite Map

Stage: BM-AUTO-CHAIN-A-A4-CALLSITE-MAP
Branch: main

## Summary

Total callsites: 115.
Unknown callsites: 0.
High-risk callsites: 109.

## Callsites By Helper

| Helper | Count |
| --- | ---: |
| cleanDisplayTextForBatchSave | 43 |
| cleanDisplayOptionsForBatchSave | 43 |
| addWarningOnce | 24 |
| cleanDisplayFieldsOnly | 5 |

## Callsites By Classification

| Classification | Count |
| --- | ---: |
| BATCH_SAVE_PATH | 94 |
| OPTION_REPAIR_PATH | 91 |
| VISUAL_REPAIR_PATH | 23 |
| DISPLAY_ONLY_PATH | 103 |
| WARNING_MUTATION_PATH | 38 |
| DRAFT_WRITE_PATH | 40 |
| DOCX_PATH | 10 |
| FINAL_VALIDATION_PATH | 11 |
| PDF_PATH | 8 |

## Replacement Batch Proposal

- R1: DISPLAY_ONLY_PATH callsites without PDF, draft write, batch save, mutation, or unknown markers.
- R2: OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH after fixture coverage.
- R3: BATCH_SAVE_PATH, DRAFT_WRITE_PATH, PDF_PATH only when explicitly fixture-covered.

## Callsites

| Line | Helper | Classification | Text |
| ---: | --- | --- | --- |
| 1925 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.cleanDisplayTextForBatchSave(text); |
| 1928 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options); |
| 1931 | cleanDisplayFieldsOnly | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.cleanDisplayFieldsOnly(q); |
| 1934 | addWarningOnce | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.addWarningOnce(q, message); |
| 1937 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const text = cleanDisplayTextForBatchSave(value); |
| 1954 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return cleanDisplayOptionsForBatchSave(options).filter(optionTextHasContent).length; |
| 1995 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | return cleanDisplayTextForBatchSave(source); |
| 2144 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DISPLAY_ONLY_PATH | const next = cleanDisplayTextForBatchSave(candidate); |
| 2145 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DISPLAY_ONLY_PATH | const old = cleanDisplayTextForBatchSave(existing); |
| 2352 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const primary = cleanDisplayOptionsForBatchSave(primaryOptions \|\| []); |
| 2353 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const fallback = cleanDisplayOptionsForBatchSave(fallbackOptions \|\| []); |
| 2366 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayOptionsForBatchSave(options \|\| []).filter(Boolean).length; |
| 2369 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const aa = cleanDisplayOptionsForBatchSave(a \|\| []); |
| 2370 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const bb = cleanDisplayOptionsForBatchSave(b \|\| []); |
| 2402 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DISPLAY_ONLY_PATH | const itemSolution = cleanDisplayTextForBatchSave(item.solution \|\| ''); |
| 2403 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DISPLAY_ONLY_PATH | const fallbackSolution = cleanDisplayTextForBatchSave(fallback.solution \|\| ''); |
| 2753 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(source), |
| 2802 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options[optionIndex] = cleanDisplayTextForBatchSave(value); |
| 2813 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(source), |
| 2819 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | stem: cleanDisplayTextForBatchSave(stem \|\| source), |
| 2820 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | options: cleanDisplayOptionsForBatchSave(options) |
| 2883 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options[optionIndex] = cleanDisplayTextForBatchSave(value); |
| 2893 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(source.slice(0, ordered[0].start).trim()), |
| 2894 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 2909 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayTextForBatchSave(match[1]), |
| 2910 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayTextForBatchSave(match[2]), |
| 2911 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayTextForBatchSave(match[3]), |
| 2912 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayTextForBatchSave(match[4]) |
| 2918 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(source.slice(0, match.index).trim()), |
| 2919 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 2960 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options[idx] = cleanDisplayTextForBatchSave(hit.value); |
| 2967 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(stemLines.join('\n')), |
| 2968 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 3030 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(lines.slice(0, i).join('\n')), |
| 3031 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 3054 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(lines.slice(0, i).join('\n')), |
| 3055 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 3066 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(source), |
| 3119 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const visualOptions = cleanDisplayOptionsForBatchSave(visual?.options \|\| []); |
| 3227 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const options = cleanDisplayOptionsForBatchSave(parsed?.options \|\| []); |
| 3338 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | const existing = cleanDisplayOptionsForBatchSave(draft.options \|\| []); |
| 3413 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | draft.options = cleanDisplayOptionsForBatchSave(best.options); |
| 3438 | addWarningOnce | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | addWarningOnce(draft, `已从 Word 文本层本地拆出 ${best.optionCount}/4 个选项，请核对。`); |
| 3466 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: parsed.stem \|\| cleanDisplayTextForBatchSave(item.block), |
| 3536 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const aiOptions = cleanDisplayOptionsForBatchSave(ai.options); |
| 3537 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const localOptions = cleanDisplayOptionsForBatchSave(local.options); |
| 3569 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | next.stem = cleanDisplayTextForBatchSave(local.stem); |
| 3677 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const existing = cleanDisplayOptionsForBatchSave(q.options); |
| 3724 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const extracted = cleanDisplayOptionsForBatchSave(best.options); |
| 3732 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | q.stem = cleanDisplayTextForBatchSave(best.stem); |
| 3739 | addWarningOnce | OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.addWarningOnce(q, `已从当前题原始证据中提取 ${extractedCount}/4 个选项，请核对。`); |
| 4920 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayTextForBatchSave(String(x \|\| '') |
| 4925 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | return cleanDisplayOptionsForBatchSave(options); |
| 4974 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const textOption = cleanDisplayTextForBatchSave( |
| 5035 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 5111 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 5275 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | solution: cleanDisplayTextForBatchSave(stripQuestionSectionNoise(block)), |
| 5342 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | solution: cleanDisplayTextForBatchSave(stripQuestionSectionNoise(solution)), |
| 5435 | cleanDisplayTextForBatchSave | PDF_PATH, BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayTextForBatchSave( |
| 6521 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | solution: cleanDisplayTextForBatchSave(rawSolution), |
| 6869 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const optionCount = cleanDisplayOptionsForBatchSave(q.options).filter(Boolean).length; |
| 6976 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const patchedOptions = cleanDisplayOptionsForBatchSave(patch.options \|\| patch.选项 \|\| []); |
| 6977 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const oldOptions = cleanDisplayOptionsForBatchSave(next.options \|\| []); |
| 6989 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const patchedSolution = cleanDisplayTextForBatchSave( |
| 6995 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | if (preferred !== cleanDisplayTextForBatchSave(next.solution)) { |
| 7215 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | solution: cleanDisplayTextForBatchSave(item.solution ?? item.analysis ?? item.解析 ?? item.详解 ?? item.explanation ?? ''), |
| 7342 | addWarningOnce | DRAFT_WRITE_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, '已识别到题中图形区域，但没有可用于裁剪的来源页面图。'); |
| 7444 | addWarningOnce | PDF_PATH, DRAFT_WRITE_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, '自动裁剪的题中图形需要人工确认。'); |
| 9936 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | const options = cleanDisplayOptionsForBatchSave(item.options \|\| []); |
| 13153 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const solution = cleanDisplayTextForBatchSave(solutionItems[idx].solution); |
| 13156 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, DISPLAY_ONLY_PATH | if (preferred !== cleanDisplayTextForBatchSave(draft.solution)) { |
| 13271 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const optionCount = cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length; |
| 13497 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return cleanDisplayOptionsForBatchSave(arr); |
| 13500 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return cleanDisplayOptionsForBatchSave(raw); |
| 13504 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return cleanDisplayOptionsForBatchSave([ |
| 13547 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const oldOptions = cleanDisplayOptionsForBatchSave(draft.options \|\| []); |
| 13559 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const patchedStem = cleanDisplayTextForBatchSave(patch.stem \|\| patch.题干 \|\| ''); |
| 13564 | addWarningOnce | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce(draft, `已通过最终视觉修复补回 ${patchedOptionCount}/4 个选项，请核对。`); |
| 13568 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const patchedAnswer = cleanDisplayTextForBatchSave(patch.answer \|\| patch.答案 \|\| ''); |
| 13570 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, DISPLAY_ONLY_PATH | const oldAnswer = cleanDisplayTextForBatchSave(draft.answer); |
| 13582 | addWarningOnce | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce(draft, '已通过最终视觉修复补回带公式答案，请核对。'); |
| 13587 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const patchedSolution = cleanDisplayTextForBatchSave( |
| 13594 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | if (preferred !== cleanDisplayTextForBatchSave(draft.solution)) { |
| 13596 | addWarningOnce | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce(draft, '已通过最终视觉修复补回带公式解析，请核对。'); |
| 13714 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length, |
| 13758 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const optionCount = cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length; |
| 13830 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length, |
| 13859 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length, |
| 14545 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | let cleanSolution = cleanDisplayTextForBatchSave(solution?.solution \|\| ''); |
| 15396 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | const options = cleanDisplayOptionsForBatchSave(q.options \|\| []); |
| 15560 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return cleanDisplayOptionsForBatchSave(options \|\| []); |
| 16933 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(q.options \|\| []).filter(opt => String(opt \|\| '').trim()).length, |
| 17426 | addWarningOnce | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce( |
| 17520 | addWarningOnce | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce( |
| 18247 | addWarningOnce | PDF_PATH, WARNING_MUTATION_PATH | addWarningOnce( |
| 18900 | addWarningOnce | PDF_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce( |
| 18906 | addWarningOnce | PDF_PATH, DRAFT_WRITE_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce( |
| 18913 | addWarningOnce | DRAFT_WRITE_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce( |
| 18952 | addWarningOnce | PDF_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, warning); |
| 18971 | addWarningOnce | PDF_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, warning) |
| 19010 | addWarningOnce | DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | addWarningOnce(draft, DOCX_TEXT_ONLY_WARNING); |
| 19013 | cleanDisplayFieldsOnly | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | cleanDisplayFieldsOnly(draft); |
| 19212 | addWarningOnce | PDF_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, 'PDF 页面图渲染失败，请检查 renderPdfFilePages 是否返回空数组。'); |
| 19257 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(d.options).filter(Boolean).length, |
| 19275 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const options = cleanDisplayOptionsForBatchSave(d.options); |
| 19335 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(d.options).filter(Boolean).length, |
| 19351 | addWarningOnce | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce( |
| 19361 | addWarningOnce | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, `${solutionIssue}，请人工核对。`); |
| 19576 | cleanDisplayFieldsOnly | DISPLAY_ONLY_PATH | window.Qisi.Utils.cleanDisplayFieldsOnly(q); |
| 19632 | addWarningOnce | OPTION_REPAIR_PATH, WARNING_MUTATION_PATH | window.Qisi.Utils.addWarningOnce( |
| 20003 | cleanDisplayFieldsOnly | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | cleanDisplayFieldsOnly(q); |
| 20021 | addWarningOnce | OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.addWarningOnce( |
| 20032 | addWarningOnce | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce(q, `${solutionIssue}，请人工核对。`); |
| 20042 | addWarningOnce | VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH | window.Qisi.Utils.addWarningOnce(q, '当前题目未绑定原图，若公式或图形缺失，请回到原文件人工核对。'); |
| 20329 | cleanDisplayFieldsOnly | OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.cleanDisplayFieldsOnly(q); |

## Decision

Callsite map generated: yes.

