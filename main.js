/*jshint -W097 */// jshint strict:false
/*jslint node: true */


"use strict";

var Fritz = require('fritzapi').Fritz,
    parser = require('xml2json-light');
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
    else if (error.response.statusCode == 403){
            adapter.log.error("no permission for this call (403), has user all the rights and access to fritzbox?")
            adapter.log.error('error calling the fritzbox '+JSON.stringify(error));
        }
    else if (error.response.statusCode == 404){
            adapter.log.error("call to API does not exist! (404)");
            adapter.log.error('error calling the fritzbox '+JSON.stringify(error));
        }
    else if (error.response.statusCode == 400){
            adapter.log.error("bad request (400), ain correct?");
            adapter.log.error('error calling the fritzbox '+JSON.stringify(error));
        }
    else {
            adapter.log.error('error calling the fritzbox '+JSON.stringify(error));
        }
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
        else if (idx.startsWith("Hgroup_")){ //must be comet group
            id = idx.replace(/Hgroup_/g,''); //Thermostat
            adapter.log.info('HGROUP ID: '+ id + ' identified for command (' + dp + ') : ' + state.val);
            if (dp === 'targettemp'){
                if (state.val < 8) { //kann gelöscht werden, wenn Temperaturvorwahl nicht zur Moduswahl benutzt werden soll
                    adapter.setState('Hgroup_'+ id +'.mode', {val: 1, ack: false});
                    fritz.setTempTarget(id, 'off').then(function (sid) {
                        adapter.log.debug('Switched Mode' + id + ' to closed');
                    })
                    .catch(errorHandler);
                } else if (state.val > 28) { //kann gelöscht werden, wenn Temperaturvorwahl nicht zur Moduswahl benutzt werden soll
                    adapter.setState('Hgroup_'+ id +'.mode', {val: 2, ack: false});
                    fritz.setTempTarget(id, 'on').then(function (sid) {
                        adapter.log.debug('Switched Mode' + id + ' to opened permanently');
                    })
                    .catch(errorHandler);
                } else {
                    adapter.setState('Hgroup_'+ id +'.mode', {val: 0, ack: false});
                    fritz.setTempTarget(id, state.val).then(function (sid) {
                        adapter.log.debug('Set target temp ' + id + state.val +' °C');
                        adapter.setState('Hgroup_'+ id +'.lasttarget', {val: state.val, ack: true}); //iobroker Tempwahl wird zum letzten Wert gespeichert
                    })
                    .catch(errorHandler);

                }
            } else if (dp === 'mode') {
                if (state.val === 0) {
                    adapter.getState('Hgroup_' + id + '.targettemp', function (err, targettemp) { // oder hier die Verwendung von lasttarget
                        var setTemp = targettemp.val;
                        if (setTemp < 8) {
                            adapter.setState('Hgroup_' + id + '.targettemp', {val: 8, ack:true});
                            setTemp = 8;
                        } else if (setTemp > 28) {
                            adapter.setState('Hgroup_' + id + '.targettemp', {val: 28, ack:true});
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
        else if (idx.startsWith("Sgroup_")) { //must be DECT switch group
            id = idx.replace(/Sgroup_/g,''); //Switch
            adapter.log.info('GROUP ID: '+ id + ' identified for command (' + dp + ') : ' + state.val);
            if (dp == 'state') {
                if (state.val === 0 || state.val === '0' || state.val === 'false' || state.val === false || state.val === 'off' || state.val === 'OFF') {
                    fritz.setSwitchOff(id).then(function (sid) {
                        adapter.log.debug('Turned group ' + id + ' off');
                    })
                    .catch(errorHandler);
                }
                else if (state.val === 1 || state.val === '1' || state.val === 'true' || state.val === true || state.val === 'on' || state.val === 'ON') {
                    fritz.setSwitchOn(id).then(function (sid) {
                        adapter.log.debug('Turned group ' + id + ' on');
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
    
    function updateFritzGuest(){
        fritz.getGuestWlan().then(function(listinfos){
            adapter.log.debug("Guest WLAN: "+JSON.stringify(listinfos));
        })
        .catch(errorHandler);
    }

    function createBasic(typ,newId,name,role,id,fw,manuf){
        adapter.log.debug('create Basic objects ');
        adapter.setObject(typ + newId, {
            type: 'channel',
            common: {
                name: name,
                role: role
            },
            native: {
                "aid": newId
            }
        });
        adapter.setObject(typ + newId +'.id', {
            type: 'state',
            common: {
                "name": "ID",
                "type": "string",
                "read": true,
                "write": false,
                "role": "text",
                "desc":  "ID"
            },
            native: {
            }
        });
        adapter.setState(typ + newId +'.id', {val: id, ack: true});
        adapter.setObject(typ + newId +'.name', {
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
        adapter.setObject(typ + newId +'.present', {
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
        adapter.setObject(typ + newId +'.fwversion', {
            type: 'state',
            common: {
                "name":  "FW version",
                "type": "string",
                "read": true,
                "write": false,
                "role": "text",
                "desc":  "firmware version"
            },
            native: {
            }
        });
        adapter.setState(typ + newId +'.fwversion',{val: fw, ack: true});
        adapter.setObject(typ + newId +'.manufacturer', {
            type: 'state',
            common: {
                "name":  "Manufacturer",
                "type": "string",
                "read": true,
                "write": false,
                "role": "text",
                "desc":  "Manufacturer"
            },
            native: {
            }
        });
        adapter.setState(typ + newId +'.manufacturer', {val: manuf, ack: true});
    }

    function createProductName(typ,newId,prod){
        adapter.log.debug('create Prodname object');
        adapter.setObject(typ + newId +'.prodname', {
            type: 'state',
            common: {
                "name":  "Product Name",
                "type": "string",
                "read": true,
                "write": false,
                "role": "text",
                "desc":  "Product Name"
            },
            native: {
            }
        });
        adapter.setState(typ + newId +'.prodname', {val: prod, ack: true});
    }

    function createAlert(typ,newId){
        adapter.log.debug('create Alert object');
        adapter.setObject(typ + newId +'.state', {
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

    function createTemperature(typ,newId){
        adapter.log.debug('create Temperature object');
        adapter.setObject(typ + newId +'.temp', {
            type: 'state',
            common: {
                "name":  "actual Temp",
                "type": "number",
                "unit": "°C",
                "read": true,
                "write": false,
                "role": "value.temperature",
                "desc":  "actual Temp"
            },
            native: {
            }
        });
    }
    function createSwitch(typ,newId){
        adapter.log.debug('create Switch objects');
        adapter.setObject(typ + newId +'.state', {
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
        adapter.setObject(typ + newId +'.mode', {
            type: 'state',
            common: {
                "name":  "Switch mode", //auto or man
                "type": "string",
                "read": true,
                "write": false,
                "role": "text",
                "desc":  "Switch mode"
            },
            native: {
            }
        });
        adapter.setObject(typ + newId +'.lock', {
            type: 'state',
            common: {
                "name":  "Switch UI/API lock", //switch lock 0=unlocked, 1=locked
                "type": "boolean",
                "read": true,
                "write": false,
                "role": "indicator"
            },
            native: {
            }
        });
    }
    function createDeviceLock(typ,newId){
        adapter.log.debug('create devicelock object');
        adapter.setObject(typ + newId +'.devicelock', {
            type: 'state',
            common: {
                "name":  "Switch Button lock", //switch lock 0=unlocked, 1=locked
                "type": "boolean",
                "read": true,
                "write": false,
                "role": "indicator"
            },
            native: {
            }
        });
    }
    function createEnergy(typ,newId){
        adapter.log.debug('create Energy objects ');
        adapter.setObject(typ + newId +'.power', {
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
        adapter.setObject(typ + newId +'.energy', {
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

    function createVoltage(typ,newId){
        adapter.log.debug('create Voltage object');
        adapter.setObject(typ + newId +'.voltage', {
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
    }    
    function createThermostat(typ,newId){
        adapter.log.debug('create Thermostat objects');
        adapter.setObject(typ + newId +'.mode', {
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
        adapter.setObject(typ + newId +'.targettemp', {
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
        adapter.setObject(typ + newId +'.lasttarget', {
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
        adapter.setObject(typ + newId +'.comfytemp', {
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
        adapter.setObject(typ + newId +'.nighttemp', {
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
        adapter.setObject(typ + newId +'.lock', {
            type: 'state',
            common: {
                "name":  "Thermostat UI/API lock", //thermostat lock 0=unlocked, 1=locked
                "type": "boolean",
                "read": true,
                "write": false,
                "role": "indicator"
            },
            native: {
            }
        });
        adapter.setObject(typ + newId +'.devicelock', {
            type: 'state',
            common: {
                "name":  "Thermostat Button lock",
                "type": "boolean",
                "read": true,
                "write": false,
                "role": "indicator"
            },
            native: {
            }
        });
        adapter.setObject(typ + newId +'.batterylow', {
            type: 'state',
            common: {
                "name":  "low Battery",
                "type": "boolean",
                "read": true,
                "write": false,
                "role": "indicator"
            },
            native: {
            }
        });
        adapter.setObject(typ + newId +'.battery', {
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
        adapter.setObject(typ + newId +'.errorcode', {
            type: 'state',
            common: {
                "name":  "errorcode",
                "type": "number",
                "read": true,
                "write": false,
                "role": "indicator"
            },
            native: {
            }
        });
    }
    function createThermostatProg(typ,newId){
        adapter.log.debug('create Thermostat Prog objects');
        adapter.setObject(typ + newId +'.summeractive', {
            type: 'state',
            common: {
                "name":  "Product Name",
                "type": "boolean",
                "read": true,
                "write": false,
                "role": "indicator",
                "desc":  "Product Name"
            },
            native: {
            }
        });
        adapter.setObject(typ + newId +'.holidayactive', {
            type: 'state',
            common: {
                "name":  "Product Name",
                "type": "boolean",
                "read": true,
                "write": false,
                "role": "indicator",
                "desc":  "Product Name"
            },
            native: {
            }
        });
    }    
    function createGroupInfo(typ,newId,mid,member){
        adapter.log.debug('create Group objects');
        adapter.setObject(typ + newId +'.masterdeviceid', {
            type: 'state',
            common: {
                "name":  "masterdeviceid",
                "type": "string",
                "read": true,
                "write": false,
                "role": "text",
                "desc":  "masterdeviceid"
            },
            native: {
            }
        });
        adapter.setState(typ + newId +'.masterdeviceid',{val: mid, ack: true});
        adapter.setObject(typ + newId +'.members', {
            type: 'state',
            common: {
                "name":  "members",
                "type": "string",
                "read": true,
                "write": false,
                "role": "text",
                "desc":  "members"
            },
            native: {
            }
        });
        adapter.setState(typ + newId +'.members',{val: member, ack: true});
    }
    function createDevices(){
        fritz.getDeviceListInfos().then(function(devicelistinfos) {
            var typ = "";
            var role = "";
            var devices = parser.xml2json(devicelistinfos);
            devices = [].concat((devices.devicelist || {}).device || []).map(function(device) {
              // remove spaces in AINs
              device.identifier = device.identifier.replace(/\s/g, '');
              return device;
            });
            adapter.log.debug("devices\n");
            adapter.log.debug(JSON.stringify(devices));
            if (devices.length){
                adapter.log.info('create Devices ' + devices.length);
                devices.forEach(function (device){
                    if((device.functionbitmask & 1024) == 1024){ //repeater
                        typ = "DECT100_";
                        role = "thermo";
                        adapter.log.info('setting up Repeater/DECT100 object '+ device.name);
                        createBasic(typ,device.identifier,device.name,role,device.id,device.fwversion,device.manufacturer);
                        createProductName(typ,device.identifier,device.productname);
                        if (device.temperature.celsius){
                            createTemperature(typ,device.identifier);
                        }
                    }
                    else if((device.functionbitmask & 512) == 512 ){ //switch
                        typ = "DECT200_";
                        role = "switch";
                        adapter.log.info('setting up Switch/DECT2xx object '+ device.name);                    
                        createBasic(typ,device.identifier,device.name,role,device.id,device.fwversion,device.manufacturer);
                        createProductName(typ,device.identifier,device.productname);
                        createSwitch(typ,device.identifier);
                        createEnergy(typ,device.identifier);
                        if (device.temperature.celsius){
                            createTemperature(typ,device.identifier);
                        }
                        if (device.switch.devicelock){
                            createDeviceLock(typ,device.identifier);
                        }
                        if (device.powermeter.voltage){
                            createVoltage(typ,device.identifier);
                        }
                    }
                    else if((device.functionbitmask & 64) == 64 ){ //thermostat
                        typ = "Comet_";
                        role = "thermo.heat";
                        adapter.log.info('setting up Thermostat/DECT3xx object '+ device.name);   
                        createBasic(typ,device.identifier,device.name,role,device.id,device.fwversion,device.manufacturer);
                        createProductName(typ,device.identifier,device.productname);
                        createTemperature(typ,device.identifier);
                        createThermostat(typ,device.identifier);
                        if (device.hkr.summeractive){
                            createThermostatProg(typ,device.identifier);
                        }                   
                    }
                    else if((device.functionbitmask & 16) == 16){ //contact
                        typ = "Contact_";
                        role = "sensor";
                        adapter.log.info('setting up Alert/Sensor object '+ device.name);                    
                        createBasic(typ,device.identifier,device.name,role,device.id,device.fwversion,device.manufacturer);
                        createProductName(typ,device.identifier,device.productname);
                        createAlert(typ,device.identifier);
                    }
                    else {
                        adapter.log.debug('nix vorbereitet für diese Art von Gruppe');
                    }                                
                });
            }
        })
        .catch(errorHandler);
    }

    function createGroups(){
        fritz.getDeviceListInfos().then(function(devicelistinfos) {
            var typ = "";
            var role = "";
            var groups = parser.xml2json(devicelistinfos);
            groups = [].concat((groups.devicelist || {}).group || []).map(function(group) {
              // remove spaces in AINs
              group.identifier = group.identifier.replace(/\s/g, '');
              return group;
            });
            adapter.log.debug("groups\n");
            adapter.log.debug(JSON.stringify(groups));
            if (groups.length){
                adapter.log.info('create Groups ' + groups.length);
                groups.forEach(function (group){
                    if ((group.functionbitmask & 512) == 512){ //sgroup
                        typ = "Sgroup_";
                        role = "switch";
                        adapter.log.info('setting up Switch Group '+ group.name);  
                        createBasic(typ,group.identifier,group.name,role,group.id,group.fwversion,group.manufacturer);
                        createSwitch(typ,group.identifier);
                        createEnergy(typ,group.identifier);
                        createGroupInfo(typ,group.identifier,group.groupinfo.masterdeviceid,group.groupinfo.members);
                    }
                    else if ((group.functionbitmask & 64) == 64){ //hgroup
                        typ = "Hgroup_";
                        role = "thermo.heat";
                        adapter.log.info('setting up Heater Group '+ group.name);  
                        createBasic(typ,group.identifier,group.name,role,group.id,group.fwversion,group.manufacturer);
                        createThermostat(typ,group.identifier);
                        createGroupInfo(typ,group.identifier,group.groupinfo.masterdeviceid,group.groupinfo.members);    
                    }
                    else {
                        adapter.log.debug('nix vorbereitet für diese Art von Gruppe');
                    }
                });
            }
        })
        .catch(errorHandler);
    }

    function updateDevices(){       
        fritz.getDeviceListInfos().then(function(devicelistinfos) {
            var devices = parser.xml2json(devicelistinfos);
            devices = [].concat((devices.devicelist || {}).device || []).map(function(device) {
                // remove spaces in AINs
                device.identifier = device.identifier.replace(/\s/g, '');
                return device;
            });
            adapter.log.debug("devices\n");
            adapter.log.debug(JSON.stringify(devices));           
            if (devices.length){
                adapter.log.debug('update Devices '  + devices.length);
                devices.forEach(function (device){
                    if((device.functionbitmask & 1024) == 1024){ //Repeater
                        adapter.log.debug('updating Repeater '+ device.name); 
                        adapter.log.debug('DECT100_'+ device.identifier.replace(/\s/g, '') + ' : '  +'name : ' + device.name);
                        adapter.setState('DECT100_'+ device.identifier.replace(/\s/g, '') +'.name', {val: device.name, ack: true});
                        
                        adapter.log.debug('DECT100_'+ device.identifier.replace(/\s/g, '') + ' : '  +'temp : ' + (parseFloat(device.temperature.celsius)+parseFloat(device.temperature.offset))/10);
                        adapter.setState('DECT100_'+ device.identifier.replace(/\s/g, '') +'.temp', {val: (parseFloat(device.temperature.celsius)+parseFloat(device.temperature.offset))/10, ack: true});
                        
                        adapter.log.debug('DECT100_'+ device.identifier.replace(/\s/g, '') + ' : ' +'present : ' + device.present);
                        adapter.setState('DECT100_'+ device.identifier.replace(/\s/g, '') +'.present', {val: device.present, ack: true});                    
                    }
                    else if((device.functionbitmask & 16) == 16){ //contact
                        adapter.log.debug('updating Sensor '+ device.name); 
                        adapter.log.debug('Contact_'+ device.identifier + ' : '  +'name : ' + device.name);
                        adapter.setState('Contact_'+ device.identifier +'.name', {val: device.name, ack: true});
                        
                        adapter.log.debug('Contact_'+ device.identifier + ' : '  +'state : ' + device.alert.state);
                        adapter.setState('Contact_'+ device.identifier +'.state', {val: device.alert.state, ack: true});
                        
                        adapter.log.debug('Contact_'+ device.identifier + ' : ' +'present : ' + device.present);
                        adapter.setState('Contact_'+ device.identifier +'.present', {val: device.present, ack: true});
                        
                    }
                    else if((device.functionbitmask & 512) == 512){ //switch
                        adapter.log.debug('updating Switch '+ device.name); 
                        adapter.log.debug('DECT200_'+ device.identifier + ' : '  +'name : ' + device.name);
                        adapter.setState('DECT200_'+ device.identifier +'.name', {val: device.name, ack: true});
                                           
                        adapter.log.debug('DECT200_'+ device.identifier+ ' : ' +'present : ' + device.present);
                        adapter.setState('DECT200_'+ device.identifier +'.present', {val: device.present, ack: true});
            
                        adapter.log.debug('DECT200_'+ device.identifier + ' : '  +'state :' + device.switch.state);
                        adapter.setState('DECT200_'+ device.identifier +'.state', {val: device.switch.state, ack: true});
            
                        adapter.log.debug('DECT200_'+ device.identifier + ' : '  +'power :' + parseFloat(device.powermeter.power)/1000);
                        adapter.setState('DECT200_'+ device.identifier +'.power', {val: parseFloat(device.powermeter.power)/1000, ack: true});
            
                        adapter.log.debug('DECT200_'+ device.identifier + ' : '  +'energy :' + device.powermeter.energy);
                        adapter.setState('DECT200_'+ device.identifier +'.energy', {val: device.powermeter.energy, ack: true});  
                        
                        adapter.log.debug('DECT200_'+ device.identifier + ' : '  +'mode : ' + device.switch.mode);
                        adapter.setState('DECT200_'+ device.identifier +'.mode', {val: device.switch.mode, ack: true});
                        
                        adapter.log.debug('DECT200_'+ device.identifier + ' : '  +'lock : ' + device.switch.lock);
                        adapter.setState('DECT200_'+ device.identifier +'.lock', {val: device.switch.lock, ack: true});
    
                        adapter.log.debug('DECT200_'+ device.identifier + ' : '  +'devicelock : ' + device.switch.devicelock);
                        adapter.setState('DECT200_'+ device.identifier +'.devicelock', {val: device.switch.devicelock, ack: true});
                        
                        if(device.temperature.celsius){ 
                            adapter.log.debug('DECT200_'+ device.identifier + ' : '  +'temp : ' + parseFloat(device.temperature.celsius)/10);
                            adapter.setState('DECT200_'+ device.identifier +'.temp', {val: parseFloat(device.temperature.celsius)/10, ack: true});
                        }
                        
                        if(device.powermeter.voltage){
                        //if( adapter.config.dect200volt_en === 'true' || adapter.config.dect200volt_en  === true || adapter.config.dect200volt_en  === 1 ) { 
                            adapter.log.debug('DECT200_'+ device.identifier + ' : ' +'voltage : ' + device.powermeter.voltage / 1000);
                            adapter.setState('DECT200_'+ device.identifier +'.voltage', {val: device.powermeter.voltage / 1000, ack: true});
                        }  
                    }
                    else if((device.functionbitmask & 64) == 64){ //thermostat
                        adapter.log.debug('updating Thermostat '+ device.name); 
                        adapter.log.debug('Comet_'+ device.identifier.replace(/\s/g, '') + ' : '  +'name : ' + device.name);
                        adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.name', {val: device.name, ack: true});
    
                        adapter.log.debug('Comet_'+ device.identifier.replace(/\s/g, '') + ' : ' +'present : ' + device.present);
                        adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.present', {val: device.present, ack: true});
    
                        adapter.log.debug('Comet_'+ device.identifier.replace(/\s/g, '') + ': '  +'temp :' + parseFloat(device.temperature.celsius)/10);
                        adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.temp', {val: parseFloat(device.temperature.celsius)/10, ack: true});
    
                        var targettemp = device.hkr.tsoll;
            
                        if (targettemp < 57){ // die Abfrage auf <57 brauchen wir wahrscheinlich nicht
                            adapter.log.debug('Comet_'+ device.identifier.replace(/\s/g, '') + ' : '  +'targettemp :' + targettemp);
                            adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.targettemp', {val: parseFloat(targettemp)/2, ack: true});
                            adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.lasttarget', {val: parseFloat(targettemp)/2, ack: true}); // zum Nachführen der Soll-Temperatur wenn außerhalb von iobroker gesetzt
                            adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.mode', {val: 0, ack: true});
                        } else
                        if (targettemp == 253){
                            adapter.log.debug('Comet_'+ device.identifier.replace(/\s/g, '') + ' : '  +'mode: Closed');
                            // adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.targettemp', {val: 7, ack: true}); // zum setzen der Temperatur außerhalb der Anzeige?
                            adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.mode', {val: 1, ack: true});
                        } else
                        if (targettemp == 254){
                            adapter.log.debug('Comet_'+ device.identifier.replace(/\s/g, '') + ' : '  +'mode : Opened');
                            // adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.targettemp', {val: 29, ack: true}); // zum setzen der Temperatur außerhalb der Anzeige?
                            adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.mode', {val: 2, ack: true});
                        }
            
                        adapter.log.debug('Comet_'+ device.identifier.replace(/\s/g, '') + ' : '  +'comfytemp :' + device.hkr.komfort);
                        adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.comfytemp', {val: parseFloat(device.hkr.komfort)/2, ack: true});
            
                        adapter.log.debug('Comet_'+ device.identifier.replace(/\s/g, '') + ' : '  +'nighttemp :' + device.hkr.absenk);
                        adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.nighttemp', {val: parseFloat(device.hkr.absenk)/2, ack: true});
    
                        adapter.log.debug('Comet_'+ device.identifier.replace(/\s/g, '') + ' : '  +'battery :' + device.hkr.batterylow);
                        adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.battery', {val: device.hkr.batterylow, ack: true});
    
                        adapter.log.debug('Comet_'+ device.identifier.replace(/\s/g, '') + ' : '  +'errorcode :' + device.hkr.errorcode);
                        adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.errorcode', {val: device.hkr.errorcode, ack: true});
    
                        adapter.log.debug('Comet_'+ device.identifier.replace(/\s/g, '') + ' : '  +'lock :' + device.hkr.lock);
                        adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.lock', {val: device.hkr.lock, ack: true});
    
                        adapter.log.debug('Comet_'+ device.identifier.replace(/\s/g, '') + ' : '  +'devicelock :' + device.hkr.devicelock);
                        adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.devicelock', {val: device.hkr.devicelock, ack: true});
    
                        if(device.hkr.battery){        
                            adapter.log.debug('Comet_'+ device.identifier.replace(/\s/g, '') + ' : '  +'battery :' + device.hkr.battery);
                            adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.battery', {val: device.hkr.battery, ack: true});
                        }
                        else {
                        //getBatteryCharge
                        }
                        if(device.hkr.summeractive){
                            adapter.log.debug('Comet_'+ device.identifier.replace(/\s/g, '') + ' : ' +'voltage : ' + device.hkr.summeractive);
                            adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.voltage', {val: device.hkr.summeractive, ack: true});
                        }
                        if(device.hkr.holidayactive){
                            adapter.log.debug('Comet_'+ device.identifier.replace(/\s/g, '') + ' : ' +'voltage : ' + device.hkr.holidayactive);
                            adapter.setState('Comet_'+ device.identifier.replace(/\s/g, '') +'.voltage', {val: device.hkr.holidayactive, ack: true});
                        } 
                    }
                    else{
                        adapter.log.debug('nix vorbereitet für diese Art von device update');
                    }
                });
            }
        })
        .catch(errorHandler);
    }

    function updateGroups(){
        fritz.getDeviceListInfos().then(function(devicelistinfos) {
            var groups = parser.xml2json(devicelistinfos);
            groups = [].concat((groups.devicelist || {}).group || []).map(function(group) {
                // remove spaces in AINs
                group.identifier = group.identifier.replace(/\s/g, '');
                return group;
            });
            adapter.log.debug("groups\n");
            adapter.log.debug(JSON.stringify(groups));
            if (groups.length){
                adapter.log.debug('update Groups ' + groups.length);
                groups.forEach(function (group){
                    if((group.functionbitmask & 512) == 512){ //switch
                        adapter.log.debug('updating SwitchGroup '+ group.name); 
                        adapter.log.debug('Sgroup_'+ group.identifier + ' : '  +'name : ' + group.name);
                        adapter.setState('Sgroup_'+ group.identifier +'.name', {val: group.name, ack: true});
                                           
                        adapter.log.debug('Sgroup_'+ group.identifier + ' : ' +'present : ' + group.present);
                        adapter.setState('Sgroup_'+ group.identifier +'.present', {val: group.present, ack: true});
            
                        adapter.log.debug('Sgroup_'+ group.identifier + ' : '  +'state :' + group.switch.state);
                        adapter.setState('Sgroup_'+ group.identifier +'.state', {val: group.switch.state, ack: true});
    
                        adapter.log.debug('Sgroup_'+ group.identifier + ' : '  +'mode :' + group.switch.mode);
                        adapter.setState('Sgroup_'+ group.identifier +'.mode', {val: group.switch.mode, ack: true});
    
                        adapter.log.debug('Sgroup_'+ group.identifier + ' : '  +'lock :' + group.switch.lock);
                        adapter.setState('Sgroup_'+ group.identifier +'.lock', {val: group.switch.lock, ack: true});
    
                        adapter.log.debug('Sgroup_'+ group.identifier + ' : '  +'devicelock :' + group.switch.devicelock);
                        adapter.setState('Sgroup_'+ group.identifier +'.devicelock', {val: group.switch.devicelock, ack: true});
            
                        adapter.log.debug('Sgroup_'+ group.identifier + ' : '  +'power :' + parseFloat(group.powermeter.power)/1000);
                        adapter.setState('Sgroup_'+ group.identifier +'.power', {val: parseFloat(group.powermeter.power)/1000, ack: true});
            
                        adapter.log.debug('Sgroup_'+ group.identifier + ' : '  +'energy :' + group.powermeter.energy);
                        adapter.setState('Sgroup_'+ group.identifier +'.energy', {val: group.powermeter.energy, ack: true});  
                    }
                    else if((group.functionbitmask & 64) == 64){ //thermostat
                        adapter.log.debug('updating HeaterGroup '+ group.name); 
                        adapter.log.debug('Hgroup_'+ group.identifier.replace(/\s/g, '') + ' : '  +'name : ' + group.name);
                        adapter.setState('Hgroup_'+ group.identifier.replace(/\s/g, '') +'.name', {val: group.name, ack: true});
    
                        adapter.log.debug('Hgroup_'+ group.identifier.replace(/\s/g, '') + ' : ' +'present : ' + group.present);
                        adapter.setState('Hgroup_'+ group.identifier.replace(/\s/g, '') +'.present', {val: group.present, ack: true});
    
                        adapter.log.debug('Hgroup_'+ group.identifier.replace(/\s/g, '') + ': '  +'temp :' + parsefloat(group.hkr.tist)/2);
                        adapter.setState('Hgroup_'+ group.identifier.replace(/\s/g, '') +'.temp', {val: parsefloat(group.hkr.tist)/2, ack: true});
    
                        var targettemp = group.hkr.tsoll;
            
                        if (targettemp < 57){ // die Abfrage auf <57 brauchen wir wahrscheinlich nicht
                            adapter.log.debug('Hgroup_'+ group.identifier.replace(/\s/g, '') + ' : '  +'targettemp :' + targettemp);
                            adapter.setState('Hgroup_'+ group.identifier.replace(/\s/g, '') +'.targettemp', {val: parseFloat(targettemp)/2, ack: true});
                            adapter.setState('Hgroup_'+ group.identifier.replace(/\s/g, '') +'.lasttarget', {val: parseFloat(targettemp)/2, ack: true}); // zum Nachführen der Soll-Temperatur wenn außerhalb von iobroker gesetzt
                            adapter.setState('Hgroup_'+ group.identifier.replace(/\s/g, '') +'.mode', {val: 0, ack: true});
                        } else
                        if (targettemp == '253'){
                            adapter.log.debug('Hgroup_'+ group.identifier.replace(/\s/g, '') + ' : '  +'mode: Closed');
                            // adapter.setState('Hgroup_'+ device.identifier.replace(/\s/g, '') +'.targettemp', {val: 7, ack: true}); // zum setzen der Temperatur außerhalb der Anzeige?
                            adapter.setState('Hgroup_'+ group.identifier.replace(/\s/g, '') +'.mode', {val: 1, ack: true});
                        } else
                        if (targettemp == '254'){
                            adapter.log.debug('Hgroup_'+ group.identifier.replace(/\s/g, '') + ' : '  +'mode : Opened');
                            // adapter.setState('Hgroup_'+ device.identifier.replace(/\s/g, '') +'.targettemp', {val: 29, ack: true}); // zum setzen der Temperatur außerhalb der Anzeige?
                            adapter.setState('Hgroup_'+ group.identifier.replace(/\s/g, '') +'.mode', {val: 2, ack: true});
                        }
            
                        adapter.log.debug('Hgroup_'+ group.identifier.replace(/\s/g, '') + ' : '  +'comfytemp :' + parseFloat(group.hkr.komfort)/2);
                        adapter.setState('Hgroup_'+ group.identifier.replace(/\s/g, '') +'.comfytemp', {val: parseFloat(group.hkr.komfort)/2, ack: true});
            
                        adapter.log.debug('Hgroup_'+ group.identifier.replace(/\s/g, '') + ' : '  +'nighttemp :' + parseFloat(group.hkr.absenk)/2);
                        adapter.setState('Hgroup_'+ group.identifier.replace(/\s/g, '') +'.nighttemp', {val: parseFloat(group.hkr.absenk)/2, ack: true});
    
                        adapter.log.debug('Hgroup_'+ group.identifier.replace(/\s/g, '') + ' : '  +'battery :' + group.hkr.batterylow);
                        adapter.setState('Hgroup_'+ group.identifier.replace(/\s/g, '') +'.battery', {val: group.hkr.batterylow, ack: true});
    
                        adapter.log.debug('Hgroup_'+ group.identifier.replace(/\s/g, '') + ' : '  +'errorcode :' + group.hkr.errorcode);
                        adapter.setState('Hgroup_'+ group.identifier.replace(/\s/g, '') +'.errorcode', {val: group.hkr.errorcode, ack: true});
    
                        adapter.log.debug('Hgroup_'+ group.identifier.replace(/\s/g, '') + ' : '  +'lock :' + group.hkr.lock);
                        adapter.setState('Hgroup_'+ group.identifier.replace(/\s/g, '') +'.lock', {val: group.hkr.lock, ack: true});
    
                        adapter.log.debug('Hgroup_'+ group.identifier.replace(/\s/g, '') + ' : '  +'devicelock :' + group.hkr.devicelock);
                        adapter.setState('Hgroup_'+ group.identifier.replace(/\s/g, '') +'.devicelock', {val: group.hkr.devicelock, ack: true});
                    }
                    else{
                        adapter.log.debug('nix vorbereitet für diese Art von group update');
                    }
                });
            }
        })
        .catch(errorHandler);
    }

    function pollFritzData() {
        var fritz_interval = parseInt(adapter.config.fritz_interval,10) || 300;
        updateDevices(); // für alle Objekte, da in xml/json mehr enthalten als in API-Aufrufe
        updateGroups();
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


    logVersion();
    createDevices();
    createGroups();
    pollFritzData();

    // in this template all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');

}
