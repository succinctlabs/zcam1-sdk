
add-yalc:
    cd zcam1-common && yalc publish
    cd react-native-zcam1-c2pa && yalc publish
    cd react-native-zcam1-capture && yalc add zcam1-common react-native-zcam1-c2pa && yalc publish
    cd react-native-zcam1-prove && yalc add zcam1-common react-native-zcam1-c2pa && yalc publish
    cd react-native-zcam1-verify && yalc add react-native-zcam1-c2pa && yalc publish
    cd examples/capture && yalc add react-native-zcam1-capture react-native-zcam1-c2pa zcam1-common

remove-yalc:
    cd react-native-zcam1-capture && yalc remove --all
    cd react-native-zcam1-prove && yalc remove --all
    cd react-native-zcam1-verify && yalc remove --all
    cd examples/capture && yalc remove --all

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
