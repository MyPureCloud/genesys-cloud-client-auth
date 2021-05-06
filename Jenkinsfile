@Library('pipeline-library@master') _

webappPipeline {
    slaveLabel = 'dev_v2'
    nodeVersion = '10.16.2'
    useArtifactoryRepo = true
    // projectName = 'volt'
    // manifest = directoryManifest('./dist')
    buildType = { env.BRANCH_NAME == 'main' ? 'MAINLINE' : 'FEATURE' } // this logic is duplicated in `uploadBuildStep`
    publishPackage = { 'prod' }

    buildStep = {
        sh('''
            export CDN_URL="$(npx cdn --ecosystem pc --name $APP_NAME --build $BUILD_ID --version $VERSION)"
            echo "CDN_URL $CDN_URL"
            npm ci && npm run build:prod -- --PUBLIC_URL=\$CDN_URL && npm test
        ''')
    }

    uploadBuildStep = {
      /* deploy to `/alpha` if we are building for `MAINLINE` */
      // if (env.BRANCH_NAME == 'main') {
      //   sh ('''
      //     echo "\n\n======== MAINLINE build – uploading to alpha branch ========\n\n"
      //     npx upload --ecosystem pc --source-dir dist --manifest manifest.json --version alpha
      //   ''')
      // } else {
      //   sh 'echo "\n\n======== Not MAINLINE build – skipping upload to alpha branch ========\n\n"'
      // }
    }

    snykConfig = {
      return [
        organization: 'genesys-client-media-webrtc',
      ]
    }

    // cmConfig = {
    //     return [
    //         managerEmail: 'purecloud-client-media@genesys.com',
    //         rollbackPlan: 'Patch version with fix',
    //         testResults: 'https://jenkins.ininica.com/job/web-pipeline-volt/job/main/'
    //     ]
    // }

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
