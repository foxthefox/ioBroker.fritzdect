'use strict';

const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

const createAdapter = proxyquire('../main', {
    '@iobroker/adapter-core': { Adapter: class { on() {} } },
});

describe('Thermostat target values', () => {
    it('uses numeric targets for legacy configuration and existing string states', async () => {
        const adapter = createAdapter();
        const states = new Map();
        adapter.config = { fritz_user: '', fritz_pw: '', fritz_tsolldefault: '20.5' };
        adapter.log = { debug() {}, info() {}, warn() {}, error() {} };
        adapter.getForeignObjectAsync = async () => ({ common: {} });
        adapter.subscribeStates = () => {};
        adapter.setObjectNotExistsAsync = async () => {};
        adapter.extendObject = () => {};
        adapter.setStateAsync = async (id, state) => states.set(id, state);
        adapter.getStateAsync = async id => states.get(id) ?? null;

        await adapter.onReady();
        await adapter.createData([{ identifier: '123', name: 'Thermostat', functionbitmask: 320, hkr: { tsoll: '253' } }]);
        assert.deepEqual(states.get('DECT_123.tsoll'), { val: 20.5, ack: true });

        for (const mode of ['253', '254']) {
            states.set('DECT_123.tsoll', { val: '21.5', ack: true });
            states.set('DECT_123.lasttarget', { val: '21.5', ack: true });
            await adapter.updateDatapoint('tsoll', mode, '123');
            assert.deepEqual(states.get('DECT_123.tsoll'), { val: 21.5, ack: true });
            assert.deepEqual(states.get('DECT_123.lasttarget'), { val: 21.5, ack: true });
        }
    });
});
