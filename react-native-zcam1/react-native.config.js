module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath:
          'import com.succinctlabs.zcam1sdk.Zcam1SdkPackage;\nimport com.succinctlabs.zcam1sdk.Zcam1ProvingPackage;',
        packageInstance: 'new Zcam1SdkPackage(), new Zcam1ProvingPackage()',
      },
    },
  },
};
