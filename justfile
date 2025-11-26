bump-deps $NPM_CONFIG_REGISTRY:
    #!/usr/bin/env sh
    cd react-native-zcam1-c2pa
    npm version patch
    npm publish
    cd ../react-native-zcam1-capture
    npm version patch
    npm i react-native-zcam1-c2pa@latest
    npm publish
    cd ../examples/capture
    npm i react-native-zcam1-capture@latest
