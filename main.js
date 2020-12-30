/*jshint -W097 */ // jshint strict:false
/*jslint node: true */

'use strict';

const Fritz = require('./lib/fritzhttp.js');
const parser = require('xml2json-light');
// you have to require the utils module and call adapter function

var utils = require('@iobroker/adapter-core'); // Get common adapter utils
// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0

var fritzTimeout;

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

let adapter;
function startAdapter(options) {
	options = options || {};
	Object.assign(options, {
		name: 'fritzdect',

		// is called when adapter shuts down - callback has to be called under any circumstances!
		unload: function(callback) {
			if (fritzTimeout) clearTimeout(fritzTimeout);
			try {
				adapter.log.info('cleaned everything up...');
				callback();
			} catch (e) {
				callback();
			}
		},

		// is called if a subscribed object changes
		objectChange: function(id, obj) {
			// Warning, obj can be null if it was deleted
			adapter.log.debug('objectChange ' + id + ' ' + JSON.stringify(obj));
		},

		// is called if a subscribed state changes
		stateChange: function(id, state) {
			// Warning, state can be null if it was deleted
			adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));
			var username = adapter.config.fritz_user;
			var password = adapter.config.fritz_pw;
			var moreParam = adapter.config.fritz_ip;

			var fritz = new Fritz(username, password || '', moreParam || '');

			// you can use the ack flag to detect if it is status (true) or command (false)
			if (state && !state.ack) {
				adapter.log.debug('ack is not set! -> command');
				var tmp = id.split('.');
				var dp = tmp.pop();
				var idx = tmp.pop(); //is the name after fritzdect.x.
				// devices or groups
				if (idx.startsWith('DECT_')) {
					// braucht man nicht wenn kein toggle in devices vorkommt
					id = idx.replace(/DECT_/g, ''); //Thermostat
					adapter.log.info('DECT ID: ' + id + ' identified for command (' + dp + ') : ' + state.val);
					if (dp === 'tsoll') {
						if (state.val < 8) {
							//kann gelöscht werden, wenn Temperaturvorwahl nicht zur Moduswahl benutzt werden soll
							adapter.setState('DECT_' + id + '.hkrmode', { val: 1, ack: false }); //damit das Ventil auch regelt
							fritz
								.setTempTarget(id, 'off')
								.then(function(sid) {
									adapter.log.debug('Switched Mode' + id + ' to closed');
								})
								.catch(errorHandler);
						} else if (state.val > 28) {
							//kann gelöscht werden, wenn Temperaturvorwahl nicht zur Moduswahl benutzt werden soll
							adapter.setState('DECT_' + id + '.hkrmode', { val: 2, ack: false }); //damit das Ventil auch regelt
							fritz
								.setTempTarget(id, 'on')
								.then(function(sid) {
									adapter.log.debug('Switched Mode' + id + ' to opened permanently');
								})
								.catch(errorHandler);
						} else {
							adapter.setState('DECT_' + id + '.hkrmode', { val: 0, ack: false }); //damit das Ventil auch regelt
							fritz
								.setTempTarget(id, state.val)
								.then(function(sid) {
									adapter.log.debug('Set target temp ' + id + state.val + ' °C');
									adapter.setState('DECT_' + id + '.lasttarget', { val: state.val, ack: true }); //iobroker Tempwahl wird zum letzten Wert gespeichert
									adapter.setState('DECT_' + id + '.tsoll', { val: state.val, ack: true }); //iobroker Tempwahl wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch(errorHandler);
						}
					} else if (dp === 'mode') {
						if (state.val === 0) {
							adapter.getState('DECT_' + id + '.tsoll', function(err, targettemp) {
								// oder hier die Verwendung von lasttarget
								if (targettemp.val) {
									var setTemp = targettemp.val;
									if (setTemp < 8) {
										adapter.setState('DECT_' + id + '.tsoll', { val: 8, ack: true });
										setTemp = 8;
									} else if (setTemp > 28) {
										adapter.setState('DECT_' + id + '.tsoll', { val: 28, ack: true });
										setTemp = 28;
									}
									fritz
										.setTempTarget(id, setTemp)
										.then(function(sid) {
											adapter.log.debug('Set target temp ' + id + ' ' + setTemp + ' °C');
											adapter.setState('DECT_' + id + '.tsoll', {
												val: setTemp,
												ack: true
											}); //iobroker Tempwahl wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
										})
										.catch(errorHandler);
								} else {
									adapter.log.error('no data in targettemp for setting mode');
								}
							});
						} else if (state.val === 1) {
							fritz
								.setTempTarget(id, 'off')
								.then(function(sid) {
									adapter.log.debug('Switched Mode' + id + ' to closed.');
								})
								.catch(errorHandler);
						} else if (state.val === 2) {
							fritz
								.setTempTarget(id, 'on')
								.then(function(sid) {
									adapter.log.debug('Switched Mode' + id + ' to opened permanently');
								})
								.catch(errorHandler);
						}
					}
					if (dp == 'boostactivetime') {
						adapter.log.debug(
							'Nothing to send external, but the boost active time was defined for ' + state.val + ' min'
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
								.then(function(sid) {
									adapter.log.debug('Reset thermostat boost ' + id + ' to ' + state.val);
									adapter.setState('DECT_' + id + '.boostactive', { val: state.val, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch(errorHandler);
						} else if (
							state.val === 1 ||
							state.val === '1' ||
							state.val === 'true' ||
							state.val === true ||
							state.val === 'on' ||
							state.val === 'ON'
						) {
							adapter.getState('DECT_' + id + '.boostactivetime', function(err, minutes) {
								let ende = Math.floor(Date.now() / 1000 + minutes.val * 60); //time for fritzbox is in seconds
								adapter.log.debug(' unix returned ' + ende + ' real ' + new Date(ende * 1000));
								fritz
									.setHkrBoost(id, ende)
									.then(function(body) {
										let endtime = new Date(Math.floor(body * 1000));
										adapter.log.debug('window ' + body + ' reading to ' + endtime);
										adapter.log.debug(
											'Set thermostat boost ' +
												id +
												' to ' +
												state.val +
												' until calculated ' +
												ende +
												' ' +
												new Date(ende * 1000)
										);
										adapter.setState('DECT_' + id + '.boostactive', { val: state.val, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
										adapter.setState('DECT_' + id + '.boostactiveendtime', {
											val: endtime,
											ack: true
										}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
									})
									.catch(errorHandler);
							});
						}
					}
					if (dp == 'windowopenactivetime') {
						adapter.log.debug(
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
								.then(function(sid) {
									adapter.log.debug('Reset thermostat windowopen ' + id + ' to ' + state.val);
									adapter.setState('DECT_' + id + '.windowopenactiv', { val: state.val, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch(errorHandler);
						} else if (
							state.val === 1 ||
							state.val === '1' ||
							state.val === 'true' ||
							state.val === true ||
							state.val === 'on' ||
							state.val === 'ON'
						) {
							adapter.getState('DECT_' + id + '.windowopenactivetime', function(err, minutes) {
								let ende = Math.floor(Date.now() / 1000 + minutes.val * 60); //time for fritzbox is in seconds
								adapter.log.debug(' unix ' + ende + ' real ' + new Date(ende * 1000));
								fritz
									.setWindowOpen(id, ende)
									.then(function(body) {
										let endtime = new Date(Math.floor(body * 1000));
										adapter.log.debug('window ' + body + ' reading to ' + endtime);
										adapter.log.debug(
											'Set thermostat windowopen ' +
												id +
												' to ' +
												state.val +
												' until calculated ' +
												ende +
												' ' +
												new Date(ende * 1000)
										);
										adapter.setState('DECT_' + id + '.windowopenactiv', {
											val: state.val,
											ack: true
										}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
										adapter.setState('DECT_' + id + '.windowopenactiveendtime', {
											val: endtime,
											ack: true
										}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
									})
									.catch(errorHandler);
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
								.then(function(sid) {
									adapter.log.debug('Turned switch ' + id + ' off');
									adapter.setState('DECT_' + id + '.state', { val: false, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch(errorHandler);
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
								.then(function(sid) {
									adapter.log.debug('Turned switch ' + id + ' on');
									adapter.setState('DECT_' + id + '.state', { val: true, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch(errorHandler);
						}
					}
					if (dp == 'blindsclose') {
						fritz
							.setBlind(id, 'close')
							.then(function(sid) {
								adapter.log.debug('Started blind ' + id + ' to close');
								adapter.setState('DECT_' + id + '.blindsclose', { val: false, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
							})
							.catch(errorHandler);
					}
					if (dp == 'blindsopen') {
						fritz
							.setBlind(id, 'open')
							.then(function(sid) {
								adapter.log.debug('Started blind ' + id + ' to open');
								adapter.setState('DECT_' + id + '.blindsopen', { val: false, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
							})
							.catch(errorHandler);
					}
					if (dp == 'blindsstop') {
						fritz
							.setBlind(id, 'stop')
							.then(function(sid) {
								adapter.log.debug('Set blind ' + id + ' to stop');
								adapter.setState('DECT_' + id + '.blindsstop', { val: false, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
							})
							.catch(errorHandler);
					}
					if (dp == 'level') {
						fritz
							.setLevel(id, state.val)
							.then(function(sid) {
								adapter.log.debug('Set level' + id + ' to ' + state.val);
								adapter.setState('DECT_' + id + '.level', { val: state.val, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
							})
							.catch(errorHandler);
					}
					if (dp == 'levelpercentage') {
						fritz
							.setLevel(id, parseInt(state.val / 100 * 255))
							.then(function(sid) {
								//level is in 0...255
								adapter.log.debug('Set level %' + id + ' to ' + state.val);
								adapter.setState('DECT_' + id + '.levelpercentage', { val: state.val, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
							})
							.catch(errorHandler);
					}
					if (dp == 'hue') {
						adapter.getState('DECT_' + id + '.saturation', function(err, saturation) {
							// oder hier die Verwendung von lasttarget
							var setSaturation = saturation.val;
							if (setSaturation == '') {
								adapter.log.error(
									'No saturation value exists when setting hue, please set saturation to a value '
								);
							} else {
								fritz
									.setColor(id, setSaturation, state.val)
									.then(function(sid) {
										adapter.log.debug(
											'Set lamp color hue ' +
												id +
												' to ' +
												state.val +
												' and saturation of ' +
												setSaturation
										);
										adapter.setState('DECT_' + id + '.hue', { val: state.val, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
									})
									.catch(errorHandler);
							}
						});
					}
					if (dp == 'saturation') {
						adapter.getState('DECT_' + id + '.hue', function(err, hue) {
							var setHue = hue.val;
							if (setHue == '') {
								adapter.log.error(
									'No hue value exists when setting saturation, please set hue to a value '
								);
							} else {
								fritz
									.setColor(id, state.val, setHue)
									.then(function(sid) {
										adapter.log.debug(
											'Set lamp color saturation ' +
												id +
												' to ' +
												state.val +
												' and hue of ' +
												setHue
										);
										adapter.setState('DECT_' + id + '.saturation', {
											val: state.val,
											ack: true
										}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
									})
									.catch(errorHandler);
							}
						});
					}
					if (dp == 'temperature') {
						fritz
							.setColorTemperature(id, state.val)
							.then(function(sid) {
								adapter.log.debug('Set lamp color temperature ' + id + ' to ' + state.val);
								adapter.setState('DECT_' + id + '.temperature', { val: state.val, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
							})
							.catch(errorHandler);
					}
				} else if (idx.startsWith('template_')) {
					//must be fritzbox template
					id = idx.replace(/template_/g, ''); //template
					adapter.log.info('Template ID: ' + id + ' identified for command (' + dp + ') : ' + state.val);
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
								.then(function(sid) {
									adapter.log.debug('cmd Toggle to template ' + id + ' on');
									adapter.log.debug('response ' + sid);
									adapter.setState('template.lasttemplate', { val: sid, ack: true }); //when successfull toggle, the API returns the id of the template
								})
								.catch(errorHandler);
						}
					}
				}
			} //from if state&ack
		},

		// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
		message: function(obj) {
			var wait = false;
			// handle the message
			if (obj) {
				switch (obj.command) {
					case 'devices':
						var result = [];

						var username = adapter.config.fritz_user;
						var password = adapter.config.fritz_pw;
						var moreParam = adapter.config.fritz_ip;

						var fritz = new Fritz(username, password || '', moreParam || '');
						fritz
							.getDeviceListInfos()
							.then(function(devicelistinfos) {
								var devices = parser.xml2json(devicelistinfos);
								devices = [].concat((devices.devicelist || {}).device || []).map(function(device) {
									// remove spaces in AINs
									device.identifier = device.identifier.replace(/\s/g, '');
									return device;
								});
								result = devices;
							})
							.done(function(devicelistinfos) {
								if (obj.callback) adapter.sendTo(obj.from, obj.command, result, obj.callback);
							});
						wait = true;
						break;
					case 'groups':
						var result = [];

						var username = adapter.config.fritz_user;
						var password = adapter.config.fritz_pw;
						var moreParam = adapter.config.fritz_ip;

						var fritz = new Fritz(username, password || '', moreParam || '');
						fritz
							.getDeviceListInfos()
							.then(function(devicelistinfos) {
								var groups = parser.xml2json(devicelistinfos);
								groups = [].concat((groups.devicelist || {}).group || []).map(function(group) {
									// remove spaces in AINs
									group.identifier = group.identifier.replace(/\s/g, '');
									return group;
								});
								result = groups;
							})
							.done(function(devicelistinfos) {
								if (obj.callback) adapter.sendTo(obj.from, obj.command, result, obj.callback);
							});
						wait = true;
						break;
					case 'templates':
						var result = [];

						var username = adapter.config.fritz_user;
						var password = adapter.config.fritz_pw;
						var moreParam = adapter.config.fritz_ip;

						var fritz = new Fritz(username, password || '', moreParam || '');
						fritz
							.getTemplateListInfos()
							.then(function(templatelistinfos) {
								var templates = parser.xml2json(templatelistinfos);
								templates = []
									.concat((templates.templatelist || {}).template || [])
									.map(function(template) {
										// remove spaces in AINs
										// template.identifier = group.identifier.replace(/\s/g, '');
										return template;
									});
								result = templates;
							})
							.done(function(templatelistinfos) {
								if (obj.callback) adapter.sendTo(obj.from, obj.command, result, obj.callback);
							});
						wait = true;
						break;
					case 'statistic':
						var result = [];

						var username = adapter.config.fritz_user;
						var password = adapter.config.fritz_pw;
						var moreParam = adapter.config.fritz_ip;

						var fritz = new Fritz(username, password || '', moreParam || '');
						fritz
							.getBasicDeviceStats(obj.message) //ain muß übergeben werden
							.then(function(statisticinfos) {
								//obj.message should be ain of device requested
								var devicestats = parser.xml2json(statisticinfos);
								result = devicestats;
							})
							.done(function(statisticinfos) {
								if (obj.callback) adapter.sendTo(obj.from, obj.command, result, obj.callback);
							});
						wait = true;
						break;
					case 'color':
						var result = [];

						var username = adapter.config.fritz_user;
						var password = adapter.config.fritz_pw;
						var moreParam = adapter.config.fritz_ip;

						var fritz = new Fritz(username, password || '', moreParam || '');
						fritz
							.getColorDefaults()
							.then(function(colorinfos) {
								result = colorinfos;
							})
							.done(function(colorinfos) {
								if (obj.callback) adapter.sendTo(obj.from, obj.command, result, obj.callback);
							});
						wait = true;
						break;
					//idea for other statistics: call of message returns everything (loop over all devices)
					default:
						adapter.log.warn('Received unhandled message: ' + obj.command);
						break;
				}
			}
			if (!wait && obj.callback) {
				adapter.sendTo(obj.from, obj.command, obj.message, obj.callback);
			}

			return true;
		},

		// is called when databases are connected and adapter received configuration.
		// start here!
		ready: function() {
			adapter.log.info('entered ready');
			adapter.getForeignObject('system.config', (err, obj) => {
				if (obj && obj.native && obj.native.secret) {
					//noinspection JSUnresolvedVariable
					adapter.config.fritz_pw = decrypt(obj.native.secret, adapter.config.fritz_pw);
				} else {
					//noinspection JSUnresolvedVariable
					adapter.config.fritz_pw = decrypt('Zgfr56gFe87jJOM', adapter.config.fritz_pw);
				}
				main();
			});
		}
	});
	adapter = new utils.Adapter(options);

	return adapter;
}

function decrypt(key, value) {
	let result = '';
	for (let i = 0; i < value.length; ++i) {
		result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
	}
	return result;
}

function errorHandler(error) {
	adapter.log.error('fritzbox returned this ' + JSON.stringify(error));
	if (error == '0000000000000000') {
		adapter.log.error('Did not get session id- invalid username or password?');
	} else if (!error.response) {
		adapter.log.error('no response part in returned message');
	} else if (error.response.statusCode) {
		if (error.response.statusCode == 403) {
			adapter.log.error('no permission for this call (403), has user all the rights and access to fritzbox?');
			adapter.log.error('error calling the fritzbox ' + JSON.stringify(error));
		} else if (error.response.statusCode == 404) {
			adapter.log.error('call to API does not exist! (404)');
			adapter.log.error('error calling the fritzbox ' + JSON.stringify(error));
		} else if (error.response.statusCode == 400) {
			adapter.log.error('bad request (400), ain correct?');
			adapter.log.error('error calling the fritzbox ' + JSON.stringify(error));
		} else if (error.response.statusCode == 500) {
			adapter.log.error('internal fritzbox error (500)');
			adapter.log.error('error calling the fritzbox ' + JSON.stringify(error));
		} else if (error.response.statusCode == 503) {
			adapter.log.error('service unavailable (503)');
			adapter.log.error('error calling the fritzbox ' + JSON.stringify(error));
		} else if (error.response.statusCode == 303) {
			adapter.log.error('unknwon error (303)');
			adapter.log.error('error calling the fritzbox ' + JSON.stringify(error));
		} else {
			adapter.log.error('statuscode not in errorhandler of fritzdect');
			adapter.log.error('error calling the fritzbox ' + JSON.stringify(error));
		}
	} else {
		adapter.log.error('error calling the fritzbox ' + JSON.stringify(error));
	}
}

process.on('SIGINT', function() {
	if (fritzTimeout) clearTimeout(fritzTimeout);
});

async function main() {
	var username = adapter.config.fritz_user;
	var password = adapter.config.fritz_pw;
	var moreParam = adapter.config.fritz_ip;

	var fritz = new Fritz(username, password || '', moreParam || '');

	async function createObject(typ, newId, name, role) {
		adapter.log.debug('create Main object ' + typ + ' ' + newId + ' ' + name + ' ' + role);
		await adapter.setObjectNotExists(typ + newId, {
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
	async function createInfoState(newId, datapoint, name) {
		adapter.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await adapter.setObjectNotExists('DECT_' + newId + '.' + datapoint, {
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
	async function createIndicatorState(newId, datapoint, name) {
		adapter.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await adapter.setObjectNotExists('DECT_' + newId + '.' + datapoint, {
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
	async function createValueState(newId, datapoint, name, min, max, unit) {
		adapter.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await adapter.setObjectNotExists('DECT_' + newId + '.' + datapoint, {
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
	async function createTimeState(newId, datapoint, name) {
		adapter.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await adapter.setObjectNotExists('DECT_' + newId + '.' + datapoint, {
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
	async function createButton(newId, datapoint, name) {
		adapter.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await adapter.setObjectNotExists('DECT_' + newId + '.' + datapoint, {
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
	async function createSwitch(newId, datapoint, name) {
		adapter.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await adapter.setObjectNotExists('DECT_' + newId + '.' + datapoint, {
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
	async function createModeState(newId, datapoint, name) {
		adapter.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await adapter.setObjectNotExists('DECT_' + newId + '.' + datapoint, {
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
	async function createValueCtrl(newId, datapoint, name, min, max, role) {
		adapter.log.debug('create datapoint ' + newId + ' with  ' + datapoint);
		await adapter.setObjectNotExists('DECT_' + newId + '.' + datapoint, {
			type: 'state',
			common: {
				name: name,
				type: 'number',
				min: min,
				max: max,
				read: true,
				write: true,
				role: role,
				desc: name
			},
			native: {}
		});
	}
	function createTemplateResponse() {
		adapter.log.debug('create template.lasttemplate for response ');
		adapter.setObjectNotExists('template', {
			type: 'channel',
			common: {
				name: 'template response',
				role: 'switch'
			},
			native: {}
		});
		adapter.setObjectNotExists('template.lasttemplate', {
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
	async function createTemplate(typ, newId, name, role, id) {
		adapter.log.debug('create Template objects ');
		adapter.setObjectNotExists(typ + newId, {
			type: 'channel',
			common: {
				name: name,
				role: role
			},
			native: {
				aid: newId
			}
		});
		adapter.setObjectNotExists(typ + newId + '.id', {
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
		adapter.setState(typ + newId + '.id', { val: id, ack: true });
		await adapter.setObjectNotExists(typ + newId + '.name', {
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
		adapter.setState(typ + newId + '.name', { val: name, ack: true });
		adapter.setObjectNotExists(typ + newId + '.toggle', {
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
	async function createThermostat(newId) {
		adapter.log.debug('create Thermostat objects');
		adapter.setObjectNotExists('DECT_' + newId + '.hkrmode', {
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
		adapter.setObjectNotExists('DECT_' + newId + '.lasttarget', {
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
		await adapter.setObjectNotExists('DECT_' + newId + '.operationList', {
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
		adapter.setState('DECT_' + newId + '.operationList', {
			val: `On, Off, Holiday, Summer, Comfort, Night`,
			ack: true
		});
		adapter.setObjectNotExists('DECT_' + newId + '.operationMode', {
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
	async function createBlind(newId) {
		adapter.log.debug('create Blinds objects');
		await adapter.setObjectNotExists('DECT_' + newId + '.blindsopen', {
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
		await adapter.setObjectNotExists('DECT_' + newId + '.blindsclose', {
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
		await adapter.setObjectNotExists('DECT_' + newId + '.blindsstop', {
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

	async function asyncForEach(array, callback) {
		for (let index = 0; index < array.length; index++) {
			await callback(array[index], index, array);
		}
	}

	async function createData(devices) {
		var typ = '';
		var role = '';
		//await devices.forEach(async function(device) {
		await asyncForEach(devices, async (device) => {
			typ = 'DECT_';
			adapter.log.debug('trying on : ' + JSON.stringify(device));
			// role to be defined
			if ((device.functionbitmask & 64) == 64) {
				role = 'thermo.heat';
			} else if ((device.functionbitmask & 512) == 512) {
				//DECT300/301
				role = 'switch';
			} else if (device.functionbitmask == 1024 || 1024) {
				//DECT200/210
				role = 'thermo';
			} else if (device.functionbitmask == 288 || 1048864) {
				// Repeater
				role = 'thermo';
			} else if (device.functionbitmask == 237572) {
				// DECT440
				role = 'light';
			} else if (device.functionbitmask == 335888) {
				//DECT500
				role = 'blinds';
			} else if (
				(device.functionbitmask & 16) == 16 ||
				(device.functionbitmask & 8) == 8 ||
				(device.functionbitmask & 32) == 32
			) {
				//Blinds
				role = 'sensor';
			} else if (device.functionbitmask & 1) {
				role = 'etsi';
				// replace id, fwversion in vorher erzeugten device, spätestens beim update
				return;
			} else {
				role = 'other';
				adapter.log.warn(' unknown functionbitmask, please open issue on github ' + device.functionbitmask);
				return;
			}
			// create Master Object
			await createObject(typ, device.identifier, device.name, role);

			// create general
			if (device.fwversion) {
				await createInfoState(device.identifier, 'fwversion', 'Firmware Version');
			}
			if (device.maunfacturer) {
				await createInfoState(device.identifier, 'manufacturer', 'Manufacturer');
			}
			if (device.productname) {
				await createInfoState(device.identifier, 'productname', 'Product Name');
			}
			if (device.present) {
				createIndicatorState(device.identifier, 'present', 'device present');
			}
			if (device.name) {
				await createInfoState(device.identifier, 'name', 'Device Name');
			}
			if (device.txbusy) {
				await createIndicatorState(device.identifier, 'txbusy', 'Trasmitting active');
			}
			if (device.synchronized) {
				await createIndicatorState(device.identifier, 'synchronized', 'Synchronized Status');
			}
			//always ID
			await createInfoState(device.identifier, 'id', 'Device ID');
			//etsideviceid im gleichen Object
			if (device.etsiunitinfo) {
				if (device.etsiunitinfo.etsideviceid) {
					//replace id with etsi
					adapter.setState('DECT_' + device.identifier + '.id', {
						val: device.etsiunitinfo.etsideviceid,
						ack: true
					});
					// noch nicht perfekt da dies überschrieben wird
					adapter.setState('DECT_' + device.identifier + '.fwversion', {
						val: device.etsiunitinfo.fwversion,
						ack: true
					});
				} else {
					//device.id
					adapter.setState('DECT_' + device.identifier + '.id', {
						val: device.id,
						ack: true
					});
				}
				//check for blinds control
				if (device.etsiunitinfo.unittype == 281) {
					//additional blind datapoints
					await createBlind(device.identifier);
				}
			}

			// create battery devices
			if (device.battery) {
				createValueState(device.identifier, 'battery', 'Battery Charge State', 0, 100, '%');
			}
			if (device.batterylow) {
				createIndicatorState(device.identifier, 'batterylow', 'Battery Low State');
			}

			// create button parts
			if (device.button) {
				if (!Array.isArray(device.button)) {
					Object.entries(device.button).asyncForEach(async ([ key, value ]) => {
						if (key === 'lastpressedtimestamp') {
							createTimeState(device.identifier, 'lastpressedtimestamp', 'last button Time Stamp');
						} else if (key === 'id') {
							createInfoState(device.identifier, 'id', 'Button ID');
						} else if (key === 'name') {
							createInfoState(device.identifier, 'name', 'Button Name');
						} else {
							adapter.log.warn(' new datapoint in API detected -> ' + key + ' ' + value);
						}
					});
				} else if (Array.isArray(device.button)) {
					//Unterobjekte anlegen
					adapter.log.info('setting up button(s) ');
					await device.button.forEach(async function(button) {
						typ = 'DECT_' + device.identifier + '.button.';
						await createObject(typ, button.identifier.replace(/\s/g, ''), 'Buttons', 'button'); //rolr button?
						Object.entries(button).forEach(async ([ key, value ]) => {
							if (key === 'lastpressedtimestamp') {
								createTimeState(
									device.identifier + '.button.' + button.identifier.replace(/\s/g, ''),
									'lastpressedtimestamp',
									'last button Time Stamp'
								);
							} else if (key === 'identifier') {
								//already part of the object
							} else if (key === 'id') {
								createInfoState(
									device.identifier + '.button.' + button.identifier.replace(/\s/g, ''),
									'id',
									'Button ID'
								);
							} else if (key === 'name') {
								createInfoState(
									device.identifier + '.button.' + button.identifier.replace(/\s/g, ''),
									'name',
									'Button Name'
								);
							} else {
								adapter.log.warn(' new datapoint in API detected -> ' + key + ' ' + value);
							}
						});
					});
				}
			}
			//create alert
			if (device.alert) {
				adapter.log.info('setting up alert ');
				Object.entries(device.alert).forEach(([ key, value ]) => {
					if (key === 'state') {
						createIndicatorState(device.identifier, 'state', 'Alert State');
					} else if (key === 'lastalertchgtimestamp') {
						createTimeState(device.identifier, 'lastalertchgtimestamp', 'Alert last Time');
					} else {
						adapter.log.warn(' new datapoint in API detected -> ' + key + ' ' + value);
					}
				});
			}
			// create switch
			if (device.switch) {
				adapter.log.info('setting up switch ');
				Object.entries(device.switch).forEach(([ key, value ]) => {
					if (key === 'state') {
						createSwitch(device.identifier, 'state', 'Switch Status and Control');
					} else if (key === 'mode') {
						createInfoState(device.identifier, 'mode', 'Switch Mode');
					} else if (key === 'lock') {
						createIndicatorState(device.identifier, 'lock', 'API Lock');
					} else if (key === 'devicelock') {
						createIndicatorState(device.identifier, 'devicelock', 'Device (Button)lock');
					} else {
						adapter.log.warn(' new datapoint in API detected -> ' + key + ' ' + value);
					}
				});
			}
			// powermeter
			if (device.powermeter) {
				adapter.log.info('setting up powermeter ');
				Object.entries(device.powermeter).forEach(([ key, value ]) => {
					if (key === 'power') {
						createValueState(device.identifier, 'power', 'actual Power', 0, 4000, 'W');
					} else if (key === 'voltage') {
						createValueState(device.identifier, 'voltage', 'actual Voltage', 0, 250, 'V');
					} else if (key === 'energy') {
						createValueState(device.identifier, 'energy', 'Energy consumption', 0, 999999999, 'Wh');
					} else {
						adapter.log.warn(' new datapoint in API detected -> ' + key + ' ' + value);
					}
				});
			}
			// groups
			if (device.groupinfo) {
				adapter.log.info('setting up groupinfo ');
				Object.entries(device.groupinfo).forEach(([ key, value ]) => {
					if (key === 'masterdeviceid') {
						createInfoState(device.identifier, 'masterdeviceid', 'ID of the group');
					} else if (key === 'members') {
						createInfoState(device.identifier, 'members', 'member of the group');
					} else {
						adapter.log.warn(' new datapoint in API detected -> ' + key + ' ' + value);
					}
				});
			}
			// create themosensor
			if (device.temperature) {
				adapter.log.info('setting up temperatur ');
				Object.entries(device.temperature).forEach(([ key, value ]) => {
					if (key === 'celsius') {
						createValueState(device.identifier, 'celsius', 'Temperature', 8, 32, '°C');
					} else if (key === 'offset') {
						createValueState(device.identifier, 'offset', 'Temperature Offset', -10, 10, '°C');
					} else {
						adapter.log.warn(' new datapoint in API detected -> ' + key + ' ' + value);
					}
				});
			}
			// create humidity
			if (device.humidity) {
				adapter.log.info('setting up temperatur ');
				Object.entries(device.humidity).forEach(([ key, value ]) => {
					if (key === 'rel_humidity') {
						createValueState(device.identifier, 'rel_humidity', 'relative Humidity', 0, 100, '%');
					} else {
						adapter.log.warn(' new datapoint in API detected -> ' + key + ' ' + value);
					}
				});
			}
			// create thermostat
			if (device.hkr) {
				adapter.log.info('setting up thermostat ');
				createThermostat(device.identifier); //additional datapoints of thermostats
				Object.entries(device.hkr).forEach(async ([ key, value ]) => {
					//create datapoints from the data
					if (key === 'tist') {
						createValueState(device.identifier, 'tist', 'Actual temperature', 0, 32, '°C');
					} else if (key === 'tsoll') {
						createValueCtrl(
							device.identifier,
							'tsoll',
							'Setpoint Temperature',
							8,
							32,
							'°C',
							'value.temperature'
						);
					} else if (key === 'absenk') {
						createValueState(device.identifier, 'absenk', 'reduced (night) temperature', 0, 32, '°C');
					} else if (key === 'komfort') {
						createValueState(device.identifier, 'komfort', 'comfort temperature', 0, 32, '°C');
					} else if (key === 'lock') {
						createIndicatorState(device.identifier, 'lock', 'Thermostat UI/API lock'); //thermostat lock 0=unlocked, 1=locked
					} else if (key === 'devicelock') {
						createIndicatorState(device.identifier, 'devicelock', 'device lock, button lock');
					} else if (key === 'errorcode') {
						createModeState(device.identifier, 'errorcode', 'Error Code');
					} else if (key === 'batterylow') {
						createIndicatorState(device.identifier, 'batterylow', 'battery low');
					} else if (key === 'battery') {
						createValueState(device.identifier, 'battery', 'battery status', 0, 100, '%');
					} else if (key === 'summeractive') {
						createIndicatorState(device.identifier, 'summeractive', 'summer active status');
					} else if (key === 'holidayactive') {
						createIndicatorState(device.identifier, 'holidayactive', 'Holiday Active status');
					} else if (key === 'boostactive') {
						createSwitch(device.identifier, 'boostactive', 'Boost active status and cmd');
						//create the user definde end time for manual setting the window open active state
						await createValueCtrl(
							device.identifier,
							'boostactivetime',
							'boost active time for cmd',
							0,
							1440,
							'min'
						);
						//preset to 5 min
						adapter.setState('DECT_' + device.identifier + '.boostactivetime', {
							val: 5,
							ack: true
						});
					} else if (key === 'boostactiveendtime') {
						createTimeState(device.identifier, 'boostactiveendtime', 'Boost active end time');
					} else if (key === 'windowopenactiv') {
						createSwitch(device.identifier, 'windowopenactiv', 'Window open status and cmd');
						//create the user definde end time for manual setting the window open active state
						await createValueCtrl(
							device.identifier,
							'windowopenactivetime',
							'window open active time for cmd',
							0,
							1440,
							'min',
							'value.time'
						);
						//preset to 5 min
						adapter.setState('DECT_' + device.identifier + '.windowopenactivetime', {
							val: 5,
							ack: true
						});
					} else if (key === 'windowopenactiveendtime') {
						createTimeState(device.identifier, 'windowopenactiveendtime', 'window open active end time');
					} else if (key === 'nextchange') {
						adapter.log.info('setting up thermostat nextchange');
						try {
							Object.entries(device.hkr.nextchange).forEach(([ key, value ]) => {
								if (key === 'endperiod') {
									createTimeState(device.identifier, 'endperiod', 'next time for Temp change');
								} else if (key === 'tchange') {
									createValueState(
										device.identifier,
										'tchange',
										'Temp after next change',
										8,
										32,
										'°C'
									);
								} else {
									adapter.log.warn(' new datapoint in API detected -> ' + key + ' ' + value);
								}
							});
						} catch (e) {
							adapter.log.debug(
								' hkr.nextchange problem ' + JSON.stringify(device.hkr.nextchange) + ' ' + e
							);
						}
					} else {
						adapter.log.warn(' new datapoint in API detected -> ' + key + ' ' + value);
					}
				});
			}

			// simpleonoff
			if (device.simpleonoff) {
				adapter.log.info('setting up simpleonoff');
				Object.entries(device.simpleonoff).forEach(([ key, value ]) => {
					if (key === 'state') {
						createSwitch(device.identifier, 'state', 'Simple ON/OFF state and cmd');
					} else {
						adapter.log.warn(' new datapoint in API detected -> ' + key + ' ' + value);
					}
				});
			}
			// levelcontrol
			if (device.levelcontrol) {
				adapter.log.info('setting up levelcontrol');
				Object.entries(device.levelcontrol).forEach(([ key, value ]) => {
					if (key === 'level') {
						createValueCtrl(device.identifier, 'level', 'level 0..255', 0, 255, '', 'value.level');
					} else if (key === 'levelpercentage') {
						createValueCtrl(device.identifier, 'levelpercentage', 'level in %', 0, 100, '%', 'value.level');
					} else {
						adapter.log.warn(' new datapoint in API detected -> ' + key + ' ' + value);
					}
				});
			}
			// colorcontrol
			if (device.colorcontrol) {
				adapter.log.info('setting up thermostat ');
				Object.entries(device.colorcontrol).forEach(([ key, value ]) => {
					if (key === 'supported_modes') {
						createModeState(device.identifier, 'supported_modes', 'available color modes');
					} else if (key === 'current_mode') {
						createModeState(device.identifier, 'current_mode', 'current color mode');
					} else if (key === 'hue') {
						createValueCtrl(device.identifier, 'hue', 'HUE color', 0, 359, '°', 'value.hue');
					} else if (key === 'saturation') {
						createValueCtrl(device.identifier, 'saturation', 'Saturation', 0, 255, '', 'value.saturation');
					} else if (key === 'temperature') {
						createValueCtrl(
							device.identifier,
							'temparature',
							'color temperature',
							2700,
							6500,
							'K',
							'value.temperature'
						);
					} else {
						adapter.log.warn(' new datapoint in API detected -> ' + key + ' ' + value);
					}
				});
			}
		});
	}

	async function createDevices() {
		await fritz
			.getDeviceListInfos()
			.then(async function(devicelistinfos) {
				var devices = parser.xml2json(devicelistinfos);
				devices = [].concat((devices.devicelist || {}).device || []).map(function(device) {
					// remove spaces in AINs
					device.identifier = device.identifier.replace(/\s/g, '');
					return device;
				});
				adapter.log.debug('devices\n');
				adapter.log.debug(JSON.stringify(devices));
				if (devices.length) {
					adapter.log.info('create Devices ' + devices.length);
					try {
						await createData(devices);
					} catch (e) {
						adapter.log.debug(' issue creating devices ' + JSON.stringify(e));
						throw e;
					}
				}
				var groups = parser.xml2json(devicelistinfos);
				groups = [].concat((groups.devicelist || {}).group || []).map(function(group) {
					// remove spaces in AINs
					group.identifier = group.identifier.replace(/\s/g, '');
					return group;
				});
				adapter.log.debug('groups\n');
				adapter.log.debug(JSON.stringify(groups));
				if (groups.length) {
					adapter.log.info('create groups ' + groups.length);
					try {
						await createData(groups);
					} catch (e) {
						adapter.log.debug(' issue creating groups ' + JSON.stringify(e));
						throw e;
					}
				}
			})
			.then(function() {
				pollFritzData();
			})
			.catch(errorHandler);
	}

	async function createTemplates() {
		await fritz
			.getTemplateListInfos()
			.then(async function(templatelistinfos) {
				var typ = '';
				var role = '';
				var templates = parser.xml2json(templatelistinfos);
				templates = [].concat((templates.templatelist || {}).template || []).map(function(template) {
					return template;
				});
				adapter.log.debug('__________________________');
				adapter.log.debug('templates\n');
				adapter.log.debug(JSON.stringify(templates));
				if (templates.length) {
					adapter.log.info('create Templates ' + templates.length);
					createTemplateResponse();
					templates.forEach(async function(template) {
						if (
							(template.functionbitmask & 320) == 320 ||
							(template.functionbitmask & 4160) == 4160 ||
							(template.functionbitmask & 2688) == 2688 ||
							(template.functionbitmask & 2944) == 2944
						) {
							//heating template
							typ = 'template_';
							role = 'switch';
							adapter.log.debug('__________________________');
							adapter.log.info('setting up Template ' + template.name);
							await createTemplate(typ, template.identifier, template.name, role, template.id);
						} else {
							adapter.log.debug(
								'nix vorbereitet für diese Art von Template' +
									template.functionbitmask +
									' -> ' +
									template.name
							);
						}
					});
				}
			})
			.catch(errorHandler);
	}
	function updateDatapoint(key, value, ain) {
		adapter.log.debug('updating data DECT_' + ain + ' : ' + key + ' : ' + value);
		if (key == 'id' || key == 'identifier' || key == 'functionbitmask') {
			// skip it
		} else if (key === 'batterylow') {
			// bool mal anders herum
			let batt = value == 0 ? false : true;
			/*
			if (value == 0) {
				let batt = false;
			} else {
				let batt = true;
			}
			*/
			adapter.setState('DECT_' + ain + '.' + key, {
				val: batt,
				ack: true
			});
		} else if (key == 'celsius' || key == 'offset') {
			//numbers
			adapter.setState('DECT_' + ain + '.' + key, {
				val: parseFloat(value) / 10,
				ack: true
			});
		} else if (key == 'power' || key == 'voltage') {
			adapter.setState('DECT_' + ain + '.power', {
				val: parseFloat(value) / 1000,
				ack: true
			});
		} else if (key == 'komfort' || key == 'absenk' || key == 'tist' || key == 'tchange') {
			adapter.setState('DECT_' + ain + '.' + key, {
				val: parseFloat(value) / 2,
				ack: true
			});
		} else if (key == 'humidity') {
			//e.g humidity
			adapter.setState('DECT_' + ain + '.' + key, {
				val: parseFloat(value),
				ack: true
			});
		} else if (key == 'tsoll') {
			if (tsoll < 57) {
				// die Abfrage auf <57 brauchen wir wahrscheinlich nicht
				adapter.setState('DECT_' + ain + '.tsoll', {
					val: parseFloat(tsoll) / 2,
					ack: true
				});
				adapter.setState('DECT_' + ain + '.lasttarget', {
					val: parseFloat(tsoll) / 2,
					ack: true
				}); // zum Nachführen der Soll-Temperatur wenn außerhalb von iobroker gesetzt
				adapter.setState('DECT_' + ain + '.mode', {
					val: 0,
					ack: true
				});
			} else if (tsoll == 253) {
				adapter.log.debug('DECT_' + ain + ' : ' + 'mode: Closed');
				// adapter.setState('DECT_'+ ain +'.tsoll', {val: 7, ack: true}); // zum setzen der Temperatur außerhalb der Anzeige?
				adapter.setState('DECT_' + ain + '.mode', {
					val: 1,
					ack: true
				});
				currentMode = 'Off';
			} else if (tsoll == 254) {
				adapter.log.debug('DECT_' + ain + ' : ' + 'mode : Opened');
				// adapter.setState('DECT_'+ ain +'.tsoll', {val: 29, ack: true}); // zum setzen der Temperatur außerhalb der Anzeige?
				adapter.setState('DECT_' + ain + '.mode', {
					val: 2,
					ack: true
				});
				currentMode = 'On';
			}
			adapter.setState('DECT_' + ain + '.operationmode', {
				val: currentMode,
				ack: true
			});
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
			key == 'windowactive' ||
			key == 'synchronized'
		) {
			//bool
			let convertValue = value == 1 ? true : false;
			adapter.setState('DECT_' + ain + '.' + key, {
				val: convertValue,
				ack: true
			});
		} else if (
			key == 'lastpressedtimestamp' ||
			key == 'boostactiveendtime' ||
			key == 'windowopenactiveendtime' ||
			key == 'endperiod'
		) {
			//time
			let convTime = new Date(value * 1000);
			adapter.setState('DECT_' + ain + '.' + key, {
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
			key == 'supported_mode' ||
			key == 'current_mode' ||
			key == 'humidity'
		) {
			// integer number
			adapter.setState('DECT_' + ain + '.' + key, {
				val: parseInt(value),
				ack: true
			});
		} else if (
			key == 'fwversion' ||
			key == 'manufacturer' ||
			key == 'name' ||
			key == 'productname' ||
			key == 'mode'
		) {
			// || 'id' , id schon beim initialisieren gesetzt
			// text
			adapter.setState('DECT_' + ain + '.' + key, {
				val: value.toString(),
				ack: true
			});
		} else {
			// unbekannt
			adapter.log.warn(
				'unknown datapoint DECT_' + ain + '.' + key + ' please inform devloper and open issue in github'
			);
		}
	}

	function updateData(array, ident) {
		adapter.log.debug('With ' + ident + ' got the following device/group to parse ' + JSON.stringify(array));
		try {
			Object.entries(array).forEach(([ key, value ]) => {
				if (Array.isArray(value)) {
					adapter.log.debug('processing datapoint ' + key + ' as array');
					value.forEach(function(subarray) {
						subarray.identifier = subarray.identifier.replace(/\s/g, '');
						updateData(subarray, ident + '.' + key + '.' + subarray.identifier.replace(/\s/g, '')); // hier wirds erst schwierig wenn array in array
					});
				} else if (typeof value === 'object' && value !== null) {
					adapter.log.debug('processing datapoint ' + key + ' as object');
					Object.entries(value).forEach(([ key2, value2 ]) => {
						updateDatapoint(key2, value2, ident);
					});
				} else {
					adapter.log.debug('processing datapoint ' + key + ' directly');
					updateDatapoint(key, value, ident);
				}
			});
		} catch (e) {
			adapter.log.debug(' issue in update data ' + JSON.stringify(e));
			throw {
				msg: 'issue updating data',
				function: 'updateData',
				error: e
			};
		}
	}

	async function updateDevices() {
		adapter.log.debug('__________________________');
		adapter.log.debug('updating Devices / Groups ');
		await fritz
			.getDeviceListInfos()
			.then(function(devicelistinfos) {
				var currentMode = null;
				var devices = parser.xml2json(devicelistinfos);
				// devices
				devices = [].concat((devices.devicelist || {}).device || []).map(function(device) {
					// remove spaces in AINs
					device.identifier = device.identifier.replace(/\s/g, '');
					return device;
				});
				adapter.log.debug('devices\n');
				adapter.log.debug(JSON.stringify(devices));
				if (devices.length) {
					adapter.log.debug('update Devices ' + devices.length);
					try {
						for (let i = 0; i < devices.length; i++) {
							adapter.log.debug('_____________________________________________');
							adapter.log.debug('updating Device ' + devices[i].name);
							if (
								devices[i].present === '0' ||
								devices[i].present === 0 ||
								devices[i].present === false
							) {
								adapter.log.debug(
									'DECT_' +
										devices[i].identifier +
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
										adapter.log.debug('id vorher ' + devices[i].id);
										devices[i].id = devices[i].etsiunitinfo.etsideviceid;
										adapter.log.debug('id nachher ' + devices[i].id);
									}
								}
								// some devices deliver the HAN-FUN info separately and the only valuable is the FW version, to be inserted in the main object
								if (devices[i].functionbitmask == 1) {
									adapter.log.debug(' functionbitmask 1');
									// search and find the device id and replace fwversion
									// todo
									// find the device.identifier mit der etsi_id
									// adapter.setState
									// reihenfolge, id immer vorher und dann erst etsi in json?
									continue;
								} else {
									adapter.log.debug(' calling update data .....');
									try {
										updateData(devices[i], devices[i].identifier);
									} catch (e) {
										adapter.log.error(' issue updating device ' + JSON.stringify(e));
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
						adapter.log.error(' issue updating device ' + JSON.stringify(e));
						throw {
							msg: 'issue updating device',
							function: 'updateDevices',
							error: e
						};
					}
				}

				// groups
				var groups = parser.xml2json(devicelistinfos);
				groups = [].concat((groups.devicelist || {}).group || []).map(function(group) {
					// remove spaces in AINs
					group.identifier = group.identifier.replace(/\s/g, '');
					return group;
				});
				adapter.log.debug('groups\n');
				adapter.log.debug(JSON.stringify(groups));
				if (groups.length) {
					adapter.log.debug('update Groups ' + groups.length);
					groups.forEach(function(device) {
						adapter.log.debug('updating Group ' + groups.name);
						if (device.present === '0' || device.present === 0 || device.present === false) {
							adapter.log.debug(
								'DECT_' +
									device.identifier +
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
								adapter.log.debug(' calling update data .....');
								updateData(device, device.identifier);
							} catch (e) {
								adapter.log.error(' issue updating group ' + JSON.stringify(e));
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
			.catch(errorHandler);
	}

	async function pollFritzData() {
		var fritz_interval = parseInt(adapter.config.fritz_interval, 10) || 300;
		await updateDevices(); // für alle Objekte, da in xml/json mehr enthalten als in API-Aufrufe
		adapter.log.debug('polling! fritzdect is alive');
		fritzTimeout = setTimeout(pollFritzData, fritz_interval * 1000);
	}

	await createDevices();
	await createTemplates();
	// await pollFritzData();

	// in this template all states changes inside the adapters namespace are subscribed
	adapter.subscribeStates('*');
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
	module.exports = startAdapter;
} else {
	// or start the instance directly
	startAdapter();
}
