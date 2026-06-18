# C9B DOCX Fixture Report

## Scope

- Added a sanitized minimal fixture for the real DOCX structure observed in C9A.
- No real exam body content was copied.
- No business code was changed in C9B.
- PDF, OCR, AI, API, and case02 were not used.

## Fixture Coverage

- Image-prefixed question marker: `[[IMAGE:docx_img_8]] 8.`
- Image-prefixed spaced two-digit question marker: `[[IMAGE:docx_img_11]] 1 1.`
- Image-prefixed support marker with answer label: `[[IMAGE:support_img_2]] 2 [answer label]`

## Current Behavior

- The support parser accepts the normal marker for question `1`.
- The support parser does not accept the image-prefixed marker for question `2`.
- This matches the structural gap recorded in C9A and gives C9C a minimal repair target.
