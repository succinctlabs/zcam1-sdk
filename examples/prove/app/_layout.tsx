import { StyleSheet } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { ProverProvider } from "@succinctlabs/react-native-zcam1-prove";
export default function RootLayout() {
  return (
    <ProverProvider settings={{ production: false }}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <Stack />
        </SafeAreaView>
      </SafeAreaProvider>
    </ProverProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    marginHorizontal: 16,
  },
});
