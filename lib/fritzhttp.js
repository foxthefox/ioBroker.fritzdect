/**
 * With Version Fritzbox FW 7.25 onwards the Session request uses /login_sid.lua?version=2 and pbkf2
 * instead of /login_sid.lua? and md5
 * the class has a fallback to md5
 * 
 * complete rewrite of fritzapi
 * class follows the python refernce implementation approach in AVM documentation
 * and is based on ideas of https://github.com/andig/fritzapi
 * but not uses the complex chain of function to memorize the session SID
 * 
 * AVM Documentation is at https://avm.de/service/schnittstellen/
 * 
 * @author foxthefox@wysiwis.net
 * 
 * first version 19.12.2020
 *
 * usage:
 * import { * } from fritzhttp
 * 
 *	var username = "fritz_user";
 *	var password = "fritz_pw";
 *	var moreParam = "fritz_ip";
 *
 *	var fritz = new Fritz(username, password || '', moreParam || '');
 * 
 *  // call a function e.g. the devicelist
 *  fritz
 *	 	.getDeviceListInfos()
 *		.then(function(devices) {
 *			console.log('Devices' + devices);
 *		})
 *		.catch((e) => {
 *			console.log('error ', e);
 *		});
 */

//import request from '@root/request';
//import crypto from 'crypto';

const request = require('@root/request');
const crypto = require('crypto');

const LOGIN_SID_ROUTE = '/login_sid.lua?version=2';
const MIN_TEMP = 8;
const MAX_TEMP = 28;

/**
 * @param username = mandatory
 * @param password = mandatory
 */
class Fritz {
	constructor(username, password, uri) {
		this.sid = null; // bringt nichts da hier derzeitig nichts gemerkt wird, gegenüber fritzapi wird in executeCMD die SID ermittelt und nicht übergeben
		this.username = username;
		this.password = password;
		this.options = { url: uri || 'http://fritz.box' };
		this.debug = false;
	}

	/**
	 * Functions used for polling in ioBroker
	 */

	// get detailed device information (XML)
	// what to do with options
	getDeviceListInfos() {
		console.log('func call getdevlist ' + this.options);
		return this.constructor.executeCommand(this.username, this.password, this.options, 'getdevicelistinfos'); // aufruf einer statischen Klasse nur über this.constructor
	}
	// get template information (XML)
	getTemplateListInfos() {
		console.log('func call gettempl' + this.options);
		return this.constructor.executeCommand(this.username, this.password, this.options, 'gettemplatelistinfos');
	}

	/**
	 * other generic functions
	 */
	// get basic device stats (XML)
	getBasicDeviceStats(ain) {
		return this.constructor.executeCommand(this.username, this.password, this.options, 'getbasicdevicestats', ain);
	}
	// get color defaults (XML)
	getColorDefaults() {
		return this.constructor.executeCommand(this.username, this.password, this.options, 'getcolordefaults');
	}
	// check of permissions
	getUserPermissions() {
		return this.constructor.getPermissions(this.username, this.password, this.options);
	}

	/***
	 * device specific requests
	 */

	// turn an outlet on. returns the state the outlet was set to
	setSwitchOn(ain) {
		return this.constructor
			.executeCommand(this.username, this.password, this.options, 'setswitchon', ain)
			.then(function(body) {
				return /^1/.test(body); // true if on
			});
	}

	// turn an outlet off. returns the state the outlet was set to
	setSwitchOff(ain) {
		return this.constructor
			.executeCommand(this.username, this.password, this.options, 'setswitchoff', ain)
			.then(function(body) {
				return /^1/.test(body); // false if off
			});
	}

	// turn an device on. returns the state the outlet was set to
	setSimpleOn(ain) {
		return this.constructor
			.executeCommand(this.username, this.password, this.options, 'setsimpleonoff&onoff=1', ain)
			.then(function(body) {
				// api does not return a value
				return 'OK'; // true if on
			});
	}

	// turn an device off. returns the state the outlet was set to
	setSimpleOff(ain) {
		return this.constructor
			.executeCommand(this.username, this.password, this.options, 'setsimpleonoff&onoff=0', ain)
			.then(function(body) {
				// api does not return a value
				return 'OK';
			});
	}

	// set target temperature (Solltemperatur)
	setTempTarget(ain, temp) {
		return this.constructor
			.executeCommand(
				this.username,
				this.password,
				this.options,
				'sethkrtsoll&param=' + this.constructor.temp2api(temp),
				ain
			)
			.then(function(body) {
				// api does not return a value
				return temp;
			});
	}

	// set thermostat boost
	setHkrBoost(ain, time) {
		return this.constructor
			.executeCommand(this.username, this.password, this.options, 'sethkrboost&endtimestamp=' + time, ain)
			.then(function(body) {
				// api returns the accepted endtimestamp
				return body;
			});
	}

	// set window open status
	setWindowOpen(ain, time) {
		return this.constructor
			.executeCommand(this.username, this.password, this.options, 'sethkrwindowopen&endtimestamp=' + time, ain)
			.then(function(body) {
				// api returns the accepted endtimestamp
				return body;
			});
	}

	// set blind (blind etc.)
	setBlind(ain, target) {
		return this.constructor
			.executeCommand(this.username, this.password, this.options, 'setblind&target=' + target, ain)
			.then(function(body) {
				// api does not return a value
				return target;
			});
	}

	// set level (dimmer etc.)
	setLevel(ain, level) {
		return this.constructor
			.executeCommand(this.username, this.password, this.options, 'setlevel&level=' + level, ain)
			.then(function(body) {
				// api does not return a value
				return level;
			});
	}

	// set color temperature
	setColorTemperature(ain, temp) {
		return this.constructor
			.executeCommand(
				this.username,
				this.password,
				this.options,
				'setcolortemperature&temperature=' + this.constructor.colortemp2api(temp) + '&duration=0',
				ain
			)
			.then(function(body) {
				// api does not return a value
				return temp;
			});
	}

	// set color hue or saturation
	setColor(ain, saturation, hue) {
		return this.constructor
			.executeCommand(
				this.username,
				this.password,
				this.options,
				'setcolor&saturation=' + saturation + '&hue=' + hue + '&duration=0',
				ain
			)
			.then(function(body) {
				// api does not return a value
				return 'OK';
			});
	}

	// apply template
	applyTemplate(ain) {
		return this.constructor
			.executeCommand(this.username, this.password, this.options, 'applytemplate', ain)
			.then(function(body) {
				return body; // returns applied id if success
			});
	}

	// not used by ioBroker
	// getswitchlist
	// getswitchstate
	// getswitchpresent
	// getswitchenergy
	// getscwitchname
	// gettemperature
	// gethkrtsoll
	// gethkrkomfort
	// gethkrabsenk

	/**
	 * ---------------------------------------
	 * static functions
	 */
	/**
	 * Function
	 * @param box_url 
	 * @param username 
	 * @param password
	 * 
	 * function called to get the sessionID
	 * returns SID
	 *  
	 * todo blocktime
	 * 
	 */
	static async get_sid(box_url, username, password, sidORrights) {
		console.log('Get a sid by solving the PBKDF2 (or MD5) challenge-response process.');
		try {
			let state = await this.get_login_state(box_url); //Aufrufe von statischen methoden aus anderen statischen methoden der gleichen Klasse mit this
			var challenge_response = null;
			//console.log('state ', state);
			if (state.pbkf2 === true) {
				console.log('PBKDF2 supported');
				challenge_response = this.calculate_pbkdf2_response(state.challenge, password);
				console.log('PBKF2 calc ' + challenge_response);
			} else {
				console.log('Falling back to MD5', state.challenge);
				challenge_response = this.calculate_md5_response(state.challenge, password);
				console.log('MD5 calc ' + challenge_response);
			}
			if (state.blocktime > 0) {
				console.log('Waiting for ' + state.blocktime + ' seconds...');
				// py time.sleep(state.blocktime);
				await new Promise((resolve) => setTimeout(resolve, state.blocktime * 1000));
				// according to python AVM reference implementation it only waits according blocking time
				// no need to start the get_sid again!
			}
			try {
				let sid = await this.send_response(box_url, username, challenge_response);
				if (sid.sessionID == '0000000000000000') {
					//console.log('wrong username or password');
					//console.log('got 0000000000000000');
					throw {
						msg: 'failed to login, wrong user name or password',
						function: 'send_response',
						error: '0000000000000000'
					};
				} else {
					if (sidORrights === true) {
						//console.log('SID ', sid.sessionID);
						return sid.sessionID;
					} else {
						//console.log('rights ', sid.rights);
						return sid.rights;
					}
				}
			} catch (e) {
				console.log('failed to login', e);
				throw e;
			}
		} catch (e) {
			console.log('failed to get challenge', e);
			throw e;
		}
	}

	/**
	 * Function get_login_state
	 * 
	 * @param box_url 
	 * 
	 * function called from get_sid
	 * returns
	 * challenge
	 * blocktime
	 * pbkf2 = true when new login mechanism is used
	 * 
	 */
	static get_login_state(box_url) {
		return new Promise(function(resolve, reject) {
			console.log('Get login state from FRITZ!Box using login_sid.lua?version=2', box_url, LOGIN_SID_ROUTE);
			box_url = box_url + LOGIN_SID_ROUTE;
			request(box_url, function(error, response) {
				if (error) {
					//console.log('get_login_state error:', error); // Print the error if one occurred
					reject({
						msg: 'get error in http request',
						function: 'get_login_state',
						error: error,
						response: response
					});
				} else {
					//console.log('statusCode:', response.statusCode); // Print the response status code if a response was received
					//console.log('body: ', response.body); // Print the XML
					if (response.body) {
						let challenge = response.body.match('<Challenge>(.*?)</Challenge>')[1];
						let blocktime = Math.floor(response.body.match('<BlockTime>(.*?)</BlockTime>')[1]);
						let pbkf2 = challenge.startsWith('2$') ? true : false;
						//console.log('get login state result: ' + challenge + ' blocktime: ' + blocktime + ' pb: ' + pbkf2);
						resolve({ challenge: challenge, blocktime: blocktime, pbkf2: pbkf2 });
					} else {
						reject({
							msg: 'http request successfull, but empty response.body',
							function: 'get_login_state',
							error: 'empty response.body',
							response: response.statusCode
						});
					}
				}
			});
		});
	}

	/**
	 * Function to calculate the challenge response for Fritzbox FW >7.24
	 * @param challenge 
	 * @param password 
	 */
	static calculate_pbkdf2_response(challenge, password) {
		console.log('Calculate the response for a given challenge via PBKDF2');
		let challenge_parts = challenge.split('$');
		//console.log('challange ' + challenge_parts);
		// Extract all necessary values encoded into the challenge
		// first = [0] is the "2" for indicating pbkf2
		let iter1 = Math.floor(challenge_parts[1]);
		let salt1 = Math.hex(challenge_parts[2]);
		let iter2 = Math.floor(challenge_parts[3]);
		let salt2 = Math.hex(challenge_parts[4]);
		// Hash twice, once with static salt...
		// Once with dynamic salt.
		// js var derivedKey = pbkdf2.pbkdf2Sync('password', 'salt', 1, 32, 'sha512')
		// py hash1 = hashlib.pbkdf2_hmac("sha256", password.encode(), salt1, iter1)
		let hash1 = crypto.pbkdf2Sync(password, salt1, iter1, 32, 'sha512');
		// py hash2 = hashlib.pbkdf2_hmac("sha256", hash1, salt2, iter2)
		let hash2 = crypto.pbkdf2Sync(hash1, salt2, iter2, 32, 'sha512');
		// response salt2 + hash2
		return challenge_parts[4] + hash2.hex();
	}

	/**
	 * Function to calculate the challenge response Fritzbox FW <7.24 
	 * @param challenge 
	 * @param password 
	 */
	static calculate_md5_response(challenge, password) {
		console.log('Calculate the response for a challenge using legacy MD5');
		// response = challenge + "-" + password
		// the legacy response needs utf_16_le encoding
		let md5_sum = crypto
			.createHash('md5')
			.update(Buffer.from(challenge + '-' + password, 'UTF-16LE'))
			.digest('hex');
		let response = challenge + '-' + md5_sum;
		return response;
	}

	/**
	 * Function to get the sessionID from sending the challenge response
	 * @param box_url 
	 * @param username 
	 * @param challenge_response 
	 * 
	 * returns sessionID
	 */
	static async send_response(box_url, username, challenge_response) {
		return new Promise(function(resolve, reject) {
			console.log('send_resp #1 ' + box_url);
			//console.log('Send the response and return the parsed sid. raises an Exception on error');
			// Build response params
			let post_data_dict = { username: username, response: challenge_response };
			//post_data = urllib.parse.urlencode(post_data_dict).encode();
			let headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
			// let url = box_url + LOGIN_SID_ROUTE;
			box_url += LOGIN_SID_ROUTE;
			// Send response
			// Parse SID from resulting XML.
			console.log('send_resp #2 ' + box_url);
			request.post({ url: box_url, headers: headers, form: post_data_dict }, function(error, response) {
				//request.post({ url: url, headers: headers, form: post_data_dict }, function(error, response) {
				if (error) {
					console.log('error:', error); // Print the error if one occurred
					reject({
						msg: 'http post request error',
						function: 'send_reponse',
						error: error,
						response: response
					});
				} else {
					console.log('send_resp #3 ' + box_url);
					//console.log('statusCode:', response.statusCode); // Print the response status code if a response was received
					//console.log('body:', response.body); // Print the XML answer.
					let sessionID = response.body.match('<SID>(.*?)</SID>')[1]; //sessionID is array, the second item is the SID
					// console.log('got sessionID ', sessionID);
					let rights = response.body.match('<Rights>(.*?)</Rights>')[1];
					resolve({ sessionID: sessionID, rights: rights });
				}
			});
		});
	}

	// the only function where we use the path
	// not used, memorizing of sid would only be possible in calling program, would require to return it
	// untested und executeCMD verarbeitet das dauch noch nicht
	static check_SID(sid, options) {
		return executeCommand(null, null, null, null, null, options, '/login_sid.lua', sid).then(function(body) {
			var sessionID = body.match('<SID>(.*?)</SID>')[1];
			if (sessionID === '0000000000000000') {
				return Promise.reject(sessionID);
			}
			return sessionID;
		});
	}
	// logout function
	static logout_SID(sid) {
		// to be implemnted when necessary
	}

	/**
	 * 
	 * @param path 
	 * @param req 
	 * @param options 
	 */
	static fritzAHA_Request(path, req, options) {
		console.log('#1 AHA ' + path + ' ' + JSON.stringify(req) + ' ' + options);
		//req = Object.assign(req, path, options);
		console.log('#2 AHA ' + path + ' ' + JSON.stringify(req) + ' ' + options);
		return new Promise(function(resolve, reject) {
			req.url += path;
			console.log('#3 AHA ' + path + ' ' + JSON.stringify(req) + ' ' + options);
			request(req, function(error, response, body) {
				if (error || !/^2/.test('' + response.statusCode) || /action=".?login.lua"/.test(body)) {
					if (/action=".?login.lua"/.test(body)) {
						// fake failed login if redirected to login page without HTTP 403
						response.statusCode = 403;
					}
					reject({
						msg: 'AHA request error',
						function: 'fritzAHA_Request',
						error: error,
						response: response,
						options: req
					});
				} else {
					// console.log('aha ', body);
					resolve(body.trim());
				}
			});
		});
	}

	/**
	 * 
	 * @param username from constructor
	 * @param password from constructor
	 * @param url = url of fritzbox from constructor
	 * @param command = fritzbox command
	 * @param ain = device identifier from function call
	 * @param options = options for the http.request e.g. strictSSL from constructor?
	 * @param path = alternative path, if set then it is not an call of fritzbox command e.g. for check of session
	 * 
	 * 
	 */
	static async executeCommand(username, password, url, command, ain, options, path) {
		console.log('exeCMD ', url, options, command, ain, options, path);
		if (!path) {
			path = '/webservices/homeautoswitch.lua?0=0';
		}
		let sid = await this.get_sid(url.url, username, password, true);
		//console.log('execCMD sid ', sid, command);
		if (sid) {
			console.log('execCMD #2 ' + JSON.stringify(url));
			if (sid) path += '&sid=' + sid;
			if (command) path += '&switchcmd=' + command;
			if (ain) path += '&ain=' + ain;
			// console.log('valid SID ' + path);
			// path includes the whole command string including SID
			console.log('exeCMD #3 ', path, JSON.stringify(url), options);
			return this.fritzAHA_Request(path, url, options); //here url must stay as {}, in fritzAHA_Request it is merged with others via Object.assign
		} else {
			// console.log('schiefgelaufen'); // todo better error catch
			throw {
				msg: 'error in get_sid or sid is invalid',
				function: 'executeCommand',
				error: 'no SID from get_SID'
			};
		}
	}

	/**
	 * Function to return the permissions
	 * @param username 
	 * @param password 
	 * @param url 
	 */
	static async getPermissions(username, password, url) {
		//console.log('exec permiss ', url, username, password);
		//try
		let rights = await this.get_sid(url.url, username, password, false);
		if (rights) {
			//console.log('rights ' + rights);
			return rights;
		} else {
			throw {
				msg: 'error in get_sid or settings in fritzbox insufficient',
				function: 'getPermissions',
				error: 'no returned rights in response'
			};
		}
	}

	//----------------internal helper--------------
	/*
	* Temperature conversion
	*/
	static temp2api(temp) {
		var res;

		if (temp == 'on' || temp === true) res = 254;
		else if (temp == 'off' || temp === false) res = 253;
		else {
			// 0.5C accuracy
			res = Math.round((Math.min(Math.max(temp, MIN_TEMP), MAX_TEMP) - 8) * 2) + 16;
		}

		return res;
	}

	static api2temp(param) {
		if (param == 254) return 'on';
		else if (param == 253) return 'off';
		else {
			// 0.5C accuracy
			return (parseFloat(param) - 16) / 2 + 8;
		}
	}

	/*
	* white color temperatures
	* the AHA-API only accepts predefined color temperatures
	*/
	static colortemp2api(param) {
		if (param > 6200) return 6500;
		else if (param > 5600) return 5900;
		else if (param > 5000) return 5300;
		else if (param > 4500) return 4700;
		else if (param > 4000) return 4200;
		else if (param > 3600) return 3800;
		else if (param > 3200) return 3400;
		else if (param > 2850) return 3000;
		else return 2700;
	}
}

module.exports = Fritz;

//--------------- sample code ----------------

//var fritz = new Fritz('admin', 'password', 'http://fritz.box');
/*
fritz
	.getDeviceListInfos()
	.then(function(sid) {
		console.log('Devices' + sid);
	})
	.catch((e) => {
		console.log('Fehler ', e);
	});

fritz
	.getUserPermissions()
	.then(function(sid) {
		console.log('Rights' + sid);
	})
	.catch((e) => {
		console.log('Fehler ', e);
	});
*/
