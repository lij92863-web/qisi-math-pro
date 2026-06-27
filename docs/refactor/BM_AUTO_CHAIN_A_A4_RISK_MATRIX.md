# BM-AUTO Chain A A4 Risk Matrix

Stage: BM-AUTO-CHAIN-A-A4-RISK-MATRIX
Branch: main

## Summary

A4 direct migration allowed: no.
A4 wrapper-first allowed: yes.
A4 fixture-first required: yes.

## Counts

| Risk | Count |
| --- | ---: |
| LOW | 1 |
| MEDIUM | 5 |
| HIGH | 110 |
| BLOCK | 0 |

## Callsites

| Line | Helper | Risk | Classification | Text |
| ---: | --- | --- | --- | --- |
| 1937 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DISPLAY_ONLY_PATH | const cleaned = cleanDisplayTextForBatchSave(raw); |
| 1952 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | q.stem = cleanDisplayTextForBatchSave(q.stem); |
| 1953 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | q.options = cleanDisplayOptionsForBatchSave(q.options); |
| 1954 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | q.answer = cleanDisplayTextForBatchSave(q.answer); |
| 1955 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | q.solution = cleanDisplayTextForBatchSave(q.solution); |
| 1966 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const text = cleanDisplayTextForBatchSave(value); |
| 1983 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return cleanDisplayOptionsForBatchSave(options).filter(optionTextHasContent).length; |
| 2024 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | return cleanDisplayTextForBatchSave(source); |
| 2173 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DISPLAY_ONLY_PATH | const next = cleanDisplayTextForBatchSave(candidate); |
| 2174 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DISPLAY_ONLY_PATH | const old = cleanDisplayTextForBatchSave(existing); |
| 2381 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const primary = cleanDisplayOptionsForBatchSave(primaryOptions \|\| []); |
| 2382 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const fallback = cleanDisplayOptionsForBatchSave(fallbackOptions \|\| []); |
| 2395 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayOptionsForBatchSave(options \|\| []).filter(Boolean).length; |
| 2398 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const aa = cleanDisplayOptionsForBatchSave(a \|\| []); |
| 2399 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const bb = cleanDisplayOptionsForBatchSave(b \|\| []); |
| 2431 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DISPLAY_ONLY_PATH | const itemSolution = cleanDisplayTextForBatchSave(item.solution \|\| ''); |
| 2432 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DISPLAY_ONLY_PATH | const fallbackSolution = cleanDisplayTextForBatchSave(fallback.solution \|\| ''); |
| 2782 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(source), |
| 2831 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options[optionIndex] = cleanDisplayTextForBatchSave(value); |
| 2842 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(source), |
| 2848 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | stem: cleanDisplayTextForBatchSave(stem \|\| source), |
| 2849 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | options: cleanDisplayOptionsForBatchSave(options) |
| 2912 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options[optionIndex] = cleanDisplayTextForBatchSave(value); |
| 2922 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(source.slice(0, ordered[0].start).trim()), |
| 2923 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 2938 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayTextForBatchSave(match[1]), |
| 2939 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayTextForBatchSave(match[2]), |
| 2940 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayTextForBatchSave(match[3]), |
| 2941 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayTextForBatchSave(match[4]) |
| 2947 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(source.slice(0, match.index).trim()), |
| 2948 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 2989 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options[idx] = cleanDisplayTextForBatchSave(hit.value); |
| 2996 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(stemLines.join('\n')), |
| 2997 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 3059 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(lines.slice(0, i).join('\n')), |
| 3060 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 3083 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(lines.slice(0, i).join('\n')), |
| 3084 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 3095 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: cleanDisplayTextForBatchSave(source), |
| 3148 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const visualOptions = cleanDisplayOptionsForBatchSave(visual?.options \|\| []); |
| 3256 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const options = cleanDisplayOptionsForBatchSave(parsed?.options \|\| []); |
| 3367 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | const existing = cleanDisplayOptionsForBatchSave(draft.options \|\| []); |
| 3442 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | draft.options = cleanDisplayOptionsForBatchSave(best.options); |
| 3467 | addWarningOnce | HIGH | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | addWarningOnce(draft, `已从 Word 文本层本地拆出 ${best.optionCount}/4 个选项，请核对。`); |
| 3495 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: parsed.stem \|\| cleanDisplayTextForBatchSave(item.block), |
| 3565 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const aiOptions = cleanDisplayOptionsForBatchSave(ai.options); |
| 3566 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const localOptions = cleanDisplayOptionsForBatchSave(local.options); |
| 3598 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | next.stem = cleanDisplayTextForBatchSave(local.stem); |
| 3706 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const existing = cleanDisplayOptionsForBatchSave(q.options); |
| 3753 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const extracted = cleanDisplayOptionsForBatchSave(best.options); |
| 3761 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | q.stem = cleanDisplayTextForBatchSave(best.stem); |
| 3768 | addWarningOnce | MEDIUM | OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce(q, `已从当前题原始证据中提取 ${extractedCount}/4 个选项，请核对。`); |
| 4949 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayTextForBatchSave(String(x \|\| '') |
| 4954 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | return cleanDisplayOptionsForBatchSave(options); |
| 5003 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const textOption = cleanDisplayTextForBatchSave( |
| 5064 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 5140 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | options: cleanDisplayOptionsForBatchSave(options), |
| 5304 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | solution: cleanDisplayTextForBatchSave(stripQuestionSectionNoise(block)), |
| 5371 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | solution: cleanDisplayTextForBatchSave(stripQuestionSectionNoise(solution)), |
| 5464 | cleanDisplayTextForBatchSave | HIGH | PDF_PATH, BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayTextForBatchSave( |
| 6550 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | solution: cleanDisplayTextForBatchSave(rawSolution), |
| 6898 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const optionCount = cleanDisplayOptionsForBatchSave(q.options).filter(Boolean).length; |
| 7005 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const patchedOptions = cleanDisplayOptionsForBatchSave(patch.options \|\| patch.选项 \|\| []); |
| 7006 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const oldOptions = cleanDisplayOptionsForBatchSave(next.options \|\| []); |
| 7018 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const patchedSolution = cleanDisplayTextForBatchSave( |
| 7024 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | if (preferred !== cleanDisplayTextForBatchSave(next.solution)) { |
| 7244 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | solution: cleanDisplayTextForBatchSave(item.solution ?? item.analysis ?? item.解析 ?? item.详解 ?? item.explanation ?? ''), |
| 7371 | addWarningOnce | HIGH | DRAFT_WRITE_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, '已识别到题中图形区域，但没有可用于裁剪的来源页面图。'); |
| 7473 | addWarningOnce | HIGH | PDF_PATH, DRAFT_WRITE_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, '自动裁剪的题中图形需要人工确认。'); |
| 9965 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | const options = cleanDisplayOptionsForBatchSave(item.options \|\| []); |
| 13182 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const solution = cleanDisplayTextForBatchSave(solutionItems[idx].solution); |
| 13185 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, DISPLAY_ONLY_PATH | if (preferred !== cleanDisplayTextForBatchSave(draft.solution)) { |
| 13300 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const optionCount = cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length; |
| 13526 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return cleanDisplayOptionsForBatchSave(arr); |
| 13529 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return cleanDisplayOptionsForBatchSave(raw); |
| 13533 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return cleanDisplayOptionsForBatchSave([ |
| 13576 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const oldOptions = cleanDisplayOptionsForBatchSave(draft.options \|\| []); |
| 13588 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const patchedStem = cleanDisplayTextForBatchSave(patch.stem \|\| patch.题干 \|\| ''); |
| 13593 | addWarningOnce | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce(draft, `已通过最终视觉修复补回 ${patchedOptionCount}/4 个选项，请核对。`); |
| 13597 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const patchedAnswer = cleanDisplayTextForBatchSave(patch.answer \|\| patch.答案 \|\| ''); |
| 13599 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, DISPLAY_ONLY_PATH | const oldAnswer = cleanDisplayTextForBatchSave(draft.answer); |
| 13611 | addWarningOnce | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce(draft, '已通过最终视觉修复补回带公式答案，请核对。'); |
| 13616 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const patchedSolution = cleanDisplayTextForBatchSave( |
| 13623 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | if (preferred !== cleanDisplayTextForBatchSave(draft.solution)) { |
| 13625 | addWarningOnce | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce(draft, '已通过最终视觉修复补回带公式解析，请核对。'); |
| 13743 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length, |
| 13787 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const optionCount = cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length; |
| 13859 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length, |
| 13888 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length, |
| 14574 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | let cleanSolution = cleanDisplayTextForBatchSave(solution?.solution \|\| ''); |
| 15425 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | const options = cleanDisplayOptionsForBatchSave(q.options \|\| []); |
| 15589 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return cleanDisplayOptionsForBatchSave(options \|\| []); |
| 16962 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(q.options \|\| []).filter(opt => String(opt \|\| '').trim()).length, |
| 17455 | addWarningOnce | HIGH | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce( |
| 17549 | addWarningOnce | HIGH | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce( |
| 18276 | addWarningOnce | HIGH | PDF_PATH, WARNING_MUTATION_PATH | addWarningOnce( |
| 18929 | addWarningOnce | HIGH | PDF_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce( |
| 18935 | addWarningOnce | HIGH | PDF_PATH, DRAFT_WRITE_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce( |
| 18942 | addWarningOnce | HIGH | DRAFT_WRITE_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce( |
| 18981 | addWarningOnce | HIGH | PDF_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, warning); |
| 19000 | addWarningOnce | HIGH | PDF_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, warning) |
| 19039 | addWarningOnce | HIGH | DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | addWarningOnce(draft, DOCX_TEXT_ONLY_WARNING); |
| 19042 | cleanDisplayFieldsOnly | HIGH | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | cleanDisplayFieldsOnly(draft); |
| 19241 | addWarningOnce | HIGH | PDF_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, 'PDF 页面图渲染失败，请检查 renderPdfFilePages 是否返回空数组。'); |
| 19286 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(d.options).filter(Boolean).length, |
| 19304 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const options = cleanDisplayOptionsForBatchSave(d.options); |
| 19364 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(d.options).filter(Boolean).length, |
| 19380 | addWarningOnce | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce( |
| 19390 | addWarningOnce | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, `${solutionIssue}，请人工核对。`); |
| 19605 | cleanDisplayFieldsOnly | LOW | DISPLAY_ONLY_PATH | cleanDisplayFieldsOnly(q); |
| 19661 | addWarningOnce | MEDIUM | OPTION_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce( |
| 20032 | cleanDisplayFieldsOnly | HIGH | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | cleanDisplayFieldsOnly(q); |
| 20050 | addWarningOnce | MEDIUM | OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce( |
| 20061 | addWarningOnce | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce(q, `${solutionIssue}，请人工核对。`); |
| 20071 | addWarningOnce | MEDIUM | VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce(q, '当前题目未绑定原图，若公式或图形缺失，请回到原文件人工核对。'); |
| 20358 | cleanDisplayFieldsOnly | MEDIUM | OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | cleanDisplayFieldsOnly(q); |

## Decision

Wrapper-first gate may proceed: yes.

