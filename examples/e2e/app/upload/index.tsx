import { useRouter } from "expo-router";
import { Button, StyleSheet } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { privateDirectory } from "@succinctlabs/react-native-zcam1-picker";
import { pickDirectory } from "@react-native-documents/picker";

export default function Index() {
  const router = useRouter();

  const privateFolder = () => {
    const path = privateDirectory() + "/captured";
    router.push({ pathname: "/upload/pick", params: { path } });
  };

  const selectFolder = async () => {
    const { uri: path } = await pickDirectory({
      requestLongTermAccess: true,
    });

    router.push({ pathname: "/upload/pick", params: { path } });
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <Button onPress={privateFolder} title="App private folder" />
        <Button onPress={selectFolder} title="Select..." />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
});
