import { Drawer } from "expo-router/drawer";
import { ProverProvider } from "@succinctlabs/react-native-zcam1-prove";

export default function Layout() {
  return (
    <ProverProvider settings={{ production: false }}>
      <Drawer>
        <Drawer.Screen
          name="index"
          options={{
            drawerLabel: "Capture",
            title: "Capture",
          }}
        />
        <Drawer.Screen
          name="upload"
          options={{
            drawerLabel: "Upload",
            title: "Upload",
          }}
        />
      </Drawer>
    </ProverProvider>
  );
}
