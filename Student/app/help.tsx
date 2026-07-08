import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AnimatedScreen from '../components/AnimatedScreen';
import { useThemeColors } from '../hooks/useThemeColors';

const faqs = [
  { id: 'faq-1', question: 'How do I borrow a book?', answer: 'Search or view a book, then request borrow from the book details screen.' },
  { id: 'faq-2', question: 'How long can I keep a book?', answer: 'Most loans are valid for 7 days, with return instructions provided after approval.' },
  { id: 'faq-3', question: 'Where can I pick up books?', answer: 'Pickup is at the main library, 2nd floor, unless otherwise noted in the notification.' },
];

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: 16 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder, borderBottomWidth: 1 }]}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack?.()) {
              router.back();
            } else {
              router.push('/profile');
            }
          }}
        >
          <Ionicons name="arrow-back" size={22} color={theme.accentGold} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>HELP & SUPPORT</Text>

        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {faqs.map((item) => (
          <View key={item.id} style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Text style={[styles.question, { color: theme.textPrimary }]}>{item.question}</Text>
            <Text style={[styles.answer, { color: theme.textSecondary }]}>{item.answer}</Text>
          </View>
        ))}

        <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.accentGold }]} onPress={() => router.push('/notifications')}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={isDarkMode ? "#080F1E" : "#FFFFFF"} />
          <Text style={[styles.actionText, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]}>Contact Librarian</Text>
        </TouchableOpacity>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  header: {
    backgroundColor: '#032B44',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  question: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B1F3A',
  },
  answer: {
    marginTop: 8,
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  actionButton: {
    marginTop: 18,
    backgroundColor: '#0B5A8E',
    padding: 15,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    color: '#fff',
    fontWeight: '700',
  },
});