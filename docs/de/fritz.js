const { parseArgs } = require('node:util');
const { Fritz } = require('fritzdect-aha-nodejs');
const parser = require('../../lib/xml2json.js');

const { values: cmdOptions } = parseArgs({
    options: {
        username: { short: 'u', type: 'string' },
        password: { short: 'p', type: 'string' },
        url: { type: 'string' },
        help: { short: 'h', type: 'boolean' },
    },
});

if (cmdOptions.help || [cmdOptions.username, cmdOptions.password, cmdOptions.url].includes(undefined)) {
    console.log('Usage: node fritz.js -u <username> -p <password> --url <FRITZ!Box URL>');
} else {
    var fritz = new Fritz(cmdOptions.username, cmdOptions.password, cmdOptions.url, null);

    async function test() {
        console.log('\n Try to Login ...\n');
        const login = await fritz.login_SID().catch(e => {
            console.log('fault calling login() ', e);
        });
        console.log('login OK? : ', login);
        if (login) {
            const devicelistinfos = await fritz.getDeviceListInfos();
            let devices = parser.xml2json(devicelistinfos);
            // devices
            devices = [].concat((devices.devicelist || {}).device || []).map(device => {
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
                    name: device.name,
                };
                return dev;
            });
            console.log('\n your devices\n');
            console.table(devices);
            let groups = parser.xml2json(devicelistinfos);
            // devices
            groups = [].concat((groups.devicelist || {}).group || []).map(device => {
                //id  │ functionbitmask │ fwversion │ manufacturer │   productname    │ present │ txbusy,name
                // remove spaces in AINs
                //device.identifier = device.identifier.replace(/\s/g, '');
                const dev = {
                    identifier: device.identifier,
                    id: device.id,
                    functionbitmask: device.functionbitmask,
                    fwversion: device.fwversion,
                    present: device.present,
                    name: device.name,
                };
                return dev;
            });
            console.log('\n your groups\n');
            console.table(groups);

            await fritz
                .check_SID()
                .then(function (response) {
                    console.log(`Check SID OK?: ${response.session}\n`);
                    console.log('Check Rights : \n');
                    console.log('1 = read only; 2 = ready and write \n');
                    console.table(parser.xml2json(response.rights));
                })
                .catch(e => {
                    console.log('Fehler checkSID', e);
                });
            await fritz
                .logout_SID()
                .then(function (response) {
                    console.log(`\n logout : ${response}`);
                })
                .catch(e => {
                    console.log('Fehler logout_SID', e);
                });
        } else {
            console.log('your login was not successful ');
        }
    }
    test();
}
