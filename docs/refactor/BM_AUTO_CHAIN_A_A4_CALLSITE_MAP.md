# BM-AUTO Chain A A4 Callsite Map

Stage: BM-AUTO-CHAIN-A-A4-CALLSITE-MAP
Branch: main

## Summary

Total callsites: 116.
Unknown callsites: 0.
High-risk callsites: 110.

## Callsites By Helper

| Helper | Count |
| --- | ---: |
| cleanDisplayTextForBatchSave | 46 |
| cleanDisplayOptionsForBatchSave | 43 |
| addWarningOnce | 23 |
| cleanDisplayFieldsOnly | 4 |

## Callsites By Classification

| Classification | Count |
| --- | ---: |
| BATCH_SAVE_PATH | 95 |
| DISPLAY_ONLY_PATH | 104 |
| OPTION_REPAIR_PATH | 91 |
| WARNING_MUTATION_PATH | 36 |
| DRAFT_WRITE_PATH | 40 |
| VISUAL_REPAIR_PATH | 22 |
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
| 1937 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DISPLAY_ONLY_PATH | const cleaned = cleanDisplayTextForBatchSave(raw); |
| 1952 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | q.stem = cleanDisplayTextForBatchSave(q.stem); |
| 1953 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | q.options = cleanDisplayOptionsForBatchSave(q.options); |
| 1954 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | q.answer = cleanDisplayTextForBatchSave(q.answer); |
| 1955 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | q.solution = cleanDisplayTextForBatchSave(q.solution); |
| 1966 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const text = cleanDisplayTextForBatchSave(value); |
| 1983 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return cleanDisplayOptionsForBatchSave(options).filter(optionTextHasContent).length; |
| 2024 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | return cleanDisplayTextForBatchSave(source); |
| 2173 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DISPLAY_ONLY_PATH | const next = cleanDisplayTextForBatchSave(candidate); |
| 2174 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DISPLAY_ONLY_PATH | const old = cleanDisplayTextForBatchSave(existing); |
| 2381 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const primary = cleanDisplayOptionsForBatchSave(primaryOptions \|\| []); |
| 2382 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const fallback = cleanDisplayOptionsForBatchSave(fallbackOptions \|\| []); |
| 2395 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayOptionsForBatchSave(options \|\| []).filter(Boolean).length; |
| 2398 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const aa = cleanDisplayOptionsForBatchSave(a \|\| []); |
| 2399 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const bb = cleanDisplayOptionsForBatchSave(b \|\| []); |
| 2431 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DISPLAY_ONLY_PATH | const itemSolution = cleanDisplayTextForBatchSave(item.solution \|\| ''); |
| 2432 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DISPLAY_ONLY_PATH | const fallbackSolution = cleanDisplayTextForBatchSave(fallback.solution \|\| ''); |
| 2782 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(source), |
| 2831 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options[optionIndex] = cleanDisplayTextForBatchSave(value); |
| 2842 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(source), |
| 2848 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | stem: cleanDisplayTextForBatchSave(stem \|\| source), |
| 2849 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | options: cleanDisplayOptionsForBatchSave(options) |
| 2912 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options[optionIndex] = cleanDisplayTextForBatchSave(value); |
| 2922 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(source.slice(0, ordered[0].start).trim()), |
| 2923 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 2938 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayTextForBatchSave(match[1]), |
| 2939 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayTextForBatchSave(match[2]), |
| 2940 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayTextForBatchSave(match[3]), |
| 2941 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayTextForBatchSave(match[4]) |
| 2947 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(source.slice(0, match.index).trim()), |
| 2948 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 2989 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options[idx] = cleanDisplayTextForBatchSave(hit.value); |
| 2996 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(stemLines.join('\n')), |
| 2997 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 3059 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(lines.slice(0, i).join('\n')), |
| 3060 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 3083 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(lines.slice(0, i).join('\n')), |
| 3084 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 3095 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(source), |
| 3148 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const visualOptions = cleanDisplayOptionsForBatchSave(visual?.options \|\| []); |
| 3256 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const options = cleanDisplayOptionsForBatchSave(parsed?.options \|\| []); |
| 3367 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | const existing = cleanDisplayOptionsForBatchSave(draft.options \|\| []); |
| 3442 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | draft.options = cleanDisplayOptionsForBatchSave(best.options); |
| 3467 | addWarningOnce | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | addWarningOnce(draft, `已从 Word 文本层本地拆出 ${best.optionCount}/4 个选项，请核对。`); |
| 3495 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: parsed.stem \|\| cleanDisplayTextForBatchSave(item.block), |
| 3565 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const aiOptions = cleanDisplayOptionsForBatchSave(ai.options); |
| 3566 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const localOptions = cleanDisplayOptionsForBatchSave(local.options); |
| 3598 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | next.stem = cleanDisplayTextForBatchSave(local.stem); |
| 3706 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const existing = cleanDisplayOptionsForBatchSave(q.options); |
| 3753 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const extracted = cleanDisplayOptionsForBatchSave(best.options); |
| 3761 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | q.stem = cleanDisplayTextForBatchSave(best.stem); |
| 3768 | addWarningOnce | OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce(q, `已从当前题原始证据中提取 ${extractedCount}/4 个选项，请核对。`); |
| 4949 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayTextForBatchSave(String(x \|\| '') |
| 4954 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | return cleanDisplayOptionsForBatchSave(options); |
| 5003 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const textOption = cleanDisplayTextForBatchSave( |
| 5064 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 5140 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 5304 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | solution: cleanDisplayTextForBatchSave(stripQuestionSectionNoise(block)), |
| 5371 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | solution: cleanDisplayTextForBatchSave(stripQuestionSectionNoise(solution)), |
| 5464 | cleanDisplayTextForBatchSave | PDF_PATH, BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayTextForBatchSave( |
| 6550 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | solution: cleanDisplayTextForBatchSave(rawSolution), |
| 6898 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const optionCount = cleanDisplayOptionsForBatchSave(q.options).filter(Boolean).length; |
| 7005 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const patchedOptions = cleanDisplayOptionsForBatchSave(patch.options \|\| patch.选项 \|\| []); |
| 7006 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const oldOptions = cleanDisplayOptionsForBatchSave(next.options \|\| []); |
| 7018 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const patchedSolution = cleanDisplayTextForBatchSave( |
| 7024 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | if (preferred !== cleanDisplayTextForBatchSave(next.solution)) { |
| 7244 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | solution: cleanDisplayTextForBatchSave(item.solution ?? item.analysis ?? item.解析 ?? item.详解 ?? item.explanation ?? ''), |
| 7371 | addWarningOnce | DRAFT_WRITE_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, '已识别到题中图形区域，但没有可用于裁剪的来源页面图。'); |
| 7473 | addWarningOnce | PDF_PATH, DRAFT_WRITE_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, '自动裁剪的题中图形需要人工确认。'); |
| 9965 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | const options = cleanDisplayOptionsForBatchSave(item.options \|\| []); |
| 13182 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const solution = cleanDisplayTextForBatchSave(solutionItems[idx].solution); |
| 13185 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, DISPLAY_ONLY_PATH | if (preferred !== cleanDisplayTextForBatchSave(draft.solution)) { |
| 13300 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const optionCount = cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length; |
| 13526 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return cleanDisplayOptionsForBatchSave(arr); |
| 13529 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return cleanDisplayOptionsForBatchSave(raw); |
| 13533 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return cleanDisplayOptionsForBatchSave([ |
| 13576 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const oldOptions = cleanDisplayOptionsForBatchSave(draft.options \|\| []); |
| 13588 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const patchedStem = cleanDisplayTextForBatchSave(patch.stem \|\| patch.题干 \|\| ''); |
| 13593 | addWarningOnce | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce(draft, `已通过最终视觉修复补回 ${patchedOptionCount}/4 个选项，请核对。`); |
| 13597 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const patchedAnswer = cleanDisplayTextForBatchSave(patch.answer \|\| patch.答案 \|\| ''); |
| 13599 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, DISPLAY_ONLY_PATH | const oldAnswer = cleanDisplayTextForBatchSave(draft.answer); |
| 13611 | addWarningOnce | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce(draft, '已通过最终视觉修复补回带公式答案，请核对。'); |
| 13616 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const patchedSolution = cleanDisplayTextForBatchSave( |
| 13623 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | if (preferred !== cleanDisplayTextForBatchSave(draft.solution)) { |
| 13625 | addWarningOnce | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce(draft, '已通过最终视觉修复补回带公式解析，请核对。'); |
| 13743 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length, |
| 13787 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const optionCount = cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length; |
| 13859 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length, |
| 13888 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length, |
| 14574 | cleanDisplayTextForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | let cleanSolution = cleanDisplayTextForBatchSave(solution?.solution \|\| ''); |
| 15425 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | const options = cleanDisplayOptionsForBatchSave(q.options \|\| []); |
| 15589 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return cleanDisplayOptionsForBatchSave(options \|\| []); |
| 16962 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(q.options \|\| []).filter(opt => String(opt \|\| '').trim()).length, |
| 17455 | addWarningOnce | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce( |
| 17549 | addWarningOnce | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce( |
| 18276 | addWarningOnce | PDF_PATH, WARNING_MUTATION_PATH | addWarningOnce( |
| 18929 | addWarningOnce | PDF_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce( |
| 18935 | addWarningOnce | PDF_PATH, DRAFT_WRITE_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce( |
| 18942 | addWarningOnce | DRAFT_WRITE_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce( |
| 18981 | addWarningOnce | PDF_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, warning); |
| 19000 | addWarningOnce | PDF_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, warning) |
| 19039 | addWarningOnce | DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | addWarningOnce(draft, DOCX_TEXT_ONLY_WARNING); |
| 19042 | cleanDisplayFieldsOnly | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | cleanDisplayFieldsOnly(draft); |
| 19241 | addWarningOnce | PDF_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, 'PDF 页面图渲染失败，请检查 renderPdfFilePages 是否返回空数组。'); |
| 19286 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(d.options).filter(Boolean).length, |
| 19304 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const options = cleanDisplayOptionsForBatchSave(d.options); |
| 19364 | cleanDisplayOptionsForBatchSave | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(d.options).filter(Boolean).length, |
| 19380 | addWarningOnce | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce( |
| 19390 | addWarningOnce | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, `${solutionIssue}，请人工核对。`); |
| 19605 | cleanDisplayFieldsOnly | DISPLAY_ONLY_PATH | cleanDisplayFieldsOnly(q); |
| 19661 | addWarningOnce | OPTION_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce( |
| 20032 | cleanDisplayFieldsOnly | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | cleanDisplayFieldsOnly(q); |
| 20050 | addWarningOnce | OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce( |
| 20061 | addWarningOnce | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce(q, `${solutionIssue}，请人工核对。`); |
| 20071 | addWarningOnce | VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce(q, '当前题目未绑定原图，若公式或图形缺失，请回到原文件人工核对。'); |
| 20358 | cleanDisplayFieldsOnly | OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayFieldsOnly(q); |

## Decision

Callsite map generated: yes.

