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
| HIGH | 109 |
| BLOCK | 0 |

## Callsites

| Line | Helper | Risk | Classification | Text |
| ---: | --- | --- | --- | --- |
| 1925 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.cleanDisplayTextForBatchSave(text); |
| 1928 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options); |
| 1931 | cleanDisplayFieldsOnly | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.cleanDisplayFieldsOnly(q); |
| 1934 | addWarningOnce | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.addWarningOnce(q, message); |
| 1937 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const text = window.Qisi.Utils.cleanDisplayTextForBatchSave(value); |
| 1954 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options).filter(optionTextHasContent).length; |
| 1995 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | return window.Qisi.Utils.cleanDisplayTextForBatchSave(source); |
| 2144 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DISPLAY_ONLY_PATH | const next = window.Qisi.Utils.cleanDisplayTextForBatchSave(candidate); |
| 2145 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DISPLAY_ONLY_PATH | const old = window.Qisi.Utils.cleanDisplayTextForBatchSave(existing); |
| 2352 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const primary = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(primaryOptions \|\| []); |
| 2353 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const fallback = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(fallbackOptions \|\| []); |
| 2366 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options \|\| []).filter(Boolean).length; |
| 2369 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const aa = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(a \|\| []); |
| 2370 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const bb = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(b \|\| []); |
| 2402 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DISPLAY_ONLY_PATH | const itemSolution = cleanDisplayTextForBatchSave(item.solution \|\| ''); |
| 2403 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DISPLAY_ONLY_PATH | const fallbackSolution = cleanDisplayTextForBatchSave(fallback.solution \|\| ''); |
| 2753 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: window.Qisi.Utils.cleanDisplayTextForBatchSave(source), |
| 2802 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options[optionIndex] = window.Qisi.Utils.cleanDisplayTextForBatchSave(value); |
| 2813 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: window.Qisi.Utils.cleanDisplayTextForBatchSave(source), |
| 2819 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | stem: window.Qisi.Utils.cleanDisplayTextForBatchSave(stem \|\| source), |
| 2820 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | options: window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options) |
| 2883 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options[optionIndex] = window.Qisi.Utils.cleanDisplayTextForBatchSave(value); |
| 2893 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: window.Qisi.Utils.cleanDisplayTextForBatchSave(source.slice(0, ordered[0].start).trim()), |
| 2894 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options), |
| 2909 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.cleanDisplayTextForBatchSave(match[1]), |
| 2910 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.cleanDisplayTextForBatchSave(match[2]), |
| 2911 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.cleanDisplayTextForBatchSave(match[3]), |
| 2912 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.cleanDisplayTextForBatchSave(match[4]) |
| 2918 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: window.Qisi.Utils.cleanDisplayTextForBatchSave(source.slice(0, match.index).trim()), |
| 2919 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options), |
| 2960 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options[idx] = window.Qisi.Utils.cleanDisplayTextForBatchSave(hit.value); |
| 2967 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: window.Qisi.Utils.cleanDisplayTextForBatchSave(stemLines.join('backslash-n')), |
| 2968 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options), |
| 3030 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: window.Qisi.Utils.cleanDisplayTextForBatchSave(lines.slice(0, i).join('backslash-n')), |
| 3031 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options), |
| 3054 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: window.Qisi.Utils.cleanDisplayTextForBatchSave(lines.slice(0, i).join('backslash-n')), |
| 3055 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | options: window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options), |
| 3066 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: window.Qisi.Utils.cleanDisplayTextForBatchSave(source), |
| 3119 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const visualOptions = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(visual?.options \|\| []); |
| 3227 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const options = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(parsed?.options \|\| []); |
| 3338 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | const existing = cleanDisplayOptionsForBatchSave(draft.options \|\| []); |
| 3413 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | draft.options = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(best.options); |
| 3438 | addWarningOnce | HIGH | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | window.Qisi.Utils.addWarningOnce(draft, `已从 Word 文本层本地拆出 ${best.optionCount}/4 个选项，请核对。`); |
| 3466 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | stem: parsed.stem \|\| window.Qisi.Utils.cleanDisplayTextForBatchSave(item.block), |
| 3536 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const aiOptions = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(ai.options); |
| 3537 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const localOptions = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(local.options); |
| 3569 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | next.stem = window.Qisi.Utils.cleanDisplayTextForBatchSave(local.stem); |
| 3677 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const existing = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(q.options); |
| 3724 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const extracted = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(best.options); |
| 3732 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | q.stem = cleanDisplayTextForBatchSave(best.stem); |
| 3739 | addWarningOnce | MEDIUM | OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.addWarningOnce(q, `已从当前题原始证据中提取 ${extractedCount}/4 个选项，请核对。`); |
| 4920 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.cleanDisplayTextForBatchSave(String(x \|\| '') |
| 4925 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | return window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options); |
| 4974 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const textOption = window.Qisi.Utils.cleanDisplayTextForBatchSave( |
| 5035 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | options: window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options), |
| 5111 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | options: window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options), |
| 5275 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | solution: window.Qisi.Utils.cleanDisplayTextForBatchSave(stripQuestionSectionNoise(block)), |
| 5342 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | solution: window.Qisi.Utils.cleanDisplayTextForBatchSave(stripQuestionSectionNoise(solution)), |
| 5435 | cleanDisplayTextForBatchSave | HIGH | PDF_PATH, BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.cleanDisplayTextForBatchSave( |
| 6521 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | solution: window.Qisi.Utils.cleanDisplayTextForBatchSave(rawSolution), |
| 6869 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const optionCount = cleanDisplayOptionsForBatchSave(q.options).filter(Boolean).length; |
| 6976 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const patchedOptions = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(patch.options \|\| patch.选项 \|\| []); |
| 6977 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const oldOptions = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(next.options \|\| []); |
| 6989 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const patchedSolution = cleanDisplayTextForBatchSave( |
| 6995 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | if (preferred !== cleanDisplayTextForBatchSave(next.solution)) { |
| 7215 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | solution: cleanDisplayTextForBatchSave(item.solution ?? item.analysis ?? item.解析 ?? item.详解 ?? item.explanation ?? ''), |
| 7342 | addWarningOnce | HIGH | DRAFT_WRITE_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, '已识别到题中图形区域，但没有可用于裁剪的来源页面图。'); |
| 7444 | addWarningOnce | HIGH | PDF_PATH, DRAFT_WRITE_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, '自动裁剪的题中图形需要人工确认。'); |
| 9936 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | const options = cleanDisplayOptionsForBatchSave(item.options \|\| []); |
| 13153 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const solution = cleanDisplayTextForBatchSave(solutionItems[idx].solution); |
| 13156 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, DISPLAY_ONLY_PATH | if (preferred !== cleanDisplayTextForBatchSave(draft.solution)) { |
| 13271 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const optionCount = cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length; |
| 13497 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return window.Qisi.Utils.cleanDisplayOptionsForBatchSave(arr); |
| 13500 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return window.Qisi.Utils.cleanDisplayOptionsForBatchSave(raw); |
| 13504 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return window.Qisi.Utils.cleanDisplayOptionsForBatchSave([ |
| 13547 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | const oldOptions = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(draft.options \|\| []); |
| 13559 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const patchedStem = window.Qisi.Utils.cleanDisplayTextForBatchSave(patch.stem \|\| patch.题干 \|\| ''); |
| 13564 | addWarningOnce | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce(draft, `已通过最终视觉修复补回 ${patchedOptionCount}/4 个选项，请核对。`); |
| 13568 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const patchedAnswer = cleanDisplayTextForBatchSave(patch.answer \|\| patch.答案 \|\| ''); |
| 13570 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, DISPLAY_ONLY_PATH | const oldAnswer = cleanDisplayTextForBatchSave(draft.answer); |
| 13582 | addWarningOnce | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce(draft, '已通过最终视觉修复补回带公式答案，请核对。'); |
| 13587 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | const patchedSolution = cleanDisplayTextForBatchSave( |
| 13594 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | if (preferred !== cleanDisplayTextForBatchSave(draft.solution)) { |
| 13596 | addWarningOnce | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce(draft, '已通过最终视觉修复补回带公式解析，请核对。'); |
| 13714 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length, |
| 13758 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const optionCount = cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length; |
| 13830 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length, |
| 13859 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length, |
| 14545 | cleanDisplayTextForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | let cleanSolution = cleanDisplayTextForBatchSave(solution?.solution \|\| ''); |
| 15396 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | const options = cleanDisplayOptionsForBatchSave(q.options \|\| []); |
| 15560 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | return window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options \|\| []); |
| 16933 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: window.Qisi.Utils.cleanDisplayOptionsForBatchSave(q.options \|\| []).filter(opt => String(opt \|\| '').trim()).length, |
| 17426 | addWarningOnce | HIGH | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH | window.Qisi.Utils.addWarningOnce( |
| 17520 | addWarningOnce | HIGH | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH | window.Qisi.Utils.addWarningOnce( |
| 18247 | addWarningOnce | HIGH | PDF_PATH, WARNING_MUTATION_PATH | addWarningOnce( |
| 18900 | addWarningOnce | HIGH | PDF_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce( |
| 18906 | addWarningOnce | HIGH | PDF_PATH, DRAFT_WRITE_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce( |
| 18913 | addWarningOnce | HIGH | DRAFT_WRITE_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | addWarningOnce( |
| 18952 | addWarningOnce | HIGH | PDF_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, warning); |
| 18971 | addWarningOnce | HIGH | PDF_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, warning) |
| 19010 | addWarningOnce | HIGH | DRAFT_WRITE_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | addWarningOnce(draft, DOCX_TEXT_ONLY_WARNING); |
| 19013 | cleanDisplayFieldsOnly | HIGH | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | cleanDisplayFieldsOnly(draft); |
| 19212 | addWarningOnce | HIGH | PDF_PATH, DRAFT_WRITE_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, 'PDF 页面图渲染失败，请检查 renderPdfFilePages 是否返回空数组。'); |
| 19257 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(d.options).filter(Boolean).length, |
| 19275 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, VISUAL_REPAIR_PATH, DISPLAY_ONLY_PATH | const options = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(d.options); |
| 19335 | cleanDisplayOptionsForBatchSave | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | optionCount: cleanDisplayOptionsForBatchSave(d.options).filter(Boolean).length, |
| 19351 | addWarningOnce | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.addWarningOnce( |
| 19361 | addWarningOnce | HIGH | BATCH_SAVE_PATH, DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH | addWarningOnce(draft, `${solutionIssue}，请人工核对。`); |
| 19576 | cleanDisplayFieldsOnly | LOW | DISPLAY_ONLY_PATH | window.Qisi.Utils.cleanDisplayFieldsOnly(q); |
| 19632 | addWarningOnce | MEDIUM | OPTION_REPAIR_PATH, WARNING_MUTATION_PATH | window.Qisi.Utils.addWarningOnce( |
| 20003 | cleanDisplayFieldsOnly | HIGH | DRAFT_WRITE_PATH, OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH, DOCX_PATH | window.Qisi.Utils.cleanDisplayFieldsOnly(q); |
| 20021 | addWarningOnce | MEDIUM | OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.addWarningOnce( |
| 20032 | addWarningOnce | HIGH | BATCH_SAVE_PATH, OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH | addWarningOnce(q, `${solutionIssue}，请人工核对。`); |
| 20042 | addWarningOnce | MEDIUM | VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH | window.Qisi.Utils.addWarningOnce(q, '当前题目未绑定原图，若公式或图形缺失，请回到原文件人工核对。'); |
| 20329 | cleanDisplayFieldsOnly | MEDIUM | OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | window.Qisi.Utils.cleanDisplayFieldsOnly(q); |

## Decision

Wrapper-first gate may proceed: yes.
