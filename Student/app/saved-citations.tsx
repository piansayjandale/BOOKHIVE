import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AnimatedScreen from '../components/AnimatedScreen';
import { useThemeColors } from '../hooks/useThemeColors';

const citations = [
  {
    id: 'cite-1',
    title: 'Introduction to Data Science',
    author: 'Dr. Alistar Vance',
    citation: 'Vance, A. (2024). Introduction to Data Science. Academic Press.',
  },
  {
    id: 'cite-2',
    title: 'Systems Architecture',
    author: 'M. J. Roberts',
    citation: 'Roberts, M. J. (2023). Systems Architecture. TechPress.',
  },
];

export default function SavedCitationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();

  const copyCitation = async (text: string) => {
    await import('expo-clipboard').then((Clipboard) => Clipboard.setStringAsync(text));
    Alert.alert('Copied', 'Citation copied to clipboard');
  };

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

        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>SAVED CITATIONS</Text>

        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {citations.map((item) => (
          <View key={item.id} style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={styles.cardTop}>
              <View>
                <Text style={[styles.bookTitle, { color: theme.textPrimary }]}>{item.title}</Text>
                <Text style={[styles.authorText, { color: theme.textSecondary }]}>{item.author}</Text>
              </View>
              <TouchableOpacity onPress={() => copyCitation(item.citation)}>
                <Ionicons name="copy-outline" size={22} color={theme.accentGold} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.citationText, { color: theme.textPrimary }]}>{item.citation}</Text>
          </View>
        ))}
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
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
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B1F3A',
  },
  authorText: {
    color: '#64748B',
    marginTop: 3,
    fontSize: 12,
  },
  citationText: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
  },
});