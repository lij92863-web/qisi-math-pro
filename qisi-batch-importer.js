(function () {
    const dataUrlToArrayBuffer = async (dataUrl) => {
        const res = await fetch(dataUrl);
        return await res.arrayBuffer();
    };

    const loadDocxZip = async (fileRecord) => {
        if (!window.JSZip) throw new Error('JSZip not loaded, cannot parse DOCX.');
        const buffer = await dataUrlToArrayBuffer(fileRecord.uploadPath);
        return await window.Qisi.ArchiveSecurity.load(
            window.JSZip,
            buffer,
            'office-document',
            {
                name: fileRecord.filename || fileRecord.name || 'document.docx',
                type: fileRecord.mime || fileRecord.type || ''
            }
        );
    };

    const readDocxCoreXml = async (zip) => {
        const documentXml = await zip.file('word/document.xml')?.async('text') || '';
        const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('text').catch(() => '') || '';
        return { documentXml, relsXml };
    };

    const parseRelationships = (relsXml = '') => {
        const map = new Map();

        String(relsXml || '').replace(/<Relationship\b([^>]+?)\/>/g, (_, attrs) => {
            const id = attrs.match(/\bId=["']([^"']+)["']/)?.[1] || '';
            const target = attrs.match(/\bTarget=["']([^"']+)["']/)?.[1] || '';
            const type = attrs.match(/\bType=["']([^"']+)["']/)?.[1] || '';

            if (!id || !target) return '';

            const normalizedTarget = target.startsWith('/')
                ? target.replace(/^\/+/, '')
                : `word/${target.replace(/^(\.\.\/)+/, '')}`;

            map.set(id, { id, target: normalizedTarget.replace(/\\/g, '/'), type });
            return '';
        });

        return map;
    };

    const getExt = (path = '') => {
        const m = String(path || '').match(/\.([a-zA-Z0-9]+)$/);
        return m ? m[1].toLowerCase() : '';
    };

    const getMime = (path = '') => {
        const ext = getExt(path);
        return {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            gif: 'image/gif',
            webp: 'image/webp',
            svg: 'image/svg+xml',
            bmp: 'image/bmp',
            emf: 'image/emf',
            wmf: 'image/wmf',
            bin: 'application/octet-stream'
        }[ext] || 'application/octet-stream';
    };

    const isDisplayableImage = (ext = '') =>
        /^(png|jpg|jpeg|gif|webp|svg)$/i.test(ext);

    const readMediaAsDataUrl = async (zip, targetPath = '') => {
        const normalized = String(targetPath || '').replace(/^\/+/, '');
        const file = zip.file(normalized);
        if (!file) return '';

        const blob = await file.async('blob');
        const mime = getMime(normalized);

        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('Failed to read DOCX media.'));
            reader.readAsDataURL(new Blob([blob], { type: mime }));
        });
    };

    const buildMediaMaps = async (zip, relsXml = '', filename = '') => {
        const relMap = parseRelationships(relsXml);
        const mediaMap = new Map();

        for (const [rid, rel] of relMap.entries()) {
            const target = rel.target || '';
            const ext = getExt(target);
            const isMedia =
                /\/image/i.test(rel.type || '') ||
                /oleObject/i.test(rel.type || '') ||
                /\.(png|jpe?g|gif|bmp|webp|svg|emf|wmf|bin)$/i.test(target);

            if (!isMedia) continue;

            const mime = getMime(target);
            const displayable = isDisplayableImage(ext);

            let dataUrl = '';
            try {
                dataUrl = await readMediaAsDataUrl(zip, target);
            } catch (error) {
                console.warn('[BATCH_IMPORTER][docx-media-read-failed]', {
                    filename,
                    rid,
                    target,
                    ext,
                    message: error?.message || String(error)
                });
            }

            mediaMap.set(rid, {
                rid,
                target,
                type: rel.type,
                ext,
                mime,
                displayable,
                url: dataUrl,
                hasUrl: Boolean(dataUrl)
            });
        }

        console.groupCollapsed('[BATCH_IMPORTER][docx-media-summary]');
        console.log('filename =', filename);
        console.log('mediaCount =', mediaMap.size);
        console.table([...mediaMap.values()].slice(0, 80).map(x => ({
            rid: x.rid,
            target: x.target,
            ext: x.ext,
            displayable: x.displayable,
            hasUrl: x.hasUrl
        })));
        console.groupEnd();

        return mediaMap;
    };

    const decodeXmlEntitiesSafe = (value = '') => String(value || '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

    const normalizeDocxText = (value = '') => String(value || '')
        .replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
        .replace(/\u00A0/g, ' ')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    const consumeLeadingImageTokens = (value = '') => {
        const source =
            String(value || '');

        const match =
            source.match(
                /^(?:\s*\[\[IMAGE(?::[^\]\r\n]+)?\]\]\s*)+/
            );

        return match
            ? match[0].length
            : 0;
    };

    const parseLeadingQuestionMarker = (
        value = ''
    ) => {
        const source =
            normalizeDocxText(value);

        const imagePrefixLength =
            consumeLeadingImageTokens(source);

        const markerSource =
            source.slice(imagePrefixLength);

        const match = markerSource.match(
            /^\s*((?:\d\s*){1,3})[.\uFF0E\u3001\u3002)\uFF09]\s*/
        );
        if (!match) {
            return {
                source,
                questionNumber: '',
                markerLength: 0,
                rawMarker: ''
            };
        }

        const compactDigits =
            String(match[1] || '')
                .replace(/\s+/g, '');

        const numericValue =
            Number(compactDigits);

        if (
            !Number.isInteger(numericValue) ||
            numericValue <= 0 ||
            numericValue > 999
        ) {
            return {
                source,
                questionNumber: '',
                markerLength: 0,
                rawMarker: ''
            };
        }

        return {
            source,
            questionNumber:
                String(numericValue),
            markerLength:
                imagePrefixLength + match[0].length,
            rawMarker:
                source.slice(0, imagePrefixLength + match[0].length)
        };
    };

    const extractRelationshipIdsFromXml = (xml = '') => {
        const ids = [];

        String(xml || '').replace(/\br:embed=["']([^"']+)["']/g, (_, rid) => {
            if (rid) ids.push(rid);
            return '';
        });

        String(xml || '').replace(/\br:id=["']([^"']+)["']/g, (_, rid) => {
            if (rid) ids.push(rid);
            return '';
        });

        String(xml || '').replace(/\bo:relid=["']([^"']+)["']/g, (_, rid) => {
            if (rid) ids.push(rid);
            return '';
        });

        return [...new Set(ids)];
    };

    const ommlChildren = (node, localName) => Array.from(node?.childNodes || [])
        .filter(child => child.nodeType === 1 && child.localName === localName);

    const ommlFirst = (node, localName) => ommlChildren(node, localName)[0] || null;

    const ommlNodeText = (node) => {
        if (!node) return '';
        if (node.nodeType === 3) return node.nodeValue || '';
        if (node.nodeType !== 1) return '';

        const name = node.localName;

        if (name === 't') return node.textContent || '';
        if (name === 'r') return Array.from(node.childNodes).map(ommlNodeText).join('');

        if (name === 'f') {
            const num = ommlNodeText(ommlFirst(node, 'num'));
            const den = ommlNodeText(ommlFirst(node, 'den'));
            return `\\frac{${num}}{${den}}`;
        }

        if (name === 'sSup') {
            return `${ommlNodeText(ommlFirst(node, 'e'))}^{${ommlNodeText(ommlFirst(node, 'sup'))}}`;
        }

        if (name === 'sSub') {
            return `${ommlNodeText(ommlFirst(node, 'e'))}_{${ommlNodeText(ommlFirst(node, 'sub'))}}`;
        }

        if (name === 'sSubSup') {
            return `${ommlNodeText(ommlFirst(node, 'e'))}_{${ommlNodeText(ommlFirst(node, 'sub'))}}^{${ommlNodeText(ommlFirst(node, 'sup'))}}`;
        }

        if (name === 'rad') {
            const deg = ommlNodeText(ommlFirst(node, 'deg'));
            const body = ommlNodeText(ommlFirst(node, 'e'));
            return deg ? `\\sqrt[${deg}]{${body}}` : `\\sqrt{${body}}`;
        }

        if (name === 'bar') {
            return `\\overline{${ommlNodeText(ommlFirst(node, 'e'))}}`;
        }

        if (name === 'd') {
            const body = ommlNodeText(ommlFirst(node, 'e'));
            return `\\left(${body}\\right)`;
        }

        if (name === 'nary') {
            const pr = ommlFirst(node, 'naryPr');
            const chr = pr?.getElementsByTagName?.('m:chr')?.[0]?.getAttribute('m:val') || '\\sum';
            const sub = ommlNodeText(ommlFirst(node, 'sub'));
            const sup = ommlNodeText(ommlFirst(node, 'sup'));
            const body = ommlNodeText(ommlFirst(node, 'e'));
            return `${chr}${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''}${body}`;
        }

        if (['num', 'den', 'e', 'sub', 'sup', 'deg', 'oMath', 'oMathPara'].includes(name)) {
            return Array.from(node.childNodes).map(ommlNodeText).join('');
        }

        return Array.from(node.childNodes).map(ommlNodeText).join('');
    };

    const ommlToLatex = (xml = '') => {
        try {
            const wrapped = `<root xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${xml}</root>`;
            const doc = new DOMParser().parseFromString(wrapped, 'application/xml');
            const latex = ommlNodeText(doc.documentElement).replace(/\s+/g, ' ').trim();
            return latex ? `$${latex}$` : '';
        } catch (error) {
            console.warn('[BATCH_IMPORTER][omml-to-latex-failed]', error);
            return '';
        }
    };

    const makeDocxImageToken = (rid, mediaMap, imageBucket, q = '') => {
        if (!rid) return '';

        const media = mediaMap.get(rid);
        if (!media) return '';

        const existing = imageBucket.find(img => img.rid === rid);
        if (existing) return `[[IMAGE:${existing.id}]]`;

        if (media.displayable && media.url) {
            const safeRid = String(rid).replace(/[^a-zA-Z0-9_-]/g, '_');
            const id = `docx_img_${q || 'q'}_${safeRid}_${imageBucket.length}_${Date.now()}`;

            imageBucket.push({
                id,
                url: media.url,
                filename: `${id}.${media.ext || 'png'}`,
                name: `${id}.${media.ext || 'png'}`,
                source: 'docx-inline-image',
                rid,
                ext: media.ext,
                mime: media.mime,
                displayable: true
            });

            return `[[IMAGE:${id}]]`;
        }

        const ext = media.ext || 'unknown';
        return `[闂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缁炬儳缍婇弻鐔兼⒒鐎靛壊妲紒鐐劤缂嶅﹪寮婚悢鍏尖拻閻庨潧澹婂Σ顔剧磼閻愵剙鍔ょ紓宥咃躬瀵鎮㈤崗灏栨嫽闁诲酣娼ф竟濠偽ｉ鍓х＜闁绘劦鍓欓崝銈囩磽瀹ュ拑韬€殿喖顭烽幃銏ゅ礂鐏忔牗瀚介梺璇查叄濞佳勭珶婵犲伣锝夘敊閸撗咃紲闂佺粯鍔﹂崜娆撳礉閵堝洨纾界€广儱鎷戦煬顒傗偓娈垮枛椤兘寮幇顓炵窞濠电姴瀚烽崥鍛存⒒娴ｇ懓顕滅紒璇插€块獮澶娾槈閵忕姷顔掔紓鍌欑劍椤洭宕㈤柆宥嗏拺闂傚牊绋撴晶鏇㈡煙閸愭煡鍙勬い銏℃椤㈡﹢濮€閿涘嫬骞愰梺璇茬箳閸嬫稒鏅堕挊澹濊櫣鈧稒菧娴滄粓鏌曡箛濠傚⒉缂佲偓鐎ｎ喗鐓涘ù锝囨嚀婵秶鈧娲栧畷顒勫煝鎼粹檧鏋庨柟瀵稿Л閺佸秹姊婚崒姘偓鎼佸磹妞嬪孩顐芥慨妯挎硾閻掑灚銇勯幒鎴濃偓鍛婄濠婂牊鐓犳繛鑼额嚙閻忥繝鏌￠崨顓犲煟鐎规洘绮忛ˇ瀵哥棯閹佸仮闁哄矉绲借灒闁圭娴疯ぐ褔鏌ｈ箛鎾寸闁告瑥鍟村濠氭晲婢跺娅滈梺鎼炲劀閸愩劎顓洪梻鍌欐祰椤曟牠宕伴幒妤€绀堟繝闈涱儏缁犳岸鏌￠崘銊у⒈闁轰礁锕弻鐔碱敍閸℃顏慨锝呭缁绘繈鎮介棃娴躲儵鏌℃担鍛婂暈缂佺粯鐩崺鈧い鎺嶈兌缁犳儳霉閿濆懎鏆辨繛璇х畵瀹曟垹鈧綆浜栭弨浠嬫煟濡搫绾ч柟鍏煎姍閺屾稑顫濋鍌溞ㄩ梺鍝勮嫰缁夌兘篓娓氣偓閺屾盯骞樼€靛憡鍣伴梺鐐藉劜濡啫鐣峰鈧、娆撳床婢诡垰娲ょ粻鍦磼椤旂厧甯ㄩ柛瀣崌閹崇娀顢楅埀顒勫吹椤掑倻纾介柛灞捐壘閳ь剙鍢查湁闁搞儺鍓﹂弫瀣喐韫囨稑鐒垫い鎺嶈兌閻擃垶鏌涘Δ浣糕枙闁诡喕鍗抽、姘跺焵椤掑嫮宓侀悗锝庡枟閺呮繈鏌嶈閸撴稓鍒掗崼鈶╁亾閿濆骸浜栧ù婊勭矒閺屸€愁吋閸愩劌顬嬮梺鎰佸灡濞茬喖寮诲☉娆愬劅妞ゆ柨顭烽崑妤呮⒑閸濆嫮鐒跨紓宥勭窔楠炲啴鍩￠崨顓犵厬婵犮垼娉涢惌鍫澪ｅú顏呪拻濞达絽鎲￠崯鐐烘煙濮濆苯鍚归柟骞垮灲瀹曞崬鈽夊Ο纭风串闂備礁鎼ˇ浼村垂閻旂厧缁╁ù鐘差儐閻撶喐淇婇婵囶仩濞寸姵鐩弻锟犲幢韫囨梹鐝旈梺瀹狀潐閸ㄥ潡銆佸▎鎾崇畾鐟滃秹鐛€ｎ喗鍊垫繛鍫濈仢濞呮﹢鏌涚€ｎ亷韬柣娑卞櫍瀵粙濡搁敃鈧鎾绘⒑閸涘﹦缂氶柛搴ゅ吹濡叉劖娼忛妸褏鐦堥梺姹囧灲濞佳勭閿曞倹鐓曢柕濞垮劤閸╋綁鏌嶉妷顖滅暤鐎规洘甯掗～婵嬫晲閸♀晜缍屽┑鐘殿暯濡插懘宕归崼鏇炵哗闂侇剙绉甸崐闈涒攽閻樺磭顣查柍閿嬪灴閹嘲鈻庤箛鎿冧患闂佸憡鏌ｉ崐婵嬪蓟濞戙垺鍋勯梺鍨儏娴犳挳姊虹拠鈥虫灍妞ゃ劌锕妴浣割潨閳ь剚鎱ㄩ埀顒勬煃闁款垰浜鹃梺褰掓敱濡炶棄顫忓ú顏勫窛濠电姴鍟棄宥夋偡濠婂嫭绶查柛鐕佸灣缁顓奸崨顏呮杸闂佹悶鍎弲婵嬵敊閺囩偐鏀介柣鎰摠缂嶆垶銇勯幋婵囶棞闁宠绉瑰畷鍫曞煛閸愵亷绱查梺鍝勵槸閻楀啴寮插☉娆戭浄閺夊牃鏂侀崑鎾斥枔閸喗鐏嗙紓渚囧枟閻熲晠濡存担鍓叉建闁逞屽墴楠炲啴濮€閵堝懍绱堕梺鍛婃处閸嬪棝顢欓崶顒佲拻闁稿本鑹鹃埀顒傚厴閹偤鏁冮崒姘辩暫闂佸壊鍋呭ú鏍閹稿簺浜滈柡宥庡亜娴犳粎鐥幆褎鍋ユ慨濠冩そ椤㈡鍩€椤掑倻鐭撻柣銏㈩焾绾惧綊鏌ら崫銉ヤ化濞存粍绮撻悡顐﹀炊閵婏箑鏆楁繝鈷€鍕创闁哄矉缍侀獮妯兼崉閻戞浜梻浣告惈閻ジ宕伴弽顓犲祦闁糕剝鍑瑰Σ濠氭⒑閼测晩鐒剧紓宥咃躬瀵鈽夐姀鐘电潉闂佽鍎虫晶搴ㄥ汲閵堝鈷戦柛婵嗗椤︻剟鏌嶈閸撴瑧澹曢銏犳辈闁糕剝绋掗崐鐢告煥濠靛棝顎楀褎澹嗛幃顕€鏁冮崒娑氬幗闁瑰吋鐣崺鍕疮韫囨稒鐓曢柨婵嗛濞呭秶鈧娲樼划鎾诲箖閵忋倖鍤冮柍杞拌兌閵堬箓姊绘担鍝ョШ闁稿锕畷銏＄鐎ｎ亞锛熼梺缁樻煥閸氬鎮¤箛娑氬彄闁搞儯鍔嶇粈鈧悗娑欑箖缁绘繈濮€閵忊€虫畬缂備礁顦遍幊鎾伙綖韫囨稒鎯為悷娆忓閻濅即姊洪崷顓犲笡閻㈩垪鏅犲畷婵囧緞瀹€鈧壕钘壝归敐鍛棌闁稿孩鍔欓幃浠嬵敍濠婂啩妲愬Δ鐘靛仦閸ㄦ寧鎱ㄩ埀顒勬煏閸繃鍤囬柛鐐舵硾閳规垿鎮╅懠顑跨驳闂佸憡姊归悧婊呮閻愬瓨鍎熼柕濠忚吂閹锋椽姊虹拠鈥崇€婚柛娑卞灱閸炶埖绻濋悽闈浶涢柛瀣崌瀵爼宕煎顓熺彅濡炪們鍎插畝鎼佸蓟濞戞粎鐤€婵炴垶鐟辩槐鐢电磽娴ｇ瓔鍤欐俊顐ｇ懇婵＄敻宕熼姘敤闂侀潧臎鐏炵偓顔愰梻鍌欐祰椤曟牠宕规导瀛樺亱濠电姴娲ゆ闂佸憡娲﹂崹濂稿极閸愵喗鐓忛煫鍥ь儏閻忣噣鏌涢弮鎴濈仩闁宠鍨块、娆戞兜闁垮鏆版繝纰夌磿閸嬫鍒掑▎鎾村仒妞ゆ洍鍋撴鐐叉喘椤㈡﹢鎮㈠畡鏉课ら梻鍌欑窔濞佳呮崲閹烘挸鍨旀い鎾跺€ｉ敐澶婄闁绘劏鏅滈弬鈧梻浣虹帛閸旀浜稿▎鎾崇闁绘鏁哥壕鍏笺亜閺冣偓閸庤櫕鐗庣紓鍌欑閸婂摜绮旈幘顔光偓锕傚Ω閳轰線鍞跺銈嗗姧缁叉儳鈻嶉弮鍫熲拻濞达絿鎳撻婊呯磼鐠囨彃鈧摜鍙呴梺鎸庢閺侇噣宕戦幘鎰佹僵妞ゆ挾濯弳锛勭磽娴ｈ櫣甯涢柣鈺婂灠椤曪綁宕奸弴鐐殿吅濡炪倖鎸鹃崑娑欑珶婢跺绻嗛柣鎰典簻閳ь兙鍊濆畷鎴﹀礋椤撶姷鐓嬮梺鑽ゅ枛閸嬪﹤顭囬弽銊х鐎瑰壊鍠曠花鍏笺亜閵夈儳澧涚紒缁樼洴楠炲鎮欑€靛憡顓绘俊鐐€栭弻銊╂晝閵壯勫床婵犻潧妫岄弸鏃堟煕椤垵鏋熼柣蹇旀崌濮婅櫣绮欑捄銊ь唹闂佹寧娲忛崹鑺ヤ繆鐎涙ɑ濯寸紒顖涙礃閻庡姊虹憴鍕姢缁剧虎鍙冮、娆愮節閸ャ劉鎷洪梺鑽ゅ枑婢瑰棝骞楅悩铏弿濠电姴鍊荤粔铏光偓娈垮櫘閸撶喖宕洪埀顒併亜閹烘垵顏柍閿嬪灴閺屾盯鏁傜拠鎻掔闂佸憡鏌ㄩ鍛村煘閹达附鍊烽悹鍥囧啩绱ｉ梻浣风串缁插潡宕楀鈧悰顕€宕堕鈧痪褔鎮归幁鎺戝闁哄鎮傚缁樻媴閸涘﹥鍎撳銈忕畱閸熷潡鍩㈤弮鍫濆嵆闁靛繆鍓濆▍鏍р攽閻愭潙鐏熼柛銊︽そ閸╂盯骞嬮敂鐣屽幗闂佺粯鏌ㄩ幉锛勬閺屻儲鐓冮梺鍨儐閳锋帞绱掓潏銊ユ诞妞ゃ垺宀稿畷銊╊敇閻樿鲸顢橀梻鍌欐祰椤曟牠宕抽婊勫床婵犻潧妫崵鏇㈡煙缂併垹鏋涙い顐㈡嚇閺屻劌鈽夊Ο渚患濡ょ姷鍋為〃鍡欐崲濠靛牆鏋堟俊顖涙た濞兼垿姊洪幖鐐插闁告濞婇悰顕€寮介褎鏅濋梺鎸庢磵閸嬫挻鎱ㄧ憴鍕弨婵﹥妞介、妤呭焵椤掑倻鐭撻柣銏犳啞閸嬪倿鏌￠崶鈺佹灁缂佲檧鍋撻梻鍌氬€搁悧濠囧礃婵犳艾缁╃紓浣骨滄禍婊堢叓閸ャ劍绀€闁宠鐗撻弻锛勪沪閻ｅ睗銉︺亜瑜岀欢姘跺蓟濞戙垹绠婚柡澶嬪灥閹介潧顪冮妶鍐ㄧ仾闁荤啿鏅涢锝嗙鐎ｅ灚鏅ｉ梺缁樺姉閺佺鐣烽懜鐢电瘈鐎典即鏀卞姗€鍩€椤掍焦宕岄柟铏殜瀹曟粍鎷呮潪鎵憹闂備浇顕栭崹搴ㄥ焵椤掑嫬缁╁ù鐘差儐閻撶喐淇婇姘儓缂佺嫏鍥ㄧ厱閻忕偠顕ф慨鍌炴煛鐏炵晫啸妞ぱ傜窔閺屾稖绠涢弮鍌樷偓鎺旂磼椤旇偐澧涢柟宄版嚇閹墽浠﹂懖鈺勫厭闂傚倸鍊搁崐椋庣矆娓氣偓楠炲鍩勯崘顏嗘嚌濠德板€曢幊搴ㄥ磼閵娿儙鏃堟晲閸涱厼缍嗛梺鎼炲労閸撴瑧鐥缁绘盯宕卞▎蹇庡闁诲酣娼ч惌鍌氼潖濞差亝顥堟繛鎴炶壘椤ｅ搫鈹戦埥鍡椾簼妞ゃ劌锕獮鍐潨閳ь剙鐣烽敓鐘冲€烽柍鍝勫€归弶鍛婁繆閻愵亜鈧牠寮婚妸鈺佺妞ゆ劧绠戦悞鍨亜閹哄秶璐版繛鍫熺矒閺屾盯鍩為幆褌澹曞┑锛勫亼閸婃牜鏁繝鍌ゆ富闁圭儤鎸鹃々鏌ユ煏韫囧ň鍋撻懠顒傜暰婵＄偑鍊栭崝鎴﹀垂瑜版帩鏁傛い鎾卞灪閻撴洟鏌嶉崫鍕殭濞寸姾椴搁〃銉╂倷瀹割喖鍓堕梺杞扮閸婂潡骞愭繝鍐ㄧ窞闁糕剝銇炴竟鏇㈡⒑缂佹ê鐏卞┑顔哄€濆畷鎰板垂椤愩倗顔曢梺鐟邦嚟閸庢劖绂掗悙顑句簻闊洦鎸炬晶娑欍亜閵夈儺妲洪柍褜鍓欑粻宥夊磿闁单鍥ㄥ閺夋垹鍘遍梺纭呮彧闂勫嫰鎮￠悩鍨枑闁绘鐗嗙粭鎺懨瑰鍛暭缂佺粯鐩畷妤呮偂鎼粹槅娼氶梻浣告惈閺堫剛绮欓幒妤€绠氶柡鍐ㄧ墛閺咁剟鏌涢弴鐐差暢缂佲偓婵犲洦鈷掑ù锝呮啞閸熺偤鏌ｉ悢鏉戝姦妤犵偛锕よ灒濞撴凹鍨辩紞搴♀攽閻愬弶鈻曞ù婊勭箞钘熼柛顐ゅ枔缁犻箖鏌熺€电浠╁瑙勆戦妵鍕晲閸涱喗鍎撻梺瀹狀潐閸ㄥ潡宕洪妷鈺佸耿婵＄偛澧介崙褰掓⒒娴ｅ搫鍔﹂柡鍛櫊瀹曞綊鎳滈崗鍝ョ畾闂佸湱铏庨崰鏍ь啅濠靛鐓涘璺侯儏閻忊晠鏌ｉ幘鏉戠仸缂佺粯绻堟慨鈧柨婵嗘閵嗘劙姊哄ú璇插闁靛牊鎮傞獮鍡樼瑹閳ь剙鐣锋總鍛婂亜闁惧繐婀卞Σ鍥⒒娴ｅ湱婀介柛銊ㄦ椤洩顦查柣鈽嗗弮濮婄粯鎷呮笟顖滃姼闂佹寧娲忛崕鐢哥嵁閸愵喖纾奸柣鎰典簴閸嬫挻绗熼埀顒€顕ｉ鈧畷鐓庮熆椤忓倸濮傞柡灞炬礃瀵板嫭绻濋崒娑欘啀闂備胶顢婂▍鏇㈠箲閸ヮ剙鐏抽柨鏇炲€告儫闂佸疇妗ㄩ懗鍫曀囬弶娆炬富闁靛牆妫欑亸闈涒攽椤旀儳鍘寸€规洏鍨归…銊╁醇閻斿弶瀚藉┑鐐舵彧缁蹭粙骞夐敓鐘茬畾闁割偁鍎查崑鐘虫叏濡厧甯跺ù婊勫閳ь剝顫夊ú妯兼崲閸儳宓侀悗锝庝簴閺€浠嬫煙闁箑澧い鎾村娣囧﹪鎮欓鍕ㄥ亾閺嶎灐鍝勵吋婢跺﹦锛涢梺瑙勫劤閻忓牓宕戦幘鑸靛枂闁告洦鍓涢ˇ銊╂煟閵忊晛鐏￠悽顖ょ節閺佹劙鎮欏ù瀣杸闁诲函绲介悘姘跺疾濠靛鈷戦梻鍫熺〒缁犳岸鏌￠崨顔剧煉閽樼喖鏌ㄩ悢鍝勑ｉ柍閿嬪浮閺屾稓浠﹂幑鎰棟闂侀€炲苯澧存い銉︽尵閸掓帡宕奸悢铏规嚌闂侀€炲苯澧撮柣娑卞櫍瀵粙顢樿閺呮繈姊洪搹顐㈠姸濠殿喓鍊濋幆鍕敍閻愵亖鍋撴担鍓叉建闁逞屽墯閹便劑鍩€椤掑嫭鐓熸俊顖涙た閸熷繑淇婇懠璺虹厫缂佺粯绻堥幃浠嬫濞戞鎹曟繝纰樻閸嬪懘鎮烽埡鍛祦闁圭増婢樼粻鐟懊归敐鍥ㄥ殌濞存粍顨呴埞鎴︻敊婵劒绮堕梺绋款儐閹瑰洭寮婚垾宕囨殕闁逞屽墴瀹曚即骞囬澶屽姺闂婎偄娲︾粙鎴犵矆閸垺鍠愰煫鍥ㄧ☉濮规煡鏌ｅΟ鑲╁笡闁抽攱鍨圭槐鎾存媴婵埈浜炵划顓烆潩椤撴繄绠氶梺缁樺姈婢瑰棝鎯屽▎鎴斿亾濞堝灝鏋︽い鏇嗗洤鐓″鑸靛姇椤懘鏌ｅΟ鍏兼毄闁哄鎮傚缁樼瑹閳ь剙顭囪閳ワ箓顢橀姀鈾€鎸冮梺鍛婃处閸ㄩ亶宕戦悢鍏肩厸鐎广儱楠告禍鐐电棯閹规劖顥夐棁澶愭煥濠靛棙鍣规い銉ョ箻閺屾稒鎯旈敍鍕唹缂備胶绮粙鎾寸閿曞倸纾兼慨姗堢到娴滅偓绻濋棃娑卞剰闁诲繑濞婇弻锟犲礃閵娧冾暫缂備讲鍋撻柛鎰ㄦ杺娴滄粓鏌￠崒娑橆嚋妞ゎ偄绉堕幉鎼佸籍閸繆鎽曞┑鐐村灟閸ㄥ綊鎮炲ú顏呯厱闊洦娲栭灞矫瑰鍛槐鐎规洜澧楃换婵嬪磼閵堝懏鍊┑鐘灱濞夋盯顢栭崒鐐茬婵炲樊浜濋埛鎺楁煕鐏炵偓鐨戝褎绋撶槐鎺斺偓锝庡亝鐏忎即鏌￠崨顓犲煟濠殿喒鍋撻柟楦挎珪缁傚秴顭ㄩ崟鈺€绨婚梺瑙勫礃濞夋稒绂掕椤儻顧傜紒鐘虫崌瀵鎮㈢喊杈ㄦ櫔闂侀€炲苯澧扮紒顔碱煼瀵粙顢橀悙鐢垫毇婵犵數濮撮敃銈夊箠閹邦厹浠氶柟鎯板Г閸婄敻鏌ㄥ┑鍡涱€楀ù婊勭箖缁绘盯宕ㄩ鐕佹＆濠殿喖锕︾划顖炲箯閸涙潙宸濆┑鐘插€瑰▓妯衡攽閻愬瓨灏扮痪鏉跨Ч閵嗗啯绻濋崒婊勬婵炴潙鍚嬪娆撳礃閳ь剙顪冮妶鍡樺瘷闁告洦鍓氶悵鏃堟⒒閸屾瑨鍏岄柟铏尰閺呭爼鎮剧仦钘夌亰濡炪倖鐗滈崑娑㈡偂閺囥垺鐓欓弶鍫ョ畺濡绢噣鏌ｉ幘瀛樼缂佺粯鐩獮瀣倻閸パ冨絾闂備礁鎲″濠氬窗閺嶎厼钃熺€广儱顦扮€电姴顭块懜鐬垶鏅ラ梻鍌欑窔濞佳兠洪妶鍥ｅ亾濮橆偄宓嗛柕鍡曠铻ｆ繛鍡欏亾浜涙繝鐢靛Л閹峰啴宕橀幆褎顔嶉梻渚€鈧偛鑻晶鍙夈亜椤愩埄妲搁悡銈夋煥閺囩偛鈧摜绮堥崼銉︾厽闁哄啫鍋嗛崕鐘绘煃瑜滈崗娑氭濮橆剦鍤曢柟缁㈠枛椤懘鏌嶉埡浣告殲闁绘繃娲熷娲嚒閵堝懏鐎鹃梺鑽ゅ枙娴滎剙顕ユ繝鍥х鐟滃宕戦幘鎰佹僵妞ゆ劑鍊楅悡鎾斥攽椤旂》鍔熺紒顕呭灦楠炲繘宕ㄩ鍓ф嚌濡炪倖鐗楃划灞炬叏婵傚憡鈷掑ù锝呮啞閹牓鏌ｅΔ浣虹煉鐎规洘绮撻幃銏ゆ偂鎼达絿鏆梻浣圭湽閸娿倝宕归悡骞喖宕熼娑氬弮濠碘槅鍨靛畷鐢电不閻愮儤鐓涢悘鐐额嚙婵倻鈧鍠楅幐鎶藉箖濞嗗緷鍦偓锝庝簷婢规洟鎮峰鍛暭閻㈩垱顨婂畷鎴﹀磼濞戞氨顔曢梺绯曞墲钃遍悘蹇庡嵆閺屾稓鈧絽澧庣粔顕€鏌＄仦鍓ф创濠碉紕鍏樻俊鐑芥晜閼恒儱鈧兘姊绘担渚敯婵炲懏娲熷畷婵嗏枎閹捐櫕鐎悗骞垮劚椤︿即宕戦崟顖涚叄闊洦鎸荤拹锟犳煥濞戞瑧绠栫紒缁樼洴楠炴澹曠€ｎ亶妫熸繝鐢靛仜閻即宕愬┑鍡╁殨闁归棿鐒﹂崑鍕煕韫囨艾浜归柛妯圭矙濮婅櫣绱掑Ο鑽ゅ弳閻庢鍠涘▔娑㈠煝瀹ュ棛绡€闁搞儯鍔庨崢钘夆攽閻愭潙鐏ョ€规洦鍓熷绋库槈閵忊剝鍤夐梺鎸庣箓椤︿即宕愰崼鏇犲彄闁搞儯鍔嶉埛鎺戭熆瑜滄禍婊堟箒濠电姴锕ら幊搴㈢閸撗呯＜缂備焦顭囧ú瀛橆殽閻愬樊鍎旈柟顔界矒瀹曢亶寮撮悩娈挎Н闂傚倸鍊烽懗鍫曘€佹繝鍥х妞ゅ繐鐗婇埛鏃堟煕閺囥劌鐏犵痪鎯ь煼閺岋綁寮崶銉㈠亾閳ь剟鏌涚€ｎ偅宕岄柟顔惧厴瀵泛鈻庨崣銉ф／婵犵數濮伴崹濠氬箠閹炬椿鏁勫璺侯煬閸ゆ洟鏌曟繝蹇擃洭妞も晝鍏橀幃妤呮晲鎼存繄鏁栧銈嗘煥閿曨亜顫忛搹瑙勫枂闁告洦鍋勬慨绋库攽閳藉棗浜滈悗姘煎枟缁旂喖寮存幊娴滃綊鏌熼悜妯诲暗闁告ɑ鎮傚娲箹閻愭彃濮岄梺绋块叄娴滃爼骞冨鈧崺锟犲川椤旀儳骞楅梻渚€娼ч悧鍡橆殽閹间礁鍑犳繛鎴欏灪椤ュ棗顭块懜闈涘闁绘挾鍠栭弻鐔煎箲閹邦厾褰ч梺鍦缂嶄線寮婚悢鍏煎仼閻忕偠袙閺嬪懘姊洪崫鍕拱缂佸甯￠獮鍡涘籍閸繍娼婇梺鍐叉惈閸婂寮惰ぐ鎺撯拻濞达絽鎲￠幆鍫ユ煛閸偄澧撮柟顖氬椤㈡盯鎮欓浣镐壕濞撴埃鍋撶€殿喗鎸虫慨鈧柣妯荤垹閸ャ劎鍘卞┑鐐村灥瀹曨剟寮搁妶澶嬬厓鐟滄粓宕滈敃鍌氬偍闁伙絽鏈畷鍙夌箾閹寸偛鐒归柛瀣尭閳藉鈻庡Ο鐓庡Ш闂備焦妞块崢濂割敄閸モ晜顫曢柟鐑橆殢閺佸﹪鏌ら幁鎺戝姎缁剧偓濞婇幃妤€鈻撻崹顔界亪濡炪値鍘鹃崗妯侯嚕椤愶箑绠荤紓浣姑禍褰掓⒑閼测斁鎷￠柛鎾寸懇閸┾偓妞ゆ帒鍊告禒婊勩亜椤忓嫬鏆ｅ┑陇鍩栭幆鏃堝灳瀹曞浂鍟堥梻鍌欑劍閹爼宕濆畝鍕亯濠靛倻顭堢粻鏍旈敐鍛殲闁搞倕顑夐弻锝夊閵忊剝姣勫銈嗘⒐濞茬喖寮婚敐鍡樺劅闁靛繆鎳囨慨鍥ь渻閵堝骸骞栨繛宸弮楠炲棗鐣濋崟顐ゎ唺闂佸搫鍟崐濠氭晬濠婂牊鈷戠紓浣光棨椤忓棗顥氭い鎾跺枑濞呯姵銇勮箛鎾村櫡濞存粍绮嶉妵鍕箛閳轰胶浼勭紓浣哄С閸楁娊骞冮敓鐘参ч柛鈩冨姃缁ㄥ妫呴銏″闁瑰憡鎮傞、鏃囶槾缂佽鲸甯″畷锟犳倷闂堟稓鍘芥繝娈垮枛閿曘儱顪冮挊澶屾殾闁靛濡囩弧鈧梺鍛婂姦閻撳牆危闁秵鈷掑ù锝呮啞閸熺偞銇勯鐐村枠鐎规洘鍨块獮姗€宕瑰☉妯瑰闂傚倸鐗婄粙蹇涘磻閵忊懇鍋撶憴鍕闁绘牕銈搁妴浣肝旀担鐟邦€撻梺鍛婄懃椤︻垶顢旇ぐ鎺撯拻闁稿本鐟чˇ锕傛煙鐠囇呯？缂傚倹鎹囧畷绋课旈埀顒傚閸ф绾ч柛顐ｇ☉婵″灝顭胯缁绘繂顫忔繝姘＜婵炲棙鍩堝Σ顔尖攽閻橆偄浜鹃梻渚囧墮缁夊绮婚悩缁樼厵闁硅鍔楄ⅵ濠电偛妯婃禍鍫曞极閸ヮ剚鐓忛煫鍥堥崑鎾诲礂閸涱垶鎸兼繝纰夌磿閸嬫垿宕愰弽顬稒鎷呯化鏇熺亙闂佸搫娲㈤崹娲磻椤忓牊鐓冪憸婊堝礈濞嗘挸鐓橀柟杈鹃檮閸婄兘鏌℃径瀣仼濞寸姵鎮傚娲嚒閵堝懏鐎梺绋挎唉鐏忔瑧鍒掔€ｎ亶鍚嬮柛顐ｇ◥濮规姊洪崷顓炲妺闁规悂绠栧畷銏＄鐎ｎ偀鎷虹紓鍌欑劍閳笺倝顢旈崟闈涙闂佸憡鎸烽懗鍫曟儗濮樿埖鐓曠憸搴ㄣ€冮崱娑樼９闁割偅娲滈崣鎾绘煕閵夛絽濡介柍閿嬪浮閺岀喖宕橀崣澶婄獩闂侀€炲苯澧叉い顐㈩槸鐓ゆ俊顖氬悑瀹曟煡鏌涢鐘插姢鐎规挷鐒﹂幈銊ヮ渻鐠囪弓澹曟俊鐐€戦崹娲偡瑜旈獮澶愬箻椤旇姤娅滈梺绯曞墲椤ㄥ繑瀵奸弽顓熲拻闁稿本鑹鹃埀顒勵棑缁牊绗熼埀顒勭嵁婢舵劖鏅柛鏇ㄥ幘閻撴捇姊虹涵鍛涧闂傚嫬瀚板鎻掆攽鐎ｎ偆鍘梺鍓插亝缁诲啴藟閻愮儤鐓曟繛鍡楃箳缁犲鏌＄仦璇插鐎殿喗娼欒灃闁逞屽墯缁傚秵銈ｉ崘鈹炬嫽闂佹悶鍎滅仦鎷樠呯磽娴ｈ櫣甯涚紒璇插暟閹广垹鈹戠€ｎ亞锛滃┑鐐村灦钃辨い蹇曞Т閳规垿鎮欏顔兼婵犵數鍋愰崑鎾寸箾鐎涙鐭婇柣鏍帶椤曪絾绻濆顓炰簻缂佺偓濯芥ご鎼佸疾閳哄懏鈷戦柤鎭掑剭椤忓煻鍥ㄧ鐎ｎ亞鍔﹀銈嗗笂閼冲爼鎯岀€ｎ喗鐓忛柛銉戝喚浼冮梺杞扮閸熸挳宕洪埀顒併亜閹烘垵顏撮柡浣割儐閵囧嫰骞樼捄鐩掞絾銇?{ext}]`;
    };

    const xmlFragmentToRenderableText = (xml = '', mediaMap = new Map(), imageBucket = [], q = '') => {
        const parts = [];
        const source = String(xml || '');

        source.replace(
            /<m:oMathPara[\s\S]*?<\/m:oMathPara>|<m:oMath[\s\S]*?<\/m:oMath>|<(?:w:drawing|w:object)\b[\s\S]*?<\/(?:w:drawing|w:object)>|<v:imagedata\b[^>]*\/>|<o:OLEObject\b[^>]*\/>|<(?:w:t|m:t|w:instrText|w:delText)\b[^>]*>([\s\S]*?)<\/(?:w:t|m:t|w:instrText|w:delText)>|<w:tab\s*\/>|<w:br\s*\/>|<m:chr[^>]*m:val=["']([^"']+)["'][^>]*\/>/g,
            (match, textNode, mathChar) => {
                if (match.startsWith('<m:oMath')) {
                    const latex = ommlToLatex(match);
                    if (latex) parts.push(latex);
                    return '';
                }

                if (match.startsWith('<w:drawing') || match.startsWith('<w:object') || match.startsWith('<v:imagedata') || match.startsWith('<o:OLEObject')) {
                    const rids = extractRelationshipIdsFromXml(match);
                    const displayableRid = rids.find(rid => mediaMap.get(rid)?.displayable && mediaMap.get(rid)?.url);
                    const fallbackRid =
                        displayableRid ||
                        rids.find(rid => /^(wmf|emf)$/i.test(mediaMap.get(rid)?.ext || '')) ||
                        rids.find(rid => mediaMap.get(rid));

                    const token = makeDocxImageToken(fallbackRid, mediaMap, imageBucket, q);
                    if (token) parts.push(token);
                    return '';
                }

                if (match.startsWith('<w:tab')) {
                    parts.push(' ');
                    return '';
                }

                if (match.startsWith('<w:br')) {
                    parts.push('\n');
                    return '';
                }

                if (mathChar) {
                    parts.push(mathChar);
                    return '';
                }

                const text = decodeXmlEntitiesSafe(textNode || '');
                if (text) parts.push(text);
                return '';
            }
        );

        return normalizeDocxText(parts.join(' '));
    };

    const extractTextFromXmlFragment = (xml = '') => {
        return xmlFragmentToRenderableText(xml, new Map(), [], '');
    };

    const splitDocxParagraphs = (documentXml = '') => {
        const paragraphs = [];

        String(documentXml || '').replace(/<w:p[\s\S]*?<\/w:p>/g, (pXml) => {
            const text = extractTextFromXmlFragment(pXml);
            const hasObject = /<w:object\b|<w:drawing\b|<v:imagedata\b|<o:OLEObject\b/.test(pXml);

            if (text || hasObject) {
                paragraphs.push({
                    text,
                    rawXml: pXml,
                    hasObject
                });
            }

            return '';
        });

        return paragraphs;
    };

    const getQuestionNoFromLine = (
        line = ''
    ) => {
        return parseLeadingQuestionMarker(
            line
        ).questionNumber;
    };
    const buildQuestionBlocksFromDocumentXml = (documentXml = '') => {
        const paragraphs = splitDocxParagraphs(documentXml);
        const blocks = [];
        let current = null;

        for (const p of paragraphs) {
            const qNo = getQuestionNoFromLine(p.text || '');

            if (qNo) {
                if (current) blocks.push(current);

                current = {
                    q: qNo,
                    lines: [p.text || ''],
                    rawXmlParts: [p.rawXml || '']
                };
            } else if (current) {
                current.lines.push(p.text || '');
                current.rawXmlParts.push(p.rawXml || '');
            }
        }

        if (current) blocks.push(current);

        console.groupCollapsed('[BATCH_IMPORTER][docx-blocks]');
        console.log('paragraphCount =', paragraphs.length);
        console.log('blockCount =', blocks.length);
        console.table(blocks.map(block => ({
            q: block.q,
            textLen: block.lines.join('\n').length,
            head: block.lines.join('\n').slice(0, 160)
        })));
        console.groupEnd();

        return blocks;
    };

    const buildQuestionSkeletonFromBlocks = (blocks = []) => {
        const entries = (blocks || [])
            .map((block, index) => {
                const rawQuestionNumber =
                    normalizeDocxText(block?.q || '');

                const match =
                    rawQuestionNumber.match(/\d{1,3}/);

                if (!match) return null;

                const numericQuestionNumber =
                    Number(match[0]);

                if (
                    !Number.isInteger(numericQuestionNumber) ||
                    numericQuestionNumber <= 0
                ) {
                    return null;
                }

                return {
                    questionNumber:
                        String(numericQuestionNumber),
                    order: index + 1,
                    textHead: String(
                        block?.lines?.join('\n') || ''
                    ).slice(0, 240)
                };
            })
            .filter(Boolean);

        const numericNumbers = entries.map(entry =>
            Number(entry.questionNumber)
        );

        const uniqueNumbers = [
            ...new Set(numericNumbers)
        ];

        const noDuplicates =
            uniqueNumbers.length === numericNumbers.length;

        const strictlyIncreasing =
            numericNumbers.every((value, index) =>
                index === 0 ||
                value > numericNumbers[index - 1]
            );

        const contiguous =
            numericNumbers.every((value, index) =>
                index === 0 ||
                value === numericNumbers[index - 1] + 1
            );

        const authoritative =
            entries.length >= 2 &&
            noDuplicates &&
            strictlyIncreasing &&
            contiguous;

        let reason = 'ok';

        if (!entries.length) {
            reason =
                'no-explicit-question-markers';
        } else if (entries.length < 2) {
            reason =
                'too-few-explicit-question-markers';
        } else if (!noDuplicates) {
            reason =
                'duplicate-question-numbers';
        } else if (!strictlyIncreasing) {
            reason =
                'question-numbers-not-increasing';
        } else if (!contiguous) {
            reason =
                'question-numbers-not-contiguous';
        }

        return {
            authoritative,
            questionNumbers:
                entries.map(
                    entry =>
                        entry.questionNumber
                ),
            entries,
            diagnostics: {
                reason,
                entryCount: entries.length,
                noDuplicates,
                strictlyIncreasing,
                contiguous
            }
        };
    };

    const extractDocxQuestionSkeleton = async (
        fileRecord
    ) => {
        if (!fileRecord?.uploadPath) {
            throw new Error(
                'DOCX question skeleton extraction missing uploadPath.'
            );
        }

        const zip =
            await loadDocxZip(fileRecord);

        const {
            documentXml
        } = await readDocxCoreXml(zip);

        if (!documentXml) {
            throw new Error(
                'DOCX missing word/document.xml.'
            );
        }

        const blocks =
            buildQuestionBlocksFromDocumentXml(
                documentXml
            );

        const skeleton =
            buildQuestionSkeletonFromBlocks(blocks);

        console.groupCollapsed(
            '[BATCH_IMPORTER][docx-question-skeleton]'
        );

        console.log({
            filename: fileRecord?.filename || '',
            authoritative:
                skeleton.authoritative,
            questionNumbers:
                skeleton.questionNumbers,
            diagnostics:
                skeleton.diagnostics
        });

        console.table(
            skeleton.entries.map(entry => ({
                order: entry.order,
                questionNumber:
                    entry.questionNumber,
                textHead:
                    entry.textHead
            }))
        );

        console.groupEnd();

        return skeleton;
    };

    const cleanOptionText = (text = '', helpers = {}) => {
        const cleanDisplayTextForBatchSave = helpers.cleanDisplayTextForBatchSave || ((x) => String(x || '').trim());

        return cleanDisplayTextForBatchSave(String(text || '')
            .replace(/\s+/g, ' ')
            .trim()
        );
    };

    const optionCount = (options = []) =>
        Array.isArray(options)
            ? options.filter(x => String(x || '').trim()).length
            : 0;

    const parseInlineTextOptions = (blockRawXml = '', helpers = {}) => {
        const textNodes = [];

        String(blockRawXml || '').replace(/<(?:w:t|m:t|w:instrText|w:delText)\b[^>]*>([\s\S]*?)<\/(?:w:t|m:t|w:instrText|w:delText)>/g, (_, textNode) => {
            const text = decodeXmlEntitiesSafe(textNode || '')
                .replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                .replace(/\u00A0/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            if (text) textNodes.push(text);
            return '';
        });

        const joined = (textNodes.length ? textNodes.join(' ') : String(blockRawXml || ''))
            .replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const labelRe = /(^|[\n\r\s,;闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏃堟暜閸嬫挾绮☉妯诲櫧闁活厽鐟╅弻鐔告綇妤ｅ啯顎嶉梺绋垮椤ㄥ懘鈥︾捄銊﹀磯闁绘垶蓱閹峰崬顪冮妶搴′簼婵炶尙鍠栧?([A-D])\s*(?:[.\uFF0E\u3001\u3002)\uFF09]|(?=\s*(?:\$|\\|\[\[IMAGE:|\[[^\]]+\]|[0-9\u4e00-\u9fffA-Za-z])))/g;
        const hits = [];
        let match;

        while ((match = labelRe.exec(joined)) !== null) {
            const label = String(match[2] || '').toUpperCase();
            hits.push({
                label,
                start: match.index + (match[1] || '').length,
                contentStart: labelRe.lastIndex
            });
        }

        const labels = hits.map(hit => hit.label).join('');
        if (!labels.includes('A') || !labels.includes('B')) return ['', '', '', ''];

        const options = ['', '', '', ''];

        for (let i = 0; i < hits.length; i += 1) {
            const hit = hits[i];
            const idx = hit.label.charCodeAt(0) - 65;
            if (idx < 0 || idx > 3) continue;

            const nextHit = hits[i + 1];
            const raw = joined.slice(hit.contentStart, nextHit ? nextHit.start : joined.length).trim();
            options[idx] = cleanOptionText(raw, helpers);
        }

        return [0, 1, 2, 3].map(idx => options[idx] || '');
    };

    const parseXmlSegmentOptions = (blockRawXml = '', mediaMap = new Map(), helpers = {}, q = '') => {
        const source = String(blockRawXml || '');
        const options = ['', '', '', ''];
        const optionImages = [];
        let hasUndisplayable = false;

        const labelRegex = /<w:t\b[^>]*>\s*([A-D\uFF21-\uFF24])\s*[.\uFF0E\u3001\u3002)\uFF09]\s*<\/w:t>/g;
        const hits = [];
        let match;

        while ((match = labelRegex.exec(source)) !== null) {
            hits.push({
                label: String(match[1] || '')
                    .replace(/[\uFF21-\uFF24]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                    .toUpperCase(),
                start: match.index,
                end: labelRegex.lastIndex
            });
        }

        if (hits.length < 2) {
            return { options, optionImages, hasUndisplayable };
        }

        for (let i = 0; i < hits.length; i += 1) {
            const hit = hits[i];
            const idx = hit.label.charCodeAt(0) - 65;
            if (idx < 0 || idx > 3) continue;

            const nextHit = hits[i + 1];
            const segment = source.slice(hit.end, nextHit ? nextHit.start : source.length);

            const text = extractTextFromXmlFragment(segment);
            const textOption = cleanOptionText(
                text.replace(/^[A-D]\\s*[.\\uFF0E\\u3001\\u3002)\\uFF09]\\s*/i, ''),
                helpers
            );

            if (textOption) {
                options[idx] = textOption;
                continue;
            }

            const rids = extractRelationshipIdsFromXml(segment);
            const displayableRid = rids.find(rid => mediaMap.get(rid)?.displayable && mediaMap.get(rid)?.url);
            const fallbackRid =
                displayableRid ||
                rids.find(rid => /^(wmf|emf)$/i.test(mediaMap.get(rid)?.ext || '')) ||
                rids.find(rid => mediaMap.get(rid));

            if (!fallbackRid) continue;

            const media = mediaMap.get(fallbackRid);

            if (media?.displayable && media.url) {
                const id = `docx_opt_${q || 'q'}_${hit.label}_${optionImages.length}_${Date.now()}`;

                optionImages.push({
                    id,
                    url: media.url,
                    filename: `${id}.${media.ext || 'png'}`,
                    name: `${id}.${media.ext || 'png'}`,
                    source: 'docx-option-object',
                    rid: fallbackRid,
                    ext: media.ext,
                    mime: media.mime,
                    displayable: true
                });

                options[idx] = `[[IMAGE:${id}]]`;
            } else {
                hasUndisplayable = true;
                const ext = media?.ext || 'unknown';
                options[idx] = `[闂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缁炬儳缍婇弻鐔兼⒒鐎靛壊妲紒鐐劤缂嶅﹪寮婚悢鍏尖拻閻庨潧澹婂Σ顔剧磼閻愵剙鍔ょ紓宥咃躬瀵鎮㈤崗灏栨嫽闁诲酣娼ф竟濠偽ｉ鍓х＜闁绘劦鍓欓崝銈囩磽瀹ュ拑韬€殿喖顭烽幃銏ゅ礂鐏忔牗瀚介梺璇查叄濞佳勭珶婵犲伣锝夘敊閸撗咃紲闂佺粯鍔﹂崜娆撳礉閵堝洨纾界€广儱鎷戦煬顒傗偓娈垮枛椤兘寮幇顓炵窞濠电姴瀚烽崥鍛存⒒娴ｇ懓顕滅紒璇插€块獮澶娾槈閵忕姷顔掔紓鍌欑劍椤洭宕㈤柆宥嗏拺闂傚牊绋撴晶鏇㈡煙閸愭煡鍙勬い銏℃椤㈡﹢濮€閿涘嫬骞愰梺璇茬箳閸嬫稒鏅堕挊澹濊櫣鈧稒菧娴滄粓鏌曡箛濠傚⒉缂佲偓鐎ｎ喗鐓涘ù锝囨嚀婵秶鈧娲栧畷顒勫煝鎼粹檧鏋庨柟瀵稿Л閺佸秹姊婚崒姘偓鎼佸磹妞嬪孩顐芥慨妯挎硾閻掑灚銇勯幒鎴濃偓鍛婄濠婂牊鐓犳繛鑼额嚙閻忥繝鏌￠崨顓犲煟鐎规洘绮忛ˇ瀵哥棯閹佸仮闁哄矉绲借灒闁圭娴疯ぐ褔鏌ｈ箛鎾寸闁告瑥鍟村濠氭晲婢跺娅滈梺鎼炲劀閸愩劎顓洪梻鍌欐祰椤曟牠宕伴幒妤€绀堟繝闈涱儏缁犳岸鏌￠崘銊у⒈闁轰礁锕弻鐔碱敍閸℃顏慨锝呭缁绘繈鎮介棃娴躲儵鏌℃担鍛婂暈缂佺粯鐩崺鈧い鎺嶈兌缁犳儳霉閿濆懎鏆辨繛璇х畵瀹曟垹鈧綆浜栭弨浠嬫煟濡搫绾ч柟鍏煎姍閺屾稑顫濋鍌溞ㄩ梺鍝勮嫰缁夌兘篓娓氣偓閺屾盯骞樼€靛憡鍣伴梺鐐藉劜濡啫鐣峰鈧、娆撳床婢诡垰娲ょ粻鍦磼椤旂厧甯ㄩ柛瀣崌閹崇娀顢楅埀顒勫吹椤掑倻纾介柛灞捐壘閳ь剙鍢查湁闁搞儺鍓﹂弫瀣喐韫囨稑鐒垫い鎺嶈兌閻擃垶鏌涘Δ浣糕枙闁诡喕鍗抽、姘跺焵椤掑嫮宓侀悗锝庡枟閺呮繈鏌嶈閸撴稓鍒掗崼鈶╁亾閿濆骸浜栧ù婊勭矒閺屸€愁吋閸愩劌顬嬮梺鎰佸灡濞茬喖寮诲☉娆愬劅妞ゆ柨顭烽崑妤呮⒑閸濆嫮鐒跨紓宥勭窔楠炲啴鍩￠崨顓犵厬婵犮垼娉涢惌鍫澪ｅú顏呪拻濞达絽鎲￠崯鐐烘煙濮濆苯鍚归柟骞垮灲瀹曞崬鈽夊Ο纭风串闂備礁鎼ˇ浼村垂閻旂厧缁╁ù鐘差儐閻撶喐淇婇婵囶仩濞寸姵鐩弻锟犲幢韫囨梹鐝旈梺瀹狀潐閸ㄥ潡銆佸▎鎾崇畾鐟滃秹鐛€ｎ喗鍊垫繛鍫濈仢濞呮﹢鏌涚€ｎ亷韬柣娑卞櫍瀵粙濡搁敃鈧鎾绘⒑閸涘﹦缂氶柛搴ゅ吹濡叉劖娼忛妸褏鐦堥梺姹囧灲濞佳勭閿曞倹鐓曢柕濞垮劤閸╋綁鏌嶉妷顖滅暤鐎规洘甯掗～婵嬫晲閸♀晜缍屽┑鐘殿暯濡插懘宕归崼鏇炵哗闂侇剙绉甸崐闈涒攽閻樺磭顣查柍閿嬪灴閹嘲鈻庤箛鎿冧患闂佸憡鏌ｉ崐婵嬪蓟濞戙垺鍋勯梺鍨儏娴犳挳姊虹拠鈥虫灍妞ゃ劌锕妴浣割潨閳ь剚鎱ㄩ埀顒勬煃闁款垰浜鹃梺褰掓敱濡炶棄顫忓ú顏勫窛濠电姴鍟棄宥夋偡濠婂嫭绶查柛鐕佸灣缁顓奸崨顏呮杸闂佹悶鍎弲婵嬵敊閺囩偐鏀介柣鎰摠缂嶆垶銇勯幋婵囶棞闁宠绉瑰畷鍫曞煛閸愵亷绱查梺鍝勵槸閻楀啴寮插☉娆戭浄閺夊牃鏂侀崑鎾斥枔閸喗鐏嗙紓渚囧枟閻熲晠濡存担鍓叉建闁逞屽墴楠炲啴濮€閵堝懍绱堕梺鍛婃处閸嬪棝顢欓崶顒佲拻闁稿本鑹鹃埀顒傚厴閹偤鏁冮崒姘辩暫闂佸壊鍋呭ú鏍閹稿簺浜滈柡宥庡亜娴犳粎鐥幆褎鍋ユ慨濠冩そ椤㈡鍩€椤掑倻鐭撻柣銏㈩焾绾惧綊鏌ら崫銉ヤ化濞存粍绮撻悡顐﹀炊閵婏箑鏆楁繝鈷€鍕创闁哄矉缍侀獮妯兼崉閻戞浜梻浣告惈閻ジ宕伴弽顓犲祦闁糕剝鍑瑰Σ濠氭⒑閼测晩鐒剧紓宥咃躬瀵鈽夐姀鐘电潉闂佽鍎虫晶搴ㄥ汲閵堝鈷戦柛婵嗗椤︻剟鏌嶈閸撴瑧澹曢銏犳辈闁糕剝绋掗崐鐢告煥濠靛棝顎楀褎澹嗛幃顕€鏁冮崒娑氬幗闁瑰吋鐣崺鍕疮韫囨稒鐓曢柨婵嗛濞呭秶鈧娲樼划鎾诲箖閵忋倖鍤冮柍杞拌兌閵堬箓姊绘担鍝ョШ闁稿锕畷銏＄鐎ｎ亞锛熼梺缁樻煥閸氬鎮¤箛娑氬彄闁搞儯鍔嶇粈鈧悗娑欑箖缁绘繈濮€閵忊€虫畬缂備礁顦遍幊鎾伙綖韫囨稒鎯為悷娆忓閻濅即姊洪崷顓犲笡閻㈩垪鏅犲畷婵囧緞瀹€鈧壕钘壝归敐鍛棌闁稿孩鍔欓幃浠嬵敍濠婂啩妲愬Δ鐘靛仦閸ㄦ寧鎱ㄩ埀顒勬煏閸繃鍤囬柛鐐舵硾閳规垿鎮╅懠顑跨驳闂佸憡姊归悧婊呮閻愬瓨鍎熼柕濠忚吂閹锋椽姊虹拠鈥崇€婚柛娑卞灱閸炶埖绻濋悽闈浶涢柛瀣崌瀵爼宕煎顓熺彅濡炪們鍎插畝鎼佸蓟濞戞粎鐤€婵炴垶鐟辩槐鐢电磽娴ｇ瓔鍤欐俊顐ｇ懇婵＄敻宕熼姘敤闂侀潧臎鐏炵偓顔愰梻鍌欐祰椤曟牠宕规导瀛樺亱濠电姴娲ゆ闂佸憡娲﹂崹濂稿极閸愵喗鐓忛煫鍥ь儏閻忣噣鏌涢弮鎴濈仩闁宠鍨块、娆戞兜闁垮鏆版繝纰夌磿閸嬫鍒掑▎鎾村仒妞ゆ洍鍋撴鐐叉喘椤㈡﹢鎮㈠畡鏉课ら梻鍌欑窔濞佳呮崲閹烘挸鍨旀い鎾跺€ｉ敐澶婄闁绘劏鏅滈弬鈧梻浣虹帛閸旀浜稿▎鎾崇闁绘鏁哥壕鍏笺亜閺冣偓閸庤櫕鐗庣紓鍌欑閸婂摜绮旈幘顔光偓锕傚Ω閳轰線鍞跺銈嗗姧缁叉儳鈻嶉弮鍫熲拻濞达絿鎳撻婊呯磼鐠囨彃鈧摜鍙呴梺鎸庢閺侇噣宕戦幘鎰佹僵妞ゆ挾濯弳锛勭磽娴ｈ櫣甯涢柣鈺婂灠椤曪綁宕奸弴鐐殿吅濡炪倖鎸鹃崑娑欑珶婢跺绻嗛柣鎰典簻閳ь兙鍊濆畷鎴﹀礋椤撶姷鐓嬮梺鑽ゅ枛閸嬪﹤顭囬弽銊х鐎瑰壊鍠曠花鍏笺亜閵夈儳澧涚紒缁樼洴楠炲鎮欑€靛憡顓绘俊鐐€栭弻銊╂晝閵壯勫床婵犻潧妫岄弸鏃堟煕椤垵鏋熼柣蹇旀崌濮婅櫣绮欑捄銊ь唹闂佹寧娲忛崹鑺ヤ繆鐎涙ɑ濯寸紒顖涙礃閻庡姊虹憴鍕姢缁剧虎鍙冮、娆愮節閸ャ劉鎷洪梺鑽ゅ枑婢瑰棝骞楅悩铏弿濠电姴鍊荤粔铏光偓娈垮櫘閸撶喖宕洪埀顒併亜閹烘垵顏柍閿嬪灴閺屾盯鏁傜拠鎻掔闂佸憡鏌ㄩ鍛村煘閹达附鍊烽悹鍥囧啩绱ｉ梻浣风串缁插潡宕楀鈧悰顕€宕堕鈧痪褔鎮归幁鎺戝闁哄鎮傚缁樻媴閸涘﹥鍎撳銈忕畱閸熷潡鍩㈤弮鍫濆嵆闁靛繆鍓濆▍鏍р攽閻愭潙鐏熼柛銊︽そ閸╂盯骞嬮敂鐣屽幗闂佺粯鏌ㄩ幉锛勬閺屻儲鐓冮梺鍨儐閳锋帞绱掓潏銊ユ诞妞ゃ垺宀稿畷銊╊敇閻樿鲸顢橀梻鍌欐祰椤曟牠宕抽婊勫床婵犻潧妫崵鏇㈡煙缂併垹鏋涙い顐㈡嚇閺屻劌鈽夊Ο渚患濡ょ姷鍋為〃鍡欐崲濠靛牆鏋堟俊顖涙た濞兼垿姊洪幖鐐插闁告濞婇悰顕€寮介褎鏅濋梺鎸庢磵閸嬫挻鎱ㄧ憴鍕弨婵﹥妞介、妤呭焵椤掑倻鐭撻柣銏犳啞閸嬪倿鏌￠崶鈺佹灁缂佲檧鍋撻梻鍌氬€搁悧濠囧礃婵犳艾缁╃紓浣骨滄禍婊堢叓閸ャ劍绀€闁宠鐗撻弻锛勪沪閻ｅ睗銉︺亜瑜岀欢姘跺蓟濞戙垹绠婚柡澶嬪灥閹介潧顪冮妶鍐ㄧ仾闁荤啿鏅涢锝嗙鐎ｅ灚鏅ｉ梺缁樺姉閺佺鐣烽懜鐢电瘈鐎典即鏀卞姗€鍩€椤掍焦宕岄柟铏殜瀹曟粍鎷呮潪鎵憹闂備浇顕栭崹搴ㄥ焵椤掑嫬缁╁ù鐘差儐閻撶喐淇婇姘儓缂佺嫏鍥ㄧ厱閻忕偠顕ф慨鍌炴煛鐏炵晫啸妞ぱ傜窔閺屾稖绠涢弮鍌樷偓鎺旂磼椤旇偐澧涢柟宄版嚇閹墽浠﹂懖鈺勫厭闂傚倸鍊搁崐椋庣矆娓氣偓楠炲鍩勯崘顏嗘嚌濠德板€曢幊搴ㄥ磼閵娿儙鏃堟晲閸涱厼缍嗛梺鎼炲労閸撴瑧鐥缁绘盯宕卞▎蹇庡闁诲酣娼ч惌鍌氼潖濞差亝顥堟繛鎴炶壘椤ｅ搫鈹戦埥鍡椾簼妞ゃ劌锕獮鍐潨閳ь剙鐣烽敓鐘冲€烽柍鍝勫€归弶鍛婁繆閻愵亜鈧牠寮婚妸鈺佺妞ゆ劧绠戦悞鍨亜閹哄秶璐版繛鍫熺矒閺屾盯鍩為幆褌澹曞┑锛勫亼閸婃牜鏁繝鍌ゆ富闁圭儤鎸鹃々鏌ユ煏韫囧ň鍋撻懠顒傜暰婵＄偑鍊栭崝鎴﹀垂瑜版帩鏁傛い鎾卞灪閻撴洟鏌嶉崫鍕殭濞寸姾椴搁〃銉╂倷瀹割喖鍓堕梺杞扮閸婂潡骞愭繝鍐ㄧ窞闁糕剝銇炴竟鏇㈡⒑缂佹ê鐏卞┑顔哄€濆畷鎰板垂椤愩倗顔曢梺鐟邦嚟閸庢劖绂掗悙顑句簻闊洦鎸炬晶娑欍亜閵夈儺妲洪柍褜鍓欑粻宥夊磿闁单鍥ㄥ閺夋垹鍘遍梺纭呮彧闂勫嫰鎮￠悩鍨枑闁绘鐗嗙粭鎺懨瑰鍛暭缂佺粯鐩畷妤呮偂鎼粹槅娼氶梻浣告惈閺堫剛绮欓幒妤€绠氶柡鍐ㄧ墛閺咁剟鏌涢弴鐐差暢缂佲偓婵犲洦鈷掑ù锝呮啞閸熺偤鏌ｉ悢鏉戝姦妤犵偛锕よ灒濞撴凹鍨辩紞搴♀攽閻愬弶鈻曞ù婊勭箞钘熼柛顐ゅ枔缁犻箖鏌熺€电浠╁瑙勆戦妵鍕晲閸涱喗鍎撻梺瀹狀潐閸ㄥ潡宕洪妷鈺佸耿婵＄偛澧介崙褰掓⒒娴ｅ搫鍔﹂柡鍛櫊瀹曞綊鎳滈崗鍝ョ畾闂佸湱铏庨崰鏍ь啅濠靛鐓涘璺侯儏閻忊晠鏌ｉ幘鏉戠仸缂佺粯绻堟慨鈧柨婵嗘閵嗘劙姊哄ú璇插闁靛牊鎮傞獮鍡樼瑹閳ь剙鐣锋總鍛婂亜闁惧繐婀卞Σ鍥⒒娴ｅ湱婀介柛銊ㄦ椤洩顦查柣鈽嗗弮濮婄粯鎷呮笟顖滃姼闂佹寧娲忛崕鐢哥嵁閸愵喖纾奸柣鎰典簴閸嬫挻绗熼埀顒€顕ｉ鈧畷鐓庮熆椤忓倸濮傞柡灞炬礃瀵板嫭绻濋崒娑欘啀闂備胶顢婂▍鏇㈠箲閸ヮ剙鐏抽柨鏇炲€告儫闂佸疇妗ㄩ懗鍫曀囬弶娆炬富闁靛牆妫欑亸闈涒攽椤旀儳鍘寸€规洏鍨归…銊╁醇閻斿弶瀚藉┑鐐舵彧缁蹭粙骞夐敓鐘茬畾闁割偁鍎查崑鐘虫叏濡厧甯跺ù婊勫閳ь剝顫夊ú妯兼崲閸儳宓侀悗锝庝簴閺€浠嬫煙闁箑澧い鎾村娣囧﹪鎮欓鍕ㄥ亾閺嶎灐鍝勵吋婢跺﹦锛涢梺瑙勫劤閻忓牓宕戦幘鑸靛枂闁告洦鍓涢ˇ銊╂煟閵忊晛鐏￠悽顖ょ節閺佹劙鎮欏ù瀣杸闁诲函绲介悘姘跺疾濠靛鈷戦梻鍫熺〒缁犳岸鏌￠崨顔剧煉閽樼喖鏌ㄩ悢鍝勑ｉ柍閿嬪浮閺屾稓浠﹂幑鎰棟闂侀€炲苯澧存い銉︽尵閸掓帡宕奸悢铏规嚌闂侀€炲苯澧撮柣娑卞櫍瀵粙顢樿閺呮繈姊洪搹顐㈠姸濠殿喓鍊濋幆鍕敍閻愵亖鍋撴担鍓叉建闁逞屽墯閹便劑鍩€椤掑嫭鐓熸俊顖涙た閸熷繑淇婇懠璺虹厫缂佺粯绻堥幃浠嬫濞戞鎹曟繝纰樻閸嬪懘鎮烽埡鍛祦闁圭増婢樼粻鐟懊归敐鍥ㄥ殌濞存粍顨呴埞鎴︻敊婵劒绮堕梺绋款儐閹瑰洭寮婚垾宕囨殕闁逞屽墴瀹曚即骞囬澶屽姺闂婎偄娲︾粙鎴犵矆閸垺鍠愰煫鍥ㄧ☉濮规煡鏌ｅΟ鑲╁笡闁抽攱鍨圭槐鎾存媴婵埈浜炵划顓烆潩椤撴繄绠氶梺缁樺姈婢瑰棝鎯屽▎鎴斿亾濞堝灝鏋︽い鏇嗗洤鐓″鑸靛姇椤懘鏌ｅΟ鍏兼毄闁哄鎮傚缁樼瑹閳ь剙顭囪閳ワ箓顢橀姀鈾€鎸冮梺鍛婃处閸ㄩ亶宕戦悢鍏肩厸鐎广儱楠告禍鐐电棯閹规劖顥夐棁澶愭煥濠靛棙鍣规い銉ョ箻閺屾稒鎯旈敍鍕唹缂備胶绮粙鎾寸閿曞倸纾兼慨姗堢到娴滅偓绻濋棃娑卞剰闁诲繑濞婇弻锟犲礃閵娧冾暫缂備讲鍋撻柛鎰ㄦ杺娴滄粓鏌￠崒娑橆嚋妞ゎ偄绉堕幉鎼佸籍閸繆鎽曞┑鐐村灟閸ㄥ綊鎮炲ú顏呯厱闊洦娲栭灞矫瑰鍛槐鐎规洜澧楃换婵嬪磼閵堝懏鍊┑鐘灱濞夋盯顢栭崒鐐茬婵炲樊浜濋埛鎺楁煕鐏炵偓鐨戝褎绋撶槐鎺斺偓锝庡亝鐏忎即鏌￠崨顓犲煟濠殿喒鍋撻柟楦挎珪缁傚秴顭ㄩ崟鈺€绨婚梺瑙勫礃濞夋稒绂掕椤儻顧傜紒鐘虫崌瀵鎮㈢喊杈ㄦ櫔闂侀€炲苯澧扮紒顔碱煼瀵粙顢橀悙鐢垫毇婵犵數濮撮敃銈夊箠閹邦厹浠氶柟鎯板Г閸婄敻鏌ㄥ┑鍡涱€楀ù婊勭箖缁绘盯宕ㄩ鐕佹＆濠殿喖锕︾划顖炲箯閸涙潙宸濆┑鐘插€瑰▓妯衡攽閻愬瓨灏扮痪鏉跨Ч閵嗗啯绻濋崒婊勬婵炴潙鍚嬪娆撳礃閳ь剙顪冮妶鍡樺瘷闁告洦鍓氶悵鏃堟⒒閸屾瑨鍏岄柟铏尰閺呭爼鎮剧仦钘夌亰濡炪倖鐗滈崑娑㈡偂閺囥垺鐓欓弶鍫ョ畺濡绢噣鏌ｉ幘瀛樼缂佺粯鐩獮瀣倻閸パ冨絾闂備礁鎲″濠氬窗閺嶎厼钃熺€广儱顦扮€电姴顭块懜鐬垶鏅ラ梻鍌欑窔濞佳兠洪妶鍥ｅ亾濮橆偄宓嗛柕鍡曠铻ｆ繛鍡欏亾浜涙繝鐢靛Л閹峰啴宕橀幆褎顔嶉梻渚€鈧偛鑻晶鍙夈亜椤愩埄妲搁悡銈夋煥閺囩偛鈧摜绮堥崼銉︾厽闁哄啫鍋嗛崕鐘绘煃瑜滈崗娑氭濮橆剦鍤曢柟缁㈠枛椤懘鏌嶉埡浣告殲闁绘繃娲熷娲嚒閵堝懏鐎鹃梺鑽ゅ枙娴滎剙顕ユ繝鍥х鐟滃宕戦幘鎰佹僵妞ゆ劑鍊楅悡鎾斥攽椤旂》鍔熺紒顕呭灦楠炲繘宕ㄩ鍓ф嚌濡炪倖鐗楃划灞炬叏婵傚憡鈷掑ù锝呮啞閹牓鏌ｅΔ浣虹煉鐎规洘绮撻幃銏ゆ偂鎼达絿鏆梻浣圭湽閸娿倝宕归悡骞喖宕熼娑氬弮濠碘槅鍨靛畷鐢电不閻愮儤鐓涢悘鐐额嚙婵倻鈧鍠楅幐鎶藉箖濞嗗緷鍦偓锝庝簷婢规洟鎮峰鍛暭閻㈩垱顨婂畷鎴﹀磼濞戞氨顔曢梺绯曞墲钃遍悘蹇庡嵆閺屾稓鈧絽澧庣粔顕€鏌＄仦鍓ф创濠碉紕鍏樻俊鐑芥晜閼恒儱鈧兘姊绘担渚敯婵炲懏娲熷畷婵嗏枎閹捐櫕鐎悗骞垮劚椤︿即宕戦崟顖涚叄闊洦鎸荤拹锟犳煥濞戞瑧绠栫紒缁樼洴楠炴澹曠€ｎ亶妫熸繝鐢靛仜閻即宕愬┑鍡╁殨闁归棿鐒﹂崑鍕煕韫囨艾浜归柛妯圭矙濮婅櫣绱掑Ο鑽ゅ弳閻庢鍠涘▔娑㈠煝瀹ュ棛绡€闁搞儯鍔庨崢钘夆攽閻愭潙鐏ョ€规洦鍓熷绋库槈閵忊剝鍤夐梺鎸庣箓椤︿即宕愰崼鏇犲彄闁搞儯鍔嶉埛鎺戭熆瑜滄禍婊堟箒濠电姴锕ら幊搴㈢閸撗呯＜缂備焦顭囧ú瀛橆殽閻愬樊鍎旈柟顔界矒瀹曢亶寮撮悩娈挎Н闂傚倸鍊烽懗鍫曘€佹繝鍥х妞ゅ繐鐗婇埛鏃堟煕閺囥劌鐏犵痪鎯ь煼閺岋綁寮崶銉㈠亾閳ь剟鏌涚€ｎ偅宕岄柟顔惧厴瀵泛鈻庨崣銉ф／婵犵數濮伴崹濠氬箠閹炬椿鏁勫璺侯煬閸ゆ洟鏌曟繝蹇擃洭妞も晝鍏橀幃妤呮晲鎼存繄鏁栧銈嗘煥閿曨亜顫忛搹瑙勫枂闁告洦鍋勬慨绋库攽閳藉棗浜滈悗姘煎枟缁旂喖寮存幊娴滃綊鏌熼悜妯诲暗闁告ɑ鎮傚娲箹閻愭彃濮岄梺绋块叄娴滃爼骞冨鈧崺锟犲川椤旀儳骞楅梻渚€娼ч悧鍡橆殽閹间礁鍑犳繛鎴欏灪椤ュ棗顭块懜闈涘闁绘挾鍠栭弻鐔煎箲閹邦厾褰ч梺鍦缂嶄線寮婚悢鍏煎仼閻忕偠袙閺嬪懘姊洪崫鍕拱缂佸甯￠獮鍡涘籍閸繍娼婇梺鍐叉惈閸婂寮惰ぐ鎺撯拻濞达絽鎲￠幆鍫ユ煛閸偄澧撮柟顖氬椤㈡盯鎮欓浣镐壕濞撴埃鍋撶€殿喗鎸虫慨鈧柣妯荤垹閸ャ劎鍘卞┑鐐村灥瀹曨剟寮搁妶澶嬬厓鐟滄粓宕滈敃鍌氬偍闁伙絽鏈畷鍙夌箾閹寸偛鐒归柛瀣尭閳藉鈻庡Ο鐓庡Ш闂備焦妞块崢濂割敄閸モ晜顫曢柟鐑橆殢閺佸﹪鏌ら幁鎺戝姎缁剧偓濞婇幃妤€鈻撻崹顔界亪濡炪値鍘鹃崗妯侯嚕椤愶箑绠荤紓浣姑禍褰掓⒑閼测斁鎷￠柛鎾寸懇閸┾偓妞ゆ帒鍊告禒婊勩亜椤忓嫬鏆ｅ┑陇鍩栭幆鏃堝灳瀹曞浂鍟堥梻鍌欑劍閹爼宕濆畝鍕亯濠靛倻顭堢粻鏍旈敐鍛殲闁搞倕顑夐弻锝夊閵忊剝姣勫銈嗘⒐濞茬喖寮婚敐鍡樺劅闁靛繆鎳囨慨鍥ь渻閵堝骸骞栨繛宸弮楠炲棗鐣濋崟顐ゎ唺闂佸搫鍟崐濠氭晬濠婂牊鈷戠紓浣光棨椤忓棗顥氭い鎾跺枑濞呯姵銇勮箛鎾村櫡濞存粍绮嶉妵鍕箛閳轰胶浼勭紓浣哄С閸楁娊骞冮敓鐘参ч柛鈩冨姃缁ㄥ妫呴銏″闁瑰憡鎮傞、鏃囶槾缂佽鲸甯″畷锟犳倷闂堟稓鍘芥繝娈垮枛閿曘儱顪冮挊澶屾殾闁靛濡囩弧鈧梺鍛婂姦閻撳牆危闁秵鈷掑ù锝呮啞閸熺偞銇勯鐐村枠鐎规洘鍨块獮姗€宕瑰☉妯瑰闂傚倸鐗婄粙蹇涘磻閵忊懇鍋撶憴鍕闁绘牕銈搁妴浣肝旀担鐟邦€撻梺鍛婄懃椤︻垶顢旇ぐ鎺撯拻闁稿本鐟чˇ锕傛煙鐠囇呯？缂傚倹鎹囧畷绋课旈埀顒傚閸ф绾ч柛顐ｇ☉婵″灝顭胯缁绘繂顫忔繝姘＜婵炲棙鍩堝Σ顔尖攽閻橆偄浜鹃梻渚囧墮缁夊绮婚悩缁樼厵闁硅鍔楄ⅵ濠电偛妯婃禍鍫曞极閸ヮ剚鐓忛煫鍥堥崑鎾诲礂閸涱垶鎸兼繝纰夌磿閸嬫垿宕愰弽顬稒鎷呯化鏇熺亙闂佸搫娲㈤崹娲磻椤忓牊鐓冪憸婊堝礈濞嗘挸鐓橀柟杈鹃檮閸婄兘鏌℃径瀣仼濞寸姵鎮傚娲嚒閵堝懏鐎梺绋挎唉鐏忔瑧鍒掔€ｎ亶鍚嬮柛顐ｇ◥濮规姊洪崷顓炲妺闁规悂绠栧畷銏＄鐎ｎ偀鎷虹紓鍌欑劍閳笺倝顢旈崟闈涙闂佸憡鎸烽懗鍫曟儗濮樿埖鐓曠憸搴ㄣ€冮崱娑樼９闁割偅娲滈崣鎾绘煕閵夛絽濡介柍閿嬪浮閺岀喖宕橀崣澶婄獩闂侀€炲苯澧叉い顐㈩槸鐓ゆ俊顖氬悑瀹曟煡鏌涢鐘插姢鐎规挷鐒﹂幈銊ヮ渻鐠囪弓澹曟俊鐐€戦崹娲偡瑜旈獮澶愬箻椤旇姤娅滈梺绯曞墲椤ㄥ繑瀵奸弽顓熲拻闁稿本鑹鹃埀顒勵棑缁牊绗熼埀顒勭嵁婢舵劖鏅柛鏇ㄥ幘閻撴捇姊虹涵鍛涧闂傚嫬瀚板鎻掆攽鐎ｎ偆鍘梺鍓插亝缁诲啴藟閻愮儤鐓曟繛鍡楃箳缁犲鏌＄仦璇插鐎殿喗娼欒灃闁逞屽墯缁傚秵銈ｉ崘鈹炬嫽闂佹悶鍎滅仦鎷樠呯磽娴ｈ櫣甯涚紒璇插暟閹广垹鈹戠€ｎ亞锛滃┑鐐村灦钃辨い蹇曞Т閳规垿鎮欏顔兼婵犵數鍋愰崑鎾寸箾鐎涙鐭婇柣鏍帶椤曪絾绻濆顓炰簻缂佺偓濯芥ご鎼佸疾閳哄懏鈷戦柤鎭掑剭椤忓煻鍥ㄧ鐎ｎ亞鍔﹀銈嗗笂閼冲爼鎯岀€ｎ喗鐓忛柛銉戝喚浼冮梺杞扮閸熸挳宕洪埀顒併亜閹烘垵顏撮柡浣割儐閵囧嫰骞樼捄鐩掞絾銇?{ext}]`;
            }
        }

        return { options, optionImages, hasUndisplayable };
    };

    const parseOptionsFromBlock = (block, mediaMap, helpers = {}) => {
        const blockRawXml = block.rawXmlParts.join('\n');
        const blockText = block.lines.join('\n');
        const inlineImages = [];

        const renderableText = xmlFragmentToRenderableText(blockRawXml, mediaMap, inlineImages, block.q);

        let options = parseInlineTextOptions(renderableText, helpers);
        if (optionCount(options) >= 2) {
            return {
                options,
                optionImages: inlineImages,
                hasUndisplayable: options.some(opt => /闂佽楠搁悘姘熆濮椻偓楠炲﹪骞樼搾浣哥秺瀹曞崬鈽夊Ο纰卞敼婵＄偑鍊х徊濠氬垂閽樺鏆︽俊銈呮媼閺佸棝鏌嶈閸撴稑危閹扮増鏅搁柣妯垮皺閸婄偤姊洪崨濠冨瘷闁告劗鍋撳В鍧鹃梻鍌欑劍閹爼宕曟潏銊︽珷闁兼亽鍎插▍鐘绘煛瀹ュ骸骞楅柣鎺曨嚙椤潡鎳滈棃娑橆潎闂侀€炲苯澧悘蹇斘爊displayable/i.test(String(opt || ''))),
                source: 'renderable-xml',
                renderableText
            };
        }

        const segmented = parseXmlSegmentOptions(blockRawXml, mediaMap, helpers, block.q);
        if (optionCount(segmented.options) >= 2) {
            return {
                options: segmented.options,
                optionImages: [...inlineImages, ...(segmented.optionImages || [])],
                hasUndisplayable: segmented.hasUndisplayable,
                source: 'xml-segment',
                renderableText
            };
        }

        options = parseInlineTextOptions(blockText, helpers);
        if (optionCount(options) >= 2) {
            return {
                options,
                optionImages: inlineImages,
                hasUndisplayable: false,
                source: 'plain-text',
                renderableText
            };
        }

        return {
            options: ['', '', '', ''],
            optionImages: inlineImages,
            hasUndisplayable: false,
            source: 'none',
            renderableText
        };
    };

    const stripOptionsFromStemText = (text = '') => {
        const source = normalizeDocxText(text || '');
        const idx = source.search(/(?:^|\s)A\s*[.\uFF0E\u3001\u3002)\uFF09]/);
        if (idx >= 0) return source.slice(0, idx).trim();
        return source.trim();
    };

    const stripQuestionNo = (
        text = ''
    ) => {
        const parsed =
            parseLeadingQuestionMarker(text);

        if (
            !parsed.questionNumber ||
            parsed.markerLength <= 0
        ) {
            return parsed.source.trim();
        }

        return parsed.source
            .slice(parsed.markerLength)
            .trim();
    };
    const parseStemFromBlock = (block, renderableText = '') => {
        const blockText = renderableText || block.lines.join('\n');
        return stripQuestionNo(stripOptionsFromStemText(blockText));
    };

    const parseDocxFile = async (fileRecord, context = {}) => {
        const helpers = context.helpers || {};
        const defaultMeta = context.defaultMeta || {};
        const warnings = [];
        const draftImages = [];

        const zip = await loadDocxZip(fileRecord);
        const { documentXml, relsXml } = await readDocxCoreXml(zip);
        const mediaMap = await buildMediaMaps(zip, relsXml, fileRecord.filename);
        const blocks = buildQuestionBlocksFromDocumentXml(documentXml);

        const drafts = blocks.map((block, index) => {
            const parsedOptions = parseOptionsFromBlock(block, mediaMap, helpers);
            const optionImages = parsedOptions.optionImages || [];
            const stem = parseStemFromBlock(block, parsedOptions.renderableText || '');

            const type = optionCount(parsedOptions.options) >= 2
                ? '\u5355\u9009\u9898'
                : (defaultMeta.defaultType || '\u89e3\u7b54\u9898');

            const id = helpers.makeBatchId
                ? helpers.makeBatchId('dq')
                : `dq_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`;

            const draft = {
                id,
                batchId: fileRecord.batchId || '',
                order: index + 1,
                questionNumber: block.q,
                type,
                stem,
                options: parsedOptions.options,
                answer: '',
                solution: '',
                images: optionImages,
                questionImages: [],
                rawBlock: block.lines.join('\n'),
                renderableText: parsedOptions.renderableText || '',
                sourceFileId: fileRecord.id || '',
                sourceFileName: fileRecord.filename || '',
                sourcePage: 1,
                sourceTrace: {
                    source: 'docx-importer',
                    sourceFileId: fileRecord.id || '',
                    sourceFileName: fileRecord.filename || '',
                    questionNo: block.q,
                    optionSource: parsedOptions.source,
                    hasUndisplayableOption: parsedOptions.hasUndisplayable,
                    blockTextHead: block.lines.join('\n').slice(0, 500)
                },
                warnings: [
                    ...(parsedOptions.hasUndisplayable
                        ? ['DOCX contains WMF/EMF/OLE option images; placeholders are shown for review.']
                        : [])
                ],
                status: 'pending',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            console.log('[BATCH_IMPORTER][docx-draft]', {
                q: draft.questionNumber,
                type: draft.type,
                optionCount: optionCount(draft.options),
                optionA: draft.options[0] || '',
                optionB: draft.options[1] || '',
                optionC: draft.options[2] || '',
                optionD: draft.options[3] || '',
                stemHead: draft.stem.slice(0, 120),
                optionImageCount: optionImages.length,
                warningCount: draft.warnings.length
            });

            return draft;
        });

        return {
            drafts,
            draftImages,
            unmatchedAnswers: [],
            warnings,
            debug: {
                blockCount: blocks.length,
                mediaCount: mediaMap.size
            }
        };
    };

    const parsePdfFile = async (fileRecord, context = {}) => {
        const helper = context.helpers?.parsePdfFileLegacy;
        if (typeof helper === 'function') return await helper(fileRecord, context);
        return {
            drafts: [],
            draftImages: [],
            unmatchedAnswers: [],
            warnings: ['PDF parsing is delegated to the legacy app parser.'],
            debug: {}
        };
    };

    const processBatch = async ({
        batch,
        files,
        defaultMeta = {},
        helpers = {}
    }) => {
        const result = {
            drafts: [],
            draftImages: [],
            unmatchedAnswers: [],
            warnings: [],
            debug: {}
        };

        for (const file of files || []) {
            if (file.fileType === 'docx') {
                const docxResult = await parseDocxFile(file, { batch, defaultMeta, helpers });
                result.drafts.push(...(docxResult.drafts || []));
                result.draftImages.push(...(docxResult.draftImages || []));
                result.unmatchedAnswers.push(...(docxResult.unmatchedAnswers || []));
                result.warnings.push(...(docxResult.warnings || []));
                Object.assign(result.debug, docxResult.debug || {});
                continue;
            }

            if (file.fileType === 'pdf') {
                const pdfResult = await parsePdfFile(file, { batch, defaultMeta, helpers });
                result.drafts.push(...(pdfResult.drafts || []));
                result.draftImages.push(...(pdfResult.draftImages || []));
                result.unmatchedAnswers.push(...(pdfResult.unmatchedAnswers || []));
                result.warnings.push(...(pdfResult.warnings || []));
                Object.assign(result.debug, pdfResult.debug || {});
            }
        }

        return result;
    };

    window.QisiBatchImporter = {
        processBatch,
        parseDocxFile,
        parsePdfFile,
        extractDocxQuestionSkeleton
    };
})();
