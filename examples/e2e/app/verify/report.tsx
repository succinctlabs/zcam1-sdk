import { useLocalSearchParams } from "expo-router";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import {
  VerifiableFile,
  APPLE_ROOT_CERT,
} from "@succinctlabs/react-native-zcam1-verify";
import { useEffect, useState } from "react";

export default function Report() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <Verification />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Verification() {
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  const [isValid, setIsValid] = useState<boolean | undefined>(undefined);
  const [hash, setHash] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function verify() {
      if (uri) {
        const verifier = new VerifiableFile(uri);

        setHash(verifier.dataHash());
        setIsValid(verifier.verifyProof());
      }
    }

    verify();
  }, [uri]);

  if (isValid === undefined) {
    return (
      <View>
        <ActivityIndicator size={72} />
        <Text style={styles.title}>Verification...</Text>
      </View>
    );
  }

  if (isValid) {
    return (
      <View>
        <Text style={styles.title}>The proof is valid!</Text>
        <Text style={styles.subtitle}>
          The proof has been verified against the following public values:
        </Text>
        <Text>Hash: {hash}</Text>
        <Text>Apple Root Cert: {APPLE_ROOT_CERT}</Text>
      </View>
    );
  } else {
    return (
      <View>
        <Text style={styles.title}>The proof is invalid.</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
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
