import { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { TurboModuleRegistry } from "react-native";
import {
  type CaptureInfo,
  initCapture,
  signWithDeviceKey,
  getDevicePublicKey,
  isDeviceKeyStrongboxBacked,
  checkPlayServicesAvailable,
} from "@succinctlabs/react-native-zcam1-capture";

const APP_ID = "com.anonymous.zcam1_android_test";

export default function Index() {
  const [log, setLog] = useState<string[]>([]);
  const [captureInfo, setCaptureInfo] = useState<CaptureInfo | null>(null);

  const addLog = useCallback((message: string) => {
    setLog((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
  }, []);

  // --- M1: Native Module ---

  const testNativeModule = useCallback(async () => {
    try {
      const mod = TurboModuleRegistry.get("Zcam1Sdk") as any;
      if (!mod) {
        addLog("ERROR: Zcam1Sdk module not found");
        return;
      }
      addLog("Zcam1Sdk module found!");
      try {
        const maxZoom = await mod.getMaxZoom();
        addLog(`getMaxZoom() => ${maxZoom}`);
      } catch (e: any) {
        addLog(`getMaxZoom failed: ${e.message}`);
      }
      try {
        const diag = await mod.getDeviceDiagnostics();
        addLog(`diagnostics => ${JSON.stringify(diag)}`);
      } catch (e: any) {
        addLog(`diagnostics failed: ${e.message}`);
      }
    } catch (e: any) {
      addLog(`ERROR: ${e.message}`);
    }
  }, [addLog]);

  // --- M2a: initCapture (Key Attestation) ---

  const testPlayServices = useCallback(async () => {
    try {
      addLog("Checking Play Services via SDK...");
      const available = await checkPlayServicesAvailable();
      addLog(`Play Services available: ${available}`);
    } catch (e: any) {
      addLog(`Play Services error: ${e.code || ""} ${e.message}`);
    }
  }, [addLog]);

  const testInitCapture = useCallback(async () => {
    try {
      addLog("Calling initCapture()...");
      const info = await initCapture({ appId: APP_ID, production: false });
      setCaptureInfo(info);
      addLog("initCapture SUCCESS!");
      addLog(`deviceKeyId: ${info.deviceKeyId}`);
      addLog(`contentPublicKey.kty: ${info.contentPublicKey.kty}`);
      if (info.contentPublicKey.kty === "EC") {
        addLog(`contentPublicKey.crv: ${info.contentPublicKey.crv}`);
      }
      addLog(`contentKeyId length: ${info.contentKeyId.length}`);
      addLog(`attestation length: ${info.attestation.length} chars`);
      addLog(`attestation preview: ${info.attestation.substring(0, 60)}...`);
    } catch (e: any) {
      addLog(`initCapture FAILED: ${e.code || ""} ${e.message || e}`);
    }
  }, [addLog]);

  const showAttestation = useCallback(() => {
    if (captureInfo) {
      Alert.alert(
        "Attestation",
        captureInfo.attestation.substring(0, 2000),
        [{ text: "OK" }],
      );
    }
  }, [captureInfo]);

  // --- M3: Signing ---

  const testGetPublicKey = useCallback(async () => {
    if (!captureInfo) {
      addLog("Run initCapture first");
      return;
    }
    try {
      addLog("Getting device public key...");
      const pubKey = await getDevicePublicKey(captureInfo.deviceKeyId);
      addLog(`Key type: ${pubKey.kty}, curve: ${pubKey.crv}`);
      addLog(`x: ${pubKey.x}`);
      addLog(`y: ${pubKey.y}`);
    } catch (e: any) {
      addLog(`Public key error: ${e.code || ""} ${e.message}`);
    }
  }, [addLog, captureInfo]);

  const testStrongbox = useCallback(async () => {
    if (!captureInfo) {
      addLog("Run initCapture first");
      return;
    }
    try {
      addLog("Checking StrongBox backing...");
      const strongbox = await isDeviceKeyStrongboxBacked(captureInfo.deviceKeyId);
      addLog(`StrongBox backed: ${strongbox}`);
    } catch (e: any) {
      addLog(`StrongBox check error: ${e.code || ""} ${e.message}`);
    }
  }, [addLog, captureInfo]);

  const testSign = useCallback(async () => {
    if (!captureInfo) {
      addLog("Run initCapture first");
      return;
    }
    try {
      const testMessage = "Hello from ZCAM1 Android Test!";
      addLog(`Signing: "${testMessage}"`);
      const signature = await signWithDeviceKey(
        captureInfo.deviceKeyId,
        testMessage,
      );
      addLog("Signing SUCCESS!");
      addLog(`Signature (${signature.length} chars): ${signature.substring(0, 60)}...`);
    } catch (e: any) {
      addLog(`Signing FAILED: ${e.code || ""} ${e.message}`);
    }
  }, [addLog, captureInfo]);

  const testSignZcam1Format = useCallback(async () => {
    if (!captureInfo) {
      addLog("Run initCapture first");
      return;
    }
    try {
      // Simulate the zcam1 message format: base64(photoHash)|base64(sha256(metadata))
      const mockMessage = "dGVzdFBob3RvSGFzaA==|dGVzdE1ldGFkYXRhSGFzaA==";
      addLog(`Signing zcam1 format: "${mockMessage}"`);
      const signature = await signWithDeviceKey(
        captureInfo.deviceKeyId,
        mockMessage,
      );
      addLog("Format signing SUCCESS!");
      addLog(`Signature: ${signature.substring(0, 60)}...`);
    } catch (e: any) {
      addLog(`Format signing FAILED: ${e.code || ""} ${e.message}`);
    }
  }, [addLog, captureInfo]);

  const hasKey = captureInfo != null;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>ZCAM1 Android Test</Text>
        <Text style={styles.subtitle}>
          Platform: {Platform.OS} | Version: {Platform.Version}
        </Text>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12 }}>
          {/* M1 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>M1: Native Module</Text>
            <Pressable style={styles.button} onPress={testNativeModule}>
              <Text style={styles.buttonText}>Check Native Module</Text>
            </Pressable>
          </View>

          {/* M2a */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>M2a: initCapture</Text>
            <Pressable style={styles.button} onPress={testPlayServices}>
              <Text style={styles.buttonText}>Check Play Services</Text>
            </Pressable>
            <Pressable
              style={[styles.button, { backgroundColor: "#34C759", marginTop: 8 }]}
              onPress={testInitCapture}
            >
              <Text style={styles.buttonText}>Run initCapture()</Text>
            </Pressable>
            {captureInfo && (
              <Pressable style={styles.buttonSecondary} onPress={showAttestation}>
                <Text style={styles.buttonSecondaryText}>
                  View Attestation ({captureInfo.attestation.length} chars)
                </Text>
              </Pressable>
            )}
          </View>

          {/* M3 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>M3: Hardware Signing</Text>
            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.button, !hasKey && styles.buttonDisabled]}
                onPress={testGetPublicKey}
              >
                <Text style={styles.buttonText}>Get Public Key</Text>
              </Pressable>
              <Pressable
                style={[styles.button, !hasKey && styles.buttonDisabled]}
                onPress={testStrongbox}
              >
                <Text style={styles.buttonText}>StrongBox?</Text>
              </Pressable>
            </View>
            <Pressable
              style={[
                styles.button,
                { backgroundColor: "#FF9500" },
                !hasKey && styles.buttonDisabled,
              ]}
              onPress={testSign}
            >
              <Text style={styles.buttonText}>Sign Test Message</Text>
            </Pressable>
            <Pressable
              style={[
                styles.button,
                { backgroundColor: "#FF9500", marginTop: 8 },
                !hasKey && styles.buttonDisabled,
              ]}
              onPress={testSignZcam1Format}
            >
              <Text style={styles.buttonText}>Sign ZCAM1 Format</Text>
            </Pressable>
          </View>

          {/* Log */}
          <View style={styles.logContainer}>
            <Text style={styles.logTitle}>Log:</Text>
            {log.map((entry, i) => (
              <Text key={i} style={styles.logEntry}>
                {entry}
              </Text>
            ))}
            {log.length === 0 && (
              <Text style={styles.logPlaceholder}>
                Press a button to start testing...
              </Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    color: "#666",
    marginTop: 8,
  },
  section: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  button: {
    flex: 1,
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  buttonSecondary: {
    backgroundColor: "#E8E8E8",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  buttonSecondaryText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "500",
  },
  logContainer: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 12,
  },
  logTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  logEntry: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 3,
  },
  logPlaceholder: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
  },
});
