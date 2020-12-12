/*jshint -W097 */ // jshint strict:false
/*jslint node: true */

'use strict';

var Fritz = require('./lib/fritzhttp.js').Fritz,
	parser = require('xml2json-light');
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
772 = SIMPLE_BUTTON 
1024 = SUOTA-Update
*/

/* modes of DECT500 supported/color_mode
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
				var dp = tmp.pop(); //should always be "state"
				var idx = tmp.pop(); //is the name after fritzdect.x.
				if (idx.startsWith('Comet_')) {
					//must be comet
					id = idx.replace(/Comet_/g, ''); //Thermostat
					adapter.log.info('Comet ID: ' + id + ' identified for command (' + dp + ') : ' + state.val);
					if (dp === 'targettemp') {
						if (state.val < 8) {
							//kann gelöscht werden, wenn Temperaturvorwahl nicht zur Moduswahl benutzt werden soll
							adapter.setState('Comet_' + id + '.mode', { val: 1, ack: false });
							fritz
								.setTempTarget(id, 'off')
								.then(function(sid) {
									adapter.log.debug('Switched Mode' + id + ' to closed');
								})
								.catch(errorHandler);
						} else if (state.val > 28) {
							//kann gelöscht werden, wenn Temperaturvorwahl nicht zur Moduswahl benutzt werden soll
							adapter.setState('Comet_' + id + '.mode', { val: 2, ack: false });
							fritz
								.setTempTarget(id, 'on')
								.then(function(sid) {
									adapter.log.debug('Switched Mode' + id + ' to opened permanently');
								})
								.catch(errorHandler);
						} else {
							adapter.setState('Comet_' + id + '.mode', { val: 0, ack: false });
							fritz
								.setTempTarget(id, state.val)
								.then(function(sid) {
									adapter.log.debug('Set target temp ' + id + state.val + ' °C');
									adapter.setState('Comet_' + id + '.lasttarget', { val: state.val, ack: true }); //iobroker Tempwahl wird zum letzten Wert gespeichert
									adapter.setState('Comet_' + id + '.targettemp', { val: state.val, ack: true }); //iobroker Tempwahl wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch(errorHandler);
						}
					} else if (dp === 'mode') {
						if (state.val === 0) {
							adapter.getState('Comet_' + id + '.targettemp', function(err, targettemp) {
								// oder hier die Verwendung von lasttarget
								if (targettemp.val) {
									var setTemp = targettemp.val;
									if (setTemp < 8) {
										adapter.setState('Comet_' + id + '.targettemp', { val: 8, ack: true });
										setTemp = 8;
									} else if (setTemp > 28) {
										adapter.setState('Comet_' + id + '.targettemp', { val: 28, ack: true });
										setTemp = 28;
									}
									fritz
										.setTempTarget(id, setTemp)
										.then(function(sid) {
											adapter.log.debug('Set target temp ' + id + ' ' + setTemp + ' °C');
											adapter.setState('Comet_' + id + '.targettemp', {
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
					if (dp == 'boost') {
						if (
							state.val === 0 ||
							state.val === '0' ||
							state.val === 'false' ||
							state.val === false ||
							state.val === 'off' ||
							state.val === 'OFF'
						) {
							fritz
								.setHkrBoost(id, state.val)
								.then(function(sid) {
									adapter.log.debug('Reset thermostat boost ' + id + ' to ' + state.val);
									adapter.setState('Comet_' + id + '.boost', { val: state.val, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
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
							adapter.getState('Comet_' + id + '.boostactivetime', function(err, minutes) {
								let ende = new Date(date.getTime() + minutes.val * 60000);
								fritz
									.setHkrBoost(id, state.val)
									.then(function(sid) {
										adapter.log.debug(
											'Set thermostat boost ' +
												id +
												' to ' +
												state.val +
												' until ' +
												ende +
												' ' +
												new Date(ende * 1000)
										);
										adapter.setState('Comet_' + id + '.boost', { val: state.val, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
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
					if (dp == 'windowopen') {
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
									adapter.setState('Comet_' + id + '.windowopen', { val: state.val, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
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
							adapter.getState('Comet_' + id + '.windowopenactivetime', function(err, minutes) {
								let ende = new Date(date.getTime() + minutes.val * 60000);
								fritz
									.setWindowOpen(id, ende)
									.then(function(sid) {
										adapter.log.debug(
											'Set thermostat windowopen ' +
												id +
												' to ' +
												state.val +
												' until ' +
												ende +
												' ' +
												new Date(ende * 1000)
										);
										adapter.setState('Comet_' + id + '.windowopen', { val: state.val, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
									})
									.catch(errorHandler);
							});
						}
					}
				} else if (idx.startsWith('Hgroup_')) {
					//must be comet group
					id = idx.replace(/Hgroup_/g, ''); //Thermostat
					adapter.log.info('HGROUP ID: ' + id + ' identified for command (' + dp + ') : ' + state.val);
					if (dp === 'targettemp') {
						if (state.val < 8) {
							//kann gelöscht werden, wenn Temperaturvorwahl nicht zur Moduswahl benutzt werden soll
							adapter.setState('Hgroup_' + id + '.mode', { val: 1, ack: false });
							fritz
								.setTempTarget(id, 'off')
								.then(function(sid) {
									adapter.log.debug('Switched Mode' + id + ' to closed');
								})
								.catch(errorHandler);
						} else if (state.val > 28) {
							//kann gelöscht werden, wenn Temperaturvorwahl nicht zur Moduswahl benutzt werden soll
							adapter.setState('Hgroup_' + id + '.mode', { val: 2, ack: false });
							fritz
								.setTempTarget(id, 'on')
								.then(function(sid) {
									adapter.log.debug('Switched Mode' + id + ' to opened permanently');
								})
								.catch(errorHandler);
						} else {
							adapter.setState('Hgroup_' + id + '.mode', { val: 0, ack: false });
							fritz
								.setTempTarget(id, state.val)
								.then(function(sid) {
									adapter.log.debug('Set Hgroup target temp ' + id + state.val + ' °C');
									adapter.setState('Hgroup_' + id + '.lasttarget', { val: state.val, ack: true }); //iobroker Tempwahl wird zum letzten Wert gespeichert
									adapter.setState('Hgroup_' + id + '.targettemp', { val: state.val, ack: true }); //iobroker Tempwahl wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch(errorHandler);
						}
					} else if (dp === 'mode') {
						if (state.val === 0) {
							adapter.getState('Hgroup_' + id + '.targettemp', function(err, targettemp) {
								// oder hier die Verwendung von lasttarget
								var setTemp = targettemp.val;
								if (setTemp < 8) {
									adapter.setState('Hgroup_' + id + '.targettemp', { val: 8, ack: true });
									setTemp = 8;
								} else if (setTemp > 28) {
									adapter.setState('Hgroup_' + id + '.targettemp', { val: 28, ack: true });
									setTemp = 28;
								}

								fritz
									.setTempTarget(id, setTemp)
									.then(function(sid) {
										adapter.log.debug('Set Hgroup target temp ' + id + ' ' + setTemp + ' °C');
										//hier noch ack=true in state?
									})
									.catch(errorHandler);
							});
						} else if (state.val === 1) {
							fritz
								.setTempTarget(id, 'off')
								.then(function(sid) {
									adapter.log.debug('Switched Hgroup Mode' + id + ' to closed.');
								})
								.catch(errorHandler);
						} else if (state.val === 2) {
							fritz
								.setTempTarget(id, 'on')
								.then(function(sid) {
									adapter.log.debug('Switched Hgroup Mode' + id + ' to opened permanently');
								})
								.catch(errorHandler);
						}
					}
				} else if (idx.startsWith('DECT200_')) {
					//must be DECT
					id = idx.replace(/DECT200_/g, ''); //Switch
					adapter.log.info('SWITCH ID: ' + id + ' identified for command (' + dp + ') : ' + state.val);
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
									adapter.setState('DECT200_' + id + '.state', { val: false, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
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
									adapter.setState('DECT200_' + id + '.state', { val: true, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch(errorHandler);
						}
					}
				} else if (idx.startsWith('Sgroup_')) {
					//must be DECT switch group
					id = idx.replace(/Sgroup_/g, ''); //Switch
					adapter.log.info('GROUP ID: ' + id + ' identified for command (' + dp + ') : ' + state.val);
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
									adapter.log.debug('Turned group ' + id + ' off');
									adapter.setState('Sgroup_' + id + '.state', { val: false, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
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
									adapter.log.debug('Turned group ' + id + ' on');
									adapter.setState('Sgroup_' + id + '.state', { val: true, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch(errorHandler);
						}
					}
				} else if (idx.startsWith('template_')) {
					//must be fritzbox template
					id = idx.replace(/template_/g, ''); //template
					adapter.log.info('Template ID: ' + id + ' identified for command (' + dp + ') : ' + state.val);
					if (dp == 'toggle') {
						/**
                        if (state.val === 0 || state.val === '0' || state.val === 'false' || state.val === false || state.val === 'off' || state.val === 'OFF') {
                            fritz.applyTemplate(id).then(function (sid) {
                                adapter.log.debug('cmd Toggle to template ' + id + ' off');
                            })
                            .catch(errorHandler);
                        }
                        */
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
				} else if (idx.startsWith('DECT500_')) {
					//must be DECT500
					id = idx.replace(/DECT500_/g, ''); //Lamp
					adapter.log.info('LAMP ID: ' + id + ' identified for command (' + dp + ') : ' + state.val);
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
								.setSimpleOff(id)
								.then(function(sid) {
									adapter.log.debug('Turned lamp ' + id + ' off');
									adapter.setState('DECT500_' + id + '.state', { val: false, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
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
								.setSimpleOn(id)
								.then(function(sid) {
									adapter.log.debug('Turned lamp ' + id + ' on');
									adapter.setState('DECT500_' + id + '.state', { val: true, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
								})
								.catch(errorHandler);
						}
					}
					if (dp == 'level') {
						fritz
							.setLevel(id, state.val)
							.then(function(sid) {
								adapter.log.debug('Set lamp level' + id + ' to ' + state.val);
								adapter.setState('DECT500_' + id + '.level', { val: state.val, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
							})
							.catch(errorHandler);
					}
					if (dp == 'levelpercentage') {
						fritz
							.setLevel(id, parseInt(state.val / 100 * 255))
							.then(function(sid) {
								//level is in 0...255
								adapter.log.debug('Set lamp level %' + id + ' to ' + state.val);
								adapter.setState('DECT500_' + id + '.levelpercentage', { val: state.val, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
							})
							.catch(errorHandler);
					}
					if (dp == 'hue') {
						adapter.getState('DECT500_' + id + '.saturation', function(err, saturation) {
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
										adapter.setState('DECT500_' + id + '.hue', { val: state.val, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
									})
									.catch(errorHandler);
							}
						});
					}
					if (dp == 'saturation') {
						adapter.getState('DECT500_' + id + '.hue', function(err, hue) {
							var setHue = hue.val;
							if (setHue == '') {
								adapter.log.error(
									'No hue value exists when setting saturation, please set hue to a value '
								);
							} else {
								fritz
									.setColor(id, typ, state.val, setHue)
									.then(function(sid) {
										adapter.log.debug(
											'Set lamp color saturation ' +
												id +
												' to ' +
												state.val +
												' and hue of ' +
												setHue
										);
										adapter.setState('DECT500_' + id + '.saturation', {
											val: state.val,
											ack: true
										}); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
									})
									.catch(errorHandler);
							}
						});
					}
					if (dp == 'ctemperature') {
						fritz
							.setColorTemperature(id, state.val)
							.then(function(sid) {
								adapter.log.debug('Set lamp color temperature ' + id + ' to ' + state.val);
								adapter.setState('DECT500_' + id + '.ctemperature', { val: state.val, ack: true }); //iobroker State-Bedienung wird nochmal als Status geschrieben, da API-Aufruf erfolgreich
							})
							.catch(errorHandler);
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
							.done(function(devicelistinfos) {
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
							.getBasicDeviceStats(obj.message)
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
							.getColorDefaults(obj.message)
							.then(function(statisticinfos) {
								//obj.message should be ain of device requested
								var devicestats = parser.xml2json(colorinfos);
								result = devicestats;
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

function main() {
	var username = adapter.config.fritz_user;
	var password = adapter.config.fritz_pw;
	var moreParam = adapter.config.fritz_ip;

	var fritz = new Fritz(username, password || '', moreParam || '');

	function createBasic(typ, newId, name, role, id, fw, manuf) {
		adapter.log.debug('create Basic objects ');
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
				role: 'text',
				desc: 'ID'
			},
			native: {}
		});
		adapter.setState(typ + newId + '.id', { val: id, ack: true });
		adapter.setObjectNotExists(typ + newId + '.name', {
			type: 'state',
			common: {
				name: 'Name',
				type: 'string',
				read: true,
				write: false,
				role: 'text',
				desc: 'Name'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.present', {
			type: 'state',
			common: {
				name: 'Device present',
				type: 'boolean',
				read: true,
				write: false,
				role: 'indicator.connected',
				desc: 'Device present'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.fwversion', {
			type: 'state',
			common: {
				name: 'FW version',
				type: 'string',
				read: true,
				write: false,
				role: 'text',
				desc: 'firmware version'
			},
			native: {}
		});
		adapter.setState(typ + newId + '.fwversion', { val: fw, ack: true });
		adapter.setObjectNotExists(typ + newId + '.manufacturer', {
			type: 'state',
			common: {
				name: 'Manufacturer',
				type: 'string',
				read: true,
				write: false,
				role: 'text',
				desc: 'Manufacturer'
			},
			native: {}
		});
		adapter.setState(typ + newId + '.manufacturer', { val: manuf, ack: true });
	}

	function createProductName(typ, newId, prod) {
		adapter.log.debug('create Prodname object');
		adapter.setObjectNotExists(typ + newId + '.prodname', {
			type: 'state',
			common: {
				name: 'Product Name',
				type: 'string',
				read: true,
				write: false,
				role: 'text',
				desc: 'Product Name'
			},
			native: {}
		});
		adapter.setState(typ + newId + '.prodname', { val: prod, ack: true });
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
				role: 'text',
				desc: 'template set'
			},
			native: {}
		});
	}
	function createTemplate(typ, newId, name, role, id) {
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
				role: 'text',
				desc: 'ID'
			},
			native: {}
		});
		adapter.setState(typ + newId + '.id', { val: id, ack: true });
		adapter.setObjectNotExists(typ + newId + '.name', {
			type: 'state',
			common: {
				name: 'Name',
				type: 'string',
				read: true,
				write: false,
				role: 'text',
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
	function createAlert(typ, newId) {
		adapter.log.debug('create Alert object');
		adapter.setObjectNotExists(typ + newId + '.state', {
			type: 'state',
			common: {
				name: 'Contact OFF/ON',
				type: 'boolean',
				read: true,
				write: false,
				role: 'indicator.connected',
				desc: 'Contact OFF/ON'
			},
			native: {}
		});
	}

	function createButton(typ, newId) {
		adapter.log.debug('create Button object');
		adapter.setObjectNotExists(typ + newId + '.lastclick', {
			type: 'state',
			common: {
				name: 'Button Clicktime',
				type: 'number',
				read: true,
				write: false,
				role: 'date',
				desc: 'Button Clicktime'
			},
			native: {}
		});
	}

	function createTemperature(typ, newId) {
		adapter.log.debug('create Temperature object');
		adapter.setObjectNotExists(typ + newId + '.temp', {
			type: 'state',
			common: {
				name: 'actual Temp',
				type: 'number',
				unit: '°C',
				read: true,
				write: false,
				role: 'value.temperature',
				desc: 'actual Temp'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.temp_offset', {
			type: 'state',
			common: {
				name: 'Temp Offset',
				type: 'number',
				unit: '°C',
				read: true,
				write: false,
				role: 'value.temperature',
				desc: 'Temp Offset'
			},
			native: {}
		});
	}
	function createHumidity(typ, newId) {
		adapter.log.debug('create Voltage object');
		adapter.setObjectNotExists(typ + newId + '.humidity', {
			type: 'state',
			common: {
				name: 'Humidity',
				type: 'number',
				unit: '%',
				min: 0,
				max: 100,
				read: true,
				write: false,
				role: 'value.humidity',
				desc: 'Humidity'
			},
			native: {}
		});
	}
	function createSwitch(typ, newId) {
		adapter.log.debug('create Switch objects');
		adapter.setObjectNotExists(typ + newId + '.state', {
			type: 'state',
			common: {
				name: 'Switch on/off',
				type: 'boolean',
				read: true,
				write: true,
				role: 'switch',
				desc: 'Switch on/off'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.mode', {
			type: 'state',
			common: {
				name: 'Switch mode', //auto or man
				type: 'string',
				read: true,
				write: false,
				role: 'text',
				desc: 'Switch mode'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.lock', {
			type: 'state',
			common: {
				name: 'Switch UI/API lock', //switch lock 0=unlocked, 1=locked
				type: 'boolean',
				read: true,
				write: false,
				role: 'indicator'
			},
			native: {}
		});
	}
	function createDeviceLock(typ, newId) {
		adapter.log.debug('create devicelock object');
		adapter.setObjectNotExists(typ + newId + '.devicelock', {
			type: 'state',
			common: {
				name: 'Switch Button lock', //switch lock 0=unlocked, 1=locked
				type: 'boolean',
				read: true,
				write: false,
				role: 'indicator'
			},
			native: {}
		});
	}
	function createTxBusy(typ, newId) {
		adapter.log.debug('create txbusy object');
		adapter.setObjectNotExists(typ + newId + '.txbusy', {
			type: 'state',
			common: {
				name: 'TxBusy', //cmd sending 0=inactive, 1=active
				type: 'boolean',
				read: true,
				write: false,
				role: 'indicator'
			},
			native: {}
		});
	}
	function createEnergy(typ, newId) {
		adapter.log.debug('create Energy objects ');
		adapter.setObjectNotExists(typ + newId + '.power', {
			type: 'state',
			common: {
				name: 'Switch act power',
				type: 'number',
				unit: 'W',
				min: 0,
				max: 4000,
				read: true,
				write: false,
				role: 'value.power',
				desc: 'Switch act power'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.energy', {
			type: 'state',
			common: {
				name: 'Switch total energy',
				type: 'number',
				unit: 'Wh',
				min: 0,
				read: true,
				write: false,
				role: 'value.power.consumption',
				desc: 'Switch total energy'
			},
			native: {}
		});
	}

	function createVoltage(typ, newId) {
		adapter.log.debug('create Voltage object');
		adapter.setObjectNotExists(typ + newId + '.voltage', {
			type: 'state',
			common: {
				name: 'Switch act voltage',
				type: 'number',
				unit: 'V',
				min: 0,
				max: 250,
				read: true,
				write: false,
				role: 'value.voltage',
				desc: 'Switch act voltage'
			},
			native: {}
		});
	}
	function createThermostat(typ, newId) {
		adapter.log.debug('create Thermostat objects');
		adapter.setObjectNotExists(typ + newId + '.mode', {
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
		adapter.setObjectNotExists(typ + newId + '.targettemp', {
			type: 'state',
			common: {
				name: 'Target Temp',
				type: 'number',
				unit: '°C',
				read: true,
				write: true,
				role: 'value.temperature',
				desc: 'Target Temp'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.lasttarget', {
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
		adapter.setObjectNotExists(typ + newId + '.comfytemp', {
			type: 'state',
			common: {
				name: 'Comfort Temp',
				type: 'number',
				unit: '°C',
				read: true,
				write: false,
				role: 'value.temperature',
				desc: 'Comfort Temp'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.nighttemp', {
			type: 'state',
			common: {
				name: 'Night Temp',
				type: 'number',
				unit: '°C',
				read: true,
				write: false,
				role: 'value.temperature',
				desc: 'Night Temp'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.actualtemp', {
			type: 'state',
			common: {
				name: 'Actual Temp',
				type: 'number',
				unit: '°C',
				read: true,
				write: false,
				role: 'value.temperature',
				desc: 'Actual Temp'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.lock', {
			type: 'state',
			common: {
				name: 'Thermostat UI/API lock', //thermostat lock 0=unlocked, 1=locked
				type: 'boolean',
				read: true,
				write: false,
				role: 'indicator'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.devicelock', {
			type: 'state',
			common: {
				name: 'Thermostat Button lock',
				type: 'boolean',
				read: true,
				write: false,
				role: 'indicator'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.batterylow', {
			type: 'state',
			common: {
				name: 'low Battery',
				type: 'boolean',
				read: true,
				write: false,
				role: 'indicator'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.errorcode', {
			type: 'state',
			common: {
				name: 'errorcode',
				type: 'number',
				read: true,
				write: false,
				role: 'indicator'
			},
			native: {}
		});
	}

	function createBattery(typ, newId) {
		adapter.log.debug('create Battery object');
		adapter.setObjectNotExists(typ + newId + '.battery', {
			type: 'state',
			common: {
				name: 'Battery',
				type: 'number',
				unit: '%',
				read: true,
				write: false,
				role: 'value.battery',
				desc: 'Battery'
			},
			native: {}
		});
	}
	function createThermostatProg(typ, newId) {
		adapter.log.debug('create Thermostat Prog objects');
		adapter.setObjectNotExists(typ + newId + '.summeractive', {
			type: 'state',
			common: {
				name: 'Summer active',
				type: 'boolean',
				read: true,
				write: false,
				role: 'indicator',
				desc: 'Summer active'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.holidayactive', {
			type: 'state',
			common: {
				name: 'Holiday active',
				type: 'boolean',
				read: true,
				write: false,
				role: 'indicator',
				desc: 'Holiday active'
			},
			native: {}
		});
	}

	function createThermostatModes(typ, newId) {
		adapter.log.debug('create Thermostat operation mode objects');
		adapter.setObjectNotExists(typ + newId + '.operationList', {
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
		adapter.setObjectNotExists(typ + newId + '.operationMode', {
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

	function createThermostatWindow(typ, newId) {
		adapter.log.debug('create Thermostat Window object');
		adapter.setObjectNotExists(typ + newId + '.windowopenactiv', {
			type: 'state',
			common: {
				name: 'Window open',
				type: 'boolean',
				read: true,
				write: false,
				role: 'indicator',
				desc: 'Window open'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.windowopen', {
			type: 'state',
			common: {
				name: 'window open activation',
				type: 'boolean',
				read: true,
				write: true,
				role: 'switch',
				desc: 'window open activation'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.windowopenactiveendtime', {
			type: 'state',
			common: {
				name: 'window open active end time',
				type: 'string',
				read: true,
				write: false,
				role: 'value.time',
				desc: 'window open active end time'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.windowopenactivetime', {
			type: 'state',
			common: {
				name: 'window open active time for cmd',
				type: 'number',
				read: true,
				write: true,
				unit: 'min',
				role: 'value',
				desc: 'window open active time for cmd'
			},
			native: {}
		});
		adapter.setState(typ + newId + '.windowopenactivetime', { val: 5, ack: true });
	}
	function createThermostatNextChange(typ, newId) {
		adapter.setObjectNotExists(typ + newId + '.nextchangetime', {
			type: 'state',
			common: {
				name: 'next time for Temp change',
				type: 'string',
				read: true,
				write: false,
				role: 'value.time'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.nextchangetemp', {
			type: 'state',
			common: {
				name: 'Temp after next change',
				type: 'number',
				unit: '°C',
				read: true,
				write: false,
				role: 'value.temperature',
				desc: 'Temp after next change'
			},
			native: {}
		});
	}

	function createThermostatBoost(typ, newId) {
		adapter.log.debug('create Thermostat Boost objects');
		adapter.setObjectNotExists(typ + newId + '.boostactive', {
			type: 'state',
			common: {
				name: 'Boost active',
				type: 'boolean',
				read: true,
				write: false,
				role: 'indicator',
				desc: 'Boost active'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.boostactiveendtime', {
			type: 'state',
			common: {
				name: 'Boost active end time',
				type: 'string',
				read: true,
				write: false,
				role: 'value.time',
				desc: 'Boost active end time'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.boost', {
			type: 'state',
			common: {
				name: 'Boost activation',
				type: 'time',
				read: true,
				write: true,
				role: 'switch',
				desc: 'Boost activation'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.boostactivetime', {
			type: 'state',
			common: {
				name: 'boost active time for cmd',
				type: 'number',
				read: true,
				write: true,
				unit: 'min',
				role: 'value',
				desc: 'boost active time for cmd'
			},
			native: {}
		});
		adapter.setState(typ + newId + '.boostactivetime', { val: 5, ack: true });
	}
	function createGroupInfo(typ, newId, mid, member) {
		adapter.log.debug('create Group objects');
		adapter.setObjectNotExists(typ + newId + '.masterdeviceid', {
			type: 'state',
			common: {
				name: 'masterdeviceid',
				type: 'string',
				read: true,
				write: false,
				role: 'text',
				desc: 'masterdeviceid'
			},
			native: {}
		});
		adapter.setState(typ + newId + '.masterdeviceid', { val: mid, ack: true });
		adapter.setObjectNotExists(typ + newId + '.members', {
			type: 'state',
			common: {
				name: 'members',
				type: 'string',
				read: true,
				write: false,
				role: 'text',
				desc: 'members'
			},
			native: {}
		});
		adapter.setState(typ + newId + '.members', { val: member, ack: true });
	}
	function createSimpleOnOff(typ, newId) {
		adapter.log.debug('create SimpleOnOff object');
		adapter.setObjectNotExists(typ + newId + '.state', {
			type: 'state',
			common: {
				name: 'Switch on/off',
				type: 'boolean',
				read: true,
				write: true,
				role: 'switch.power',
				desc: 'Switch on/off'
			},
			native: {}
		});
	}
	function createLevel(typ, newId) {
		adapter.log.debug('create Level object');
		adapter.setObjectNotExists(typ + newId + '.level', {
			type: 'state',
			common: {
				name: 'Level',
				type: 'number',
				min: 0,
				max: 255,
				read: true,
				write: true,
				role: 'level.dimmer',
				desc: 'Level'
			},
			native: {}
		});
		adapter.setState(typ + newId + '.level', { val: 128, ack: true });
		adapter.setObjectNotExists(typ + newId + '.levelpercentage', {
			type: 'state',
			common: {
				name: 'Level percentage',
				type: 'number',
				min: 0,
				max: 100,
				unit: '%',
				read: true,
				write: true,
				role: 'level.dimmer',
				desc: 'Level percentage'
			},
			native: {}
		});
		adapter.setState(typ + newId + '.levelpercentage', { val: 50, ack: true });
	}

	function createLamp(typ, newId) {
		adapter.log.debug('create Lamp object');
		adapter.setObjectNotExists(typ + newId + '.colormodes', {
			type: 'state',
			common: {
				name: 'available color modes',
				type: 'number',
				read: true,
				write: false,
				role: 'value',
				desc: 'available color modes'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.current_mode', {
			type: 'state',
			common: {
				name: 'current color mode',
				type: 'number',
				read: true,
				write: true,
				role: 'value',
				desc: 'current color modes'
			},
			native: {}
		});
		adapter.setObjectNotExists(typ + newId + '.hue', {
			type: 'state',
			common: {
				name: 'Hue',
				type: 'number',
				min: 0,
				max: 359,
				unit: '°',
				read: true,
				write: true,
				role: 'level.color.hue',
				desc: 'hue'
			},
			native: {}
		});
		adapter.setState(typ + newId + '.hue', { val: 90, ack: true });
		adapter.setObjectNotExists(typ + newId + '.saturation', {
			type: 'state',
			common: {
				name: 'Saturation',
				type: 'number',
				min: 0,
				max: 255,
				read: true,
				write: true,
				role: 'level.color.saturation',
				desc: 'Saturation'
			},
			native: {}
		});
		adapter.setState(typ + newId + '.saturation', { val: 50, ack: true });
		adapter.setObjectNotExists(typ + newId + '.ctemperature', {
			type: 'state',
			common: {
				name: 'Color temperature',
				type: 'number',
				min: 2700,
				max: 6500,
				unit: 'K',
				read: true,
				write: true,
				role: 'level.color.temperature',
				desc: 'Color temperature'
			},
			native: {}
		});
		adapter.setState(typ + newId + '.ctemperature', { val: 3600, ack: true });
	}

	function createDevices() {
		fritz
			.getDeviceListInfos()
			.then(function(devicelistinfos) {
				var typ = '';
				var role = '';
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
					devices.forEach(function(device) {
						adapter.log.debug('trying on : ' + JSON.stringify(device));
						if ((device.functionbitmask & 1024) == 1024) {
							//repeater
							typ = 'DECT100_';
							role = 'thermo';
							adapter.log.info('setting up Repeater/DECT100 object ' + device.name);
							createBasic(
								typ,
								device.identifier,
								device.name,
								role,
								device.id,
								device.fwversion,
								device.manufacturer
							);
							createProductName(typ, device.identifier, device.productname);
							if (device.temperature) {
								createTemperature(typ, device.identifier);
							}
							if (device.txbusy) {
								createTxBusy(typ, device.identifier);
							}
						} else if ((device.functionbitmask & 512) == 512) {
							//switch
							typ = 'DECT200_';
							role = 'switch';
							adapter.log.info('setting up Switch/DECT2xx object ' + device.name);
							createBasic(
								typ,
								device.identifier,
								device.name,
								role,
								device.id,
								device.fwversion,
								device.manufacturer
							);
							createProductName(typ, device.identifier, device.productname);
							createSwitch(typ, device.identifier);
							createEnergy(typ, device.identifier);
							if (device.temperature) {
								createTemperature(typ, device.identifier);
							}
							if (device.switch.devicelock) {
								createDeviceLock(typ, device.identifier);
							}
							if (device.powermeter.voltage) {
								createVoltage(typ, device.identifier);
							}
							if (device.txbusy) {
								createTxBusy(typ, device.identifier);
							}
						} else if ((device.functionbitmask & 64) == 64) {
							//thermostat
							typ = 'Comet_';
							role = 'thermo.heat';
							adapter.log.info('setting up Thermostat/DECT3xx object ' + device.name);
							createBasic(
								typ,
								device.identifier,
								device.name,
								role,
								device.id,
								device.fwversion,
								device.manufacturer
							);
							createProductName(typ, device.identifier, device.productname);
							createTemperature(typ, device.identifier);
							createThermostat(typ, device.identifier);
							createBattery(typ, device.identifier); //we create it in all cases, even its not json
							createThermostatModes(typ, device.identifier);

							if (device.hkr.summeractive) {
								createThermostatProg(typ, device.identifier);
							}
							if (device.hkr.windowopenactiv) {
								createThermostatWindow(typ, device.identifier);
							}
							if (device.hkr.boostactive) {
								createThermostatBoost(typ, device.identifier);
							}
							if (device.txbusy) {
								createTxBusy(typ, device.identifier);
							}

							if (device.hkr.nextchange) {
								createThermostatNextChange(typ, device.identifier);
							}
						} else if ((device.functionbitmask & 16) == 16) {
							//contact
							typ = 'Contact_';
							role = 'sensor';
							adapter.log.info('setting up Alert/Sensor object ' + device.name);
							createBasic(
								typ,
								device.identifier,
								device.name,
								role,
								device.id,
								device.fwversion,
								device.manufacturer
							);
							createProductName(typ, device.identifier, device.productname);
							createAlert(typ, device.identifier);
						} else if ((device.functionbitmask & 8) == 8) {
							//button
							typ = 'Button_';
							role = 'sensor';
							adapter.log.info('setting up Button object ' + device.name);
							createBasic(
								typ,
								device.identifier,
								device.name,
								role,
								device.id,
								device.fwversion,
								device.manufacturer
							);
							createProductName(typ, device.identifier, device.productname);
							createButton(typ, device.identifier);
						} else if ((device.functionbitmask & 32) == 32) {
							//buttons from fritzdect 400
							typ = 'Button_';
							role = 'sensor';
							device.button.forEach(function(button) {
								createBasic(
									typ,
									button.identifier.replace(/\s/g, ''),
									button.name,
									role,
									button.id,
									device.fwversion,
									device.manufacturer
								);
								adapter.log.info('setting up FD400 Button object ' + button.name);
								createProductName(typ, button.identifier.replace(/\s/g, ''), device.productname);
								createButton(typ, button.identifier);
							});
						} else if ((device.functionbitmask & 237572) == 237572) {
							//lamp
							typ = 'DECT500_';
							role = 'lamp';
							adapter.log.info('setting up DECT500 object ' + device.name);
							createBasic(
								typ,
								device.identifier,
								device.name,
								role,
								device.etsiunitinfo.etsideviceid,
								device.fwversion,
								device.manufacturer
							);
							//new api createBasic(typ,device.identifier,device.name,role,device.id,device.fwversion,device.manufacturer);
							createProductName(typ, device.identifier, device.productname);

							//evtl. hier in Abhängigkeit des modes eine Unterscheidung für weiß und color machen und somit createWhitelamp createColorLamp oder in in createLampe mit Übergabe supported_modes
							createSimpleOnOff(typ, device.identifier);
							createLevel(typ, device.identifier);
							createLamp(typ, device.identifier);
							if (device.txbusy) {
								createTxBusy(typ, device.identifier);
							}
						} else if (device.functionbitmask == 288) {
							//DECT440 Anzeige Tasten sind schon über 32 erkannt
							typ = 'DECT440_';
							role = 'thermo';
							adapter.log.info('setting up DECT440 object ' + device.name);
							createBasic(
								typ,
								device.identifier,
								device.name,
								role,
								device.id,
								device.fwversion,
								device.manufacturer
							);
							createProductName(typ, device.identifier, device.productname);

							//evtl. hier in Abhängigkeit des modes eine Unterscheidung für weiß und color machen und somit createWhitelamp createColorLamp oder in in createLampe mit Übergabe supported_modes
							createTemperature(typ, device.identifier);
							createBattery(typ, device.identifier);
							if (device.txbusy) {
								createTxBusy(typ, device.identifier);
							}
						} else if (device.functionbitmask == 1048864) {
							//DECT440 Anzeige Tasten sind schon über 32 erkannt
							typ = 'DECT440_';
							role = 'thermo';
							adapter.log.info('setting up DECT440 object ' + device.name);
							createBasic(
								typ,
								device.identifier,
								device.name,
								role,
								device.id,
								device.fwversion,
								device.manufacturer
							);
							createProductName(typ, device.identifier, device.productname);

							//evtl. hier in Abhängigkeit des modes eine Unterscheidung für weiß und color machen und somit createWhitelamp createColorLamp oder in in createLampe mit Übergabe supported_modes
							createTemperature(typ, device.identifier);
							createHumidity(typ, device.identifier);
							createBattery(typ, device.identifier);
							if (device.txbusy) {
								createTxBusy(typ, device.identifier);
							}
						} else {
							/* nicht sinnvoll nur den übergeordneten Datenpunkt anzulegen
                    besser die hier übermittelte FW Version an das eigentliche Objekt übergeben, ansonsten scheinen die anderen Informationen gedoppelt zu sein.
                    else if((device.functionbitmask & 1) == 1){ //HAN-FUN
                        search(etsideviceid, replaceFW(device.fwversion))
                        adapter.log.info('merging HAN-FUN object to '+ device.name);                    
                    }
                    */
							adapter.log.debug(
								'nix vorbereitet für diese Art von Gerät ' +
									device.functionbitmask +
									' -> ' +
									device.name
							);
						}
					});
				}
			})
			.catch(errorHandler);
	}

	function createGroups() {
		fritz
			.getDeviceListInfos()
			.then(function(devicelistinfos) {
				var typ = '';
				var role = '';
				var groups = parser.xml2json(devicelistinfos);
				groups = [].concat((groups.devicelist || {}).group || []).map(function(group) {
					// remove spaces in AINs
					group.identifier = group.identifier.replace(/\s/g, '');
					return group;
				});
				adapter.log.debug('groups\n');
				adapter.log.debug(JSON.stringify(groups));
				if (groups.length) {
					adapter.log.info('create Groups ' + groups.length);
					groups.forEach(function(group) {
						if ((group.functionbitmask & 512) == 512) {
							//sgroup
							typ = 'Sgroup_';
							role = 'switch';
							adapter.log.info('setting up Switch Group ' + group.name);
							createBasic(
								typ,
								group.identifier,
								group.name,
								role,
								group.id,
								group.fwversion,
								group.manufacturer
							);
							createSwitch(typ, group.identifier);
							createEnergy(typ, group.identifier);
							createGroupInfo(
								typ,
								group.identifier,
								group.groupinfo.masterdeviceid,
								group.groupinfo.members
							);
							if (group.txbusy) {
								createTxBusy(typ, group.identifier);
							}
						} else if ((group.functionbitmask & 64) == 64) {
							//hgroup
							typ = 'Hgroup_';
							role = 'thermo.heat';
							adapter.log.info('setting up Heater Group ' + group.name);
							createBasic(
								typ,
								group.identifier,
								group.name,
								role,
								group.id,
								group.fwversion,
								group.manufacturer
							);
							createThermostat(typ, group.identifier);
							createThermostatModes(typ, group.identifier);
							if (group.hkr.summeractive) {
								createThermostatProg(typ, group.identifier);
							}
							if (group.txbusy) {
								createTxBusy(typ, group.identifier);
							}
							createGroupInfo(
								typ,
								group.identifier,
								group.groupinfo.masterdeviceid,
								group.groupinfo.members
							);
						} else {
							adapter.log.debug('nix vorbereitet für diese Art von Gruppe ' + group.functionbitmask);
						}
					});
				}
			})
			.catch(errorHandler);
	}

	function createTemplates() {
		fritz
			.getTemplateListInfos()
			.then(function(templatelistinfos) {
				var typ = '';
				var role = '';
				var templates = parser.xml2json(templatelistinfos);
				templates = [].concat((templates.templatelist || {}).template || []).map(function(template) {
					return template;
				});
				adapter.log.debug('templates\n');
				adapter.log.debug(JSON.stringify(templates));
				if (templates.length) {
					adapter.log.info('create Templates ' + templates.length);
					createTemplateResponse();
					templates.forEach(function(template) {
						if (
							(template.functionbitmask & 320) == 320 ||
							(template.functionbitmask & 4160) == 4160 ||
							(template.functionbitmask & 2688) == 2688 ||
							(template.functionbitmask & 2944) == 2944
						) {
							//heating template
							typ = 'template_';
							role = 'switch';
							adapter.log.info('setting up Template ' + template.name);
							createTemplate(typ, template.identifier, template.name, role, template.id);
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

	function updateDevices() {
		fritz
			.getDeviceListInfos()
			.then(function(devicelistinfos) {
				var devices = parser.xml2json(devicelistinfos);
				devices = [].concat((devices.devicelist || {}).device || []).map(function(device) {
					// remove spaces in AINs
					device.identifier = device.identifier.replace(/\s/g, '');
					return device;
				});
				adapter.log.debug('devices\n');
				adapter.log.debug(JSON.stringify(devices));
				if (devices.length) {
					adapter.log.debug('update Devices ' + devices.length);
					devices.forEach(function(device) {
						if ((device.functionbitmask & 1024) == 1024) {
							//Repeater
							adapter.log.debug('updating Repeater ' + device.name);
							adapter.log.debug(
								'DECT100_' + device.identifier.replace(/\s/g, '') + ' : ' + 'name : ' + device.name
							);
							adapter.setState('DECT100_' + device.identifier.replace(/\s/g, '') + '.name', {
								val: device.name,
								ack: true
							});

							let convertPresent = device.present == 1 ? true : false;
							adapter.log.debug(
								'DECT100_' +
									device.identifier.replace(/\s/g, '') +
									' : ' +
									'present : ' +
									convertPresent +
									' (' +
									device.present +
									')'
							);
							adapter.setState('DECT100_' + device.identifier.replace(/\s/g, '') + '.present', {
								val: convertPresent,
								ack: true
							});

							if (device.present === '0' || device.present === 0 || device.present === false) {
								adapter.log.warn(
									'DECT100_' +
										device.identifier.replace(/\s/g, '') +
										' is not present, check the device connection, no values are written'
								);
							} else {
								if (device.temperature) {
									adapter.log.debug(
										'DECT100_' +
											device.identifier.replace(/\s/g, '') +
											' : ' +
											'temp : ' +
											parseFloat(device.temperature.celsius) / 10
									);
									adapter.setState('DECT100_' + device.identifier.replace(/\s/g, '') + '.temp', {
										val: parseFloat(device.temperature.celsius) / 10,
										ack: true
									});
									adapter.log.debug(
										'DECT100_' +
											device.identifier.replace(/\s/g, '') +
											' : ' +
											'temp offset : ' +
											parseFloat(device.temperature.offset) / 10
									);
									adapter.setState(
										'DECT100_' + device.identifier.replace(/\s/g, '') + '.temp_offset',
										{ val: parseFloat(device.temperature.offset) / 10, ack: true }
									);
								}
							}
						} else if ((device.functionbitmask & 16) == 16) {
							//contact
							adapter.log.debug('updating Sensor ' + device.name);
							adapter.log.debug('Contact_' + device.identifier + ' : ' + 'name : ' + device.name);
							adapter.setState('Contact_' + device.identifier + '.name', { val: device.name, ack: true });

							let convertPresent = device.present == 1 ? true : false;
							adapter.log.debug(
								'Contact_' +
									device.identifier +
									' : ' +
									'present : ' +
									convertPresent +
									' (' +
									device.present +
									')'
							);
							adapter.setState('Contact_' + device.identifier + '.present', {
								val: convertPresent,
								ack: true
							});

							if (device.present === '0' || device.present === 0 || device.present === false) {
								adapter.log.warn(
									'Contact_' +
										device.identifier +
										' is not present, check the device connection, no values are written'
								);
							} else {
								let convertAlertState = device.alert.state == 1 ? true : false;
								adapter.log.debug(
									'Contact_' +
										device.identifier +
										' : ' +
										'state : ' +
										convertAlertState +
										'(' +
										device.alert.state +
										')'
								);
								adapter.setState('Contact_' + device.identifier + '.state', {
									val: convertAlertState,
									ack: true
								});
							}
						} else if ((device.functionbitmask & 8) == 8) {
							//button
							adapter.log.debug('updating Button ' + device.name);
							adapter.log.debug('Button_' + device.identifier + ' : ' + 'name : ' + device.name);
							adapter.setState('Button_' + device.identifier + '.name', { val: device.name, ack: true });

							let convertPresent = device.present == 1 ? true : false;
							adapter.log.debug(
								'Button_' +
									device.identifier +
									' : ' +
									'present : ' +
									convertPresent +
									' (' +
									device.present +
									')'
							);
							adapter.setState('Button_' + device.identifier + '.present', {
								val: convertPresent,
								ack: true
							});

							if (device.present === '0' || device.present === 0 || device.present === false) {
								adapter.log.warn(
									'Button_' +
										device.identifier +
										' is not present, check the device connection, no values are written'
								);
							} else {
								let lastclick = new Date(device.button.lastpressedtimestamp * 1000);
								adapter.log.debug(
									'Button_' +
										device.identifier +
										' : ' +
										'lastclick: ' +
										lastclick +
										' (' +
										device.button.lastpressedtimestamp +
										')'
								);
								adapter.setState('Button_' + device.identifier + '.lastclick', {
									val: lastclick,
									ack: true
								});
							}
						} else if ((device.functionbitmask & 32) == 32) {
							//button FD400
							device.button.forEach(function(button) {
								adapter.log.debug('updating Button ' + button.name);
								adapter.log.debug('Button_' + button.identifier + ' : ' + 'name : ' + button.name);
								adapter.setState('Button_' + button.identifier + '.name', {
									val: button.name,
									ack: true
								});

								let convertPresent = device.present == 1 ? true : false;
								adapter.log.debug(
									'Button_' +
										button.identifier +
										' : ' +
										'present : ' +
										convertPresent +
										' (' +
										device.present +
										')'
								);
								adapter.setState('Button_' + button.identifier + '.present', {
									val: convertPresent,
									ack: true
								});

								if (device.present === '0' || device.present === 0 || device.present === false) {
									adapter.log.warn(
										'Button_' +
											device.identifier +
											' is not present, check the device connection, no values are written'
									);
								} else {
									let lastclick = new Date(button.lastpressedtimestamp * 1000);
									adapter.log.debug(
										'Button_' +
											button.identifier +
											' : ' +
											'lastclick: ' +
											lastclick +
											' (' +
											button.lastpressedtimestamp +
											')'
									);
									adapter.setState('Button_' + button.identifier + '.lastclick', {
										val: lastclick,
										ack: true
									});
								}
							});
						} else if ((device.functionbitmask & 512) == 512) {
							//switch
							adapter.log.debug('updating Switch ' + device.name);
							adapter.log.debug('DECT200_' + device.identifier + ' : ' + 'name : ' + device.name);
							adapter.setState('DECT200_' + device.identifier + '.name', { val: device.name, ack: true });

							let convertPresent = device.present == 1 ? true : false;
							adapter.log.debug(
								'DECT200_' +
									device.identifier +
									' : ' +
									'present : ' +
									convertPresent +
									' (' +
									device.present +
									')'
							);
							adapter.setState('DECT200_' + device.identifier + '.present', {
								val: convertPresent,
								ack: true
							});

							if (device.present === '0' || device.present === 0 || device.present === false) {
								adapter.log.warn(
									'DECT200_' +
										device.identifier +
										' is not present, check the device connection, no values are written'
								);
							} else {
								let convertSwitchState = device.switch.state == 1 ? true : false;
								adapter.log.debug(
									'DECT200_' +
										device.identifier +
										' : ' +
										'state :' +
										convertSwitchState +
										'(' +
										device.switch.state +
										')'
								);
								adapter.setState('DECT200_' + device.identifier + '.state', {
									val: convertSwitchState,
									ack: true
								});

								adapter.log.debug(
									'DECT200_' +
										device.identifier +
										' : ' +
										'power :' +
										parseFloat(device.powermeter.power) / 1000
								);
								adapter.setState('DECT200_' + device.identifier + '.power', {
									val: parseFloat(device.powermeter.power) / 1000,
									ack: true
								});

								adapter.log.debug(
									'DECT200_' + device.identifier + ' : ' + 'energy :' + device.powermeter.energy
								);
								adapter.setState('DECT200_' + device.identifier + '.energy', {
									val: device.powermeter.energy,
									ack: true
								});

								adapter.log.debug(
									'DECT200_' + device.identifier + ' : ' + 'mode : ' + device.switch.mode
								);
								adapter.setState('DECT200_' + device.identifier + '.mode', {
									val: device.switch.mode,
									ack: true
								});

								let convertLock = device.switch.lock == 1 ? true : false;
								adapter.log.debug(
									'DECT200_' +
										device.identifier +
										' : ' +
										'lock : ' +
										convertLock +
										' (' +
										device.switch.lock +
										')'
								);
								adapter.setState('DECT200_' + device.identifier + '.lock', {
									val: convertLock,
									ack: true
								});

								let convertDeviceLock = device.switch.devicelock == 1 ? true : false;
								adapter.log.debug(
									'DECT200_' +
										device.identifier +
										' : ' +
										'devicelock : ' +
										convertDeviceLock +
										' (' +
										device.switch.devicelock +
										')'
								);
								adapter.setState('DECT200_' + device.identifier + '.devicelock', {
									val: convertDeviceLock,
									ack: true
								});

								if (device.temperature) {
									adapter.log.debug(
										'DECT200_' +
											device.identifier +
											' : ' +
											'temp : ' +
											parseFloat(device.temperature.celsius) / 10
									);
									adapter.setState('DECT200_' + device.identifier + '.temp', {
										val: parseFloat(device.temperature.celsius) / 10,
										ack: true
									});

									adapter.log.debug(
										'DECT200_' +
											device.identifier +
											' : ' +
											'temp offset: ' +
											parseFloat(device.temperature.offset) / 10
									);
									adapter.setState('DECT200_' + device.identifier + '.temp_offset', {
										val: parseFloat(device.temperature.offset) / 10,
										ack: true
									});
								}

								if (device.powermeter.voltage) {
									//if( adapter.config.dect200volt_en === 'true' || adapter.config.dect200volt_en  === true || adapter.config.dect200volt_en  === 1 ) {
									adapter.log.debug(
										'DECT200_' +
											device.identifier +
											' : ' +
											'voltage : ' +
											device.powermeter.voltage / 1000
									);
									adapter.setState('DECT200_' + device.identifier + '.voltage', {
										val: device.powermeter.voltage / 1000,
										ack: true
									});
								}
								if (device.txbusy) {
									let convertTxBUSY = device.txbusy == 1 ? true : false;
									adapter.log.debug(
										'DECT200_' +
											device.identifier +
											' : ' +
											'txbusy : ' +
											convertTxBUSY +
											' (' +
											device.txbusy +
											')'
									);
									adapter.setState('DECT200_' + device.identifier + '.txbusy', {
										val: convertTxBUSY,
										ack: true
									});
								}
							}
						} else if ((device.functionbitmask & 64) == 64) {
							//thermostat
							adapter.log.debug('updating Thermostat ' + device.name);
							adapter.log.debug(
								'Comet_' + device.identifier.replace(/\s/g, '') + ' : ' + 'name : ' + device.name
							);
							adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.name', {
								val: device.name,
								ack: true
							});

							let currentMode = 'On';
							adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.operationList', {
								val: `On, Off, Holiday, Summer, Comfort, Night`,
								ack: true
							});

							let convertPresent = device.present == 1 ? true : false;
							adapter.log.debug(
								'Comet_' +
									device.identifier.replace(/\s/g, '') +
									' : ' +
									'present : ' +
									convertPresent +
									' (' +
									device.present +
									')'
							);
							adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.present', {
								val: convertPresent,
								ack: true
							});

							if (device.present === '0' || device.present === 0 || device.present === false) {
								adapter.log.warn(
									'Comet_' +
										device.identifier +
										' is not present, check the device connection, no values are written'
								);
							} else {
								adapter.log.debug(
									'Comet_' +
										device.identifier.replace(/\s/g, '') +
										': ' +
										'temp :' +
										parseFloat(device.temperature.celsius) / 10
								);
								adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.temp', {
									val: parseFloat(device.temperature.celsius) / 10,
									ack: true
								});
								adapter.log.debug(
									'Comet_' +
										device.identifier.replace(/\s/g, '') +
										': ' +
										'temp offset :' +
										parseFloat(device.temperature.offset) / 10
								);
								adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.temp_offset', {
									val: parseFloat(device.temperature.offset) / 10,
									ack: true
								});

								var targettemp = device.hkr.tsoll;
								if (targettemp < 57) {
									// die Abfrage auf <57 brauchen wir wahrscheinlich nicht
									adapter.log.debug(
										'Comet_' +
											device.identifier.replace(/\s/g, '') +
											' : ' +
											'targettemp :' +
											targettemp
									);
									adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.targettemp', {
										val: parseFloat(targettemp) / 2,
										ack: true
									});
									adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.lasttarget', {
										val: parseFloat(targettemp) / 2,
										ack: true
									}); // zum Nachführen der Soll-Temperatur wenn außerhalb von iobroker gesetzt
									adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.mode', {
										val: 0,
										ack: true
									});
								} else if (targettemp == 253) {
									adapter.log.debug(
										'Comet_' + device.identifier.replace(/\s/g, '') + ' : ' + 'mode: Closed'
									);
									// adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.targettemp', {val: 7, ack: true}); // zum setzen der Temperatur außerhalb der Anzeige?
									adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.mode', {
										val: 1,
										ack: true
									});
									currentMode = 'Off';
								} else if (targettemp == 254) {
									adapter.log.debug(
										'Comet_' + device.identifier.replace(/\s/g, '') + ' : ' + 'mode : Opened'
									);
									// adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.targettemp', {val: 29, ack: true}); // zum setzen der Temperatur außerhalb der Anzeige?
									adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.mode', {
										val: 2,
										ack: true
									});
									currentMode = 'On';
								}

								adapter.log.debug(
									'Comet_' +
										device.identifier.replace(/\s/g, '') +
										' : ' +
										'comfytemp :' +
										device.hkr.komfort
								);
								adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.comfytemp', {
									val: parseFloat(device.hkr.komfort) / 2,
									ack: true
								});

								if (targettemp === device.hkr.komfort) {
									currentMode = 'Comfort';
								}

								adapter.log.debug(
									'Comet_' +
										device.identifier.replace(/\s/g, '') +
										' : ' +
										'nighttemp :' +
										device.hkr.absenk
								);
								adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.nighttemp', {
									val: parseFloat(device.hkr.absenk) / 2,
									ack: true
								});

								if (targettemp === device.hkr.absenk) {
									currentMode = 'Night';
								}

								adapter.log.debug(
									'Comet_' +
										device.identifier.replace(/\s/g, '') +
										' : ' +
										'actualtemp :' +
										device.hkr.tist
								);
								adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.actualtemp', {
									val: parseFloat(device.hkr.tist) / 2,
									ack: true
								});

								var batt;
								if (device.hkr.batterylow == 0) {
									batt = false;
								} else {
									batt = true;
								}
								adapter.log.debug(
									'Comet_' + device.identifier.replace(/\s/g, '') + ' : ' + 'batterylow :' + batt
								);
								adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.batterylow', {
									val: batt,
									ack: true
								});

								adapter.log.debug(
									'Comet_' +
										device.identifier.replace(/\s/g, '') +
										' : ' +
										'errorcode :' +
										parseInt(device.hkr.errorcode)
								);
								adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.errorcode', {
									val: parseInt(device.hkr.errorcode),
									ack: true
								});

								let convertLock = device.hkr.lock == 1 ? true : false;
								adapter.log.debug(
									'Comet_' +
										device.identifier.replace(/\s/g, '') +
										' : ' +
										'lock :' +
										convertLock +
										' (' +
										device.hkr.lock +
										')'
								);
								adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.lock', {
									val: convertLock,
									ack: true
								});

								let convertDeviceLock = device.hkr.devicelock == 1 ? true : false;
								adapter.log.debug(
									'Comet_' +
										device.identifier.replace(/\s/g, '') +
										' : ' +
										'devicelock :' +
										convertDeviceLock +
										' (' +
										device.hkr.devicelock +
										')'
								);
								adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.devicelock', {
									val: convertDeviceLock,
									ack: true
								});

								if (device.hkr.battery) {
									adapter.log.debug(
										'Comet_' +
											device.identifier.replace(/\s/g, '') +
											' : ' +
											'battery :' +
											device.hkr.battery
									);
									adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.battery', {
										val: parseInt(device.hkr.battery),
										ack: true
									});
								}

								if (device.hkr.summeractive) {
									let convertValue = device.hkr.summeractive == 1 ? true : false;

									adapter.log.debug(
										'Comet_' +
											device.identifier.replace(/\s/g, '') +
											' : ' +
											'summeractive : ' +
											convertValue +
											' (' +
											device.hkr.summeractive +
											')'
									);
									adapter.setState(
										'Comet_' + device.identifier.replace(/\s/g, '') + '.summeractive',
										{ val: convertValue, ack: true }
									);

									if (convertValue) {
										currentMode = 'Summer';
									}
								}
								if (device.hkr.holidayactive) {
									let convertValue = device.hkr.holidayactive == 1 ? true : false;

									adapter.log.debug(
										'Comet_' +
											device.identifier.replace(/\s/g, '') +
											' : ' +
											'holidayactive : ' +
											convertValue +
											' (' +
											device.hkr.holidayactive +
											')'
									);
									adapter.setState(
										'Comet_' + device.identifier.replace(/\s/g, '') + '.holidayactive',
										{ val: convertValue, ack: true }
									);

									if (convertValue) {
										currentMode = 'Holiday';
									}
								}
								if (device.hkr.windowopenactiv) {
									let convertValue = device.hkr.windowopenactiv == 1 ? true : false;

									adapter.log.debug(
										'Comet_' +
											device.identifier.replace(/\s/g, '') +
											' : ' +
											'windowopenactiv :' +
											convertValue +
											' (' +
											device.hkr.windowopenactiv +
											')'
									);
									adapter.setState(
										'Comet_' + device.identifier.replace(/\s/g, '') + '.windowopenactiv',
										{ val: convertValue, ack: true }
									);
								}

								if (device.hkr.windowopenactiveendtime) {
									let endtime = new Date(device.hkr.windowopenactiveendtime * 1000);

									adapter.log.debug(
										'Comet_' +
											device.identifier.replace(/\s/g, '') +
											' : ' +
											'windowopenactiveendtime :' +
											endtime +
											' (' +
											device.hkr.windowopenactiveendtime +
											')'
									);
									adapter.setState(
										'Comet_' + device.identifier.replace(/\s/g, '') + '.windowopenactiveendtime',
										{ val: endtime, ack: true }
									);
								}
								if (device.hkr.boostactiveendtime) {
									let endtime = new Date(device.hkr.boostactiveendtime * 1000);

									adapter.log.debug(
										'Comet_' +
											device.identifier.replace(/\s/g, '') +
											' : ' +
											'boostactiveendtime :' +
											endtime +
											' (' +
											device.hkr.boostactiveendtime +
											')'
									);
									adapter.setState(
										'Comet_' + device.identifier.replace(/\s/g, '') + '.boostactiveendtime',
										{ val: endtime, ack: true }
									);

									//wenn boostactiveendtime, dann gibt es auch boostactiv
									let convertBoostACTIV = device.hkr.boostactive == 1 ? true : false;
									adapter.log.debug(
										'Comet_' +
											device.identifier.replace(/\s/g, '') +
											' : ' +
											'boostactive :' +
											convertBoostACTIV +
											' (' +
											device.hkr.boostactive +
											')'
									);
									adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.boostactive', {
										val: convertBoostACTIV,
										ack: true
									});
								}
								if (device.txbusy) {
									let convertTxBUSY = device.txbusy == 1 ? true : false;
									adapter.log.debug(
										'Comet_' +
											device.identifier +
											' : ' +
											'txbusy : ' +
											convertTxBUSY +
											' (' +
											device.txbusy +
											')'
									);
									adapter.setState('DECT200_' + device.identifier + '.txbusy', {
										val: convertTxBUSY,
										ack: true
									});
								}

								if (device.hkr.nextchange) {
									var changetemp = device.hkr.nextchange.tchange;
									adapter.log.debug(
										'Comet_' +
											device.identifier.replace(/\s/g, '') +
											' : ' +
											'nextchangetemp :' +
											changetemp
									);
									adapter.setState(
										'Comet_' + device.identifier.replace(/\s/g, '') + '.nextchangetemp',
										{ val: parseFloat(changetemp) / 2, ack: true }
									);
									let changetime = new Date(device.hkr.nextchange.endperiod * 1000);
									adapter.log.debug(
										'Comet_' +
											device.identifier.replace(/\s/g, '') +
											' : ' +
											'nextchangetime :' +
											changetime
									);
									adapter.setState(
										'Comet_' + device.identifier.replace(/\s/g, '') + '.nextchangetime',
										{ val: changetime, ack: true }
									);
								}

								adapter.setState('Comet_' + device.identifier.replace(/\s/g, '') + '.operationMode', {
									val: currentMode,
									ack: true
								});
							}
						} else if ((device.functionbitmask & 237572) == 237572) {
							//lamp
							adapter.log.debug('updating Lamp ' + device.name);
							adapter.log.debug('DECT500_' + device.identifier + ' : ' + 'name : ' + device.name);
							adapter.setState('DECT500_' + device.identifier + '.name', { val: device.name, ack: true });
							//da TxBusy mit der API zeitgleich mit DECT500 herauskam, sparen wir die Abfrage ob vorhanden
							let convertTxBusy = device.txbusy == 1 ? true : false;
							adapter.log.debug(
								'DECT500_' +
									device.identifier +
									' : ' +
									'txbusy : ' +
									convertTxBusy +
									'(' +
									device.txbusy +
									')'
							);
							adapter.setState('DECT500_' + device.identifier + '.txbusy', {
								val: convertTxBusy,
								ack: true
							});

							let convertPresent = device.present == 1 ? true : false;
							adapter.log.debug(
								'DECT500_' +
									device.identifier +
									' : ' +
									'present : ' +
									convertPresent +
									' (' +
									device.present +
									')'
							);
							adapter.setState('DECT500_' + device.identifier + '.present', {
								val: convertPresent,
								ack: true
							});

							if (device.present === '0' || device.present === 0 || device.present === false) {
								adapter.log.warn(
									'DECT500_' +
										device.identifier +
										' is not present, check the device connection, no values are written'
								);
							} else {
								let convertSimpleOnOff = device.simpleonoff.state == 1 ? true : false;
								adapter.log.debug(
									'DECT500_' +
										device.identifier +
										' : ' +
										'state: ' +
										convertSimpleOnOff +
										'(' +
										device.simpleonoff.state +
										')'
								);
								adapter.setState('DECT500_' + device.identifier + '.state', {
									val: convertSimpleOnOff,
									ack: true
								});
								adapter.log.debug(
									'DECT500_' + device.identifier + ' : ' + 'level: ' + device.levelcontrol.level
								);
								adapter.setState('DECT500_' + device.identifier + '.level', {
									val: parseInt(device.levelcontrol.level),
									ack: true
								});
								adapter.log.debug(
									'DECT500_' +
										device.identifier +
										' : ' +
										'levelpercentage: ' +
										device.levelcontrol.levelpercentage
								);
								adapter.setState('DECT500_' + device.identifier + '.levelpercentage', {
									val: parseInt(device.levelcontrol.levelpercentage),
									ack: true
								});
								adapter.log.debug(
									'DECT500_' +
										device.identifier +
										' : ' +
										'colormodes: ' +
										device.colorcontrol.supported_modes
								);
								adapter.setState('DECT500_' + device.identifier + '.colormodes', {
									val: device.colorcontrol.supported_modes,
									ack: true
								});
								adapter.log.debug(
									'DECT500_' +
										device.identifier +
										' : ' +
										'current_mode: ' +
										device.colorcontrol.current_mode
								);
								adapter.setState('DECT500_' + device.identifier + '.current_mode', {
									val: device.colorcontrol.current_mode,
									ack: true
								});
								//evtl. hier in Abhängigkeit des modes eine Unterscheidung für weiß und color update machen
								adapter.log.debug(
									'DECT500_' + device.identifier + ' : ' + 'hue: ' + device.colorcontrol.hue
								);
								adapter.setState('DECT500_' + device.identifier + '.hue', {
									val: parseInt(device.colorcontrol.hue),
									ack: true
								});
								adapter.log.debug(
									'DECT500_' +
										device.identifier +
										' : ' +
										'saturation: ' +
										device.colorcontrol.saturation
								);
								adapter.setState('DECT500_' + device.identifier + '.saturation', {
									val: parseInt(device.colorcontrol.saturation),
									ack: true
								});
								adapter.log.debug(
									'DECT500_' +
										device.identifier +
										' : ' +
										'temperature: ' +
										device.colorcontrol.temperature
								);
								adapter.setState('DECT500_' + device.identifier + '.ctemperature', {
									val: parseInt(device.colorcontrol.temperature),
									ack: true
								});
							}
						} else if ((device.functionbitmask & 288) == 288) {
							//DECT440
							adapter.log.debug('updating DECT440 ' + device.name);
							adapter.log.debug('DECT440_' + device.identifier + ' : ' + 'name : ' + device.name);
							adapter.setState('DECT440_' + device.identifier + '.name', { val: device.name, ack: true });
							//da TxBusy mit der API zeitgleich mit DECT440 herauskam, sparen wir die Abfrage ob vorhanden
							let convertTxBusy = device.txbusy == 1 ? true : false;
							adapter.log.debug(
								'DECT440_' +
									device.identifier +
									' : ' +
									'txbusy : ' +
									convertTxBusy +
									'(' +
									device.txbusy +
									')'
							);
							adapter.setState('DECT440_' + device.identifier + '.txbusy', {
								val: convertTxBusy,
								ack: true
							});

							let convertPresent = device.present == 1 ? true : false;
							adapter.log.debug(
								'DECT440_' +
									device.identifier +
									' : ' +
									'present : ' +
									convertPresent +
									' (' +
									device.present +
									')'
							);
							adapter.setState('DECT440_' + device.identifier + '.present', {
								val: convertPresent,
								ack: true
							});

							if (device.present === '0' || device.present === 0 || device.present === false) {
								adapter.log.warn(
									'DECT440_' +
										device.identifier +
										' is not present, check the device connection, no values are written'
								);
							} else {
								adapter.log.debug(
									'DECT200_' +
										device.identifier +
										' : ' +
										'temp : ' +
										parseFloat(device.temperature.celsius) / 10
								);
								adapter.setState('DECT200_' + device.identifier + '.temp', {
									val: parseFloat(device.temperature.celsius) / 10,
									ack: true
								});

								adapter.log.debug(
									'DECT200_' +
										device.identifier +
										' : ' +
										'temp offset: ' +
										parseFloat(device.temperature.offset) / 10
								);
								adapter.setState('DECT200_' + device.identifier + '.temp_offset', {
									val: parseFloat(device.temperature.offset) / 10,
									ack: true
								});
							}
						} else if ((device.functionbitmask & 1048864) == 1048864) {
							//DECT440
							adapter.log.debug('updating DECT440 ' + device.name);
							adapter.log.debug('DECT440_' + device.identifier + ' : ' + 'name : ' + device.name);
							adapter.setState('DECT440_' + device.identifier + '.name', { val: device.name, ack: true });
							//da TxBusy mit der API zeitgleich mit DECT440 herauskam, sparen wir die Abfrage ob vorhanden
							let convertTxBusy = device.txbusy == 1 ? true : false;
							adapter.log.debug(
								'DECT440_' +
									device.identifier +
									' : ' +
									'txbusy : ' +
									convertTxBusy +
									'(' +
									device.txbusy +
									')'
							);
							adapter.setState('DECT440_' + device.identifier + '.txbusy', {
								val: convertTxBusy,
								ack: true
							});

							let convertPresent = device.present == 1 ? true : false;
							adapter.log.debug(
								'DECT440_' +
									device.identifier +
									' : ' +
									'present : ' +
									convertPresent +
									' (' +
									device.present +
									')'
							);
							adapter.setState('DECT440_' + device.identifier + '.present', {
								val: convertPresent,
								ack: true
							});

							if (device.present === '0' || device.present === 0 || device.present === false) {
								adapter.log.warn(
									'DECT440_' +
										device.identifier +
										' is not present, check the device connection, no values are written'
								);
							} else {
								adapter.log.debug(
									'DECT440_' +
										device.identifier +
										' : ' +
										'temp : ' +
										parseFloat(device.temperature.celsius) / 10
								);
								adapter.setState('DECT440_' + device.identifier + '.temp', {
									val: parseFloat(device.temperature.celsius) / 10,
									ack: true
								});

								adapter.log.debug(
									'DECT440_' +
										device.identifier +
										' : ' +
										'temp offset: ' +
										parseFloat(device.temperature.offset) / 10
								);
								adapter.setState('DECT440_' + device.identifier + '.temp_offset', {
									val: parseFloat(device.temperature.offset) / 10,
									ack: true
								});

								adapter.log.debug(
									'DECT440_' + device.identifier + ' : ' + 'humidity: ' + parseFloat(device.humidity)
								);
								adapter.setState('DECT440_' + device.identifier + '.humidity', {
									val: parseFloat(device.humidity),
									ack: true
								});
							}
						} else {
							adapter.log.debug(
								'nix vorbereitet für diese Art von device update ' +
									device.functionbitmask +
									' -> ' +
									device.name
							);
						}
					});
				}
			})
			.catch(errorHandler);
	}
	//gibt es werte mit "" wenn Teile der Gruppe nicht vorhanden sind?
	//ggf auch hier mit present das Schreiben von null verhindern
	function updateGroups() {
		fritz
			.getDeviceListInfos()
			.then(function(devicelistinfos) {
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
					groups.forEach(function(group) {
						if ((group.functionbitmask & 512) == 512) {
							//switch
							adapter.log.debug('updating SwitchGroup ' + group.name);
							adapter.log.debug('Sgroup_' + group.identifier + ' : ' + 'name : ' + group.name);
							adapter.setState('Sgroup_' + group.identifier + '.name', { val: group.name, ack: true });

							let convertPresent = group.present == 1 ? true : false;
							adapter.log.debug(
								'Sgroup_' +
									group.identifier +
									' : ' +
									'present : ' +
									convertPresent +
									'(' +
									group.present +
									')'
							);
							adapter.setState('Sgroup_' + group.identifier + '.present', {
								val: convertPresent,
								ack: true
							});

							let convertSwitchState = group.switch.state == 1 ? true : false;
							adapter.log.debug(
								'Sgroup_' +
									group.identifier +
									' : ' +
									'state :' +
									convertSwitchState +
									'(' +
									group.switch.state +
									')'
							);
							adapter.setState('Sgroup_' + group.identifier + '.state', {
								val: convertSwitchState,
								ack: true
							});

							adapter.log.debug('Sgroup_' + group.identifier + ' : ' + 'mode :' + group.switch.mode);
							adapter.setState('Sgroup_' + group.identifier + '.mode', {
								val: group.switch.mode,
								ack: true
							});

							let convertLock = group.switch.lock == 1 ? true : false;
							adapter.log.debug(
								'Sgroup_' +
									group.identifier +
									' : ' +
									'lock :' +
									convertLock +
									' (' +
									group.switch.lock +
									')'
							);
							adapter.setState('Sgroup_' + group.identifier + '.lock', { val: convertLock, ack: true });

							let convertDeviceLock = group.switch.devicelock == 1 ? true : false;
							adapter.log.debug(
								'Sgroup_' +
									group.identifier +
									' : ' +
									'devicelock :' +
									convertDeviceLock +
									' (' +
									group.switch.devicelock +
									')'
							);
							adapter.setState('Sgroup_' + group.identifier + '.devicelock', {
								val: convertDeviceLock,
								ack: true
							});

							adapter.log.debug(
								'Sgroup_' +
									group.identifier +
									' : ' +
									'power :' +
									parseFloat(group.powermeter.power) / 1000
							);
							adapter.setState('Sgroup_' + group.identifier + '.power', {
								val: parseFloat(group.powermeter.power) / 1000,
								ack: true
							});

							adapter.log.debug(
								'Sgroup_' + group.identifier + ' : ' + 'energy :' + group.powermeter.energy
							);
							adapter.setState('Sgroup_' + group.identifier + '.energy', {
								val: group.powermeter.energy,
								ack: true
							});
						} else if ((group.functionbitmask & 64) == 64) {
							//thermostat
							adapter.log.debug('updating HeaterGroup ' + group.name);
							adapter.log.debug(
								'Hgroup_' + group.identifier.replace(/\s/g, '') + ' : ' + 'name : ' + group.name
							);
							adapter.setState('Hgroup_' + group.identifier.replace(/\s/g, '') + '.name', {
								val: group.name,
								ack: true
							});

							let convertPresent = group.present == 1 ? true : false;
							adapter.log.debug(
								'Hgroup_' +
									group.identifier.replace(/\s/g, '') +
									' : ' +
									'present : ' +
									convertPresent +
									' (' +
									group.present +
									')'
							);
							adapter.setState('Hgroup_' + group.identifier.replace(/\s/g, '') + '.present', {
								val: convertPresent,
								ack: true
							});

							adapter.log.debug(
								'Hgroup_' +
									group.identifier.replace(/\s/g, '') +
									': ' +
									'actualtemp :' +
									parseFloat(group.hkr.tist) / 2
							);
							adapter.setState('Hgroup_' + group.identifier.replace(/\s/g, '') + '.actualtemp', {
								val: parseFloat(group.hkr.tist) / 2,
								ack: true
							});

							let currentMode = 'On';
							adapter.setState('Hgroup_' + group.identifier.replace(/\s/g, '') + '.operationList', {
								val: `On, Off, Holiday, Summer, Comfort, Night`,
								ack: true
							});

							var targettemp = group.hkr.tsoll;

							if (targettemp < 57) {
								// die Abfrage auf <57 brauchen wir wahrscheinlich nicht
								adapter.log.debug(
									'Hgroup_' +
										group.identifier.replace(/\s/g, '') +
										' : ' +
										'targettemp :' +
										targettemp
								);
								adapter.setState('Hgroup_' + group.identifier.replace(/\s/g, '') + '.targettemp', {
									val: parseFloat(targettemp) / 2,
									ack: true
								});
								adapter.setState('Hgroup_' + group.identifier.replace(/\s/g, '') + '.lasttarget', {
									val: parseFloat(targettemp) / 2,
									ack: true
								}); // zum Nachführen der Soll-Temperatur wenn außerhalb von iobroker gesetzt
								adapter.setState('Hgroup_' + group.identifier.replace(/\s/g, '') + '.mode', {
									val: 0,
									ack: true
								});
							} else if (targettemp == '253') {
								adapter.log.debug(
									'Hgroup_' + group.identifier.replace(/\s/g, '') + ' : ' + 'mode: Closed'
								);
								// adapter.setState('Hgroup_'+ device.identifier.replace(/\s/g, '') +'.targettemp', {val: 7, ack: true}); // zum setzen der Temperatur außerhalb der Anzeige?
								adapter.setState('Hgroup_' + group.identifier.replace(/\s/g, '') + '.mode', {
									val: 1,
									ack: true
								});
								currentMode = 'Off';
							} else if (targettemp == '254') {
								adapter.log.debug(
									'Hgroup_' + group.identifier.replace(/\s/g, '') + ' : ' + 'mode : Opened'
								);
								// adapter.setState('Hgroup_'+ device.identifier.replace(/\s/g, '') +'.targettemp', {val: 29, ack: true}); // zum setzen der Temperatur außerhalb der Anzeige?
								adapter.setState('Hgroup_' + group.identifier.replace(/\s/g, '') + '.mode', {
									val: 2,
									ack: true
								});
								currentMode = 'On';
							}

							adapter.log.debug(
								'Hgroup_' +
									group.identifier.replace(/\s/g, '') +
									' : ' +
									'comfytemp :' +
									parseFloat(group.hkr.komfort) / 2
							);
							adapter.setState('Hgroup_' + group.identifier.replace(/\s/g, '') + '.comfytemp', {
								val: parseFloat(group.hkr.komfort) / 2,
								ack: true
							});
							if (targettemp === group.hkr.komfort) {
								currentMode = 'Comfort';
							}

							adapter.log.debug(
								'Hgroup_' +
									group.identifier.replace(/\s/g, '') +
									' : ' +
									'nighttemp :' +
									parseFloat(group.hkr.absenk) / 2
							);
							adapter.setState('Hgroup_' + group.identifier.replace(/\s/g, '') + '.nighttemp', {
								val: parseFloat(group.hkr.absenk) / 2,
								ack: true
							});
							if (targettemp === group.hkr.komfort) {
								currentMode = 'Night';
							}

							if (group.hkr.batterylow) {
								adapter.log.debug(
									'Hgroup_' +
										group.identifier.replace(/\s/g, '') +
										' : ' +
										'batterylow :' +
										group.hkr.batterylow
								);
								adapter.setState('Hgroup_' + group.identifier.replace(/\s/g, '') + '.batterylow', {
									val: group.hkr.batterylow,
									ack: true
								});
							}

							adapter.log.debug(
								'Hgroup_' +
									group.identifier.replace(/\s/g, '') +
									' : ' +
									'errorcode :' +
									group.hkr.errorcode
							);
							adapter.setState('Hgroup_' + group.identifier.replace(/\s/g, '') + '.errorcode', {
								val: group.hkr.errorcode,
								ack: true
							});

							let convertLock = group.hkr.lock == 1 ? true : false;
							adapter.log.debug(
								'Hgroup_' +
									group.identifier.replace(/\s/g, '') +
									' : ' +
									'lock :' +
									convertLock +
									' (' +
									group.hkr.lock +
									')'
							);
							adapter.setState('Hgroup_' + group.identifier.replace(/\s/g, '') + '.lock', {
								val: convertLock,
								ack: true
							});

							let convertDeviceLock = group.hkr.devicelock == 1 ? true : false;
							adapter.log.debug(
								'Hgroup_' +
									group.identifier.replace(/\s/g, '') +
									' : ' +
									'devicelock :' +
									convertDeviceLock +
									' (' +
									group.hkr.devicelock +
									')'
							);
							adapter.setState('Hgroup_' + group.identifier.replace(/\s/g, '') + '.devicelock', {
								val: convertDeviceLock,
								ack: true
							});

							if (group.hkr.summeractive) {
								let convertValue = group.hkr.summeractive == 1 ? true : false;

								adapter.log.debug(
									'Hgroup_' +
										group.identifier.replace(/\s/g, '') +
										' : ' +
										'summeractive : ' +
										convertValue +
										' (' +
										group.hkr.summeractive +
										')'
								);
								adapter.setState('Hgroup_' + group.identifier.replace(/\s/g, '') + '.summeractive', {
									val: convertValue,
									ack: true
								});

								if (convertValue) {
									currentMode = 'Summer';
								}
							}
							if (group.hkr.holidayactive) {
								let convertValue = group.hkr.holidayactive == 1 ? true : false;

								adapter.log.debug(
									'Hgroup_' +
										group.identifier.replace(/\s/g, '') +
										' : ' +
										'holidayactive : ' +
										convertValue +
										' (' +
										group.hkr.holidayactive +
										')'
								);
								adapter.setState('Hgroup_' + group.identifier.replace(/\s/g, '') + '.holidayactive', {
									val: convertValue,
									ack: true
								});

								if (convertValue) {
									currentMode = 'Holiday';
								}
							}
							adapter.setState('Hgroup_' + group.identifier.replace(/\s/g, '') + '.operationMode', {
								val: currentMode,
								ack: true
							});
						} else {
							adapter.log.debug(
								'nix vorbereitet für diese Art von group update ' +
									group.functionbitmask +
									' -> ' +
									group.name
							);
						}
					});
				}
			})
			.catch(errorHandler);
	}

	function pollFritzData() {
		var fritz_interval = parseInt(adapter.config.fritz_interval, 10) || 300;
		updateDevices(); // für alle Objekte, da in xml/json mehr enthalten als in API-Aufrufe
		updateGroups();
		adapter.log.debug('polling! fritzdect is alive');
		fritzTimeout = setTimeout(pollFritzData, fritz_interval * 1000);
	}

	/*
    function mydevices() {
        fritz.getDeviceListInfos().then(function(devicelistinfos) {
            console.log("List devices\n");
            console.log(devicelistinfos);
            var devices = parser.xml2json(devicelistinfos);
            devices = [].concat((devices.devicelist || {}).device || []).map(function(device) {
                // remove spaces in AINs
                device.identifier = device.identifier.replace(/\s/g, '');
                return device;
            });
            console.log("devices\n");
            console.log(devices);
            var groups = parser.xml2json(devicelistinfos);
            groups = [].concat((groups.devicelist || {}).group || []).map(function(group) {
                // remove spaces in AINs
                group.identifier = group.identifier.replace(/\s/g, '');
                return group;
            });
            console.log("groups\n");
            console.log(groups);
            var all = devices.concat(groups);
            console.log("all\n");
            console.log(all);
            console.log(JSON.stringify(all));
            return all;
        });
    }
    */

	createDevices();
	createGroups();
	createTemplates();
	pollFritzData();

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
