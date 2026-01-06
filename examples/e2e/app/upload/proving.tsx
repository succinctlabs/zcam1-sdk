import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { useProver } from "@succinctlabs/react-native-zcam1-prove";
import Toast from "react-native-toast-message";
import { FileSystem } from "react-native-file-access";

export default function Proving() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ProofGeneration />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function ProofGeneration() {
  const router = useRouter();
  const { uri } = useLocalSearchParams<{ uri?: string }>();

  const { provingClient, isInitializing, error } = useProver();

  useEffect(() => {
    async function generateProof() {
      if (uri && provingClient) {
        const outputPath = await provingClient.embedProof(uri);

        try {
          await CameraRoll.saveAsset(outputPath, { album: "ZCAM1" });
          await FileSystem.unlink(uri);
          router.dismiss();

          Toast.show({
            type: "success",
            text1: "The proof has been generated",
            text2: "The photo has benn saved to the iOS Photo Gallery",
          });

          router.navigate("/");
        } catch (error) {
          console.error("Error saving photo:", error);
        }
      }
    }

    generateProof();
  }, [router, provingClient, uri]);

  if (error) {
    return <Text>{error.toString()}</Text>;
  }

  if (isInitializing) {
    return (
      <View>
        <ActivityIndicator size={72} />
        <Text style={styles.title}>Prover initializing...</Text>
      </View>
    );
  }

  return (
    <View>
      <ActivityIndicator size={72} />
      <Text style={styles.title}>Generating a proof...</Text>
      <Text style={styles.subtitle}>
        This may take a few seconds. Please keep the app open.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    margin: 8,
    fontSize: 20,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 14,
  },
});
