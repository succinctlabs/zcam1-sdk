add-yalc:
    cd react-native-zcam1 && yalc publish
    cd examples/e2e && yalc add @succinctlabs/react-native-zcam1

remove-yalc:
    cd react-native-zcam1 && yalc remove --all
    cd examples/e2e && yalc remove --all

run-e2e-example:
    #!/usr/bin/env sh
    cd examples/e2e
    npx expo prebuild && npx expo run:ios --device

publish $NPM_CONFIG_REGISTRY:
    cd react-native-zcam1 && npm publish --access public

clean:
    cd react-native-zcam1 && npm run clean

lint:
    cd react-native-zcam1 && npm run lint

format:
    cd react-native-zcam1 && npm run format
