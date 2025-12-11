import { Drawer } from "expo-router/drawer";

export default function Layout() {
  return (
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
  );
}
