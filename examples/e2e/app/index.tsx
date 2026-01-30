import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Button, View, Text, Switch } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { FileSystem, Util } from "react-native-file-access";
import {
  CaptureInfo,
  initCapture,
  ZCamera,
  privateDirectory,
} from "@succinctlabs/react-native-zcam1";
import Toast from "react-native-toast-message";

enum CaptureMode {
  Photo = "photo",
  Video = "video",
}

export default function Home() {
  const appId = process.env.EXPO_PUBLIC_APP_ID!;
  const [captureInfo, setCaptureInfo] = useState<CaptureInfo | undefined>(
    undefined,
  );
  const [captureMode, setCaptureMode] = useState(CaptureMode.Photo);
  const [isRecording, setIsRecording] = useState(false);
  const camera = useRef<ZCamera>(null);

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

  const toggleCaptureMode = useCallback(() => {
    setCaptureMode((prev) => {
      switch (prev) {
        case CaptureMode.Photo:
          return CaptureMode.Video;
        case CaptureMode.Video:
          return CaptureMode.Photo;
      }
    });
  }, [setCaptureMode]);

  const capture = async () => {
    const photo = await camera.current?.takePhoto({ includeDepthData: true });
    const targetPath = privateDirectory();
    const targetFile = targetPath + "/" + Util.basename(photo?.path!);

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

  const record = async () => {
    if (isRecording) {
      setIsRecording(false);
      const result = await camera.current?.stopVideoRecording();
      const targetPath = privateDirectory();
      const targetFile = targetPath + "/" + Util.basename(result?.filePath!);

      await FileSystem.exists(targetPath).then((exists) => {
        if (!exists) return FileSystem.mkdir(targetPath);
      });

      await FileSystem.cp(result?.filePath!, targetFile);

      Toast.show({
        type: "success",
        text1: "A video has been recorded",
        text2: "And saved to an internal folder",
      });
    } else {
      setIsRecording(true);
      await camera.current?.startVideoRecording();
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Switch
            value={captureMode === CaptureMode.Video}
            onValueChange={toggleCaptureMode}
            style={{ padding: 8 }}
          />
          <View style={{ flex: 1 }}>
            {captureMode === CaptureMode.Photo ? (
              <Button title="Capture Photo" onPress={capture} />
            ) : (
              <Button
                title={isRecording ? "Stop Recording" : "Record Video"}
                onPress={record}
              />
            )}
          </View>
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
