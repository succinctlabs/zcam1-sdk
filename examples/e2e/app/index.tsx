import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Button, View, Text } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { FileSystem, Util } from "react-native-file-access";
import {
  buildSelfSignedCertificate,
  CaptureInfo,
  embedBindings,
  initCapture,
} from "@succinctlabs/react-native-zcam1-capture";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import Toast from "react-native-toast-message";
import { privateDirectory } from "@succinctlabs/react-native-zcam1-picker";

export default function Home() {
  const device = useCameraDevice("back");
  const { requestPermission } = useCameraPermission();
  const camera = useRef<Camera>(null);
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

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  const certChainPem = useMemo(() => {
    if (captureInfo) {
      return buildSelfSignedCertificate(captureInfo.contentPublicKey);
    }
  }, [captureInfo]);

  const capture = async () => {
    if (camera.current && captureInfo && certChainPem) {
      const photo = await camera.current.takePhoto();
      const targetPath = privateDirectory();
      const targetFile = targetPath + "/" + Util.basename(photo.path!);

      await FileSystem.exists(targetPath).then((exists) => {
        if (!exists) return FileSystem.mkdir(targetPath);
      });

      let photoWithBindings = await embedBindings(
        photo.path,
        "",
        {
          device_make: "",
          device_model: "",
          software_version: "",
        },
        captureInfo,
        certChainPem,
      );

      await FileSystem.cp(photoWithBindings, targetFile);

      Toast.show({
        type: "success",
        text1: "A photo has been captured",
        text2: "And saved to an internal folder",
      });
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1 }}>
          {device ? (
            <Camera
              style={StyleSheet.absoluteFill}
              ref={camera}
              device={device}
              isActive={true}
              photo={true}
            />
          ) : (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text>No camera device found</Text>
            </View>
          )}
        </View>
        <View>
          <Button
            title="Capture"
            onPress={capture}
            disabled={!camera.current || !captureInfo || !certChainPem}
          />
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
