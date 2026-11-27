'use strict';

const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

class Adapter {
    on() {}
}

class Fritz {
    constructor(username, password, url) {
        Object.assign(this, { username, password, url });
    }

    async login_SID() {
        return true;
    }

    async check_SID() {}
}

const createAdapter = proxyquire('../main', {
    '@iobroker/adapter-core': { Adapter },
    'fritzdect-aha-nodejs': { Fritz },
});

function createFixture(name, overrides = {}) {
    const adapter = createAdapter();
    adapter.config = {
        fritz_user: name,
        fritz_pw: 'password',
        fritz_ip: `http://${name}.example`,
        fritz_interval: 5,
        fritz_exclude_templates: true,
        fritz_exclude_routines: true,
        ...overrides,
    };
    adapter.log = { debug() {}, info() {}, warn() {}, error() {} };
    adapter.getForeignObjectAsync = async () => ({ common: {} });
    adapter.getForeignObject = (_id, callback) => {
        adapter.startup = callback();
    };
    adapter.subscribeStates = () => {};
    adapter.createGlobal = async () => {};
    adapter.createDevices = async () => {};
    adapter.updateDevices = async () => {};
    adapter.setInterval = callback => {
        adapter.poll = callback;
        return 1;
    };
    return adapter;
}

describe('Adapter polling', () => {
    it('reconnects each compact instance to its own FRITZ!Box', async () => {
        const first = createFixture('first');
        const second = createFixture('second');
        await Promise.all([first.onReady(), second.onReady()]);
        await Promise.all([first.startup, second.startup]);
        for (const adapter of [first, second]) {
            adapter.fritz = null;
            await adapter.onStateChange('fritzdect.0.DEVICE', { val: 0, ack: true });
            assert.equal(adapter.fritz.username, adapter.config.fritz_user);
            assert.equal(adapter.fritz.url, adapter.config.fritz_ip);
        }
    });

    it('handles rejected updates in the scheduled poll', async () => {
        const adapter = createFixture('first');
        const warnings = [];
        adapter.log.warn = message => warnings.push(message);
        await adapter.onReady();
        await adapter.startup;
        adapter.update = async () => {
            throw new Error('Failed poll');
        };
        await adapter.poll();
        assert.match(warnings[0], /Failed poll/);
    });

    it('distinguishes zero and false from missing data on the first poll', async () => {
        const adapter = createFixture('first');
        const writes = new Map();
        adapter.getStateAsync = async id => writes.get(id) ?? null;
        adapter.setStateAsync = async (id, state) => writes.set(id, state);
        await adapter.updateDatapoint('celsius', 0, '123');
        await adapter.updateDatapoint('windowopenactiv', false, '123');
        await adapter.updateDatapoint('power', '', '123');
        assert.deepEqual(writes.get('DECT_123.celsius'), { val: 0, ack: true });
        assert.deepEqual(writes.get('DECT_123.windowopenactiv'), { val: false, ack: true });
        assert.deepEqual(writes.get('DECT_123.power'), { val: null, ack: true });
    });
});
