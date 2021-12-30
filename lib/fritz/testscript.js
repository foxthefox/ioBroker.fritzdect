const Fritz = require('../fritzhttp.js');
var fritz = new Fritz('admin', 'password', 'http://localhost:3333', null);

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
				console.log('Check SID OK?: ' + response.session);
				console.log('Check Rights : ' + response.rights);
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
