const path = require('path');
const { tests } = require('@iobroker/testing');

function encrypt(key, value) {
	let result = '';
	for (let i = 0; i < value.length; ++i) {
		result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
	}
	return result;
}

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, '..'), {
	// This should be the adapter's root directory

	// If the adapter may call process.exit during startup, define here which exit codes are allowed.
	// By default, termination during startup is not allowed.
	allowedExitCodes: [ 11 ],

	// Define your own tests inside defineAdditionalTests
	// Since the tests are heavily instrumented, you need to create and use a so called "harness" to control the tests.
	defineAdditionalTests(getHarness) {
		describe('Test sendTo()', () => {
			it('Should work', () => {
				return new Promise(async (resolve) => {
					// Create a fresh harness instance each test!
					const harness = getHarness();
					// modification of some starting values

					//config.common.enabled = true;
					//config.common.loglevel = 'debug';
					// systemConfig.native.secret ='Zgfr56gFe87jJOM'

					harness._objects.getObject('system.adapter.fritzdect.0', async (err, obj) => {
						obj.native.fritz_ip = 'http://localhost:8080';
						obj.native.fritz_user = 'admin';
						//obj.native.fritz_pw = encrypt(systemConfig.native.secret, 'password');
						obj.native.fritz_pw = encrypt('Zgfr56gFe87jJOM', 'password');
						obj.native.fritz_interval = 300;
						obj.native.fritz_strictssl = true;
						harness._objects.setObject(obj._id, obj);

						// Start the adapter and wait until it has started
						await harness.startAdapterAndWait();

						// Perform the actual test:
						harness.sendTo('adapter.0', 'test', 'message', (resp) => {
							console.dir(resp);
							resolve();
						});
					});
				});
			});
		});
	}
});

/*
const { expect } = require('chai');
// import { functionToTest } from "./moduleToTest";

const setup = require(__dirname + '/test/lib/setup');

const server = require('./test/lib/fritz_mockserver.js');

let objects = null;
let states = null;
const onStateChanged = null;

const adapterShortName = setup.adapterName.substring(setup.adapterName.indexOf('.') + 1);


describe('Test ' + adapterShortName + ' adapter', function() {
	before('Test ' + adapterShortName + ' adapter: Start js-controller', function(_done) {
		this.timeout(45 * 60 * 60 * 1000); // because of first install from npm

		setup.setupController((systemConfig) => {
			const config = setup.getAdapterConfig();
			// enable adapter
			config.common.enabled = true;
			config.common.loglevel = 'debug';

			config.native = {
				fritz_ip: 'http://localhost:8080',
				fritz_user: 'admin',
				fritz_pw: encrypt(systemConfig.native.secret, 'password'),
				fritz_interval: '300',
				fritz_strictssl: true
			};

			setup.setAdapterConfig(config.common, config.native);
			server.setupHttpServer(function() {
				setup.startController(
					true,
					function(id, obj) {},
					function(id, state) {
						if (onStateChanged) onStateChanged(id, state);
					},
					function(_objects, _states) {
						objects = _objects;
						states = _states;
						_done();
					}
				);
			});
		});
	});
	/*
    ENABLE THIS WHEN ADAPTER RUNS IN DEAMON MODE TO CHECK THAT IT HAS STARTED SUCCESSFULLY
    */
/*
	it('Test ' + adapterShortName + ' adapter: Check if adapter started', function(done) {
		this.timeout(120000);
		checkConnectionOfAdapter(function(res) {
			if (res) console.log(res);
			expect(res).not.to.be.equal('Cannot check connection');
			objects.setObject(
				'system.adapter.test.0',
				{
					common: {},
					type: 'instance'
				},
				function() {
					states.subscribeMessage('system.adapter.test.0');
					done();
				}
			);
		});
	});

	it('Test ' + adapterShortName + ' adapter: delay', function(done) {
		this.timeout(20000);

		setTimeout(function() {
			done();
		}, 10000);
	});
	/*
    PUT YOUR OWN TESTS HERE USING
    it('Testname', function ( done) {
        ...
    });
    You can also use "sendTo" method to send messages to the started adapter
	*/
// anfang von eigenen Tests
/*
	it('Test ' + adapterShortName + ' adapter: Check values of switch', function(done) {
		this.timeout(300000);
		setTimeout(function() {
			states.getState('fritzdect.0.DECT_087610006161.productname', function(err, state) {
				if (err) console.error(err);
				expect(state).to.exist;
				if (!state) {
					console.error('state "fritzdect.0.DECT_087610006161.productname" not set');
				} else {
					console.log('fritzdect.0.DECT_087610006161.productname      ... ' + state.val);
				}
				expect(state.val).to.exist;
				expect(state.val).to.be.equal('FRITZ!DECT 200');
				states.getState('fritzdect.0.DECT_087610006161.manufacturer', function(err, state) {
					if (err) console.error(err);
					expect(state).to.exist;
					if (!state) {
						console.error('state "fritzdect.0.DECT_087610006161.manufacturer" not set');
					} else {
						console.log('fritzdect.0.DECT_087610006161.manufacturer  ... ' + state.val);
					}
					expect(state.val).to.exist;
					expect(state.val).to.be.equal('AVM');
					states.getState('fritzdect.0.DECT_087610006161.fwversion', function(err, state) {
						if (err) console.error(err);
						expect(state).to.exist;
						if (!state) {
							console.error('state "fritzdect.0.DECT_087610006161.fwversion" not set');
						} else {
							console.log('fritzdect.0.DECT_087610006161.fwversion     ... ' + state.val);
						}
						expect(state.val).to.exist;
						expect(state.val).to.be.equal('03.87');
						states.getState('fritzdect.0.DECT_087610006161.id', function(err, state) {
							if (err) console.error(err);
							expect(state).to.exist;
							if (!state) {
								console.error('state "fritzdect.0.DECT_087610006161.id" not set');
							} else {
								console.log('fritzdect.0.DECT_087610006161.id            ... ' + state.val);
							}
							expect(state.val).to.exist;
							expect(state.val).to.be.equal('16');
							states.getState('fritzdect.0.DECT_087610006161.name', function(err, state) {
								if (err) console.error(err);
								expect(state).to.exist;
								if (!state) {
									console.error('state "fritzdect.0.DECT_087610006161.name" not set');
								} else {
									console.log('fritzdect.0.DECT_087610006161.name          ... ' + state.val);
								}
								expect(state.val).to.exist;
								expect(state.val).to.be.equal('FRITZ!DECT 200 #1');
								states.getState('fritzdect.0.DECT_087610006161.state', function(err, state) {
									if (err) console.error(err);
									expect(state).to.exist;
									if (!state) {
										console.error('state "fritzdect.0.DECT_087610006161.state" not set');
									} else {
										console.log('fritzdect.0.DECT_087610006161.state         ... ' + state.val);
									}
									expect(state.val).to.exist;
									expect(state.val).to.be.equal(true);
									states.getState('fritzdect.0.DECT_087610006161.celsius', function(err, state) {
										if (err) console.error(err);
										expect(state).to.exist;
										if (!state) {
											console.error('state "fritzdect.0.DECT_087610006161.celsius" not set');
										} else {
											console.log(
												'fritzdect.0.DECT_087610006161.celsius          ... ' + state.val
											);
										}
										expect(state.val).to.exist;
										expect(state.val).to.be.equal(22.5);
										states.getState('fritzdect.0.DECT_087610006161.voltage', function(err, state) {
											if (err) console.error(err);
											expect(state).to.exist;
											if (!state) {
												console.error('state "fritzdect.0.DECT_087610006161.voltage" not set');
											} else {
												console.log(
													'fritzdect.0.DECT_087610006161.voltage       ... ' + state.val
												);
											}
											expect(state.val).to.exist;
											expect(state.val).to.be.equal(224.645);
											states.getState('fritzdect.0.DECT_087610006161.power', function(
												err,
												state
											) {
												if (err) console.error(err);
												expect(state).to.exist;
												if (!state) {
													console.error(
														'state "fritzdect.0.DECT_087610006161.power" not set'
													);
												} else {
													console.log(
														'fritzdect.0.DECT_087610006161.power         ... ' + state.val
													);
												}
												expect(state.val).to.exist;
												expect(state.val).to.be.equal(0);
												states.getState('fritzdect.0.DECT_087610006161.energy', function(
													err,
													state
												) {
													if (err) console.error(err);
													expect(state).to.exist;
													if (!state) {
														console.error(
															'state "fritzdect.0.DECT_087610006161.energy" not set'
														);
													} else {
														console.log(
															'fritzdect.0.DECT_087610006161.energy        ... ' +
																state.val
														);
														expect(state.val).to.exist;
														expect(state.val).to.be.equal(104560);
														done();
													}
												});
											});
										});
									});
								});
							});
						});
					});
				});
			});
		}, 1000);
	});
	after('Test ' + adapterShortName + ' adapter: Stop js-controller', function(done) {
		this.timeout(10000);

		setup.stopController(function(normalTerminated) {
			console.log('Adapter normal terminated: ' + normalTerminated);
			done();
		});
	});
});
*/
