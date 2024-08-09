import globals from 'globals';
import pluginJs from '@eslint/js';

//["**/*.js"],

export default [
	{ files: [ 'main.js' ], languageOptions: { sourceType: 'commonjs' } },
	{ languageOptions: { globals: globals.browser } },
	pluginJs.configs.recommended
];
