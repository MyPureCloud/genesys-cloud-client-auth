const Path = require('path');

module.exports = (_env = {}) => {
  return {
    entry: './src/lib/index.ts',
    devtool: 'source-map',
    output: {
      filename: 'genesys-cloud-client-auth.browser.min.js',
      library: 'GenesysCloudClientAuth',
      libraryTarget: 'window',
      path: Path.resolve('dist')
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          include: Path.resolve(__dirname, 'src'),
          exclude: /node_modules/
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    }
  };
};
