/* jshint -W097 */// jshint strict:false
/*jslint node: true */
var expect = require('chai').expect;
var setup  = require(__dirname + '/lib/setup');
var http = require('http');
var fs = require('fs');

var objects = null;
var states  = null;
var onStateChanged = null;
var onObjectChanged = null;
var sendToID = 1;

var adapterShortName = setup.adapterName.substring(setup.adapterName.indexOf('.')+1);

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

// challange dynamisch machen und sid evtl auch
var challenge = '0a355ee5';
var challenge2 = '3148720a';
var password = 'password';
var challengeResponse = challenge +'-'+require('crypto').createHash('md5').update(Buffer(challenge+'-'+password, 'UTF-16LE')).digest('hex');
var sid = 'e3e154790a412aec';
var content = fs.readFileSync('../test_api_response.xml');

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
        response.write(JSON.stringify([ '087610006161', '34:31:C1:AB:68:53', '119600642220', 'EF:C4:CC-900' ]));
        response.end(); 
    }   
    else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid='+sid+'&switchcmd=getdevicelistinfos') { //check the URL of the current request
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write( String(content) );
        response.end(); 
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

        setup.setupController(function () {
            var config = setup.getAdapterConfig();
            // enable adapter
            config.common.enabled  = true;
            config.common.loglevel = 'debug';

            //config.native.dbtype   = 'sqlite';

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
    it('Test ' + adapterShortName + ' adapter: Check values', function (done) {
        console.log('START CHECK VALUES');
        this.timeout(90000);
        checkValueOfState('fritzdect.0.DECT200_087610006161.energy', 104560, function() {
            setTimeout(function() {
                checkValueOfState('musiccast.0.DECT200_087610006161.energy', 104560, function() {
                    done();
                });
            }, 70000);
        });
    });

    /*
    it('Test ' + adapterShortName + ' adapter: Set values', function (done) {
        console.log('START SET VALUES');
        this.timeout(90000);
        states.setState('fritzdect.0.DECT200_087610006161', {val: false, ack: false, from: 'test.0'}, function (err) {
            if (err) {
                console.log(err);
            }
            checkValueOfState('musiccast.0.DECT200_087610006161', false, function() {
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
