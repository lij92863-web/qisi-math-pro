(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutQr = api;

    if (
        typeof module !== 'undefined'
        && module.exports
    ) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,
    function () {
        'use strict';

        const VERSION = 4;
        const SIZE = 17 + VERSION * 4;
        const DATA_CODEWORDS = 80;
        const ECC_CODEWORDS = 20;
        const MAX_BYTES = 77;
        const FORMAT_MASK = 0x5412;
        const FORMAT_POLYNOMIAL = 0x537;

        const utf8Bytes = value => {
            const text = String(value || '');
            if (typeof TextEncoder !== 'undefined') {
                return [...new TextEncoder().encode(text)];
            }
            return [...unescape(encodeURIComponent(text))]
                .map(character => character.charCodeAt(0));
        };

        const createBitBuffer = () => {
            const bits = [];
            return {
                push(value, length) {
                    for (
                        let index = length - 1;
                        index >= 0;
                        index -= 1
                    ) {
                        bits.push((value >>> index) & 1);
                    }
                },
                get length() {
                    return bits.length;
                },
                toCodewords() {
                    const result = [];
                    for (
                        let index = 0;
                        index < bits.length;
                        index += 8
                    ) {
                        let value = 0;
                        for (
                            let offset = 0;
                            offset < 8;
                            offset += 1
                        ) {
                            value = (
                                value << 1
                            ) | (bits[index + offset] || 0);
                        }
                        result.push(value);
                    }
                    return result;
                }
            };
        };

        const createGaloisTables = () => {
            const exponent = new Array(512).fill(0);
            const logarithm = new Array(256).fill(0);
            let value = 1;
            for (let index = 0; index < 255; index += 1) {
                exponent[index] = value;
                logarithm[value] = index;
                value <<= 1;
                if (value & 0x100) value ^= 0x11d;
            }
            for (let index = 255; index < 512; index += 1) {
                exponent[index] = exponent[index - 255];
            }
            return { exponent, logarithm };
        };

        const GF = createGaloisTables();
        const multiply = (left, right) => {
            if (!left || !right) return 0;
            return GF.exponent[
                GF.logarithm[left] + GF.logarithm[right]
            ];
        };

        const generatorPolynomial = degree => {
            let polynomial = [1];
            for (let index = 0; index < degree; index += 1) {
                const next = new Array(
                    polynomial.length + 1
                ).fill(0);
                polynomial.forEach((coefficient, offset) => {
                    next[offset] ^= coefficient;
                    next[offset + 1] ^=
                        multiply(
                            coefficient,
                            GF.exponent[index]
                        );
                });
                polynomial = next;
            }
            return polynomial;
        };

        const errorCorrection = data => {
            const generator =
                generatorPolynomial(ECC_CODEWORDS);
            const remainder = new Array(ECC_CODEWORDS).fill(0);
            for (const codeword of data) {
                const factor = codeword ^ remainder.shift();
                remainder.push(0);
                if (!factor) continue;
                for (
                    let index = 0;
                    index < ECC_CODEWORDS;
                    index += 1
                ) {
                    remainder[index] ^=
                        multiply(generator[index + 1], factor);
                }
            }
            return remainder;
        };

        const encodeCodewords = value => {
            const bytes = utf8Bytes(value);
            if (bytes.length > MAX_BYTES) {
                throw new RangeError(
                    `二维码内容不得超过 ${MAX_BYTES} 个 UTF-8 字节`
                );
            }
            const buffer = createBitBuffer();
            // ECI assignment 26 declares UTF-8 explicitly so Chinese content
            // is decoded consistently instead of being treated as Latin-1.
            buffer.push(0b0111, 4);
            buffer.push(26, 8);
            buffer.push(0b0100, 4);
            buffer.push(bytes.length, 8);
            bytes.forEach(byte => buffer.push(byte, 8));
            const capacity = DATA_CODEWORDS * 8;
            buffer.push(
                0,
                Math.min(4, capacity - buffer.length)
            );
            while (buffer.length % 8) buffer.push(0, 1);
            const data = buffer.toCodewords();
            let pad = 0;
            while (data.length < DATA_CODEWORDS) {
                data.push(pad % 2 === 0 ? 0xec : 0x11);
                pad += 1;
            }
            return [...data, ...errorCorrection(data)];
        };

        const createMatrix = () => ({
            values: Array.from(
                { length: SIZE },
                () => new Array(SIZE).fill(false)
            ),
            reserved: Array.from(
                { length: SIZE },
                () => new Array(SIZE).fill(false)
            )
        });

        const reserve = (matrix, x, y, value = false) => {
            if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
            matrix.values[y][x] = Boolean(value);
            matrix.reserved[y][x] = true;
        };

        const addFinder = (matrix, originX, originY) => {
            for (let y = -1; y <= 7; y += 1) {
                for (let x = -1; x <= 7; x += 1) {
                    const localX = x;
                    const localY = y;
                    const dark = (
                        localX >= 0
                        && localX <= 6
                        && localY >= 0
                        && localY <= 6
                        && (
                            localX === 0
                            || localX === 6
                            || localY === 0
                            || localY === 6
                            || (
                                localX >= 2
                                && localX <= 4
                                && localY >= 2
                                && localY <= 4
                            )
                        )
                    );
                    reserve(
                        matrix,
                        originX + x,
                        originY + y,
                        dark
                    );
                }
            }
        };

        const addAlignment = (matrix, centerX, centerY) => {
            for (let y = -2; y <= 2; y += 1) {
                for (let x = -2; x <= 2; x += 1) {
                    reserve(
                        matrix,
                        centerX + x,
                        centerY + y,
                        Math.max(Math.abs(x), Math.abs(y)) !== 1
                    );
                }
            }
        };

        const formatBits = () => {
            const data = 0b01000;
            let value = data << 10;
            for (let bit = 14; bit >= 10; bit -= 1) {
                if ((value >>> bit) & 1) {
                    value ^= FORMAT_POLYNOMIAL << (bit - 10);
                }
            }
            return ((data << 10) | value) ^ FORMAT_MASK;
        };

        const addFunctionPatterns = matrix => {
            addFinder(matrix, 0, 0);
            addFinder(matrix, SIZE - 7, 0);
            addFinder(matrix, 0, SIZE - 7);
            for (let index = 8; index < SIZE - 8; index += 1) {
                reserve(matrix, index, 6, index % 2 === 0);
                reserve(matrix, 6, index, index % 2 === 0);
            }
            addAlignment(matrix, 26, 26);
            reserve(matrix, 8, SIZE - 8, true);

            const first = [
                [8, 0], [8, 1], [8, 2], [8, 3], [8, 4],
                [8, 5], [8, 7], [8, 8], [7, 8], [5, 8],
                [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
            ];
            const second = [
                [SIZE - 1, 8], [SIZE - 2, 8],
                [SIZE - 3, 8], [SIZE - 4, 8],
                [SIZE - 5, 8], [SIZE - 6, 8],
                [SIZE - 7, 8], [SIZE - 8, 8],
                [8, SIZE - 7], [8, SIZE - 6],
                [8, SIZE - 5], [8, SIZE - 4],
                [8, SIZE - 3], [8, SIZE - 2],
                [8, SIZE - 1]
            ];
            const bits = formatBits();
            first.forEach(([x, y], index) =>
                reserve(matrix, x, y, (bits >>> index) & 1)
            );
            second.forEach(([x, y], index) =>
                reserve(matrix, x, y, (bits >>> index) & 1)
            );
        };

        const placeData = (matrix, codewords) => {
            const bits = codewords.flatMap(codeword =>
                Array.from(
                    { length: 8 },
                    (_, index) => (codeword >>> (7 - index)) & 1
                )
            );
            let bitIndex = 0;
            let upward = true;
            for (
                let right = SIZE - 1;
                right >= 1;
                right -= 2
            ) {
                if (right === 6) right -= 1;
                for (let step = 0; step < SIZE; step += 1) {
                    const y = upward ? SIZE - 1 - step : step;
                    for (let offset = 0; offset < 2; offset += 1) {
                        const x = right - offset;
                        if (matrix.reserved[y][x]) continue;
                        const raw = bits[bitIndex] || 0;
                        bitIndex += 1;
                        const masked = raw ^ (
                            (x + y) % 2 === 0 ? 1 : 0
                        );
                        matrix.values[y][x] = Boolean(masked);
                    }
                }
                upward = !upward;
            }
        };

        const createMatrixFor = value => {
            const matrix = createMatrix();
            addFunctionPatterns(matrix);
            placeData(matrix, encodeCodewords(value));
            return matrix.values;
        };

        const toSvg = (
            value,
            {
                moduleSize = 4,
                quietZone = 4,
                foreground = '#111827',
                background = '#ffffff'
            } = {}
        ) => {
            const matrix = createMatrixFor(value);
            const side = SIZE + quietZone * 2;
            const cells = [];
            matrix.forEach((row, y) => row.forEach((dark, x) => {
                if (!dark) return;
                cells.push(
                    `<rect x="${x + quietZone}" y="${y + quietZone}" width="1" height="1"/>`
                );
            }));
            return [
                `<svg xmlns="http://www.w3.org/2000/svg" width="${side * moduleSize}" height="${side * moduleSize}" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges">`,
                `<rect width="${side}" height="${side}" fill="${background}"/>`,
                `<g fill="${foreground}">${cells.join('')}</g>`,
                '</svg>'
            ].join('');
        };

        const toDataUri = value => (
            `data:image/svg+xml;charset=utf-8,${encodeURIComponent(toSvg(value))}`
        );

        return Object.freeze({
            VERSION,
            SIZE,
            MAX_BYTES,
            utf8Bytes,
            encodeCodewords,
            createMatrix: createMatrixFor,
            toSvg,
            toDataUri
        });
    }
);
