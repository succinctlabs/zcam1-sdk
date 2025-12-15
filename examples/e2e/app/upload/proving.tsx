import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { embedProof, initDevice, DeviceInfo } from "react-native-zcam1-prove";

export default function Proving() {
  const appId = process.env.EXPO_PUBLIC_APP_ID!;
  const router = useRouter();
  const { uri } = useLocalSearchParams<{ uri?: string }>();

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

  useEffect(() => {
    async function generateProof() {
      if (uri && deviceInfo) {
        const outputPath = await embedProof(uri, deviceInfo, settings);

        try {
          await CameraRoll.saveAsset(outputPath, { album: "ZCAM1" });
          console.log("Photo with proof saved");
          router.dismiss();
          router.navigate("/upload/proved");
        } catch (error) {
          console.error("Error saving photo:", error);
        }
      }
    }

    generateProof();
  }, [router, uri, deviceInfo, settings]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <View>
          <ActivityIndicator size={72} />
          <Text style={styles.title}>Generating a proof...</Text>
          <Text style={styles.subtitle}>
            This may take a few seconds. Please keep the app open.
          </Text>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 14,
  },
});
