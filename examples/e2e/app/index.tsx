import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Button, View, Text } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { FileSystem, Dirs, Util } from "react-native-file-access";
import {
  CaptureInfo,
  initCapture,
  ZCamera,
} from "@succinctlabs/react-native-zcam1-capture";
import Toast from "react-native-toast-message";

export default function Home() {
  const camera = useRef<ZCamera>(null);
  const appId = process.env.EXPO_PUBLIC_APP_ID!;
  const [captureInfo, setCaptureInfo] = useState<CaptureInfo | undefined>(
    undefined,
  );

  const settings = useMemo(() => {
    return {
      appId,
      production: false,
    };
  }, [appId]);

  useEffect(() => {
    async function fetchDevice() {
      const captureInfo = await initCapture(settings);
      setCaptureInfo(captureInfo);
    }

    fetchDevice();
  }, [settings]);

  const capture = async () => {
    const photo = await camera.current?.takePhoto();
    const targetPath = Dirs.DocumentDir + "/captured/";
    const targetFile = targetPath + Util.basename(photo?.path!);

    await FileSystem.exists(targetPath).then((exists) => {
      if (!exists) return FileSystem.mkdir(targetPath);
    });

    await FileSystem.cp(photo?.path!, targetFile);

    Toast.show({
      type: "success",
      text1: "A photo has been captured",
      text2: "And saved to an internal folder",
    });
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1 }}>
          {captureInfo ? (
            <ZCamera ref={camera} captureInfo={captureInfo} />
          ) : (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text>Initializing device...</Text>
            </View>
          )}
        </View>
        <View>
          <Button title="Capture" onPress={capture} />
        </View>
        <Toast />
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
