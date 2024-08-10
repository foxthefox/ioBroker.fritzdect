import globals from 'globals';
import pluginJs from '@eslint/js';

//["**/*.js"],

export default [
	{ files: [ 'main.js' ], languageOptions: { sourceType: 'commonjs' } },
	{
		ignores: [
			'.dev-server/**/*',
			'admin/build/**/*',
			'admin/words.js',
			'test/**/*',
			'main.test.js',
			'lib/**/*',
			'docs/**/*',
			'widgets/**/*'
		]
	},
	{ languageOptions: { globals: globals.browser } },
	pluginJs.configs.recommended
];
