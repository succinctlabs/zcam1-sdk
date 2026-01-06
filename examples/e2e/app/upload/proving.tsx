import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { useProver } from "@succinctlabs/react-native-zcam1-prove";
import Toast from "react-native-toast-message";
import { FileSystem, Util } from "react-native-file-access";
import { isEmulator } from "react-native-device-info";
import { privateDirectory } from "@succinctlabs/react-native-zcam1-picker";

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
          const targetPath = privateDirectory();
          const targetFile = targetPath + "/" + Util.basename(outputPath);

          await FileSystem.cp(outputPath, targetFile);
          await FileSystem.unlink(uri);

          const emulator = await isEmulator();
          if (emulator) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }

          router.dismiss();

          Toast.show({
            type: "success",
            text1: "The proof has been generated",
            text2: "The photo has been saved to the iOS Photo Gallery",
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
