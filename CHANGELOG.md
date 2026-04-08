# Changelog
All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

# [Unreleased](https://github.com/MyPureCloud/genesys-cloud-client-auth/compare/v1.0.1...HEAD)
### Added
* [STREAM-883](https://inindca.atlassian.net/browse/STREAM-883) - Generate a test report in JUnit.xml format.

### Changed
* [STREAM-1209](https://inindca.atlassian.net/browse/STREAM-1209) - Updated axios to v1.14.0 to fix Snyk vulnerability.

# [v1.0.1](https://github.com/MyPureCloud/genesys-cloud-client-auth/tags/v1.0.1)
### Changed
* [STREAM-637](https://inindca.atlassian.net/browse/STREAM-637) - Move jest-environment-jsdom to dev-dependencies
* [STREAM-633](https://inindca.atlassian.net/browse/STREAM-633) - Migrate away from superagent to Axios.

# [v1.0.0](https://github.com/MyPureCloud/genesys-cloud-client-auth/tags/v1.0.0)
### Added
* [ATEAM-1719](https://inindca.atlassian.net/browse/ATEAM-1719) - Added ability to pass in custom headers to authentication requests.

### Changed
* [STREAM-233](https://inindca.atlassian.net/browse/STREAM-233) - Switched to vite instead of create-react-app to resolve Snyk vulnerabilities.
* [STREAM-627](https://inindca.atlassian.net/browse/STREAM-627) - Fix issues caused by Vite migration. Remove pipeline infra from open-source.

### Fixed
* [NO-JIRA] - Updated dependencies to resolve Snyk vulnerabilities. Updated CODEOWNERS file.

### BREAKING CHANGES
* [PCM-1939](https://inindca.atlassian.net/browse/PCM-1939) – Adjusted cdn version urls to specify major and exact versions. For example:
    * `/v1.0.0/genesys-cloud-client-auth.browser.min.js` (exact version)
    * `/v1/genesys-cloud-client-auth.browser.min.js` (locked to latest for a specific major version)

### Added
* [PCM-1937](https://inindca.atlassian.net/browse/PCM-1937) – migrated to new build pipeline

# [v0.0.1](https://github.com/MyPureCloud/genesys-cloud-client-auth/tags/v0.0.1)
