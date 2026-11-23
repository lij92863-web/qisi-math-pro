(function (root) {
    'use strict';

    function read(clipboard) {
        const files = Array.from(clipboard?.files || []);
        if (files.length) return files;
        return Array.from(clipboard?.items || [])
            .filter(item => item.kind === 'file')
            .map(item => item.getAsFile())
            .filter(Boolean);
    }

    const imageTypes = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
    const imageMime = file => {
        if (Object.values(imageTypes).includes(file.type)) return file.type;
        const extension = file.name.split('.').at(-1).toLowerCase();
        return Object.hasOwn(imageTypes, extension) ? imageTypes[extension] : '';
    };

    function singlePagePdf(jpeg, width, height, name) {
        const scale = Math.min(.75, 14400 / Math.max(width, height));
        const pageWidth = (width * scale).toFixed(2);
        const pageHeight = (height * scale).toFixed(2);
        const contents = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`;
        const parts = [];
        const offsets = [0];
        let size = 0;
        const append = (...items) => {
            for (const item of items) {
                parts.push(item);
                size += typeof item === 'string' ? item.length : item.size;
            }
        };
        const object = (...body) => {
            const id = offsets.length;
            offsets.push(size);
            append(id + ' 0 obj\n', ...body, '\nendobj\n');
        };

        // All structural strings are ASCII, so their lengths are byte offsets.
        append('%PDF-1.4\n');
        object('<< /Type /Catalog /Pages 2 0 R >>');
        object('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
        object(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
            '/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
        object(
            `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
            `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.size} >>\nstream\n`,
            jpeg, '\nendstream'
        );
        object(`<< /Length ${contents.length} >>\nstream\n${contents}endstream`);
        const xref = size;
        append(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
        for (const offset of offsets.slice(1)) append(String(offset).padStart(10, '0') + ' 00000 n \n');
        append(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
        return new File(parts, name, { type: 'application/pdf' });
    }

    async function imageToPdf(file) {
        const mime = imageMime(file);
        if (!mime) throw new Error('仅支持 PNG、JPG、WEBP 图片。');
        const bitmap = await root.createImageBitmap(file.type === mime ? file : file.slice(0, file.size, mime));
        const canvas = root.document.createElement('canvas');
        try {
            const { width, height } = bitmap;
            if (width * height > 24_000_000) throw new Error('图片像素过大，请裁剪或缩小后再粘贴。');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d', { alpha: false });
            if (!context) throw new Error('浏览器无法处理这张图片。');
            context.fillStyle = 'white';
            context.fillRect(0, 0, width, height);
            context.drawImage(bitmap, 0, 0);
            const jpeg = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .96));
            if (!jpeg || jpeg.type !== 'image/jpeg') throw new Error('图片转换失败，请换一张图片重试。');
            const name = file.name.replace(/\.[^.]+$/, '') || '粘贴图片';
            return singlePagePdf(jpeg, width, height, name + '.pdf');
        } finally {
            bitmap.close();
            canvas.width = canvas.height = 0;
        }
    }

    const pasteTarget = {
        props: { disabled: Boolean },
        emits: ['files'],
        data: () => ({ message: '' }),
        methods: {
            paste(event) {
                if (this.disabled) return;
                const files = read(event.clipboardData);
                this.message = files.length ? '' : '请先复制截图或实际文件，再按 Ctrl+V。';
                if (!files.length) return;
                event.preventDefault();
                this.$emit('files', files);
            }
        },
        template: `<div class="v-paste-target">
            <button class="v-btn" type="button" :disabled="disabled" @paste="paste"
                @click="$event.currentTarget.focus()" @blur="message=''" title="点击这里，然后按 Ctrl+V"
                aria-description="复制图片或文件后，在这里按 Ctrl+V">
                粘贴图片或文件 <kbd aria-hidden="true">Ctrl+V</kbd>
            </button>
            <small v-if="message" class="v-paste-message" role="status">{{message}}</small>
        </div>`
    };

    root.Qisi = root.Qisi || {};
    root.Qisi.ClipboardFiles = Object.freeze({
        read, imageMime, imageToPdf,
        install(app) { app.component('FilePasteTarget', pasteTarget); }
    });
})(globalThis);
