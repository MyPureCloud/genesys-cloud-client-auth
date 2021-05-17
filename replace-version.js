const FS = require('fs');

const Pkg = JSON.parse(FS.readFileSync('package.json').toString());
const webpackConfig = require('./webpack.config')();

function fileReplace (fileName, placeholder, value) {
  const originalFile = FS.readFileSync(fileName).toString();
  FS.writeFileSync(fileName, originalFile.replace(placeholder, value));
}

fileReplace('dist/lib/cjs/version.js', '__GENESYS_CLOUD_CLIENT_AUTH_VERSION__', Pkg.version);
fileReplace('dist/lib/es/version.js', '__GENESYS_CLOUD_CLIENT_AUTH_VERSION__', Pkg.version);
fileReplace(`dist/${webpackConfig.output.filename}`, '__GENESYS_CLOUD_CLIENT_AUTH_VERSION__', Pkg.version);