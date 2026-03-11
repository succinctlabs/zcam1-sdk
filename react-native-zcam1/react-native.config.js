module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath:
          'import com.succinctlabs.zcam1sdk.Zcam1SdkPackage;\nimport com.succinctlabs.zcam1sdk.Zcam1ProvingPackage;\nimport com.succinctlabs.zcam1sdk.Zcam1CapturePackage;',
        packageInstance: 'new Zcam1SdkPackage(), new Zcam1ProvingPackage(), new Zcam1CapturePackage()',
      },
    },
  },
};
