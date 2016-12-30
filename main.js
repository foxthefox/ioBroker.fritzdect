/* jshint -W097 */// jshint strict:false
/*jslint node: true */


"use strict";

var fritz = require('fritzapi');

// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
var adapter = utils.adapter('fritzdect');

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.debug('objectChange ' + id + ' ' + JSON.stringify(obj));
});

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));
var username = "admin";
var password = adapter.config.fritz_pw || "9999";
var moreParam = { url: "http://192.168.178.1" };
    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.debug('ack is not set! -> command');

        var tmp = id.split('.');
        var dp = tmp.pop();
        adapter.log.debug('data  ?'   +dp);
        var idx = tmp.pop();
        id = idx.replace(/DECT200_/g,''); //Switch
        adapter.log.debug('SWITCH ID: '+ id + ' identified');

        if (dp == 'state') {
            if (state.val == 0) {
                if (id==="GuestWLAN"){
                    fritz.getSessionID(username, password, moreParam).then(function (sid) {
                        fritz.setGuestWlan(sid, state.val, function (sid) {
                            adapter.log.info('Turned WLAN ' + id + ' off');
                        });
                    });

                }else {
                    fritz.getSessionID(username, password, moreParam).then(function (sid) {
                        fritz.setSwitchOff(sid, id).then(function (sid) {
                            adapter.log.info('Turned switch ' + id + ' off');
                        });
                    });
                }
            }
            else if (state.val == 1) {
                if (id==="GuestWLAN"){
                    fritz.getSessionID(username, password, moreParam).then(function (sid) {
                        fritz.setGuestWlan(sid, state.val, moreParam).then(function (sid) {
                            adapter.log.info('Turned WLAN ' + id + ' on');
                        });
                    });
                }else {
                    fritz.getSessionID(username, password, moreParam).then(function (sid) {
                        fritz.setSwitchOn(sid, id).then(function (sid) {
                            adapter.log.info('Turned switch ' + id + ' on');
                        });
                    });
                }

            }
        }
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    adapter.log.info('entered ready');
    main();
});

function main() {
    
var username = "admin";
var password = adapter.config.fritz_pw || "9999";
var moreParam = { url: "http://192.168.178.1" };    

    function insertDECT200(id){
        adapter.log.info('setting up object '+ id);

            var newId = id;
            adapter.setObject('DECT200_' + newId, {
                type: 'channel',
                common: {
                    name: 'FritzDECT200 ' + newId,
                    role: 'switch'
                },
                native: {
                    "aid": newId
                }
            });
            adapter.setObject('DECT200_' + newId +'.state', {
                type: 'state',
                common: {
                    "name":  "Switch on/off",
                    "type": "boolean",
                    "read": true,
                    "write": true,
                    "role": "switch",
                    "desc":  "Switch on/off"
                },
                native: {
                }
            });
            adapter.setObject('DECT200_' + newId +'.present', {
                type: 'state',
                common: {
                    "name":  "Switch present",
                    "type": "boolean",
                    "read": true,
                    "write": false,
                    "role": "indicator.connected",
                    "desc":  "Switch present"
                },
                native: {
                }
            });
            adapter.setObject('DECT200_' + newId +'.mode', {
                type: 'state',
                common: {
                    "name":  "Switch mode", //auto or man
                    "type": "boolean",
                    "read": true,
                    "write": false,
                    "role": "indicator",
                    "desc":  "Switch mode"
                },
                native: {
                }
            });
            adapter.setObject('DECT200_' + newId +'.lock', {
                type: 'state',
                common: {
                    "name":  "Switch mode", //switch lock 0=unlocked, 1=locked
                    "type": "number",
                    "read": true,
                    "write": false,
                    "role": "indicator"
                },
                native: {
                }
            });
            adapter.setObject('DECT200_' + newId +'.temp', {
                type: 'state',
                common: {
                    "name":  "Switch Temp",
                    "type": "number",
                    "unit": "°C",
                    "read": true,
                    "write": false,
                    "role": "value.temperature",
                    "desc":  "Switch Temp"
                },
                native: {
                }
            });
            adapter.setObject('DECT200_' + newId +'.power', {
                type: 'state',
                common: {
                    "name":  "Switch act power",
                    "type": "number",
                    "unit": "W",
                    "min": 0,
                    "max": 4000,
                    "read": true,
                    "write": false,
                    "role": "value",
                    "desc":  "Switch act power"
                },
                native: {
                }
            });
            adapter.setObject('DECT200_' + newId +'.energy', {
                type: 'state',
                common: {
                    "name":  "Switch total energy",
                    "type": "number",
                    "unit": "Wh",
                    "min": 0,
                    "read": true,
                    "write": false,
                    "role": "value.power.consumption",
                    "desc":  "Switch total energy"
                },
                native: {
                }
            });
    }

    fritz.getSessionID(username, password, moreParam).then(function(sid){
        adapter.log.info('SID : '+sid);
        fritz.getSwitchList(sid,moreParam).then(function(switches){
            adapter.log.info("Switches AIDs: "+switches);
            insertDECT200(switches);
        });
    })
    .catch(function(error) {
    adapter.log.debug("errorhandler:   " +error);
    });

    fritz.getSessionID(username, password, moreParam).then(function(sid){
        fritz.getGuestWlan(sid).then(function(listinfos){
            adapter.log.info("Guest WLAN: "+JSON.stringify(listinfos));
        });
    })
   .catch(function(error) {
    adapter.log.debug("errorhandler:   " +error);
    });

    fritz.getSessionID(username, password, moreParam).then(function(sid){
        adapter.log.debug('sid2 : '+ sid);
        fritz.getSwitchState(sid, '087610006102', moreParam).then(function(state){
            adapter.log.info('DECT200_'+ '087610006102'+ ' : '  +'state :' + state);
            adapter.setState('DECT200_'+ '087610006102' +'.state', {val: state, ack: true});
        });
        fritz.getSwitchPresence(sid, '087610006102', moreParam).then(function(presence){
            adapter.log.info('DECT200_'+ '087610006102'+ ' : ' +'present :' + presence);
            adapter.setState('DECT200_'+ '087610006102' +'.present', {val: presence, ack: true});
        });
        fritz.getTemperature(sid, '087610006102', moreParam).then(function(temp){
            adapter.log.info('DECT200_'+ '087610006102'+ ' : '  +'temp :' + temp);
            adapter.setState('DECT200_'+ '087610006102' +'.temp', {val: temp, ack: true});
        });
        fritz.getSwitchPower(sid, '087610006102', moreParam).then(function(power){
            adapter.log.info('DECT200_'+ '087610006102'+ ' : '  +'power :' + power);
            adapter.setState('DECT200_'+ '087610006102' +'.power', {val: power, ack: true});
        });
        fritz.getSwitchEnergy(sid, '087610006102', moreParam).then(function(energy){
            adapter.log.info('DECT200_'+ '087610006102'+ ' : '  +'energy :' + energy);
            adapter.setState('DECT200_'+ '087610006102' +'.energy', {val: energy, ack: true});
        });

    })
    .catch(function(error) {
    adapter.log.debug("errorhandler:   " +error);
    });

  
    // in this template all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');


    /**
     *   setState examples
     *
     *   you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
     *
     */

    // the variable testVariable is set to true as command (ack=false)
    adapter.setState('testVariable', true);

    // same thing, but the value is flagged "ack"
    // ack should be always set to true if the value is received from or acknowledged from the target system
    adapter.setState('testVariable', {val: true, ack: true});

    // same thing, but the state is deleted after 30s (getState will return null afterwards)
    adapter.setState('testVariable', {val: true, ack: true, expire: 30});



}
