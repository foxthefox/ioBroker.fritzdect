/* jshint -W097 */// jshint strict:false
/*jslint node: true */


"use strict";

var fritz = require('fritzapi');
// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils
// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0

var fritzTimeout;

var adapter = utils.adapter('fritzdect');

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    if (fritzTimeout) clearTimeout(fritzTimeout);
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
    var username = adapter.config.fritz_user;
    var password = adapter.config.fritz_pw;
    var moreParam = { url: adapter.config.fritz_ip};
    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.debug('ack is not set! -> command');
        var tmp = id.split('.');
        var dp = tmp.pop(); //should always be "state"
        var idx = tmp.pop(); //is the name after fritzdect.x.
        if (idx.startsWith("Comet_")){ //must be comet
            id = idx.replace(/Comet_/g,''); //Thermostat
            adapter.log.info('Comet ID: '+ id + ' identified for command');
            if (dp === 'state'){
                fritz.getSessionID(username, password, moreParam).then(function (sid) {
                    fritz.setTempTarget(sid, id, state.val).then(function (sid) {
                        adapter.log.info('Set target temp ' + id + state.val +' °C');
                    });
                });
            }
        }
        else if (idx.startsWith("DECT200_")) { //must be DECT
            id = idx.replace(/DECT200_/g,''); //Switch
            adapter.log.info('SWITCH ID: '+ id + ' identified for command');
            if (dp == 'state') {
                if (state.val == 0) {
                        fritz.getSessionID(username, password, moreParam).then(function (sid) {
                            fritz.setSwitchOff(sid, id).then(function (sid) {
                                adapter.log.info('Turned switch ' + id + ' off');
                            });
                        });
                }
                else if (state.val == 1) {
                        fritz.getSessionID(username, password, moreParam).then(function (sid) {
                            fritz.setSwitchOn(sid, id).then(function (sid) {
                                adapter.log.info('Turned switch ' + id + ' on');
                            });
                        });
                    }
            }           
        }
        else { //must be GuestWLAN
            adapter.log.info('GuestWLAN identified for command');
            if (dp == 'state') {
                if (state.val == 0) {
                    fritz.getSessionID(username, password, moreParam).then(function (sid) {
                        fritz.setGuestWlan(sid, state.val, function (sid) {
                            adapter.log.info('Turned WLAN ' + id + ' off');
                        });
                    });
                }    
                else if (state.val == 1) {
                    fritz.getSessionID(username, password, moreParam).then(function (sid) {
                        fritz.setGuestWlan(sid, state.val, moreParam).then(function (sid) {
                            adapter.log.info('Turned WLAN ' + id + ' on');
                        });
                    });
                }
            }
        }     
    } //from if state&ack
}); //from adapter on

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    adapter.log.info('entered ready');
    main();
});

process.on('SIGINT', function () {
    if (fritzTimeout) clearTimeout(fritzTimeout);
});

function main() {
    
    var username = adapter.config.fritz_user;
    var password = adapter.config.fritz_pw;
    var moreParam = { url: adapter.config.fritz_ip};

    function insertDECT200(id){
        var switches = id;
        var i=0;
        for (i=0;i<switches.length; i++){
        adapter.log.info('setting up switch object '+ switches[i]);

            var newId = switches[i];
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
            adapter.setObject('DECT200_' + newId +'.name', {
                type: 'state',
                common: {
                    "name": "Name",
                    "type": "string",
                    "read": true,
                    "write": false,
                    "role": "text",
                    "desc":  "Name"
                },
                native: {
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
                    "role": "value.power",
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
    }
    function insertComet(id){
        var comets = id;
        var i=0;
        for (i=0;i<comets.length; i++){
        adapter.log.info('setting up thermostat object '+ comets[i]);

            var newId = comets[i];
            adapter.setObject('Comet_' + newId, {
                type: 'channel',
                common: {
                    name: 'FritzComet ' + newId,
                    role: 'thermo'
                },
                native: {
                    "aid": newId
                }
            });
            adapter.setObject('Comet_' + newId +'.targettemp', {
                type: 'state',
                common: {
                    "name":  "Target Temp",
                    "type": "number",
                    "unit": "°C",
                    "read": true,
                    "write": true,
                    "role": "value.temperature",
                    "desc":  "Target Temp"
                },
                native: {
                }
            });
            adapter.setObject('Comet_' + newId +'.comfytemp', {
                type: 'state',
                common: {
                    "name":  "Comfort Temp",
                    "type": "number",
                    "unit": "°C",                    
                    "read": true,
                    "write": false,
                    "role": "value.temperature",                    "desc":  "Comfort Temp"
                },
                native: {
                }
            });
            adapter.setObject('Comet_' + newId +'.nighttemp', {
                type: 'state',
                common: {
                    "name":  "Night Temp",
                    "type": "number",
                    "unit": "°C",                    "read": true,
                    "write": false,
                    "role": "value.temperature",
                    "desc":  "Night Temp"
                },
                native: {
                }
            });
            adapter.setObject('Comet_' + newId +'.battery', {
                type: 'state',
                common: {
                    "name":  "Battery", 
                    "type": "number",
                    "unit": "V",
                    "read": true,
                    "write": false,
                    "role": "value.battery",
                    "desc":  "Battery"
                },
                native: {
                }
            });
        }
    }
    function getSwitchInfo(switches, i, sid, moreParam){
        fritz.getSwitchName(sid, switches[i], moreParam).then(function(name){
            adapter.log.debug('DECT200_'+ switches[i] + ' : '  +'name :' + name);
            adapter.setState('DECT200_'+ switches[i] +'.name', {val: name, ack: true});
        });
        fritz.getSwitchState(sid, switches[i], moreParam).then(function(state){
            adapter.log.debug('DECT200_'+ switches[i] + ' : '  +'state :' + state);
            adapter.setState('DECT200_'+ switches[i] +'.state', {val: state, ack: true});
        });
        fritz.getSwitchPresence(sid,switches[i], moreParam).then(function(presence){
            adapter.log.debug('DECT200_'+ switches[i] + ' : ' +'present :' + presence);
            adapter.setState('DECT200_'+ switches[i] +'.present', {val: presence, ack: true});
        });
        fritz.getTemperature(sid,switches[i], moreParam).then(function(temp){
            adapter.log.debug('DECT200_'+ switches[i] + ' : '  +'temp :' + temp);
            adapter.setState('DECT200_'+ switches[i] +'.temp', {val: temp, ack: true});
        });
        fritz.getSwitchPower(sid,switches[i], moreParam).then(function(power){
            adapter.log.debug('DECT200_'+ switches[i]+ ' : '  +'power :' + power);
            adapter.setState('DECT200_'+ switches[i] +'.power', {val: power, ack: true});
        });
        fritz.getSwitchEnergy(sid,switches[i], moreParam).then(function(energy){
            adapter.log.debug('DECT200_'+ switches[i]+ ' : '  +'energy :' + energy);
            adapter.setState('DECT200_'+ switches[i] +'.energy', {val: energy, ack: true});
        });
    }

    function getCometInfo(comets, i, sid, moreParam){
        fritz.getTempTarget(sid, comets[i], moreParam).then(function(targettemp){
            adapter.log.debug('Comet_'+ comets[i] + ' : '  +'targettemp :' + targettemp);
            adapter.setState('Comet_'+ comets[i] +'.targettemp', {val: targettemp, ack: true});
        });
        fritz.getTempComfort(sid,comets[i], moreParam).then(function(comfytemp){
            adapter.log.debug('Comet_'+ comets[i] + ' : '  +'comfytemp :' + comfytemptemp);
            adapter.setState('Comet_'+ comets[i] +'.comfytemp', {val: comfytemp, ack: true});
        });
        fritz.getTempNight(sid,comets[i], moreParam).then(function(nighttemp){
            adapter.log.debug('Comet_'+ comets[i]+ ' : '  +'nighttemp :' + nighttemp);
            adapter.setState('Comet_'+ comets[i] +'.nighttemp', {val: nighttemp, ack: true});
        });
        fritz.getBatteryCharge(sid,comets[i], moreParam).then(function(battery){
            adapter.log.debug('Comet_'+ comets[i]+ ' : '  +'battery :' + battery);
            adapter.setState('Comet_'+ comets[i] +'.battery', {val: battery, ack: true});
        });
    }
    
    function insertDectObj(){
        fritz.getSessionID(username, password, moreParam).then(function(sid){
            adapter.log.debug('SID for switchlist : '+sid);
            fritz.getSwitchList(sid,moreParam).then(function(switches){
                if (switches.length){
                adapter.log.info("Switches AIDs: "+switches);
                insertDECT200(switches);}
                else{adapter.log.info("no switches found");}   
            });
        })
        .catch(function(error) {
        adapter.log.error("errorhandler switches:   " +error);
        });
    }
    function insertCometObj(){
        fritz.getSessionID(username, password, moreParam).then(function(sid){
            adapter.log.debug('SID for thermostatlist : '+sid);
            fritz.getThermostatList(sid,moreParam).then(function(comets){
                if (comets.length){
                    adapter.log.info("Comet AIDs: "+comets);
                    insertComet(comets);}
                else{adapter.log.info("no thermostats found");}
            });
        })
        .catch(function(error) {
        adapter.log.error("errorhandler thermostats:   " +error);
        });
    }

    fritz.getSessionID(username, password, moreParam).then(function(sid){
        fritz.getGuestWlan(sid).then(function(listinfos){
            adapter.log.info("Guest WLAN: "+JSON.stringify(listinfos));
        });
    })
   .catch(function(error) {
    adapter.log.error("errorhandler wlan:   " +error);
    });

    function updateFritzDect(){
        fritz.getSessionID(username, password, moreParam).then(function(sid){
            adapter.log.debug('SID for switch status  : '+ sid);
            fritz.getSwitchList(sid,moreParam).then(function(switches){
                if (switches.length){
                    var i=0;
                    for (i;i<switches.length;i++){
                        adapter.log.debug("looping through switch status i="+i);
                        getSwitchInfo(switches,i,sid,moreParam);       
                    }
                }
            })
        })
        .catch(function(error) {
        adapter.log.error("errorhandler switchstatus:   " +error);
        });
    }

    function updateFritzComet(){
        fritz.getSessionID(username, password, moreParam).then(function(sid){
            adapter.log.debug('SID for thermostat status  : '+ sid);
            fritz.getThermostatList(sid,moreParam).then(function(comets){
                if (comets.length){
                    var i=0;
                    for (i;i<comets.length;i++){
                        adapter.log.debug("looping through comet status i="+i);
                        getCometInfo(comets,i,sid,moreParam);       
                    }
                }
            })
        })
        .catch(function(error) {
        adapter.log.error("errorhandler switchstatus:   " +error);
        });
    }
    function pollFritzData() {
        var fritz_interval = parseInt(adapter.config.fritz_interval,10) || 300;
        updateFritzDect();
        updateFritzComet();
        adapter.log.info("polling! fritzdect is alive");
        fritzTimeout = setTimeout(pollFritzData, fritz_interval*1000);
    }
    insertDectObj();
    insertCometObj();
    pollFritzData();

    // in this template all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');

}


