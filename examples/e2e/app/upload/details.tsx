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
import {
  VerifiableFile,
  type CaptureMetadata,
} from "@succinctlabs/react-native-zcam1-verify";
import Toast from "react-native-toast-message";

export default function Details() {
  const { uri, authStatus } = useLocalSearchParams<{
    uri: string;
    authStatus: string;
  }>();

  const verifier = useMemo(() => new VerifiableFile(uri), [uri]);

  const metadata = useMemo(() => {
    try {
      return verifier.captureMetadata();
    } catch {
      return null;
    }
  }, [verifier]);

  let actions = undefined;

  switch (authStatus) {
    case AuthenticityStatus.Bindings.toString():
      actions = <Bindings uri={uri} verifier={verifier} />;
      break;
    case AuthenticityStatus.Proof.toString():
      actions = <Proof uri={uri} verifier={verifier} />;
      break;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <Image source={{ uri }} style={styles.image} />
        {metadata && <CaptureInfo metadata={metadata} />}
        <View style={styles.actions}>{actions}</View>
      </SafeAreaView>
      <Toast />
    </SafeAreaProvider>
  );
}

function CaptureInfo({ metadata }: { metadata: CaptureMetadata }) {
  const params = metadata.parameters;

  // Format capture date - handle various formats
  const formatDate = (when: string) => {
    const date = new Date(when);
    if (!isNaN(date.getTime())) {
      return date.toLocaleString();
    }
    // If invalid date, just return the raw value
    return when;
  };

  // Format ISO - handle array or single value
  const formatIso = (iso: string[] | string | number | undefined) => {
    if (!iso) return null;
    if (Array.isArray(iso)) {
      return iso.join(", ");
    }
    return String(iso);
  };

  // Format exposure time to 2 decimal places
  const formatExposure = (time: number | undefined) => {
    if (!time) return null;
    return `${time.toFixed(2)}s`;
  };

  return (
    <View style={styles.metadataSection}>
      <Text style={styles.sectionTitle}>Capture Info</Text>
      {params.device_make && params.device_model && (
        <Text style={styles.metadataRow}>
          Device: {params.device_make} {params.device_model}
        </Text>
      )}
      {params.software_version && (
        <Text style={styles.metadataRow}>
          Software: {params.software_version}
        </Text>
      )}
      <Text style={styles.metadataRow}>Captured: {formatDate(metadata.when)}</Text>
      {params.x_resolution && params.y_resolution && (
        <Text style={styles.metadataRow}>
          Resolution: {params.x_resolution} x {params.y_resolution}
        </Text>
      )}
      {params.orientation && (
        <Text style={styles.metadataRow}>Orientation: {params.orientation}</Text>
      )}
      {params.iso && (
        <Text style={styles.metadataRow}>ISO: {formatIso(params.iso)}</Text>
      )}
      {params.exposure_time && (
        <Text style={styles.metadataRow}>
          Exposure: {formatExposure(params.exposure_time)}
        </Text>
      )}
      {params.focal_length && (
        <Text style={styles.metadataRow}>
          Focal Length: {params.focal_length}mm
        </Text>
      )}
      {params.depth_of_field && (
        <Text style={styles.metadataRow}>
          Depth of Field: {params.depth_of_field}
        </Text>
      )}
    </View>
  );
}

function Bindings({
  uri,
  verifier,
}: {
  uri: string;
  verifier: VerifiableFile;
}) {
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

  const verifyBindings = useCallback(async () => {
    const isValid = verifier.verifyBindings(false);

    if (isValid) {
      Toast.show({
        type: "success",
        text1: "The bindings are valid",
      });
    } else {
      Toast.show({
        type: "error",
        text1: "The bindings are invalid",
      });
    }
  }, [verifier]);

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

          <Button
            title="Verify the bindings"
            onPress={verifyBindings}
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

function Proof({ uri, verifier }: { uri: string; verifier: VerifiableFile }) {
  const [isValid, setIsValid] = useState<boolean | undefined>(undefined);
  const [hash, setHash] = useState<string | undefined>(undefined);

  const verifyProof = useCallback(async () => {
    try {
      setIsValid(verifier.verifyProof());
      setHash(verifier.dataHash());
    } catch (error) {
      console.error(error);
      setIsValid(false);
    }
  }, [verifier]);

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
            The hash {hash} from the public values match the actual photo hash
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
  metadataSection: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  metadataRow: {
    fontSize: 14,
    color: "#555",
    marginBottom: 4,
  },
});
