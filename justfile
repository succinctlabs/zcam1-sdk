update-react-native-zcam1-c2pa $NPM_CONFIG_REGISTRY:
    #!/usr/bin/env sh
    cd react-native-zcam1-c2pa
    npm unpublish --force
    npm publish

update-react-native-zcam1-capture $NPM_CONFIG_REGISTRY: (update-react-native-zcam1-c2pa NPM_CONFIG_REGISTRY)
    #!/usr/bin/env sh
    cd react-native-zcam1-capture
    npm rm react-native-zcam1-c2pa
    npm i react-native-zcam1-c2pa@latest --force
    npm unpublish --force
    npm publish

update-react-native-zcam1-verify $NPM_CONFIG_REGISTRY: (update-react-native-zcam1-c2pa NPM_CONFIG_REGISTRY)
    #!/usr/bin/env sh
    cd react-native-zcam1-verify
    npm rm react-native-zcam1-c2pa
    npm i react-native-zcam1-c2pa@latest --force
    npm unpublish --force
    npm publish

update-capture-example $NPM_CONFIG_REGISTRY: (update-react-native-zcam1-capture NPM_CONFIG_REGISTRY)
    #!/usr/bin/env sh
    cd examples/capture
    npm rm react-native-zcam1-capture
    npm i react-native-zcam1-capture@latest --force

update-verify-example $NPM_CONFIG_REGISTRY: (update-react-native-zcam1-verify NPM_CONFIG_REGISTRY)
    #!/usr/bin/env sh
    cd examples/verify
    npm rm react-native-zcam1-verify
    npm i react-native-zcam1-verify@latest --force

run-capture-example DEVICE:
    #!/usr/bin/env sh
    cd examples/capture
    npx expo prebuild && npx expo run:ios --device {{DEVICE}}

run-verify-example DEVICE:
    #!/usr/bin/env sh
    cd examples/verify
    npx expo prebuild && npx expo run:ios --device {{DEVICE}}

update-and-run-capture-example DEVICE $NPM_CONFIG_REGISTRY: (update-capture-example NPM_CONFIG_REGISTRY) (run-capture-example DEVICE)
