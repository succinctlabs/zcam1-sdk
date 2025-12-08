update-zcam1-common $NPM_CONFIG_REGISTRY:
    #!/usr/bin/env sh
    cd zcam1-common
    npm unpublish --force
    npm publish

update-react-native-zcam1-c2pa $NPM_CONFIG_REGISTRY:
    #!/usr/bin/env sh
    cd react-native-zcam1-c2pa
    npm unpublish --force
    npm publish

update-react-native-zcam1-capture $NPM_CONFIG_REGISTRY: (update-react-native-zcam1-c2pa NPM_CONFIG_REGISTRY) (update-zcam1-common NPM_CONFIG_REGISTRY)
    #!/usr/bin/env sh
    cd react-native-zcam1-capture
    npm rm react-native-zcam1-c2pa
    npm i react-native-zcam1-c2pa@latest --force
    npm rm zcam1-common
    npm i zcam1-common@latest --force
    npm unpublish --force
    npm publish

update-react-native-zcam1-prove $NPM_CONFIG_REGISTRY: (update-react-native-zcam1-c2pa NPM_CONFIG_REGISTRY) (update-zcam1-common NPM_CONFIG_REGISTRY)
    #!/usr/bin/env sh
    cd react-native-zcam1-prove
    npm rm react-native-zcam1-c2pa
    npm i react-native-zcam1-c2pa@latest --force
    npm rm zcam1-common
    npm i zcam1-common@latest --force
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

update-prove-example $NPM_CONFIG_REGISTRY: (update-react-native-zcam1-prove NPM_CONFIG_REGISTRY)
    #!/usr/bin/env sh
    cd examples/prove
    npm rm react-native-zcam1-prove
    npm i react-native-zcam1-prove@latest --force

update-verify-example $NPM_CONFIG_REGISTRY: (update-react-native-zcam1-verify NPM_CONFIG_REGISTRY)
    #!/usr/bin/env sh
    cd examples/verify
    npm rm react-native-zcam1-verify
    npm i react-native-zcam1-verify@latest --force

update-all $NPM_CONFIG_REGISTRY: (update-capture-example NPM_CONFIG_REGISTRY) (update-prove-example NPM_CONFIG_REGISTRY) (update-verify-example NPM_CONFIG_REGISTRY)

run-capture-example DEVICE:
    #!/usr/bin/env sh
    cd examples/capture
    npx expo prebuild && npx expo run:ios --device {{DEVICE}}

run-prove-example DEVICE:
    #!/usr/bin/env sh
    cd examples/prove
    npx expo prebuild && npx expo run:ios --device {{DEVICE}}

run-verify-example DEVICE:
    #!/usr/bin/env sh
    cd examples/verify
    npx expo prebuild && npx expo run:ios --device {{DEVICE}}
