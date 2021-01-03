// @ts-nocheck
//server to emulate the fritzbox responses
const http = require('http');
const fs = require('fs');
const { parse } = require('querystring');

const path = require('path');
console.log('PATH ist ' + path.join(__dirname, './data/'));

const content = fs.readFileSync(path.join(__dirname, './data/') + 'test_api_response.xml');
//var content = fs.readFileSync('./test.xml');

const templates = fs.readFileSync(path.join(__dirname, './data/') + 'template_answer.xml');

const temp_stats = fs.readFileSync(path.join(__dirname, './data/') + 'devicestat_temp_answer.xml');

const power_stats = fs.readFileSync(path.join(__dirname, './data/') + 'devicestat_power_answer.xml');

const color_defaults = fs.readFileSync(path.join(__dirname, './data/') + 'color_defaults.xml');

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
		console.log('HTTP-Server (Fritzbox Emulation) listening on: http://localhost:%s', 3333);
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

	if (request.url == '/login_sid.lua') {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/xml' });
		response.write(
			'<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>0000000000000000</SID><Challenge>' +
				challenge +
				'</Challenge><BlockTime>0</BlockTime><Rights></Rights></SessionInfo>'
		);
		response.end();
	} else if (request.url == '/login_sid.lua?version=2' && request.method == 'GET') {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/xml' });
		response.write(
			'<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>0000000000000000</SID><Challenge>' +
				challenge +
				'</Challenge><BlockTime>0</BlockTime><Rights></Rights></SessionInfo>'
		);
		response.end();
	} else if (request.url == '/login_sid.lua?username=admin') {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/xml' });
		response.write(
			'<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>0000000000000000</SID><Challenge>' +
				challenge +
				'</Challenge><BlockTime>0</BlockTime><Rights></Rights></SessionInfo>'
		);
		response.end();
	} else if (request.url == '/login_sid.lua?username=admin&response=' + challengeResponse) {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/xml' });
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
		response.writeHead(200, { 'Content-Type': 'application/xml' });
		response.write(
			'<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>' +
				sid +
				'</SID><Challenge>' +
				challenge2 +
				'</Challenge><BlockTime>0</BlockTime><Rights><Name>Dial</Name><Access>2</Access><Name>App</Name><Access>2</Access><Name>HomeAuto</Name><Access>2</Access><Name>BoxAdmin</Name><Access>2</Access><Name>Phone</Name><Access>2</Access><Name>NAS</Name><Access>2</Access></Rights></SessionInfo>'
		);
		response.end();
	} else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=getswitchlist') {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(JSON.stringify([ '087610006102', '34:31:C1:AB:68:53', '119600642220', 'EF:C4:CC-900' ]));
		response.end();
	} else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=getdevicelistinfos') {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(String(content));
		response.end();
	} else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=gettemplatelistinfos') {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(String(templates));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&ain=087611016969&switchcmd=getbasicdevicestats'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(String(temp_stats));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&ain=117951022222&switchcmd=getbasicdevicestats'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(String(temp_stats));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&ain=119600642220&switchcmd=getbasicdevicestats'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(String(temp_stats));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&ain=087610006161&switchcmd=getbasicdevicestats'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(String(temp_stats));
		response.write(String(power_stats));
		response.end();
	} else if (request.url == '/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=getcolordefaults') {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(String(color_defaults));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=getswitchstate&ain=087610006102'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(JSON.stringify([ '1' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=gettemperature&ain=087610006102'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(JSON.stringify([ '240' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=gettemperature&ain=117951022222'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(JSON.stringify([ '220' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=getswitchpower&ain=087610006102'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(JSON.stringify([ '1234' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=getswitchenergy&ain=087610006102'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(JSON.stringify([ '128308' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=getswitchpresent&ain=087610006102'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(JSON.stringify([ '1' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=getswitchname&ain=087610006102'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(JSON.stringify([ 'FRITZ!DECT 200 #1' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=gethkrtsoll&ain=117951022222'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(JSON.stringify([ '44' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=gethkrabsenk&ain=117951022222'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(JSON.stringify([ '253' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=gethkrkomfort&ain=117951022222'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(JSON.stringify([ '48' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=setswitchoff&ain=087610006102'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(JSON.stringify([ '0' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=setswitchon&ain=087610006102'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(JSON.stringify([ '1' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=sethkrtsoll&param=36&ain=117951022222'
	) {
		//wie auf egal welche temp reagieren? regex?
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write(JSON.stringify([ '36' ]));
		response.end();
	} else if (
		request.url ==
		'/webservices/homeautoswitch.lua?0=0&sid=' + sid + '&switchcmd=applytemplate&ain=tmp6F0093-391363146'
	) {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.write('60008');
		response.end();
	} else if (request.url == '/wlan/guest_access.lua?0=0&sid=' + sid) {
		//check the URL of the current request
		response.writeHead(200, { 'Content-Type': 'application/json' });
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
				response.writeHead(200, { 'Content-Type': 'application/xml' });
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
				response.writeHead(200, { 'Content-Type': 'application/xml' });
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
