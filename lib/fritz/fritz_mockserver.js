// @ts-nocheck
//server to emulate the fritzbox responses
const http = require('http');
const fs = require('fs');
const { parse } = require('querystring');
const parser = require('xml2json-light');

const path = require('path');
console.log('PATH ist ' + path.join(__dirname, './data/'));

const xmlDevicesGroups = fs.readFileSync(path.join(__dirname, './data/') + 'test_api_response.xml');
//var xmlDevicesGroups = fs.readFileSync('./test.xml');

const xmlTemplate = fs.readFileSync(path.join(__dirname, './data/') + 'template_answer.xml');

const xmlTempStat = fs.readFileSync(path.join(__dirname, './data/') + 'devicestat_temp_answer.xml');

const xmlPowerStats = fs.readFileSync(path.join(__dirname, './data/') + 'devicestat_power_answer.xml');

const xmlColorDefaults = fs.readFileSync(path.join(__dirname, './data/') + 'color_defaults.xml');

const hkr_batt = fs.readFileSync(path.join(__dirname, './data/') + 'hkr_response.xml');

const guestWlan = fs.readFileSync(path.join(__dirname, './data/') + 'guest_wlan_form.xml');

let server;

function setupHttpServer(callback) {
	//We need a function which handles requests and send response
	//Create a server
	server = http.createServer(handleHttpRequest);
	//Lets start our server
	server.listen(3333, function() {
		//Callback triggered when server is successfully listening. Hurray!
		console.log('MOCK HTTP-Server (Fritzbox Emulation) listening on: http://localhost:%s', 3333);
		console.log('for testing, setup in iobroker for second instance admin:password');
		callback();
	});
}

const secret = 'Zgfr56gFe87jJOM';
const challenge = (4294967295 + Math.floor(Math.random() * 4294967295)).toString(16).slice(-8);
const challenge2 = (4294967295 + Math.floor(Math.random() * 4294967295)).toString(16).slice(-8);
const password = 'password';
const challengeResponse =
	challenge +
	'-' +
	require('crypto').createHash('md5').update(Buffer.from(challenge + '-' + password, 'utf16le')).digest('hex');
const sid =
	(4294967295 + Math.floor(Math.random() * 4294967295)).toString(16).slice(-8) +
	(4294967295 + Math.floor(Math.random() * 4294967295)).toString(16).slice(-8);

function handleHttpRequest(request, response) {
	console.log('HTTP-Server (Fritzbox Emulation): Request: ' + request.method + ' ' + request.url);
	// requesturl zerlegen .split('?')
	// erste Teil ist entweder login oder webservice
	let reqstring = request.url.split('?');
	if (reqstring[0] == '/webservices/homeautoswitch.lua') {
		let command = reqstring[1].split('&');
		let cmdparts = {};
		for (let i = 0; i < command.length; i++) {
			let commandsplit = command[i].split('=');
			cmdparts[commandsplit[0]] = commandsplit[1];
		}
		console.log('switchcmd : ', cmdparts['switchcmd']);
		if (cmdparts.hasOwnProperty('ain')) {
			console.log('ain    : ', cmdparts['ain']);
		}
		const devices2json = parser.xml2json(String(xmlDevicesGroups));
		devices = [].concat((devices2json.devicelist || {}).device || []).map((device) => {
			// remove spaces in AINs
			device.identifier = device.identifier.replace(/\s/g, '');
			return device;
		});
		groups = [].concat((devices2json.devicelist || {}).group || []).map((group) => {
			// remove spaces in AINs
			group.identifier = group.identifier.replace(/\s/g, '');
			return group;
		});
		const templates2json = parser.xml2json(String(xmlTemplate));
		templates = [].concat((templates2json.templatelist || {}).template || []).map(function(template) {
			// remove spaces in AINs
			// template.identifier = group.identifier.replace(/\s/g, '');
			return template;
		});
		result = templates;

		//apiresponse is the xml file with AINs not having the spaces inside
		let apiresponse = {};
		apiresponse['devicelist'] = { version: '1', device: devices, group: groups };
		apiresponse['templatelist'] = { version: '1', template: templates };
		// console.log(apiresponse);
		/**
		console.log(
			'getdevicelistinfos : ' +
				JSON.stringify(apiresponse['devicelist']['device'].concat(apiresponse['devicelist']['group']))
		);
		console.log(
			'getswitchlist : ' +
				JSON.stringify(
					apiresponse['devicelist']['device']
						.filter((device) => device.hasOwnProperty('switch'))
						.map((device) => device.identifier)
						.concat(
							apiresponse['devicelist']['group']
								.filter((device) => device.hasOwnProperty('switch'))
								.map((device) => device.identifier)
						)
				)
		);
		console.log(
			'getdeviceinfos : ' +
				JSON.stringify(
					apiresponse['devicelist']['device'].filter((device) => device.identifier === '087610006161')
				)
		);
		console.log(
			'gettemperature : ' +
				JSON.stringify(
					apiresponse['devicelist']['device']
						.filter(
							(device) => device.hasOwnProperty('temperature') && device.identifier === '119600642220'
						)
						.map((device) => device.temperature.celsius)
				)
		);
		console.log('gettemplatelistinfos : ' + JSON.stringify(apiresponse['templatelist']['template']));
		console.log(
			'applytemplate : ' +
				JSON.stringify(
					apiresponse['templatelist']['template'].filter(
						(template) =>
							template.hasOwnProperty('identifier') && template.identifier === 'tmp6F0093-39091EED0'
					)[0].id
				)
		);
		console.log('getbasicdevice stats steckdose temp+power');
		console.log('getbasicdevice stats thermostat temp');
		*/
		// if (device){}
		// else if (group){}
		// else {error}
	}
	// wenn webservice dann den rechten Teil mit .split('&')
	// jeder Teil wird dann mit split('=') aufgeteilt [0] ist commando und [1] der Wert
	// Abspeichern in einem Objekt
	// if(objekt['switchcmd'] == 'getdevicelistinfos')
	// if(objekt['switchcmd'] == 'gettemperature') dann objekt['ain'] !== null und mit der in device .temp reingehen und wert übergeben, oder Methode anwenden JSON zu ändern

	if (request.url == '/login_sid.lua') {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/xml' });
		response.write(
			'<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>0000000000000000</SID><Challenge>' +
				challenge +
				'</Challenge><BlockTime>0</BlockTime><Rights></Rights></SessionInfo>'
		);
		response.end();
	} else if (request.url == '/login_sid.lua?version=2' && request.method == 'GET') {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/xml' });
		response.write(
			'<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>0000000000000000</SID><Challenge>' +
				challenge +
				'</Challenge><BlockTime>0</BlockTime><Rights></Rights></SessionInfo>'
		);
		response.end();
	} else if (request.url == '/login_sid.lua?username=admin') {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/xml' });
		response.write(
			'<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>0000000000000000</SID><Challenge>' +
				challenge +
				'</Challenge><BlockTime>0</BlockTime><Rights></Rights></SessionInfo>'
		);
		response.end();
	} else if (request.url == '/login_sid.lua?username=admin&response=' + challengeResponse) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/xml' });
		response.write(
			'<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>' +
				sid +
				'</SID><Challenge>' +
				challenge2 +
				'</Challenge><BlockTime>0</BlockTime><Rights><Name>Dial</Name><Access>2</Access><Name>App</Name><Access>2</Access><Name>HomeAuto</Name><Access>2</Access><Name>BoxAdmin</Name><Access>2</Access><Name>Phone</Name><Access>2</Access><Name>NAS</Name><Access>2</Access></Rights></SessionInfo>'
		);
		response.end();
	} else if (request.url == '/login_sid.lua?version=2' && request.method == 'POST') {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/xml' });
		response.write(
			'<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>' +
				sid +
				'</SID><Challenge>' +
				challenge2 +
				'</Challenge><BlockTime>0</BlockTime><Rights><Name>Dial</Name><Access>2</Access><Name>App</Name><Access>2</Access><Name>HomeAuto</Name><Access>2</Access><Name>BoxAdmin</Name><Access>2</Access><Name>Phone</Name><Access>2</Access><Name>NAS</Name><Access>2</Access></Rights></SessionInfo>'
		);
		response.end();
	} else if (request.url == '/login_sid.lua&sid=' + sid) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/xml' });
		response.write(
			'<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>' +
				sid +
				'</SID><Challenge>' +
				challenge2 +
				'</Challenge><BlockTime>0</BlockTime><Rights><Name>Dial</Name><Access>2</Access><Name>App</Name><Access>2</Access><Name>HomeAuto</Name><Access>2</Access><Name>BoxAdmin</Name><Access>2</Access><Name>Phone</Name><Access>2</Access><Name>NAS</Name><Access>2</Access></Rights><Users><User last="1">admin</User></Users></SessionInfo>'
		);
		response.end();
	} else if (request.url == '/login_sid.lua?version=2&sid=' + sid) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/xml' });
		response.write(
			'<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>' +
				sid +
				'</SID><Challenge>' +
				challenge2 +
				'</Challenge><BlockTime>0</BlockTime><Rights><Name>Dial</Name><Access>2</Access><Name>App</Name><Access>2</Access><Name>HomeAuto</Name><Access>2</Access><Name>BoxAdmin</Name><Access>2</Access><Name>Phone</Name><Access>2</Access><Name>NAS</Name><Access>2</Access></Rights><Users><User last="1">admin</User></Users></SessionInfo>'
		);
		response.end();
	} else if (request.url == '/login_sid.lua&sid=' + sid + '&logout=1') {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/xml' });
		response.write(
			'<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>0000000000000000</SID><Challenge>' +
				challenge2 +
				'</Challenge><BlockTime>0</BlockTime><Rights><Name>Dial</Name><Access>2</Access><Name>App</Name><Access>2</Access><Name>HomeAuto</Name><Access>2</Access><Name>BoxAdmin</Name><Access>2</Access><Name>Phone</Name><Access>2</Access><Name>NAS</Name><Access>2</Access></Rights><Users><User last="1">admin</User></Users></SessionInfo>'
		);
		response.end();
	} else if (request.url == '/login_sid.lua?version=2&sid=' + sid + '&logout=1') {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/xml' });
		response.write(
			'<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>0000000000000000</SID><Challenge>' +
				challenge2 +
				'</Challenge><BlockTime>0</BlockTime><Rights><Name>Dial</Name><Access>2</Access><Name>App</Name><Access>2</Access><Name>HomeAuto</Name><Access>2</Access><Name>BoxAdmin</Name><Access>2</Access><Name>Phone</Name><Access>2</Access><Name>NAS</Name><Access>2</Access></Rights><Users><User last="1">admin</User></Users></SessionInfo>'
		);
		response.end();
	} else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=getswitchlist') {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(JSON.stringify([ '087610006102', '34:31:C1:AB:68:53', '119600642220', 'EF:C4:CC-900' ]));
		response.end();
	} else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=getdevicelistinfos') {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(String(xmlDevicesGroups));
		response.end();
	} else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=gettemplatelistinfos') {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(String(xmlTemplate));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&ain=087611016969&switchcmd=getbasicdevicestats'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(String(xmlTempStat));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&ain=117951022222&switchcmd=getbasicdevicestats'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(String(xmlTempStat));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&ain=119600642220&switchcmd=getbasicdevicestats'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(String(xmlTempStat));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&ain=087610006161&switchcmd=getbasicdevicestats'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(String(xmlTempStat));
		response.write(String(xmlPowerStats));
		response.end();
	} else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=getcolordefaults') {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(String(xmlColorDefaults));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=getswitchstate&ain=087610006102'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(JSON.stringify([ '1' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=gettemperature&ain=087610006102'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(JSON.stringify([ '240' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=gettemperature&ain=117951022222'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(JSON.stringify([ '220' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=getswitchpower&ain=087610006102'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(JSON.stringify([ '1234' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=getswitchenergy&ain=087610006102'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(JSON.stringify([ '128308' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=getswitchpresent&ain=087610006102'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(JSON.stringify([ '1' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=getswitchname&ain=087610006102'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(JSON.stringify([ 'FRITZ!DECT 200 #1' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=gethkrtsoll&ain=117951022222'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(JSON.stringify([ '44' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=gethkrabsenk&ain=117951022222'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(JSON.stringify([ '253' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=gethkrkomfort&ain=117951022222'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(JSON.stringify([ '48' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=setswitchoff&ain=087610006102'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(JSON.stringify([ '0' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=setswitchon&ain=087610006102'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(JSON.stringify([ '1' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=setswitchoff&ain=087610006161'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(JSON.stringify([ '0' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=setswitchon&ain=087610006161'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(JSON.stringify([ '1' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=sethkrtsoll&param=36&ain=117951022222'
	) {
		//wie auf egal welche temp reagieren? regex?
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(JSON.stringify([ '36' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=applytemplate&ain=tmp6F0093-391363146'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write('60008');
		response.end();
	} else if (request.url == '/wlan/guest_access.lua?0=0&sid=' + sid) {
		//check the URL of the current request
		response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/json' });
		response.write(String(guestWlan));
		response.end();
	} else if (request.url == '/data.lua' && request.method === 'POST') {
		//check the URL of the current request
		let body = '';
		request.on('data', (chunk) => {
			body += chunk.toString(); // convert Buffer to string
		});
		request.on('end', () => {
			const form = parse(body);
			console.log(form);
			if (form.sid === sid && form.xhr === '1' && form.page === 'overview') {
				response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/xml' });
				response.write(
					JSON.stringify({
						data: {
							naslink: 'nas',
							SERVICEPORTAL_URL:
								'https://www.avm.de/fritzbox-service-portal.php?hardware=156&oem=avm&language=de&country=049&version=84.06.85&subversion=',
							fritzos: {
								Productname: 'FRITZ!Box Fon WLAN 7390',
								NoPwd: false,
								ShowDefaults: false,
								expert_mode: '1',
								nspver_lnk: '/home/pp_fbos.lua?sid=' + sid,
								nspver: '06.85',
								isLabor: false,
								FirmwareSigned: false,
								fb_name: '',
								isUpdateAvail: false,
								energy: '40',
								boxDate: '13:22:00 09.12.2018'
							}
						}
					})
				);
				response.end();
			} else if (
				form.sid === sid &&
				form.xhr === '1' &&
				form.device === '20' &&
				form.oldpage === '/net/home_auto_hkr_edit.lua' &&
				form.back_to_page === '/net/network.lua'
			) {
				response.writeHead(200, { 'xmlDevicesGroups-Type': 'application/xml' });
				response.write(String(hkr_batt));
				response.end();
			}
		});
	} else {
		console.log(' not supported call ' + request.method + '  ' + request.url);
		response.statusCode = 403;
		response.end();
	}
}
//setupHttpServer(function() {});
module.exports.setupHttpServer = setupHttpServer;
/**Kommandos
case 'getdevicelistinfos':
	break;
case 'getdeviceinfos':
	break;
case 'gettemplatelistinfos':
	break;
case 'applytemplate':
	break;
//alles zu switches
case 'getswitchlist':
	break;
case 'setswitchon':
case 'setswitchoff':
case 'setswitchtoggle':
	break;
case 'gettemperature':
case 'getswitchname':
case 'getswitchpresent':
case 'getswitchstate':
case 'getswitchpower':
case 'getswitchenergy':
	break;
//alles KHR
case 'gethkrtsoll':
case 'gethkrkomfort':
case 'gethkrabsenk':
	break;
case 'sethkrtsoll':
	break;
//different
case 'getbasicdevicestats':
	break;
case 'setsimpleonoff':
	break;
case 'setlevel':
	break;
case 'setlevelpercentage':
	break;
case 'setcolor':
	break;
case 'setcolortemperature':
	break;
case 'getcolordefaults':
	break;
case 'sethkrboost':
	break;
case 'sethkrwindowopen':
	break;
case 'setblind':
	break;
case 'setname':
	break;
case 'startulesubscription':
	break;
case 'getsubscriptionstate':
	break;
default:
	break;	
*/
// ausprobieren bei echter FB ob getswitchname, getswitchpresent, gettemperature auch auf thermostat geht
// gettemperature hat 0.1
// gethkrtemps hat 0,5 Schrittweite
