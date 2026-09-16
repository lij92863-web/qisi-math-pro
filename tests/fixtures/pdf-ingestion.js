// Actual PDF bytes: no injected candidate transport and no paid service.
const makePdf = (mixed = false) => {
    const stream = 'BT /F1 12 Tf 90 720 Td (1. Calculate the sum of two positive integers.) Tj '
        + '0 -24 Td (A. 1   B. 2   C. 3   D. 4) Tj ET\n'
        + (mixed ? Array.from({ length: 12 }, (_, i) => `90 ${600 + i} m 120 ${600 + i} l S`).join('\n') : '');
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 840] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
    let data = '%PDF-1.4\n'; const offsets = [0];
    objects.forEach((object, i) => { offsets.push(Buffer.byteLength(data)); data += `${i + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = Buffer.byteLength(data);
    data += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}`;
    data += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(data);
};
module.exports = { makePdf };
