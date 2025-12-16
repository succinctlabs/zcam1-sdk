import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { privateDirectory, ZImagePicker } from "react-native-zcam1-picker";
import { useIsFocused } from "@react-navigation/native";

export default function Upload() {
  const router = useRouter();
  const path = privateDirectory() + "/captured";
  const isFocused = useIsFocused();

  if (!isFocused) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ZImagePicker
          source={{ path: path }}
          onSelect={(uri) =>
            router.push({ pathname: "/upload/proving", params: { uri } })
          }
        />
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
