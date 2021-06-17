const fs = require('fs')

const { createCoverageMap } = require('istanbul-lib-coverage')
const { createReporter } = require('istanbul-api');

main().catch(err => {
  console.error(err)
  process.exit(1)
})

async function main () {
  const reportFiles = [
    'coverage/coverage-final.json',
    'src/react-app/coverage/coverage-final.json'
  ];
  const reporters = ['json', 'lcov'/* , 'html', 'clover' */];

  const map = createCoverageMap({})

  reportFiles.forEach(file => {
    const r = fs.readFileSync(file);
    map.merge(JSON.parse(r));
  })

  const reporter = createReporter();
  reporter.addAll(reporters)
  reporter.write(map)
  console.log('Created a merged coverage report in ./coverage')
}
