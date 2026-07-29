(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutAssetRepository = api;

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

        const isBlob = value =>
            typeof Blob !== 'undefined'
            && value instanceof Blob;

        const requireTable = (db, name) => {
            const table = db?.[name] || db?.table?.(name);

            if (!table) {
                throw new Error(`database table is unavailable: ${name}`);
            }

            return table;
        };

        const normalizeAssetRecord = value => {
            const id = String(value?.id || '').trim();
            const handoutId = String(value?.handoutId || '').trim();

            if (!id || !handoutId) {
                throw new TypeError('handout asset requires id and handoutId');
            }
            if (!isBlob(value.blob) || value.blob.size < 1) {
                throw new TypeError(`handout asset ${id} requires a non-empty Blob`);
            }

            return {
                ...value,
                id,
                handoutId,
                kind: String(value.kind || 'image'),
                blob: value.blob.slice(
                    0,
                    value.blob.size,
                    value.blob.type || 'application/octet-stream'
                ),
                mimeType: String(value.mimeType || value.blob.type || ''),
                byteSize: value.blob.size
            };
        };

        const collectHandoutAssetIds = handout => {
            const ids = new Set();
            const addAssetId = value => {
                const assetId = String(value || '').trim();
                if (assetId) ids.add(assetId);
            };
            const addImages = images => {
                for (const image of Array.isArray(images) ? images : []) {
                    addAssetId(image?.assetId);
                }
            };

            for (const block of handout?.blocks || []) {
                if (block?.type === 'image') {
                    addAssetId(block.assetId);
                }
                if (block?.type === 'question') {
                    addImages(block.snapshot?.images);
                    addImages(block.images);
                }
            }
            for (const regionName of ['header', 'footer']) {
                const region = handout?.settings?.[regionName];
                for (const slotName of ['left', 'center', 'right']) {
                    addAssetId(region?.slots?.[slotName]?.assetId);
                }
            }

            return [...ids].sort();
        };

        const verifyHandoutAssetGraph = (handout, records) => {
            const references = collectHandoutAssetIds(handout);
            const assets = Array.isArray(records) ? records : [];
            const byId = new Map();
            const duplicateIds = [];
            const invalidBlobIds = [];
            const ownershipMismatchIds = [];
            const handoutId = String(handout?.id || '').trim();

            for (const asset of assets) {
                const id = String(asset?.id || '').trim();

                if (!id) continue;
                if (byId.has(id)) duplicateIds.push(id);
                byId.set(id, asset);
                if (!isBlob(asset.blob) || asset.blob.size < 1) {
                    invalidBlobIds.push(id);
                }
                if (String(asset.handoutId || '') !== handoutId) {
                    ownershipMismatchIds.push(id);
                }
            }

            const missingIds = references.filter(id => !byId.has(id));
            const referenced = new Set(references);
            const orphanIds = [...byId.keys()]
                .filter(id => !referenced.has(id))
                .sort();

            return {
                ok: (
                    missingIds.length === 0
                    && duplicateIds.length === 0
                    && invalidBlobIds.length === 0
                    && ownershipMismatchIds.length === 0
                ),
                referencedIds: references,
                missingIds,
                duplicateIds: [...new Set(duplicateIds)].sort(),
                invalidBlobIds: [...new Set(invalidBlobIds)].sort(),
                ownershipMismatchIds:
                    [...new Set(ownershipMismatchIds)].sort(),
                orphanIds
            };
        };

        const remapHandoutAssetIds = (handout, value) => {
            const idMap = value instanceof Map
                ? value
                : new Map(Object.entries(value || {}));
            const remapImages = images =>
                (Array.isArray(images) ? images : []).map(image => {
                    const current = String(image?.assetId || '');
                    return {
                        ...image,
                        assetId: idMap.get(current) || current
                    };
                });
            const remapRegion = region => {
                if (!region?.slots) return region;

                return {
                    ...region,
                    slots: Object.fromEntries(
                        Object.entries(region.slots).map(
                            ([slotName, slot]) => {
                                const current = String(
                                    slot?.assetId || ''
                                );
                                return [
                                    slotName,
                                    {
                                        ...slot,
                                        assetId:
                                            idMap.get(current) || current
                                    }
                                ];
                            }
                        )
                    )
                };
            };

            return {
                ...handout,
                settings: {
                    ...(handout?.settings || {}),
                    header: remapRegion(
                        handout?.settings?.header
                    ),
                    footer: remapRegion(
                        handout?.settings?.footer
                    )
                },
                blocks: (handout?.blocks || []).map(block => {
                    if (block?.type === 'image') {
                        const current = String(block.assetId || '');
                        return {
                            ...block,
                            assetId: idMap.get(current) || current
                        };
                    }
                    if (block?.type !== 'question') {
                        return {
                            ...block
                        };
                    }

                    return {
                        ...block,
                        snapshot: {
                            ...block.snapshot,
                            images: remapImages(block.snapshot?.images)
                        },
                        images: remapImages(block.images)
                    };
                })
            };
        };

        const createHandoutAssetRepository = ({ db }) => {
            const table = requireTable(db, 'handoutAssets');

            const putMany = async (handoutId, values) => {
                const id = String(handoutId || '').trim();
                const records = (Array.isArray(values) ? values : [])
                    .map(normalizeAssetRecord);

                if (records.some(record => record.handoutId !== id)) {
                    throw new Error('handout asset ownership mismatch');
                }
                if (new Set(records.map(record => record.id)).size !== records.length) {
                    throw new Error('duplicate handout asset id');
                }
                if (records.length) {
                    await table.bulkPut(records);
                }

                return records;
            };

            return Object.freeze({
                get: id => table.get(String(id || '')),
                listForHandout: handoutId =>
                    table.where('handoutId')
                        .equals(String(handoutId || ''))
                        .toArray(),
                putMany,
                deleteForHandout: handoutId =>
                    table.where('handoutId')
                        .equals(String(handoutId || ''))
                        .delete()
            });
        };

        return {
            normalizeAssetRecord,
            collectHandoutAssetIds,
            verifyHandoutAssetGraph,
            remapHandoutAssetIds,
            createHandoutAssetRepository
        };
    }
);
