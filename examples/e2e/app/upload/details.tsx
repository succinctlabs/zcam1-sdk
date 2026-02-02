import { useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  Button,
  Pressable,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import {
  AuthenticityStatus,
  VerifiableFile,
  type PhotoMetadataInfo,
  type VideoMetadataInfo,
  type CaptureMetadata,
} from "@succinctlabs/react-native-zcam1";
import {
  useProofRequestStatus,
  useProver,
  FulfillmentStatus,
} from "@succinctlabs/react-native-zcam1/proving";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Video } from "react-native-video";
import Toast from "react-native-toast-message";
import { Util } from "react-native-file-access";

export default function Details() {
  const { uri, authStatus } = useLocalSearchParams<{
    uri: string;
    authStatus: string;
  }>();

  const isVideo = useMemo(() => {
    const ext = Util.extname(uri)?.toLowerCase();
    return ext === "mov" || ext === "mp4";
  }, [uri]);

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
      actions = <Bindings uri={uri} isVideo={isVideo} verifier={verifier} />;
      break;
    case AuthenticityStatus.Proof.toString():
      actions = <Proof uri={uri} isVideo={isVideo} verifier={verifier} />;
      break;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ScrollView>
          <Preview uri={uri} isVideo={isVideo} />
          {metadata && <CaptureInfo metadata={metadata} isVideo={isVideo} />}
          <View style={styles.actions}>{actions}</View>
        </ScrollView>
      </SafeAreaView>
      <Toast />
    </SafeAreaProvider>
  );
}

function CaptureInfo({
  metadata,
  isVideo,
}: {
  metadata: CaptureMetadata;
  isVideo: boolean;
}) {
  const params = metadata.parameters;
  return (
    <View>
      <View style={styles.metadataSection}>
        <Text style={styles.sectionTitle}>Capture Info</Text>
        {params.deviceMake && params.deviceModel && (
          <Text style={styles.metadataRow}>
            Device: {params.deviceMake} {params.deviceModel}
          </Text>
        )}
        {params.softwareVersion && (
          <Text style={styles.metadataRow}>
            Software: {params.softwareVersion}
          </Text>
        )}
        <Text style={styles.metadataRow}>
          Captured: {formatDate(metadata.when)}
        </Text>
        {isVideo ? (
          <VideoCaptureInfo metadata={params as VideoMetadataInfo} />
        ) : (
          <PhotoCaptureInfo metadata={params as PhotoMetadataInfo} />
        )}
      </View>
    </View>
  );
}

function PhotoCaptureInfo({ metadata }: { metadata: PhotoMetadataInfo }) {
  // Format ISO - handle array or single value
  const formatIso = (iso: string[] | string | number | undefined) => {
    if (!iso) return null;
    if (Array.isArray(iso)) {
      return iso.join(", ");
    }
    return String(iso);
  };

  return (
    <View>
      <View>
        {metadata.xResolution && metadata.yResolution && (
          <Text style={styles.metadataRow}>
            Resolution: {metadata.xResolution} x {metadata.yResolution}
          </Text>
        )}
        {metadata.orientation !== undefined && (
          <Text style={styles.metadataRow}>
            Orientation: {metadata.orientation}
          </Text>
        )}
        {!!metadata.iso && (
          <Text style={styles.metadataRow}>ISO: {formatIso(metadata.iso)}</Text>
        )}
        {metadata.exposureTime !== undefined && (
          <Text style={styles.metadataRow}>
            Exposure: {formatTime(metadata.exposureTime)}
          </Text>
        )}
        {metadata.focalLength !== undefined && (
          <Text style={styles.metadataRow}>
            Focal Length: {metadata.focalLength}mm
          </Text>
        )}
        {metadata.depthOfField !== undefined && (
          <Text style={styles.metadataRow}>
            Depth of Field: {metadata.depthOfField}
          </Text>
        )}
      </View>
      {metadata.depthData && (
        <View style={styles.metadataSection}>
          <Text style={styles.sectionTitle}>Depth data</Text>
          <Text style={styles.metadataRow}>
            Min: {metadata.depthData.statistics.min}
          </Text>
          <Text style={styles.metadataRow}>
            Max: {metadata.depthData.statistics.max}
          </Text>
          <Text style={styles.metadataRow}>
            Mean: {metadata.depthData.statistics.mean}
          </Text>
          <Text style={styles.metadataRow}>
            Sdt dev: {metadata.depthData.statistics.stdDev}
          </Text>
          <Text style={styles.metadataRow}>
            Pixel format: {metadata.depthData.pixelFormat}
          </Text>
          <Text style={styles.metadataRow}>
            Valid pixel count: {metadata.depthData.statistics.validPixelCount}
          </Text>
        </View>
      )}
    </View>
  );
}

function VideoCaptureInfo({ metadata }: { metadata: VideoMetadataInfo }) {
  return (
    <View>
      <Text style={styles.metadataRow}>Format: {metadata.format}</Text>
      {metadata.width && metadata.height && (
        <Text style={styles.metadataRow}>
          Resolution: {metadata.width} x {metadata.height}
        </Text>
      )}
      <Text style={styles.metadataRow}>
        Duration: {formatTime(metadata.durationSeconds)}
      </Text>

      <Text style={styles.metadataRow}>
        Rotation: {metadata.rotationDegrees}
      </Text>
      <Text style={styles.metadataRow}>
        File size: {formatBytesToMB(metadata.fileSizeBytes)}
      </Text>
      <Text style={styles.metadataRow}>Frame rate: {metadata.frameRate}</Text>
      {metadata.videoCodec && (
        <Text style={styles.metadataRow}>
          Video codec: {metadata.videoCodec}
        </Text>
      )}
      {metadata.audioCodec && (
        <Text style={styles.metadataRow}>
          Audio codec: {metadata.audioCodec}
        </Text>
      )}
      {metadata.audioSampleRate && (
        <Text style={styles.metadataRow}>
          Audio sample rate: {metadata.audioSampleRate}
        </Text>
      )}
      {metadata.audioChannels && (
        <Text style={styles.metadataRow}>
          Audio channels: {metadata.audioChannels}
        </Text>
      )}
    </View>
  );
}

function Preview({ uri, isVideo }: { uri: string; isVideo: boolean }) {
  const [isPaused, setIsPaused] = useState(true);

  return isVideo ? (
    <Pressable
      style={styles.image}
      onPress={() => setIsPaused((paused) => !paused)}
    >
      <Video
        source={{ uri: uri.replace("file://", "") }}
        style={styles.image}
        paused={isPaused}
      />
    </Pressable>
  ) : (
    <Image source={{ uri }} style={styles.image} />
  );
}

function Bindings({
  uri,
  isVideo,
  verifier,
}: {
  uri: string;
  isVideo: boolean;
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
          <Text style={styles.title}>
            This {isVideo ? "video" : "photo"} has bindings attached
          </Text>
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

function Proof({
  uri,
  isVideo,
  verifier,
}: {
  uri: string;
  isVideo: boolean;
  verifier: VerifiableFile;
}) {
  const [isValid, setIsValid] = useState<boolean | undefined>(undefined);
  const [hash, setHash] = useState<string | undefined>(undefined);

  const verifyProof = useCallback(async () => {
    const appId = process.env.EXPO_PUBLIC_APP_ID!;
    try {
      setIsValid(verifier.verifyProof(appId));
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
          <Text style={styles.title}>
            This {isVideo ? "video" : "photo"} has a proof attached
          </Text>
          <Button title="Verify the proof" onPress={verifyProof} />
        </View>
      )}
      {isValid && (
        <View>
          <Text style={styles.title}>The proof is valid!</Text>
          <Text>
            The hash {hash} from the public values match the actual photo hash
          </Text>
          <Text style={styles.subtitle}> </Text>
          <Text style={styles.bold}>
            This photo originates from &quot;ZCAM1 SDK E2E example&quot; app
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

// Format capture date - handle various formats
const formatDate = (when: string) => {
  const date = new Date(when);
  if (!isNaN(date.getTime())) {
    return date.toLocaleString();
  }
  // If invalid date, just return the raw value
  return when;
};

// Format time to 2 decimal places
const formatTime = (time: number | undefined) => {
  if (time === undefined) return null;
  return `${time.toFixed(2)}s`;
};

const formatBytesToMB = (bytes: number | undefined) => {
  if (bytes === undefined || !Number.isFinite(bytes)) return "Unknown";
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

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
    aspectRatio: 1,
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
  bold: {
    fontSize: 14,
    fontWeight: "bold",
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
