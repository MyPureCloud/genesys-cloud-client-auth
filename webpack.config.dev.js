const Path = require('path');

const config = require('./webpack.config')();

config.watch = true;
config.mode = 'development';
config.output.path = Path.resolve('src/react-app/public');

module.exports = config;