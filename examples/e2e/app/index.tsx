import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Button, View } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { FileSystem, Dirs, Util } from "react-native-file-access";
import { DeviceInfo, initDevice, ZCamera } from "react-native-zcam1-capture";

export default function Home() {
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
    const targetPath = Dirs.DocumentDir + "/" + Util.basename(photo?.path!);

    console.log("Target", targetPath);

    FileSystem.cp(photo?.path!, targetPath);
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
  },
});
