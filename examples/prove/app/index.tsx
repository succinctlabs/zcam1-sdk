import {
  StyleSheet,
  Button,
  View,
  Text,
  ActivityIndicator,
} from "react-native";
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { launchImageLibrary } from "react-native-image-picker";
import { useProver } from "@succinctlabs/react-native-zcam1-prove";

export default function Index() {
  const { provingClient, isInitializing, error } = useProver();

  const pick = async () => {
    const result = await launchImageLibrary({
      mediaType: "photo",
      selectionLimit: 1,
    });

    console.log("File", result.assets![0].uri);

    if (provingClient !== null) {
      const outputPath = await provingClient.waitAndEmbedProof(
        result.assets![0].uri!,
      );

      console.log("Output File", outputPath);

      try {
        let res = await CameraRoll.saveAsset(outputPath);
        console.log("Saved: " + res.node.image.filename);
      } catch (error) {
        console.error("Error saving photo:", error);
      }
    }
  };

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
    <View style={{ flex: 1 }}>
      <Button title="Pick photo" onPress={pick} disabled={isInitializing} />
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    margin: 8,
    fontSize: 20,
    fontWeight: "600",
  },
});
