const path = require('path');
const { tests } = require('@iobroker/testing');

const server = require('../lib/fritz/fritz_mockserver.js');

const expect = require('chai').expect;

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
		describe('Test creation of devices', () => {
			before('start the emulation', () => {
				server.setupHttpServer(function() {});
			});
			/*
			// should work but doesnt
			it('Should work to send a message', () => {
				return new Promise( (resolve) => {
					// Create a fresh harness instance each test!
					const harness = getHarness();
					// Start the adapter and wait until it has started
					await harness.startAdapterAndWait();
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
						await delay(3000);
						// Perform the actual test:
						harness.sendTo('fritzdect.0', 'test', 'message', (resp) => {
							console.dir(resp);
							resolve();
						});
					});
				});
			}).timeout(20000);
			*/
			it('Fritzdect 200 schould be created', () => {
				return new Promise((resolve) => {
					// Create a fresh harness instance each test!
					const harness = getHarness();
					// modification of some starting values

					//schon Teil des iobroker/testing :-)
					//config.common.enabled = true;
					//config.common.loglevel = 'debug';
					// systemConfig.native.secret ='Zgfr56gFe87jJOM'

					//await delay (15000);

					//man könnte auch je device ein json array der datenpunkte und der erwarteten Werte anlegen und dann eine loop

					//this refers to https://github.com/ioBroker/testing/issues/218
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
						await delay(3000);

						harness.states.getState('fritzdect.0.DECT_087610006161.productname', function(err, state) {
							if (err) console.error(err);
							expect(state).to.exist;
							if (!state) {
								console.error('state "fritzdect.0.DECT_087610006161.productname" not set');
							} else {
								console.log('fritzdect.0.DECT_087610006161.productname      ... ' + state.val);
							}
							expect(state.val).to.exist;
							expect(state.val).to.be.equal('FRITZ!DECT 200');
							harness.states.getState('fritzdect.0.DECT_087610006161.manufacturer', function(err, state) {
								if (err) console.error(err);
								expect(state).to.exist;
								if (!state) {
									console.error('state "fritzdect.0.DECT_087610006161.manufacturer" not set');
								} else {
									console.log('fritzdect.0.DECT_087610006161.manufacturer  ... ' + state.val);
								}
								expect(state.val).to.exist;
								expect(state.val).to.be.equal('AVM');
								harness.states.getState('fritzdect.0.DECT_087610006161.fwversion', function(
									err,
									state
								) {
									if (err) console.error(err);
									expect(state).to.exist;
									if (!state) {
										console.error('state "fritzdect.0.DECT_087610006161.fwversion" not set');
									} else {
										console.log('fritzdect.0.DECT_087610006161.fwversion     ... ' + state.val);
									}
									expect(state.val).to.exist;
									expect(state.val).to.be.equal('03.87');
									harness.states.getState('fritzdect.0.DECT_087610006161.id', function(err, state) {
										if (err) console.error(err);
										expect(state).to.exist;
										if (!state) {
											console.error('state "fritzdect.0.DECT_087610006161.id" not set');
										} else {
											console.log('fritzdect.0.DECT_087610006161.id            ... ' + state.val);
										}
										expect(state.val).to.exist;
										expect(state.val).to.be.equal('16');
										harness.states.getState('fritzdect.0.DECT_087610006161.name', function(
											err,
											state
										) {
											if (err) console.error(err);
											expect(state).to.exist;
											if (!state) {
												console.error('state "fritzdect.0.DECT_087610006161.name" not set');
											} else {
												console.log(
													'fritzdect.0.DECT_087610006161.name          ... ' + state.val
												);
											}
											expect(state.val).to.exist;
											expect(state.val).to.be.equal('FRITZ!DECT 200 #1');
											harness.states.getState('fritzdect.0.DECT_087610006161.state', function(
												err,
												state
											) {
												if (err) console.error(err);
												expect(state).to.exist;
												if (!state) {
													console.error(
														'state "fritzdect.0.DECT_087610006161.state" not set'
													);
												} else {
													console.log(
														'fritzdect.0.DECT_087610006161.state         ... ' + state.val
													);
												}
												expect(state.val).to.exist;
												expect(state.val).to.be.equal(true);
												harness.states.getState(
													'fritzdect.0.DECT_087610006161.celsius',
													function(err, state) {
														if (err) console.error(err);
														expect(state).to.exist;
														if (!state) {
															console.error(
																'state "fritzdect.0.DECT_087610006161.celsius" not set'
															);
														} else {
															console.log(
																'fritzdect.0.DECT_087610006161.celsius          ... ' +
																	state.val
															);
														}
														expect(state.val).to.exist;
														expect(state.val).to.be.equal(22.5);
														harness.states.getState(
															'fritzdect.0.DECT_087610006161.voltage',
															function(err, state) {
																if (err) console.error(err);
																expect(state).to.exist;
																if (!state) {
																	console.error(
																		'state "fritzdect.0.DECT_087610006161.voltage" not set'
																	);
																} else {
																	console.log(
																		'fritzdect.0.DECT_087610006161.voltage       ... ' +
																			state.val
																	);
																}
																expect(state.val).to.exist;
																expect(state.val).to.be.equal(224.645);
																harness.states.getState(
																	'fritzdect.0.DECT_087610006161.power',
																	function(err, state) {
																		if (err) console.error(err);
																		expect(state).to.exist;
																		if (!state) {
																			console.error(
																				'state "fritzdect.0.DECT_087610006161.power" not set'
																			);
																		} else {
																			console.log(
																				'fritzdect.0.DECT_087610006161.power         ... ' +
																					state.val
																			);
																		}
																		expect(state.val).to.exist;
																		expect(state.val).to.be.equal(0);
																		harness.states.getState(
																			'fritzdect.0.DECT_087610006161.energy',
																			function(err, state) {
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
																					expect(state.val).to.be.equal(
																						104560
																					);
																					resolve();
																				}
																			}
																		);
																	}
																);
															}
														);
													}
												);
											});
										});
									});
								});
							});
						});
					});
				});
			}).timeout(20000);
			it('Fritzdect Comet wo battcharge should be created', () => {
				return new Promise((resolve) => {
					const harness = getHarness();
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
						await delay(3000);
						harness.states.getState('fritzdect.0.DECT_119600642220.productname', function(err, state) {
							if (err) console.error(err);
							expect(state).to.exist;
							if (!state) {
								console.error('state "fritzdect.0.DECT_119600642220.productname" not set');
							} else {
								console.log('fritzdect.0.DECT_119600642220.productname        ... ' + state.val);
							}
							expect(state.val).to.exist;
							expect(state.val).to.be.equal('Comet DECT');
							harness.states.getState('fritzdect.0.DECT_119600642220.manufacturer', function(err, state) {
								if (err) console.error(err);
								expect(state).to.exist;
								if (!state) {
									console.error('state "fritzdect.0.DECT_119600642220.manufacturer" not set');
								} else {
									console.log('fritzdect.0.DECT_119600642220.manufacturer    ... ' + state.val);
								}
								expect(state.val).to.exist;
								expect(state.val).to.be.equal('AVM');
								harness.states.getState('fritzdect.0.DECT_119600642220.fwversion', function(
									err,
									state
								) {
									if (err) console.error(err);
									expect(state).to.exist;
									if (!state) {
										console.error('state "fritzdect.0.DECT_119600642220.fwversion" not set');
									} else {
										console.log('fritzdect.0.DECT_119600642220.fwversion       ... ' + state.val);
									}
									expect(state.val).to.exist;
									expect(state.val).to.be.equal('03.54');
									harness.states.getState('fritzdect.0.DECT_119600642220.id', function(err, state) {
										if (err) console.error(err);
										expect(state).to.exist;
										if (!state) {
											console.error('state "fritzdect.0.DECT_119600642220.id" not set');
										} else {
											console.log(
												'fritzdect.0.DECT_119600642220.id              ... ' + state.val
											);
										}
										expect(state.val).to.exist;
										expect(state.val).to.be.equal('17');
										harness.states.getState('fritzdect.0.DECT_119600642220.devicelock', function(
											err,
											state
										) {
											if (err) console.error(err);
											expect(state).to.exist;
											if (!state) {
												console.error(
													'state "fritzdect.0.DECT_119600642220.devicelock" not set'
												);
											} else {
												console.log(
													'fritzdect.0.DECT_119600642220.devicelock      ... ' + state.val
												);
											}
											expect(state.val).to.exist;
											expect(state.val).to.be.equal(false);
											harness.states.getState('fritzdect.0.DECT_119600642220.present', function(
												err,
												state
											) {
												if (err) console.error(err);
												expect(state).to.exist;
												if (!state) {
													console.error(
														'state "fritzdect.0.DECT_119600642220.present" not set'
													);
												} else {
													console.log(
														'fritzdect.0.DECT_119600642220.present          ... ' +
															state.val
													);
												}
												expect(state.val).to.exist;
												expect(state.val).to.be.equal(true);
												harness.states.getState('fritzdect.0.DECT_119600642220.lock', function(
													err,
													state
												) {
													if (err) console.error(err);
													expect(state).to.exist;
													if (!state) {
														console.error(
															'state "fritzdect.0.DECT_119600642220.lock" not set'
														);
													} else {
														console.log(
															'fritzdect.0.DECT_119600642220.lock            ... ' +
																state.val
														);
													}
													expect(state.val).to.exist;
													expect(state.val).to.be.equal(false);
													harness.states.getState(
														'fritzdect.0.DECT_119600642220.komfort',
														function(err, state) {
															if (err) console.error(err);
															expect(state).to.exist;
															if (!state) {
																console.error(
																	'state "fritzdect.0.DECT_119600642220.komfort" not set'
																);
															} else {
																console.log(
																	'fritzdect.0.DECT_119600642220.komfort        ... ' +
																		state.val
																);
															}
															expect(state.val).to.exist;
															expect(state.val).to.be.equal(21);
															harness.states.getState(
																'fritzdect.0.DECT_119600642220.absenk',
																function(err, state) {
																	if (err) console.error(err);
																	expect(state).to.exist;
																	if (!state) {
																		console.error(
																			'state "fritzdect.0.DECT_119600642220.absnek" not set'
																		);
																	} else {
																		console.log(
																			'fritzdect.0.DECT_119600642220.absenk        ... ' +
																				state.val
																		);
																	}
																	expect(state.val).to.exist;
																	expect(state.val).to.be.equal(16);
																	harness.states.getState(
																		'fritzdect.0.DECT_119600642220.tist',
																		function(err, state) {
																			if (err) console.error(err);
																			expect(state).to.exist;
																			if (!state) {
																				console.error(
																					'state "fritzdect.0.DECT_119600642220.tist" not set'
																				);
																			} else {
																				console.log(
																					'fritzdect.0.DECT_119600642220.tist        ... ' +
																						state.val
																				);
																			}
																			expect(state.val).to.exist;
																			expect(state.val).to.be.equal(20);
																			harness.states.getState(
																				'fritzdect.0.DECT_119600642220.celsius',
																				function(err, state) {
																					if (err) console.error(err);
																					expect(state).to.exist;
																					if (!state) {
																						console.error(
																							'state "fritzdect.0.DECT_119600642220.celsius" not set'
																						);
																					} else {
																						console.log(
																							'fritzdect.0.DECT_119600642220.celsius                ... ' +
																								state.val
																						);
																						expect(state.val).to.exist;
																						expect(state.val).to.be.equal(
																							20
																						);
																						resolve();
																					}
																					/* für später, wenn der batteryaufruf schon beim init kommt
																	harness.states.getState('fritzdect.0.DECT_119600642220.battery', function (err, state) {
																		if (err) console.error(err);
																		expect(state).to.exist;
																		if (!state) {
																			console.error('state "fritzdect.0.DECT_119600642220.battery" not set');
																		}
																		else {
																			console.log('fritzdect.0.DECT_119600642220.battery             ... ' + state.val);
																			expect(state.val).to.exist;
																			expect(state.val).to.be.equal('55');
																			resolve();
																		}
																	});
																	*/
																				}
																			);
																		}
																	);
																}
															);
														}
													);
												});
											});
										});
									});
								});
							});
						});
					});
				});
			}).timeout(20000);
			it('set template and check last activated template ', () => {
				return new Promise((resolve) => {
					const harness = getHarness();
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
						await delay(3000);
						//set a command and after fritzbix comm it should be returend in process image
						harness.states.setState(
							'fritzdect.0.template_tmp6F0093-391363146.toggle',
							{ val: true, ack: false },
							async function(err) {
								if (err) {
									console.log(err);
								}
								await delay(1000);
								harness.states.getState('fritzdect.0.template.lasttemplate', function(err, state) {
									if (err) console.error(err);
									expect(state).to.exist;
									if (!state) {
										console.error('state "fritzdect.0.template.lasttemplate" not set');
									} else {
										console.log('fritzdect.0.template.lasttemplate ... ' + state.val);
										expect(state.val).to.exist;
										expect(state.val).to.be.equal('60008');
										resolve();
									}
								});
							}
						);
					});
				});
			}).timeout(20000);
			/*
			it('Command to DECT200 and check the set datapoint after successful communication', () => {
				return new Promise( (resolve) => {
					const harness = getHarness();
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
						await delay(3000);
						//set a command and after fritzbix comm it should be returend in process image
						harness.states.setState('fritzdect.0.DECT_087610006161', {val: false, ack: false, from: 'test.0'}, function (err) {
							if (err) {
								console.log(err);
							}
							checkValueOfState('fritzdect.0.DECT_087610006161', false, function() {
								resolve();
							});
						});

					});
				});
			}).timeout(20000);
			*/
			/*
			it('Should work, to send a message', () => {
				return new Promise( (resolve) => {
					// Create a fresh harness instance each test!
					const harness = getHarness();
					// modification of some starting values

					//schon Teil des iobroker/testing :-)
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
						await delay(1000);

						// Perform the actual test:
						harness.sendTo('fritzdect.0', 'test', 'message', (resp) => {
							console.dir(resp);
							resolve();
						});
					});
				});
			}).timeout(20000);
			*/
		});
	}
});
