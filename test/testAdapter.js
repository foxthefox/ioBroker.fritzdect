/* jshint -W097 */// jshint strict:false
/*jslint node: true */
var expect = require('chai').expect;
var setup  = require(__dirname + '/lib/setup');
var http = require('http');
var fs = require('fs');
const { parse } = require('querystring');

var objects = null;
var states  = null;
var onStateChanged = null;
var onObjectChanged = null;
var sendToID = 1;

var adapterShortName = setup.adapterName.substring(setup.adapterName.indexOf('.')+1);

function decrypt(key, value) {
  var result = '';
  for(var i = 0; i < value.length; ++i) {
      result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
  }
  return result;
}
function encrypt(key, value) {
  var result = '';
  for(var i = 0; i < value.length; ++i) {
      result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
  }
  return result;
}

function checkConnectionOfAdapter(cb, counter) {
    counter = counter || 0;
    console.log('Try check #' + counter);
    if (counter > 30) {
        if (cb) cb('Cannot check connection');
        return;
    }

    states.getState('system.adapter.' + adapterShortName + '.0.alive', function (err, state) {
        if (err) console.error(err);
        if (state && state.val) {
            if (cb) cb();
        } else {
            setTimeout(function () {
                checkConnectionOfAdapter(cb, counter + 1);
            }, 1000);
        }
    });
}

function checkValueOfState(id, value, cb, counter) {
    counter = counter || 0;
    if (counter > 20) {
        if (cb) cb('Cannot check value Of State ' + id);
        return;
    }

    states.getState(id, function (err, state) {
        if (err) console.error(err);
        if (value === null && !state) {
            if (cb) cb();
        } else
        if (state && (value === undefined || state.val === value)) {
            if (cb) cb();
        } else {
            setTimeout(function () {
                checkValueOfState(id, value, cb, counter + 1);
            }, 500);
        }
    });
}

function sendTo(target, command, message, callback) {
    onStateChanged = function (id, state) {
        if (id === 'messagebox.system.adapter.test.0') {
            callback(state.message);
        }
    };

    states.pushMessage('system.adapter.' + target, {
        command:    command,
        message:    message,
        from:       'system.adapter.test.0',
        callback: {
            message: message,
            id:      sendToID++,
            ack:     false,
            time:    (new Date()).getTime()
        }
    });
}

//fritzbox mit http Server Emulieren
var server;

function setupHttpServer(callback) {
    //We need a function which handles requests and send response
    //Create a server
    server = http.createServer(handleHttpRequest);
    //Lets start our server
    server.listen(8080, function() {
        //Callback triggered when server is successfully listening. Hurray!
        console.log("HTTP-Server listening on: http://localhost:%s", 8080);
        callback();
    });
}

//Antworten der fritzbox Gerätes

var secret='Zgfr56gFe87jJOM';
var challenge = (4294967295 + Math.floor(Math.random()*4294967295)).toString(16).slice(-8);
var challenge2 = (4294967295 + Math.floor(Math.random()*4294967295)).toString(16).slice(-8);
var password = 'password';
var challengeResponse = challenge +'-'+require('crypto').createHash('md5').update(Buffer(challenge+'-'+password, 'UTF-16LE')).digest('hex');
var sid = (4294967295 + Math.floor(Math.random()*4294967295)).toString(16).slice(-8)+(4294967295 + Math.floor(Math.random()*4294967295)).toString(16).slice(-8);

//xml Antworten
var content     = fs.readFileSync(__dirname + '/../test/test_api_response.xml'); //getdevicelistinfos
var templates   = fs.readFileSync(__dirname + '/../test/template_answer.xml'); //gettemplate
var temp_stats  = fs.readFileSync(__dirname + '/../test/devicestat_temp_answer.xml'); //getbasicdevicestats temp
var power_stats = fs.readFileSync(__dirname + '/../test/devicestat_power_answer.xml'); //getbasicdevicestats power/voltage
var hkr_batt    = fs.readFileSync(__dirname + '/../test/hkr_response.xml'); // Anteil der Webseite für BatteriesLadung
var guestWlan   = fs.readFileSync(__dirname + '/../test/guest_wlan_form.xml'); // Anteil der Webseite für GästeWLAN

function handleHttpRequest(request, response) {
    console.log('HTTP-Server: Request: ' + request.method + ' ' + request.url);

    if (request.url == '/login_sid.lua') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/xml' });
        response.write('<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>0000000000000000</SID><Challenge>'+challenge+'</Challenge><BlockTime>0</BlockTime><Rights></Rights></SessionInfo>');
        response.end(); 
    }
    
    else if (request.url == '/login_sid.lua?username=admin') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/xml' });
        response.write('<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>0000000000000000</SID><Challenge>'+challenge+'</Challenge><BlockTime>0</BlockTime><Rights></Rights></SessionInfo>');
        response.end(); 
    }

    else if (request.url == '/login_sid.lua?username=admin&response='+challengeResponse) { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/xml' });
        response.write('<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>'+sid+'</SID><Challenge>'+challenge2+'</Challenge><BlockTime>0</BlockTime><Rights><Name>Dial</Name><Access>2</Access><Name>App</Name><Access>2</Access><Name>HomeAuto</Name><Access>2</Access><Name>BoxAdmin</Name><Access>2</Access><Name>Phone</Name><Access>2</Access><Name>NAS</Name><Access>2</Access></Rights></SessionInfo>');
        response.end(); 
    }
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=getswitchlist') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify([ '087610006161', '34:31:C1:AB:68:53', 'EF:C4:CC-900' ]));
        response.end(); 
    }   
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=getdevicelistinfos') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write( String(content) );
        response.end(); 
    }
      else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=gettemplatelistinfos') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write( String(templates) );
        response.end(); 
    }
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&ain=119600642220&switchcmd=getbasicdevicestats') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write( String(temp_stats) );   
        response.end(); 
    }
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&ain=087610006161&switchcmd=getbasicdevicestats') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write( String(power_stats) );   
        response.end(); 
    }
      else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=getswitchstate&ain=087610006102') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify([ '1' ]));
        response.end(); 
    }
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=gettemperature&ain=087610006102') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify([ '240' ]));
        response.end(); 
    }
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=gettemperature&ain=117951022222') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify([ '220' ]));
        response.end(); 
    }
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=getswitchpower&ain=087610006102') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify([ '1234' ]));
        response.end(); 
    }
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=getswitchenergy&ain=087610006102') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify([ '128308' ]));
        response.end(); 
    }
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=getswitchpresent&ain=087610006102') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify([ '1' ]));
        response.end(); 
    }
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=getswitchname&ain=087610006102') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify([ 'FRITZ!DECT 200 #1' ]));
        response.end(); 
    }
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=gethkrtsoll&ain=117951022222') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify([ '44' ]));
        response.end(); 
    }
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=gethkrabsenk&ain=117951022222') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify([ '253' ]));
        response.end(); 
    }
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=gethkrkomfort&ain=117951022222') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify([ '48' ]));
        response.end(); 
    }
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=setswitchoff&ain=087610006102') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify([ '0' ]));
        response.end(); 
    }
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=setswitchon&ain=087610006102') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify([ '1' ]));
        response.end(); 
    }
    //wie auf egal welche temp reagieren? regex?
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=sethkrtsoll&param=36&ain=117951022222') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify([ '36' ]));
        response.end(); 
    }
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=applytemplate&ain=tmp6F0093-391363146') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify([ '601' ]));
        response.end(); 
    }
    else if (request.url == '/wlan/guest_access.lua?0=0&sid='+sid) { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write(String(guestWlan));
        response.end(); 
    }
    else if (request.url == '/data.lua'  && request.method === 'POST') { //check the URL of the current request
        let body = '';
        request.on('data', chunk => {
            body += chunk.toString(); // convert Buffer to string
        });
        request.on('end', () => {
            form = parse(body)
            if(form.sid === sid && form.xhr === '1' && form.page === 'overview'){
                response.writeHead(200, { 'Content-Type': 'application/xml' });
                response.write(JSON.stringify(
                    {
                        "data": {
                            "naslink": "nas",
                            "SERVICEPORTAL_URL": "https:\/\/www.avm.de\/fritzbox-service-portal.php?hardware=156&oem=avm&language=de&country=049&version=84.06.85&subversion=",
                            "fritzos": {
                                "Productname": "FRITZ!Box Fon WLAN 7390",
                                "NoPwd": false,
                                "ShowDefaults": false,
                                "expert_mode": "1",
                                "nspver_lnk": "\/home\/pp_fbos.lua?sid="+sid,
                                "nspver": "06.85",
                                "isLabor": false,
                                "FirmwareSigned": false,
                                "fb_name": "",
                                "isUpdateAvail": false,
                                "energy": "40",
                                "boxDate": "13:22:00 09.12.2018"
                            }
                        }}
                ));
                response.end(); 
            }
            else if(form.sid === sid && form.xhr === '1' && form.device === '20' && form.oldpage === '/net/home_auto_hkr_edit.lua' &&  form.back_to_page === '/net/network.lua'){
                response.writeHead(200, { 'Content-Type': 'application/xml' });
                response.write(String(hkr_batt));
                response.end(); 
            }
        });
    }
    else {
        console.log(' not supported call ' + request.url);
        response.statusCode = 403;
        response.end();
    }    
}

describe('Test ' + adapterShortName + ' adapter', function() {
    before('Test ' + adapterShortName + ' adapter: Start js-controller', function (_done) {
        this.timeout(600000); // because of first install from npm

        setup.setupController(systemConfig => {
            var config = setup.getAdapterConfig();
            // enable adapter
            config.common.enabled  = true;
            config.common.loglevel = 'info';
            //config.native.dbtype   = 'sqlite';
   
            config.native = {"fritz_ip": "http://localhost:8080", 
                             "fritz_user": "admin", 
                             "fritz_pw": encrypt(systemConfig.native.secret, 'password'), 
                             "fritz_interval": "300", 
                             "GuestWLANactive": false, 
                             "NonNativeApi": true 
                            };

            setup.setAdapterConfig(config.common, config.native);

            setupHttpServer(function() {
                setup.startController(true, function(id, obj) {}, function (id, state) {
                        if (onStateChanged) onStateChanged(id, state);
                    },
                    function (_objects, _states) {
                        objects = _objects;
                        states  = _states;
                        _done();
                    });
            });
            
        });
    });

/*
    ENABLE THIS WHEN ADAPTER RUNS IN DEAMON MODE TO CHECK THAT IT HAS STARTED SUCCESSFULLY
*/
    it('Test ' + adapterShortName + ' adapter: Check if adapter started', function (done) {
        this.timeout(60000);
        checkConnectionOfAdapter(function (res) {
            if (res) console.log(res);
            expect(res).not.to.be.equal('Cannot check connection');
            objects.setObject('system.adapter.test.0', {
                    common: {

                    },
                    type: 'instance'
                },
                function () {
                    states.subscribeMessage('system.adapter.test.0');
                    done();
                });
        });
    });
/**/

/*
    PUT YOUR OWN TESTS HERE USING
    it('Testname', function ( done) {
        ...
    });
    You can also use "sendTo" method to send messages to the started adapter
*/
    // anfang von eigenen Tests
    it('Test ' + adapterShortName + ' adapter: Check values of switch', function (done) {
        this.timeout(30000);
        setTimeout(function() {
            states.getState('fritzdect.0.DECT200_087610006161.prodname', function (err, state) {
                if (err) console.error(err);
                expect(state).to.exist;
                if (!state) {
                    console.error('state "fritzdect.0.DECT200_087610006161.prodname" not set');
                }
                else {
                    console.log('fritzdect.0.DECT200_087610006161.prodname      ... ' + state.val);
                }
                expect(state.val).to.exist;
                expect(state.val).to.be.equal('FRITZ!DECT 200');
                states.getState('fritzdect.0.DECT200_087610006161.manufacturer', function (err, state) {
                    if (err) console.error(err);
                    expect(state).to.exist;
                    if (!state) {
                        console.error('state "fritzdect.0.DECT200_087610006161.manufacturer" not set');
                    }
                    else {
                        console.log('fritzdect.0.DECT200_087610006161.manufacturer  ... ' + state.val);
                    }
                    expect(state.val).to.exist;
                    expect(state.val).to.be.equal('AVM');
                    states.getState('fritzdect.0.DECT200_087610006161.fwversion', function (err, state) {
                        if (err) console.error(err);
                        expect(state).to.exist;
                        if (!state) {
                            console.error('state "fritzdect.0.DECT200_087610006161.fwversion" not set');
                        }
                        else {
                            console.log('fritzdect.0.DECT200_087610006161.fwversion     ... ' + state.val);
                        }
                        expect(state.val).to.exist;
                        expect(state.val).to.be.equal('03.87');
                        states.getState('fritzdect.0.DECT200_087610006161.id', function (err, state) {
                            if (err) console.error(err);
                            expect(state).to.exist;
                            if (!state) {
                                console.error('state "fritzdect.0.DECT200_087610006161.id" not set');
                            }
                            else {
                                console.log('fritzdect.0.DECT200_087610006161.id            ... ' + state.val);
                            }
                            expect(state.val).to.exist;
                            expect(state.val).to.be.equal('16');
                            states.getState('fritzdect.0.DECT200_087610006161.name', function (err, state) {
                                if (err) console.error(err);
                                expect(state).to.exist;
                                if (!state) {
                                    console.error('state "fritzdect.0.DECT200_087610006161.name" not set');
                                }
                                else {
                                    console.log('fritzdect.0.DECT200_087610006161.name          ... ' + state.val);
                                }
                                expect(state.val).to.exist;
                                expect(state.val).to.be.equal('FRITZ!DECT 200 #1');
                                states.getState('fritzdect.0.DECT200_087610006161.state', function (err, state) {
                                    if (err) console.error(err);
                                    expect(state).to.exist;
                                    if (!state) {
                                        console.error('state "fritzdect.0.DECT200_087610006161.state" not set');
                                    }
                                    else {
                                        console.log('fritzdect.0.DECT200_087610006161.state         ... ' + state.val);
                                    }
                                    expect(state.val).to.exist;
                                    expect(state.val).to.be.equal(true);
                                    states.getState('fritzdect.0.DECT200_087610006161.temp', function (err, state) {
                                        if (err) console.error(err);
                                        expect(state).to.exist;
                                        if (!state) {
                                            console.error('state "fritzdect.0.DECT200_087610006161.temp" not set');
                                        }
                                        else {
                                            console.log('fritzdect.0.DECT200_087610006161.temp          ... ' + state.val);
                                        }
                                        expect(state.val).to.exist;
                                        expect(state.val).to.be.equal(22.5);
                                        states.getState('fritzdect.0.DECT200_087610006161.voltage', function (err, state) {
                                            if (err) console.error(err);
                                            expect(state).to.exist;
                                            if (!state) {
                                                console.error('state "fritzdect.0.DECT200_087610006161.voltage" not set');
                                            }
                                            else {
                                                console.log('fritzdect.0.DECT200_087610006161.voltage       ... ' + state.val);
                                            }
                                            expect(state.val).to.exist;
                                            expect(state.val).to.be.equal(224.645);
                                            states.getState('fritzdect.0.DECT200_087610006161.power', function (err, state) {
                                                if (err) console.error(err);
                                                expect(state).to.exist;
                                                if (!state) {
                                                    console.error('state "fritzdect.0.DECT200_087610006161.power" not set');
                                                }
                                                else {
                                                    console.log('fritzdect.0.DECT200_087610006161.power         ... ' + state.val);
                                                }
                                                expect(state.val).to.exist;
                                                expect(state.val).to.be.equal(0);
                                                states.getState('fritzdect.0.DECT200_087610006161.energy', function (err, state) {
                                                    if (err) console.error(err);
                                                    expect(state).to.exist;
                                                    if (!state) {
                                                        console.error('state "fritzdect.0.DECT200_087610006161.energy" not set');
                                                    }
                                                    else {
                                                        console.log('fritzdect.0.DECT200_087610006161.energy        ... ' + state.val);
                                                        expect(state.val).to.exist;
                                                        expect(state.val).to.be.equal('104560');
                                                        done();
                                                    }
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        }, 1000);
    });
    it('Test ' + adapterShortName + ' adapter: Check values of Comet', function (done) {
        this.timeout(30000);
        setTimeout(function() {
            states.getState('fritzdect.0.Comet_117951022222.prodname', function (err, state) {
                if (err) console.error(err);
                expect(state).to.exist;
                if (!state) {
                    console.error('state "fritzdect.0.Comet_117951022222.prodname" not set');
                }
                else {
                    console.log('fritzdect.0.Comet_117951022222.prodname        ... ' + state.val);
                }
                expect(state.val).to.exist;
                expect(state.val).to.be.equal('Comet DECT');
                states.getState('fritzdect.0.Comet_117951022222.manufacturer', function (err, state) {
                    if (err) console.error(err);
                    expect(state).to.exist;
                    if (!state) {
                        console.error('state "fritzdect.0.Comet_117951022222.manufacturer" not set');
                    }
                    else {
                        console.log('fritzdect.0.Comet_117951022222.manufacturer    ... ' + state.val);
                    }
                    expect(state.val).to.exist;
                    expect(state.val).to.be.equal('AVM');
                    states.getState('fritzdect.0.Comet_117951022222.fwversion', function (err, state) {
                        if (err) console.error(err);
                        expect(state).to.exist;
                        if (!state) {
                            console.error('state "fritzdect.0.Comet_117951022222.fwversion" not set');
                        }
                        else {
                            console.log('fritzdect.0.Comet_117951022222.fwversion       ... ' + state.val);
                        }
                        expect(state.val).to.exist;
                        expect(state.val).to.be.equal('03.54');
                        states.getState('fritzdect.0.Comet_117951022222.id', function (err, state) {
                            if (err) console.error(err);
                            expect(state).to.exist;
                            if (!state) {
                                console.error('state "fritzdect.0.Comet_117951022222.id" not set');
                            }
                            else {
                                console.log('fritzdect.0.Comet_117951022222.id              ... ' + state.val);
                            }
                            expect(state.val).to.exist;
                            expect(state.val).to.be.equal('20');
                            states.getState('fritzdect.0.Comet_117951022222.devicelock', function (err, state) {
                                if (err) console.error(err);
                                expect(state).to.exist;
                                if (!state) {
                                    console.error('state "fritzdect.0.Comet_117951022222.devicelock" not set');
                                }
                                else {
                                    console.log('fritzdect.0.Comet_117951022222.devicelock        ... ' + state.val);
                                }
                                expect(state.val).to.exist;
                                expect(state.val).to.be.equal(true);
                                states.getState('fritzdect.0.Comet_117951022222.present', function (err, state) {
                                    if (err) console.error(err);
                                    expect(state).to.exist;
                                    if (!state) {
                                        console.error('state "fritzdect.0.Comet_117951022222.present" not set');
                                    }
                                    else {
                                        console.log('fritzdect.0.Comet_117951022222.present         ... ' + state.val);
                                    }
                                    expect(state.val).to.exist;
                                    expect(state.val).to.be.equal(true);
                                    states.getState('fritzdect.0.Comet_117951022222.lock', function (err, state) {
                                        if (err) console.error(err);
                                        expect(state).to.exist;
                                        if (!state) {
                                            console.error('state "fritzdect.0.Comet_117951022222.lock" not set');
                                        }
                                        else {
                                            console.log('fritzdect.0.Comet_117951022222.lock            ... ' + state.val);
                                        }
                                        expect(state.val).to.exist;
                                        expect(state.val).to.be.equal(false);
                                        states.getState('fritzdect.0.Comet_117951022222.comfytemp', function (err, state) {
                                            if (err) console.error(err);
                                            expect(state).to.exist;
                                            if (!state) {
                                                console.error('state "fritzdect.0.Comet_117951022222.comfytemp" not set');
                                            }
                                            else {
                                                console.log('fritzdect.0.Comet_117951022222.comfytemp        ... ' + state.val);
                                            }
                                            expect(state.val).to.exist;
                                            expect(state.val).to.be.equal(19);
                                            states.getState('fritzdect.0.Comet_117951022222.nighttemp', function (err, state) {
                                                if (err) console.error(err);
                                                expect(state).to.exist;
                                                if (!state) {
                                                    console.error('state "fritzdect.0.Comet_117951022222.temp" not set');
                                                }
                                                else {
                                                    console.log('fritzdect.0.Comet_117951022222.nightemp        ... ' + state.val);
                                                }
                                                expect(state.val).to.exist;
                                                expect(state.val).to.be.equal(15);
                                                states.getState('fritzdect.0.Comet_117951022222.actualtemp', function (err, state) {
                                                    if (err) console.error(err);
                                                    expect(state).to.exist;
                                                    if (!state) {
                                                        console.error('state "fritzdect.0.Comet_117951022222.actualtemp" not set');
                                                    }
                                                    else {
                                                        console.log('fritzdect.0.Comet_117951022222.actualtemp        ... ' + state.val);
                                                    }
                                                    expect(state.val).to.exist;
                                                    expect(state.val).to.be.equal(20);
                                                    states.getState('fritzdect.0.Comet_117951022222.temp', function (err, state) {
                                                        if (err) console.error(err);
                                                        expect(state).to.exist;
                                                        if (!state) {
                                                            console.error('state "fritzdect.0.Comet_117951022222.temp" not set');
                                                        }
                                                        else {
                                                            console.log('fritzdect.0.Comet_117951022222.temp            ... ' + state.val);
                                                        }
                                                        expect(state.val).to.exist;
                                                        expect(state.val).to.be.equal(20);
                                                        states.getState('fritzdect.0.Comet_117951022222.battery', function (err, state) {
                                                            if (err) console.error(err);
                                                            expect(state).to.exist;
                                                            if (!state) {
                                                                console.error('state "fritzdect.0.Comet_117951022222.battery" not set');
                                                            }
                                                            else {
                                                                console.log('fritzdect.0.Comet_117951022222.battery          ... ' + state.val);
                                                                expect(state.val).to.exist;
                                                                expect(state.val).to.be.equal(80);
                                                                done();
                                                            }
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        }, 1000);
    });
    it('Test ' + adapterShortName + ' adapter: Check values of Comet wo battcharge', function (done) {
        this.timeout(30000);
        setTimeout(function() {
            states.getState('fritzdect.0.Comet_119600642220.prodname', function (err, state) {
                if (err) console.error(err);
                expect(state).to.exist;
                if (!state) {
                    console.error('state "fritzdect.0.Comet_119600642220.prodname" not set');
                }
                else {
                    console.log('fritzdect.0.Comet_119600642220.prodname        ... ' + state.val);
                }
                expect(state.val).to.exist;
                expect(state.val).to.be.equal('Comet DECT');
                states.getState('fritzdect.0.Comet_119600642220.manufacturer', function (err, state) {
                    if (err) console.error(err);
                    expect(state).to.exist;
                    if (!state) {
                        console.error('state "fritzdect.0.Comet_119600642220.manufacturer" not set');
                    }
                    else {
                        console.log('fritzdect.0.Comet_119600642220.manufacturer    ... ' + state.val);
                    }
                    expect(state.val).to.exist;
                    expect(state.val).to.be.equal('AVM');
                    states.getState('fritzdect.0.Comet_119600642220.fwversion', function (err, state) {
                        if (err) console.error(err);
                        expect(state).to.exist;
                        if (!state) {
                            console.error('state "fritzdect.0.Comet_119600642220.fwversion" not set');
                        }
                        else {
                            console.log('fritzdect.0.Comet_119600642220.fwversion       ... ' + state.val);
                        }
                        expect(state.val).to.exist;
                        expect(state.val).to.be.equal('03.54');
                        states.getState('fritzdect.0.Comet_119600642220.id', function (err, state) {
                            if (err) console.error(err);
                            expect(state).to.exist;
                            if (!state) {
                                console.error('state "fritzdect.0.Comet_119600642220.id" not set');
                            }
                            else {
                                console.log('fritzdect.0.Comet_119600642220.id              ... ' + state.val);
                            }
                            expect(state.val).to.exist;
                            expect(state.val).to.be.equal('17');
                            states.getState('fritzdect.0.Comet_119600642220.devicelock', function (err, state) {
                                if (err) console.error(err);
                                expect(state).to.exist;
                                if (!state) {
                                    console.error('state "fritzdect.0.Comet_119600642220.devicelock" not set');
                                }
                                else {
                                    console.log('fritzdect.0.Comet_119600642220.devicelock      ... ' + state.val);
                                }
                                expect(state.val).to.exist;
                                expect(state.val).to.be.equal(false);
                                states.getState('fritzdect.0.Comet_119600642220.present', function (err, state) {
                                    if (err) console.error(err);
                                    expect(state).to.exist;
                                    if (!state) {
                                        console.error('state "fritzdect.0.Comet_119600642220.present" not set');
                                    }
                                    else {
                                        console.log('fritzdect.0.Comet_119600642220.present          ... ' + state.val);
                                    }
                                    expect(state.val).to.exist;
                                    expect(state.val).to.be.equal(true);
                                    states.getState('fritzdect.0.Comet_119600642220.lock', function (err, state) {
                                        if (err) console.error(err);
                                        expect(state).to.exist;
                                        if (!state) {
                                            console.error('state "fritzdect.0.Comet_119600642220.lock" not set');
                                        }
                                        else {
                                            console.log('fritzdect.0.Comet_119600642220.lock            ... ' + state.val);
                                        }
                                        expect(state.val).to.exist;
                                        expect(state.val).to.be.equal(false);
                                        states.getState('fritzdect.0.Comet_119600642220.comfytemp', function (err, state) {
                                            if (err) console.error(err);
                                            expect(state).to.exist;
                                            if (!state) {
                                                console.error('state "fritzdect.0.Comet_119600642220.comfytemp" not set');
                                            }
                                            else {
                                                console.log('fritzdect.0.Comet_119600642220.comfytemp        ... ' + state.val);
                                            }
                                            expect(state.val).to.exist;
                                            expect(state.val).to.be.equal(21);
                                            states.getState('fritzdect.0.Comet_119600642220.nighttemp', function (err, state) {
                                                if (err) console.error(err);
                                                expect(state).to.exist;
                                                if (!state) {
                                                    console.error('state "fritzdect.0.Comet_119600642220.temp" not set');
                                                }
                                                else {
                                                    console.log('fritzdect.0.Comet_119600642220.nightemp        ... ' + state.val);
                                                }
                                                expect(state.val).to.exist;
                                                expect(state.val).to.be.equal(16);
                                                states.getState('fritzdect.0.Comet_119600642220.actualtemp', function (err, state) {
                                                    if (err) console.error(err);
                                                    expect(state).to.exist;
                                                    if (!state) {
                                                        console.error('state "fritzdect.0.Comet_119600642220.actualtemp" not set');
                                                    }
                                                    else {
                                                        console.log('fritzdect.0.Comet_119600642220.actualtemp        ... ' + state.val);
                                                    }
                                                    expect(state.val).to.exist;
                                                    expect(state.val).to.be.equal(20);
                                                    states.getState('fritzdect.0.Comet_119600642220.temp', function (err, state) {
                                                        if (err) console.error(err);
                                                        expect(state).to.exist;
                                                        if (!state) {
                                                            console.error('state "fritzdect.0.Comet_119600642220.temp" not set');
                                                        }
                                                        else {
                                                            console.log('fritzdect.0.Comet_119600642220.temp                ... ' + state.val);
                                                            expect(state.val).to.exist;
                                                            expect(state.val).to.be.equal(20);
                                                            done();
                                                        }
                                                        /* für später, wenn der batteryaufruf schon beim init kommt
                                                        states.getState('fritzdect.0.Comet_119600642220.battery', function (err, state) {
                                                            if (err) console.error(err);
                                                            expect(state).to.exist;
                                                            if (!state) {
                                                                console.error('state "fritzdect.0.Comet_119600642220.battery" not set');
                                                            }
                                                            else {
                                                                console.log('fritzdect.0.Comet_119600642220.battery             ... ' + state.val);
                                                                expect(state.val).to.exist;
                                                                expect(state.val).to.be.equal('55');
                                                                done();
                                                            }
                                                        });
                                                        */
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        }, 1000);
    });
    it('Test ' + adapterShortName + ' adapter: Check values of Contact', function (done) {
        this.timeout(30000);
        setTimeout(function() {
            states.getState('fritzdect.0.Contact_112240205290-1.prodname', function (err, state) {
                if (err) console.error(err);
                expect(state).to.exist;
                if (!state) {
                    console.error('state "fritzdect.0.Contact_112240205290-1.prodname" not set');
                }
                else {
                    console.log('fritzdect.0.Contact_112240205290-1.prodname    ... ' + state.val);
                }
                expect(state.val).to.exist;
                expect(state.val).to.be.equal('HAN-FUN');
                states.getState('fritzdect.0.Contact_112240205290-1.manufacturer', function (err, state) {
                    if (err) console.error(err);
                    expect(state).to.exist;
                    if (!state) {
                        console.error('state "fritzdect.0.Contact_112240205290-1.manufacturer" not set');
                    }
                    else {
                        console.log('fritzdect.0.Contact_112240205290-1.manufacturer    ... ' + state.val);
                    }
                    expect(state.val).to.exist;
                    expect(state.val).to.be.equal('0x2c3c');
                    states.getState('fritzdect.0.Contact_112240205290-1.fwversion', function (err, state) {
                        if (err) console.error(err);
                        expect(state).to.exist;
                        if (!state) {
                            console.error('state "fritzdect.0.Contact_112240205290-1.fwversion" not set');
                        }
                        else {
                            console.log('fritzdect.0.Contact_112240205290-1.fwversion       ... ' + state.val);
                        }
                        expect(state.val).to.exist;
                        expect(state.val).to.be.equal('0.0');
                        states.getState('fritzdect.0.Contact_112240205290-1.id', function (err, state) {
                            if (err) console.error(err);
                            expect(state).to.exist;
                            if (!state) {
                                console.error('state "fritzdect.0.Contact_112240205290-1.id" not set');
                            }
                            else {
                                console.log('fritzdect.0.Contact_112240205290-1.id             ... ' + state.val);
                            }
                            expect(state.val).to.exist;
                            expect(state.val).to.be.equal('2001');
                            states.getState('fritzdect.0.Contact_112240205290-1.name', function (err, state) {
                                if (err) console.error(err);
                                expect(state).to.exist;
                                if (!state) {
                                    console.error('state "fritzdect.0.Contact_112240205290-1.name" not set');
                                }
                                else {
                                    console.log('fritzdect.0.Contact_112240205290-1.name        ... ' + state.val);
                                }
                                expect(state.val).to.exist;
                                expect(state.val).to.be.equal('Fenster');
                                states.getState('fritzdect.0.Contact_112240205290-1.state', function (err, state) {
                                    if (err) console.error(err);
                                    expect(state).to.exist;
                                    if (!state) {
                                        console.error('state "fritzdect.0.Contact_112240205290-1.state" not set');
                                    }
                                    else {
                                        console.log('fritzdect.0.Contact_112240205290-1.state       ... ' + state.val);
                                        expect(state.val).to.exist;
                                        expect(state.val).to.be.equal(false);
                                        done();
                                    }
                                });
                            });
                        });
                    });
                });
            });
        }, 1000);
    });
    it('Test ' + adapterShortName + ' adapter: Check values of Button', function (done) {
        this.timeout(30000);
        setTimeout(function() {
            states.getState('fritzdect.0.Button_119340141058-2.prodname', function (err, state) {
                if (err) console.error(err);
                expect(state).to.exist;
                if (!state) {
                    console.error('state "fritzdect.0.Button_119340141058-2.prodname" not set');
                }
                else {
                    console.log('fritzdect.0.Button_119340141058-2.prodname     ... ' + state.val);
                }
                expect(state.val).to.exist;
                expect(state.val).to.be.equal('HAN-FUN');
                states.getState('fritzdect.0.Button_119340141058-2.manufacturer', function (err, state) {
                    if (err) console.error(err);
                    expect(state).to.exist;
                    if (!state) {
                        console.error('state "fritzdect.0.Button_119340141058-2.manufacturer" not set');
                    }
                    else {
                        console.log('fritzdect.0.Button_119340141058-2.manufacturer ... ' + state.val);
                    }
                    expect(state.val).to.exist;
                    expect(state.val).to.be.equal('0x0feb');
                    states.getState('fritzdect.0.Button_119340141058-2.fwversion', function (err, state) {
                        if (err) console.error(err);
                        expect(state).to.exist;
                        if (!state) {
                            console.error('state "fritzdect.0.Button_119340141058-2.fwversion" not set');
                        }
                        else {
                            console.log('fritzdect.0.Button_119340141058-2.fwversion    ... ' + state.val);
                        }
                        expect(state.val).to.exist;
                        expect(state.val).to.be.equal('0.0');
                        states.getState('fritzdect.0.Button_119340141058-2.id', function (err, state) {
                            if (err) console.error(err);
                            expect(state).to.exist;
                            if (!state) {
                                console.error('state "fritzdect.0.Button_119340141058-2.id" not set');
                            }
                            else {
                                console.log('fritzdect.0.Button_119340141058-2.id           ... ' + state.val);
                            }
                            expect(state.val).to.exist;
                            expect(state.val).to.be.equal('2000');
                            states.getState('fritzdect.0.Button_119340141058-2.name', function (err, state) {
                                if (err) console.error(err);
                                expect(state).to.exist;
                                if (!state) {
                                    console.error('state "fritzdect.0.Button_119340141058-2.name" not set');
                                }
                                else {
                                    console.log('fritzdect.0.Button_119340141058-2.name         ... ' + state.val);
                                }
                                expect(state.val).to.exist;
                                expect(state.val).to.be.equal('DectTaster_F1');
                                states.getState('fritzdect.0.Button_119340141058-2.lastclick', function (err, state) {
                                    if (err) console.error(err);
                                    expect(state).to.exist;
                                    if (!state) {
                                        console.error('state "fritzdect.0.Button_119340141058-2.lastclick" not set');
                                    }
                                    else {
                                        console.log('fritzdect.0.Button_119340141058-2.lastclick  ... ' + state.val);
                                        expect(state.val).to.exist;
                                        expect(state.val).to.be.equal('2018-10-01T20:41:32.000Z');
                                        done();
                                    }
                                });
                            });
                        });
                    });
                });
            });
        }, 1000);
    });
      it('Test ' + adapterShortName + ' adapter: Check values of 2nd Button from FD400', function (done) {
        this.timeout(30000);
        setTimeout(function() {
            states.getState('fritzdect.0.Button_13096321567-9.prodname', function (err, state) {
                if (err) console.error(err);
                expect(state).to.exist;
                if (!state) {
                    console.error('state "fritzdect.0.Button_13096321567-9.prodname" not set');
                }
                else {
                    console.log('fritzdect.0.Button_13096321567-9.prodname     ... ' + state.val);
                }
                expect(state.val).to.exist;
                expect(state.val).to.be.equal('FRITZ!DECT 400');
                states.getState('fritzdect.0.Button_13096321567-9.manufacturer', function (err, state) {
                    if (err) console.error(err);
                    expect(state).to.exist;
                    if (!state) {
                        console.error('state "fritzdect.0.Button_13096321567-9.manufacturer" not set');
                    }
                    else {
                        console.log('fritzdect.0.Button_13096321567-9.manufacturer ... ' + state.val);
                    }
                    expect(state.val).to.exist;
                    expect(state.val).to.be.equal('AVM');
                    states.getState('fritzdect.0.Button_13096321567-9.fwversion', function (err, state) {
                        if (err) console.error(err);
                        expect(state).to.exist;
                        if (!state) {
                            console.error('state "fritzdect.0.Button_13096321567-9.fwversion" not set');
                        }
                        else {
                            console.log('fritzdect.0.Button_13096321567-9.fwversion    ... ' + state.val);
                        }
                        expect(state.val).to.exist;
                        expect(state.val).to.be.equal('04.90');
                        states.getState('fritzdect.0.Button_13096321567-9.id', function (err, state) {
                            if (err) console.error(err);
                            expect(state).to.exist;
                            if (!state) {
                                console.error('state "fritzdect.0.Button_13096321567-9.id" not set');
                            }
                            else {
                                console.log('fritzdect.0.Button_13096321567-9.id           ... ' + state.val);
                            }
                            expect(state.val).to.exist;
                            expect(state.val).to.be.equal('5001');
                            states.getState('fritzdect.0.Button_13096321567-9.name', function (err, state) {
                                if (err) console.error(err);
                                expect(state).to.exist;
                                if (!state) {
                                    console.error('state "fritzdect.0.Button_13096321567-9.name" not set');
                                }
                                else {
                                    console.log('fritzdect.0.Button_13096321567-9.name         ... ' + state.val);
                                }
                                expect(state.val).to.exist;
                                expect(state.val).to.be.equal('FRITZ!DECT 400 #14: lang');
                                states.getState('fritzdect.0.Button_13096321567-9.lastclick', function (err, state) {
                                    if (err) console.error(err);
                                    expect(state).to.exist;
                                    if (!state) {
                                        console.error('state "fritzdect.0.Button_13096321567-9.lastclick" not set');
                                    }
                                    else {
                                        console.log('fritzdect.0.Button_13096321567-9.lastclick  ... ' + state.val);
                                        expect(state.val).to.exist;
                                        expect(state.val).to.be.equal('2019-02-03T12:06:35.000Z');
                                        done();
                                    }
                                });
                            });
                        });
                    });
                });
            });
        }, 1000);
    });
    it('Test ' + adapterShortName + ' adapter: Check values of Powerline', function (done) {
        this.timeout(30000);
        setTimeout(function() {
            states.getState('fritzdect.0.DECT200_34:31:C1:AB:68:53.prodname', function (err, state) {
                if (err) console.error(err);
                expect(state).to.exist;
                if (!state) {
                    console.error('state "fritzdect.0.DECT200_34:31:C1:AB:68:53.prodname" not set');
                }
                else {
                    console.log('fritzdect.0.DECT200_34:31:C1:AB:68:53.prodname     ... ' + state.val);
                }
                expect(state.val).to.exist;
                expect(state.val).to.be.equal('FRITZ!Powerline 546E');
                states.getState('fritzdect.0.DECT200_34:31:C1:AB:68:53.manufacturer', function (err, state) {
                    if (err) console.error(err);
                    expect(state).to.exist;
                    if (!state) {
                        console.error('state "fritzdect.0.DECT200_34:31:C1:AB:68:53.manufacturer" not set');
                    }
                    else {
                        console.log('fritzdect.0.DECT200_34:31:C1:AB:68:53.manufacturer ... ' + state.val);
                    }
                    expect(state.val).to.exist;
                    expect(state.val).to.be.equal('AVM');
                    states.getState('fritzdect.0.DECT200_34:31:C1:AB:68:53.fwversion', function (err, state) {
                        if (err) console.error(err);
                        expect(state).to.exist;
                        if (!state) {
                            console.error('state "fritzdect.0.DECT200_34:31:C1:AB:68:53.fwversion" not set');
                        }
                        else {
                            console.log('fritzdect.0.DECT200_34:31:C1:AB:68:53.fwversion    ... ' + state.val);
                        }
                        expect(state.val).to.exist;
                        expect(state.val).to.be.equal('06.92');
                        states.getState('fritzdect.0.DECT200_34:31:C1:AB:68:53.id', function (err, state) {
                            if (err) console.error(err);
                            expect(state).to.exist;
                            if (!state) {
                                console.error('state "fritzdect.0.DECT200_34:31:C1:AB:68:53.id" not set');
                            }
                            else {
                                console.log('fritzdect.0.DECT200_34:31:C1:AB:68:53.id             ... ' + state.val);
                            }
                            expect(state.val).to.exist;
                            expect(state.val).to.be.equal('20001');
                            states.getState('fritzdect.0.DECT200_34:31:C1:AB:68:53.name', function (err, state) {
                                if (err) console.error(err);
                                expect(state).to.exist;
                                if (!state) {
                                    console.error('state "fritzdect.0.DECT200_34:31:C1:AB:68:53.name" not set');
                                }
                                else {
                                    console.log('fritzdect.0.DECT200_34:31:C1:AB:68:53.name     ... ' + state.val);
                                }
                                expect(state.val).to.exist;
                                expect(state.val).to.be.equal('FRITZ!Powerline');
                                states.getState('fritzdect.0.DECT200_34:31:C1:AB:68:53.state', function (err, state) {
                                    if (err) console.error(err);
                                    expect(state).to.exist;
                                    if (!state) {
                                        console.error('state "fritzdect.0.DECT200_34:31:C1:AB:68:53.state" not set');
                                    }
                                    else {
                                        console.log('fritzdect.0.DECT200_34:31:C1:AB:68:53.state    ... ' + state.val);
                                    }
                                    expect(state.val).to.exist;
                                    expect(state.val).to.be.equal(false);
                                    states.getState('fritzdect.0.DECT200_34:31:C1:AB:68:53.lock', function (err, state) {
                                        if (err) console.error(err);
                                        expect(state).to.exist;
                                        if (!state) {
                                            console.error('state "fritzdect.0.DECT200_34:31:C1:AB:68:53.lock" not set');
                                        }
                                        else {
                                            console.log('fritzdect.0.DECT200_34:31:C1:AB:68:53.lock     ... ' + state.val);
                                        }
                                        expect(state.val).to.exist;
                                        expect(state.val).to.be.equal(false);
                                        states.getState('fritzdect.0.DECT200_34:31:C1:AB:68:53.present', function (err, state) {
                                            if (err) console.error(err);
                                            expect(state).to.exist;
                                            if (!state) {
                                                console.error('state "fritzdect.0.DECT200_34:31:C1:AB:68:53.present not set');
                                            }
                                            else {
                                                console.log('fritzdect.0.DECT200_34:31:C1:AB:68:53.present  ... ' + state.val);
                                            }
                                            expect(state.val).to.exist;
                                            expect(state.val).to.be.equal(true);
                                            states.getState('fritzdect.0.DECT200_34:31:C1:AB:68:53.power', function (err, state) {
                                                if (err) console.error(err);
                                                expect(state).to.exist;
                                                if (!state) {
                                                    console.error('state "fritzdect.0.DECT200_34:31:C1:AB:68:53.power" not set');
                                                }
                                                else {
                                                    console.log('fritzdect.0.DECT200_34:31:C1:AB:68:53.power    ... ' + state.val);
                                                }
                                                expect(state.val).to.exist;
                                                expect(state.val).to.be.equal(0);
                                                states.getState('fritzdect.0.DECT200_34:31:C1:AB:68:53.energy', function (err, state) {
                                                    if (err) console.error(err);
                                                    expect(state).to.exist;
                                                    if (!state) {
                                                        console.error('state "fritzdect.0.DECT200_34:31:C1:AB:68:53.energy" not set');
                                                    }
                                                    else {
                                                        console.log('fritzdect.0.DECT200_34:31:C1:AB:68:53.energy   ... ' + state.val);
                                                        expect(state.val).to.exist;
                                                        expect(state.val).to.be.equal('19331');
                                                        done();
                                                    }
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        }, 1000);
    });
    it('Test ' + adapterShortName + ' adapter: Check values of Repeater', function (done) {
        this.timeout(30000);
        setTimeout(function() {
            states.getState('fritzdect.0.DECT100_087611016969.name', function (err, state) {
                if (err) console.error(err);
                expect(state).to.exist;
                if (!state) {
                    console.error('state "fritzdect.0.DECT100_087611016969.name" not set');
                }
                else {
                    console.log('fritzdect.0.DECT100_087611016969.name          ... ' + state.val);
                }
                expect(state.val).to.exist;
                expect(state.val).to.be.equal('Repeater');
                states.getState('fritzdect.0.DECT100_087611016969.present', function (err, state) {
                    if (err) console.error(err);
                    expect(state).to.exist;
                    if (!state) {
                        console.error('state "fritzdect.0.DECT100_087611016969.present" not set');
                    }
                    else {
                        console.log('fritzdect.0.DECT100_087611016969.present       ... ' + state.val);
                    }
                    expect(state.val).to.exist;
                    expect(state.val).to.be.equal(true);
                    states.getState('fritzdect.0.DECT100_087611016969.id', function (err, state) {
                        if (err) console.error(err);
                        expect(state).to.exist;
                        if (!state) {
                            console.error('state "fritzdect.0.DECT100_087611016969.id" not set');
                        }
                        else {
                            console.log('fritzdect.0.DECT100_087611016969.id            ... ' + state.val);
                        }
                        expect(state.val).to.exist;
                        expect(state.val).to.be.equal('23');
                        states.getState('fritzdect.0.DECT100_087611016969.fwversion', function (err, state) {
                            if (err) console.error(err);
                            expect(state).to.exist;
                            if (!state) {
                                console.error('state "fritzdect.0.DECT100_087611016969.fwversion" not set');
                            }
                            else {
                                console.log('fritzdect.0.DECT100_087611016969.fwversion     ... ' + state.val);
                            }
                            expect(state.val).to.exist;
                            expect(state.val).to.be.equal('03.86');
                            states.getState('fritzdect.0.DECT100_087611016969.manufacturer', function (err, state) {
                                if (err) console.error(err);
                                expect(state).to.exist;
                                if (!state) {
                                    console.error('state "fritzdect.0.DECT100_087611016969.manufacturer" not set');
                                }
                                else {
                                    console.log('fritzdect.0.DECT100_087611016969.manufacturer  ... ' + state.val);
                                }
                                expect(state.val).to.exist;
                                expect(state.val).to.be.equal('AVM');
                                states.getState('fritzdect.0.DECT100_087611016969.temp', function (err, state) {
                                    if (err) console.error(err);
                                    expect(state).to.exist;
                                    if (!state) {
                                        console.error('state "fritzdect.0.DECT100_087611016969.temp" not set');
                                    }
                                    else {
                                        console.log('fritzdect.0.DECT100_087611016969.temp          ... ' + state.val);
                                        expect(state.val).to.exist;
                                        expect(state.val).to.be.equal(17.5);
                                        done();
                                    }
                                });
                            });
                        });
                    });
                });
            });
        }, 1000);
    });
    it('Test ' + adapterShortName + ' adapter: Check values of Lamp DECT500 white', function (done) {
        this.timeout(30000);
        setTimeout(function() {
            states.getState('fritzdect.0.DECT500_123456789012-1.prodname', function (err, state) {
                if (err) console.error(err);
                expect(state).to.exist;
                if (!state) {
                    console.error('state "fritzdect.0.DECT500_123456789012-1.prodname" not set');
                }
                else {
                    console.log('fritzdect.0.DECT500_123456789012-1.prodname     ... ' + state.val);
                }
                expect(state.val).to.exist;
                expect(state.val).to.be.equal('FRITZ!DECT 500');
                states.getState('fritzdect.0.DECT500_123456789012-1.manufacturer', function (err, state) {
                    if (err) console.error(err);
                    expect(state).to.exist;
                    if (!state) {
                        console.error('state "fritzdect.0.DECT500_123456789012-1.manufacturer" not set');
                    }
                    else {
                        console.log('fritzdect.0.DECT500_123456789012-1.manufacturer ... ' + state.val);
                    }
                    expect(state.val).to.exist;
                    expect(state.val).to.be.equal('AVM');
                    states.getState('fritzdect.0.DECT500_123456789012-1.fwversion', function (err, state) {
                        if (err) console.error(err);
                        expect(state).to.exist;
                        if (!state) {
                            console.error('state "fritzdect.0.DECT500_123456789012-1.fwversion" not set');
                        }
                        else {
                            console.log('fritzdect.0.DECT500_123456789012-1.fwversion    ... ' + state.val);
                        }
                        expect(state.val).to.exist;
                        expect(state.val).to.be.equal('0.0');
                        states.getState('fritzdect.0.DECT500_123456789012-1.id', function (err, state) {
                            if (err) console.error(err);
                            expect(state).to.exist;
                            if (!state) {
                                console.error('state "fritzdect.0.DECT500_123456789012-1.id" not set');
                            }
                            else {
                                console.log('fritzdect.0.DECT500_123456789012-1.id             ... ' + state.val);
                            }
                            expect(state.val).to.exist;
                            expect(state.val).to.be.equal('406');
                            states.getState('fritzdect.0.DECT500_123456789012-1.name', function (err, state) {
                                if (err) console.error(err);
                                expect(state).to.exist;
                                if (!state) {
                                    console.error('state "fritzdect.0.DECT500_123456789012-1.name" not set');
                                }
                                else {
                                    console.log('fritzdect.0.DECT500_123456789012-1.name     ... ' + state.val);
                                }
                                expect(state.val).to.exist;
                                expect(state.val).to.be.equal('FRITZ!DECT 500');
                                states.getState('fritzdect.0.DECT500_123456789012-1.state', function (err, state) {
                                    if (err) console.error(err);
                                    expect(state).to.exist;
                                    if (!state) {
                                        console.error('state "fritzdect.0.DECT500_123456789012-1.state" not set');
                                    }
                                    else {
                                        console.log('fritzdect.0.DECT500_123456789012-1.state    ... ' + state.val);
                                    }
                                    expect(state.val).to.exist;
                                    expect(state.val).to.be.equal(true);
                                    states.getState('fritzdect.0.DECT500_123456789012-1.txbusy', function (err, state) {
                                        if (err) console.error(err);
                                        expect(state).to.exist;
                                        if (!state) {
                                            console.error('state "fritzdect.0.DECT500_123456789012-1.txbusy" not set');
                                        }
                                        else {
                                            console.log('fritzdect.0.DECT500_123456789012-1.txbusy     ... ' + state.val);
                                        }
                                        expect(state.val).to.exist;
                                        expect(state.val).to.be.equal(false);
                                        states.getState('fritzdect.0.DECT500_123456789012-1.present', function (err, state) {
                                            if (err) console.error(err);
                                            expect(state).to.exist;
                                            if (!state) {
                                                console.error('state "fritzdect.0.DECT500_123456789012-1.present not set');
                                            }
                                            else {
                                                console.log('fritzdect.0.DECT500_123456789012-1.present  ... ' + state.val);
                                            }
                                            expect(state.val).to.exist;
                                            expect(state.val).to.be.equal(true);
                                            states.getState('fritzdect.0.DECT500_123456789012-1.level', function (err, state) {
                                                if (err) console.error(err);
                                                expect(state).to.exist;
                                                if (!state) {
                                                    console.error('state "fritzdect.0.DECT500_123456789012-1.level" not set');
                                                }
                                                else {
                                                    console.log('fritzdect.0.DECT500_123456789012-1.level    ... ' + state.val);
                                                }
                                                expect(state.val).to.exist;
                                                expect(state.val).to.be.equal(255);
                                                states.getState('fritzdect.0.DECT500_123456789012-1.levelpercentage', function (err, state) {
                                                    if (err) console.error(err);
                                                    expect(state).to.exist;
                                                    if (!state) {
                                                        console.error('state "fritzdect.0.DECT500_123456789012-1.levelpercentage" not set');
                                                    }
                                                    else {
                                                        console.log('fritzdect.0.DECT500_123456789012-1.levelpercentage    ... ' + state.val);
                                                    }
                                                    expect(state.val).to.exist;
                                                    expect(state.val).to.be.equal(100);
                                                    states.getState('fritzdect.0.DECT500_123456789012-1.colormodes', function (err, state) {
                                                        if (err) console.error(err);
                                                        expect(state).to.exist;
                                                        if (!state) {
                                                            console.error('state "fritzdect.0.DECT500_123456789012-1.colormodes" not set');
                                                        }
                                                        else {
                                                            console.log('fritzdect.0.DECT500_123456789012-1.colormodes    ... ' + state.val);
                                                        }
                                                        expect(state.val).to.exist;
                                                        expect(state.val).to.be.equal('5');
                                                        states.getState('fritzdect.0.DECT500_123456789012-1.current_mode', function (err, state) {
                                                            if (err) console.error(err);
                                                            expect(state).to.exist;
                                                            if (!state) {
                                                                console.error('state "fritzdect.0.DECT500_123456789012-1.current_mode" not set');
                                                            }
                                                            else {
                                                                console.log('fritzdect.0.DECT500_123456789012-1.current_mode    ... ' + state.val);
                                                            }
                                                            expect(state.val).to.exist;
                                                            expect(state.val).to.be.equal('4');
                                                            states.getState('fritzdect.0.DECT500_123456789012-1.hue', function (err, state) {
                                                                if (err) console.error(err);
                                                                expect(state).to.exist;
                                                                if (!state) {
                                                                    console.error('state "fritzdect.0.DECT500_123456789012-1.hue" not set');
                                                                }
                                                                else {
                                                                    console.log('fritzdect.0.DECT500_123456789012-1.hue    ... ' + state.val);
                                                                }
                                                                //expect(state.val).to.exist;
                                                                expect(state.val).to.be.equal(null);
                                                                states.getState('fritzdect.0.DECT500_123456789012-1.saturation', function (err, state) {
                                                                    if (err) console.error(err);
                                                                    expect(state).to.exist;
                                                                    if (!state) {
                                                                        console.error('state "fritzdect.0.DECT500_123456789012-1.saturation" not set');
                                                                    }
                                                                    else {
                                                                        console.log('fritzdect.0.DECT500_123456789012-1.saturation    ... ' + state.val);
                                                                    }
                                                                    //expect(state.val).to.exist;
                                                                    expect(state.val).to.be.equal(null);
                                                                    states.getState('fritzdect.0.DECT500_123456789012-1.temperature', function (err, state) {
                                                                        if (err) console.error(err);
                                                                        expect(state).to.exist;
                                                                        if (!state) {
                                                                            console.error('state "fritzdect.0.DECT500_123456789012-1.temperature" not set');
                                                                        }
                                                                        else {
                                                                            console.log('fritzdect.0.DECT500_123456789012-1.temperature   ... ' + state.val);
                                                                            expect(state.val).to.exist;
                                                                            expect(state.val).to.be.equal(3400);
                                                                            done();
                                                                        }
                                                                    });
                                                                });
                                                            });
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        }, 1000);
    });
      it('Test ' + adapterShortName + ' adapter: Check values of Lamp DECT500 color', function (done) {
          this.timeout(30000);
          setTimeout(function() {
              states.getState('fritzdect.0.DECT500_130770000415-1.prodname', function (err, state) {
                  if (err) console.error(err);
                  expect(state).to.exist;
                  if (!state) {
                      console.error('state "fritzdect.0.DECT500_130770000415-1.prodname" not set');
                  }
                  else {
                      console.log('fritzdect.0.DECT500_130770000415-1.prodname     ... ' + state.val);
                  }
                  expect(state.val).to.exist;
                  expect(state.val).to.be.equal('FRITZ!DECT 500');
                  states.getState('fritzdect.0.DECT500_130770000415-1.manufacturer', function (err, state) {
                      if (err) console.error(err);
                      expect(state).to.exist;
                      if (!state) {
                          console.error('state "fritzdect.0.DECT500_130770000415-1.manufacturer" not set');
                      }
                      else {
                          console.log('fritzdect.0.DECT500_130770000415-1.manufacturer ... ' + state.val);
                      }
                      expect(state.val).to.exist;
                      expect(state.val).to.be.equal('AVM');
                      states.getState('fritzdect.0.DECT500_130770000415-1.fwversion', function (err, state) {
                          if (err) console.error(err);
                          expect(state).to.exist;
                          if (!state) {
                              console.error('state "fritzdect.0.DECT500_130770000415-1.fwversion" not set');
                          }
                          else {
                              console.log('fritzdect.0.DECT500_130770000415-1.fwversion    ... ' + state.val);
                          }
                          expect(state.val).to.exist;
                          expect(state.val).to.be.equal('0.0');
                          states.getState('fritzdect.0.DECT500_130770000415-1.id', function (err, state) {
                              if (err) console.error(err);
                              expect(state).to.exist;
                              if (!state) {
                                  console.error('state "fritzdect.0.DECT500_130770000415-1.id" not set');
                              }
                              else {
                                  console.log('fritzdect.0.DECT500_130770000415-1.id             ... ' + state.val);
                              }
                              expect(state.val).to.exist;
                              expect(state.val).to.be.equal('2002');
                              states.getState('fritzdect.0.DECT500_130770000415-1.name', function (err, state) {
                                  if (err) console.error(err);
                                  expect(state).to.exist;
                                  if (!state) {
                                      console.error('state "fritzdect.0.DECT500_130770000415-1.name" not set');
                                  }
                                  else {
                                      console.log('fritzdect.0.DECT500_130770000415-1.name     ... ' + state.val);
                                  }
                                  expect(state.val).to.exist;
                                  expect(state.val).to.be.equal('FRITZ!DECT 500');
                                  states.getState('fritzdect.0.DECT500_130770000415-1.state', function (err, state) {
                                      if (err) console.error(err);
                                      expect(state).to.exist;
                                      if (!state) {
                                          console.error('state "fritzdect.0.DECT500_130770000415-1.state" not set');
                                      }
                                      else {
                                          console.log('fritzdect.0.DECT500_130770000415-1.state    ... ' + state.val);
                                      }
                                      expect(state.val).to.exist;
                                      expect(state.val).to.be.equal(true);
                                      states.getState('fritzdect.0.DECT500_130770000415-1.txbusy', function (err, state) {
                                          if (err) console.error(err);
                                          expect(state).to.exist;
                                          if (!state) {
                                              console.error('state "fritzdect.0.DECT500_130770000415-1.txbusy" not set');
                                          }
                                          else {
                                              console.log('fritzdect.0.DECT500_130770000415-1.txbusy     ... ' + state.val);
                                          }
                                          expect(state.val).to.exist;
                                          expect(state.val).to.be.equal(false);
                                          states.getState('fritzdect.0.DECT500_130770000415-1.present', function (err, state) {
                                              if (err) console.error(err);
                                              expect(state).to.exist;
                                              if (!state) {
                                                  console.error('state "fritzdect.0.DECT500_130770000415-1.present not set');
                                              }
                                              else {
                                                  console.log('fritzdect.0.DECT500_130770000415-1.present  ... ' + state.val);
                                              }
                                              expect(state.val).to.exist;
                                              expect(state.val).to.be.equal(true);
                                              states.getState('fritzdect.0.DECT500_130770000415-1.level', function (err, state) {
                                                  if (err) console.error(err);
                                                  expect(state).to.exist;
                                                  if (!state) {
                                                      console.error('state "fritzdect.0.DECT500_130770000415-1.level" not set');
                                                  }
                                                  else {
                                                      console.log('fritzdect.0.DECT500_130770000415-1.level    ... ' + state.val);
                                                  }
                                                  expect(state.val).to.exist;
                                                  expect(state.val).to.be.equal(255);
                                                  states.getState('fritzdect.0.DECT500_130770000415-1.levelpercentage', function (err, state) {
                                                      if (err) console.error(err);
                                                      expect(state).to.exist;
                                                      if (!state) {
                                                          console.error('state "fritzdect.0.DECT500_130770000415-1.levelpercentage" not set');
                                                      }
                                                      else {
                                                          console.log('fritzdect.0.DECT500_130770000415-1.levelpercentage    ... ' + state.val);
                                                      }
                                                      expect(state.val).to.exist;
                                                      expect(state.val).to.be.equal(100);
                                                      states.getState('fritzdect.0.DECT500_130770000415-1.colormodes', function (err, state) {
                                                          if (err) console.error(err);
                                                          expect(state).to.exist;
                                                          if (!state) {
                                                              console.error('state "fritzdect.0.DECT500_130770000415-1.colormodes" not set');
                                                          }
                                                          else {
                                                              console.log('fritzdect.0.DECT500_130770000415-1.colormodes    ... ' + state.val);
                                                          }
                                                          expect(state.val).to.exist;
                                                          expect(state.val).to.be.equal('5');
                                                          states.getState('fritzdect.0.DECT500_130770000415-1.current_mode', function (err, state) {
                                                              if (err) console.error(err);
                                                              expect(state).to.exist;
                                                              if (!state) {
                                                                  console.error('state "fritzdect.0.DECT500_130770000415-1.current_mode" not set');
                                                              }
                                                              else {
                                                                  console.log('fritzdect.0.DECT500_130770000415-1.current_mode    ... ' + state.val);
                                                              }
                                                              expect(state.val).to.exist;
                                                              expect(state.val).to.be.equal('1');
                                                              states.getState('fritzdect.0.DECT500_130770000415-1.hue', function (err, state) {
                                                                  if (err) console.error(err);
                                                                  expect(state).to.exist;
                                                                  if (!state) {
                                                                      console.error('state "fritzdect.0.DECT500_130770000415-1.hue" not set');
                                                                  }
                                                                  else {
                                                                      console.log('fritzdect.0.DECT500_130770000415-1.hue    ... ' + state.val);
                                                                  }
                                                                  expect(state.val).to.exist;
                                                                  expect(state.val).to.be.equal(348);
                                                                  states.getState('fritzdect.0.DECT500_130770000415-1.saturation', function (err, state) {
                                                                      if (err) console.error(err);
                                                                      expect(state).to.exist;
                                                                      if (!state) {
                                                                          console.error('state "fritzdect.0.DECT500_130770000415-1.saturation" not set');
                                                                      }
                                                                      else {
                                                                          console.log('fritzdect.0.DECT500_130770000415-1.saturation    ... ' + state.val);
                                                                      }
                                                                      expect(state.val).to.exist;
                                                                      expect(state.val).to.be.equal(179);
                                                                      states.getState('fritzdect.0.DECT500_130770000415-1.temperature', function (err, state) {
                                                                          if (err) console.error(err);
                                                                          expect(state).to.exist;
                                                                          if (!state) {
                                                                              console.error('state "fritzdect.0.DECT500_130770000415-1.temperature" not set');
                                                                          }
                                                                          else {
                                                                              console.log('fritzdect.0.DECT500_130770000415-1.temperature   ... ' + state.val);
                                                                              //expect(state.val).to.exist;
                                                                              expect(state.val).to.be.equal(null);
                                                                              done();
                                                                          }
                                                                      });
                                                                  });
                                                              });
                                                          });
                                                      });
                                                  });
                                              });
                                          });
                                      });
                                  });
                              });
                          });
                      });
                  });
              });
          }, 1000);
      });
    it('Test ' + adapterShortName + ' adapter: Objects must exist for template_tmp6F0093-39091EED0', done => {
        setTimeout(function(){
            objects.getObject(adapterShortName + '.0.template_tmp6F0093-39091EED0.name', (err, obj) => {
                if (err) console.error('template_tmp6F0093-39091EED0.name '+err);
                expect(obj).to.exist;
                expect(obj).to.be.ok;
                    objects.getObject(adapterShortName + '.0.template_tmp6F0093-39091EED0.id', (err, obj) => {
                        if (err) console.error('template_tmp6F0093-39091EED0.name ' + err);
                        expect(obj).to.exist;    
                        expect(obj).to.be.ok;
                        done();
                    });
                    });
                }, 1000);
     }).timeout(5000);
  

    it('Test ' + adapterShortName + ' adapter: Check values of template 1', function (done) {
        this.timeout(5000);
        setTimeout(function() {
            states.getState('fritzdect.0.template_tmp6F0093-39091EED0.name', function (err, state) {
                if (err) console.error(err);
                expect(state).to.exist;
                if (!state) {
                    console.error('state "fritzdect.0.template_tmp6F0093-39091EED0.name" not set');
                }
                else {
                    console.log('fritzdect.0.Button_template_tmp6F0093-39091EED0.name         ... ' + state.val);
                }
                expect(state.val).to.exist;
                expect(state.val).to.be.equal('Alle aus (Sommer)');
                states.getState('fritzdect.0.template_tmp6F0093-39091EED0.id', function (err, state) {
                    if (err) console.error(err);
                    expect(state).to.exist;
                    if (!state) {
                        console.error('state "fritzdect.0.template_tmp6F0093-39091EED0.id" not set');
                    }
                    else {
                        console.log('fritzdect.0.template_tmp6F0093-39091EED0.id ... ' + state.val);
                        expect(state.val).to.exist;
                        expect(state.val).to.be.equal('60010');
                        done();
                    }
                });
            });
        }, 1000);
    });

    it('Test ' + adapterShortName + ' adapter: Check values of template 2', function (done) {
        this.timeout(5000);
        setTimeout(function() {
            states.getState('fritzdect.0.template_tmp6F0093-390920878.name', function (err, state) {
                if (err) console.error(err);
                expect(state).to.exist;
                if (!state) {
                    console.error('state "fritzdect.0.template_tmp6F0093-390920878.name" not set');
                }
                else {
                    console.log('fritzdect.0.Button_template_tmp6F0093-390920878.name         ... ' + state.val);
                }
                expect(state.val).to.exist;
                expect(state.val).to.be.equal('Normal Bad');
                states.getState('fritzdect.0.template_tmp6F0093-390920878.id', function (err, state) {
                    if (err) console.error(err);
                    expect(state).to.exist;
                    if (!state) {
                        console.error('state "fritzdect.0.template_tmp6F0093-390920878.id" not set');
                    }
                    else {
                        console.log('fritzdect.0.template_tmp6F0093-390920878.id ... ' + state.val);
                        expect(state.val).to.exist;
                        expect(state.val).to.be.equal('60011');
                        done();
                    }
                });
            });
        }, 1000);
    });
    it('Test ' + adapterShortName + ' adapter: Check values of template 3', function (done) {
        this.timeout(5000);
        setTimeout(function() {
            states.getState('fritzdect.0.template_tmp6F0093-390920F4A.name', function (err, state) {
                if (err) console.error(err);
                expect(state).to.exist;
                if (!state) {
                    console.error('state "fritzdect.0.template_tmp6F0093-390920F4A.name" not set');
                }
                else {
                    console.log('fritzdect.0.Button_template_tmp6F0093-390920F4A.name         ... ' + state.val);
                }
                expect(state.val).to.exist;
                expect(state.val).to.be.equal('Normal Schlafzimmer');
                states.getState('fritzdect.0.template_tmp6F0093-390920F4A.id', function (err, state) {
                    if (err) console.error(err);
                    expect(state).to.exist;
                    if (!state) {
                        console.error('state "fritzdect.0.template_tmp6F0093-390920F4A.id" not set');
                    }
                    else {
                        console.log('fritzdect.0.template_tmp6F0093-390920F4A.id ... ' + state.val);
                        expect(state.val).to.exist;
                        expect(state.val).to.be.equal('60005');
                        done();
                    }
                });
            });
        }, 1000);
    });
    it('Test ' + adapterShortName + ' adapter: Check values of template 4', function (done) {
        this.timeout(5000);
        setTimeout(function() {
            states.getState('fritzdect.0.template_tmp6F0093-39091E943.name', function (err, state) {
                if (err) console.error(err);
                expect(state).to.exist;
                if (!state) {
                    console.error('state "fritzdect.0.template_tmp6F0093-39091E943.name" not set');
                }
                else {
                    console.log('fritzdect.0.Button_template_tmp6F0093-39091E943.name         ... ' + state.val);
                }
                expect(state.val).to.exist;
                expect(state.val).to.be.equal('Urlaub Anfang');
                states.getState('fritzdect.0.template_tmp6F0093-39091E943.id', function (err, state) {
                    if (err) console.error(err);
                    expect(state).to.exist;
                    if (!state) {
                        console.error('state "fritzdect.0.template_tmp6F0093-39091E943.id" not set');
                    }
                    else {
                        console.log('fritzdect.0.template_tmp6F0093-39091E943.id ... ' + state.val);
                        expect(state.val).to.exist;
                        expect(state.val).to.be.equal('60009');
                        done();
                    }
                });
            });
        }, 1000);
    });
    it('Test ' + adapterShortName + ' adapter: Check values of template 5', function (done) {
        this.timeout(5000);
        setTimeout(function() {
            states.getState('fritzdect.0.template_tmp6F0093-391363146.name', function (err, state) {
                if (err) console.error(err);
                expect(state).to.exist;
                if (!state) {
                    console.error('state "fritzdect.0.template_tmp6F0093-391363146.name" not set');
                }
                else {
                    console.log('fritzdect.0.Button_template_tmp6F0093-391363146.name         ... ' + state.val);
                }
                expect(state.val).to.exist;
                expect(state.val).to.be.equal('Urlaub Ende');
                states.getState('fritzdect.0.template_tmp6F0093-391363146.id', function (err, state) {
                    if (err) console.error(err);
                    expect(state).to.exist;
                    if (!state) {
                        console.error('state "fritzdect.0.template_tmp6F0093-391363146.id" not set');
                    }
                    else {
                        console.log('fritzdect.0.template_tmp6F0093-391363146.id ... ' + state.val);
                        expect(state.val).to.exist;
                        expect(state.val).to.be.equal('60008');
                        done();
                    }
                });
            });
        }, 1000);
    });
    it('Test ' + adapterShortName + ' adapter: Check values of template 6', function (done) {
        this.timeout(30000);
        setTimeout(function() {
            states.getState('fritzdect.0.template_tmp6F0093-39091E733.name', function (err, state) {
                if (err) console.error(err);
                expect(state).to.exist;
                if (!state) {
                    console.error('state "fritzdect.0.template_tmp6F0093-39091E733.name" not set');
                }
                else {
                    console.log('fritzdect.0.Button_template_tmp6F0093-39091E733.name         ... ' + state.val);
                }
                expect(state.val).to.exist;
                expect(state.val).to.be.equal('Wohnen Home');
                states.getState('fritzdect.0.template_tmp6F0093-39091E733.id', function (err, state) {
                    if (err) console.error(err);
                    expect(state).to.exist;
                    if (!state) {
                        console.error('state "fritzdect.0.template_tmp6F0093-39091E733.id" not set');
                    }
                    else {
                        console.log('fritzdect.0.template_tmp6F0093-39091E733.id ... ' + state.val);
                        expect(state.val).to.exist;
                        expect(state.val).to.be.equal('60006');
                        done();
                    }
                });
            });
        }, 1000);
    });
    it('Test ' + adapterShortName + ' adapter: Check values of template 7', function (done) {
        this.timeout(30000);
        setTimeout(function() {
            states.getState('fritzdect.0.template_tmp6F0093-39091E428.name', function (err, state) {
                if (err) console.error(err);
                expect(state).to.exist;
                if (!state) {
                    console.error('state "fritzdect.0.template_tmp6F0093-39091E428.name" not set');
                }
                else {
                    console.log('fritzdect.0.Button_template_tmp6F0093-39091E428.name         ... ' + state.val);
                }
                expect(state.val).to.exist;
                expect(state.val).to.be.equal('Wohnen Work');
                states.getState('fritzdect.0.template_tmp6F0093-39091E428.id', function (err, state) {
                    if (err) console.error(err);
                    expect(state).to.exist;
                    if (!state) {
                        console.error('state "fritzdect.0.template_tmp6F0093-39091E428.id" not set');
                    }
                    else {
                        console.log('fritzdect.0.template_tmp6F0093-39091E428.id ... ' + state.val);
                        expect(state.val).to.exist;
                        expect(state.val).to.be.equal('60007');
                        done();
                    }
                });
            });
        }, 1000);
    });
    it('Test ' + adapterShortName + ' adapter: Check values of template 8', function (done) {
        this.timeout(30000);
        setTimeout(function() {
            states.getState('fritzdect.0.template_tmp5665DB-3A1C9EC6F.name', function (err, state) {
                if (err) console.error(err);
                expect(state).to.exist;
                if (!state) {
                    console.error('state "fritzdect.0.template_tmp5665DB-3A1C9EC6F.name" not set');
                }
                else {
                    console.log('fritzdect.0.Button_template_tmp5665DB-3A1C9EC6F.name         ... ' + state.val);
                }
                expect(state.val).to.exist;
                expect(state.val).to.be.equal('vorlage_dect200');
                states.getState('fritzdect.0.template_tmp5665DB-3A1C9EC6F.id', function (err, state) {
                    if (err) console.error(err);
                    expect(state).to.exist;
                    if (!state) {
                        console.error('state "fritzdect.0.template_tmp5665DB-3A1C9EC6F.id" not set');
                    }
                    else {
                        console.log('fritzdect.0.template_tmp5665DB-3A1C9EC6F.id ... ' + state.val);
                        expect(state.val).to.exist;
                        expect(state.val).to.be.equal('60101');
                        done();
                    }
                });
            });
        }, 1000);
    });
    /*
    it('Test ' + adapterShortName + ' adapter: Set values', function (done) {
        console.log('START SET VALUES');
        this.timeout(90000);
        states.setState('fritzdect.0.DECT200_087610006161', {val: false, ack: false, from: 'test.0'}, function (err) {
            if (err) {
                console.log(err);
            }
            checkValueOfState('fritzdect.0.DECT200_087610006161', false, function() {
                done();
            });
        });
    });
    */    
    
    
    
    after('Test ' + adapterShortName + ' adapter: Stop js-controller', function (done) {
        this.timeout(10000);

        setup.stopController(function (normalTerminated) {
            console.log('Adapter normal terminated: ' + normalTerminated);
            done();
        });
    });
});
