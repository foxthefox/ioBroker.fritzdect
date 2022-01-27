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
 * refactored version 30.12.2021
 * first version 19.12.2020
 *
 */

//import crypto from 'crypto';

const crypto = require('crypto');

const LOGIN_SID_ROUTE = '/login_sid.lua?version=2';
const SMARTHOME_ROUTE = '/webservices/homeautoswitch.lua?0=0';
const MIN_TEMP = 8;
const MAX_TEMP = 28;

class Fritz {
	/**
	 * @param {string} username
	 * @param {string} password
	 * @param {string} uri
	 * @param {object} options
	 */
	constructor(username, password, uri, options) {
		this.sid = null;
		this.username = username;
		this.password = password;
		this.url = { url: uri || 'http://fritz.box' };
		this.options = options;
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
			const body = this.executeCommand2('getdevicelistinfos', '', 1); // aufruf einer statischen Klasse nur über this.constructor
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}
	// get template information (XML)
	async getTemplateListInfos() {
		try {
			const body = this.executeCommand2('gettemplatelistinfos', '', 1);
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
			const body = this.executeCommand2('getbasicdevicestats', ain, 1);
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}
	// get color defaults (XML)
	async getColorDefaults() {
		try {
			const body = this.executeCommand2('getcolordefaults', '', 1);
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
			const body = await this.executeCommand2('setswitchon', ain, 1);
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
			const body = await this.executeCommand2('setswitchoff', ain, 1);
			return Promise.resolve(/^1/.test(body));
		} catch (error) {
			return Promise.reject(error);
		}
	}
	//set switchtoggle
	async setSwitchToggle(ain) {
		try {
			const body = await this.executeCommand2('setswitchtoggle', ain, 1);
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
			const body = await this.executeCommand2('setsimpleonoff&onoff=1', ain, 1);
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
			const body = await this.executeCommand2('setsimpleonoff&onoff=0', ain, 1);
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
			const body = await this.executeCommand2('sethkrtsoll&param=' + Fritz.temp2api(temp), ain, 1);
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
			const body = await this.executeCommand2('sethkrboost&endtimestamp=' + time, ain, 1);
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
			const body = await this.executeCommand2('sethkrwindowopen&endtimestamp=' + time, ain, 1);
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
			const body = await this.executeCommand2('setblind&target=' + target, ain, 1);
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
			const body = await this.executeCommand2('setlevel&level=' + level, ain, 1);
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
			const body = await this.executeCommand2('applytemplate', ain, 1);
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	// not used by ioBroker
	// getswitchlist
	async getSwitchList() {
		try {
			const body = this.executeCommand2('getswitchlist', '', 1);
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}
	// getswitchstate
	async getSwitchState(ain) {
		try {
			const body = this.executeCommand2('getswitchstate', ain, 1);
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}
	// getswitchpresent
	async getSwitchPresent(ain) {
		try {
			const body = this.executeCommand2('getswitchpresent', ain, 1);
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}
	// getswitchenergy
	async getSwitchEnergy(ain) {
		try {
			const body = this.executeCommand2('getswitchenergy', ain, 1);
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}
	// getswitchname
	async getSwitchName(ain) {
		try {
			const body = this.executeCommand2('getswitchname', ain, 1);
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}
	// gettemperature
	async getTemperature(ain) {
		try {
			const body = this.executeCommand2('gettemperature', ain, 1);
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}
	// gethkrtsoll
	async getHkrTsoll(ain) {
		try {
			const body = this.executeCommand2('gethkrtsoll', ain, 1);
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}
	// gethkrkomfort
	async getHkrKomfort(ain) {
		try {
			const body = this.executeCommand2('gethkrkomfort', ain, 1);
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}
	// gethkrabsenk
	async getHkrAbsenk(ain) {
		try {
			const body = this.executeCommand2('gethkrabsenk', ain, 1);
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}
	// getdeviceinfos
	async getDeviceInfos(ain) {
		try {
			const body = this.executeCommand2('getdevicelistinfos', ain, 1);
			return Promise.resolve(body);
		} catch (error) {
			return Promise.reject(error);
		}
	}
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
		if (this.debug) console.log('Get a sid by solving the PBKDF2 (or MD5) challenge-response process.');
		try {
			const state = await this.get_login_state(box_url); //Aufrufe von statischen methoden aus anderen statischen methoden der gleichen Klasse mit this
			let challenge_response = null;
			//console.log('state ', state);
			if (state.pbkf2 === true) {
				if (this.debug) console.log('PBKDF2 supported');
				this.newVersion = true;
				challenge_response = this.calculate_pbkdf2_response(state.challenge, password);
				if (this.debug) console.log('PBKF2 calc ' + challenge_response);
			} else {
				if (this.debug) console.log('Falling back to MD5', state.challenge);
				this.newVersion = false;
				challenge_response = this.calculate_md5_response(state.challenge, password);
				if (this.debug) console.log('MD5 calc ' + challenge_response);
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
				throw {
					msg: 'failed to login',
					function: 'send_response',
					error: e
				};
			}
		} catch (e) {
			console.log('failed to get challenge', e);
			throw {
				msg: 'failed to get challenge',
				function: 'get_sid',
				error: e
			};
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
		if (box_url) {
			let http = null;
			let defaultport = null;
			const req_url = new URL(box_url);
			const hostname = req_url.hostname;
			const port = req_url.port;

			const protocol = req_url.protocol;
			if (protocol == 'http:') {
				http = require('http');
				defaultport = 80;
				if (this.debug) console.log('using http');
			} else if (protocol == 'https:') {
				http = require('https');
				defaultport = 443;
				//http.globalAgent.options.secureProtocol = 'SSLv3_method';
				if (this.debug) console.log('using https');
			} else {
				console.log('invalid protocol');
			}

			const options = {
				hostname: hostname,
				port: port || defaultport,
				path: LOGIN_SID_ROUTE,
				method: 'GET',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				rejectUnauthorized: false
			};

			let p = new Promise((resolve, reject) => {
				const req = http.request(options, (res) => {
					res.setEncoding('utf8');
					if (res.statusCode !== 200) {
						console.log(`HTTP request Failed. Status Code: ${res.statusCode}`);
						reject({
							msg: 'http.request error',
							function: 'get_login_state',
							error: res.statusCode,
							response: res
						});
					}
					// cumulate data
					let responseBody = ''; // let body = []
					res.on('data', (chunk) => {
						responseBody += chunk; //body.push(chunk)
					});
					// resolve on end
					res.on('end', () => {
						if (responseBody) {
							const challenge = responseBody.match('<Challenge>(.*?)</Challenge>')[1];
							const blocktime = Math.floor(responseBody.match('<BlockTime>(.*?)</BlockTime>')[1]);
							const pbkf2 = challenge.startsWith('2$') ? true : false;
							//console.log('get login state result: ' + challenge + ' blocktime: ' + blocktime + ' pb: ' + pbkf2);
							resolve({ challenge: challenge, blocktime: blocktime, pbkf2: pbkf2 });
						} else {
							reject({
								msg: 'error http.request: no body received',
								function: 'get_login_state',
								error: 'no explizit error'
							});
						}
					});
				});
				// reject on request error
				req.on('error', (err) => {
					// This is not a "Second reject", just a different sort of failure
					reject({
						msg: 'error http.request',
						function: 'get_login_state',
						error: err
					});
				});
				//always necessary
				req.end();
			});
			return await p;
		} else {
			if (!box_url) console.log('Please provide the IP Address.');
		}
	}

	/**
	 * Function to calculate the challenge response for Fritzbox FW >7.24
	 * @param {string} challenge
	 * @param {crypto.BinaryLike} password
	 */
	calculate_pbkdf2_response(challenge, password) {
		if (this.debug) console.log('Calculate the response for a given challenge via PBKDF2');
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
		if (this.debug) console.log('Calculate the response for a challenge using legacy MD5');
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
		if (box_url && username && challenge_response) {
			let http = null;
			let defaultport = null;
			const req_url = new URL(box_url);
			const hostname = req_url.hostname;
			const port = req_url.port;

			const protocol = req_url.protocol;
			if (protocol == 'http:') {
				http = require('http');
				defaultport = 80;
				if (this.debug) console.log('using http');
			} else if (protocol == 'https:') {
				http = require('https');
				defaultport = 443;
				//http.globalAgent.options.secureProtocol = 'SSLv3_method';
				if (this.debug) console.log('using https');
			} else {
				console.log('invalid protocol');
			}
			const xFormBody = `${encodeURI('username')}=${encodeURI(username)}&${encodeURI('response')}=${encodeURI(
				challenge_response
			)}`;
			const post_data_dict = { username: username, response: challenge_response };
			const options = {
				hostname: hostname,
				port: port || defaultport,
				path: LOGIN_SID_ROUTE,
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Content-Length': Buffer.byteLength(xFormBody)
				},
				rejectUnauthorized: false
			};

			let p = new Promise((resolve, reject) => {
				const req = http.request(options, (res) => {
					res.setEncoding('utf8');
					if (res.statusCode !== 200) {
						console.log(`HTTP request Failed. Status Code: ${res.statusCode}`);
						reject({
							msg: 'http.request error',
							function: 'send_response',
							error: res.statusCode,
							response: res
						});
					}
					// cumulate data
					let responseBody = ''; // let body = []
					res.on('data', (chunk) => {
						responseBody += chunk; //body.push(chunk)
					});
					// resolve on end
					res.on('end', () => {
						if (responseBody) {
							//console.log('statusCode:', response.statusCode); // Print the response status code if a response was received
							//console.log('body:', responseBody); // Print the XML answer.
							const sessionID = responseBody.match('<SID>(.*?)</SID>')[1]; //sessionID is array, the second item is the SID
							// console.log('got sessionID ', sessionID);
							const rights = responseBody.match('<Rights>(.*?)</Rights>')[1];
							resolve({ sessionID: sessionID, rights: rights });
							//resolve(responseBody); //resolve(body);
						} else {
							reject({
								msg: 'error http.request: no body received',
								function: 'send_response',
								error: 'no responseBody'
							});
						}
					});
				});
				// reject on request error
				req.on('error', (err) => {
					// This is not a "Second reject", just a different sort of failure
					reject({
						msg: 'error http.request: error',
						function: 'send_response',
						error: err
					});
				});
				req.write(xFormBody);
				//always necessary
				req.end();
			});
			return await p;
		} else {
			if (!box_url) console.log('Please provide the IP Address.');
			else if (!username) console.log('Please provide a username.');
			else if (!challenge_response) console.log('Please provide the user session token.');
		}
	}

	// Ende LoginVerfahren
	//-------------------------------------

	/**
	 * BasisFunktion für logout und checkSid
	 * @param {string | number | null} command = fritzbox command
	 * @param {string} path = alternative path, if set then it is not an call of fritzbox command e.g. for check of session
	 * @param {string} sid
	 */
	async executeCommand(command, path, sid) {
		//eigentlich keine Aufrufe mit path=null mehr
		if (!path) {
			console.log('no path delivered');
		}
		const boxurl = this.url.url;

		//console.log('execCMD sid ', sid, command);

		if (sid) path += '&sid=' + sid;
		if (command) path += '&logout=' + command;
		// console.log('valid SID ' + path);
		// path includes the whole command string including SID
		// when using url in next cmd, the url.url contains altered (appended path), no glue hwre it comes from, so using boxurl is unaltered
		return this.fritzAHA_Request(path, boxurl, this.options); //here url must stay as {}, in fritzAHA_Request it is merged with others via Object.assign
	}

	/**
	 * Basisfunktion für smarthome-commandos
	 * falls SID abgelaufen, dann einmaliger login-Versuch
	 * @param {string} command
	 * @param {string} ain
	 * @param {number} loop
	 */
	async executeCommand2(command, ain, loop) {
		const count = 1;
		let reqpath = SMARTHOME_ROUTE;
		const boxurl = this.url.url;
		if (this.sid) reqpath += '&sid=' + this.sid;
		if (command) reqpath += '&switchcmd=' + command;
		if (ain) reqpath += '&ain=' + ain;
		// console.log('valid SID ' + path);
		// path includes the whole command string including SID
		try {
			const response = await this.fritzAHA_Request(reqpath, boxurl, this.options);
			if (response) {
				return Promise.resolve(response);
			}
		} catch (error) {
			// das ist ein wenig tricky, der http.request wirft einen Fehler, also landet man hier
			// damit ist der erste Aufruf beendet, aber in der catch routine wird ein 2ter Aufruf versucht
			// dessen erfolgreicher Abschluß führt dann insgesamt zu einem Erfolg
			if (this.debug) console.log('ERROR ');
			if (count === loop) {
				const login = await this.login_SID();
				if (login === true) {
					const secondresponse = await this.executeCommand2(command, ain, 2);
					//hier wird durchgereicht
					return Promise.resolve(secondresponse);
				} else {
					// console.log('schiefgelaufen'); // todo better error catch
					throw {
						msg: 'error in get_sid or SID is invalid',
						function: 'executeCommand',
						error: 'no SID from get_SID()'
					};
				}
			}
			// loop === 2
			return Promise.reject({
				msg: 'relogin failed',
				function: 'executeCommand2',
				error: error
			});
		}
	}

	/**
	 * @param {string} path
	 * @param {string} box_url
	 * @param {object} addOptions
	 */
	async fritzAHA_Request(path, box_url, addOptions) {
		if (box_url && path) {
			let http = null;
			let defaultport = null;
			const req_url = new URL(box_url);
			const hostname = req_url.hostname;
			const port = req_url.port;

			const protocol = req_url.protocol;
			if (protocol == 'http:') {
				http = require('http');
				defaultport = 80;
				if (this.debug) console.log('using http');
			} else if (protocol == 'https:') {
				http = require('https');
				defaultport = 443;
				//http.globalAgent.options.secureProtocol = 'SSLv3_method';
				if (this.debug) console.log('using https');
			} else {
				console.log('invalid protocol');
			}
			const options = {
				hostname: hostname,
				port: port || defaultport,
				path: path,
				method: 'GET',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				rejectUnauthorized: false
			};
			Object.assign(options, addOptions);

			let p = new Promise((resolve, reject) => {
				const req = http.request(options, (res) => {
					res.setEncoding('utf8');
					if (res.statusCode !== 200) {
						// throw Error(`HTTP request Failed. Status Code: ${res.statusCode}`);
						console.log(`HTTP request Failed. Status Code: ${res.statusCode}`);
						reject({
							msg: 'AHA request error',
							function: 'fritzAHA_Request',
							error: res.statusCode,
							response: res
						});
					}
					// cumulate data
					let responseBody = ''; // let body = []
					res.on('data', (chunk) => {
						responseBody += chunk; //body.push(chunk)
					});
					// resolve on end
					res.on('end', () => {
						if (responseBody) {
							//console.log('statusCode:', response.statusCode); // Print the response status code if a response was received
							//console.log('body:', responseBody); // Print the XML answer.
							resolve(responseBody.trim());
						} else {
							reject({
								msg: 'error http.request: no body received',
								function: 'fritzAHA_Request',
								error: 'no explizit error'
							});
						}
					});
				});
				// reject on request error
				req.on('error', (err) => {
					// This is not a "Second reject", just a different sort of failure
					reject({
						msg: 'error http.request: error',
						function: 'fritzAHA_Request',
						error: err
					});
				});
				//always necessary
				req.end();
			});
			return await p;
		} else {
			if (!box_url) console.log('Please provide the IP Address.');
			else if (!path) console.log('Please provide a valid path.');
		}
	}

	//------------------- user related functions -----------------------
	/**
	 * 
	 * @returns Object {sessicn: boolean, rights: xml}
	 */
	async check_SID() {
		let path = '';
		if (this.newVersion) {
			path = '/login_sid.lua?version=2';
		} else {
			path = '/login_sid.lua';
		}
		try {
			const body = await this.executeCommand(null, path, this.sid);
			const sessionID = body.match('<SID>(.*?)</SID>')[1];
			const rights = body.match('<Rights>(.*?)</Rights>')[1];
			if (sessionID == this.sid) {
				return Promise.resolve({ session: true, rights: rights });
			}
			if (sessionID === '0000000000000000') {
				return Promise.reject({
					msg: 'error calling executeCommand',
					function: 'check_SID',
					error: sessionID
				});
			}
		} catch (error) {
			return Promise.reject({
				msg: 'error calling executeCommand',
				function: 'check_SID',
				error: error
			});
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
			const body = await this.executeCommand(1, path, this.sid);
			const sessionID = body.match('<SID>(.*?)</SID>')[1];
			if (sessionID !== '0000000000000000') {
				return Promise.reject(false);
			}
			return Promise.resolve(true);
		} catch (error) {
			return Promise.reject({
				msg: 'error calling executeCommand',
				function: 'logout_SID',
				error: error
			});
		}
	}
	/**
	 * Function to return the permissions
	 * @returns boolean if SID was obtained
	 */
	async login_SID() {
		try {
			const sid = await this.get_sid(this.url.url, this.username, this.password, true); //instead of using url.url better to use the boxurl
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
			return Promise.reject({
				msg: 'error calling executeCommand',
				function: 'login_SID',
				error: error
			});
		}
	}

	/**
	 * Function to return the permissions
	 * @returns bolean if sufficient rights are there
	 */

	async getPermissions() {
		//console.log('exec permiss ', url, username, password);
		try {
			const rights = await this.get_sid(this.url.url, this.username, this.password, false);
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
			return Promise.reject({
				msg: 'error calling get_sid',
				function: 'getPermissions',
				error: error
			});
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
var fritz = new Fritz('admin', 'password', 'http://localhost.3333');

async function test() {
	const login = await fritz.login_SID().catch((e) => {
		console.log('fault calling login() ', e);
	});
	console.log('login', login);
	if (login) {
		await fritz
			.getDeviceListInfos()
			.then(function(response) {
				console.log('Devices' + response);
			})
			.catch((e) => {
				console.log('Fehler Devicelist ', e);
			});

		await fritz
			.getUserPermissions()
			.then(function(response) {
				console.log('Rights : ' + response);
			})
			.catch((e) => {
				console.log('Fehler getUserPermissions', e);
			});

		await fritz
			.check_SID()
			.then(function(response) {
				console.log('Checkresponse : ' + response);
			})
			.catch((e) => {
				console.log('Fehler checkSID', e);
			});
		await fritz
			.logout_SID()
			.then(function(response) {
				console.log('logout : ' + response);
			})
			.catch((e) => {
				console.log('Fehler logout_SID', e);
			});
	}
	//with relogin
	await fritz
		.getDeviceListInfos()
		.then(function(response) {
			console.log('Devices' + response);
		})
		.catch((e) => {
			console.log('Fehler Devicelist ', e);
		});
	await fritz
		.logout_SID()
		.then(function(response) {
			console.log('logout : ' + response);
		})
		.catch((e) => {
			console.log('Fehler logout_SID', e);
		});
}
test();
*/
