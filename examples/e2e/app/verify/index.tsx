import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Image } from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import {
  ZImagePicker,
  AuthenticityStatus,
} from "@succinctlabs/react-native-zcam1-picker";
import { useIsFocused } from "@react-navigation/native";
import { authenticityStatus } from "@succinctlabs/react-native-zcam1-prove";
import Toast from "react-native-toast-message";

export default function Pick() {
  const router = useRouter();
  const { path } = useLocalSearchParams<{ path: string }>();
  const isFocused = useIsFocused();

  if (!isFocused) {
    return null;
  }

  const renderBadge = (
    status: AuthenticityStatus,
  ): React.ReactElement | null => {
    switch (status) {
      case AuthenticityStatus.Bindings:
        return (
          <Image
            source={require("../../assets/images/bindings.png")}
            style={styles.badgeIcon}
            resizeMode="contain"
          />
        );
      case AuthenticityStatus.Proof:
        return (
          <Image
            source={require("../../assets/images/proof.png")}
            style={styles.badgeIcon}
            resizeMode="contain"
          />
        );
      default:
        return null;
    }
  };
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ZImagePicker
          source={{ path: path }}
          onSelect={async (uri) => {
            const authStatus = await authenticityStatus(uri);

            if (authStatus === AuthenticityStatus.Proof) {
              router.push({ pathname: "/verify/report", params: { uri } });
            } else {
              Toast.show({
                type: "error",
                text1: "The image must contains a authenticity proof",
              });
            }
          }}
          renderBadge={renderBadge}
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
  badgeIcon: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
  },
});
