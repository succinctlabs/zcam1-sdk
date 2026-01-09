import { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Drawer } from "expo-router/drawer";
import {
  ProverProvider,
  ProvingClient,
} from "@succinctlabs/react-native-zcam1-prove";
import { pickDirectory } from "@react-native-documents/picker";
import { Pressable } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import Entypo from "@expo/vector-icons/Entypo";
import { privateDirectory } from "@succinctlabs/react-native-zcam1-picker";
import { FileSystem, Util } from "react-native-file-access";

export default function Layout() {
  const router = useRouter();
  const privateKey = process.env.EXPO_PUBLIC_PRIVATE_KEY;

  const onFulfilled = useCallback(
    async (
      requestId: string,
      photoPath: string,
      proof: ArrayBuffer,
      provingClient: ProvingClient,
    ) => {
      const outputPath = await provingClient.embedProof(photoPath, proof);

      try {
        const targetPath = privateDirectory();
        const targetFile = targetPath + "/" + Util.basename(outputPath);

        await FileSystem.cp(outputPath, targetFile);
        await FileSystem.unlink(photoPath);
      } catch (error) {
        console.error("Error saving photo:", error);
      }

      Toast.show({
        type: "success",
        text1: "The proof has been generated",
        text2: "The photo has been saved to a private folder",
      });
    },
    [],
  );

  return (
    <ProverProvider
      settings={{ privateKey, production: false }}
      onFulfilled={onFulfilled}
    >
      <Drawer>
        <Drawer.Screen
          name="index"
          options={{
            drawerLabel: "Capture",
            headerRight: () => <HeaderOverflowMenu />,
            title: "Capture",
          }}
        />
        <Drawer.Screen
          name="upload"
          options={{
            drawerLabel: "Upload",
            title: "Upload",
          }}
          listeners={{
            drawerItemPress: (e) => {
              e.preventDefault();

              router.push({
                pathname: "/upload",
                params: { path: privateDirectory() },
              });
            },
          }}
        />
        <Drawer.Screen
          name="verify"
          options={{
            drawerLabel: "Verify",
            title: "Verify",
          }}
          listeners={{
            drawerItemPress: (e) => {
              e.preventDefault();

              router.push({
                pathname: "/verify",
                params: { path: privateDirectory() },
              });
            },
          }}
        />
      </Drawer>
      <Toast topOffset={80} />
    </ProverProvider>
  );
}

function HeaderOverflowMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <View style={{ marginRight: 12 }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="More options"
      >
        <Entypo name="dots-three-vertical" size={20} color="black" />
      </Pressable>

      {open ? (
        <View
          style={{
            position: "absolute",
            right: 0,
            top: 28,
            backgroundColor: "white",
            paddingVertical: 8,
            minWidth: 160,
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <Pressable
            onPress={async () => {
              setOpen(false);

              const { uri: path } = await pickDirectory({
                requestLongTermAccess: true,
              });

              router.push({ pathname: "/upload", params: { path } });
            }}
            style={{ paddingHorizontal: 12, paddingVertical: 10 }}
          >
            <Text>Import from SD card</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
