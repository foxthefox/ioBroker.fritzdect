/**
 * Forked from https://github.com/andig/fritzapi
 *
 *
 * smartFritz - Fritz goes smartHome
 *
 * AVM SmartHome nodeJS Control - for AVM Fritz!Box and Dect200 Devices
 *
 * @author Andreas Goetz <cpuidle@gmx.de>
 *
 * Forked from: https://github.com/nischelwitzer/smartfritz
 * nischi - first version: July 2014
 *
 * based on: Node2Fritz by steffen.timm on 05.12.13 for Fritz!OS > 05.50
 * and  thk4711 (code https://github.com/pimatic/pimatic/issues/38)
 *
 * AVM Documentation is at https://avm.de/service/schnittstellen/
 */

/* jshint esversion: 6, -W079 */
var Promise = require('bluebird');
var request = require('@root/request');
var extend = require('extend');


/*
 * Object-oriented API
 */

module.exports.Fritz = Fritz;

function Fritz(username, password, uri) {
    this.sid = null;
    this.username = username;
    this.password = password;
    this.options = { url: uri || 'http://fritz.box' };
}

Fritz.prototype = {
    call: function(func) {
        var originalSID = this.sid;

        /* jshint laxbreak:true */
        var promise = this.sid
            ? Promise.resolve(this.sid)
            : module.exports.getSessionID(this.username, this.password, this.options);

        // function arguments beyond func parameter
        var args = Array.from(arguments).slice(1).concat(this.options);

        return promise.then(function(sid) {
            this.sid = sid;

            return func.apply(null, [this.sid].concat(args)).catch(function(error) {
                if (error.response && error.response.statusCode == 403) {
                    // this.sid has not been updated or is invalid - get a new SID
                    if (this.sid === null || this.sid === originalSID) {
                        this.sid = null;

                        return module.exports.getSessionID(this.username, this.password, this.options).then(function(sid) {
                            // this session id is the most current one - so use it from now on
                            this.sid = sid;

                            return func.apply(null, [this.sid].concat(args));
                        }.bind(this));
                    }
                    // this.sid has already been updated during the func() call - assume this is a valid SID now
                    else {
                        return func.apply(null, [this.sid].concat(args));
                    }
                }

                throw error;
            }.bind(this));
        }.bind(this));
    },

    getSID: function() {
        return this.sid;
    },

    getDeviceListInfos: function() {
        return this.call(module.exports.getDeviceListInfos);
    },

    getTemplateListInfos : function() {
        return this.call(module.exports.getTemplateListInfos);
    },

    getBasicDeviceStats: function() {
        return this.call(module.exports.getBasicDeviceStats);
    },

    setSwitchOn: function(ain) {
        return this.call(module.exports.setSwitchOn, ain);
    },

    setSwitchOff: function(ain) {
        return this.call(module.exports.setSwitchOff, ain);
    },

    setTempTarget: function(ain, temp) {
        return this.call(module.exports.setTempTarget, ain, temp);
    },
    
    applyTemplate: function(ain) {
        return this.call(module.exports.applyTemplate, ain);
    },

    /*
     * Helper functions
     */
    api2temp: module.exports.api2temp,
    temp2api: module.exports.temp2api
};


/*
 * Functional API
 */

var defaults = { url: 'http://fritz.box' };

/**
 * Check if numeric value
 */
function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

/**
 * Execute HTTP request that honors failed/invalid login
 */
function httpRequest(path, req, options)
{
    return new Promise(function(resolve, reject) {
        req = extend({}, defaults, req, options);
        req.url += path;

        request(req, function(error, response, body) {
            if (error || !(/^2/.test('' + response.statusCode)) || /action=".?login.lua"/.test(body)) {
                if (/action=".?login.lua"/.test(body)) {
                    // fake failed login if redirected to login page without HTTP 403
                    response.statusCode = 403;
                }
                reject({
                    error: error,
                    response: response,
                    options: req
                });
            }
            else {
                resolve(body.trim());
            }
        });
    });
}

/**
 * Execute Fritz API command for device specified by AIN
 */
function executeCommand(sid, command, ain, options, path)
{
    path = path || '/webservices/homeautoswitch.lua?0=0';

    if (sid)
        path += '&sid=' + sid;
    if (command)
        path += '&switchcmd=' + command;
    if (ain)
        path += '&ain=' + ain;

    return httpRequest(path, {}, options);
}

/*
 * Temperature conversion
 */
const MIN_TEMP = 8;
const MAX_TEMP = 28;

function temp2api(temp)
{
    var res;

    if (temp == 'on' || temp === true)
        res = 254;
    else if (temp == 'off' || temp === false)
        res = 253;
    else {
        // 0.5C accuracy
        res = Math.round((Math.min(Math.max(temp, MIN_TEMP), MAX_TEMP) - 8) * 2) + 16;
    }

    return res;
}

function api2temp(param)
{
    if (param == 254)
        return 'on';
    else if (param == 253)
        return 'off';
    else {
        // 0.5C accuracy
        return (parseFloat(param) - 16) / 2 + 8;
    }
}

// #############################################################################

// run command for selected device
module.exports.executeCommand = executeCommand;
module.exports.api2temp = api2temp;
module.exports.temp2api = temp2api;

/*
 * Session handling
 */

// get session id
module.exports.getSessionID = function(username, password, options)
{
    if (typeof username !== 'string') throw new Error('Invalid username');
    if (typeof password !== 'string') throw new Error('Invalid password');

    return executeCommand(null, null, null, options, '/login_sid.lua').then(function(body) {
        var challenge = body.match("<Challenge>(.*?)</Challenge>")[1];
        var challengeResponse = challenge +'-'+
            require('crypto').createHash('md5').update(Buffer(challenge+'-'+password, 'UTF-16LE')).digest('hex');
        var url = "/login_sid.lua?username=" + username + "&response=" + challengeResponse;

        return executeCommand(null, null, null, options, url).then(function(body) {
            var sessionID = body.match("<SID>(.*?)</SID>")[1];
            if (sessionID === "0000000000000000") {
                return Promise.reject(sessionID);
            }
            return sessionID;
        });
    });
};

// check if session id is OK
module.exports.checkSession = function(sid, options)
{
    return executeCommand(sid, null, null, options, '/login_sid.lua').then(function(body) {
        var sessionID = body.match("<SID>(.*?)</SID>")[1];
        if (sessionID === "0000000000000000") {
            return Promise.reject(sessionID);
        }
        return sessionID;
    });
};


/*
 * Polling
 */

// get detailed device information (XML)
module.exports.getDeviceListInfos = function(sid, options)
{
    return executeCommand(sid, 'getdevicelistinfos', null, options);
};

// get template information (XML)
module.exports.getTemplateListInfos  = function(sid, options)
{
    return executeCommand(sid, 'gettemplatelistinfos', null, options);
};

// get basic device stats (XML)
module.exports.getBasicDeviceStats  = function(sid, options)
{
    return executeCommand(sid, 'getbasicdevicestats', ain, options);
};

/*
 * Commands
 */

// turn an outlet on. returns the state the outlet was set to
module.exports.setSwitchOn = function(sid, ain, options)
{
    return executeCommand(sid, 'setswitchon', ain, options).then(function(body) {
        return /^1/.test(body); // true if on
    });
};

// turn an outlet off. returns the state the outlet was set to
module.exports.setSwitchOff = function(sid, ain, options)
{
    return executeCommand(sid, 'setswitchoff', ain, options).then(function(body) {
        return /^1/.test(body); // false if off
    });
};

// set target temperature (Solltemperatur)
module.exports.setTempTarget = function(sid, ain, temp, options)
{
    return executeCommand(sid, 'sethkrtsoll&param=' + temp2api(temp), ain, options).then(function(body) {
        // api does not return a value
        return temp;
    });
};

// apply template
module.exports.applyTemplate = function(sid, ain, options)
{
    return executeCommand(sid, 'applytemplate', ain, options).then(function(body) {
        return body; // returns applied id if success
    });
};
