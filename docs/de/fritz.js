const Fritz = require('../../lib/fritzhttp.js');
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
			const devicelistinfos = await fritz.getDeviceListInfos();
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
			console.log('your login was not successful ');
		}
	}
	test();
}
