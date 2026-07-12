const fs = require('node:fs');

const required = [
    'documentId', 'sourceHash', 'page', 'sourceOrder', 'questionNumber',
    'stem', 'options', 'answer', 'solution', 'formulas', 'images',
    'expectedSafePartial', 'notes'
];

const validate = rows => {
    if (!Array.isArray(rows)) return ['root must be an array'];
    return rows.flatMap((row, index) => required
        .filter(field => !Object.prototype.hasOwnProperty.call(row || {}, field))
        .map(field => `${index}.${field} is required`));
};

if (require.main === module) {
    const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const errors = validate(rows);
    process.stdout.write(`${JSON.stringify({ valid: !errors.length, errors })}\n`);
    process.exitCode = errors.length ? 1 : 0;
}

module.exports = { validate };
