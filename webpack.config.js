const Path = require('path');

module.exports = (_env = {}) => {
  return {
    entry: './dist/lib/es/index.js',
    devtool: 'source-map',
    output: {
      filename: 'genesys-cloud-client-auth.browser.min.js',
      library: 'GenesysCloudClientAuth',
      libraryTarget: 'window',
      path: Path.resolve('dist/lib')
    }
  };
};
