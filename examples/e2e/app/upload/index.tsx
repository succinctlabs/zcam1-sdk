import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import {
  useProver,
} from "@succinctlabs/react-native-zcam1/proving";
import {
  authenticityStatus,
  ZImagePicker,
  AuthenticityStatus,
} from "@succinctlabs/react-native-zcam1";
import { useCallback, useEffect, useState } from "react";

type BadgeProps = {
  uri: string;
  status: AuthenticityStatus;
};

function Badge({
  uri,
  status: originalStatus,
}: BadgeProps): React.ReactElement | null {
  const { provingTasks } = useProver();
  const [status, setStatus] = useState(originalStatus);
  const [wasProving, setWasProving] = useState(false);

  const isProving = Object.values(provingTasks ?? {})
    .map((t) => "file://" + t.photoPath)
    .includes(uri);

  useEffect(() => {
    if (isProving) {
      setWasProving(true);
    }

    const nextStatus = wasProving ? AuthenticityStatus.Proof : originalStatus;

    setStatus(nextStatus);
  }, [isProving, wasProving, originalStatus]);

  const renderIcon = (name: "certificate-outline" | "attachment-check") => (
    <View style={styles.badgeIcon}>
      <LinearGradient
        colors={["rgba(255,255,255,0.0)", "rgba(255,255,255,0.9)"]}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 0 }}
        style={styles.badgeIconGradient}
        pointerEvents="none"
      />
      <MaterialCommunityIcons
        name={name}
        size={24}
        color="black"
        style={styles.badgeIconImage}
      />
    </View>
  );

  const renderLoader = () => (
    <View style={styles.badgeIcon}>
      <LinearGradient
        colors={["rgba(255,255,255,0.0)", "rgba(255,255,255,0.7)"]}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 0 }}
        style={styles.badgeIconGradient}
        pointerEvents="none"
      />
      <ActivityIndicator
        size={18}
        style={styles.badgeIconImage}
        color="black"
      />
    </View>
  );

  if (isProving) {
    return renderLoader();
  }

  switch (status) {
    case AuthenticityStatus.Bindings:
      return renderIcon("attachment-check");
    case AuthenticityStatus.Proof:
      return renderIcon("certificate-outline");
    default:
      return null;
  }
}

export default function Pick() {
  const router = useRouter();
  const { path } = useLocalSearchParams<{ path: string }>();

  const [refreshToken, setRefreshToken] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setRefreshToken((x) => x + 1);
    }, []),
  );

  const renderBadge = (uri: string, status: AuthenticityStatus) => (
    <Badge uri={uri} status={status} />
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <ZImagePicker
          source={{ path: path }}
          refreshToken={refreshToken}
          onSelect={async (uri) => {
            const authStatus = await authenticityStatus(uri);

            router.push({
              pathname: "/upload/details",
              params: { uri, authStatus: authStatus.toString() },
            });
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
    top: 0,
    right: 0,
    width: 128,
    height: 128,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeIconGradient: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  badgeIconImage: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
  },
});
