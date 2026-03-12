add-yalc:
    cd react-native-zcam1 && yalc publish
    cd examples/e2e && yalc add @succinctlabs/react-native-zcam1
    cd examples/android-test && yalc add @succinctlabs/react-native-zcam1

remove-yalc:
    cd react-native-zcam1 && yalc remove --all
    cd examples/e2e && yalc remove --all
    cd examples/android-test && yalc remove --all

run-e2e-example:
    #!/usr/bin/env sh
    cd examples/e2e
    npx expo prebuild && npx expo run:ios --device

run-android-test:
    #!/usr/bin/env sh
    cd examples/android-test
    npx expo prebuild --platform android && npx expo run:android

publish $NPM_CONFIG_REGISTRY:
    cd react-native-zcam1 && npm publish --access public

clean:
    cd react-native-zcam1 && npm run clean

lint:
    cd react-native-zcam1 && npm run lint

format:
    cd react-native-zcam1 && npm run format
