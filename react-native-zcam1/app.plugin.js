import ConfigPlugins from "@expo/config-plugins";
const { withPodfileProperties, withGradleProperties } = ConfigPlugins;

function withZcam1Sdk(config, props) {
  const enableProving = !!(props && props.enableProving);

  // iOS: write to Podfile.properties.json (read by Zcam1Sdk.podspec)
  config = withPodfileProperties(config, (config) => {
    config.modResults.enableProving = enableProving ? "true" : "false";
    return config;
  });

  // Android: write to gradle.properties (read by build.gradle)
  config = withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => !(item.type === "property" && item.key === "enableProving")
    );
    config.modResults.push({
      type: "property",
      key: "enableProving",
      value: enableProving ? "true" : "false",
    });
    return config;
  });

  return config;
}

export { withZcam1Sdk as default };
