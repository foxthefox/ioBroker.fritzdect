const Fritz = require('../fritzhttp.js');
const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');
const parser = require('xml2json-light');

const cmdOptionsDefinition = [
	{ name: 'username', alias: 'u', type: String, description: 'username for FB login' },
	{ name: 'password', alias: 'p', type: String, description: 'password of that user' },
	{
		name: 'url',
		type: String,
		description: 'the url of the FB'
	},
	{ name: 'help', alias: 'h', type: Boolean }
];

const cmdOptions = commandLineArgs(cmdOptionsDefinition);

function errorHandlerApi(error) {
	try {
		console.log('--------------- error calling the fritzbox -----------');
		console.log('API msg   => ' + error.msg);
		console.log('API funct => ' + error.function);

		if (error == '0000000000000000') {
			console.log('Did not get session id -> invalid username or password?');
		} else if (!error.response) {
			console.log('no response part in returned message');
		} else if (error.response.statusCode) {
			if (error.response.statusCode == 403) {
				console.log('no permission for this call (403), has user all the rights and access to fritzbox?');
			} else if (error.response.statusCode == 404) {
				console.log('call to API does not exist! (404)');
			} else if (error.response.statusCode == 400) {
				console.log('bad request (400), ain correct?');
			} else if (error.response.statusCode == 500) {
				console.log('internal fritzbox error (500)');
			} else if (error.response.statusCode == 503) {
				console.log('service unavailable (503)');
			} else if (error.response.statusCode == 303) {
				console.log('unknwon error (303)');
			} else {
				console.log('statuscode not in errorHandlerApi of fritzdect');
			}
		}
		console.log('API  err  => ' + error.error);
	} catch (e) {
		console.log('try/catch error in function errorHandlerApi() ' + e);
	}
}

if (
	cmdOptions.username === undefined ||
	cmdOptions.password === undefined ||
	cmdOptions.url === undefined ||
	cmdOptions.help
) {
	const sections = [
		{
			header: 'Fritzbox Setup Check',
			content:
				'A simple app checking the Fritzbox Setup. call: node testscript.js -u admin -p password --url http:/192.168.178.1'
		},
		{
			header: 'Options',
			optionList: cmdOptionsDefinition
		}
	];
	console.log(getUsage(sections));
} else {
	var fritz = new Fritz(cmdOptions.username, cmdOptions.password, cmdOptions.url, null);

	async function test() {
		console.log('\n Try to Login ...\n');
		const login = await fritz.login_SID().catch((e) => {
			console.log('fault calling login() ', e);
		});
		console.log('login OK? : ', login);
		if (login) {
			const devicelistinfos = await fritz.getDeviceListInfos().catch((e) => errorHandlerApi(e));
			let devices = parser.xml2json(devicelistinfos);
			// devices
			devices = [].concat((devices.devicelist || {}).device || []).map((device) => {
				//id  │ functionbitmask │ fwversion │ manufacturer │   productname    │ present │ txbusy,name
				// remove spaces in AINs
				//device.identifier = device.identifier.replace(/\s/g, '');
				const dev = {
					identifier: device.identifier,
					id: device.id,
					functionbitmask: device.functionbitmask,
					fwversion: device.fwversion,
					manufacturer: device.manufacturer,
					productname: device.productname,
					present: device.present,
					name: device.name
				};
				return dev;
			});
			console.log('\n your devices\n');
			console.table(devices);
			let groups = parser.xml2json(devicelistinfos);
			// devices
			groups = [].concat((groups.devicelist || {}).group || []).map((device) => {
				//id  │ functionbitmask │ fwversion │ manufacturer │   productname    │ present │ txbusy,name
				// remove spaces in AINs
				//device.identifier = device.identifier.replace(/\s/g, '');
				const dev = {
					identifier: device.identifier,
					id: device.id,
					functionbitmask: device.functionbitmask,
					fwversion: device.fwversion,
					present: device.present,
					name: device.name
				};
				return dev;
			});
			console.log('\n your groups\n');
			console.table(groups);
			const templatelistinfos = await fritz.getTemplateListInfos().catch((e) => errorHandlerApi(e));
			let typ = '';
			let role = '';
			if (templatelistinfos) {
				let templates = parser.xml2json(templatelistinfos);
				templates = [].concat((templates.templatelist || {}).template || []).map((template) => {
					return template;
				});
				console.log('templates\n');
				console.table(templates);
			}
			await fritz
				.getUserPermissions()
				.then(function(response) {
					console.log('Rights : ' + response);
					console.log('Rights : ' + ''.concat('<Rights>', response, '</Rights>'));
					if (response.indexOf('ights') == -1) {
						console.log(parser.xml2json(''.concat('<Rights>', response, '</Rights>')));
					}
				})
				.catch((e) => {
					console.log('Fehler getUserPermissions', e);
				});

			await fritz
				.check_SID()
				.then(function(response) {
					console.log('Check SID OK?: ' + response.session + '\n');
					console.log('Check Rights : \n');
					console.log('1 = read only; 2 = ready and write \n');
					console.table(parser.xml2json(response.rights));
				})
				.catch((e) => {
					console.log('Fehler checkSID', e);
				});
			await fritz
				.logout_SID()
				.then(function(response) {
					console.log('\n logout : ' + response);
				})
				.catch((e) => {
					console.log('Fehler logout_SID', e);
				});
		} else {
			console.log('your login is not successful ');
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
}
