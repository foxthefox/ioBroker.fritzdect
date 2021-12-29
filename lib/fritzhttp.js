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

class Fritz {
	/**
	 * @param {string} username
	 * @param {string} password
	 * @param {string} uri
	 * @param {boolean} strictssl
	 */
	constructor(username, password, uri, strictssl) {
		this.sid = null; // bringt nichts da hier derzeitig nichts gemerkt wird, gegenüber fritzapi wird in executeCMD die SID ermittelt und nicht übergeben
		this.username = username;
		this.password = password;
		this.options = { url: uri || 'http://fritz.box', strictSSL: strictssl };
		this.debug = false;
		this.newVersion = null;
	}

	/**
	 * Functions used for polling in ioBroker
	 */

	// get detailed device information (XML)
	// what to do with options
	async getDeviceListInfos() {
		try {
			const body = this.executeCommand2('getdevicelistinfos', '', '', '', 1); // aufruf einer statischen Klasse nur über this.constructor
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}
	// get template information (XML)
	async getTemplateListInfos() {
		try {
			const body = this.executeCommand2('gettemplatelistinfos', '', '', '', 1);
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	// get basic device stats (XML)
	/**
	 * other generic functions
	 * @param {string} ain
	 */
	async getBasicDeviceStats(ain) {
		try {
			const body = this.executeCommand2('getbasicdevicestats', ain, '', '', 1);
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}
	// get color defaults (XML)
	async getColorDefaults() {
		try {
			const body = this.executeCommand2('getcolordefaults', '', '', '', 1);
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}
	// check of permissions
	async getUserPermissions() {
		try {
			const body = this.getPermissions();
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	// turn an outlet on. returns the state the outlet was set to
	/**
	 * *
	 * device specific requests
	 * @param {string} ain
	 */
	async setSwitchOn(ain) {
		try {
			const body = await this.executeCommand2('setswitchon', ain, '', '', 1);
			return Promise.resolve(/^1/.test(body));
		} catch (error) {
			return Promise.reject(error);
		}
	}

	// turn an outlet off. returns the state the outlet was set to
	/**
	 * @param {string} ain
	 */
	async setSwitchOff(ain) {
		try {
			const body = await this.executeCommand2('setswitchoff', ain, '', '', 1);
			return Promise.resolve(/^1/.test(body));
		} catch (error) {
			return Promise.reject(error);
		}
	}

	// turn an device on. returns the state the outlet was set to
	/**
	 * @param {string} ain
	 */
	async setSimpleOn(ain) {
		try {
			const body = await this.executeCommand2('setsimpleonoff&onoff=1', ain, '', '', 1);
			return Promise.resolve('OK');
		} catch (error) {
			return Promise.reject(error);
		}
	}

	// turn an device off. returns the state the outlet was set to
	/**
	 * @param {string} ain
	 */
	async setSimpleOff(ain) {
		try {
			const body = await this.executeCommand2('setsimpleonoff&onoff=0', ain, '', '', 1);
			return Promise.resolve('OK');
		} catch (error) {
			return Promise.reject(error);
		}
	}

	// set target temperature (Solltemperatur)
	/**
	 * @param {string} ain
	 * @param {string | number | boolean} temp
	 */
	async setTempTarget(ain, temp) {
		try {
			const body = await this.executeCommand2('sethkrtsoll&param=' + Fritz.temp2api(temp), ain, '', '', 1);
			return Promise.resolve(temp);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	// set thermostat boost
	/**
	 * @param {string} ain
	 * @param {string | number} time
	 */
	async setHkrBoost(ain, time) {
		try {
			const body = await this.executeCommand2('sethkrboost&endtimestamp=' + time, ain, '', '', 1);
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	// set window open status
	/**
	 * @param {string} ain
	 * @param {string | number} time
	 */
	async setWindowOpen(ain, time) {
		try {
			const body = await this.executeCommand2('sethkrwindowopen&endtimestamp=' + time, ain, '', '', 1);
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	// set blind (blind etc.)
	/**
	 * @param {string} ain
	 * @param {string} target
	 */
	async setBlind(ain, target) {
		try {
			const body = await this.executeCommand2('setblind&target=' + target, ain, '', '', 1);
			return Promise.resolve(target);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	// set level (dimmer etc.)
	/**
	 * @param {string} ain
	 * @param {string | number | boolean} level
	 */
	async setLevel(ain, level) {
		try {
			const body = await this.executeCommand2('setlevel&level=' + level, ain, '', '', 1);
			return Promise.resolve(level);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	// set color temperature
	/**
	 * @param {string} ain
	 * @param {string | number | boolean} temp
	 */
	async setColorTemperature(ain, temp) {
		try {
			const body = await this.executeCommand2(
				'setcolortemperature&temperature=' + Fritz.colortemp2api(temp) + '&duration=0',
				ain,
				'',
				'',
				1
			);
			return Promise.resolve(temp);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	// set color hue or saturation
	/**
	 * @param {string} ain
	 * @param {string | number | boolean | null} saturation
	 * @param {string | number | boolean | null} hue
	 */
	async setColor(ain, saturation, hue) {
		try {
			const body = await this.executeCommand2(
				'setcolor&saturation=' + saturation + '&hue=' + hue + '&duration=0',
				ain,
				'',
				'',
				1
			);
			return Promise.resolve('OK');
		} catch (error) {
			return Promise.reject(error);
		}
	}

	// apply template
	/**
	 * @param {string} ain
	 */
	async applyTemplate(ain) {
		try {
			const body = await this.executeCommand2('applytemplate', ain, '', '', 1);
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
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

	//--------------------------------------------
	// Login Verfahren

	/**
	 * Function
	 * @param {string} box_url
	 * @param {string} username
	 * @param {string | crypto.BinaryLike} password
	 * @param {boolean} sidORrights true = sid-request, false = rights-checking
	function called to get the sessionID
	returns boolean SIDstatus or rights
	
	todo blocktime
	 */
	async get_sid(box_url, username, password, sidORrights) {
		console.log('Get a sid by solving the PBKDF2 (or MD5) challenge-response process.');
		try {
			const state = await this.get_login_state(box_url); //Aufrufe von statischen methoden aus anderen statischen methoden der gleichen Klasse mit this
			let challenge_response = null;
			//console.log('state ', state);
			if (state.pbkf2 === true) {
				console.log('PBKDF2 supported');
				this.newVersion = true;
				challenge_response = this.calculate_pbkdf2_response(state.challenge, password);
				console.log('PBKF2 calc ' + challenge_response);
			} else {
				console.log('Falling back to MD5', state.challenge);
				this.newVersion = false;
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
				const sid = await this.send_response(box_url, username, challenge_response);
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
						this.sid = sid.sessionID;
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
	 * function called from get_sid
	 * @param {string} box_url 
	* returns
	* challenge
	* blocktime
	* pbkf2 = true when new login mechanism is used
	 */
	async get_login_state(box_url) {
		return new Promise(function(resolve, reject) {
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
						const challenge = response.body.match('<Challenge>(.*?)</Challenge>')[1];
						const blocktime = Math.floor(response.body.match('<BlockTime>(.*?)</BlockTime>')[1]);
						const pbkf2 = challenge.startsWith('2$') ? true : false;
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
	 * @param {string} challenge
	 * @param {crypto.BinaryLike} password
	 */
	calculate_pbkdf2_response(challenge, password) {
		console.log('Calculate the response for a given challenge via PBKDF2');
		const challenge_parts = challenge.split('$');
		//console.log('challange ' + challenge_parts);
		// Extract all necessary values encoded into the challenge
		// first = [0] is the "2" for indicating pbkf2
		const iter1 = Math.floor(challenge_parts[1]);
		const salt1 = Buffer.from(challenge_parts[2], 'hex');
		const iter2 = Math.floor(challenge_parts[3]);
		const salt2 = Buffer.from(challenge_parts[4], 'hex');
		// Hash twice, once with static salt...
		// Once with dynamic salt.
		// py hash1 = hashlib.pbkdf2_hmac("sha256", password.encode(), salt1, iter1)
		const hash1 = crypto.pbkdf2Sync(password, salt1, iter1, 32, 'sha256');
		// py hash2 = hashlib.pbkdf2_hmac("sha256", hash1, salt2, iter2)
		const hash2 = crypto.pbkdf2Sync(hash1, salt2, iter2, 32, 'sha256');
		// response salt2 + hash2
		return challenge_parts[4] + '$' + hash2.toString('hex');
	}

	/**
	 * Function to calculate the challenge response Fritzbox FW <7.24
	 * @param {string} challenge
	 * @param {string} password
	 */
	calculate_md5_response(challenge, password) {
		console.log('Calculate the response for a challenge using legacy MD5');
		// response = challenge + "-" + password
		// the legacy response needs utf_16_le encoding
		const md5_sum = crypto
			.createHash('md5')
			.update(Buffer.from(challenge + '-' + password, 'utf16le'))
			.digest('hex');
		const response = challenge + '-' + md5_sum;
		return response;
	}

	/**
	 * Function to get the sessionID from sending the challenge response
	 * @param {string} box_url
	 * @param {string} username
	 * @param {string} challenge_response returns sessionID
	 */
	async send_response(box_url, username, challenge_response) {
		return new Promise(function(resolve, reject) {
			//console.log('Send the response and return the parsed sid. raises an Exception on error');
			// Build response params
			const post_data_dict = { username: username, response: challenge_response };
			//post_data = urllib.parse.urlencode(post_data_dict).encode();
			const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
			// let url = box_url + LOGIN_SID_ROUTE;
			box_url += LOGIN_SID_ROUTE;
			// Send response
			// Parse SID from resulting XML.
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
					//console.log('statusCode:', response.statusCode); // Print the response status code if a response was received
					//console.log('body:', response.body); // Print the XML answer.
					const sessionID = response.body.match('<SID>(.*?)</SID>')[1]; //sessionID is array, the second item is the SID
					// console.log('got sessionID ', sessionID);
					const rights = response.body.match('<Rights>(.*?)</Rights>')[1];
					resolve({ sessionID: sessionID, rights: rights });
				}
			});
		});
	}

	// Ende LoginVerfahren
	//-------------------------------------

	/**
	 * BasisFunktion für logout und checkSid
	 * @param {string | number | null} command = fritzbox command
	 * @param {null} options = options for the http.request e.g. strictSSL from constructor?
	 * @param {string} path = alternative path, if set then it is not an call of fritzbox command e.g. for check of session
	 * @param {string} sid
	 */
	async executeCommand(command, options, path, sid) {
		if (!path) {
			path = '/webservices/homeautoswitch.lua?0=0';
		}
		const boxurl = this.options.url;

		//console.log('execCMD sid ', sid, command);

		if (sid) path += '&sid=' + sid;
		if (command) path += '&logout=' + command;
		// console.log('valid SID ' + path);
		// path includes the whole command string including SID
		// when using url in next cmd, the url.url contains altered (appended path), no glue hwre it comes from, so using boxurl is unaltered
		return this.fritzAHA_Request(path, { url: boxurl }, options); //here url must stay as {}, in fritzAHA_Request it is merged with others via Object.assign
	}

	/**
	 * Basisfunktion für smarthome-commandos
	 * falls SID abgelaufen, dann einmaliger login-Versuch
	 * @param {string} command
	 * @param {string} ain
	 * @param {string} options (fall noch irgendwie was mitgegeben werden soll)
	 * @param {string} path
	 * @param {number} loop
	 */
	async executeCommand2(command, ain, options, path, loop) {
		const count = 1;
		//path wird nicht ausgewertet, weil immer smarthome, ansonsten ist executeCommand zu verwenden
		let reqpath = '/webservices/homeautoswitch.lua?0=0';
		const boxurl = this.options.url;
		if (this.sid) reqpath += '&sid=' + this.sid;
		if (command) reqpath += '&switchcmd=' + command;
		if (ain) reqpath += '&ain=' + ain;
		// console.log('valid SID ' + path);
		// path includes the whole command string including SID
		// when using url in next cmd, the url.url contains altered (appended path), no glue where it comes from, so using boxurl is unaltered
		try {
			const response = await this.fritzAHA_Request(reqpath, { url: boxurl }, options); //here url must stay as {}, in fritzAHA_Request it is merged with others via Object.assign
			if (response) {
				return Promise.resolve(response);
			} else if (response.error) {
				if (response.error.code === 2 && count === loop) {
					const login = await this.login_SID();
					if (login === true) {
						const secondresponse = await this.executeCommand2(command, ain, options, path, 2);
						//hier wird durchgereicht
						return Promise.resolve(secondresponse);
					}
				} else if (loop === 2) {
					throw Error('relogin failed, no more retries');
				} else {
					throw Error(response.error);
				}
			} else {
				// console.log('schiefgelaufen'); // todo better error catch
				throw {
					msg: 'error in get_sid or sid is invalid',
					function: 'executeCommand',
					error: 'no SID from get_SID'
				};
			}
		} catch (error) {
			return Promise.reject(error);
		}
	}

	/**
	 * @param {string} path
	 * @param {{ url: any; }} req
	 * @param {string | null} options
	 */
	async fritzAHA_Request(path, req, options) {
		req = Object.assign(req, path, options); //war beim testen nicht benötigt, kann evtl. wieder rein
		return new Promise(function(resolve, reject) {
			req.url += path;
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

	//------------------- user related functions -----------------------

	// the only function where we use the path
	// not used, memorizing of sid would only be possible in calling program, would require to return it
	// untested und executeCMD verarbeitet das dauch noch nicht
	async check_SID() {
		let path = '';
		if (this.newVersion) {
			path = '/login_sid.lua?version=2';
		} else {
			path = '/login_sid.lua';
		}
		try {
			const body = await this.executeCommand(null, null, path, this.sid);
			const sessionID = body.match('<SID>(.*?)</SID>')[1];
			if (sessionID == this.sid) {
				return Promise.resolve(true);
			}
			if (sessionID === '0000000000000000') {
				return Promise.reject(sessionID);
			}
		} catch (error) {
			return Promise.reject(error);
		}
	}
	// logout function
	async logout_SID() {
		let path = '';
		if (this.newVersion) {
			path = '/login_sid.lua?version=2';
		} else {
			path = '/login_sid.lua';
		}
		try {
			const body = await this.executeCommand(1, null, path, this.sid);
			const sessionID = body.match('<SID>(.*?)</SID>')[1];
			if (sessionID !== '0000000000000000') {
				return Promise.reject(false);
			}
			return Promise.resolve(true);
		} catch (error) {
			return Promise.reject(error);
		}
	}
	/**
	 * Function to return the permissions
	 * @returns boolean if SID was obtained
	 */
	async login_SID() {
		try {
			const sid = await this.get_sid(this.options.url, this.username, this.password, true); //instead of using url.url better to use the boxurl
			console.log('login sid ', sid);
			if (sid) {
				return Promise.resolve(true);
			} else {
				// console.log('schiefgelaufen'); // todo better error catch
				throw {
					msg: 'error in get_sid or sid is invalid',
					function: 'executeCommand',
					error: 'no SID from get_SID'
				};
			}
		} catch (error) {
			return Promise.reject(error);
		}
	}

	/**
	 * Function to return the permissions
	 * @returns bolean if sufficient rights are there
	 */

	async getPermissions() {
		//console.log('exec permiss ', url, username, password);
		try {
			const rights = await this.get_sid(this.options.url, this.username, this.password, false);
			if (rights) {
				//console.log('rights ' + rights);
				return Promise.resolve(rights);
			} else {
				throw {
					msg: 'error in get_sid or settings in fritzbox insufficient',
					function: 'getPermissions',
					error: 'no returned rights in response'
				};
			}
		} catch (error) {
			return Promise.reject(error);
		}
	}

	//----------------internal helper--------------
	/*
	* Temperature conversion
	*/
	/**
	 * @param {string | number | boolean} temp
	 */
	static temp2api(temp) {
		let res;

		if (temp == 'on' || temp === true) res = 254;
		else if (temp == 'off' || temp === false) res = 253;
		else {
			// 0.5C accuracy
			res = Math.round((Math.min(Math.max(temp, MIN_TEMP), MAX_TEMP) - 8) * 2) + 16;
		}

		return res;
	}

	/**
	 * @param {string | number} param
	 */
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
/*
const Fritz = require('../fritzhttp.js');
var fritz = new Fritz('admin', 'password', 'http://this.box');

async function test(){
	const login = await fritz.login
	console.log('login', login)
	await fritz
		.getDeviceListInfos()
		.then(function(sid) {
			console.log('Devices' + sid);
		})
		.catch((e) => {
			console.log('Fehler ', e);
		});

	await fritz
		.getUserPermissions()
		.then(function(sid) {
			console.log('Rights' + sid);
		})
		.catch((e) => {
			console.log('Fehler ', e);
		});
}
	test()
*/
