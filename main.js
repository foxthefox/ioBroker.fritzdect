/* jshint -W097 */// jshint strict:false
/*jslint node: true */


"use strict";

var Fritz = require('fritzapi').Fritz;
// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils
// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0

var fritzTimeout;

var adapter = utils.Adapter('fritzdect');

function errorHandler(error) {
    if (error == "0000000000000000")
        adapter.log.debug("Did not get session id- invalid username or password?")
    else
        adapter.log.error('error calling the fritzbox '+JSON.stringify(error));
}

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
    var moreParam = adapter.config.fritz_ip;

    var fritz = new Fritz(username, password||"", moreParam||"");

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.debug('ack is not set! -> command');
        var tmp = id.split('.');
        var dp = tmp.pop(); //should always be "state"
        var idx = tmp.pop(); //is the name after fritzdect.x.
        if (idx.startsWith("Comet_")){ //must be comet
            id = idx.replace(/Comet_/g,''); //Thermostat
            adapter.log.info('Comet ID: '+ id + ' identified for command (' + dp + ') : ' + state.val);
            if (dp === 'targettemp'){
                if (state.val < 8) { //kann gelöscht werden, wenn Temperaturvorwahl nicht zur Moduswahl benutzt werden soll
                    adapter.setState('Comet_'+ id +'.mode', {val: 1, ack: false});
                    fritz.setTempTarget(id, 'off').then(function (sid) {
                        adapter.log.debug('Switched Mode' + id + ' to closed');
                    })
                    .catch(errorHandler);
                } else if (state.val > 28) { //kann gelöscht werden, wenn Temperaturvorwahl nicht zur Moduswahl benutzt werden soll
                    adapter.setState('Comet_'+ id +'.mode', {val: 2, ack: false});
                    fritz.setTempTarget(id, 'on').then(function (sid) {
                        adapter.log.debug('Switched Mode' + id + ' to opened permanently');
                    })
                    .catch(errorHandler);
                } else {
                    adapter.setState('Comet_'+ id +'.mode', {val: 0, ack: false});
                    fritz.setTempTarget(id, state.val).then(function (sid) {
                        adapter.log.debug('Set target temp ' + id + state.val +' °C');
                        adapter.setState('Comet_'+ id +'.lasttarget', {val: state.val, ack: true}); //iobroker Tempwahl wird zum letzten Wert gespeichert
                    })
                    .catch(errorHandler);

                }
            } else if (dp === 'mode') {
                if (state.val === 0) {
                    adapter.getState('Comet_' + id + '.targettemp', function (err, targettemp) { // oder hier die Verwendung von lasttarget
                        var setTemp = targettemp.val;
                        if (setTemp < 8) {
                            adapter.setState('Comet_' + id + '.targettemp', {val: 8, ack:true});
                            setTemp = 8;
                        } else if (setTemp > 28) {
                            adapter.setState('Comet_' + id + '.targettemp', {val: 28, ack:true});
                            setTemp = 28;
                        }

                        fritz.setTempTarget(id, setTemp).then(function (sid) {
                            adapter.log.debug('Set target temp ' + id + ' ' + setTemp +' °C');
                        })
                        .catch(errorHandler);

                    });
                } else if (state.val === 1) {
                    fritz.setTempTarget(id, 'off').then(function (sid) {
                        adapter.log.debug('Switched Mode' + id + ' to closed.');
                    })
                    .catch(errorHandler); 
                } else if (state.val === 2) {
                    fritz.setTempTarget(id, 'on').then(function (sid) {
                        adapter.log.debug('Switched Mode' + id + ' to opened permanently');
                    })
                    .catch(errorHandler);
   
                }
            }
        }
        else if (idx.startsWith("DECT200_")) { //must be DECT
            id = idx.replace(/DECT200_/g,''); //Switch
            adapter.log.info('SWITCH ID: '+ id + ' identified for command (' + dp + ') : ' + state.val);
            if (dp == 'state') {
                if (state.val === 0 || state.val === '0' || state.val === 'false' || state.val === false || state.val === 'off' || state.val === 'OFF') {
                    fritz.setSwitchOff(id).then(function (sid) {
                        adapter.log.debug('Turned switch ' + id + ' off');
                    })
                    .catch(errorHandler);
                }
                else if (state.val === 1 || state.val === '1' || state.val === 'true' || state.val === true || state.val === 'on' || state.val === 'ON') {
                    fritz.setSwitchOn(id).then(function (sid) {
                        adapter.log.debug('Turned switch ' + id + ' on');
                    })
                    .catch(errorHandler);

                }
            }           
        }
        else { //must be GuestWLAN
            adapter.log.info('GuestWLAN identified for command (' + dp + ') : ' + state.val);
            if (dp == 'state') {
                if (state.val === 0 || state.val === '0' || state.val === 'false' || state.val === false || state.val === 'off' || state.val === 'OFF') {
                    fritz.setGuestWlan(state.val).then(function (sid) {
                        adapter.log.debug('Turned WLAN off');
                    })
                    .catch(errorHandler);
                }    
                else if (state.val === 1 || state.val === '1' || state.val === 'true' || state.val === true || state.val === 'on' || state.val === 'ON') {
                    fritz.setGuestWlan(state.val).then(function (sid) {
                        adapter.log.debug('Turned WLAN on');
                    })
                    .catch(errorHandler);
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
    var moreParam = adapter.config.fritz_ip;
    
    var fritz = new Fritz(username, password||"", moreParam||"");

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
                    "name":  "Switch lock", //switch lock 0=unlocked, 1=locked
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
            adapter.setObject('DECT200_' + newId +'.voltage', {
                type: 'state',
                common: {
                    "name":  "Switch act voltage",
                    "type": "number",
                    "unit": "V",
                    "min": 0,
                    "max": 250,
                    "read": true,
                    "write": false,
                    "role": "value.voltage",
                    "desc":  "Switch act voltage"
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
    
    function insertComet(comets) {
        for (var i=0;i<comets.length; i++){
            fritz.getDevice(comets[i]).then(function(device) { 
                var newId = device.identifier.replace(/\s/g, '');
                adapter.log.info('setting up thermostat object ' + newId + ' (' + device.name + ')');

                adapter.setObject('Comet_' + newId, {
                    type: 'channel',
                    common: {
                        name: device.name,
                        role: 'thermo.heat'
                    },
                    native: {
                        "aid": newId
                    }
                });;
                
                adapter.setObject('Comet_' + newId +'.name', {
                    type: 'state',
                    common: {
                        "name":  "Comet device name",
                        "type": "string",
                        "read": true,
                        "write": false,
                        "role": "text",
                        "desc":  "Device name of the thermostat"
                    },
                    native: {
                    }
                });
                adapter.setState('Comet_'+ newId +'.name', {val: device.name, ack: true});
                
                adapter.setObject('Comet_' + newId +'.temp', {
                    type: 'state',
                    common: {
                        "name":  "Comet Temp",
                        "type": "number",
                        "unit": "°C",
                        "read": true,
                        "write": false,
                        "role": "value.temperature",
                        "desc":  "Actual Temp"
                    },
                    native: {
                    }
                });
                adapter.setObject('Comet_' + newId +'.mode', {
                    type:'state',
                    common:{
                        "name":  "Thermostat operation mode (0=auto, 1=closed, 2=open)",
                        "type":  "number",
                        "read":  true,
                        "write": true,
                        "role":  "value",
                        "min": 0,
                        "max": 2,
                        "desc": "Thermostat operation mode (0=auto, 1=closed, 2=open)"
                    },
                    native: {
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
                adapter.setObject('Comet_' + newId +'.lasttarget', {
                    type: 'state',
                    common: {
                        "name":  "last setting of target temp",
                        "type": "number",
                        "unit": "°C",
                        "read": true,
                        "write": false,
                        "role": "value.temperature",
                        "desc":  "last setting of target temp"
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
                        "role": "value.temperature",                    
                        "desc":  "Comfort Temp"
                    },
                    native: {
                    }
                });
                adapter.setObject('Comet_' + newId +'.nighttemp', {
                    type: 'state',
                    common: {
                        "name":  "Night Temp",
                        "type": "number",
                        "unit": "°C",                    
                        "read": true,
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
                        "unit": "%",
                        "read": true,
                        "write": false,
                        "role": "value.battery",
                        "desc":  "Battery"
                    },
                    native: {
                    }
                });
            });
        }
    }
    function insertDECT100(newId, name){
        adapter.log.info('setting up Dect100 object '+ name);
        adapter.setObject('DECT100_' + newId, {
            type: 'channel',
            common: {
                name: 'FritzDECT100 ' + newId,
                role: 'thermo'
            },
            native: {
                "aid": newId
            }
        });
        adapter.setObject('DECT100_' + newId +'.name', {
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
        adapter.setState('DECT100_'+ newId +'.name', {val: name, ack: true});

        adapter.setObject('DECT100_' + newId +'.present', {
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
        adapter.setObject('DECT100_' + newId +'.temp', {
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
    }

    function insertContact(newId, name){
        adapter.log.info('setting up Contact object '+ name);
        adapter.setObject('Contact_' + newId, {
            type: 'channel',
            common: {
                name: 'Contact ' + newId,
                role: 'sensor'
            },
            native: {
                "aid": newId
            }
        });
        adapter.setObject('Contact_' + newId +'.name', {
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
        adapter.setState('Contact_'+ newId +'.name', {val: name, ack: true});

        adapter.setObject('Contact_' + newId +'.present', {
            type: 'state',
            common: {
                "name":  "Contact present",
                "type": "boolean",
                "read": true,
                "write": false,
                "role": "indicator.connected",
                "desc":  "Contact present"
            },
            native: {
            }
        });
        adapter.setObject('Contact_' + newId +'.state', {
            type: 'state',
            common: {
                "name":  "Contact OFF/ON",
                "type": "boolean",
                "read": true,
                "write": false,
                "role": "indicator.connected",
                "desc":  "Contact OFF/ON"
            },
            native: {
            }
        });
    }
    
    function getSwitchInfo(switches, i){
        fritz.getSwitchName(switches[i]).then(function(name){
            adapter.log.debug('DECT200_'+ switches[i] + ' : '  +'name :' + name);
            adapter.setState('DECT200_'+ switches[i] +'.name', {val: name, ack: true});
        })
        .catch(errorHandler);
        fritz.getSwitchState(switches[i]).then(function(state){
            adapter.log.debug('DECT200_'+ switches[i] + ' : '  +'state :' + state);
            adapter.setState('DECT200_'+ switches[i] +'.state', {val: state, ack: true});
        });
        fritz.getSwitchPresence(switches[i]).then(function(presence){
            adapter.log.debug('DECT200_'+ switches[i] + ' : ' +'present :' + presence);
            adapter.setState('DECT200_'+ switches[i] +'.present', {val: presence, ack: true});
        })
        .catch(errorHandler);
        /* verschoben nach updateObjects
        if( adapter.config.dect200temp_en === 'true' || adapter.config.dect200temp_en  === true || adapter.config.dect200temp_en  === 1) {            
            fritz.getTemperature(switches[i]).then(function(temp){
                adapter.log.debug('DECT200_'+ switches[i] + ' : '  +'temp :' + temp);
                adapter.setState('DECT200_'+ switches[i] +'.temp', {val: temp, ack: true});
            })
            .catch(errorHandler);
        }
        */
        fritz.getSwitchPower(switches[i]).then(function(power){
            adapter.log.debug('DECT200_'+ switches[i]+ ' : '  +'power :' + power);
            adapter.setState('DECT200_'+ switches[i] +'.power', {val: power, ack: true});
        })
        .catch(errorHandler);
        fritz.getSwitchEnergy(switches[i]).then(function(energy){
            adapter.log.debug('DECT200_'+ switches[i]+ ' : '  +'energy :' + energy);
            adapter.setState('DECT200_'+ switches[i] +'.energy', {val: energy, ack: true});
        })
        .catch(errorHandler);
    }
    function getCometInfo(comets, i){
        fritz.getTemperature(comets[i]).then(function(temp){
            adapter.log.debug('Comet_'+ comets[i] + ' : '  +'temp :' + temp);
            adapter.setState('Comet_'+ comets[i] +'.temp', {val: temp, ack: true});
        })
        .catch(errorHandler);
        fritz.getTempTarget(comets[i]).then(function(targettemp){
            if (targettemp < 57){ // die Abfrage auf <57 brauchen wir wahrscheinlich nicht
                adapter.log.debug('Comet_'+ comets[i] + ' : '  +'targettemp :' + targettemp);
                adapter.setState('Comet_'+ comets[i] +'.targettemp', {val: targettemp, ack: true});
                adapter.setState('Comet_'+ comets[i] +'.lasttarget', {val: targettemp, ack: true}); // zum Nachführen der Soll-Temperatur wenn außerhalb von iobroker gesetzt
                adapter.setState('Comet_'+ comets[i] +'.mode', {val: 0, ack: true});
            } else
            if (targettemp == 'off'){
                adapter.log.debug('Comet_'+ comets[i] + ' : '  +'mode: Closed');
                // adapter.setState('Comet_'+ comets[i] +'.targettemp', {val: 7, ack: true}); // zum setzen der Temperatur außerhalb der Anzeige?
                adapter.setState('Comet_'+ comets[i] +'.mode', {val: 1, ack: true});
            } else
            if (targettemp == 'on'){
                adapter.log.debug('Comet_'+ comets[i] + ' : '  +'mode : Opened');
                // adapter.setState('Comet_'+ comets[i] +'.targettemp', {val: 29, ack: true}); // zum setzen der Temperatur außerhalb der Anzeige?
                adapter.setState('Comet_'+ comets[i] +'.mode', {val: 2, ack: true});
            }
        })
        .catch(errorHandler);
        fritz.getTempComfort(comets[i]).then(function(comfytemp){
            adapter.log.debug('Comet_'+ comets[i] + ' : '  +'comfytemp :' + comfytemp);
            adapter.setState('Comet_'+ comets[i] +'.comfytemp', {val: comfytemp, ack: true});
        })
        .catch(errorHandler);
        fritz.getTempNight(comets[i]).then(function(nighttemp){
            adapter.log.debug('Comet_'+ comets[i]+ ' : '  +'nighttemp :' + nighttemp);
            adapter.setState('Comet_'+ comets[i] +'.nighttemp', {val: nighttemp, ack: true});
        })
        .catch(errorHandler);
        fritz.getBatteryCharge(comets[i]).then(function(battery){
            adapter.log.debug('Comet_'+ comets[i]+ ' : '  +'battery :' + battery);
            adapter.setState('Comet_'+ comets[i] +'.battery', {val: battery, ack: true});
        })
        .catch(errorHandler);
    }
    function insertDectObj(){
        fritz.getSwitchList().then(function(switches){
            if (switches.length){
            adapter.log.info("Switches AINs: "+switches);
            insertDECT200(switches);}
            else{adapter.log.info("no switches found");}   
        })
        .catch(errorHandler);
    }
    function insertCometObj(){
        fritz.getThermostatList().then(function(comets){
            if (comets.length){
                adapter.log.info("Comet AINs: "+comets);
                insertComet(comets);}
            else{adapter.log.info("no thermostats found");}
        })
        .catch(errorHandler);
    }
    
    function insertDect100Obj(){
        fritz.getDeviceList().then(function(devices){
            if (devices.length){
                devices.forEach( function (device){
                    if(device.functionbitmask == '1280'){
                        adapter.log.info("DECT100 AIN: "+ device.identifier.replace(/\s/g, ''));
                        insertDECT100(device.identifier.replace(/\s/g, ''),device.name);
                    }
                })
            }
        })
        .catch(errorHandler);
    }   

    function insertContactObj(){
        fritz.getDeviceList().then(function(devices){
            if (devices.length){
               devices.forEach( function (device){
                    if(device.functionbitmask == '8208'){
                        adapter.log.info("Contact AIN: "+ device.identifier.replace(/\s/g, ''));
                        insertContact(device.identifier.replace(/\s/g, ''),device.name);
                    }
                })
            }
        })
        .catch(errorHandler);
    }      
    function updateFritzGuest(){
        fritz.getGuestWlan().then(function(listinfos){
            adapter.log.debug("Guest WLAN: "+JSON.stringify(listinfos));
        })
        .catch(errorHandler);
    }
    function updateFritzDect(){
        fritz.getSwitchList().then(function(switches){
            if (switches.length){
                var i=0;
                for (i;i<switches.length;i++){
                    adapter.log.debug("looping through switch status i= "+i);
                    getSwitchInfo(switches,i);       
                }
            }
        })
        .catch(errorHandler);
    }
    function updateFritzComet(){
        fritz.getThermostatList().then(function(comets){
            if (comets.length){
                var i=0;
                for (i;i<comets.length;i++){
                    adapter.log.debug("looping through comet status i= "+i);
                    getCometInfo(comets,i);       
                }
            }
        })
        .catch(errorHandler);
    }
    function updateObjects(){
        fritz.getDeviceList().then(function(devices){
            devices.forEach(function (device){
                if(device.functionbitmask == '1280'){

                    adapter.log.debug('DECT100_'+ device.identifier.replace(/\s/g, '') + ' : '  +'name : ' + device.name);
                    adapter.setState('DECT100_'+ device.identifier.replace(/\s/g, '') +'.name', {val: device.name, ack: true});
                    
                    adapter.log.debug('DECT100_'+ device.identifier.replace(/\s/g, '') + ' : '  +'temp : ' + (parseFloat(device.temperature.celsius)+parseFloat(device.temperature.offset))/10);
                    adapter.setState('DECT100_'+ device.identifier.replace(/\s/g, '') +'.temp', {val: (parseFloat(device.temperature.celsius)+parseFloat(device.temperature.offset))/10, ack: true});
                    
                    adapter.log.debug('DECT100_'+ device.identifier.replace(/\s/g, '') + ' : ' +'present : ' + device.present);
                    adapter.setState('DECT100_'+ device.identifier.replace(/\s/g, '') +'.present', {val: device.present, ack: true});
                    
                }
                if(device.functionbitmask == '8208'){
                    
                    adapter.log.debug('Contact_'+ device.identifier.replace(/\s/g, '') + ' : '  +'name : ' + device.name);
                    adapter.setState('Contact_'+ device.identifier.replace(/\s/g, '') +'.name', {val: device.name, ack: true});
                    
                    adapter.log.debug('Contact_'+ device.identifier.replace(/\s/g, '') + ' : '  +'state : ' + device.alert.state);
                    adapter.setState('Contact_'+ device.identifier.replace(/\s/g, '') +'.state', {val: device.alert.state, ack: true});
                    
                    adapter.log.debug('Contact_'+ device.identifier.replace(/\s/g, '') + ' : ' +'present : ' + device.present);
                    adapter.setState('Contact_'+ device.identifier.replace(/\s/g, '') +'.present', {val: device.present, ack: true});
                    
                }
                if(device.functionbitmask == '2944'){
                    
                    adapter.log.debug('DECT200_'+ device.identifier.replace(/\s/g, '') + ' : '  +'mode : ' + device.switch.mode);
                    adapter.setState('DECT200_'+ device.identifier.replace(/\s/g, '') +'.mode', {val: device.switch.mode, ack: true});
                    
                    adapter.log.debug('DECT200_'+ device.identifier.replace(/\s/g, '') + ' : '  +'lock : ' + device.switch.lock);
                    adapter.setState('DECT200_'+ device.identifier.replace(/\s/g, '') +'.lock', {val: device.switch.lock, ack: true});
                    
                    if(device.temperature.celsius){ //Hier temperatur, da manchmal nicht über getTemp eingelesen
                        adapter.log.debug('DECT200_'+ device.identifier.replace(/\s/g, '') + ' : '  +'temp : ' + (parseFloat(device.temperature.celsius));
                        adapter.setState('DECT200_'+ device.identifier.replace(/\s/g, '') +'.temp', {val: (parseFloat(device.temperature.celsius))/10, ack: true}); //json string enthält schon die korrgierte Temperatur
                    }
                    
                    if(device.powermeter.voltage){
                    //if( adapter.config.dect200volt_en === 'true' || adapter.config.dect200volt_en  === true || adapter.config.dect200volt_en  === 1 ) { 
                        adapter.log.debug('DECT200_'+ device.identifier.replace(/\s/g, '') + ' : ' +'voltage : ' + device.powermeter.voltage/1000);
                        adapter.setState('DECT200_'+ device.identifier.replace(/\s/g, '') +'.voltage', {val: device.powermeter.voltage / 1000, ack: true});
                    }
                    
                }
            })
        })
        .catch(errorHandler);
    } 
    function pollFritzData() {
        var fritz_interval = parseInt(adapter.config.fritz_interval,10) || 300;
        updateFritzDect();
        updateFritzComet();
        updateObjects(); // für Kontakte und DECT100 und non-standard Werte aus DECT200
        updateFritzGuest();
        adapter.log.debug("polling! fritzdect is alive");
        fritzTimeout = setTimeout(pollFritzData, fritz_interval*1000);
    }
    function logVersion(){
        fritz.getOSVersion().then(function(version){
            adapter.log.info('Talking to FritzBox with firmware: '  + version);
        })
        .catch(errorHandler);
    }

    logVersion();
    insertDectObj();
    insertCometObj();
    insertDect100Obj();
    insertContactObj();
    pollFritzData();

    // in this template all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');

}
