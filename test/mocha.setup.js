// Don't silently swallow unhandled rejections
process.on('unhandledRejection', (e) => {
	throw e;
});

// enable the should interface with sinon
// and load sinon-chai by default
const sinonChai = require('sinon-chai');
const { should, use } = require('chai');

should();
use(sinonChai);
