'use strict';

const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

const createAdapter = proxyquire('../main', {
    '@iobroker/adapter-core': { Adapter: class { on() {} } },
});

describe('FRITZ!Box password migration', () => {
    function createFixture(config, storedPassword = '') {
        const adapter = createAdapter();
        const writes = [];
        const errors = [];
        adapter.config = config;
        adapter.namespace = 'fritzdect.0';
        adapter.log = { error: message => errors.push(message) };
        adapter.getForeignObjectAsync = async id => {
            assert.equal(id, 'system.adapter.fritzdect.0');
            return {
                encryptedNative: ['fritz_password'],
                native: { fritz_pw: config.fritz_pw, fritz_password: storedPassword },
            };
        };
        adapter.decrypt = value => value.replace(/^stored:/, '');
        adapter.updateConfig = async patch => writes.push(patch);
        return { adapter, writes, errors };
    }

    it('moves the legacy password in one controller config write', async () => {
        const { adapter, writes, errors } = createFixture({ fritz_pw: 'old-password' });
        await adapter.onReady();
        assert.deepEqual(writes, [{ fritz_pw: '', fritz_password: 'old-password' }]);
        assert.deepEqual(errors, []);
    });

    it('preserves a new password saved before first startup', async () => {
        const { adapter, writes } = createFixture(
            { fritz_pw: 'old-password', fritz_password: 'new-password' },
            'stored:new-password',
        );
        await adapter.onReady();
        assert.deepEqual(writes, [{ fritz_pw: '', fritz_password: 'new-password' }]);
    });

    it('preserves concurrent edits and reports a failure without logging credentials', async () => {
        const { adapter, writes, errors } = createFixture(
            { fritz_pw: 'old-password' },
            'stored:new-password',
        );
        await adapter.onReady();
        assert.deepEqual(writes, []);
        assert.deepEqual(errors, ['Could not migrate the FRITZ!Box password. Check the instance settings and restart.']);
    });

    it('starts a new instance without rewriting its saved encrypted configuration', async () => {
        const { adapter, writes, errors } = createFixture({ fritz_user: 'user', fritz_password: 'new-password' });
        adapter.log.info = () => {};
        adapter.getForeignObjectAsync = async id => {
            assert.equal(id, 'system.config');
            return { common: {} };
        };
        const subscriptions = [];
        adapter.subscribeStates = pattern => subscriptions.push(pattern);
        adapter.getForeignObject = () => {};
        await adapter.onReady();
        assert.deepEqual(writes, []);
        assert.deepEqual(errors, []);
        assert.deepEqual(subscriptions, ['*']);
    });
});
