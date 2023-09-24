'use strict';

/*
 * Created with @iobroker/create-adapter v1.31.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
// const fs = require("fs");
const Fritz = require('fritzdect-aha-nodejs').Fritz;

/*
let Fritz;

(async () => {
	let fb = await import('fritzdect-aha-nodejs');
	Fritz = fb.Fritz;
})().catch((err) => console.error(err));
*/
const parser = require('./lib/xml2json.js');

let polling;

/* errorcodes hkr
0: kein Fehler
1: Keine Adaptierung möglich. Gerät korrekt am Heizkörper montiert?
2: Ventilhub zu kurz oder Batterieleistung zu schwach. Ventilstößel per Hand mehrmals öfnen und schließen oder neue Batterien einsetzen.
3: Keine Ventilbewegung möglich. Ventilstößel frei?
4: Die Installation wird gerade vorbereitet.
5: Der Heizkörperregler ist im Installationsmodus und kann auf das Heizungsventil montiert werden.
6: Der Heizkörperregler passt sich nun an den Hub des Heizungsventils an.
*/

/* errorcodes blind
alert state
Beim Rollladen als Bitmaske auszuwerten.
0000 0000 - Es liegt kein Fehler vor.
0000 0001 - Hindernisalarm, der Rollladen wird gestoppt und ein kleines Stück in entgegengesetzte Richtung bewegt.
0000 0010 - Temperaturalarm, Motor überhitzt.
*/

/*
functionbitmask
Bit 0: HAN-FUN Gerät
Bit 2: Licht/Lampe
Bit 4: Alarm-Sensor
Bit 5: AVM Button
Bit 6: AVM Heizkörperregler
Bit 7: AVM Energie Messgerät
Bit 8: Temperatursensor
Bit 9: AVM Schaltsteckdose
Bit 10: AVM DECT Repeater
Bit 11: AVM Mikrofon
Bit 13: HAN-FUN-Unit
Bit 15: an-/ausschaltbares Gerät/Steckdose/Lampe/Aktor
Bit 16: Gerät mit einstellbarem Dimm-, Höhen- bzw. Niveau-Level Bit 17: Lampe mit einstellbarer Farbe/Farbtemperatur
Bit 18: Rollladen(Blind) - hoch, runter, stop und level 0% bis 100 % Bit 20: Luftfeuchtigkeitssensor
Die Bits 5,6,7,9,10 und 11 werden nur von FRITZ!-Geräten verwendet und nicht von HANFUN- oder Zigbee-Geräten.
*/

/* HANFUN unittypes
256 = SIMPLE_ON_OFF_SWITCHABLE
257 = SIMPLE_ON_OFF_SWITCH
262 = AC_OUTLET
263 = AC_OUTLET_SIMPLE_POWER_METERING
264 = SIMPLE_LIGHT 265 = DIMMABLE_LIGHT
265 = DIMMABLE_LIGHT
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
516 = OPEN_CLOSE ? detected with blinds, different alert -> status bits?
517 = OPEN_CLOSE_CONFIG ? detected with blinds
768 = ?
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

const settings = {
	Username: '',
	Password: '',
	Url: '',
	options: {},
	intervall: 300,
	boosttime: 5,
	windowtime: 5,
	tsolldefault: 23
};

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
		this.systemConfig = {};
		this.fritz = null;
		this.boosttime = 5;
		this.windowtime = 5;
		this.tsolldefault = 23;
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
			settings.Url = this.config.fritz_ip;
			//settings.options = this.config.fritz_options;
			settings.intervall = this.config.fritz_interval;
			settings.boosttime = this.boosttime = this.config.fritz_boosttime;
			settings.windowtime = this.windowtime = this.config.fritz_windowtime;
			settings.tsolldefault = this.tsolldefault = this.config.fritz_tsolldefault;
			settings.fritz_writeonhyst = this.fritz_writeonhyst = this.config.fritz_writeonhyst;

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
				this.getForeignObject('system.config', async (err, obj) => {
					if (obj && obj.native && obj.native.secret) {
						//noinspection JSUnresolvedVariable
						settings.Password = this.decryptfc(obj.native.secret, settings.Password); // this.config.fritz_pw);
					} else {
						//noinspection JSUnresolvedVariable
						settings.Password = this.decryptfc('Zgfr56gFe87jJOM', settings.Password);
					}
					// Adapter is alive, make API call
					// Make a call to fritzboxAPI and get a list devices/groups and templates

					this.fritz = new Fritz(
						settings.Username,
						settings.Password,
						settings.Url || '',
						settings.options || {}
					);
					this.log.info('fritzdect uses USER: ' + settings.Username);
					try {
						const login = await this.fritz.login_SID().catch((e) => this.errorHandlerApi(e));
						if (login) {
							this.log.info('checking user permissions');
							const resp = await this.fritz.check_SID().catch((e) => this.errorHandlerApi(e));
							// wird zu try/catch error
							if (resp) {
								this.log.debug('raw perm =>' + JSON.stringify(resp));
								try {
									let rights = '';
									if (resp.rights.indexOf('ights') == -1) {
										rights = parser.xml2json(''.concat('<Rights>', resp.rights, '</Rights>'));
									} else {
										rights = parser.xml2json(resp.rights);
									}
									this.log.info('the rights are : ' + JSON.stringify(rights));
								} catch (error) {
									this.log.error('error in permission xml2json ' + error);
								}
							}
							this.log.info('start creating global values ');
							await this.createGlobal();
							this.log.info('finished creating global values');
							this.log.info('start creating devices/groups');
							await this.createDevices(this.fritz).catch((e) => this.errorHandlerAdapter(e));
							this.log.info('finished creating devices/groups (if any)');
							this.log.info('start creating templates ');
							await this.createTemplates(this.fritz).catch((e) => this.errorHandlerAdapter(e));
							this.log.info('finished creating templates (if any) ');
							this.log.info('start creating routines ');
							await this.createRoutines(this.fritz).catch((e) => this.errorHandlerAdapter(e));
							this.log.info('finished creating routines (if any) ');
							this.log.info('start initial updating devices/groups');
							await this.updateDevices(this.fritz).catch((e) => this.errorHandlerAdapter(e));
							this.log.info('finished initial updating devices/groups');
							this.log.info(
								'going over to cyclic polling, messages to poll activity only in debug-mode '
							);
							if (!polling) {
								polling = setInterval(async () => {
									// poll fritzbox
									try {
										this.log.debug('polling! fritzdect is alive');
										await this.updateDevices(this.fritz).catch((e) => this.errorHandlerAdapter(e));
										await this.updateRoutines(this.fritz).catch((e) => this.errorHandlerAdapter(e));
										const deviceswithstat = await this.getStateAsync(
											'global.statdevices'
										).catch((e) => {
											this.log.warn('problem getting statdevices ' + e);
										});

										if (deviceswithstat && deviceswithstat.val) {
											this.log.info('glob state ' + deviceswithstat.val);
											let devstat = [].concat([], JSON.parse(String(deviceswithstat.val)));
											for (let i = 0; i < devstat.length; i++) {
												this.log.debug('updating device ' + devstat[i]);
												await this.updateStats(devstat[i], this.fritz);
											}
										}
									} catch (e) {
										this.log.warn(`[Polling] <== ${e}`);
									}
								}, (settings.intervall || 300) * 1000);
							}
						} else {
							this.log.error('login not possible, check user and permissions');
						}
					} catch (error) {
						//from login
						this.log.warn(
							'catched error in onReady (most likely no connection to FB or wrong credentials)' + error
						);
					}
					if (err) {
						this.log.error('error getting system.config ' + err);
					}
				});
			} else {
				this.log.error(
					'*** Adapter running, but doing nothing, credentials missing in Adaptper Settings !!!  ***'
				);
			}

			// in this template all states changes inside the adapters namespace are subscribed
			this.subscribeStates('*');
		} catch (error) {
			this.log.error('[asyncOnReady()]' + error);
			return;
		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	async onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);
			if (polling) clearInterval(polling);
			// await this.fritz.logout_SID().catch((e) => this.errorHandlerApi(e));
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
			this.log.debug(`onStateChange => state ${id} changed: ${state.val} (ack = ${state.ack})`);
			if (!this.fritz) {
				this.fritz = new Fritz(
					settings.Username,
					settings.Password,
					settings.moreParam || '',
					settings.strictSsl || true
				);
				try {
					const login = await this.fritz.login_SID();
					if (login) {
						this.log.debug('login in stateChange success');
					} else {
						this.log.error('login not possible, check user and permissions');
					}
				} catch (error) {
					this.errorHandlerApi(error);
				}
			}
			//const fritz = new Fritz(settings.Username, settings.Password, settings.moreParam || '', settings.strictSsl || true);

			// you can use the ack flag to detect if it is status (true) or command (false)
			if (state && !state.ack && state.val !== null && id !== null) {
				this.log.debug('ack is not set! -> command');
				//hier noch eine Abfrage ob das Gerät present=false hat und Fehlermeldung das man Nichterreichbares Gerät bedienen wiil
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
								await this.fritz
									.setTempTarget(id, 'off')
									.then((sid) => {
										this.log.debug('Switched Mode' + id + ' to closed');
									})
									.catch((e) => this.errorHandlerApi(e));
							} else if (state.val > 28) {
								//kann gelöscht werden, wenn Temperaturvorwahl nicht zur Moduswahl benutzt werden soll
								await this.setStateAsync('DECT_' + id + '.hkrmode', { val: 2, ack: false }); //damit das Ventil auch regelt (false= Befehl und nochmaliger Einsprung )
								await this.fritz
									.setTempTarget(id, 'on')
									.then(() => {
										this.log.debug('Switched Mode' + id + ' to opened permanently');
									})
									.catch((e) => this.errorHandlerApi(e));
							} else {
								await this.setStateAsync('DECT_' + id + '.hkrmode', { val: 0, ack: false }); //damit das Ventil auch regelt
								await this.fritz
									.setTempTarget(id, state.val)
									.then(() => {
										this.log.debug('Set target temp ' + id + state.val + ' °C');
										this.setStateAsync('DECT_' + id + '.lasttarget', {
											val: state.val,
											ack: true
										}); //iobroker Tempwahl wird zum letzten Wert gespeichert
										this.setStateAsync('DECT_' + id + '.tsoll', {
											val: state.val,
											ack: true
										}); //iobroker Tempwahl wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
									})
									.catch((e) => this.errorHandlerApi(e));
							}
						} else if (dp === 'hkrmode') {
							if (state.val === 0) {
								const targettemp = await this.getStateAsync('DECT_' + id + '.tsoll').catch((e) => {
									this.log.warn('problem getting the tsoll status ' + e);
								});
								// oder hier die Verwendung von lasttarget
								if (targettemp && targettemp.val !== null) {
									if (targettemp.val) {
										let setTemp = targettemp.val;
										if (setTemp < 8) {
											await this.setStateAsync('DECT_' + id + '.tsoll', { val: 8, ack: true });
											setTemp = 8;
										} else if (setTemp > 28) {
											await this.setStateAsync('DECT_' + id + '.tsoll', { val: 28, ack: true });
											setTemp = 28;
										}
										await this.fritz
											.setTempTarget(id, setTemp)
											.then(() => {
												this.log.debug('Set target temp ' + id + ' ' + setTemp + ' °C');
												this.setStateAsync('DECT_' + id + '.tsoll', {
													val: setTemp,
													ack: true
												}); //iobroker Tempwahl wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
												this.setStateAsync('DECT_' + id + '.operationmode', {
													val: 'Auto',
													ack: true
												}); //iobroker setzen des operationmode, da API Aufruf erfolgreich
											})
											.catch((e) => this.errorHandlerApi(e));
									} else {
										this.log.error('no data in targettemp for setting mode');
									}
								} else {
									throw { error: ' targettemp is NULL ' };
								}
							} else if (state.val === 1) {
								await this.fritz
									.setTempTarget(id, 'off')
									.then((sid) => {
										this.log.debug('Switched Mode' + id + ' to closed.');
										this.setStateAsync('DECT_' + id + '.operationmode', {
											val: 'Off',
											ack: true
										}); //iobroker setzen des operationmode, da API Aufruf erfolgreich
									})
									.catch((e) => this.errorHandlerApi(e));
							} else if (state.val === 2) {
								await this.fritz
									.setTempTarget(id, 'on')
									.then((sid) => {
										this.log.debug('Switched Mode' + id + ' to opened permanently');
										this.setStateAsync('DECT_' + id + '.operationmode', {
											val: 'On',
											ack: true
										}); //iobroker setzen des operationmode, da API Aufruf erfolgreich
									})
									.catch((e) => this.errorHandlerApi(e));
							}
						}
						//no need to check the state.val, it is a button
						if (dp === 'setmodeauto') {
							//zurücksetzen wegen toggle/button click
							await this.setStateAsync('DECT_' + id + '.setmodeauto', {
								val: false,
								ack: true
							});
							const targettemp = await this.getStateAsync('DECT_' + id + '.tsoll').catch((e) => {
								this.log.warn('problem getting the tsoll status ' + e);
							});
							// oder hier die Verwendung von lasttarget
							if (targettemp && targettemp.val !== null) {
								if (targettemp.val) {
									let setTemp = targettemp.val;
									if (setTemp < 8) {
										await this.setStateAsync('DECT_' + id + '.tsoll', { val: 8, ack: true });
										setTemp = 8;
									} else if (setTemp > 28) {
										await this.setStateAsync('DECT_' + id + '.tsoll', { val: 28, ack: true });
										setTemp = 28;
									}
									this.fritz
										.setTempTarget(id, setTemp)
										.then(() => {
											this.log.debug('Set target temp ' + id + ' ' + setTemp + ' °C');
											this.setStateAsync('DECT_' + id + '.tsoll', {
												val: setTemp,
												ack: true
											}); //iobroker Tempwahl wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
											this.setStateAsync('DECT_' + id + '.operationmode', {
												val: 'Auto',
												ack: true
											}); //iobroker setzen des operationmode, da API Aufruf erfolgreich
											this.setStateAsync('DECT_' + id + '.hkrmode', {
												val: 0,
												ack: true
											}); //iobroker setzen des hkrmode, da API Aufruf erfolgreich
										})
										.catch((e) => this.errorHandlerApi(e));
								} else {
									this.log.error('no data in targettemp for setting mode');
								}
							} else {
								throw { error: ' targettemp is NULL ' };
							}
						}
						if (dp === 'setmodeoff') {
							//zurücksetzen wegen toggle/button click
							await this.setStateAsync('DECT_' + id + '.setmodeoff', {
								val: false,
								ack: true
							});
							await this.fritz
								.setTempTarget(id, 'off')
								.then((sid) => {
									this.log.debug('Switched Mode' + id + ' to closed.');
									this.setStateAsync('DECT_' + id + '.operationmode', {
										val: 'Off',
										ack: true
									}); //iobroker setzen des operationmode, da API Aufruf erfolgreich
									this.setStateAsync('DECT_' + id + '.hkrmode', {
										val: 1,
										ack: true
									}); //iobroker setzen des hkrmode, da API Aufruf erfolgreich
								})
								.catch((e) => this.errorHandlerApi(e));
						}
						if (dp === 'setmodeon') {
							//zurücksetzen wegen toggle/button click
							await this.setStateAsync('DECT_' + id + '.setmodeon', {
								val: false,
								ack: true
							});
							await this.fritz
								.setTempTarget(id, 'on')
								.then((sid) => {
									this.log.debug('Switched Mode' + id + ' to opened permanently');
									this.setStateAsync('DECT_' + id + '.operationmode', {
										val: 'On',
										ack: true
									}); //iobroker setzen des operationmode, da API Aufruf erfolgreich
									this.setStateAsync('DECT_' + id + '.hkrmode', {
										val: 2,
										ack: true
									}); //iobroker setzen des hkrmode, da API Aufruf erfolgreich
								})
								.catch((e) => this.errorHandlerApi(e));
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
								this.fritz
									.setHkrBoost(id, 0)
									.then(() => {
										this.log.debug('Reset thermostat boost ' + id + ' to ' + state.val);
										this.setStateAsync('DECT_' + id + '.boostactive', {
											val: state.val,
											ack: true
										}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
										//kein pauschales Setzen des Operationmode, da unbekannt wohin es dann geht
										const convTime = new Date(0);
										this.setStateAsync('DECT_' + id + '.boostactiveendtime', {
											val: String(convTime),
											ack: true
										});
									})
									.catch((e) => this.errorHandlerApi(e));
							} else if (
								state.val === 1 ||
								state.val === '1' ||
								state.val === 'true' ||
								state.val === true ||
								state.val === 'on' ||
								state.val === 'ON'
							) {
								const minutes = await this.getStateAsync('DECT_' + id + '.boostactivetime');
								if (minutes && minutes.val !== null) {
									let activetime = minutes.val;
									const jetzt = +new Date();
									if (minutes.val > 1440) {
										activetime = 1440;
									}
									const ende = Math.floor(jetzt / 1000 + Number(activetime) * 60); //time for fritzbox is in seconds
									this.log.debug(' unix returned ' + ende + ' real ' + new Date(ende * 1000));
									this.fritz
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
												val: String(endtime),
												ack: true
											}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
											this.setStateAsync('DECT_' + id + '.operationmode', {
												val: 'Boost',
												ack: true
											}); //iobroker setzen des operationmode, da API Aufruf erfolgreich
										})
										.catch((e) => this.errorHandlerApi(e));
								} else {
									throw { error: 'minutes were NULL' };
								}
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
								this.fritz
									.setWindowOpen(id, 0)
									.then((sid) => {
										this.log.debug('Reset thermostat windowopen ' + id + ' to ' + state.val);
										this.setStateAsync('DECT_' + id + '.windowopenactiv', {
											val: state.val,
											ack: true
										}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
										//keine Nachführung operationmode, da unbekannt wohin es geht
										const convTime = new Date(0);
										this.setStateAsync('DECT_' + id + '.windowopenactiveendtime', {
											val: String(convTime),
											ack: true
										});
									})
									.catch((e) => this.errorHandlerApi(e));
							} else if (
								state.val === 1 ||
								state.val === '1' ||
								state.val === 'true' ||
								state.val === true ||
								state.val === 'on' ||
								state.val === 'ON'
							) {
								const minutes = await this.getStateAsync('DECT_' + id + '.windowopenactivetime');
								if (minutes && minutes.val !== null) {
									let activetime = minutes.val;
									const jetzt = +new Date();
									if (minutes.val > 1440) {
										activetime = 1440;
									}
									const ende = Math.floor(jetzt / 1000 + Number(activetime) * 60); //time for fritzbox is in seconds
									this.log.debug(' unix ' + ende + ' real ' + new Date(ende * 1000));
									this.fritz
										.setWindowOpen(id, ende)
										.then((body) => {
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
											this.setStateAsync('DECT_' + id + '.windowopenactiv', {
												val: state.val,
												ack: true
											}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
											this.setStateAsync('DECT_' + id + '.windowopenactiveendtime', {
												val: String(endtime),
												ack: true
											}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
											this.setStateAsync('DECT_' + id + '.operationmode', {
												val: 'WindowOpen',
												ack: true
											}); //iobroker setzen des operationmode, da API Aufruf erfolgreich
										})
										.catch((e) => this.errorHandlerApi(e));
								} else {
									throw { error: 'minutes were NULL' };
								}
							}
						}
						// setswitch reicht scheinbar nicht bei simpleonoff, hier müsste irgendwie unterschieden werden ob DECT200 switch/state oder simpleonoff/state
						if (dp == 'state') {
							if (
								state.val === 0 ||
								state.val === '0' ||
								state.val === 'false' ||
								state.val === false ||
								state.val === 'off' ||
								state.val === 'OFF'
							) {
								const switchtyp = await this.getStateAsync('DECT_' + id + '.switchtype');
								if (switchtyp && switchtyp.val !== null) {
									if (switchtyp.val === 'switch') {
										this.fritz
											.setSwitchOff(id)
											.then((sid) => {
												this.log.debug('Turned switch ' + id + ' off');
												this.setStateAsync('DECT_' + id + '.state', {
													val: false,
													ack: true
												}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
											})
											.catch((e) => this.errorHandlerApi(e));
									} else {
										this.fritz
											.setSimpleOff(id)
											.then((sid) => {
												this.log.debug('Turned switch ' + id + ' off');
												this.setStateAsync('DECT_' + id + '.state', {
													val: false,
													ack: true
												}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
											})
											.catch((e) => this.errorHandlerApi(e));
									}
								} else {
									throw { error: 'could not determine the type of switch (switch/simpleonoff)' };
								}
							} else if (
								state.val === 1 ||
								state.val === '1' ||
								state.val === 'true' ||
								state.val === true ||
								state.val === 'on' ||
								state.val === 'ON'
							) {
								const switchtyp = await this.getStateAsync('DECT_' + id + '.switchtype');
								if (switchtyp && switchtyp.val !== null) {
									if (switchtyp.val === 'switch') {
										this.fritz
											.setSwitchOn(id)
											.then((sid) => {
												this.log.debug('Turned switch ' + id + ' on');
												this.setStateAsync('DECT_' + id + '.state', {
													val: true,
													ack: true
												}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
											})
											.catch((e) => this.errorHandlerApi(e));
									} else {
										this.fritz
											.setSimpleOn(id)
											.then((sid) => {
												this.log.debug('Turned switch ' + id + ' on');
												this.setStateAsync('DECT_' + id + '.state', {
													val: true,
													ack: true
												}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
											})
											.catch((e) => this.errorHandlerApi(e));
									}
								} else {
									throw { error: 'could not determine the type of switch (switch/simpleonoff)' };
								}
							}
						}
						if (dp == 'blindsclose') {
							this.fritz
								.setBlind(id, 'close')
								.then(async (sid) => {
									this.log.debug('Started blind ' + id + ' to close');
									await this.setStateAsync('DECT_' + id + '.blindsclose', { val: false, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch((e) => this.errorHandlerApi(e));
						}
						if (dp == 'blindsopen') {
							this.fritz
								.setBlind(id, 'open')
								.then(async (sid) => {
									this.log.debug('Started blind ' + id + ' to open');
									await this.setStateAsync('DECT_' + id + '.blindsopen', { val: false, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch((e) => this.errorHandlerApi(e));
						}
						if (dp == 'blindsstop') {
							this.fritz
								.setBlind(id, 'stop')
								.then((sid) => {
									this.log.debug('Set blind ' + id + ' to stop');
									this.setStateAsync('DECT_' + id + '.blindsstop', { val: false, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch((e) => this.errorHandlerApi(e));
						}
						if (dp == 'level') {
							this.fritz
								.setLevel(id, state.val)
								.then((sid) => {
									this.log.debug('Set level' + id + ' to ' + state.val);
									this.setStateAsync('DECT_' + id + '.level', { val: state.val, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch((e) => this.errorHandlerApi(e));
						}
						if (dp == 'levelpercentage') {
							this.fritz
								.setLevel(id, Math.floor(Number(state.val) / 100 * 255))
								.then((sid) => {
									//level is in 0...255
									this.log.debug('Set level %' + id + ' to ' + state.val);
									this.setStateAsync('DECT_' + id + '.levelpercentage', {
										val: state.val,
										ack: true
									}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch((e) => this.errorHandlerApi(e));
						}
						if (dp == 'hue') {
							const saturation = await this.getStateAsync('DECT_' + id + '.saturation');
							if (saturation && saturation.val !== null) {
								// oder hier die Verwendung von lasttarget
								const setSaturation = saturation.val;
								if (setSaturation == '') {
									this.log.error(
										'No saturation value exists when setting hue, please set saturation to a value '
									);
								} else {
									this.fritz
										.setColor(id, setSaturation, state.val)
										.then((sid) => {
											this.log.debug(
												'Set lamp color hue ' +
													id +
													' to ' +
													state.val +
													' and saturation of ' +
													setSaturation
											);
											this.setStateAsync('DECT_' + id + '.hue', {
												val: state.val,
												ack: true
											}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
										})
										.catch((e) => this.errorHandlerApi(e));
								}
							} else {
								throw { error: 'minutes were NULL' };
							}
						}
						if (dp == 'saturation') {
							const hue = await this.getStateAsync('DECT_' + id + '.hue');
							if (hue && hue.val !== null) {
								const setHue = hue.val;
								if (setHue == '') {
									this.log.error(
										'No hue value exists when setting saturation, please set hue to a value '
									);
								} else {
									this.fritz
										.setColor(id, state.val, setHue)
										.then((sid) => {
											this.log.debug(
												'Set lamp color saturation ' +
													id +
													' to ' +
													state.val +
													' and hue of ' +
													setHue
											);
											this.setStateAsync('DECT_' + id + '.saturation', {
												val: state.val,
												ack: true
											}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
										})
										.catch((e) => this.errorHandlerApi(e));
								}
							} else {
								throw { error: 'hue were NULL' };
							}
						}
						if (dp == 'temperature') {
							this.fritz
								.setColorTemperature(id, state.val)
								.then((sid) => {
									this.log.debug('Set lamp color temperature ' + id + ' to ' + state.val);
									this.setStateAsync('DECT_' + id + '.temperature', {
										val: state.val,
										ack: true
									}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch((e) => this.errorHandlerApi(e));
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
								this.fritz
									.applyTemplate(id)
									.then((sid) => {
										this.log.debug('cmd Toggle to template ' + id + ' on');
										this.log.debug('response ' + sid);
										this.setStateAsync('template.lasttemplate', { val: sid, ack: true }); //when successfull toggle, the API returns the id of the template
									})
									.catch((e) => this.errorHandlerApi(e));
							}
						}
					} else if (idx.startsWith('routine_')) {
						//must be fritzbox routine
						id = idx.replace(/routine_/g, ''); //routine
						this.log.info('Routine ID: ' + id + ' identified for command (' + dp + ') : ' + state.val);
						if (dp == 'active') {
							if (
								state.val === 1 ||
								state.val === '1' ||
								state.val === 'true' ||
								state.val === true ||
								state.val === 'on' ||
								state.val === 'ON'
							) {
								state.val = true;
							}
							this.fritz
								.setTriggerActive(id, state.val)
								.then((sid) => {
									this.log.debug('cmd Active to template ' + id + ' to ' + state.val);
									this.log.debug('response ' + sid);
								})
								.catch((e) => this.errorHandlerApi(e));
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
	async onMessage(obj) {
		let wait = false;
		this.log.debug('messagebox received ' + JSON.stringify(obj));
		try {
			if (typeof obj === 'object' && obj.message) {
				// if (obj) {
				if (obj.command === 'test') {
					// e.g. send email or pushover or whatever
					this.log.debug('msg with obj.command for test received');

					// Send response in callback if required
					if (obj.callback)
						this.sendTo(
							obj.from,
							obj.command,
							'Message received (sendTo works). This is not an indication that FB is reachable!',
							obj.callback
						);
				}
			} else if (obj) {
				//my own messages for detectiung are without a message
				let result = [];
				if (!this.fritz) {
					this.fritz = new Fritz(
						settings.Username,
						settings.Password,
						settings.moreParam || '',
						settings.strictSsl || true
					);
					try {
						const login = await this.fritz.login_SID();
						if (login) {
							this.log.debug('login in stateChange success');
						} else {
							this.log.error('login not possible, check user and permissions');
						}
					} catch (error) {
						this.errorHandlerApi(error);
					}
				}
				// const fritz = new Fritz(settings.Username, settings.Password, settings.moreParam || '', settings.strictSsl || true);

				switch (obj.command) {
					case 'devices':
						this.fritz
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
							})
							.catch((e) => {
								this.log.debug('error calling in msgbox');
								throw {
									msg: 'issue getting devices',
									function: 'onMessage',
									error: e
								};
							});

						wait = true;
						break;
					case 'groups':
						this.fritz
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
							})
							.catch((e) => {
								this.log.debug('error calling in msgbox');
								throw {
									msg: 'issue getting groups',
									function: 'onMessage',
									error: e
								};
							});
						wait = true;
						break;
					case 'templates':
						this.fritz
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
							})
							.catch((e) => {
								this.log.debug('error calling in msgbox');
								throw {
									msg: 'issue getting templates',
									function: 'onMessage',
									error: e
								};
							});
						wait = true;
						break;
					case 'trigger':
						this.fritz
							.getTriggerListInfos()
							.then(function(triggerlistinfos) {
								let trigger = parser.xml2json(triggerlistinfos);
								trigger = [].concat((trigger.triggerlist || {}).trigger || []).map((trigger) => {
									return trigger;
								});
								result = trigger;
							})
							.then(async () => {
								if (obj.callback) this.sendTo(obj.from, obj.command, result, obj.callback);
							})
							.catch((e) => {
								this.log.debug('error calling in msgbox');
								throw {
									msg: 'issue getting trigger',
									function: 'onMessage',
									error: e
								};
							});
						wait = true;
						break;
					case 'statistic':
						this.fritz
							.getBasicDeviceStats(obj.message) //ain muß übergeben werden aus message
							.then(function(statisticinfos) {
								//obj.message should be ain of device requested
								const devicestats = parser.xml2json(statisticinfos);
								result = devicestats;
							})
							.then(async () => {
								if (obj.callback) this.sendTo(obj.from, obj.command, result, obj.callback);
							})
							.catch((e) => {
								this.log.debug('error calling in msgbox');
								throw {
									msg: 'issue getting statistics',
									function: 'onMessage',
									error: e
								};
							});
						wait = true;
						break;
					case 'color':
						this.fritz
							.getColorDefaults()
							.then(function(colorinfos) {
								let colors = parser.xml2json(colorinfos);
								result = colors;
							})
							.then(async () => {
								if (obj.callback) this.sendTo(obj.from, obj.command, result, obj.callback);
							})
							.catch((e) => {
								this.log.debug('error calling in msgbox');
								throw {
									msg: 'issue getting color',
									function: 'onMessage',
									error: e
								};
							});
						wait = true;
						break;
					case 'rights':
						this.fritz
							.getUserPermissions()
							.then(function(rights) {
								const permission = parser.xml2json(rights);
								result = permission;
							})
							.then(async () => {
								if (obj.callback) this.sendTo(obj.from, obj.command, result, obj.callback);
							})
							.catch((e) => {
								this.log.debug('error calling in msgbox');
								throw {
									msg: 'issue getting UserRights',
									function: 'onMessage',
									error: e
								};
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
				this.log.debug('messagebox landed in last evaluation wait=false and callback');
				this.sendTo(obj.from, obj.command, obj.message, obj.callback);
			}
		} catch (e) {
			this.log.debug('try/catch messagebox error occured ' + e);
		}
	}

	decryptfc(key, value) {
		let result = '';
		for (let i = 0; i < value.length; ++i) {
			result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
		}
		return result;
	}

	errorHandlerApi(error) {
		try {
			this.log.error('--------------- error calling the fritzbox -----------');
			this.log.error('API msg   => ' + error.msg);
			this.log.error('API funct => ' + error.function);

			if (error == '0000000000000000') {
				this.log.error('Did not get session id -> invalid username or password?');
			} else if (!error.response) {
				this.log.error('no response part in returned error message');
			} else if (error.response.statusCode) {
				if (error.response.statusCode == 403) {
					this.log.error(
						'no permission for this call (403), has user all the rights and access to fritzbox?'
					);
				} else if (error.response.statusCode == 404) {
					this.log.error('call to API does not exist! (404)');
				} else if (error.response.statusCode == 400) {
					this.log.error('bad request (400), ain correct?');
				} else if (error.response.statusCode == 500) {
					this.log.error('internal fritzbox error (500)');
				} else if (error.response.statusCode == 503) {
					this.log.error('service unavailable (503)');
				} else if (error.response.statusCode == 303) {
					this.log.error('unknwon error (303)');
				} else {
					this.log.error('statuscode not in errorHandlerApi of fritzdect');
				}
			}
			this.log.error('API  err  => ' + error.error);
		} catch (e) {
			this.log.error('catched error in function errorHandlerApi() ' + e);
		}
	}

	errorHandlerAdapter(error) {
		try {
			this.log.error('--------------- error calling the fritzbox -----------');
			this.log.error('iob  err  => ' + error);
			//this.log.error('iob msg   => ' + error.msg);
			//this.log.error('iob funct => ' + error.function);
			//this.log.error('iob  err  => ' + error.error);
		} catch (e) {
			this.log.error('try/catch error in function errorHandlerAdapter' + e);
		}
	}
	async updateRoutines(fritz) {
		this.log.debug('__________________________');
		this.log.debug('updating Routines ');
		try {
			const routineslistinfos = await fritz.getTriggerListInfos().catch((e) => this.errorHandlerApi(e));
			let typ = '';
			let role = '';
			if (routineslistinfos) {
				let routines = parser.xml2json(routineslistinfos);
				routines = [].concat((routines.triggerlist || {}).trigger || []).map((trigger) => {
					return trigger;
				});
				this.log.debug('__________________________');
				this.log.debug('routines\n');
				this.log.debug(JSON.stringify(routines));
				if (routines.length) {
					this.log.debug('update routines ' + routines.length);
					await Promise.all(
						routines.map(async (routine) => {
							this.log.debug('__________________________');
							this.log.debug('updating Routine ' + routine.name);
							let active = routine.active == 0 ? false : true;
							await this.setStateAsync('routine_' + routine.identifier.replace(/\s/g, '') + '.active', {
								val: active,
								ack: true
							});
							this.log.debug('activation is ' + active);
						})
					);
				}
			}
			return Promise.resolve();
		} catch (e) {
			return Promise.reject(this.log.error('try/catch updateRoutines ' + e));
		}
	}
	async updateDevices(fritz) {
		this.log.debug('__________________________');
		this.log.debug('updating Devices / Groups ');
		try {
			const devicelistinfos = await fritz.getDeviceListInfos().catch((e) => this.errorHandlerApi(e));
			let currentMode = null;
			if (devicelistinfos) {
				let devices = parser.xml2json(devicelistinfos);
				// devices
				devices = [].concat((devices.devicelist || {}).device || []).map((device) => {
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
								/*
								await this.setStateAsync('DECT_' + devices[i].identifier.replace(/\s/g, '') + '.present', {
									val: false,
									ack: true
								});
								*/
								// https://github.com/foxthefox/ioBroker.fritzdect/issues/224
								const obj = await this.getForeignObjectAsync(
									this.namespace + '.DECT_' + devices[i].identifier.replace(/\s/g, '') + '.present'
								);
								if (!obj || !obj.common) {
									this.log.debug(
										'DECT_' +
											devices[i].identifier.replace(/\s/g, '') +
											'.present is not present, check the device connection, no values are written'
									);
								} else {
									await this.setStateAsync(
										'DECT_' + devices[i].identifier.replace(/\s/g, '') + '.present',
										{ val: false, ack: true }
									);
								}

								this.log.debug(
									'DECT_' +
										devices[i].identifier.replace(/\s/g, '') +
										' is not present, check the device connection, no values are written'
								);
								continue;
							} else {
								if (devices[i].hkr) {
									currentMode = 'Auto';
									if (devices[i].hkr.tsoll === devices[i].hkr.komfort) {
										currentMode = 'Comfort';
									}
									if (devices[i].hkr.tsoll === devices[i].hkr.absenk) {
										currentMode = 'Night';
									}
									//hier schon mal operationmode vorbesetzt, wird ggf. später überschrieben wenn es On,Off oder was anderes wird
									await this.setStateAsync(
										'DECT_' + devices[i].identifier.replace(/\s/g, '') + '.operationmode',
										{
											val: currentMode,
											ack: true
										}
									);
									this.log.debug('preset oprationmode ' + currentMode);
								}
								// some manipulation for values in etsunitinfo, even the etsidevice is having a separate identifier, the manipulation takes place with main object
								// some weird id usage, the website shows the id of the etsiunit
								if (devices[i].etsiunitinfo) {
									if (devices[i].etsiunitinfo.etsideviceid) {
										//replace id with etsi
										this.log.debug('shifting etsideviceid in dataset');
										this.log.debug('id vorher ' + devices[i].id);
										devices[i].id = devices[i].etsiunitinfo.etsideviceid;
										this.log.debug('id nachher ' + devices[i].id);
									}
								}
								//falls ein switch beides hat (switch und simpleonoff), wird die Vorbesetzung switch ersetzt
								//falls es nur simpleonoff gibt, dann erstmals hier gesetzt
								if (devices[i].simpleonoff) {
									let switchtype = await this.getStateAsync(
										'DECT_' + devices[i].identifier.replace(/\s/g, '') + '.switchtype'
									);
									if (switchtype.val !== 'simpleonoff') {
										await this.setStateAsync(
											'DECT_' + devices[i].identifier.replace(/\s/g, '') + '.switchtype',
											{
												val: 'simpleonoff',
												ack: true
											}
										);
										this.log.debug('switchtype simpleonoff set for ' + devices[i].id);
									}
								}
								// some devices deliver the HAN-FUN info separately and the only valuable is the FW version, to be inserted in the main object
								if (devices[i].functionbitmask == 1) {
									this.log.debug(' functionbitmask 1');
									// search and find the device id and replace fwversion
									// todo
									// find the device.identifier mit der etsi_id
									//oder vorher eine Schleife über den empfangenen Datensatz und bei fb==1
									// position ermitteln und dann FW ersetzen device[position].fwversion = device[aktdatensatz].fwversion]
									// manipulation der device[i].identifier = gefundene identifier und dann durchlaufen lassen
									// reihenfolge, id immer vorher und dann erst etsi in json?
									continue;
								} else {
									this.log.debug(' calling update data .....');
									try {
										await this.updateData(devices[i], devices[i].identifier.replace(/\s/g, ''));
									} catch (e) {
										this.log.error(' issue updating device calling updateData' + e);
									}
								}
							}
						}
					} catch (e) {
						this.log.error('try/catch issue updating device in updateDevices ' + e);
					}
				}

				// groups
				let groups = parser.xml2json(devicelistinfos);
				groups = [].concat((groups.devicelist || {}).group || []).map((group) => {
					// remove spaces in AINs
					// group.identifier = group.identifier.replace(/\s/g, '');
					return group;
				});
				this.log.debug('groups\n');
				this.log.debug(JSON.stringify(groups));
				if (groups.length) {
					this.log.debug('update Groups ' + groups.length);
					//await this.asyncForEach(groups, async (device) => {
					await Promise.all(
						groups.map(async (device) => {
							//groups.forEach(async (device) => {
							this.log.debug('updating Group ' + device.name);
							if (device.present === '0' || device.present === 0 || device.present === false) {
								this.log.debug(
									'DECT_' +
										device.identifier.replace(/\s/g, '') +
										' is not present, check the device connection, no values are written'
								);
							} else {
								if (device.hkr) {
									currentMode = 'Auto';
									if (device.hkr.tsoll === device.hkr.komfort) {
										currentMode = 'Comfort';
									}
									if (device.hkr.tsoll === device.hkr.absenk) {
										currentMode = 'Night';
									}
									await this.setStateAsync(
										'DECT_' + device.identifier.replace(/\s/g, '') + '.operationmode',
										{
											val: currentMode,
											ack: true
										}
									);
								}
								//hier könnte nochmal simpleonoff rein, wenn gruppen beides hätten
								try {
									this.log.debug(' calling update data .....');
									await this.updateData(device, device.identifier.replace(/\s/g, ''));
								} catch (e) {
									this.log.error(' issue updating groups calling updateData ' + e);
								}
							}
						})
					);
				}
			}
			return Promise.resolve();
		} catch (e) {
			return Promise.reject(this.log.error('try/catch updateGroups ' + e));
		}
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
			this.log.debug(' issue in updateData ' + e);
			throw {
				msg: 'issue updating data',
				function: 'updateData',
				error: e
			};
		}
	}
	async updateStats(identifier, fritz) {
		this.log.debug('update Stats objects ' + identifier);
		let devstat = await fritz.getBasicDeviceStats(identifier).catch((e) => this.errorHandlerApi(e));
		let statsobj = parser.xml2json(devstat);
		await Promise.all(
			Object.entries(statsobj.devicestats).map(async ([ key, obj ]) => {
				if (key !== 'temperature') {
					if (key == 'energy') {
						//months
						await this.setStateAsync('DECT_' + identifier + '.' + key + '_stats.countm', {
							val: parseInt(obj['stats'][0]['count']),
							ack: true
						});
						await this.setStateAsync('DECT_' + identifier + '.' + key + '_stats.gridm', {
							val: parseInt(obj['stats'][0]['grid']),
							ack: true
						});
						let datatimem = parseInt(obj['stats'][0]['datatime']);
						await this.setStateAsync('DECT_' + identifier + '.' + key + '_stats.datatimem', {
							val: datatimem,
							ack: true
						});
						let montharr = obj['stats'][0]['_@attribute'].split(',').map(Number);
						await this.setStateAsync('DECT_' + identifier + '.' + key + '_stats.stats_months', {
							val: JSON.stringify(montharr),
							ack: true
						});
						let last12m = montharr.reduce((pv, cv) => pv + cv, 0);
						await this.setStateAsync('DECT_' + identifier + '.' + key + '_stats.energy_last12m', {
							val: last12m,
							ack: true
						});
						let monthnum = parseInt(new Date(datatimem * 1000).toISOString().slice(6, 8));
						let ytd = montharr.splice(0, monthnum).reduce((pv, cv) => pv + cv, 0);
						await this.setStateAsync('DECT_' + identifier + '.' + key + '_stats.energy_ytd', {
							val: ytd,
							ack: true
						});
						// days
						await this.setStateAsync('DECT_' + identifier + '.' + key + '_stats.countd', {
							val: parseInt(obj['stats'][1]['count']),
							ack: true
						});
						await this.setStateAsync('DECT_' + identifier + '.' + key + '_stats.gridd', {
							val: parseInt(obj['stats'][1]['grid']),
							ack: true
						});
						let datatimed = parseInt(obj['stats'][1]['datatime']);
						await this.setStateAsync('DECT_' + identifier + '.' + key + '_stats.datatimed', {
							val: datatimed,
							ack: true
						});
						let dayarr = obj['stats'][1]['_@attribute'].split(',').map(Number);
						await this.setStateAsync('DECT_' + identifier + '.' + key + '_stats.stats_days', {
							val: JSON.stringify(dayarr),
							ack: true
						});
						// dayvalue here, because the mtd alters the array
						await this.setStateAsync('DECT_' + identifier + '.' + key + '_stats.energy_dtd', {
							val: parseInt(dayarr[0]),
							ack: true
						});
						let last31d = dayarr.reduce((pv, cv) => pv + cv, 0);
						await this.setStateAsync('DECT_' + identifier + '.' + key + '_stats.energy_last31d', {
							val: last31d,
							ack: true
						});
						let daynum = parseInt(new Date(datatimed * 1000).toISOString().slice(8, 10));
						let mtd = dayarr.splice(0, daynum).reduce((pv, cv) => pv + cv, 0);
						await this.setStateAsync('DECT_' + identifier + '.' + key + '_stats.energy_mtd', {
							val: mtd,
							ack: true
						});
					} else {
						await this.setStateAsync('DECT_' + identifier + '.' + key + '_stats.count', {
							val: parseInt(obj['stats']['count']),
							ack: true
						});
						await this.setStateAsync('DECT_' + identifier + '.' + key + '_stats.grid', {
							val: parseInt(obj['stats']['grid']),
							ack: true
						});
						await this.setStateAsync('DECT_' + identifier + '.' + key + '_stats.datatime', {
							val: parseInt(obj['stats']['datatime']),
							ack: true
						});
						let otherarr = obj['stats']['_@attribute'].split(',').map(Number);
						await this.setStateAsync('DECT_' + identifier + '.' + key + '_stats.stats', {
							val: JSON.stringify(otherarr),
							ack: true
						});
					}
				}
			})
		);
		return;
	}
	async updateDatapoint(key, value, ain) {
		let old;
		try {
			if (!value || value == '') {
				this.log.debug(' no value for updating in ' + ain + '  ' + key);
				//wirklich mit "null" beschreiben?
				await this.setStateAsync('DECT_' + ain + '.' + key, {
					val: null,
					ack: true
				});
			} else {
				try {
					old = await this.getStateAsync('DECT_' + ain + '.' + key);
					if (old !== null || !this.config.fritz_writeonhyst) {
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
							// immer das gleiche Schema
							// entweder Unterschied oder writeonhyst=0
							if (old.val !== batt || !this.config.fritz_writeonhyst) {
								this.log.debug(
									'updating data DECT_' + ain + ' : ' + key + ' new: ' + batt + ' old: ' + old.val
								);
								await this.setStateAsync('DECT_' + ain + '.' + key, {
									val: batt,
									ack: true
								});
							}
						} else if (key == 'celsius' || key == 'offset') {
							//numbers
							if (old.val !== parseFloat(value) / 10 || !this.config.fritz_writeonhyst) {
								this.log.debug(
									'updating data DECT_' +
										ain +
										' : ' +
										key +
										' new: ' +
										parseFloat(value) / 10 +
										' old: ' +
										old.val
								);
								await this.setStateAsync('DECT_' + ain + '.' + key, {
									val: parseFloat(value) / 10,
									ack: true
								});
							}
						} else if (key == 'power' || key == 'voltage') {
							if (old.val !== parseFloat(value) / 1000 || !this.config.fritz_writeonhyst) {
								this.log.debug(
									'updating data DECT_' +
										ain +
										' : ' +
										key +
										' new: ' +
										parseFloat(value) / 1000 +
										' old: ' +
										old.val
								);
								await this.setStateAsync('DECT_' + ain + '.' + key, {
									val: parseFloat(value) / 1000,
									ack: true
								});
							}
						} else if (key == 'komfort' || key == 'absenk' || key == 'tist' || key == 'tchange') {
							// if.old?

							if (value == 253) {
								this.log.debug('DECT_' + ain + ' with value ' + key + ' : ' + 'mode => Closed');
								await this.setStateAsync('DECT_' + ain + '.' + 'hkrmode', {
									val: 1,
									ack: true
								});
								const currentMode = 'Off';
								await this.setStateAsync('DECT_' + ain + '.operationmode', {
									val: currentMode,
									ack: true
								});
							} else if (value == 254) {
								this.log.debug('DECT_' + ain + ' with value ' + key + ' : ' + 'mode => Opened');
								await this.setStateAsync('DECT_' + ain + '.' + 'hkrmode', {
									val: 2,
									ack: true
								});
								const currentMode = 'On';
								await this.setStateAsync('DECT_' + ain + '.operationmode', {
									val: currentMode,
									ack: true
								});
							} else {
								if (old.val !== parseFloat(value) / 2 || !this.config.fritz_writeonhyst) {
									this.log.debug(
										'updating data DECT_' +
											ain +
											' : ' +
											key +
											' new: ' +
											parseFloat(value) / 2 +
											' old: ' +
											old.val
									);
									await this.setStateAsync('DECT_' + ain + '.' + key, {
										val: parseFloat(value) / 2,
										ack: true
									});
								}
							}
						} else if (key == 'humidity') {
							//e.g humidity
							if (old.val !== parseFloat(value) || !this.config.fritz_writeonhyst) {
								this.log.debug(
									'updating data DECT_' +
										ain +
										' : ' +
										key +
										' new: ' +
										parseFloat(value) +
										' old: ' +
										old.val
								);
								await this.setStateAsync('DECT_' + ain + '.' + key, {
									val: parseFloat(value),
									ack: true
								});
							}
						} else if (key == 'tsoll') {
							//neu 2.3.0c
							if (old.val !== parseFloat(value) / 2 || !this.config.fritz_writeonhyst) {
								let targettemp;
								let tsoll;
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
									//wurde eigentlich schon übergeordnet gesetzt, hier würde es ggf. Night und Comfort überschreiben
									/*
								const currentMode = 'Auto';
								await this.setStateAsync('DECT_' + ain + '.operationmode', {
									val: currentMode,
									ack: true
								});
								*/
								} else if (value == 253) {
									this.log.debug('DECT_' + ain + ' (tsoll) : ' + 'mode: Closed');
									// this.setStateAsync('DECT_'+ ain +'.tsoll', {val: 7, ack: true}); // zum setzen der Temperatur außerhalb der Anzeige?
									targettemp = await this.getStateAsync('DECT_' + ain + '.tsoll').catch((e) => {
										this.log.warn('problem getting the tsoll status ' + e);
									});
									if (targettemp && targettemp.val !== null) {
										tsoll = targettemp.val;
									} else {
										tsoll = settings.tsolldefault || this.tsolldefault;
										this.log.debug('DECT_' + ain + ' tsoll will be set to default value');
									}
									await this.setStateAsync('DECT_' + ain + '.tsoll', {
										val: tsoll,
										ack: true
									});
									await this.setStateAsync('DECT_' + ain + '.lasttarget', {
										val: tsoll,
										ack: true
									});
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
									this.log.debug('DECT_' + ain + ' (tsoll) : ' + 'mode : Opened');
									// this.setStateAsync('DECT_'+ ain +'.tsoll', {val: 29, ack: true}); // zum setzen der Temperatur außerhalb der Anzeige?
									targettemp = await this.getStateAsync('DECT_' + ain + '.tsoll').catch((e) => {
										this.log.warn('problem getting the tsoll status ' + e);
									});
									if (targettemp && targettemp.val !== null) {
										tsoll = targettemp.val;
									} else {
										tsoll = settings.tsolldefault || this.tsolldefault;
										this.log.debug('DECT_' + ain + ' tsoll will be set to default value');
									}
									await this.setStateAsync('DECT_' + ain + '.tsoll', {
										val: tsoll,
										ack: true
									});
									await this.setStateAsync('DECT_' + ain + '.lasttarget', {
										val: tsoll,
										ack: true
									});
									await this.setStateAsync('DECT_' + ain + '.hkrmode', {
										val: 2,
										ack: true
									});
									const currentMode = 'On';
									await this.setStateAsync('DECT_' + ain + '.operationmode', {
										val: currentMode,
										ack: true
									});
								} else {
									this.log.warn('undefined tsoll submitted from fritzbox !');
								}
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
							key == 'synchronized' ||
							key == 'fullcolorsupport' ||
							key == 'mapped' ||
							key == 'endpositionsset' ||
							key == 'adaptiveHeatingRunning' ||
							key == 'adaptiveHeatingActive'
						) {
							// hier Prüfung ob bei rolladen/alert/state mehr als bool drin ist und damit wird es parseInt
							// if ( value.length() >1 ) { await this.setStateAsync('DECT_' + ain + '.' + key, {	val: value.toString(), ack: true });} else {}
							// oder eben alles ungleich 0 ist erstmal Fehler
							// bool
							const convertValue = value == 1 ? true : false;
							if (old.val !== convertValue || !this.config.fritz_writeonhyst) {
								this.log.debug(
									'updating data DECT_' +
										ain +
										' : ' +
										key +
										' new: ' +
										convertValue +
										' old: ' +
										old.val
								);
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
							}
						} else if (
							key == 'lastalertchgtimestamp' ||
							key == 'lastpressedtimestamp' ||
							key == 'boostactiveendtime' ||
							key == 'windowopenactiveendtime' ||
							key == 'endperiod'
						) {
							//time
							const convTime = String(new Date(value * 1000));
							if (old.val !== convTime || !this.config.fritz_writeonhyst) {
								this.log.debug(
									'updating data DECT_' + ain + ' : ' + key + ' new: ' + convTime + ' old: ' + old.val
								);
								await this.setStateAsync('DECT_' + ain + '.' + key, {
									val: convTime, //Str()
									ack: true
								});
							}
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
							key == 'rel_humidity' ||
							key == 'unmapped_hue' ||
							key == 'unmapped_saturation'
						) {
							// integer number
							if (old.val !== parseInt(value) || !this.config.fritz_writeonhyst) {
								this.log.debug(
									'updating data DECT_' +
										ain +
										' : ' +
										key +
										' new: ' +
										parseInt(value) +
										' old: ' +
										old.val
								);
								await this.setStateAsync('DECT_' + ain + '.' + key, {
									val: parseInt(value),
									ack: true
								});
							}
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
							if (old.val !== value.toString() || !this.config.fritz_writeonhyst) {
								this.log.debug(
									'updating data DECT_' +
										ain +
										' : ' +
										key +
										' new: ' +
										value.toString() +
										' old: ' +
										old.val
								);
								await this.setStateAsync('DECT_' + ain + '.' + key, {
									val: value.toString(),
									ack: true
								});
							}
						} else {
							// unbekannt
							this.log.warn(
								'unknown datapoint DECT_' +
									ain +
									'.' +
									key +
									' please inform devloper and open issue in github'
							);
						}
					}
				} catch (e) {
					this.log.debug(' issue in update datapoint ' + ain + '.' + key + e);
					throw {
						msg: ' issue in update datapoint ',
						function: 'updateDatapoint',
						error: e
					};
				}
			}
		} catch (e) {
			this.log.debug(' issue in update datapoint ' + e);
			throw {
				msg: 'issue updating datapoint',
				function: 'updateDatapoint',
				error: e
			};
		}
	}
	async createTemplates(fritz) {
		try {
			const templatelistinfos = await fritz.getTemplateListInfos().catch((e) => this.errorHandlerApi(e));
			let typ = '';
			let role = '';
			if (templatelistinfos) {
				let templates = parser.xml2json(templatelistinfos);
				templates = [].concat((templates.templatelist || {}).template || []).map((template) => {
					return template;
				});
				this.log.debug('__________________________');
				this.log.debug('templates\n');
				this.log.debug(JSON.stringify(templates));
				if (templates.length) {
					this.log.info('CREATE Templates ' + templates.length);
					await this.createTemplateResponse();
					//await this.asyncForEach(templates, async (template) => {
					await Promise.all(
						templates.map(async (template) => {
							//everything in template is a button to be activated, no need to check the functionbitmask
							//subtemplates or devices are not taken over to iobroker
							typ = 'template_';
							role = 'switch';
							this.log.debug('__________________________');
							this.log.debug('setting up Template ' + template.name);
							await this.createTemplate(
								typ,
								template.identifier.replace(/\s/g, ''),
								template.name,
								role,
								template.id
							);
						})
					);
				}
			}
			return Promise.resolve();
		} catch (e) {
			return Promise.reject(this.log.error('try/catch createTemplates ' + e));
		}
	}
	async createRoutines(fritz) {
		try {
			const routineslistinfos = await fritz.getTriggerListInfos().catch((e) => this.errorHandlerApi(e));
			let typ = '';
			let role = '';
			if (routineslistinfos) {
				let routines = parser.xml2json(routineslistinfos);
				routines = [].concat((routines.triggerlist || {}).trigger || []).map((trigger) => {
					return trigger;
				});
				this.log.debug('__________________________');
				this.log.debug('routines\n');
				this.log.debug(JSON.stringify(routines));
				if (routines.length) {
					this.log.info('CREATE Routines ' + routines.length);
					await Promise.all(
						routines.map(async (routine) => {
							//heating template
							typ = 'routine_';
							role = 'switch';
							this.log.debug('__________________________');
							this.log.debug('setting up Routine ' + routine.name);
							let active = routine.active == 0 ? false : true;
							await this.createRoutine(
								typ,
								routine.identifier.replace(/\s/g, ''),
								routine.name,
								role,
								active
							);
						})
					);
				}
			}
			return Promise.resolve();
		} catch (e) {
			return Promise.reject(this.log.error('try/catch createRoutines ' + e));
		}
	}
	async createDevices(fritz) {
		try {
			const devicelistinfos = await fritz.getDeviceListInfos().catch((e) => this.errorHandlerApi(e));
			if (devicelistinfos) {
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
						this.log.debug(' issue creating devices calling createData' + e);
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
						this.log.debug(' issue creating groups calling createData' + e);
						throw e;
					}
				}
			}
			return Promise.resolve();
		} catch (e) {
			return Promise.reject(this.log.error('try/catch createDevices ' + e));
		}
	}
	async createGlobal() {
		// always create the global entity
		await this.createObject('', 'global', 'channel', 'list');
		await this.setObjectNotExistsAsync('global.statdevices', {
			type: 'state',
			common: {
				name: 'list of devices with stats',
				type: 'array',
				read: true,
				write: false,
				role: 'list',
				desc: 'list of devices with stats'
			},
			native: {}
		});
		let devarr = [];
		await this.setStateAsync('global.statdevices', { val: JSON.stringify(devarr), ack: true });
	}

	// not use it
	// https://dev.to/masteringjs/5-async-await-design-patterns-for-cleaner-async-logic-1fkh
	async asyncForEach(array, callback) {
		for (let index = 0; index < array.length; index++) {
			await callback(array[index], index, array);
		}
	}

	async createData(devices) {
		let typ = '';
		let role = '';
		//await this.asyncForEach(devices, async (device) => {
		//await Promise.all(
		//devices.map(async (device) => {
		for (let device of devices) {
			typ = 'DECT_';
			role = '';
			this.log.debug('======================================');
			this.log.debug('TRYING on : ' + JSON.stringify(device));
			const identifier = device.identifier.replace(/\s/g, '');

			if ((device.functionbitmask & 64) == 64) {
				//DECT300/301
				role = 'thermo.heat';
			} else if ((device.functionbitmask & 32768) == 32768 || (device.functionbitmask & 512) == 512) {
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
			} else if ((device.functionbitmask & 8192) == 8192) {
				//simpleonoff alleine
				//telekom plug 40960
				role = 'switch';
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
					await this.setStateAsync('DECT_' + identifier + '.fwversion', {
						val: device.fwversion !== null ? device.fwversion.toString() : null,
						ack: true
					});
				}
				if (device.manufacturer) {
					await this.createInfoState(identifier, 'manufacturer', 'Manufacturer');
					await this.setStateAsync('DECT_' + identifier + '.manufacturer', {
						val: device.manufacturer !== null ? device.manufacturer.toString() : null,
						ack: true
					});
				}
				if (device.productname) {
					await this.createInfoState(identifier, 'productname', 'Product Name');
					await this.setStateAsync('DECT_' + identifier + '.productname', {
						val: device.productname !== null ? device.productname.toString() : null,
						ack: true
					});
				}
				if (device.present) {
					await this.createIndicatorState(identifier, 'present', 'device present');
					await this.setStateAsync('DECT_' + identifier + '.present', {
						val: device.present == 1 ? true : false,
						ack: true
					});
				}
				if (device.name) {
					await this.createInfoState(identifier, 'name', 'Device Name');
					await this.setStateAsync('DECT_' + identifier + '.name', {
						val: device.name !== null ? device.name.toString() : null,
						ack: true
					});
				}
				if (device.txbusy) {
					await this.createIndicatorState(identifier, 'txbusy', 'Trasmitting active');
					await this.setStateAsync('DECT_' + identifier + '.txbusy', {
						val: device.txbusy == 1 ? true : false,
						ack: true
					});
				}
				if (device.synchronized) {
					await this.createIndicatorState(identifier, 'synchronized', 'Synchronized Status');
					await this.setStateAsync('DECT_' + identifier + '.synchronized', {
						val: device.synchronized == 1 ? true : false,
						ack: true
					});
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
					}

					//check for blinds control
					if (device.etsiunitinfo.unittype == 281) {
						//additional blind datapoints
						await this.createBlind(identifier);
					}
				} else {
					//device.id
					this.log.debug('device.id ' + JSON.stringify(device));
					if (device.id) {
						await this.setStateAsync('DECT_' + identifier + '.id', {
							val: device.id,
							ack: true
						});
					}
				}

				// create battery devices
				if (device.battery) {
					await this.createValueState(identifier, 'battery', 'Battery Charge State', 0, 100, '%');
					await this.setStateAsync('DECT_' + identifier + '.battery', {
						val: parseInt(device.battery),
						ack: true
					});
				}
				if (device.batterylow) {
					await this.createIndicatorState(identifier, 'batterylow', 'Battery Low State');
					await this.setStateAsync('DECT_' + identifier + '.batterylow', {
						val: device.batterylow == 1 ? true : false,
						ack: true
					});
				}

				// create button parts
				if (device.button) {
					if (!Array.isArray(device.button)) {
						await Promise.all(
							Object.entries(device.button).map(async ([ key, value ]) => {
								//await this.asyncForEach(Object.keys(device.button), async (key) => {
								if (key === 'lastpressedtimestamp') {
									await this.createTimeState(
										identifier,
										'lastpressedtimestamp',
										'last button Time Stamp'
									);
									await this.setStateAsync('DECT_' + identifier + '.lastpressedtimestamp', {
										val: value !== null ? String(new Date(value * 1000)) : null,
										ack: true
									});
								} else if (key === 'id') {
									await this.createInfoState(identifier, 'id', 'Button ID');
									await this.setStateAsync('DECT_' + identifier + '.id', {
										val: value,
										ack: true
									});
								} else if (key === 'name') {
									await this.createInfoState(identifier, 'name', 'Button Name');
									await this.setStateAsync('DECT_' + identifier + '.name', {
										val: value,
										ack: true
									});
								} else {
									this.log.warn(' new datapoint in API detected -> ' + key);
								}
							})
						);
					} else if (Array.isArray(device.button)) {
						//Unterobjekte anlegen
						//DECT440
						this.log.debug('setting up button(s) ');
						await Promise.all(
							device.button.map(async (button) => {
								//await this.asyncForEach(device.button, async (button) => {
								typ = 'DECT_' + identifier + '.button.';
								await this.createObject(typ, button.identifier.replace(/\s/g, ''), 'Buttons', 'button'); //rolr button?
								await Promise.all(
									Object.keys(button).map(async (key) => {
										this.log.debug(
											'button ' + identifier + JSON.stringify(button) + button.identifier
										);
										//await this.asyncForEach(Object.keys(button), async (key) => {
										if (key === 'lastpressedtimestamp') {
											await this.createTimeState(
												''.concat(identifier, '.button.', button.identifier.replace(/\s/g, '')),
												'lastpressedtimestamp',
												'last button Time Stamp'
											);
											await this.setStateAsync(
												'DECT_'.concat(
													identifier,
													'.button.',
													button.identifier.replace(/\s/g, ''),
													'.lastpressedtimestamp'
												),
												{
													val:
														button.lastpressedtimestamp !== null
															? String(new Date(button.lastpressedtimestamp * 1000))
															: null,
													ack: true
												}
											);
										} else if (key === 'identifier') {
											//already part of the object
										} else if (key === 'id') {
											await this.createInfoState(
												''.concat(identifier, '.button.', button.identifier.replace(/\s/g, '')),
												'id',
												'Button ID'
											);
											await this.setStateAsync(
												'DECT_'.concat(
													identifier,
													'.button.',
													button.identifier.replace(/\s/g, ''),
													'.id'
												),
												{
													val: button.id,
													ack: true
												}
											);
										} else if (key === 'name') {
											await this.createInfoState(
												''.concat(identifier, '.button.', button.identifier.replace(/\s/g, '')),
												'name',
												'Button Name'
											);
											await this.setStateAsync(
												'DECT_'.concat(
													identifier,
													'.button.',
													button.identifier.replace(/\s/g, ''),
													'.name'
												),
												{
													val: button.name,
													ack: true
												}
											);
										} else {
											this.log.warn(' new datapoint in API detected -> ' + key);
										}
									})
								);
							})
						);
					}
				}
				//create alert
				// hier irgendwie blinds alart als string behandeln. :-((
				if (device.alert) {
					this.log.debug('setting up alert ');
					await Promise.all(
						Object.keys(device.alert).map(async (key) => {
							//await this.asyncForEach(Object.keys(device.alert), async (key) => {
							if (key === 'state') {
								await this.createIndicatorState(identifier, 'state', 'Alert State');
								await this.setStateAsync('DECT_' + identifier + '.state', {
									val: device.alert.state == 1 ? true : false,
									ack: true
								});
							} else if (key === 'lastalertchgtimestamp') {
								await this.createTimeState(identifier, 'lastalertchgtimestamp', 'Alert last Time');
								await this.setStateAsync('DECT_' + identifier + '.lastalertchgtimestamp', {
									val:
										device.alert.lastalertchgtimestamp !== null
											? String(new Date(device.alert.lastalertchgtimestamp * 1000))
											: null,
									ack: true
								});
							} else {
								this.log.warn(' new datapoint in API detected -> ' + key);
							}
						})
					);
				}
				// create switch
				if (device.switch) {
					this.log.debug('setting up switch ');
					await Promise.all(
						Object.keys(device.switch).map(async (key) => {
							//await this.asyncForEach(Object.keys(device.switch), async (key) => {
							if (key === 'state') {
								await this.createSwitch(identifier, 'state', 'Switch Status and Control');
								await this.setStateAsync('DECT_' + identifier + '.state', {
									val: device.switch.state == 1 ? true : false,
									ack: true
								});
								await this.createInfoState(identifier, 'switchtype', 'Switch Type');
								await this.setStateAsync('DECT_' + identifier + '.switchtype', {
									val: 'switch',
									ack: true
								});
							} else if (key === 'mode') {
								await this.createInfoState(identifier, 'mode', 'Switch Mode');
								await this.setStateAsync('DECT_' + identifier + '.mode', {
									val: device.switch.mode !== null ? device.switch.mode.toString() : null,
									ack: true
								});
							} else if (key === 'lock') {
								await this.createIndicatorState(identifier, 'lock', 'API Lock');
								await this.setStateAsync('DECT_' + identifier + '.lock', {
									val: device.switch.lock == 1 ? true : false,
									ack: true
								});
							} else if (key === 'devicelock') {
								await this.createIndicatorState(identifier, 'devicelock', 'Device (Button)lock');
								await this.setStateAsync('DECT_' + identifier + '.devicelock', {
									val: device.switch.devicelock == 1 ? true : false,
									ack: true
								});
							} else {
								this.log.warn(' new datapoint in API detected -> ' + key);
							}
						})
					);
				}
				// powermeter
				if (device.powermeter) {
					this.log.debug('setting up powermeter ');
					// if powermeter then there is a stat available
					let oldarr = await this.getStateAsync('global.statdevices').catch((e) => {
						this.log.warn('problem getting statdevices ' + e);
					});
					if (oldarr && oldarr.val) {
						var newarray = [].concat(JSON.parse(String(oldarr.val)), identifier);
						await this.setStateAsync('global.statdevices', {
							val: JSON.stringify(newarray),
							ack: true
						});
					}
					await Promise.all(
						Object.keys(device.powermeter).map(async (key) => {
							//await this.asyncForEach(Object.keys(device.powermeter), async (key) => {
							if (key === 'power') {
								await this.createValueState(identifier, 'power', 'actual Power', 0, 4000, 'W');
								await this.setStateAsync('DECT_' + identifier + '.power', {
									val: parseFloat(device.powermeter.power) / 1000,
									ack: true
								});
								await this.createStats(identifier, 'power');
							} else if (key === 'voltage') {
								await this.createValueState(identifier, 'voltage', 'actual Voltage', 0, 255, 'V');
								await this.setStateAsync('DECT_' + identifier + '.voltage', {
									val: parseFloat(device.powermeter.voltage) / 1000,
									ack: true
								});
								await this.createStats(identifier, 'voltage');
							} else if (key === 'energy') {
								await this.createValueState(
									identifier,
									'energy',
									'Energy consumption',
									0,
									9999999999,
									'Wh'
								);
								await this.setStateAsync('DECT_' + identifier + '.energy', {
									val: parseInt(device.powermeter.energy),
									ack: true
								});
								await this.createStats(identifier, 'energy');
							} else {
								this.log.warn(' new datapoint in API detected -> ' + key);
							}
						})
					);
				}
				// groups
				if (device.groupinfo) {
					this.log.debug('setting up groupinfo ');
					await Promise.all(
						Object.keys(device.groupinfo).map(async (key) => {
							//await this.asyncForEach(Object.keys(device.groupinfo), async (key) => {
							if (key === 'masterdeviceid') {
								await this.createInfoState(identifier, 'masterdeviceid', 'ID of the group');
								await this.setStateAsync('DECT_' + identifier + '.masterdeviceid', {
									val:
										device.groupinfo.masterdeviceid !== null
											? device.groupinfo.masterdeviceid.toString()
											: null,
									ack: true
								});
							} else if (key === 'members') {
								await this.createInfoState(identifier, 'members', 'member of the group');
								await this.setStateAsync('DECT_' + identifier + '.members', {
									val: device.groupinfo.members !== null ? device.groupinfo.members.toString() : null,
									ack: true
								});
							} else {
								this.log.warn(' new datapoint in API detected -> ' + key);
							}
						})
					);
				}
				// create thermosensor
				if (device.temperature) {
					this.log.debug('setting up temperature ');
					await Promise.all(
						Object.keys(device.temperature).map(async (key) => {
							//await this.asyncForEach(Object.keys(device.temperature), async (key) => {
							if (key === 'celsius') {
								await this.createValueState(identifier, 'celsius', 'Temperature', -30, 50, '°C');
								await this.setStateAsync('DECT_' + identifier + '.celsius', {
									val: parseFloat(device.temperature.celsius) / 10,
									ack: true
								});
							} else if (key === 'offset') {
								await this.createValueState(identifier, 'offset', 'Temperature Offset', -10, 10, '°C');
								await this.setStateAsync('DECT_' + identifier + '.offset', {
									val: parseFloat(device.temperature.offset) / 10,
									ack: true
								});
							} else {
								this.log.warn(' new datapoint in API detected -> ' + key);
							}
						})
					);
				}
				// create humidity
				if (device.humidity) {
					this.log.debug('setting up humidity ');
					await Promise.all(
						Object.keys(device.humidity).map(async (key) => {
							//await this.asyncForEach(Object.keys(device.humidity), async (key) => {
							if (key === 'rel_humidity') {
								await this.createValueState(
									identifier,
									'rel_humidity',
									'relative Humidity',
									0,
									100,
									'%'
								);
								await this.setStateAsync('DECT_' + identifier + '.rel_humidity', {
									val: parseFloat(device.humidity.rel_humidity),
									ack: true
								});
							} else {
								this.log.warn(' new datapoint in API detected -> ' + key);
							}
						})
					);
				}
				// create blind
				if (device.blind) {
					this.log.debug('setting up blind ');
					await Promise.all(
						Object.keys(device.blind).map(async (key) => {
							//await this.asyncForEach(Object.keys(device.blind), async (key) => {
							if (key === 'endpositionsset') {
								await this.createIndicatorState(identifier, 'endpositionsset', 'Endposition Setting');
								await this.setStateAsync('DECT_' + identifier + '.endpositionsset', {
									val: device.blind.endpositionsset == 1 ? true : false,
									ack: true
								});
							} else if (key === 'mode') {
								await this.createInfoState(identifier, 'mode', 'Blind Mode');
								await this.setStateAsync('DECT_' + identifier + '.mode', {
									val: device.blind.mode !== null ? device.blind.mode.toString() : null,
									ack: true
								});
							} else {
								this.log.warn(' new datapoint in API detected -> ' + key);
							}
						})
					);
				}
				// create thermostat
				if (device.hkr) {
					this.log.debug('setting up thermostat ');
					await this.createThermostat(identifier); //additional datapoints of thermostats
					await Promise.all(
						Object.keys(device.hkr).map(async (key) => {
							//await this.asyncForEach(Object.keys(device.hkr), async (key) => {
							//create datapoints from the data
							if (key === 'tist') {
								await this.createValueState(identifier, 'tist', 'Actual temperature', 0, 65, '°C');
								await this.setStateAsync('DECT_' + identifier + '.tist', {
									val: parseFloat(device.hkr.tist) / 2,
									ack: true
								});
							} else if (key === 'tsoll') {
								await this.createValueCtrl(
									identifier,
									'tsoll',
									'Setpoint Temperature',
									0,
									35,
									'°C',
									'value.temperature'
								);
								if (device.hkr.tsoll < 57) {
									await this.setStateAsync('DECT_' + identifier + '.tsoll', {
										val: parseFloat(device.hkr.tsoll) / 2,
										ack: true
									});
								} else {
									await this.setStateAsync('DECT_' + identifier + '.tsoll', {
										val: this.config.fritz_tsolldefault,
										ack: true
									});
								}
							} else if (key === 'absenk') {
								await this.createValueState(
									identifier,
									'absenk',
									'reduced (night) temperature',
									8,
									32,
									'°C'
								);
								await this.setStateAsync('DECT_' + identifier + '.absenk', {
									val: parseFloat(device.hkr.absenk) / 2,
									ack: true
								});
							} else if (key === 'komfort') {
								await this.createValueState(identifier, 'komfort', 'comfort temperature', 8, 32, '°C');
								await this.setStateAsync('DECT_' + identifier + '.komfort', {
									val: parseFloat(device.hkr.komfort) / 2,
									ack: true
								});
							} else if (key === 'lock') {
								await this.createIndicatorState(identifier, 'lock', 'Thermostat UI/API lock'); //thermostat lock 0=unlocked, 1=locked
								await this.setStateAsync('DECT_' + identifier + '.lock', {
									val: device.hkr.lock == 1 ? true : false,
									ack: true
								});
							} else if (key === 'devicelock') {
								await this.createIndicatorState(identifier, 'devicelock', 'device lock, button lock');
								await this.setStateAsync('DECT_' + identifier + '.devicelock', {
									val: device.hkr.devicelock == 1 ? true : false,
									ack: true
								});
							} else if (key === 'errorcode') {
								await this.createModeState(identifier, 'errorcode', 'Error Code');
								await this.setStateAsync('DECT_' + identifier + '.errorcode', {
									val: parseInt(device.hkr.errorcode) / 2,
									ack: true
								});
							} else if (key === 'batterylow') {
								await this.createIndicatorState(identifier, 'batterylow', 'battery low');
								await this.setStateAsync('DECT_' + identifier + '.batterylow', {
									val: device.hkr.batterylow == 1 ? true : false,
									ack: true
								});
							} else if (key === 'battery') {
								await this.createValueState(identifier, 'battery', 'battery status', 0, 100, '%');
								await this.setStateAsync('DECT_' + identifier + '.battery', {
									val: parseInt(device.hkr.battery),
									ack: true
								});
							} else if (key === 'summeractive') {
								await this.createIndicatorState(identifier, 'summeractive', 'summer active status');
								await this.setStateAsync('DECT_' + identifier + '.summeractive', {
									val: device.hkr.summeractive == 1 ? true : false,
									ack: true
								});
							} else if (key === 'holidayactive') {
								await this.createIndicatorState(identifier, 'holidayactive', 'Holiday Active status');
								await this.setStateAsync('DECT_' + identifier + '.holidayactive', {
									val: device.hkr.holidayactive == 1 ? true : false,
									ack: true
								});
							} else if (key === 'boostactive') {
								await this.createSwitch(identifier, 'boostactive', 'Boost active status and cmd');
								await this.setStateAsync('DECT_' + identifier + '.boostactive', {
									val: device.hkr.boostactive == 1 ? true : false,
									ack: true
								});
								//create the user definde end time for manual setting the window open active state
								await this.createValueCtrl(
									identifier,
									'boostactivetime',
									'boost active time for cmd',
									0,
									1440,
									'min',
									'value'
								);
								//preset to 5 min
								await this.setStateAsync('DECT_' + identifier + '.boostactivetime', {
									val: this.boosttime || settings.boosttime,
									ack: true
								});
							} else if (key === 'boostactiveendtime') {
								await this.createTimeState(identifier, 'boostactiveendtime', 'Boost active end time');
								//String(new Date(value * 1000))
								await this.setStateAsync('DECT_' + identifier + '.boostactiveendtime', {
									val:
										device.hkr.boostactiveendtime !== null
											? String(new Date(device.hkr.boostactiveendtime * 1000))
											: null,
									ack: true
								});
							} else if (key === 'windowopenactiv') {
								await this.createSwitch(identifier, 'windowopenactiv', 'Window open status and cmd');
								await this.setStateAsync('DECT_' + identifier + '.windowopenactiv', {
									val: device.hkr.windowopenactiv == 1 ? true : false,
									ack: true
								});
								//create the user definde end time for manual setting the window open active state
								await this.createValueCtrl(
									identifier,
									'windowopenactivetime',
									'window open active time for cmd',
									0,
									1440,
									'min',
									'value'
								);
								//preset to 5 min
								await this.setStateAsync('DECT_' + identifier + '.windowopenactivetime', {
									val: this.windowtime || settings.windowtime,
									ack: true
								});
							} else if (key === 'windowopenactiveendtime') {
								await this.createTimeState(
									identifier,
									'windowopenactiveendtime',
									'window open active end time'
								);
								await this.setStateAsync('DECT_' + identifier + '.windowopenactiveendtime', {
									val:
										device.hkr.windowopenactiveendtime !== null
											? String(new Date(device.hkr.windowopenactiveendtime * 1000))
											: null,
									ack: true
								});
							} else if (key === 'nextchange') {
								this.log.debug('setting up thermostat nextchange');
								try {
									await Promise.all(
										Object.keys(device.hkr.nextchange).map(async (key) => {
											//await this.asyncForEach(Object.keys(device.hkr.nextchange), async (key) => {
											if (key === 'endperiod') {
												await this.createTimeState(
													identifier,
													'endperiod',
													'next time for Temp change'
												);
												await this.setStateAsync('DECT_' + identifier + '.endperiod', {
													val:
														device.hkr.nextchange.endperiod !== null
															? String(new Date(device.hkr.nextchange.endperiod * 1000))
															: null,
													ack: true
												});
											} else if (key === 'tchange') {
												await this.createValueState(
													identifier,
													'tchange',
													'Temp after next change',
													0,
													128,
													'°C'
												);
												await this.setStateAsync('DECT_' + identifier + '.tchange', {
													val: parseFloat(device.hkr.nextchange.tchange) / 2,
													ack: true
												});
											} else {
												this.log.warn(' new datapoint in API detected -> ' + key);
											}
										})
									);
								} catch (e) {
									this.log.debug(
										' hkr.nextchange problem ' + JSON.stringify(device.hkr.nextchange) + ' ' + e
									);
								}
							} else if (key === 'adaptiveHeatingRunning') {
								await this.createIndicatorState(
									identifier,
									'adaptiveHeatingRunning',
									'adaptive Heating Running status'
								);
								await this.setStateAsync('DECT_' + identifier + '.adaptiveHeatingRunning', {
									val: device.hkr.adaptiveHeatingRunning == 1 ? true : false,
									ack: true
								});
							} else if (key === 'adaptiveHeatingActive') {
								await this.createIndicatorState(
									identifier,
									'adaptiveHeatingActive',
									'adaptive Heating active status'
								);
								await this.setStateAsync('DECT_' + identifier + '.adaptiveHeatingActive', {
									val: device.hkr.adaptiveHeatingActive == 1 ? true : false,
									ack: true
								});
							} else {
								this.log.warn(' new datapoint in API detected -> ' + key);
							}
						})
					);
				}

				// simpleonoff
				// switchtype wird hier nochmal überschrieben
				if (device.simpleonoff) {
					this.log.debug('setting up simpleonoff');
					await Promise.all(
						Object.keys(device.simpleonoff).map(async (key) => {
							//await this.asyncForEach(Object.keys(device.simpleonoff), async (key) => {
							if (key === 'state') {
								await this.createSwitch(identifier, 'state', 'Simple ON/OFF state and cmd');
								await this.setStateAsync('DECT_' + identifier + '.state', {
									val: device.simpleonoff.state == 1 ? true : false,
									ack: true
								});
								await this.createInfoState(identifier, 'switchtype', 'Switch Type');
								await this.setStateAsync('DECT_' + identifier + '.switchtype', {
									val: 'simpleonoff',
									ack: true
								});
							} else {
								this.log.warn(' new datapoint in API detected -> ' + key);
							}
						})
					);
				}
				// levelcontrol
				if (device.levelcontrol) {
					this.log.debug('setting up levelcontrol');
					await Promise.all(
						Object.keys(device.levelcontrol).map(async (key) => {
							//await this.asyncForEach(Object.keys(device.levelcontrol), async (key) => {
							if (key === 'level') {
								await this.createValueCtrl(
									identifier,
									'level',
									'level 0..255',
									0,
									255,
									'',
									'value.level'
								);
								await this.setStateAsync('DECT_' + identifier + '.level', {
									val: parseInt(device.levelcontrol.level),
									ack: true
								});
							} else if (key === 'levelpercentage') {
								await this.createValueCtrl(
									identifier,
									'levelpercentage',
									'level in %',
									0,
									100,
									'%',
									'value.level'
								);
								await this.setStateAsync('DECT_' + identifier + '.levelpercentage', {
									val: parseInt(device.levelcontrol.levelpercentage),
									ack: true
								});
							} else {
								this.log.warn(' new datapoint in API detected -> ' + key);
							}
						})
					);
				}
				// colorcontrol
				if (device.colorcontrol) {
					this.log.debug('setting up thermostat ');
					await Promise.all(
						Object.keys(device.colorcontrol).map(async (key) => {
							//await this.asyncForEach(Object.keys(device.colorcontrol), async (key) => {
							if (key === 'supported_modes') {
								await this.createModeState(identifier, 'supported_modes', 'available color modes');
								await this.setStateAsync('DECT_' + identifier + '.supported_modes', {
									val: parseInt(device.colorcontrol.supported_modes),
									ack: true
								});
							} else if (key === 'current_mode') {
								await this.createModeState(identifier, 'current_mode', 'current color mode');
								await this.setStateAsync('DECT_' + identifier + '.current_mode', {
									val: parseInt(device.colorcontrol.current_mode),
									ack: true
								});
							} else if (key === 'fullcolorsupport') {
								await this.createIndicatorState(identifier, 'fullcolorsupport', 'Full Color Support');
								await this.setStateAsync('DECT_' + identifier + '.fullcolorsupport', {
									val: device.colorcontrol.fullcolorsupport == 1 ? true : false,
									ack: true
								});
							} else if (key === 'mapped') {
								await this.createIndicatorState(identifier, 'mapped', 'Mapped Indicator');
								await this.setStateAsync('DECT_' + identifier + '.mapped', {
									val: device.colorcontrol.mapped == 1 ? true : false,
									ack: true
								});
							} else if (key === 'hue') {
								await this.createValueCtrl(identifier, 'hue', 'HUE color', 0, 359, '°', 'value.hue');
								await this.setStateAsync('DECT_' + identifier + '.hue', {
									val: device.colorcontrol.hue !== null ? parseInt(device.colorcontrol.hue) : null,
									ack: true
								});
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
								await this.setStateAsync('DECT_' + identifier + '.saturation', {
									val:
										device.colorcontrol.saturation !== null
											? parseInt(device.colorcontrol.saturation)
											: null,
									ack: true
								});
							} else if (key === 'unmapped_hue') {
								await this.createValueState(
									identifier,
									'unmapped_hue',
									'unmapped hue value',
									0,
									359,
									'°'
								);
								await this.setStateAsync('DECT_' + identifier + '.unmapped_hue', {
									val: parseInt(device.colorcontrol.unmapped_hue),
									ack: true
								});
							} else if (key === 'unmapped_saturation') {
								await this.createValueState(
									identifier,
									'unmapped_saturation',
									'unmapped saturation value',
									0,
									255,
									''
								);
								await this.setStateAsync('DECT_' + identifier + '.unmapped_saturation', {
									val: parseInt(device.colorcontrol.unmapped_saturation),
									ack: true
								});
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
								await this.setStateAsync('DECT_' + identifier + '.temperature', {
									val:
										device.colorcontrol.temperature !== null
											? parseInt(device.colorcontrol.temperature)
											: null,
									ack: true
								});
							} else {
								this.log.warn(' new datapoint in API detected -> ' + key);
							}
						})
					);
				}
			}
			//})
			//);
		}
	}
	async createObject(typ, newId, name, role) {
		this.log.info('____________________________________________');
		this.log.info('create Main object ' + typ + ' ' + newId + ' ' + name + ' ' + role);
		await this.setObjectNotExistsAsync(typ + newId, {
			type: 'channel',
			common: {
				name: name,
				role: role
			},
			native: {
				aid: newId
			}
		});
		return;
	}
	async createInfoState(newId, datapoint, name) {
		this.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await this.setObjectNotExistsAsync('DECT_' + newId + '.' + datapoint, {
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
		return;
	}
	async createIndicatorState(newId, datapoint, name) {
		this.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await this.setObjectNotExistsAsync('DECT_' + newId + '.' + datapoint, {
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
		return;
	}
	async createValueState(newId, datapoint, name, min, max, unit) {
		this.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await this.setObjectNotExistsAsync('DECT_' + newId + '.' + datapoint, {
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
		return;
	}
	async createTimeState(newId, datapoint, name) {
		this.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await this.setObjectNotExistsAsync('DECT_' + newId + '.' + datapoint, {
			type: 'state',
			common: {
				name: name,
				type: 'string',
				read: true,
				write: false,
				role: 'date',
				desc: name
			},
			native: {}
		});
		return;
	}
	async createButton(newId, datapoint, name) {
		this.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await this.setObjectNotExistsAsync('DECT_' + newId + '.' + datapoint, {
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
		return;
	}
	async createSwitch(newId, datapoint, name) {
		this.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await this.setObjectNotExistsAsync('DECT_' + newId + '.' + datapoint, {
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
		return;
	}
	async createModeState(newId, datapoint, name) {
		this.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await this.setObjectNotExistsAsync('DECT_' + newId + '.' + datapoint, {
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
		return;
	}
	async createValueCtrl(newId, datapoint, name, min, max, unit, role) {
		this.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await this.setObjectNotExistsAsync('DECT_' + newId + '.' + datapoint, {
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
		return;
	}
	async createList(newId, datapoint, name) {
		this.log.debug('create list' + newId + ' with  ' + datapoint);
		await this.setObjectNotExistsAsync('DECT_' + newId + '.' + datapoint, {
			type: 'state',
			common: {
				name: name,
				type: 'array',
				read: true,
				write: false,
				role: 'list',
				desc: name
			},
			native: {}
		});
		return;
	}
	async createTemplateResponse() {
		this.log.debug('create template.lasttemplate for response ');
		await this.setObjectNotExistsAsync('template', {
			type: 'channel',
			common: {
				name: 'template response',
				role: 'switch'
			},
			native: {}
		});
		await this.setObjectNotExistsAsync('template.lasttemplate', {
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
		return;
	}
	async createTemplate(typ, newId, name, role, id) {
		this.log.debug('create Template objects ');
		await this.setObjectNotExistsAsync(typ + newId, {
			type: 'channel',
			common: {
				name: name,
				role: role
			},
			native: {
				aid: newId
			}
		});
		await this.setObjectNotExistsAsync(typ + newId + '.id', {
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
		await this.setObjectNotExistsAsync(typ + newId + '.name', {
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
		await this.setObjectNotExistsAsync(typ + newId + '.toggle', {
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
		await this.setStateAsync(typ + newId + '.toggle', { val: false, ack: true });
		return;
	}
	async createRoutine(typ, newId, name, role, val) {
		this.log.debug('create Template objects ');
		await this.setObjectNotExistsAsync(typ + newId, {
			type: 'channel',
			common: {
				name: name,
				role: role
			},
			native: {
				aid: newId
			}
		});
		await this.setObjectNotExistsAsync(typ + newId + '.name', {
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
		await this.setObjectNotExistsAsync(typ + newId + '.active', {
			type: 'state',
			common: {
				name: 'Routine activation',
				type: 'boolean',
				read: true,
				write: true,
				role: 'button',
				desc: 'Routine Activation'
			},
			native: {}
		});
		await this.setStateAsync(typ + newId + '.active', { val: val, ack: true });
		return;
	}
	async createThermostat(newId) {
		this.log.debug('create Thermostat objects');
		await this.setObjectNotExistsAsync('DECT_' + newId + '.hkrmode', {
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
		await this.setObjectNotExistsAsync('DECT_' + newId + '.lasttarget', {
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
		await this.setObjectNotExistsAsync('DECT_' + newId + '.operationlist', {
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
		await this.setObjectNotExistsAsync('DECT_' + newId + '.operationmode', {
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
		await this.setStateAsync('DECT_' + newId + '.operationmode', {
			val: 'waiting',
			ack: true
		});
		await this.setObjectNotExistsAsync('DECT_' + newId + '.setmodeoff', {
			type: 'state',
			common: {
				name: 'Switch MODE OFF',
				type: 'boolean',
				read: true,
				write: true,
				role: 'button',
				desc: 'Switch MODE OFF'
			},
			native: {}
		});
		await this.setStateAsync('DECT_' + newId + '.setmodeoff', {
			val: false,
			ack: true
		});
		await this.setObjectNotExistsAsync('DECT_' + newId + '.setmodeon', {
			type: 'state',
			common: {
				name: 'Switch MODE ON',
				type: 'boolean',
				read: true,
				write: true,
				role: 'button',
				desc: 'Switch MODE ON'
			},
			native: {}
		});
		await this.setStateAsync('DECT_' + newId + '.setmodeon', {
			val: false,
			ack: true
		});
		await this.setObjectNotExistsAsync('DECT_' + newId + '.setmodeauto', {
			type: 'state',
			common: {
				name: 'Switch MODE AUTO',
				type: 'boolean',
				read: true,
				write: true,
				role: 'button',
				desc: 'Switch MODE AUTO'
			},
			native: {}
		});
		await this.setStateAsync('DECT_' + newId + '.setmodeauto', {
			val: false,
			ack: true
		});
		return;
	}
	async createBlind(newId) {
		this.log.debug('create Blinds objects');
		await this.setObjectNotExistsAsync('DECT_' + newId + '.blindsopen', {
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
		await this.setStateAsync('DECT_' + newId + '.blindsopen', {
			val: false,
			ack: true
		});
		await this.setObjectNotExistsAsync('DECT_' + newId + '.blindsclose', {
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
		await this.setStateAsync('DECT_' + newId + '.blindsclose', {
			val: false,
			ack: true
		});
		await this.setObjectNotExistsAsync('DECT_' + newId + '.blindsstop', {
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
		await this.setStateAsync('DECT_' + newId + '.blindsstop', {
			val: false,
			ack: true
		});
		return;
	}
	async createStats(identifier, type) {
		this.log.debug('create Stats objects ');
		await this.setObjectNotExistsAsync('DECT_' + identifier + '.' + type + '_stats', {
			type: 'channel',
			common: {
				name: type + '_stats'
			},
			native: {}
		});

		if (type == 'energy') {
			await this.createValueState(
				identifier,
				type + '_stats' + '.countm',
				'stats count of months',
				0,
				12,
				'months'
			);
			await this.createValueState(identifier, type + '_stats.gridm', 'grid of months', 0, 2678400, 's');
			await this.setObjectNotExistsAsync('DECT_' + identifier + '.' + type + '_stats.datatimem', {
				type: 'state',
				common: {
					name: 'time of stats of months',
					type: 'number',
					min: 0,
					max: 2147483648,
					read: true,
					write: false,
					role: 'date',
					desc: 'time of stats of months'
				},
				native: {}
			});
			await this.createValueState(identifier, type + '_stats.countd', 'stats countof days', 0, 31, 'days');
			await this.createValueState(identifier, type + '_stats.gridd', 'grid of days', 0, 86400, 's');
			await this.setObjectNotExistsAsync('DECT_' + identifier + '.' + type + '_stats.datatimed', {
				type: 'state',
				common: {
					name: 'time of stats of days',
					type: 'number',
					min: 0,
					max: 2147483648,
					read: true,
					write: false,
					role: 'date',
					desc: 'time of stats of days'
				},
				native: {}
			});
			await this.createValueState(
				identifier,
				type + '_stats.energy_ytd',
				'energy year to date',
				0,
				30000000,
				'Wh'
			);
			await this.createValueState(
				identifier,
				type + '_stats.energy_last12m',
				'energy last 12 months',
				0,
				30000000,
				'Wh'
			);
			await this.createValueState(
				identifier,
				type + '_stats.energy_mtd',
				'energy month to date',
				0,
				2500000,
				'Wh'
			);
			await this.createValueState(
				identifier,
				type + '_stats.energy_last31d',
				'energy last 31 days',
				0,
				2500000,
				'Wh'
			);
			await this.createValueState(identifier, type + '_stats.energy_dtd', 'energy day to date', 0, 87000, 'Wh');
			await this.createList(identifier, type + '_stats.stats_months', 'energy monthly stats array');
			await this.createList(identifier, type + '_stats.stats_days', 'energy dayly stats array');
		} else {
			await this.createValueState(identifier, type + '_stats.count', 'stats count', 0, 360, 'counts');
			await this.createValueState(identifier, type + '_stats.grid', 'grid', 0, 2678400, 's');
			await this.setObjectNotExistsAsync('DECT_' + identifier + '.' + type + '_stats.datatime', {
				type: 'state',
				common: {
					name: 'time of stats',
					type: 'number',
					min: 0,
					max: 2147483648,
					read: true,
					write: false,
					role: 'date',
					desc: 'time of stats'
				},
				native: {}
			});
			await this.createList(identifier, type + '_stats.stats', 'stats array');
		}

		return;
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
