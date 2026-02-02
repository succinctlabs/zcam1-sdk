import ConfigPlugins from "@expo/config-plugins";
const { withPodfileProperties } = ConfigPlugins;
function withZcam1Sdk(config, props) {
  const enableProving = !!(props && props.enableProving);
  return withPodfileProperties(config, (config) => {
    config.modResults = { enableProving: enableProving ? "true" : "false" };
    return config;
  });
}

export { withZcam1Sdk as default };
