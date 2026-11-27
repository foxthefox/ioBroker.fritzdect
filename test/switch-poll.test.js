'use strict';

const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

const createAdapter = proxyquire('../main', {
    '@iobroker/adapter-core': { Adapter: class { on() {} } },
});

describe('Switch polling', () => {
    it('keeps the command acknowledgement and accepts a subsequent poll', async () => {
        const adapter = createAdapter();
        const states = new Map([['DECT_123.switchtype', { val: 'switch' }], ['DECT_123.state', { val: true }]]);
        const switchWrites = [];
        adapter.config = { fritz_writeonhyst: true };
        adapter.log = { info() {}, debug() {}, warn() {}, error() {} };
        adapter.getStateAsync = async id => states.get(id) ?? null;
        adapter.setStateAsync = async (id, state) => {
            states.set(id, state);
            if (id === 'DECT_123.state') {
                switchWrites.push(state.val);
            }
        };

        const deviceList =
            '<devicelist><device identifier="123" functionbitmask="512"><present>1</present><switch><state>1</state></switch></device></devicelist>';
        const stale = Promise.withResolvers();
        adapter.fritz = { getDeviceListInfos: () => stale.promise, setSwitchOff: async () => {} };
        const firstPoll = adapter.updateDevices(adapter.fritz);
        await adapter.onStateChange('fritzdect.0.DECT_123.state', { val: false, ack: false });
        await Promise.resolve();
        stale.resolve(deviceList);
        await firstPoll;
        assert.deepEqual(switchWrites, [false]);

        adapter.fritz.getDeviceListInfos = async () => deviceList;
        await adapter.updateDevices(adapter.fritz);
        assert.deepEqual(switchWrites, [false, true]);
    });
});
