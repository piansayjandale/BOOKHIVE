import { useRouter } from 'expo-router';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import AnimatedScreen from '../components/AnimatedScreen';
import { useThemeColors } from '../hooks/useThemeColors';

export default function ModalScreen() {
  const router = useRouter();
  const { theme, isDarkMode } = useThemeColors();

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>This is a modal</Text>
      <TouchableOpacity onPress={() => router.replace('/')} style={[styles.link, { backgroundColor: theme.accentGold }]}>
        <Text style={[styles.linkText, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]}>Go to home screen</Text>
      </TouchableOpacity>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  linkText: {
    fontWeight: '700',
  },
});
