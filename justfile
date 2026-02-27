add-yalc:
    cd react-native-zcam1 && yalc publish
    cd examples/capture && yalc add @succinctlabs/react-native-zcam1
    cd examples/prove && yalc add @succinctlabs/react-native-zcam1
    cd examples/e2e && yalc add @succinctlabs/react-native-zcam1

remove-yalc:
    cd react-native-zcam1 && yalc remove --all
    cd examples/capture && yalc remove --all
    cd examples/prove && yalc remove --all
    cd examples/verify && yalc remove --all
    cd examples/e2e && yalc remove --all

run-capture-example:
    #!/usr/bin/env sh
    cd examples/capture
    npx expo prebuild && npx expo run:ios --device

run-prove-example:
    #!/usr/bin/env sh
    cd examples/prove
    npx expo prebuild && npx expo run:ios --device

run-verify-example:
    #!/usr/bin/env sh
    cd examples/verify
    npx expo prebuild && npx expo run:ios --device

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
