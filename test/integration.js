const path = require('path');
const { tests } = require('@iobroker/testing');

const server = require('./lib/fritz_mockserver.js');

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
			it('Fritzdect 200 schould be created', () => {
				return new Promise(async (resolve) => {
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
						await delay(2000);

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
			it('Fritzdect 300 (Comet) schould be created', () => {
				return new Promise(async (resolve) => {
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
						await delay(2000);
						harness.states.getState('fritzdect.0.DECT_117951022222.productname', function(err, state) {
							if (err) console.error(err);
							expect(state).to.exist;
							if (!state) {
								console.error('state "fritzdect.0.DECT_117951022222.productname" not set');
							} else {
								console.log('fritzdect.0.DECT_117951022222.productname        ... ' + state.val);
							}
							expect(state.val).to.exist;
							expect(state.val).to.be.equal('Comet DECT');
							harness.states.getState('fritzdect.0.DECT_117951022222.manufacturer', function(err, state) {
								if (err) console.error(err);
								expect(state).to.exist;
								if (!state) {
									console.error('state "fritzdect.0.DECT_117951022222.manufacturer" not set');
								} else {
									console.log('fritzdect.0.DECT_117951022222.manufacturer    ... ' + state.val);
								}
								expect(state.val).to.exist;
								expect(state.val).to.be.equal('AVM');
								harness.states.getState('fritzdect.0.DECT_117951022222.fwversion', function(
									err,
									state
								) {
									if (err) console.error(err);
									expect(state).to.exist;
									if (!state) {
										console.error('state "fritzdect.0.DECT_117951022222.fwversion" not set');
									} else {
										console.log('fritzdect.0.DECT_117951022222.fwversion       ... ' + state.val);
									}
									expect(state.val).to.exist;
									expect(state.val).to.be.equal('03.54');
									harness.states.getState('fritzdect.0.DECT_117951022222.id', function(err, state) {
										if (err) console.error(err);
										expect(state).to.exist;
										if (!state) {
											console.error('state "fritzdect.0.DECT_117951022222.id" not set');
										} else {
											console.log(
												'fritzdect.0.DECT_117951022222.id              ... ' + state.val
											);
										}
										expect(state.val).to.exist;
										expect(state.val).to.be.equal('20');
										harness.states.getState('fritzdect.0.DECT_117951022222.devicelock', function(
											err,
											state
										) {
											if (err) console.error(err);
											expect(state).to.exist;
											if (!state) {
												console.error(
													'state "fritzdect.0.DECT_117951022222.devicelock" not set'
												);
											} else {
												console.log(
													'fritzdect.0.DECT_117951022222.devicelock        ... ' + state.val
												);
											}
											expect(state.val).to.exist;
											expect(state.val).to.be.equal(true);
											harness.states.getState('fritzdect.0.DECT_117951022222.present', function(
												err,
												state
											) {
												if (err) console.error(err);
												expect(state).to.exist;
												if (!state) {
													console.error(
														'state "fritzdect.0.DECT_117951022222.present" not set'
													);
												} else {
													console.log(
														'fritzdect.0.DECT_117951022222.present         ... ' + state.val
													);
												}
												expect(state.val).to.exist;
												expect(state.val).to.be.equal(true);
												harness.states.getState('fritzdect.0.DECT_117951022222.lock', function(
													err,
													state
												) {
													if (err) console.error(err);
													expect(state).to.exist;
													if (!state) {
														console.error(
															'state "fritzdect.0.DECT_117951022222.lock" not set'
														);
													} else {
														console.log(
															'fritzdect.0.DECT_117951022222.lock            ... ' +
																state.val
														);
													}
													expect(state.val).to.exist;
													expect(state.val).to.be.equal(false);
													harness.states.getState(
														'fritzdect.0.DECT_117951022222.komfort',
														function(err, state) {
															if (err) console.error(err);
															expect(state).to.exist;
															if (!state) {
																console.error(
																	'state "fritzdect.0.DECT_117951022222.komfort" not set'
																);
															} else {
																console.log(
																	'fritzdect.0.DECT_117951022222.komfort        ... ' +
																		state.val
																);
															}
															expect(state.val).to.exist;
															expect(state.val).to.be.equal(19);
															harness.states.getState(
																'fritzdect.0.DECT_117951022222.absenk',
																function(err, state) {
																	if (err) console.error(err);
																	expect(state).to.exist;
																	if (!state) {
																		console.error(
																			'state "fritzdect.0.DECT_117951022222.absenk" not set'
																		);
																	} else {
																		console.log(
																			'fritzdect.0.DECT_117951022222.absenk        ... ' +
																				state.val
																		);
																	}
																	expect(state.val).to.exist;
																	expect(state.val).to.be.equal(15);
																	harness.states.getState(
																		'fritzdect.0.DECT_117951022222.tist',
																		function(
																			/// hier noch was tun
																			err,
																			state
																		) {
																			if (err) console.error(err);
																			expect(state).to.exist;
																			if (!state) {
																				console.error(
																					'state "fritzdect.0.DECT_117951022222.tist" not set'
																				);
																			} else {
																				console.log(
																					'fritzdect.0.DECT_117951022222.tist        ... ' +
																						state.val
																				);
																			}
																			expect(state.val).to.exist;
																			expect(state.val).to.be.equal(20);
																			harness.states.getState(
																				'fritzdect.0.DECT_117951022222.celsius',
																				function(err, state) {
																					if (err) console.error(err);
																					expect(state).to.exist;
																					if (!state) {
																						console.error(
																							'state "fritzdect.0.DECT_117951022222.celsius" not set'
																						);
																					} else {
																						console.log(
																							'fritzdect.0.DECT_117951022222.celsius            ... ' +
																								state.val
																						);
																					}
																					expect(state.val).to.exist;
																					expect(state.val).to.be.equal(20);
																					harness.states.getState(
																						'fritzdect.0.DECT_117951022222.battery',
																						function(err, state) {
																							if (err) console.error(err);
																							expect(state).to.exist;
																							if (!state) {
																								console.error(
																									'state "fritzdect.0.DECT_117951022222.battery" not set'
																								);
																							} else {
																								console.log(
																									'fritzdect.0.DECT_117951022222.battery          ... ' +
																										state.val
																								);
																								expect(state.val).to
																									.exist;
																								expect(
																									state.val
																								).to.be.equal(80);
																							}
																							harness.states.getState(
																								'fritzdect.0.DECT_117951022222.tchange',
																								function(err, state) {
																									if (err)
																										console.error(
																											err
																										);
																									expect(state).to
																										.exist;
																									if (!state) {
																										console.error(
																											'state "fritzdect.0.DECT_117951022222.tchange" not set'
																										);
																									} else {
																										console.log(
																											'fritzdect.0.DECT_117951022222.tchange          ... ' +
																												state.val
																										);
																										expect(
																											state.val
																										).to.exist;
																										expect(
																											state.val
																										).to.be.equal(
																											22
																										);
																									}
																									harness.states.getState(
																										'fritzdect.0.DECT_117951022222.endperiod',
																										function(
																											err,
																											state
																										) {
																											if (err)
																												console.error(
																													err
																												);
																											expect(
																												state
																											).to.exist;
																											if (
																												!state
																											) {
																												console.error(
																													'state "fritzdect.0.DECT_117951022222.endperiod" not set'
																												);
																											} else {
																												console.log(
																													'fritzdect.0.DECT_117951022222.endperiod          ... ' +
																														state.val
																												);
																												expect(
																													state.val
																												).to
																													.exist;
																												expect(
																													state.val
																												).to.be.equal(
																													'2034-01-04T07:00:00.000Z'
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
			it('Fritzdect 300 Comet2 schould be created', () => {
				return new Promise(async (resolve) => {
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
						await delay(2000);
						harness.states.getState('fritzdect.0.DECT_117951033333.productname', function(err, state) {
							if (err) console.error(err);
							expect(state).to.exist;
							if (!state) {
								console.error('state "fritzdect.0.DECT_117951033333.productname" not set');
							} else {
								console.log('fritzdect.0.DECT_117951033333.productname        ... ' + state.val);
							}
							expect(state.val).to.exist;
							expect(state.val).to.be.equal('Comet DECT window und boost');
							harness.states.getState('fritzdect.0.DECT_117951033333.manufacturer', function(err, state) {
								if (err) console.error(err);
								expect(state).to.exist;
								if (!state) {
									console.error('state "fritzdect.0.DECT_117951033333.manufacturer" not set');
								} else {
									console.log('fritzdect.0.DECT_117951033333.manufacturer    ... ' + state.val);
								}
								expect(state.val).to.exist;
								expect(state.val).to.be.equal('AVM');
								harness.states.getState('fritzdect.0.DECT_117951033333.fwversion', function(
									err,
									state
								) {
									if (err) console.error(err);
									expect(state).to.exist;
									if (!state) {
										console.error('state "fritzdect.0.DECT_117951033333.fwversion" not set');
									} else {
										console.log('fritzdect.0.DECT_11795103333.fwversion       ... ' + state.val);
									}
									expect(state.val).to.exist;
									expect(state.val).to.be.equal('03.54');
									harness.states.getState('fritzdect.0.DECT_117951033333.id', function(err, state) {
										if (err) console.error(err);
										expect(state).to.exist;
										if (!state) {
											console.error('state "fritzdect.0.DECT_117951033333.id" not set');
										} else {
											console.log(
												'fritzdect.0.DECT_117951033333.id              ... ' + state.val
											);
										}
										expect(state.val).to.exist;
										expect(state.val).to.be.equal('20');
										harness.states.getState('fritzdect.0.DECT_117951033333.devicelock', function(
											err,
											state
										) {
											if (err) console.error(err);
											expect(state).to.exist;
											if (!state) {
												console.error(
													'state "fritzdect.0.DECT_117951033333.devicelock" not set'
												);
											} else {
												console.log(
													'fritzdect.0.DECT_117951033333.devicelock        ... ' + state.val
												);
											}
											expect(state.val).to.exist;
											expect(state.val).to.be.equal(true);
											harness.states.getState('fritzdect.0.DECT_117951033333.present', function(
												err,
												state
											) {
												if (err) console.error(err);
												expect(state).to.exist;
												if (!state) {
													console.error(
														'state "fritzdect.0.DECT_117951033333.present" not set'
													);
												} else {
													console.log(
														'fritzdect.0.DECT_117951033333.present         ... ' + state.val
													);
												}
												expect(state.val).to.exist;
												expect(state.val).to.be.equal(true);
												harness.states.getState('fritzdect.0.DECT_117951033333.lock', function(
													err,
													state
												) {
													if (err) console.error(err);
													expect(state).to.exist;
													if (!state) {
														console.error(
															'state "fritzdect.0.DECT_117951033333.lock" not set'
														);
													} else {
														console.log(
															'fritzdect.0.DECT_117951033333.lock            ... ' +
																state.val
														);
													}
													expect(state.val).to.exist;
													expect(state.val).to.be.equal(false);
													harness.states.getState(
														'fritzdect.0.DECT_117951033333.komfort',
														function(err, state) {
															if (err) console.error(err);
															expect(state).to.exist;
															if (!state) {
																console.error(
																	'state "fritzdect.0.DECT_117951033333.komfort" not set'
																);
															} else {
																console.log(
																	'fritzdect.0.DECT_117951033333.komfort        ... ' +
																		state.val
																);
															}
															expect(state.val).to.exist;
															expect(state.val).to.be.equal(19);
															harness.states.getState(
																'fritzdect.0.DECT_117951033333.absenk',
																function(err, state) {
																	if (err) console.error(err);
																	expect(state).to.exist;
																	if (!state) {
																		console.error(
																			'state "fritzdect.0.DECT_117951033333.absenk" not set'
																		);
																	} else {
																		console.log(
																			'fritzdect.0.DECT_117951033333.absenk        ... ' +
																				state.val
																		);
																	}
																	expect(state.val).to.exist;
																	expect(state.val).to.be.equal(15);
																	harness.states.getState(
																		'fritzdect.0.DECT_117951033333.tist',
																		function(err, state) {
																			if (err) console.error(err);
																			expect(state).to.exist;
																			if (!state) {
																				console.error(
																					'state "fritzdect.0.DECT_117951033333.tist" not set'
																				);
																			} else {
																				console.log(
																					'fritzdect.0.DECT_117951033333.tist        ... ' +
																						state.val
																				);
																			}
																			expect(state.val).to.exist;
																			expect(state.val).to.be.equal(20);
																			harness.states.getState(
																				'fritzdect.0.DECT_117951033333.celsius',
																				function(err, state) {
																					if (err) console.error(err);
																					expect(state).to.exist;
																					if (!state) {
																						console.error(
																							'state "fritzdect.0.DECT_117951033333.celsius" not set'
																						);
																					} else {
																						console.log(
																							'fritzdect.0.DECT_117951033333.celsius            ... ' +
																								state.val
																						);
																					}
																					expect(state.val).to.exist;
																					expect(state.val).to.be.equal(20);
																					harness.states.getState(
																						'fritzdect.0.DECT_117951033333.battery',
																						function(err, state) {
																							if (err) console.error(err);
																							expect(state).to.exist;
																							if (!state) {
																								console.error(
																									'state "fritzdect.0.DECT_117951033333.battery" not set'
																								);
																							} else {
																								console.log(
																									'fritzdect.0.DECT_117951033333.battery          ... ' +
																										state.val
																								);
																								expect(state.val).to
																									.exist;
																								expect(
																									state.val
																								).to.be.equal(80);
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
			/*
			it('Should work, to send a message', () => {
				return new Promise(async (resolve) => {
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
