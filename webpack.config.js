const FCPlugin = require('./webpack.plugin');
const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');

const fcplugin = new FCPlugin();

module.exports = {
	watch: false,
	entry: './out/src/index.js',
	target: 'web',
	output: {
		path: __dirname,
		filename: './index.js',
		libraryTarget: 'assign',
		library: 'module.exports',
	},

	mode: 'production',

	optimization: {
		minimize: true,
		minimizer: [
			new TerserPlugin({
				minify: TerserPlugin.esbuildMinify,
				extractComments: false,
				terserOptions: {
					compress: {
						ecma: 2017,
						negate_iife: false,
						unsafe: true,
						unsafe_arrows: true,
						arrows: true,
					},

					// mangle: {
					// 	keep_classnames: true,
					// 	properties: {
					// 		reserved: ['fcpremium', 'Core'],
					// 		builtins: true,
					// 	}
					// },

					output: {
						ecma: 2017,
						comments: false
					}
				}
			}),
			new TerserPlugin({
				minify: TerserPlugin.esbuildMinify,
				extractComments: false,
				terserOptions: {
					compress: {
						ecma: 2020,
						negate_iife: false,
						unsafe: true,
						unsafe_arrows: true,
						arrows: true,
					},

					// mangle: {
					// 	keep_classnames: true,
					// 	properties: {
					// 		reserved: ['fcpremium', 'Core'],
					// 		builtins: true,
					// 	}
					// },

					output: {
						ecma: 2020,
						comments: false
					}
				}
			})
		]
	},

	plugins: [fcplugin],

	module: {
		rules: [{
			test: /\.(txt|css)$/,
			use: [{
				loader: 'raw-loader',
			}]
		}, ]
	},

	resolve: {
		alias: {
			'@assets': path.resolve(__dirname, 'assets/')
		}
	}

};
