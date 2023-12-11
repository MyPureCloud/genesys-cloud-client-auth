@Library('pipeline-library') _

def isBitbucket = false
def MAIN_BRANCH = 'main'
def DEVELOP_BRANCH = 'develop'

def isRelease = {
  env.BRANCH_NAME.startsWith('release/')
}

def isMain = {
  env.BRANCH_NAME == MAIN_BRANCH
}

def isRelease = {
  env.BRANCH_NAME.startsWith('release/')
}

def isDevelop = {
  env.BRANCH_NAME == DEVELOP_BRANCH
}

def isMainline = {
  isMain() || isDevelop() || isRelease()
}

def getBranchType = {
  isMainline() ? 'MAINLINE' : 'FEATURE'
}

def getDeployConfig = {
  def deployConfig = [:]

  if (isMainline()) {
    deployConfig['dev'] = 'always'
    deployConfig['test'] = 'always'
  }

  if (isMain()) {
    deployConfig['prod'] = 'always'
    deployConfig['fedramp-use2-core'] = 'always'
  }

  return deployConfig;
}

def npmFunctions = new com.genesys.jenkins.Npm()
def gitFunctions = new com.genesys.jenkins.Git()
def notifications = new com.genesys.jenkins.Notifications()

def chatGroupId = 'adhoc-60e40c95-3d9c-458e-a48e-ca4b29cf486d'

webappPipeline {
    team = 'Genesys Client Media (WebRTC)'
    projectName = 'client-auth'
    nodeVersion = '14.x'
    mailer = 'genesyscloud-client-media@genesys.com'
    buildType = getBranchType
    manifest = staticManifest([
        'index.html',
        'robots.txt',
        'genesys-cloud-client-auth.browser.min.js',
        'genesys-cloud-client-auth.browser.min.js.map'
    ])
    testJob = 'no-tests'

    deployConfig = getDeployConfig()
    chatGroupId = chatGroupId
    autoSubmitCm = true

    snykConfig = {
        return [
            organization: 'genesys-client-media-webrtc',
            wait: true
        ]
    }

    ciTests = {
        println("""
========= BUILD VARIABLES =========
ENVIRONMENT  : ${env.ENVIRONMENT}
BUILD_NUMBER : ${env.BUILD_NUMBER}
BUILD_ID     : ${env.BUILD_ID}
BRANCH_NAME  : ${env.BRANCH_NAME}
APP_NAME     : ${env.APP_NAME}
VERSION      : ${env.VERSION}
===================================
      """)

      sh("""
        npm i -g npm@7
        npm run install:all
        npm run test
      """)
    }

    buildStep = {cdnUrl ->
        sh("""
            CDN_URL='${cdnUrl}'
            echo 'CDN_URL ${cdnUrl}'
            npm run install:all && PUBLIC_URL=\$CDN_URL npm run build
        """)
    }

    onSuccess = {
       sh("""
            echo "=== root folder ==="
            ls -als ./

            echo "=== Printing manifest.json ==="
            cat ./manifest.json

            echo "=== Printing package.json ==="
            cat ./package.json

            echo "=== dist folder ==="
            ls -als dist/

            echo "=== Printing dist/deploy-info.json ==="
            cat ./dist/deploy-info.json

            # echo "=== Printing dist/package.json ==="
            # cat ./dist/package.json
        """)

        // NOTE: this version only applies to the npm version published and NOT the cdn publish url/version
        def version = env.VERSION
        def packageJsonPath = "./package.json"
        def tag = ""

        // save a copy of the original package.json
        // sh("cp ${packageJsonPath} ${packageJsonPath}.orig")

        // if not MAIN branch, then we need to adjust the verion in the package.json
        if (!isMain()) {
          // load the package.json version
          def packageJson = readJSON(file: packageJsonPath)
          def featureBranch = env.BRANCH_NAME

          // all feature branches default to --alpha
          tag = "alpha"

          if (isRelease()) {
            tag = "next"
            featureBranch = "release"
          }

          if (isDevelop()) {
            tag = "beta"
            featureBranch = "develop"
          }

          version = "${packageJson.version}-${featureBranch}.${env.BUILD_NUMBER}".toString()
        }

        stage('Publish to NPM') {
            script {
                dir(pwd()) {
                    npmFunctions.publishNpmPackage([
                        tag: tag, // optional
                        useArtifactoryRepo: isBitbucket, // optional, default `true`
                        version: version, // optional, default is version in package.json
                        dryRun: false // dry run the publish, default `false`
                    ])
                }

                def message = "**${env.APP_NAME}** ${version} (Build [#${env.BUILD_NUMBER}](${env.BUILD_URL})) has been published to **npm**"

                if (!tag) {
                  message = ":loudspeaker: ${message}"
                }

                notifications.requestToGenericWebhooksWithMessage(chatGroupId, message);
            }
        } // end publish to npm

        if (isMain()) {
            stage('Tag commit and merge back') {
                script {
                    gitFunctions.tagCommit(
                      "v${version}",
                      gitFunctions.getCurrentCommit(),
                      isBitbucket
                    )

                    gitFunctions.mergeBackAndPrep(
                      MAIN_BRANCH,
                      DEVELOP_BRANCH,
                      'patch',
                      isBitbucket
                    )
                }
            } // end tag commit and merge back
        } // isMain()

    } // onSuccess
}
