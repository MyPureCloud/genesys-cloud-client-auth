const FS = require('fs');

const Pkg = JSON.parse(FS.readFileSync('package.json').toString());
const { version } = Pkg;
const webpackConfig = require('../webpack.config')();
const builtFileName = webpackConfig.output.filename;
const fullBuiltFilePath = `dist/${builtFileName}`;

function fileReplace (fileName, placeholder, value) {
  const originalFile = FS.readFileSync(fileName).toString();
  FS.writeFileSync(fileName, originalFile.replace(placeholder, value));
}

fileReplace('dist/lib/cjs/version.js', '__GENESYS_CLOUD_CLIENT_AUTH_VERSION__', version);
fileReplace('dist/lib/es/version.js', '__GENESYS_CLOUD_CLIENT_AUTH_VERSION__', version);
fileReplace(fullBuiltFilePath, '__GENESYS_CLOUD_CLIENT_AUTH_VERSION__', version);


/* copy to versioned folders: (ie. "dist/v1/..." & "dist/v1.0.0/...") */
const majorVersion = version.split('.')[0];
const majorVersionDir = `dist/v${majorVersion}`;
const exactVersionDir = `dist/v${version}`;

const majorVersionPath = `${majorVersionDir}/${builtFileName}`;
const exactVersionPath = `${exactVersionDir}/${builtFileName}`;

[majorVersionDir, exactVersionDir].forEach(dir => {
  if (!FS.existsSync(dir)) {
    FS.mkdirSync(dir);
  }
});

FS.copyFileSync(fullBuiltFilePath, majorVersionPath);
FS.copyFileSync(fullBuiltFilePath, exactVersionPath);

console.log('Copied built bundled file to versioned folders', {
  fullBuiltFilePath,
  majorVersionPath,
  exactVersionPath
});

const buildDate = new Date();

const manifest = {
  name: process.env.APP_NAME,
  version: process.env.VERSION,
  build: process.env.BUILD_ID,
  buildDate: buildDate.toISOString(),
  indexFiles: [
    'index.html',
    'robots.txt',
    majorVersionPath,
    exactVersionPath
  ].map(filename => ({ file: filename.replace('dist', '') }))
};

console.log('Generated manifest', manifest);
FS.writeFileSync('./dist/manifest.json', JSON.stringify(manifest, null, 2), { encoding: 'utf8' });
