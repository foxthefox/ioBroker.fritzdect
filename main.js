'use strict';

/*
 * Created with @iobroker/create-adapter v1.31.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
// const fs = require("fs");
const Fritz = require('./lib/fritzhttp.js');
const parser = require('xml2json-light');

let fritzTimeout;

/* errorcodes hkr
0: kein Fehler
1: Keine Adaptierung möglich. Gerät korrekt am Heizkörper montiert?
2: Ventilhub zu kurz oder Batterieleistung zu schwach. Ventilstößel per Hand mehrmals öfnen und schließen oder neue Batterien einsetzen.
3: Keine Ventilbewegung möglich. Ventilstößel frei?
4: Die Installation wird gerade vorbereitet.
5: Der Heizkörperregler ist im Installationsmodus und kann auf das Heizungsventil montiert werden.
6: Der Heizkörperregler passt sich nun an den Hub des Heizungsventils an.
*/

/* HANFUN unittypes
256 = SIMPLE_ON_OFF_SWITCHABLE
257 = SIMPLE_ON_OFF_SWITCH
262 = AC_OUTLET
263 = AC_OUTLET_SIMPLE_POWER_METERING
264 = SIMPLE_LIGHT 265 = DIMMABLE_LIGHT
266 = DIMMER_SWITCH
273 = SIMPLE_BUTTON
277 = COLOR_BULB
278 = DIMMABLE_COLOR_BULB
281 = BLIND
282 = LAMELLAR
512 = SIMPLE_DETECTOR
513 = DOOR_OPEN_CLOSE_DETECTOR
514 = WINDOW_OPEN_CLOSE_DETECTOR
515 = MOTION_DETECTOR
518 = FLOOD_DETECTOR
519 = GLAS_BREAK_DETECTOR
520 = VIBRATION_DETECTOR
640 = SIREN
*/

/* HANFUN interfaces
256 = ALERT
277 = KEEP_ALIVE
512 = ON_OFF
513 = LEVEL_CTRL
514 = COLOR_CTRL
516 = ? detected with blinds, different alert?
517 = ? detected with blinds, different alerttimestamp
772 = SIMPLE_BUTTON
1024 = SUOTA-Update
*/

/* modes of DECT500 supported/current_mode
0 = nothing, because OFF or not present
1 = HueSaturation-Mode
2 =
3 =
4 = Colortemperature-Mode
5 =
*/

const settings = { Username: '', Password: '', moreParam: '', strictSsl: true, intervall: 300 };

class Fritzdect extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'fritzdect'
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		// this.on('objectChange', this.onObjectChange.bind(this));
		this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
		//this.errorHandler.bind(this);
		this.systemConfig = {};
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here
		try {
			// Load user settings
			settings.Username = this.config.fritz_user;
			settings.Password = this.config.fritz_pw;
			settings.moreParam = this.config.fritz_ip;
			settings.strictSsl = this.config.fritz_strictssl;
			settings.intervall = this.config.fritz_interval;

			// Reset the connection indicator during startup
			this.setStateAsync('info.connection', false, true);

			// The adapters config (in the instance object everything under the attribute "native") is accessible via
			// this.config:
			this.log.info('fritzdect entered ready');

			const sysConf = await this.getForeignObjectAsync('system.config');
			if (sysConf && sysConf.common) {
				this.systemConfig = sysConf.common;
			} else {
				throw `ioBroker system configuration not found.`;
			}

			// Check if credentials are not empty and decrypt stored password
			if (settings.Username !== '' && settings.Password !== '') {
				this.log.debug(' das' + settings.Username + '-' + settings.Password + '-');
				this.getForeignObject('system.config', async (err, obj) => {
					if (obj && obj.native && obj.native.secret) {
						//noinspection JSUnresolvedVariable
						settings.Password = this.decrypt(obj.native.secret, settings.Password); // this.config.fritz_pw);
					} else {
						//noinspection JSUnresolvedVariable
						settings.Password = this.decrypt('Zgfr56gFe87jJOM', settings.Password);
					}
					// Adapter is alive, make API call
					this.setForeignState('system.this.' + this.namespace + '.alive', false);

					// Make a call to fritzboxAPI and get a list devices/groups and templates

					const fritz = new Fritz(
						settings.Username,
						settings.Password,
						settings.moreParam || '',
						settings.strictSsl || true
					);

					await this.createDevices(fritz);
					await this.createTemplates(fritz);
					await this.pollFritzData(fritz);
				});
			} else {
				this.log.error('*** Adapter deactivated, credentials missing in Adaptper Settings !!!  ***');
				this.setForeignState('system.this.' + this.namespace + '.alive', false);
			}

			// in this template all states changes inside the adapters namespace are subscribed
			this.subscribeStates('*');

			// examples for the checkPassword/checkGroup functions
			let result = await this.checkPasswordAsync('admin', 'iobroker');
			this.log.info('check user admin pw iobroker: ' + result);

			result = await this.checkGroupAsync('admin', 'admin');
			this.log.info('check group user admin group admin: ' + result);
		} catch (error) {
			this.log.error('[asyncOnReady()]' + error);
			this.setState('info.connection', false, true); // change to yellow
			return;
		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);
			if (fritzTimeout) clearTimeout(fritzTimeout);
			this.log.info('cleaned everything up...');
			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	async onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
			this.log.debug('STATE CHANGE ' + JSON.stringify(settings));
			const fritz = new Fritz(
				settings.Username,
				settings.Password,
				settings.moreParam || '',
				settings.strictSsl || true
			);
			//const fritz = new Fritz(settings.Username, settings.Password, settings.moreParam || '', settings.strictSsl || true);

			// you can use the ack flag to detect if it is status (true) or command (false)
			if (state && !state.ack && state.val !== null && id !== null) {
				this.log.debug('ack is not set! -> command');
				const tmp = id.split('.');
				const dp = tmp.pop();
				const idx = tmp.pop(); //is the name after fritzdect.x.
				// devices or groups
				if (idx && idx !== null) {
					if (idx.startsWith('DECT_')) {
						// braucht man nicht wenn kein toggle in devices vorkommt
						id = idx.replace(/DECT_/g, ''); //Thermostat
						this.log.info('DECT ID: ' + id + ' identified for command (' + dp + ') : ' + state.val);
						if (dp === 'tsoll') {
							if (state.val < 8) {
								//kann gelöscht werden, wenn Temperaturvorwahl nicht zur Moduswahl benutzt werden soll
								await this.setStateAsync('DECT_' + id + '.hkrmode', { val: 1, ack: false }); //damit das Ventil auch regelt
								fritz
									.setTempTarget(id, 'off')
									.then((sid) => {
										this.log.debug('Switched Mode' + id + ' to closed');
									})
									.catch((e) => this.errorHandler(e));
							} else if (state.val > 28) {
								//kann gelöscht werden, wenn Temperaturvorwahl nicht zur Moduswahl benutzt werden soll
								await this.setStateAsync('DECT_' + id + '.hkrmode', { val: 2, ack: false }); //damit das Ventil auch regelt
								fritz
									.setTempTarget(id, 'on')
									.then(() => {
										this.log.debug('Switched Mode' + id + ' to opened permanently');
									})
									.catch((e) => this.errorHandler(e));
							} else {
								await this.setStateAsync('DECT_' + id + '.hkrmode', { val: 0, ack: false }); //damit das Ventil auch regelt
								fritz
									.setTempTarget(id, state.val)
									.then(async () => {
										this.log.debug('Set target temp ' + id + state.val + ' °C');
										await this.setStateAsync('DECT_' + id + '.lasttarget', {
											val: state.val,
											ack: true
										}); //iobroker Tempwahl wird zum letzten Wert gespeichert
										await this.setStateAsync('DECT_' + id + '.tsoll', {
											val: state.val,
											ack: true
										}); //iobroker Tempwahl wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
									})
									.catch((e) => this.errorHandler(e));
							}
						} else if (dp === 'mode') {
							if (state.val === 0) {
								this.getState('DECT_' + id + '.tsoll', async (err, targettemp) => {
									// oder hier die Verwendung von lasttarget
									if (targettemp && targettemp.val !== null) {
										if (targettemp.val) {
											let setTemp = targettemp.val;
											if (setTemp < 8) {
												this.setStateAsync('DECT_' + id + '.tsoll', { val: 8, ack: true });
												setTemp = 8;
											} else if (setTemp > 28) {
												this.setStateAsync('DECT_' + id + '.tsoll', { val: 28, ack: true });
												setTemp = 28;
											}
											fritz
												.setTempTarget(id, setTemp)
												.then(async () => {
													this.log.debug('Set target temp ' + id + ' ' + setTemp + ' °C');
													await this.setStateAsync('DECT_' + id + '.tsoll', {
														val: setTemp,
														ack: true
													}); //iobroker Tempwahl wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
												})
												.catch((e) => this.errorHandler(e));
										} else {
											this.log.error('no data in targettemp for setting mode');
										}
									} else {
										throw { error: ' targettemp is NULL ' };
									}
								});
							} else if (state.val === 1) {
								fritz
									.setTempTarget(id, 'off')
									.then((sid) => {
										this.log.debug('Switched Mode' + id + ' to closed.');
									})
									.catch((e) => this.errorHandler(e));
							} else if (state.val === 2) {
								fritz
									.setTempTarget(id, 'on')
									.then((sid) => {
										this.log.debug('Switched Mode' + id + ' to opened permanently');
									})
									.catch((e) => this.errorHandler(e));
							}
						}
						if (dp == 'boostactivetime') {
							this.log.debug(
								'Nothing to send external, but the boost active time was defined for ' +
									state.val +
									' min'
							);
						}
						if (dp == 'boostactive') {
							if (
								state.val === 0 ||
								state.val === '0' ||
								state.val === 'false' ||
								state.val === false ||
								state.val === 'off' ||
								state.val === 'OFF'
							) {
								fritz
									.setHkrBoost(id, 0)
									.then(() => {
										this.log.debug('Reset thermostat boost ' + id + ' to ' + state.val);
										this.setStateAsync('DECT_' + id + '.boostactive', {
											val: state.val,
											ack: true
										}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
									})
									.catch((e) => this.errorHandler(e));
							} else if (
								state.val === 1 ||
								state.val === '1' ||
								state.val === 'true' ||
								state.val === true ||
								state.val === 'on' ||
								state.val === 'ON'
							) {
								this.getState('DECT_' + id + '.boostactivetime', async (err, minutes) => {
									if (minutes && minutes.val !== null) {
										const jetzt = +new Date();
										const ende = Math.floor(jetzt / 1000 + Number(minutes.val) * 60); //time for fritzbox is in seconds
										this.log.debug(' unix returned ' + ende + ' real ' + new Date(ende * 1000));
										fritz
											.setHkrBoost(id, ende)
											.then((body) => {
												const endtime = new Date(Math.floor(body * 1000));
												this.log.debug('window ' + body + ' reading to ' + endtime);
												this.log.debug(
													'Set thermostat boost ' +
														id +
														' to ' +
														state.val +
														' until calculated ' +
														ende +
														' ' +
														new Date(ende * 1000)
												);
												this.setStateAsync('DECT_' + id + '.boostactive', {
													val: state.val,
													ack: true
												}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
												this.setStateAsync('DECT_' + id + '.boostactiveendtime', {
													val: endtime,
													ack: true
												}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
											})
											.catch((e) => this.errorHandler(e));
									} else {
										throw { error: 'minutes were NULL' };
									}
								});
							}
						}
						if (dp == 'windowopenactivetime') {
							this.log.debug(
								'Nothing to send external, but the window open active time was defined for ' +
									state.val +
									' min'
							);
						}
						if (dp == 'windowopenactiv') {
							if (
								state.val === 0 ||
								state.val === '0' ||
								state.val === 'false' ||
								state.val === false ||
								state.val === 'off' ||
								state.val === 'OFF'
							) {
								fritz
									.setWindowOpen(id, 0)
									.then(async (sid) => {
										this.log.debug('Reset thermostat windowopen ' + id + ' to ' + state.val);
										await this.setStateAsync('DECT_' + id + '.windowopenactiv', {
											val: state.val,
											ack: true
										}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
									})
									.catch((e) => this.errorHandler(e));
							} else if (
								state.val === 1 ||
								state.val === '1' ||
								state.val === 'true' ||
								state.val === true ||
								state.val === 'on' ||
								state.val === 'ON'
							) {
								this.getState('DECT_' + id + '.windowopenactivetime', async (err, minutes) => {
									if (minutes && minutes.val !== null) {
										const jetzt = +new Date();
										const ende = Math.floor(jetzt / 1000 + Number(minutes.val) * 60); //time for fritzbox is in seconds
										this.log.debug(' unix ' + ende + ' real ' + new Date(ende * 1000));
										fritz
											.setWindowOpen(id, ende)
											.then(async (body) => {
												const endtime = new Date(Math.floor(body * 1000));
												this.log.debug('window ' + body + ' reading to ' + endtime);
												this.log.debug(
													'Set thermostat windowopen ' +
														id +
														' to ' +
														state.val +
														' until calculated ' +
														ende +
														' ' +
														new Date(ende * 1000)
												);
												await this.setStateAsync('DECT_' + id + '.windowopenactiv', {
													val: state.val,
													ack: true
												}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
												await this.setStateAsync('DECT_' + id + '.windowopenactiveendtime', {
													val: endtime,
													ack: true
												}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
											})
											.catch((e) => this.errorHandler(e));
									} else {
										throw { error: 'minutes were NULL' };
									}
								});
							}
						}
						if (dp == 'state') {
							if (
								state.val === 0 ||
								state.val === '0' ||
								state.val === 'false' ||
								state.val === false ||
								state.val === 'off' ||
								state.val === 'OFF'
							) {
								fritz
									.setSwitchOff(id)
									.then(async (sid) => {
										this.log.debug('Turned switch ' + id + ' off');
										await this.setStateAsync('DECT_' + id + '.state', { val: false, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
									})
									.catch((e) => this.errorHandler(e));
							} else if (
								state.val === 1 ||
								state.val === '1' ||
								state.val === 'true' ||
								state.val === true ||
								state.val === 'on' ||
								state.val === 'ON'
							) {
								fritz
									.setSwitchOn(id)
									.then(async (sid) => {
										this.log.debug('Turned switch ' + id + ' on');
										await this.setStateAsync('DECT_' + id + '.state', { val: true, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
									})
									.catch((e) => this.errorHandler(e));
							}
						}
						if (dp == 'blindsclose') {
							fritz
								.setBlind(id, 'close')
								.then(async (sid) => {
									this.log.debug('Started blind ' + id + ' to close');
									await this.setStateAsync('DECT_' + id + '.blindsclose', { val: false, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch((e) => this.errorHandler(e));
						}
						if (dp == 'blindsopen') {
							fritz
								.setBlind(id, 'open')
								.then(async (sid) => {
									this.log.debug('Started blind ' + id + ' to open');
									await this.setStateAsync('DECT_' + id + '.blindsopen', { val: false, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch((e) => this.errorHandler(e));
						}
						if (dp == 'blindsstop') {
							fritz
								.setBlind(id, 'stop')
								.then(async (sid) => {
									this.log.debug('Set blind ' + id + ' to stop');
									await this.setStateAsync('DECT_' + id + '.blindsstop', { val: false, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch((e) => this.errorHandler(e));
						}
						if (dp == 'level') {
							fritz
								.setLevel(id, state.val)
								.then(async (sid) => {
									this.log.debug('Set level' + id + ' to ' + state.val);
									await this.setStateAsync('DECT_' + id + '.level', { val: state.val, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch((e) => this.errorHandler(e));
						}
						if (dp == 'levelpercentage') {
							fritz
								.setLevel(id, Math.floor(Number(state.val) / 100 * 255))
								.then(async (sid) => {
									//level is in 0...255
									this.log.debug('Set level %' + id + ' to ' + state.val);
									await this.setStateAsync('DECT_' + id + '.levelpercentage', {
										val: state.val,
										ack: true
									}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch((e) => this.errorHandler(e));
						}
						if (dp == 'hue') {
							this.getState('DECT_' + id + '.saturation', async (err, saturation) => {
								if (saturation && saturation.val !== null) {
									// oder hier die Verwendung von lasttarget
									const setSaturation = saturation.val;
									if (setSaturation == '') {
										this.log.error(
											'No saturation value exists when setting hue, please set saturation to a value '
										);
									} else {
										fritz
											.setColor(id, setSaturation, state.val)
											.then(async (sid) => {
												this.log.debug(
													'Set lamp color hue ' +
														id +
														' to ' +
														state.val +
														' and saturation of ' +
														setSaturation
												);
												await this.setStateAsync('DECT_' + id + '.hue', {
													val: state.val,
													ack: true
												}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
											})
											.catch((e) => this.errorHandler(e));
									}
								} else {
									throw { error: 'minutes were NULL' };
								}
							});
						}
						if (dp == 'saturation') {
							this.getState('DECT_' + id + '.hue', async (err, hue) => {
								if (hue && hue.val !== null) {
									const setHue = hue.val;
									if (setHue == '') {
										this.log.error(
											'No hue value exists when setting saturation, please set hue to a value '
										);
									} else {
										fritz
											.setColor(id, state.val, setHue)
											.then(async (sid) => {
												this.log.debug(
													'Set lamp color saturation ' +
														id +
														' to ' +
														state.val +
														' and hue of ' +
														setHue
												);
												await this.setStateAsync('DECT_' + id + '.saturation', {
													val: state.val,
													ack: true
												}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
											})
											.catch((e) => this.errorHandler(e));
									}
								} else {
									throw { error: 'hue were NULL' };
								}
							});
						}
						if (dp == 'temperature') {
							fritz
								.setColorTemperature(id, state.val)
								.then(async (sid) => {
									this.log.debug('Set lamp color temperature ' + id + ' to ' + state.val);
									await this.setStateAsync('DECT_' + id + '.temperature', {
										val: state.val,
										ack: true
									}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch((e) => this.errorHandler(e));
						}
					} else if (idx.startsWith('template_')) {
						//must be fritzbox template
						id = idx.replace(/template_/g, ''); //template
						this.log.info('Template ID: ' + id + ' identified for command (' + dp + ') : ' + state.val);
						if (dp == 'toggle') {
							if (
								state.val === 1 ||
								state.val === '1' ||
								state.val === 'true' ||
								state.val === true ||
								state.val === 'on' ||
								state.val === 'ON'
							) {
								fritz
									.applyTemplate(id)
									.then(async (sid) => {
										this.log.debug('cmd Toggle to template ' + id + ' on');
										this.log.debug('response ' + sid);
										await this.setStateAsync('template.lasttemplate', { val: sid, ack: true }); //when successfull toggle, the API returns the id of the template
									})
									.catch((e) => this.errorHandler(e));
							}
						}
					}
				}
			} //from if state&ack
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	onMessage(obj) {
		let wait = false;
		if (typeof obj === 'object' && obj.message) {
			// if (obj) {
			if (obj.command === 'send') {
				// e.g. send email or pushover or whatever
				this.log.info('send command');

				// Send response in callback if required
				if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
			}
			if (obj) {
				let result = [];
				this.log.debug('Message ' + JSON.stringify(settings));
				const fritz = new Fritz(
					settings.Username,
					settings.Password,
					settings.moreParam || '',
					settings.strictSsl || true
				);
				// const fritz = new Fritz(settings.Username, settings.Password, settings.moreParam || '', settings.strictSsl || true);

				switch (obj.command) {
					case 'devices':
						fritz
							.getDeviceListInfos()
							.then((devicelistinfos) => {
								let devices = parser.xml2json(devicelistinfos);
								devices = [].concat((devices.devicelist || {}).device || []).map(function(device) {
									// remove spaces in AINs
									// device.identifier = device.identifier.replace(/\s/g, '');
									return device;
								});
								result = devices;
							})
							.then(async () => {
								if (obj.callback) this.sendTo(obj.from, obj.command, result, obj.callback);
							});

						wait = true;
						break;
					case 'groups':
						fritz
							.getDeviceListInfos()
							.then((devicelistinfos) => {
								let groups = parser.xml2json(devicelistinfos);
								groups = [].concat((groups.devicelist || {}).group || []).map(function(group) {
									// remove spaces in AINs
									// group.identifier = group.identifier.replace(/\s/g, '');
									return group;
								});
								result = groups;
							})
							.then(async () => {
								if (obj.callback) this.sendTo(obj.from, obj.command, result, obj.callback);
							});
						wait = true;
						break;
					case 'templates':
						fritz
							.getTemplateListInfos()
							.then(function(templatelistinfos) {
								let templates = parser.xml2json(templatelistinfos);
								templates = []
									.concat((templates.templatelist || {}).template || [])
									.map(function(template) {
										// remove spaces in AINs
										// template.identifier = group.identifier.replace(/\s/g, '');
										return template;
									});
								result = templates;
							})
							.then(async () => {
								if (obj.callback) this.sendTo(obj.from, obj.command, result, obj.callback);
							});
						wait = true;
						break;
					case 'statistic':
						fritz
							.getBasicDeviceStats(obj.message) //ain muß übergeben werden
							.then(function(statisticinfos) {
								//obj.message should be ain of device requested
								const devicestats = parser.xml2json(statisticinfos);
								result = devicestats;
							})
							.then(async () => {
								if (obj.callback) this.sendTo(obj.from, obj.command, result, obj.callback);
							});
						wait = true;
						break;
					case 'color':
						fritz
							.getColorDefaults()
							.then(function(colorinfos) {
								result = colorinfos;
							})
							.then(async () => {
								if (obj.callback) this.sendTo(obj.from, obj.command, result, obj.callback);
							});
						wait = true;
						break;
					//idea for other statistics: call of message returns everything (loop over all devices)
					default:
						this.log.warn('Received unhandled message: ' + obj.command);
						break;
				}
			}
			if (!wait && obj.callback) {
				this.sendTo(obj.from, obj.command, obj.message, obj.callback);
			}
		}
	}

	decrypt(key, value) {
		let result = '';
		for (let i = 0; i < value.length; ++i) {
			result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
		}
		return result;
	}

	errorHandler(error) {
		try {
			this.log.error('fritzbox returned this ' + JSON.stringify(error));
			if (error == '0000000000000000') {
				this.log.error('Did not get session id- invalid username or password?');
			} else if (!error.response) {
				this.log.error('no response part in returned message');
			} else if (error.response.statusCode) {
				if (error.response.statusCode == 403) {
					this.log.error(
						'no permission for this call (403), has user all the rights and access to fritzbox?'
					);
					this.log.error('error calling the fritzbox ' + JSON.stringify(error));
				} else if (error.response.statusCode == 404) {
					this.log.error('call to API does not exist! (404)');
					this.log.error('error calling the fritzbox ' + JSON.stringify(error));
				} else if (error.response.statusCode == 400) {
					this.log.error('bad request (400), ain correct?');
					this.log.error('error calling the fritzbox ' + JSON.stringify(error));
				} else if (error.response.statusCode == 500) {
					this.log.error('internal fritzbox error (500)');
					this.log.error('error calling the fritzbox ' + JSON.stringify(error));
				} else if (error.response.statusCode == 503) {
					this.log.error('service unavailable (503)');
					this.log.error('error calling the fritzbox ' + JSON.stringify(error));
				} else if (error.response.statusCode == 303) {
					this.log.error('unknwon error (303)');
					this.log.error('error calling the fritzbox ' + JSON.stringify(error));
				} else {
					this.log.error('statuscode not in errorHandler of fritzdect');
					this.log.error('error calling the fritzbox ' + JSON.stringify(error));
				}
			} else {
				this.log.error('error calling the fritzbox ' + JSON.stringify(error));
			}
		} catch (e) {
			this.log.error('errorHandler' + e);
			throw e;
		}
	}

	async pollFritzData(fritz) {
		const fritz_interval = settings.intervall || 300;
		await this.updateDevices(fritz); // für alle Objekte, da in xml/json mehr enthalten als in API-Aufrufe
		this.log.debug('polling! fritzdect is alive');
		fritzTimeout = setTimeout(this.pollFritzData, fritz_interval * 1000);
	}
	async updateDevices(fritz) {
		this.log.debug('__________________________');
		this.log.debug('updating Devices / Groups ');
		await fritz
			.getDeviceListInfos()
			.then(async (devicelistinfos) => {
				let currentMode = null;
				this.log.debug('server answer for updates ' + JSON.stringify(devicelistinfos));
				let devices = parser.xml2json(devicelistinfos);
				// devices
				devices = [].concat((devices.devicelist || {}).device || []).map(async (device) => {
					// remove spaces in AINs
					//device.identifier = device.identifier.replace(/\s/g, '');
					return device;
				});
				this.log.debug('devices\n');
				this.log.debug(JSON.stringify(devices));
				if (devices.length) {
					this.log.debug('update Devices ' + devices.length);
					try {
						for (let i = 0; i < devices.length; i++) {
							this.log.debug('_____________________________________________');
							this.log.debug('updating Device ' + devices[i].name);
							if (
								devices[i].present === '0' ||
								devices[i].present === 0 ||
								devices[i].present === false
							) {
								this.log.debug(
									'DECT_' +
										devices[i].identifier.replace(/\s/g, '') +
										' is not present, check the device connection, no values are written'
								);
								return;
							} else {
								if (devices[i].hkr) {
									currentMode = 'On';
									if (devices[i].hkr.tsoll === devices[i].hkr.komfort) {
										currentMode = 'Comfort';
									}
									if (devices[i].hkr.tsoll === devices[i].hkr.absenk) {
										currentMode = 'Night';
									}
								}
								// some manipulation for values in etsunitinfo, even the etsidevice is having a separate identifier, the manipulation takes place with main object
								// some weird id usage, the website shows the id of the etsiunit
								if (devices[i].etsiunitinfo) {
									if (devices[i].etsiunitinfo.etsideviceid) {
										//replace id with etsi
										this.log.debug('id vorher ' + devices[i].id);
										devices[i].id = devices[i].etsiunitinfo.etsideviceid;
										this.log.debug('id nachher ' + devices[i].id);
									}
								}
								// some devices deliver the HAN-FUN info separately and the only valuable is the FW version, to be inserted in the main object
								if (devices[i].functionbitmask == 1) {
									this.log.debug(' functionbitmask 1');
									// search and find the device id and replace fwversion
									// todo
									// find the device.identifier mit der etsi_id
									// manipulation der device[i].identifier = gefundene identifier und dann durchlaufen lassen
									// reihenfolge, id immer vorher und dann erst etsi in json?
									continue;
								} else {
									this.log.debug(' calling update data .....');
									try {
										await this.updateData(devices[i], devices[i].identifier.replace(/\s/g, ''));
									} catch (e) {
										this.log.error(' issue updating device ' + JSON.stringify(e));
										throw {
											msg: 'issue updating device',
											function: 'updateDevices',
											error: e
										};
									}
								}
							}
						}
					} catch (e) {
						this.log.error(' issue updating device ' + JSON.stringify(e));
						throw {
							msg: 'issue updating device',
							function: 'updateDevices',
							error: e
						};
					}
				}

				// groups
				let groups = parser.xml2json(devicelistinfos);
				groups = [].concat((groups.devicelist || {}).group || []).map(async (group) => {
					// remove spaces in AINs
					// group.identifier = group.identifier.replace(/\s/g, '');
					return group;
				});
				this.log.debug('groups\n');
				this.log.debug(JSON.stringify(groups));
				if (groups.length) {
					this.log.debug('update Groups ' + groups.length);
					groups.forEach(async (device) => {
						this.log.debug('updating Group ' + groups.name);
						if (device.present === '0' || device.present === 0 || device.present === false) {
							this.log.debug(
								'DECT_' +
									device.identifier.replace(/\s/g, '') +
									' is not present, check the device connection, no values are written'
							);
						} else {
							if (device.hkr) {
								currentMode = 'On';
								if (device.hkr.tsoll === device.hkr.komfort) {
									currentMode = 'Comfort';
								}
								if (device.hkr.tsoll === device.hkr.absenk) {
									currentMode = 'Night';
								}
							}
							try {
								this.log.debug(' calling update data .....');
								this.updateData(device, device.identifier.replace(/\s/g, ''));
							} catch (e) {
								this.log.error(' issue updating group ' + JSON.stringify(e));
								throw {
									msg: 'issue updating group',
									function: 'updateDevices',
									error: e
								};
							}
						}
					});
				}
			})
			.catch((e) => this.errorHandler(e));
	}
	async updateData(array, ident) {
		this.log.debug('======================================');
		this.log.debug('With ' + ident + ' got the following device/group to parse ' + JSON.stringify(array));
		try {
			Object.entries(array).forEach(async ([ key, value ]) => {
				if (Array.isArray(value)) {
					this.log.debug('processing datapoint ' + key + ' as array');
					value.forEach(async (subarray) => {
						//subarray.identifier = subarray.identifier.replace(/\s/g, '');
						await this.updateData(
							subarray,
							ident + '.' + key + '.' + subarray.identifier.replace(/\s/g, '')
						); // hier wirds erst schwierig wenn array in array
					});
				} else if (typeof value === 'object' && value !== null) {
					this.log.debug('processing datapoint ' + key + ' as object');
					Object.entries(value).forEach(async ([ key2, value2 ]) => {
						this.log.debug(' object transfer ' + key2 + '  ' + value2 + '  ' + ident);
						await this.updateDatapoint(key2, value2, ident);
					});
				} else {
					this.log.debug('processing datapoint ' + key + ' directly');
					await this.updateDatapoint(key, value, ident);
				}
			});
		} catch (e) {
			this.log.debug(' issue in update data ' + JSON.stringify(e));
			throw {
				msg: 'issue updating data',
				function: 'updateData',
				error: e
			};
		}
	}

	async updateDatapoint(key, value, ain) {
		this.log.debug('updating data DECT_' + ain + ' : ' + key + ' : ' + value);
		try {
			if (!value || value == '') {
				this.log.debug(' no value for updating in ' + key);
				await this.setStateAsync('DECT_' + ain + '.' + key, {
					val: null,
					ack: true
				});
			} else {
				if (key == 'nextchange') {
					//fasthack anstatt neue objekterkennung
					await this.updateData(value, ain);
				} else if (
					key == 'identifier' ||
					key == 'functionbitmask' ||
					key == 'etsideviceid' ||
					key == 'unittype' ||
					key == 'interfaces'
				) {
					// skip it
				} else if (key === 'batterylow') {
					// bool mal anders herum
					const batt = value == 0 ? false : true;
					/*
				if (value == 0) {
					let batt = false;
				} else {
					let batt = true;
				}
				*/
					await this.setStateAsync('DECT_' + ain + '.' + key, {
						val: batt,
						ack: true
					});
				} else if (key == 'celsius' || key == 'offset') {
					//numbers
					await this.setStateAsync('DECT_' + ain + '.' + key, {
						val: parseFloat(value) / 10,
						ack: true
					});
				} else if (key == 'power' || key == 'voltage') {
					await this.setStateAsync('DECT_' + ain + '.' + key, {
						val: parseFloat(value) / 1000,
						ack: true
					});
				} else if (key == 'komfort' || key == 'absenk' || key == 'tist' || key == 'tchange') {
					await this.setStateAsync('DECT_' + ain + '.' + key, {
						val: parseFloat(value) / 2,
						ack: true
					});
				} else if (key == 'humidity') {
					//e.g humidity
					await this.setStateAsync('DECT_' + ain + '.' + key, {
						val: parseFloat(value),
						ack: true
					});
				} else if (key == 'tsoll') {
					if (value < 57) {
						// die Abfrage auf <57 brauchen wir wahrscheinlich nicht
						await this.setStateAsync('DECT_' + ain + '.tsoll', {
							val: parseFloat(value) / 2,
							ack: true
						});
						await this.setStateAsync('DECT_' + ain + '.lasttarget', {
							val: parseFloat(value) / 2,
							ack: true
						}); // zum Nachführen der Soll-Temperatur wenn außerhalb von iobroker gesetzt
						await this.setStateAsync('DECT_' + ain + '.hkrmode', {
							val: 0,
							ack: true
						});
						//always control if in absenk or komfort
						const currentMode = 'Auto';
						await this.setStateAsync('DECT_' + ain + '.operationmode', {
							val: currentMode,
							ack: true
						});
					} else if (value == 253) {
						this.log.debug('DECT_' + ain + ' : ' + 'mode: Closed');
						// this.setStateAsync('DECT_'+ ain +'.tsoll', {val: 7, ack: true}); // zum setzen der Temperatur außerhalb der Anzeige?
						await this.setStateAsync('DECT_' + ain + '.hkrmode', {
							val: 1,
							ack: true
						});
						const currentMode = 'Off';
						await this.setStateAsync('DECT_' + ain + '.operationmode', {
							val: currentMode,
							ack: true
						});
					} else if (value == 254) {
						this.log.debug('DECT_' + ain + ' : ' + 'mode : Opened');
						// this.setStateAsync('DECT_'+ ain +'.tsoll', {val: 29, ack: true}); // zum setzen der Temperatur außerhalb der Anzeige?
						await this.setStateAsync('DECT_' + ain + '.hkrmode', {
							val: 2,
							ack: true
						});
						const currentMode = 'On';
						await this.setStateAsync('DECT_' + ain + '.operationmode', {
							val: currentMode,
							ack: true
						});
					}
				} else if (
					key == 'state' ||
					key == 'simpleonoff' ||
					key == 'lock' ||
					key == 'devicelock' ||
					key == 'txbusy' ||
					key == 'present' ||
					key == 'summeractive' ||
					key == 'holidayactive' ||
					key == 'boostactive' ||
					key == 'windowopenactiv' ||
					key == 'synchronized'
				) {
					//bool
					const convertValue = value == 1 ? true : false;
					await this.setStateAsync('DECT_' + ain + '.' + key, {
						val: convertValue,
						ack: true
					});
					if (key == 'summeractive' && convertValue == true) {
						const currentMode = 'Summer';
						await this.setStateAsync('DECT_' + ain + '.operationmode', {
							val: currentMode,
							ack: true
						});
					}
					if (key == 'holidayactive' && convertValue == true) {
						const currentMode = 'Holiday';
						await this.setStateAsync('DECT_' + ain + '.operationmode', {
							val: currentMode,
							ack: true
						});
					}
					if (key == 'boostactive' && convertValue == true) {
						const currentMode = 'Boost';
						await this.setStateAsync('DECT_' + ain + '.operationmode', {
							val: currentMode,
							ack: true
						});
					}
					if (key == 'windowopenactiv' && convertValue == true) {
						const currentMode = 'WindowOpen';
						await this.setStateAsync('DECT_' + ain + '.operationmode', {
							val: currentMode,
							ack: true
						});
					}
				} else if (
					key == 'lastalertchgtimestamp' ||
					key == 'lastpressedtimestamp' ||
					key == 'boostactiveendtime' ||
					key == 'windowopenactiveendtime' ||
					key == 'endperiod'
				) {
					//time
					const convTime = new Date(value * 1000);
					await this.setStateAsync('DECT_' + ain + '.' + key, {
						val: convTime,
						ack: true
					});
				} else if (
					key == 'errorcode' ||
					key == 'level' ||
					key == 'levelpercentage' ||
					key == 'battery' ||
					key == 'energy' ||
					key == 'hue' ||
					key == 'saturation' ||
					key == 'temperature' ||
					key == 'supported_modes' ||
					key == 'current_mode' ||
					key == 'rel_humidity'
				) {
					// integer number
					await this.setStateAsync('DECT_' + ain + '.' + key, {
						val: parseInt(value),
						ack: true
					});
				} else if (
					key == 'id' ||
					key == 'fwversion' ||
					key == 'manufacturer' ||
					key == 'name' ||
					key == 'productname' ||
					key == 'members' ||
					key == 'masterdeviceid' ||
					key == 'mode'
				) {
					// || 'id' , id schon beim initialisieren gesetzt
					// text
					await this.setStateAsync('DECT_' + ain + '.' + key, {
						val: value.toString(),
						ack: true
					});
				} else {
					// unbekannt
					this.log.warn(
						'unknown datapoint DECT_' + ain + '.' + key + ' please inform devloper and open issue in github'
					);
				}
			}
		} catch (e) {
			this.log.debug(' issue in update datapoint ' + JSON.stringify(e));
			throw {
				msg: 'issue updating datapoint',
				function: 'updateDatapoint',
				error: e
			};
		}
	}
	async createTemplates(fritz) {
		await fritz
			.getTemplateListInfos()
			.then(async (templatelistinfos) => {
				this.log.debug('server answer templates ' + JSON.stringify(templatelistinfos));
				let typ = '';
				let role = '';
				let templates = parser.xml2json(templatelistinfos);
				templates = [].concat((templates.templatelist || {}).template || []).map(async (template) => {
					return template;
				});
				this.log.debug('__________________________');
				this.log.debug('templates\n');
				this.log.debug(JSON.stringify(templates));
				if (templates.length) {
					this.log.info('create Templates ' + templates.length);
					await this.createTemplateResponse();
					await this.asyncForEach(templates, async (template) => {
						if (
							(template.functionbitmask & 320) == 320 ||
							(template.functionbitmask & 4160) == 4160 ||
							(template.functionbitmask & 2688) == 2688 ||
							(template.functionbitmask & 2944) == 2944
						) {
							//heating template
							typ = 'template_';
							role = 'switch';
							this.log.debug('__________________________');
							this.log.info('setting up Template ' + template.name);
							await this.createTemplate(
								typ,
								template.identifier.replace(/\s/g, ''),
								template.name,
								role,
								template.id
							);
						} else {
							this.log.debug(
								'nix vorbereitet für diese Art von Template' +
									template.functionbitmask +
									' -> ' +
									template.name
							);
						}
					});
				}
			})
			.catch((e) => this.errorHandler(e));
	}
	async createDevices(fritz) {
		await fritz
			.getDeviceListInfos()
			.then(async (devicelistinfos) => {
				let devices = parser.xml2json(devicelistinfos);
				devices = [].concat((devices.devicelist || {}).device || []).map((device) => {
					// remove spaces in AINs
					// device.identifier = device.identifier.replace(/\s/g, '');
					return device;
				});
				this.log.debug('devices\n');
				this.log.debug(JSON.stringify(devices));
				if (devices.length) {
					this.log.info('CREATE Devices ' + devices.length);
					try {
						await this.createData(devices);
					} catch (e) {
						this.log.debug(' issue creating devices ' + JSON.stringify(e));
						throw e;
					}
				}
				let groups = parser.xml2json(devicelistinfos);
				groups = [].concat((groups.devicelist || {}).group || []).map((group) => {
					// remove spaces in AINs
					//group.identifier = group.identifier.replace(/\s/g, '');
					return group;
				});
				this.log.debug('groups\n');
				this.log.debug(JSON.stringify(groups));
				if (groups.length) {
					this.log.info('CREATE groups ' + groups.length);
					try {
						await this.createData(groups);
					} catch (e) {
						this.log.debug(' issue creating groups ' + JSON.stringify(e));
						throw e;
					}
				}
			})
			/*
			.then(function() {
				pollFritzData();
			})
			*/
			.catch((e) => this.errorHandler(e));
	}
	async asyncForEach(array, callback) {
		for (let index = 0; index < array.length; index++) {
			await callback(array[index], index, array);
		}
	}

	async createData(devices) {
		let typ = '';
		let role = '';
		//await devices.forEach(async function(device) {
		await this.asyncForEach(devices, async (device) => {
			typ = 'DECT_';
			role = '';
			this.log.debug('======================================');
			this.log.debug('TRYING on : ' + JSON.stringify(device));
			const identifier = device.identifier.replace(/\s/g, '');

			// role to be defined
			if ((device.functionbitmask & 64) == 64) {
				//DECT300/301
				role = 'thermo.heat';
			} else if ((device.functionbitmask & 512) == 512) {
				//DECT200/210
				role = 'switch';
			} else if ((device.functionbitmask & 256) == 256) {
				// == 1024 || 1024)
				// Repeater
				role = 'thermo';
			} else if (device.functionbitmask == 288 || device.functionbitmask == 1048864) {
				// DECT440
				role = 'thermo';
			} else if (device.functionbitmask == 237572 || (device.functionbitmask & 131072) == 131072) {
				// DECT500
				role = 'light';
			} else if (device.functionbitmask == 335888) {
				//Blinds
				role = 'blinds';
			} else if (
				(device.functionbitmask & 16) == 16 ||
				(device.functionbitmask & 8) == 8 ||
				(device.functionbitmask & 32) == 32
			) {
				//Alarm, Contact Sensor
				role = 'sensor';
			} else if (device.functionbitmask == 1) {
				role = 'etsi';
				// replace id, fwversion in vorher erzeugten device, spätestens beim update
				this.log.debug('skipping etsi !!!');
			} else {
				role = 'other';
				this.log.warn(' unknown functionbitmask, please open issue on github ' + device.functionbitmask);
			}
			// no break in else if
			// so we use all except etsi and other
			// other might be created, but better to warn, if during runtime it changes the updates will work until restart and new creation of datapoints
			this.log.debug(
				'device ' +
					identifier +
					' named ' +
					device.name +
					' mask ' +
					device.functionbitmask +
					' assigned to ' +
					role
			);
			if (role != 'etsi') {
				// create Master Object
				await this.createObject(typ, identifier, device.name, role);

				// create general
				if (device.fwversion) {
					await this.createInfoState(identifier, 'fwversion', 'Firmware Version');
				}
				if (device.manufacturer) {
					await this.createInfoState(identifier, 'manufacturer', 'Manufacturer');
				}
				if (device.productname) {
					await this.createInfoState(identifier, 'productname', 'Product Name');
				}
				if (device.present) {
					await this.createIndicatorState(identifier, 'present', 'device present');
				}
				if (device.name) {
					await this.createInfoState(identifier, 'name', 'Device Name');
				}
				if (device.txbusy) {
					await this.createIndicatorState(identifier, 'txbusy', 'Trasmitting active');
				}
				if (device.synchronized) {
					await this.createIndicatorState(identifier, 'synchronized', 'Synchronized Status');
				}
				//always ID
				await this.createInfoState(identifier, 'id', 'Device ID');
				//etsideviceid im gleichen Object
				if (device.etsiunitinfo) {
					this.log.debug('etsi part');
					if (device.etsiunitinfo.etsideviceid) {
						//replace id with etsi
						this.log.debug('etsideviceid to be replaced');
						this.log.debug('etsideviceid ' + device.etsiunitinfo.etsideviceid);
						await this.setStateAsync('DECT_' + identifier + '.id', {
							val: device.etsiunitinfo.etsideviceid,
							ack: true
						});
						// noch nicht perfekt da dies überschrieben wird
						await this.setStateAsync('DECT_' + identifier + '.fwversion', {
							val: device.etsiunitinfo.fwversion,
							ack: true
						});
					} else {
						//device.id
						await this.setStateAsync('DECT_' + identifier + '.id', {
							val: device.id,
							ack: true
						});
					}
					//check for blinds control
					if (device.etsiunitinfo.unittype == 281) {
						//additional blind datapoints
						await this.createBlind(identifier);
					}
				}

				// create battery devices
				if (device.battery) {
					await this.createValueState(identifier, 'battery', 'Battery Charge State', 0, 100, '%');
				}
				if (device.batterylow) {
					await this.createIndicatorState(identifier, 'batterylow', 'Battery Low State');
				}

				// create button parts
				if (device.button) {
					if (!Array.isArray(device.button)) {
						await this.asyncForEach(Object.keys(device.button), async (key) => {
							if (key === 'lastpressedtimestamp') {
								await this.createTimeState(
									identifier,
									'lastpressedtimestamp',
									'last button Time Stamp'
								);
							} else if (key === 'id') {
								await this.createInfoState(identifier, 'id', 'Button ID');
							} else if (key === 'name') {
								await this.createInfoState(identifier, 'name', 'Button Name');
							} else {
								this.log.warn(' new datapoint in API detected -> ' + key);
							}
						});
					} else if (Array.isArray(device.button)) {
						//Unterobjekte anlegen
						this.log.info('setting up button(s) ');
						await this.asyncForEach(device.button, async (button) => {
							typ = 'DECT_' + identifier + '.button.';
							await this.createObject(typ, button.identifier.replace(/\s/g, ''), 'Buttons', 'button'); //rolr button?
							await this.asyncForEach(Object.keys(button), async (key) => {
								if (key === 'lastpressedtimestamp') {
									await this.createTimeState(
										identifier + '.button.' + button.identifier.replace(/\s/g, ''),
										'lastpressedtimestamp',
										'last button Time Stamp'
									);
								} else if (key === 'identifier') {
									//already part of the object
								} else if (key === 'id') {
									await this.createInfoState(
										identifier + '.button.' + button.identifier.replace(/\s/g, ''),
										'id',
										'Button ID'
									);
								} else if (key === 'name') {
									await this.createInfoState(
										identifier + '.button.' + button.identifier.replace(/\s/g, ''),
										'name',
										'Button Name'
									);
								} else {
									this.log.warn(' new datapoint in API detected -> ' + key);
								}
							});
						});
					}
				}
				//create alert
				if (device.alert) {
					this.log.info('setting up alert ');
					await this.asyncForEach(Object.keys(device.alert), async (key) => {
						if (key === 'state') {
							await this.createIndicatorState(identifier, 'state', 'Alert State');
						} else if (key === 'lastalertchgtimestamp') {
							await this.createTimeState(identifier, 'lastalertchgtimestamp', 'Alert last Time');
						} else {
							this.log.warn(' new datapoint in API detected -> ' + key);
						}
					});
				}
				// create switch
				if (device.switch) {
					this.log.info('setting up switch ');
					await this.asyncForEach(Object.keys(device.switch), async (key) => {
						if (key === 'state') {
							await this.createSwitch(identifier, 'state', 'Switch Status and Control');
						} else if (key === 'mode') {
							await this.createInfoState(identifier, 'mode', 'Switch Mode');
						} else if (key === 'lock') {
							await this.createIndicatorState(identifier, 'lock', 'API Lock');
						} else if (key === 'devicelock') {
							await this.createIndicatorState(identifier, 'devicelock', 'Device (Button)lock');
						} else {
							this.log.warn(' new datapoint in API detected -> ' + key);
						}
					});
				}
				// powermeter
				if (device.powermeter) {
					this.log.info('setting up powermeter ');
					await this.asyncForEach(Object.keys(device.powermeter), async (key) => {
						if (key === 'power') {
							await this.createValueState(identifier, 'power', 'actual Power', 0, 4000, 'W');
						} else if (key === 'voltage') {
							await this.createValueState(identifier, 'voltage', 'actual Voltage', 0, 250, 'V');
						} else if (key === 'energy') {
							await this.createValueState(identifier, 'energy', 'Energy consumption', 0, 999999999, 'Wh');
						} else {
							this.log.warn(' new datapoint in API detected -> ' + key);
						}
					});
				}
				// groups
				if (device.groupinfo) {
					this.log.info('setting up groupinfo ');
					await this.asyncForEach(Object.keys(device.groupinfo), async (key) => {
						if (key === 'masterdeviceid') {
							await this.createInfoState(identifier, 'masterdeviceid', 'ID of the group');
						} else if (key === 'members') {
							await this.createInfoState(identifier, 'members', 'member of the group');
						} else {
							this.log.warn(' new datapoint in API detected -> ' + key);
						}
					});
				}
				// create themosensor
				if (device.temperature) {
					this.log.info('setting up temperatur ');
					await this.asyncForEach(Object.keys(device.temperature), async (key) => {
						if (key === 'celsius') {
							await this.createValueState(identifier, 'celsius', 'Temperature', 8, 32, '°C');
						} else if (key === 'offset') {
							await this.createValueState(identifier, 'offset', 'Temperature Offset', -10, 10, '°C');
						} else {
							this.log.warn(' new datapoint in API detected -> ' + key);
						}
					});
				}
				// create humidity
				if (device.humidity) {
					this.log.info('setting up temperatur ');
					await this.asyncForEach(Object.keys(device.humidity), async (key) => {
						if (key === 'rel_humidity') {
							await this.createValueState(identifier, 'rel_humidity', 'relative Humidity', 0, 100, '%');
						} else {
							this.log.warn(' new datapoint in API detected -> ' + key);
						}
					});
				}
				// create thermostat
				if (device.hkr) {
					this.log.info('setting up thermostat ');
					await this.createThermostat(identifier); //additional datapoints of thermostats
					await this.asyncForEach(Object.keys(device.hkr), async (key) => {
						//create datapoints from the data
						if (key === 'tist') {
							await this.createValueState(identifier, 'tist', 'Actual temperature', 0, 32, '°C');
						} else if (key === 'tsoll') {
							await this.createValueCtrl(
								identifier,
								'tsoll',
								'Setpoint Temperature',
								0,
								32,
								'°C',
								'value.temperature'
							);
						} else if (key === 'absenk') {
							await this.createValueState(
								identifier,
								'absenk',
								'reduced (night) temperature',
								0,
								32,
								'°C'
							);
						} else if (key === 'komfort') {
							await this.createValueState(identifier, 'komfort', 'comfort temperature', 0, 32, '°C');
						} else if (key === 'lock') {
							await this.createIndicatorState(identifier, 'lock', 'Thermostat UI/API lock'); //thermostat lock 0=unlocked, 1=locked
						} else if (key === 'devicelock') {
							await this.createIndicatorState(identifier, 'devicelock', 'device lock, button lock');
						} else if (key === 'errorcode') {
							await this.createModeState(identifier, 'errorcode', 'Error Code');
						} else if (key === 'batterylow') {
							await this.createIndicatorState(identifier, 'batterylow', 'battery low');
						} else if (key === 'battery') {
							await this.createValueState(identifier, 'battery', 'battery status', 0, 100, '%');
						} else if (key === 'summeractive') {
							await this.createIndicatorState(identifier, 'summeractive', 'summer active status');
						} else if (key === 'holidayactive') {
							await this.createIndicatorState(identifier, 'holidayactive', 'Holiday Active status');
						} else if (key === 'boostactive') {
							await this.createSwitch(identifier, 'boostactive', 'Boost active status and cmd');
							//create the user definde end time for manual setting the window open active state
							await this.createValueCtrl(
								identifier,
								'boostactivetime',
								'boost active time for cmd',
								0,
								1440,
								'min',
								'value.time'
							);
							//preset to 5 min
							await this.setStateAsync('DECT_' + identifier + '.boostactivetime', {
								val: 5,
								ack: true
							});
						} else if (key === 'boostactiveendtime') {
							await this.createTimeState(identifier, 'boostactiveendtime', 'Boost active end time');
						} else if (key === 'windowopenactiv') {
							await this.createSwitch(identifier, 'windowopenactiv', 'Window open status and cmd');
							//create the user definde end time for manual setting the window open active state
							await this.createValueCtrl(
								identifier,
								'windowopenactivetime',
								'window open active time for cmd',
								0,
								1440,
								'min',
								'value.time'
							);
							//preset to 5 min
							await this.setStateAsync('DECT_' + identifier + '.windowopenactivetime', {
								val: 5,
								ack: true
							});
						} else if (key === 'windowopenactiveendtime') {
							await this.createTimeState(
								identifier,
								'windowopenactiveendtime',
								'window open active end time'
							);
						} else if (key === 'nextchange') {
							this.log.info('setting up thermostat nextchange');
							try {
								await this.asyncForEach(Object.keys(device.hkr.nextchange), async (key) => {
									if (key === 'endperiod') {
										await this.createTimeState(
											identifier,
											'endperiod',
											'next time for Temp change'
										);
									} else if (key === 'tchange') {
										await this.createValueState(
											identifier,
											'tchange',
											'Temp after next change',
											8,
											32,
											'°C'
										);
									} else {
										this.log.warn(' new datapoint in API detected -> ' + key);
									}
								});
							} catch (e) {
								this.log.debug(
									' hkr.nextchange problem ' + JSON.stringify(device.hkr.nextchange) + ' ' + e
								);
							}
						} else {
							this.log.warn(' new datapoint in API detected -> ' + key);
						}
					});
				}

				// simpleonoff
				if (device.simpleonoff) {
					this.log.info('setting up simpleonoff');
					await this.asyncForEach(Object.keys(device.simpleonoff), async (key) => {
						if (key === 'state') {
							this.createSwitch(identifier, 'state', 'Simple ON/OFF state and cmd');
						} else {
							this.log.warn(' new datapoint in API detected -> ' + key);
						}
					});
				}
				// levelcontrol
				if (device.levelcontrol) {
					this.log.info('setting up levelcontrol');
					await this.asyncForEach(Object.keys(device.levelcontrol), async (key) => {
						if (key === 'level') {
							this.createValueCtrl(identifier, 'level', 'level 0..255', 0, 255, '', 'value.level');
						} else if (key === 'levelpercentage') {
							this.createValueCtrl(
								identifier,
								'levelpercentage',
								'level in %',
								0,
								100,
								'%',
								'value.level'
							);
						} else {
							this.log.warn(' new datapoint in API detected -> ' + key);
						}
					});
				}
				// colorcontrol
				if (device.colorcontrol) {
					this.log.info('setting up thermostat ');
					await this.asyncForEach(Object.keys(device.colorcontrol), async (key) => {
						if (key === 'supported_modes') {
							await this.createModeState(identifier, 'supported_modes', 'available color modes');
						} else if (key === 'current_mode') {
							await this.createModeState(identifier, 'current_mode', 'current color mode');
						} else if (key === 'hue') {
							await this.createValueCtrl(identifier, 'hue', 'HUE color', 0, 359, '°', 'value.hue');
						} else if (key === 'saturation') {
							await this.createValueCtrl(
								identifier,
								'saturation',
								'Saturation',
								0,
								255,
								'',
								'value.saturation'
							);
						} else if (key === 'temperature') {
							await this.createValueCtrl(
								identifier,
								'temperature',
								'color temperature',
								2700,
								6500,
								'K',
								'value.temperature'
							);
						} else {
							this.log.warn(' new datapoint in API detected -> ' + key);
						}
					});
				}
			}
		});
	}
	async createObject(typ, newId, name, role) {
		this.log.debug('____________________________________________');
		this.log.debug('create Main object ' + typ + ' ' + newId + ' ' + name + ' ' + role);
		await this.setObjectNotExists(typ + newId, {
			type: 'channel',
			common: {
				name: name,
				role: role
			},
			native: {
				aid: newId
			}
		});
	}
	async createInfoState(newId, datapoint, name) {
		this.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await this.setObjectNotExists('DECT_' + newId + '.' + datapoint, {
			type: 'state',
			common: {
				name: name,
				type: 'string',
				read: true,
				write: false,
				role: 'info',
				desc: name
			},
			native: {}
		});
	}
	async createIndicatorState(newId, datapoint, name) {
		this.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await this.setObjectNotExists('DECT_' + newId + '.' + datapoint, {
			type: 'state',
			common: {
				name: name,
				type: 'boolean',
				read: true,
				write: false,
				role: 'indicator',
				desc: name
			},
			native: {}
		});
	}
	async createValueState(newId, datapoint, name, min, max, unit) {
		this.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await this.setObjectNotExists('DECT_' + newId + '.' + datapoint, {
			type: 'state',
			common: {
				name: name,
				type: 'number',
				min: min,
				max: max,
				unit: unit,
				read: true,
				write: false,
				role: 'value',
				desc: name
			},
			native: {}
		});
	}
	async createTimeState(newId, datapoint, name) {
		this.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await this.setObjectNotExists('DECT_' + newId + '.' + datapoint, {
			type: 'state',
			common: {
				name: name,
				type: 'number',
				read: true,
				write: false,
				role: 'date',
				desc: name
			},
			native: {}
		});
	}
	async createButton(newId, datapoint, name) {
		this.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await this.setObjectNotExists('DECT_' + newId + '.' + datapoint, {
			type: 'state',
			common: {
				name: name,
				type: 'boolean',
				read: true,
				write: true,
				role: 'button',
				desc: name
			},
			native: {}
		});
	}
	async createSwitch(newId, datapoint, name) {
		this.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await this.setObjectNotExists('DECT_' + newId + '.' + datapoint, {
			type: 'state',
			common: {
				name: name,
				type: 'boolean',
				read: true,
				write: true,
				role: 'switch',
				desc: name
			},
			native: {}
		});
	}
	async createModeState(newId, datapoint, name) {
		this.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await this.setObjectNotExists('DECT_' + newId + '.' + datapoint, {
			type: 'state',
			common: {
				name: name,
				type: 'number',
				read: true,
				write: false,
				role: 'indicator',
				desc: name
			},
			native: {}
		});
	}
	async createValueCtrl(newId, datapoint, name, min, max, unit, role) {
		this.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await this.setObjectNotExists('DECT_' + newId + '.' + datapoint, {
			type: 'state',
			common: {
				name: name,
				type: 'number',
				min: min,
				max: max,
				unit: unit,
				read: true,
				write: true,
				role: role,
				desc: name
			},
			native: {}
		});
	}
	async createTemplateResponse() {
		this.log.debug('create template.lasttemplate for response ');
		await this.setObjectNotExists('template', {
			type: 'channel',
			common: {
				name: 'template response',
				role: 'switch'
			},
			native: {}
		});
		await this.setObjectNotExists('template.lasttemplate', {
			type: 'state',
			common: {
				name: 'template set',
				type: 'string',
				read: true,
				write: false,
				role: 'info',
				desc: 'template set'
			},
			native: {}
		});
	}
	async createTemplate(typ, newId, name, role, id) {
		this.log.debug('create Template objects ');
		await this.setObjectNotExists(typ + newId, {
			type: 'channel',
			common: {
				name: name,
				role: role
			},
			native: {
				aid: newId
			}
		});
		await this.setObjectNotExists(typ + newId + '.id', {
			type: 'state',
			common: {
				name: 'ID',
				type: 'string',
				read: true,
				write: false,
				role: 'info',
				desc: 'ID'
			},
			native: {}
		});
		await this.setStateAsync(typ + newId + '.id', { val: id, ack: true });
		await this.setObjectNotExists(typ + newId + '.name', {
			type: 'state',
			common: {
				name: 'Name',
				type: 'string',
				read: true,
				write: false,
				role: 'info',
				desc: 'Name'
			},
			native: {}
		});
		await this.setStateAsync(typ + newId + '.name', { val: name, ack: true });
		await this.setObjectNotExists(typ + newId + '.toggle', {
			type: 'state',
			common: {
				name: 'Toggle template',
				type: 'boolean',
				read: true,
				write: true,
				role: 'button',
				desc: 'Toggle template'
			},
			native: {}
		});
	}
	async createThermostat(newId) {
		this.log.debug('create Thermostat objects');
		await this.setObjectNotExists('DECT_' + newId + '.hkrmode', {
			type: 'state',
			common: {
				name: 'Thermostat operation mode (0=auto, 1=closed, 2=open)',
				type: 'number',
				read: true,
				write: true,
				role: 'value',
				min: 0,
				max: 2,
				desc: 'Thermostat operation mode (0=auto, 1=closed, 2=open)'
			},
			native: {}
		});
		await this.setObjectNotExists('DECT_' + newId + '.lasttarget', {
			type: 'state',
			common: {
				name: 'last setting of target temp',
				type: 'number',
				unit: '°C',
				read: true,
				write: false,
				role: 'value.temperature',
				desc: 'last setting of target temp'
			},
			native: {}
		});
		await this.setObjectNotExists('DECT_' + newId + '.operationlist', {
			type: 'state',
			common: {
				name: 'List of operation modes',
				type: 'string',
				read: true,
				write: false,
				role: 'indicator',
				desc: 'List of operation modes'
			},
			native: {}
		});
		await this.setStateAsync('DECT_' + newId + '.operationlist', {
			val: `Auto, On, Off, Holiday, Summer, Boost, WindowOpen`,
			ack: true
		});
		await this.setObjectNotExists('DECT_' + newId + '.operationmode', {
			type: 'state',
			common: {
				name: 'Current operation mode',
				type: 'string',
				read: true,
				write: false,
				role: 'indicator',
				desc: 'Current operation mode'
			},
			native: {}
		});
	}
	async createBlind(newId) {
		this.log.debug('create Blinds objects');
		await this.setObjectNotExists('DECT_' + newId + '.blindsopen', {
			type: 'state',
			common: {
				name: 'Switch open',
				type: 'boolean',
				read: true,
				write: true,
				role: 'button',
				desc: 'Switch open'
			},
			native: {}
		});
		await this.setObjectNotExists('DECT_' + newId + '.blindsclose', {
			type: 'state',
			common: {
				name: 'Switch close',
				type: 'boolean',
				read: true,
				write: true,
				role: 'button',
				desc: 'Switch close'
			},
			native: {}
		});
		await this.setObjectNotExists('DECT_' + newId + '.blindsstop', {
			type: 'state',
			common: {
				name: 'Switch STOP',
				type: 'boolean',
				read: true,
				write: true,
				role: 'button',
				desc: 'Switch STOP'
			},
			native: {}
		});
	}
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Fritzdect(options);
} else {
	// otherwise start the instance directly
	new Fritzdect();
}
