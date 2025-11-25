import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { useRef } from "react";
import { StyleSheet, Button, View } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { init, ZCamera } from "react-native-zcam1-sdk";

export default function Index() {
  const camera = useRef<ZCamera>(null);

  const capture = async () => {
    const photo = await camera.current?.takePhoto();

    try {
      let res = await CameraRoll.saveAsset(photo!.path);
      console.log("Saved: " + res.node.image.filename);
    } catch (error) {
      console.error("Error saving photo:", error);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1 }}>
          <ZCamera ref={camera} />
        </View>
        <View>
          <Button title="Init" onPress={initZcam1} />
        </View>
        <View>
          <Button title="Capture" onPress={capture} />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    marginHorizontal: 16,
  },
  title: {
    textAlign: "center",
    marginVertical: 8,
  },
  fixToText: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  separator: {
    marginVertical: 8,
    borderBottomColor: "#737373",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

function initZcam1() {
  let settings = {
    appId: process.env.EXPO_PUBLIC_APP_ID!,
    backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL!,
    production: false,
  };

  init(settings);
}
