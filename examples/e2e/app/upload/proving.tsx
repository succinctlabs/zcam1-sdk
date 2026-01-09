import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View, Text, StyleSheet, Image } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import {
  useProofRequestStatus,
  useProver,
} from "@succinctlabs/react-native-zcam1-prove";

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
  const [requestId, setRequestId] = useState<string | null>(null);
  const { proof, fulfillementStatus } = useProofRequestStatus(requestId);

  useEffect(() => {
    async function requestProof() {
      if (uri && provingClient) {
        const requestId = await provingClient.requestProof(uri);
        setRequestId(requestId);
      }
    }

    requestProof();
  }, [provingClient, uri]);

  useEffect(() => {
    if (requestId && proof) {
      router.dismiss();
    }
  }, [router, requestId, proof]);

  if (error) {
    return <Text>{error.toString()}</Text>;
  }

  if (isInitializing) {
    return (
      <View>
        <Image source={{ uri }} />
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
      <Text>Proof status: {fulfillementStatus}</Text>
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
