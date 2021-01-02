const path = require('path');
const { tests } = require('@iobroker/testing');

const server = require('./lib/fritz_mockserver.js');

function encrypt(key, value) {
	let result = '';
	for (let i = 0; i < value.length; ++i) {
		result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
	}
	return result;
}

function delay(t, val) {
	return new Promise(function(resolve) {
		setTimeout(function() {
			resolve(val);
		}, t);
	});
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
			before('start the emulation', () => {
				server.setupHttpServer(function() {});
			});
			it('Should work, to send a message', () => {
				return new Promise(async (resolve) => {
					// Create a fresh harness instance each test!
					const harness = getHarness();
					// modification of some starting values

					//config.common.enabled = true;
					//config.common.loglevel = 'debug';
					// systemConfig.native.secret ='Zgfr56gFe87jJOM'

					//await delay (15000);

					harness._objects.getObject('system.adapter.fritzdect.0', async (err, obj) => {
						obj.native.fritz_ip = 'http://localhost:3333';
						obj.native.fritz_user = 'admin';
						//obj.native.fritz_pw = encrypt(systemConfig.native.secret, 'password');
						obj.native.fritz_pw = encrypt('Zgfr56gFe87jJOM', 'password');
						obj.native.fritz_interval = 300;
						obj.native.fritz_strictssl = true;
						await harness._objects.setObjectAsync(obj._id, obj);

						// Start the adapter and wait until it has started
						await harness.startAdapterAndWait();

						// Perform the actual test:
						harness.sendTo('fritzdect.0', 'test', 'message', (resp) => {
							console.dir(resp);
							resolve();
						});
					});
				});
			}).timeout(10000);
		});
	}
});

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
