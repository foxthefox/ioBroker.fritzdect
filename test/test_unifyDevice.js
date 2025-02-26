const fs = require('fs');
const path = require('path');
console.log('PATH ist ' + path.join(__dirname, './data/'));

const xmlsource = fs.readFileSync(path.join(__dirname, './data/') + 'issue598.xml');
//const xmlsource = fs.readFileSync(path.join(__dirname, './data/') + 'test_api_response.xml');
console.log(xmlsource.toString);
const parser = require('../lib/xml2json.js');

let devices = parser.xml2json(String(xmlsource));

console.log(JSON.stringify(devices));

/**
 * @param {any[]} devicearray
 */
function unifyDevicesUnits(devicearray) {
	let id = [];
	let etsiunit = [];
	let etsidelete = [];
	for (let i = 0; i < devicearray.length; i++) {
		id.push(devicearray[i].id);
		//if there is no identifier, then the dataset is useless (issue #598)
		if (!devicearray[i].identifier) {
			etsidelete.push(i);
		}
		if (devicearray[i]['etsiunitinfo']) {
			//prepare array with etsi units for later merge with etsidevice
			etsiunit.push(i);
			//setting the role of device
			if (Number(devicearray[i].etsiunitinfo.unittype) > 510) {
				devicearray[i]['role'] = 'sensor';
			} else if (Number(devicearray[i].etsiunitinfo.unittype) > 280) {
				devicearray[i]['role'] = 'blinds';
			} else if (Number(devicearray[i].etsiunitinfo.unittype) > 263) {
				devicearray[i]['role'] = 'light';
			} else if (Number(devicearray[i].etsiunitinfo.unittype) > 255) {
				devicearray[i]['role'] = 'switch';
			}
		} else {
			//setting the role of device
			if (devicearray[i].switch) {
				devicearray[i]['role'] = 'switch';
			} else if (devicearray[i].hkr) {
				devicearray[i]['role'] = 'thermo.heat';
			} else if (devicearray[i].blind) {
				devicearray[i]['role'] = 'blinds';
			} else if (devicearray[i].colortemperature) {
				devicearray[i]['role'] = 'light';
			} else if (devicearray[i].levelcontrol) {
				devicearray[i]['role'] = 'light';
			} else if (devicearray[i].temperature) {
				devicearray[i]['role'] = 'thermo';
			} else if (devicearray[i].button) {
				devicearray[i]['role'] = 'sensor';
			} else if (devicearray[i].alert) {
				devicearray[i]['role'] = 'sensor';
			} else {
				devicearray[i]['role'] = 'etsi';
			}
			//setting the switchtype
			if (devicearray[i].switch) {
				devicearray[i]['switchtype'] = 'switch';
			} else if (devicearray[i].simpleonoff) {
				devicearray[i]['switchtype'] = 'simpleonoff';
			}
		}
	}
	console.log(id, etsiunit);

	for (let etsiunitpos of etsiunit) {
		//find the matching etsidevice for etsiunit
		let etsidevpos = id.indexOf(devicearray[etsiunitpos]['etsiunitinfo']['etsideviceid']);
		//prepare array for deletion of etsidevices
		if (etsidelete.indexOf(etsidevpos) === -1 && etsidevpos !== -1) {
			etsidelete.push(etsidevpos);
		}
		//merge etsidevice info into etsiunit
		for (let item in devicearray[etsidevpos]) {
			if (item !== 'id' && item !== 'identifier' && item !== 'functionbitmask' && item !== 'role') {
				devicearray[etsiunitpos][item] = devicearray[etsidevpos][item];
			}
		}
	}
	etsidelete.sort();
	console.log(etsidelete);
	//delete the etsidevices
	for (let k = 0; k < etsidelete.length; k++) {
		devicearray.splice(etsidelete[k] - k, 1);
	}
	return devicearray;
}

console.log(unifyDevicesUnits(devices.devicelist.device));
//console.log(unifyDevicesUnits(devices.device));
