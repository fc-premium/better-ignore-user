const {
	ConcatSource
} = require('webpack-sources');
const {
	NormalModule,
	ExternalsPlugin
	// NormalModuleFactory
} = require('webpack');
const RuntimeGlobals = require('webpack/lib/RuntimeGlobals');
const JavascriptModulesPlugin = require('webpack/lib/javascript/JavascriptModulesPlugin');

var ModuleFilenameHelpers = require('webpack/lib/ModuleFilenameHelpers');
var ExternalModule = require('webpack/lib/ExternalModule');

class FCPlugin {
	constructor() {
		this.lib_regex = /^@fc-lib\/(.*)$/;
		this.dependencies = new Set();

		this.externalPlugin = new ExternalsPlugin(
			null,
			this.externalize_dependencies.bind(this)
		)
	}


	__get_fc_lib(request) {
		const result = this.lib_regex.exec(request);

		if (result !== null && result[1].length > 0)
			return result[1];

		return null;
	}

	externalize_dependencies({
		context,
		request
	}, callback) {

		if (request === 'fc-premium-core')
			return callback(null, 'fcpremium')

		const lib = this.__get_fc_lib(request);
		if (lib !== null) {
			this.dependencies.add(lib);
			console.log('External dependencies:', Array.from(this.dependencies.values()))
			return callback(null, `fcpremium.Core.libraries.import('${lib}')`);
		}

		return callback();

	}

	apply(compiler) {
		this.externalPlugin.apply(compiler);

	}

}

module.exports = FCPlugin;
