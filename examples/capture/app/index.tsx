import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { useRef, useState, useEffect, useMemo } from "react";
import { StyleSheet, Button, View, Text } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import {
  CaptureInfo,
  initCapture,
  ZCamera,
} from "@succinctlabs/react-native-zcam1-capture";

export default function Index() {
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
      try {
        const captureInfo = await initCapture(settings);
        setCaptureInfo(captureInfo);
      } catch (error) {
        console.error("Failed to initialize device:", error);
      }
    }

    fetchDevice();
  }, [settings]);

  const capture = async () => {
    const photo = await camera.current?.takePhoto();

    try {
      let res = await CameraRoll.saveAsset(photo!.path, {
        album: "ZCAM1",
      });
      console.log("Saved: " + res.node.image.filename);
    } catch (error) {
      console.error("Error saving photo:", error);
    }
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
          <Button title="Capture" onPress={capture} disabled={!captureInfo} />
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
