import { TouchableOpacity, Text, StyleSheet } from "react-native";

type Props = { title: string; onPress: () => void; disabled?: boolean };

export function Button({ title, onPress, disabled }: Props) {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.label}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { padding: 12, margin: 4 },
  label: { textAlign: "center", fontWeight: "600" },
});
