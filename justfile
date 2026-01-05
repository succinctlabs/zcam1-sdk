add-yalc:
    cd react-native-zcam1-common && yalc publish
    cd react-native-zcam1-c2pa && yalc publish
    cd react-native-zcam1-capture && yalc add @succinctlabs/react-native-zcam1-common @succinctlabs/react-native-zcam1-c2pa && yalc publish
    cd react-native-zcam1-prove && yalc add @succinctlabs/react-native-zcam1-common @succinctlabs/react-native-zcam1-c2pa && yalc publish
    cd react-native-zcam1-verify && yalc add @succinctlabs/react-native-zcam1-c2pa && yalc publish
    cd react-native-zcam1-picker && yalc add @succinctlabs/react-native-zcam1-c2pa && yalc publish
    cd examples/capture && yalc add @succinctlabs/react-native-zcam1-capture @succinctlabs/react-native-zcam1-c2pa @succinctlabs/react-native-zcam1-common
    cd examples/e2e && yalc add react-native-zcam1-capture @succinctlabs/react-native-zcam1-prove @succinctlabs/react-native-zcam1-picker @succinctlabs/react-native-zcam1-c2pa @succinctlabs/react-native-zcam1-common

remove-yalc:
    cd react-native-zcam1-capture && yalc remove --all
    cd react-native-zcam1-prove && yalc remove --all
    cd react-native-zcam1-verify && yalc remove --all
    cd react-native-zcam1-picker && yalc remove --all
    cd examples/capture && yalc remove --all
    cd examples/e2e && yalc remove --all

run-capture-example:
    #!/usr/bin/env sh
    cd examples/capture
    yalc update
    npx expo prebuild && npx expo run:ios --device

run-prove-example:
    #!/usr/bin/env sh
    cd examples/prove
    yalc update
    npx expo prebuild && npx expo run:ios --device

run-verify-example:
    #!/usr/bin/env sh
    cd examples/verify
    yalc update
    npx expo prebuild && npx expo run:ios --device

run-e2e-example:
    #!/usr/bin/env sh
    cd examples/e2e
    yalc update
    npx expo prebuild && npx expo run:ios --device
