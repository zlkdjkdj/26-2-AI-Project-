import { Pressable, StyleSheet, Text } from 'react-native';
export function Button({ children, onPress, secondary, disabled, danger }) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
    style={({ pressed }) => [s.button, secondary && s.secondary, danger && { backgroundColor: '#983e35' }, (pressed || disabled) && { opacity: 0.5 }]}>
    <Text style={[s.buttonText, secondary && { color: '#264a38' }]}>{children}</Text>
  </Pressable>;
}
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f6f1' },
  content: { padding: 24, gap: 18, paddingBottom: 48 },
  brand: { color: '#284f3a', fontSize: 22, fontWeight: '800' },
  eyebrow: { color: '#588168', fontSize: 12, letterSpacing: 2, fontWeight: '700' },
  title: { color: '#193f2d', fontSize: 34, lineHeight: 44, fontWeight: '800' },
  section: { color: '#234933', fontSize: 20, lineHeight: 28, fontWeight: '700' },
  text: { color: '#5e6d62', fontSize: 15, lineHeight: 24 },
  card: { backgroundColor: '#fff', padding: 22, borderRadius: 24, gap: 14, borderColor: '#dde6da', borderWidth: 1 },
  button: { padding: 16, borderRadius: 16, backgroundColor: '#315c42', alignItems: 'center' },
  secondary: { backgroundColor: '#e5eddf' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  message: { padding: 16, backgroundColor: '#edf0df', borderRadius: 16, color: '#4e6039', lineHeight: 22 },
  toolbar: { padding: 16, gap: 10, backgroundColor: '#f4f6f1' },
  row: { flexDirection: 'row', gap: 10 },
});
