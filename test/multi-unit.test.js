'use strict';

const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

const createAdapter = proxyquire('../main', {
    '@iobroker/adapter-core': { Adapter: class { on() {} } },
});

describe('Multi-unit devices', () => {
    it('keeps every outlet name and merges the parent metadata into each outlet', () => {
        const adapter = createAdapter();
        const outlets = ['1', '2', '3'].map(number => ({
            id: number,
            identifier: `strip-${number}`,
            name: `Outlet ${number}`,
            fwversion: '0.0',
            etsiunitinfo: { etsideviceid: '10', unittype: '256' },
            simpleonoff: { state: number === '1' ? '1' : '0' },
        }));
        const parent = { id: '10', identifier: 'strip', name: 'Power strip', fwversion: '1.2', manufacturer: 'Useelink', simpleonoff: { state: '1' } };
        const devices = adapter.unifyDevicesUnits([parent, ...outlets, { id: '99', identifier: 'other' }]);
        assert.deepEqual(devices.map(device => device.id), ['1', '2', '3', '99']);
        assert.deepEqual(devices.slice(0, 3).map(device => device.name), ['Outlet 1', 'Outlet 2', 'Outlet 3']);
        assert.deepEqual(devices.slice(0, 3).map(device => device.fwversion), ['1.2', '1.2', '1.2']);
        assert.deepEqual(devices.slice(0, 3).map(device => device.simpleonoff.state), ['1', '0', '0']);
    });
});
