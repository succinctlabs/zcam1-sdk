import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { useRef, useState, useEffect, useMemo } from "react";
import { StyleSheet, Button, View } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { DeviceInfo, initDevice, ZCamera } from "react-native-zcam1-capture";

export default function Index() {
  const camera = useRef<ZCamera>(null);
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

  const capture = async () => {
    const photo = await camera.current?.takePhoto();

    try {
      let res = await CameraRoll.saveAsset(photo!.path, { album: "ZCAM1" });
      console.log("Saved: " + res.node.image.filename);
    } catch (error) {
      console.error("Error saving photo:", error);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1 }}>
          <ZCamera ref={camera} deviceInfo={deviceInfo!} settings={settings} />
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
