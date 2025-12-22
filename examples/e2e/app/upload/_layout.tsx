import { Stack } from "expo-router";

export default function StackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="pick" />
      <Stack.Screen
        name="proving"
        options={{
          presentation: "modal",
        }}
      />
    </Stack>
  );
}
