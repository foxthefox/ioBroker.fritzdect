'use strict';

const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

const createAdapter = proxyquire('../main', {
    '@iobroker/adapter-core': { Adapter: class { on() {} } },
});

describe('Energy statistics', () => {
    const now = Date.UTC(2026, 0, 2);

    for (const dated of [true, false]) {
        it(`separates rolling totals from calendar totals ${dated ? 'with' : 'without'} timestamps`, async () => {
            const adapter = createAdapter();
            const writes = {};
            adapter.log = { debug() {}, warn() {} };
            adapter.getStateAsync = async () => null;
            adapter.setStateAsync = async (id, { val }) => {
                writes[id] = val;
            };
            const month = dated ? Date.UTC(2026, 2, 8) : now;
            const day = dated ? Date.UTC(2026, 2, 4) : now;
            const timestamp = value => (dated ? ` datatime="${value / 1000}"` : '');
            const getBasicDeviceStats = async () =>
                `<devicestats><energy><stats count="12" grid="2678400"${timestamp(month)}>10,20,30,40,50,60,70,80,90,100,110,120</stats><stats count="6" grid="86400"${timestamp(day)}>1,2,3,4,5,6</stats></energy></devicestats>`;

            const originalNow = Date.now;
            Date.now = () => now;
            try {
                await adapter.updateStats('123', { getBasicDeviceStats });
            } finally {
                Date.now = originalNow;
            }

            const prefix = 'DECT_123.energy_stats.';
            assert.equal(writes[prefix + 'datatimem'], month);
            assert.equal(writes[prefix + 'datatimed'], day);
            assert.equal(writes[prefix + 'energy_last12m'], 780);
            assert.equal(writes[prefix + 'energy_ytd'], dated ? 60 : 10);
            assert.equal(writes[prefix + 'energy_last31d'], 21);
            assert.equal(writes[prefix + 'energy_mtd'], dated ? 10 : 3);
        });
    }
});
