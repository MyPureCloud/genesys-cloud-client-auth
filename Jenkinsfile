@Library('pipeline-library') _

def getBranchType = {
    env.BRANCH_NAME == 'main'
        ? 'MAINLINE'
        : 'FEATURE'
}

def getVersion = {
    getBranchType() == 'MAINLINE'
        ? env.VERSION
        : env.BRANCH_NAME
}

webappPipeline {
    slaveLabel = 'dev_v2'
    projectName = 'client-auth'
    nodeVersion = '14.16.1'
    buildType = getBranchType
    manifest = staticManifest([
        'index.html',
        'favicon.ico',
        'robots.txt',
        'genesys-cloud-client-auth.browser.min.js',
        'genesys-cloud-client-auth.browser.min.js.map'
    ])
    useArtifactoryRepo = false
    testJob = null

    publishPackage = { 'prod' }

    buildStep = {
        sh("""
            CDN_URL="\$(npx cdn --ecosystem pc --name \$APP_NAME --build \$BUILD_ID --version ${getVersion()})"
            echo "CDN_URL: \$CDN_URL"
            npm run install:all && PUBLIC_URL=\$CDN_URL npm run build # && npm test
        """)
    }

    uploadBuildStep = {
      /* deploy to `/alpha` if we are building for `MAINLINE` */
      if (getBranchType() == 'MAINLINE') {
        sh ('''
          echo "\n\n======== MAINLINE build – uploading to alpha branch ========\n\n"
          npx upload --ecosystem pc --source-dir dist --manifest manifest.json --version alpha
        ''')
      } else {
        sh 'echo "\n\n======== Not MAINLINE build – skipping upload to alpha branch ========\n\n"'
      }
    }

    snykConfig = {
      return [
        organization: 'genesys-client-media-webrtc',
        targetFiles: ['package.json', 'src/react-app/package.json']
      ]
    }

    cmConfig = {
        return [
            managerEmail: 'purecloud-client-media@genesys.com',
            rollbackPlan: 'Patch version with fix',
            testResults: 'https://jenkins.ininica.com/job/web-pipeline-genesys-cloud-client-auth/job/main/'
        ]
    }

    shouldTagOnRelease = { true }

    postReleaseStep = {
        sh("""
            # patch to prep for the next version
            npm version patch --no-git-tag-version
            git commit -am "Prep next version"
            git push origin HEAD:main --tags
        """)
    }
}
