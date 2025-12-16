import { StyleSheet, Button, View } from "react-native";
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { launchImageLibrary } from "react-native-image-picker";
import { DeviceInfo, embedProof, initDevice } from "react-native-zcam1-prove";
import { useEffect, useMemo, useState } from "react";

export default function Index() {
  const appId = process.env.EXPO_PUBLIC_APP_ID!;
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | undefined>(
    undefined,
  );

  const settings = useMemo(() => {
    return {
      appId,
      backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL!,
      production: false,
    };
  }, [appId]);

  useEffect(() => {
    async function fetchDevice() {
      const deviceInfo = await initDevice(settings);
      setDeviceInfo(deviceInfo);
    }

    fetchDevice();
  }, [settings]);

  const pick = async () => {
    const result = await launchImageLibrary({
      mediaType: "photo",
      selectionLimit: 1,
    });

    console.log("File", result.assets![0].uri);

    if (deviceInfo !== undefined) {
      const outputPath = await embedProof(
        result.assets![0].uri!,
        deviceInfo,
        settings,
      );

      console.log("Output File", outputPath);

      try {
        let res = await CameraRoll.saveAsset(outputPath);
        console.log("Saved: " + res.node.image.filename);
      } catch (error) {
        console.error("Error saving photo:", error);
      }
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1 }}>
          <Button title="Pick photo" onPress={pick} disabled={!deviceInfo} />
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
