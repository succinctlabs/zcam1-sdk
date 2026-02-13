import { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Platform,
  ScrollView,
  Alert,
  PermissionsAndroid,
  Image,
  requireNativeComponent,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { TurboModuleRegistry } from "react-native";
import * as Sharing from "expo-sharing";
import {
  type CaptureInfo,
  initCapture,
  signWithDeviceKey,
  getDevicePublicKey,
  isDeviceKeyStrongboxBacked,
  checkPlayServicesAvailable,
} from "@succinctlabs/react-native-zcam1-capture";
import {
  extractManifest,
  authenticityStatus,
  AuthenticityStatus,
} from "@succinctlabs/react-native-zcam1-c2pa";

const Zcam1CameraView = requireNativeComponent<any>("Zcam1CameraView");

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

  // --- M4: C2PA Rust Library ---

  const testC2paLoad = useCallback(async () => {
    try {
      addLog("Loading C2PA library...");
      const c2pa = require("@succinctlabs/react-native-zcam1-c2pa");
      addLog("C2PA module loaded!");

      // Test formatFromPath - a simple function that uses the Rust library
      const format = c2pa.formatFromPath("test.jpg");
      addLog(`formatFromPath("test.jpg") => ${format}`);

      const format2 = c2pa.formatFromPath("test.png");
      addLog(`formatFromPath("test.png") => ${format2}`);

      const format3 = c2pa.formatFromPath("test.mp4");
      addLog(`formatFromPath("test.mp4") => ${format3}`);

      const noFormat = c2pa.formatFromPath("test.xyz");
      addLog(`formatFromPath("test.xyz") => ${noFormat}`);

      addLog("C2PA library working!");
    } catch (e: any) {
      addLog(`C2PA load FAILED: ${e.code || ""} ${e.message || e}`);
    }
  }, [addLog]);

  const testC2paComputeHash = useCallback(async () => {
    try {
      addLog("Testing computeHashFromBuffer...");
      const c2pa = require("@succinctlabs/react-native-zcam1-c2pa");

      // Create a minimal test buffer
      const testData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG magic bytes
      try {
        const hash = c2pa.computeHashFromBuffer(testData.buffer, "image/jpeg");
        addLog(`Hash result: ${hash.byteLength} bytes`);
      } catch (e: any) {
        // This may fail with an incomplete JPEG, which is expected
        addLog(`computeHashFromBuffer (expected error with minimal data): ${e.message || e}`);
      }
    } catch (e: any) {
      addLog(`C2PA hash test FAILED: ${e.code || ""} ${e.message || e}`);
    }
  }, [addLog]);

  // --- M5: Camera Preview & Capture ---

  const [cameraPermission, setCameraPermission] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [signedPhotoPath, setSignedPhotoPath] = useState<string | null>(null);

  const requestCameraPermission = useCallback(async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: "Camera Permission",
          message: "ZCAM1 needs access to your camera",
          buttonPositive: "OK",
        },
      );
      const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
      setCameraPermission(isGranted);
      addLog(`Camera permission: ${isGranted ? "GRANTED" : "DENIED"}`);
      if (isGranted) {
        setShowCamera(true);
      }
    } catch (e: any) {
      addLog(`Permission error: ${e.message}`);
    }
  }, [addLog]);

  const takePhoto = useCallback(async () => {
    try {
      addLog("Taking photo...");
      const mod = TurboModuleRegistry.get("Zcam1Sdk") as any;
      if (!mod) {
        addLog("ERROR: Zcam1Sdk module not found");
        return;
      }
      const result = await mod.takeNativePhoto(
        "jpeg",   // format
        "back",   // position
        "off",    // flash
        false,    // includeDepthData
        "4:3",    // aspectRatio
        "auto",   // orientation
        false,    // skipPostProcessing
      );
      addLog(`Photo captured!`);
      addLog(`  Path: ${result.filePath}`);
      addLog(`  Format: ${result.format}`);
      addLog(`  Size: ${result.width}x${result.height}`);
      addLog(`  Orientation: ${result.orientation}`);
      setPhotoPath(result.filePath);
    } catch (e: any) {
      addLog(`Photo capture FAILED: ${e.code || ""} ${e.message}`);
    }
  }, [addLog]);

  // --- M6: Capture + C2PA Sign ---

  const testCaptureAndSign = useCallback(async () => {
    if (!captureInfo) {
      addLog("Run initCapture first");
      return;
    }
    try {
      addLog("M6: Starting capture + C2PA sign...");

      // Step 1: Take photo
      addLog("  Step 1: Taking photo...");
      const mod = TurboModuleRegistry.get("Zcam1Sdk") as any;
      if (!mod) {
        addLog("ERROR: Zcam1Sdk module not found");
        return;
      }
      const result = await mod.takeNativePhoto(
        "jpeg", "back", "off", false, "4:3", "auto", false,
      );
      addLog(`  Photo captured: ${result.width}x${result.height}`);
      const originalPath = result.filePath;

      // Step 2: Create ManifestEditor with software key
      addLog("  Step 2: Creating ManifestEditor (software key)...");
      const c2pa = require("@succinctlabs/react-native-zcam1-c2pa");
      const ManifestEditor = c2pa.ManifestEditor;

      const manifestEditor = ManifestEditor.newWithSoftwareKey(originalPath);
      addLog("  ManifestEditor created!");

      // Step 3: Add photo metadata action
      addLog("  Step 3: Adding photo metadata...");
      const when = new Date().toISOString().replace("T", " ").split(".")[0];
      const normalizedMetadata = manifestEditor.addPhotoMetadataAction(
        {
          deviceMake: "Samsung",
          deviceModel: "Android Test Device",
          softwareVersion: "ZCAM1 Android Test",
          xResolution: result.width || 4032,
          yResolution: result.height || 3024,
          orientation: 1,
          iso: "100",
          exposureTime: 0,
          depthOfField: 0,
          focalLength: 0,
          authenticityData: {
            isJailBroken: false,
            isLocationSpoofingAvailable: false,
          },
          depthData: undefined,
          filmStyle: undefined,
        },
        when,
      );
      addLog(`  Metadata added (${normalizedMetadata.length} chars)`);

      // Step 4: Add device bindings assertion
      addLog("  Step 4: Adding bindings assertion...");
      manifestEditor.addAssertion(
        "succinct.bindings",
        JSON.stringify({
          app_id: captureInfo.appId,
          device_key_id: captureInfo.deviceKeyId,
          attestation: captureInfo.attestation,
          assertion: "ANDROID_TEST_ASSERTION",
        }),
      );
      addLog("  Bindings assertion added!");

      // Step 5: Embed manifest to file
      addLog("  Step 5: Embedding C2PA manifest...");
      const format = c2pa.formatFromPath(originalPath);
      const destPath = originalPath.replace(".jpg", "_signed.jpg");
      await manifestEditor.embedManifestToFile(destPath, format);
      addLog("  C2PA manifest embedded!");
      addLog(`  Signed file: ${destPath}`);

      setSignedPhotoPath(destPath);
      addLog("M6: Capture + Sign COMPLETE!");
    } catch (e: any) {
      addLog(`M6 FAILED: ${e.code || ""} ${e.message || e}`);
      console.error("M6 error:", e);
    }
  }, [addLog, captureInfo]);

  // --- M6b: Share Signed Photo ---

  const shareSignedPhoto = useCallback(async () => {
    if (!signedPhotoPath) {
      addLog("No signed photo to share");
      return;
    }
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        addLog("Sharing not available on this device");
        return;
      }
      addLog("Opening share sheet...");
      await Sharing.shareAsync(`file://${signedPhotoPath}`, {
        mimeType: "image/jpeg",
        dialogTitle: "Share C2PA Signed Photo",
      });
      addLog("Share sheet opened");
    } catch (e: any) {
      addLog(`Share error: ${e.message}`);
    }
  }, [addLog, signedPhotoPath]);

  // --- M7a: Manifest Viewer ---

  const [manifestJson, setManifestJson] = useState<string | null>(null);

  const viewManifest = useCallback(() => {
    if (!signedPhotoPath) {
      addLog("No signed photo to inspect");
      return;
    }
    try {
      addLog("Extracting C2PA manifest...");
      const store = extractManifest(signedPhotoPath);
      const manifest = store.activeManifest();

      const bindings = manifest.bindings();
      const metadata = manifest.captureMetadataAction();
      const proof = manifest.proof();

      const summary = {
        hasBindings: !!bindings,
        ...(bindings ? {
          appId: bindings.appId,
          deviceKeyId: bindings.deviceKeyId,
          attestationLength: bindings.attestation.length,
        } : {}),
        hasMetadata: !!metadata,
        ...(metadata ? { metadata: JSON.parse(metadata) } : {}),
        hasProof: !!proof,
      };

      const json = JSON.stringify(summary, null, 2);
      setManifestJson(json);
      addLog("Manifest extracted!");
      addLog(`  Bindings: ${bindings ? "YES" : "NO"}`);
      addLog(`  Metadata: ${metadata ? "YES" : "NO"}`);
      addLog(`  Proof: ${proof ? "YES" : "NO"}`);
    } catch (e: any) {
      addLog(`Manifest extraction FAILED: ${e.message || e}`);
      console.error("Manifest error:", e);
    }
  }, [addLog, signedPhotoPath]);

  // --- M7b: Verification ---

  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  const verifySignedPhoto = useCallback(async () => {
    if (!signedPhotoPath) {
      addLog("No signed photo to verify");
      return;
    }
    try {
      addLog("Verifying C2PA manifest...");
      const status = await authenticityStatus(signedPhotoPath);
      const statusName = AuthenticityStatus[status];
      setVerifyResult(statusName);
      addLog(`Verification result: ${statusName}`);

      switch (status) {
        case AuthenticityStatus.Bindings:
          addLog("  Photo has device bindings (attestation present)");
          break;
        case AuthenticityStatus.Proof:
          addLog("  Photo has ZK proof attached");
          break;
        case AuthenticityStatus.NoManifest:
          addLog("  No C2PA manifest found in file");
          break;
        case AuthenticityStatus.InvalidManifest:
          addLog("  C2PA manifest is INVALID");
          break;
        case AuthenticityStatus.Unknown:
          addLog("  Status unknown");
          break;
      }
    } catch (e: any) {
      addLog(`Verification FAILED: ${e.message || e}`);
      console.error("Verify error:", e);
    }
  }, [addLog, signedPhotoPath]);

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

          {/* M4 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>M4: C2PA Rust Library</Text>
            <Pressable
              style={[styles.button, { backgroundColor: "#AF52DE" }]}
              onPress={testC2paLoad}
            >
              <Text style={styles.buttonText}>Load C2PA & Test</Text>
            </Pressable>
            <Pressable
              style={[styles.button, { backgroundColor: "#AF52DE", marginTop: 8 }]}
              onPress={testC2paComputeHash}
            >
              <Text style={styles.buttonText}>Test computeHash</Text>
            </Pressable>
          </View>

          {/* M5 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>M5: Camera Preview & Capture</Text>
            {!showCamera ? (
              <Pressable
                style={[styles.button, { backgroundColor: "#FF2D55" }]}
                onPress={requestCameraPermission}
              >
                <Text style={styles.buttonText}>Open Camera</Text>
              </Pressable>
            ) : (
              <>
                <View style={{ height: 300, borderRadius: 12, overflow: "hidden", marginBottom: 8 }}>
                  <Zcam1CameraView
                    style={{ flex: 1 }}
                    cameraType="back"
                    flashMode="off"
                    zoom={1.0}
                  />
                </View>
                <View style={styles.buttonRow}>
                  <Pressable
                    style={[styles.button, { backgroundColor: "#FF2D55" }]}
                    onPress={takePhoto}
                  >
                    <Text style={styles.buttonText}>Take Photo</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.button, { backgroundColor: "#8E8E93" }]}
                    onPress={() => { setShowCamera(false); setPhotoPath(null); }}
                  >
                    <Text style={styles.buttonText}>Close</Text>
                  </Pressable>
                </View>
                {photoPath && (
                  <View style={{ marginTop: 8, alignItems: "center" }}>
                    <Text style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
                      Last capture:
                    </Text>
                    <Image
                      source={{ uri: `file://${photoPath}` }}
                      style={{ width: 200, height: 150, borderRadius: 8 }}
                      resizeMode="cover"
                    />
                    <Text style={{ fontSize: 10, color: "#999", marginTop: 4 }} numberOfLines={1}>
                      {photoPath}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* M6: Capture + C2PA Sign */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>M6: Capture + C2PA Sign</Text>
            <Pressable
              style={[
                styles.button,
                { backgroundColor: "#E91E63" },
                (!showCamera || !hasKey) && styles.buttonDisabled,
              ]}
              onPress={testCaptureAndSign}
            >
              <Text style={styles.buttonText}>Capture & Sign</Text>
            </Pressable>
            {signedPhotoPath && (
              <View style={{ marginTop: 8, alignItems: "center" }}>
                <Text style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
                  C2PA signed photo:
                </Text>
                <Image
                  source={{ uri: `file://${signedPhotoPath}` }}
                  style={{ width: 200, height: 150, borderRadius: 8 }}
                  resizeMode="cover"
                />
                <Text style={{ fontSize: 10, color: "#999", marginTop: 4 }} numberOfLines={1}>
                  {signedPhotoPath}
                </Text>
                <View style={[styles.buttonRow, { marginTop: 8 }]}>
                  <Pressable
                    style={[styles.button, { backgroundColor: "#5856D6" }]}
                    onPress={shareSignedPhoto}
                  >
                    <Text style={styles.buttonText}>Share</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.button, { backgroundColor: "#FF9500" }]}
                    onPress={viewManifest}
                  >
                    <Text style={styles.buttonText}>View Manifest</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.button, { backgroundColor: "#34C759" }]}
                    onPress={verifySignedPhoto}
                  >
                    <Text style={styles.buttonText}>Verify</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {/* M7: Manifest & Verification */}
          {(manifestJson || verifyResult) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>M7: Manifest & Verification</Text>
              {verifyResult && (
                <View style={{
                  backgroundColor: verifyResult === "Bindings" || verifyResult === "Proof" ? "#E8F5E9" : "#FFF3E0",
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 8,
                }}>
                  <Text style={{ fontWeight: "600", fontSize: 14 }}>
                    Status: {verifyResult}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                    {verifyResult === "Bindings"
                      ? "Valid C2PA manifest with device attestation"
                      : verifyResult === "Proof"
                        ? "Valid C2PA manifest with ZK proof"
                        : verifyResult === "InvalidManifest"
                          ? "C2PA manifest found but invalid"
                          : verifyResult === "NoManifest"
                            ? "No C2PA manifest in file"
                            : "Unknown status"}
                  </Text>
                </View>
              )}
              {manifestJson && (
                <View style={{
                  backgroundColor: "#F5F5F5",
                  padding: 12,
                  borderRadius: 8,
                }}>
                  <Text style={{ fontWeight: "600", fontSize: 13, marginBottom: 4 }}>
                    Manifest Contents:
                  </Text>
                  <ScrollView horizontal>
                    <Text style={{
                      fontSize: 10,
                      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                    }}>
                      {manifestJson}
                    </Text>
                  </ScrollView>
                </View>
              )}
            </View>
          )}

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
