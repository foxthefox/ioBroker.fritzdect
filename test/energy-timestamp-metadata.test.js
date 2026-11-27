'use strict';

const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

const createAdapter = proxyquire('../main', {
    '@iobroker/adapter-core': { Adapter: class { on() {} } },
});

describe('Energy timestamp metadata', () => {
    it('updates the legacy cap in place and leaves new or customized metadata alone', async () => {
        const adapter = createAdapter();
        const prefix = 'DECT_123.energy_stats.';
        const legacy = { type: 'state', common: { max: 2147483648, name: 'Custom month name' } };
        const custom = { type: 'state', common: { max: 9000000000000 } };
        const objects = new Map([[prefix + 'datatimem', legacy], [prefix + 'datatimed', custom]]);
        const updates = [];

        adapter.log = { debug() {} };
        adapter.createObject = async () => {};
        adapter.setObjectNotExistsAsync = async (id, object) => {
            if (!objects.has(id)) {
                objects.set(id, object);
            }
        };
        adapter.getObjectAsync = async id => objects.get(id);
        adapter.extendObjectAsync = async (id, { common }) => {
            updates.push(id);
            Object.assign(objects.get(id).common, common);
        };

        await adapter.createStats('123', 'energy');
        await adapter.createStats('123', 'energy');
        await adapter.createStats('456', 'energy');

        assert.deepEqual(updates, [prefix + 'datatimem']);
        assert.equal(legacy.common.max, Number.MAX_SAFE_INTEGER);
        assert.equal(legacy.common.name, 'Custom month name');
        assert.equal(custom.common.max, 9000000000000);
        assert.equal(objects.get('DECT_456.energy_stats.datatimed').common.max, undefined);
    });
});
