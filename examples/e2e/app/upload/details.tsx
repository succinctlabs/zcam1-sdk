import { useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Image,
  Button,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import {
  useProofRequestStatus,
  useProver,
  FulfillmentStatus,
} from "@succinctlabs/react-native-zcam1-prove";
import { AuthenticityStatus } from "@succinctlabs/react-native-zcam1-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import { VerifiableFile } from "@succinctlabs/react-native-zcam1-verify";

export default function Details() {
  const { uri, authStatus } = useLocalSearchParams<{
    uri: string;
    authStatus: string;
  }>();

  let actions = undefined;

  switch (authStatus) {
    case AuthenticityStatus.Bindings.toString():
      actions = <Bindings uri={uri} />;
      break;
    case AuthenticityStatus.Proof.toString():
      actions = <Proof uri={uri} />;
      break;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <Image source={{ uri }} style={styles.image} />
        <View style={styles.actions}>{actions}</View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Bindings({ uri }: { uri: string }) {
  const { provingClient, isInitializing, provingTasks } = useProver();
  const [requestId, setRequestId] = useState<string | null>(null);
  const [isProving, setIsProving] = useState(false);
  const { proof, fulfillementStatus } = useProofRequestStatus(requestId);

  const fulfillementStatusAsString = useMemo(() => {
    switch (fulfillementStatus) {
      case FulfillmentStatus.UnspecifiedFulfillmentStatus:
      case FulfillmentStatus.Requested:
        return "Requested";
      case FulfillmentStatus.Assigned:
        return "Assigned";
      case FulfillmentStatus.Fulfilled:
        return "Fulfilled";
      case FulfillmentStatus.Unfulfillable:
        return "Unfulfillable";
    }
  }, [fulfillementStatus]);

  const provingTaskRequestId = useMemo(() => {
    const entry = Object.entries(provingTasks).find(
      ([requestId, t]) => uri === "file://" + t.photoPath,
    );
    return entry?.[0] ?? null;
  }, [provingTasks, uri]);

  useEffect(() => {
    if (provingTaskRequestId && requestId !== provingTaskRequestId) {
      setIsProving(true);
      setRequestId(provingTaskRequestId);
    }
  }, [provingTaskRequestId, requestId]);

  const requestProof = useCallback(async () => {
    if (uri && provingClient) {
      setIsProving(true);
      const requestId = await provingClient.requestProof(uri);
      setRequestId(requestId);
    }
  }, [provingClient, uri]);

  return (
    <View>
      {!isProving && (
        <View>
          <Text style={styles.title}>This photo has bindings attached</Text>
          <Button
            title="Generate a proof"
            onPress={requestProof}
            disabled={isInitializing}
          />
        </View>
      )}
      {isProving && !proof && (
        <View>
          <View>
            <ActivityIndicator size={72} />
            <Text style={styles.title}>Generating a proof...</Text>
            <Text style={styles.subtitle}>
              This may take a few seconds. Please keep the app open.
            </Text>
            <Text>Proof status: {fulfillementStatusAsString}</Text>
          </View>
        </View>
      )}
      {proof && (
        <View>
          <Text style={styles.title}>The proof has been generated!</Text>
        </View>
      )}
    </View>
  );
}

function Proof({ uri }: { uri: string }) {
  const [isValid, setIsValid] = useState<boolean | undefined>(undefined);
  const [hash, setHash] = useState<string | undefined>(undefined);

  const verifyProof = useCallback(async () => {
    try {
      const verifier = new VerifiableFile(uri);

      setIsValid(verifier.verifyProof());
      setHash(verifier.dataHash());
    } catch (error) {
      console.error(error);
      setIsValid(false);
    }
  }, [uri]);

  return (
    <View>
      {isValid === undefined && (
        <View>
          <Text style={styles.title}>This photo has a proof attached</Text>
          <Button title="Verify the proof" onPress={verifyProof} />
        </View>
      )}
      {isValid && (
        <View>
          <Text style={styles.title}>The proof is valid!</Text>
          <Text>
            The hash {hash} from the public values match the actual photo hash{" "}
            {hash}
          </Text>
        </View>
      )}
      {isValid === false && (
        <View>
          <Text style={styles.title}>The proof not valid</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 8,
    justifyContent: "flex-start", // top aligned vertically
    alignItems: "stretch",
  },
  image: {
    flex: 1,
    width: "100%",
    resizeMode: "contain",
  },
  actions: {
    flex: 0,
    padding: 12,
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
