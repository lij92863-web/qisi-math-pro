(function initDocxConverter(root, factory) {
    'use strict';
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.DocxConverter = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const fail = (code, message = code, cause = null) => {
        const error = new Error(message);
        error.code = code;
        if (cause) error.cause = cause;
        return error;
    };

    const assertActive = signal => {
        if (!signal?.aborted) return;
        const error = fail('DOCX_CONVERT_CANCELLED');
        error.name = 'AbortError';
        throw error;
    };

    const readJson = async response => {
        if (typeof response?.json !== 'function') return null;
        try {
            return await response.json();
        } catch (_) {
            return null;
        }
    };

    function createDocxToPdfConverter(ports = {}) {
        if (
            typeof ports.request !== 'function' ||
            typeof ports.createFormData !== 'function' ||
            typeof ports.dataUrlToBlob !== 'function' ||
            typeof ports.getBaseUrl !== 'function' ||
            typeof ports.getRoles !== 'function'
        ) throw fail('DOCX_CONVERTER_PORT_REQUIRED');

        const now = typeof ports.now === 'function' ? ports.now : Date.now;
        const logger = ports.logger || {};
        const log = (method, event, details) => {
            if (typeof logger[method] === 'function') {
                logger[method](event, details);
            }
        };

        return async function convertDocxToPdf(fileRecord, options = {}) {
            const signal = options.signal || null;
            if (
                !fileRecord ||
                String(fileRecord.fileType || '').toLowerCase() !== 'docx' ||
                !String(fileRecord.id || '').trim() ||
                !String(fileRecord.uploadPath || '').trim()
            ) throw fail('DOCX_CONVERTER_INPUT_INVALID');

            const baseUrl = String(ports.getBaseUrl() || '').replace(/\/$/, '');
            if (!/^https?:\/\//i.test(baseUrl)) {
                throw fail('DOCX_CONVERTER_BASE_URL_INVALID');
            }

            assertActive(signal);
            let healthResponse;
            let healthData;
            try {
                healthResponse = await ports.request(`${baseUrl}/api/health`, {
                    method: 'GET',
                    cache: 'no-store',
                    signal
                });
                assertActive(signal);
                healthData = await readJson(healthResponse);
            } catch (error) {
                assertActive(signal);
                throw fail(
                    'DOCX_CONVERT_SERVICE_UNAVAILABLE',
                    '本地 DOCX 转 PDF 服务不可用。',
                    error
                );
            }
            assertActive(signal);
            if (!healthResponse?.ok || healthData?.ok !== true) {
                throw fail(
                    'DOCX_CONVERT_SERVICE_UNAVAILABLE',
                    '本地 DOCX 转 PDF 服务不可用。'
                );
            }

            const blob = await ports.dataUrlToBlob(fileRecord.uploadPath);
            assertActive(signal);
            const form = ports.createFormData();
            if (!form || typeof form.append !== 'function') {
                throw fail('DOCX_CONVERTER_FORM_INVALID');
            }
            form.append('file', blob, fileRecord.filename || 'upload.docx');
            log('log', '[BATCH_DEBUG][local-docx-convert-start]', {
                filename: fileRecord.filename || '',
                fileSize: Number(fileRecord.fileSize || 0),
                baseUrl
            });

            let response;
            let data;
            try {
                response = await ports.request(
                    `${baseUrl}/api/convert/docx-to-pdf`,
                    { method: 'POST', body: form, signal }
                );
                assertActive(signal);
                data = await readJson(response);
            } catch (error) {
                assertActive(signal);
                throw fail(
                    'DOCX_CONVERT_REQUEST_FAILED',
                    'DOCX 转 PDF 请求失败。',
                    error
                );
            }
            assertActive(signal);

            if (!response?.ok || data?.ok !== true) {
                log('error', '[BATCH_DEBUG][local-docx-convert-backend-error]', {
                    status: Number(response?.status || 0)
                });
                throw fail('DOCX_CONVERT_FAILED');
            }
            if (!String(data.pdfDataUrl || '').trim()) {
                throw fail('DOCX_CONVERT_RESULT_MALFORMED');
            }

            const pdfFilename = String(fileRecord.filename || 'upload.docx')
                .replace(/\.docx$/i, '.pdf');
            log('log', '[BATCH_DEBUG][local-docx-convert-success]', {
                originalFilename: fileRecord.filename || '',
                pdfFilename: data.pdfFilename || '',
                pdfBytes: Number(data.pdfBytes || 0)
            });

            return {
                ...fileRecord,
                id: `${fileRecord.id}_converted_pdf_${now()}`,
                filename: pdfFilename,
                serverPdfFilename: data.pdfFilename || '',
                fileType: 'pdf',
                uploadPath: data.pdfDataUrl,
                role: fileRecord.role,
                roles: ports.getRoles(fileRecord),
                pageRange: fileRecord.pageRange || '',
                convertedFromDocx: true,
                sourceDocxFileId: fileRecord.id,
                sourceDocxFileName: fileRecord.filename || '',
                sourceDocxMimeType:
                    fileRecord.mimeType || fileRecord.type ||
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                parseStatus: 'pending',
                errorMessage: ''
            };
        };
    }

    return Object.freeze({ createDocxToPdfConverter });
});
