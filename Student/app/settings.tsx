import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AnimatedScreen from '../components/AnimatedScreen';
import { useThemeColors } from '../hooks/useThemeColors';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, toggleTheme, theme } = useThemeColors();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const options = [
    {
      id: 'opt-1',
      title: 'Notifications',
      detail: 'Manage alerts and reminders',
      icon: 'bell-outline',
      onPress: () => router.push('/notifications')
    },
    {
      id: 'opt-2',
      title: 'Privacy & Security',
      detail: 'Library account privacy controls',
      icon: 'lock-outline',
      onPress: () => router.push('/privacy-security')
    },
  ];

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: 16 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack?.()) {
              router.back();
            } else {
              router.push('/profile');
            }
          }}
          style={[styles.backButton, { backgroundColor: theme.cardBg }]}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.accentGold} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>SYSTEM SETTINGS</Text>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* BRAND SECTION */}
        <View style={styles.brandContainer}>
          <View style={[styles.logoCircle, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <MaterialCommunityIcons name="bookshelf" size={40} color={theme.accentGold} />
          </View>
          <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>BookHive Monitor</Text>
          <Text style={[styles.brandSubtitle, { color: theme.textSecondary }]}>Student Mobile Portal v2.5.0</Text>
        </View>

        {/* AI ENGINE SPECIFICATION CARD */}
        <View style={[styles.aiCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.aiHeader}>
            <View style={styles.aiHeaderTitleRow}>
              <MaterialCommunityIcons name="robot" size={20} color={theme.accentGold} />
              <Text style={[styles.aiTitle, { color: theme.accentGold }]}>AI RECOMMENDATION ENGINE</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeText}>ACTIVE</Text>
            </View>
          </View>

          <View style={[styles.aiDivider, { backgroundColor: theme.cardBorder }]} />

          <Text style={[styles.aiModelLabel, { color: theme.textSecondary }]}>Active Model</Text>
          <Text style={[styles.aiModelName, { color: theme.textPrimary }]}>Google Gemini 2.0 Flash</Text>
          
          <Text style={[styles.aiDesc, { color: theme.textSecondary }]}>
            This mobile application is powered by Gemini 2.0 Flash semantic intelligence. It evaluates your student profile, course department, and real-time borrowing logs to calculate match relevancy.
          </Text>

          <View style={styles.aiFeatures}>
            <View style={styles.featureItem}>
              <Ionicons name="sparkles" size={14} color="#38BDF8" />
              <Text style={[styles.featureText, { color: theme.textPrimary }]}>Semantic Query Parsing</Text>
            </View>
            <View style={styles.featureItem}>
              <MaterialCommunityIcons name="brain" size={14} color="#38BDF8" />
              <Text style={[styles.featureText, { color: theme.textPrimary }]}>Personalized Book Match %</Text>
            </View>
            <View style={styles.featureItem}>
              <MaterialCommunityIcons name="magnify" size={14} color="#38BDF8" />
              <Text style={[styles.featureText, { color: theme.textPrimary }]}>Contextual Catalog Re-ranking</Text>
            </View>
          </View>
        </View>

        {/* GENERAL SETTINGS GROUP */}
        <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>GENERAL SETTINGS</Text>

        {options.map((option) => (
          <TouchableOpacity key={option.id} style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} onPress={option.onPress} activeOpacity={0.85}>
            <View style={styles.cardLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}>
                <MaterialCommunityIcons name={option.icon as any} size={20} color={theme.accentGold} />
              </View>
              <View style={styles.cardTexts}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{option.title}</Text>
                <Text style={[styles.cardDetail, { color: theme.textSecondary }]}>{option.detail}</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        ))}

        {/* TOGGLE ROW: PUSH NOTIFICATIONS */}
        <View style={[styles.toggleCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.cardLeft}>
            <View style={[styles.iconWrapper, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}>
              <MaterialCommunityIcons name="bell-ring-outline" size={20} color={theme.accentGold} />
            </View>
            <View style={styles.cardTexts}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Push Notifications</Text>
              <Text style={[styles.cardDetail, { color: theme.textSecondary }]}>Receive real-time reservation updates</Text>
            </View>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: theme.cardBorder, true: theme.accentGold }}
            thumbColor={notificationsEnabled ? theme.accentGold : '#64748B'}
            ios_backgroundColor={theme.cardBorder}
          />
        </View>

        {/* TOGGLE ROW: SYSTEM THEME */}
        <View style={[styles.toggleCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.cardLeft}>
            <View style={[styles.iconWrapper, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}>
              <MaterialCommunityIcons name="theme-light-dark" size={20} color={theme.accentGold} />
            </View>
            <View style={styles.cardTexts}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Dark Mode</Text>
              <Text style={[styles.cardDetail, { color: theme.textSecondary }]}>Toggle dark / light display appearance</Text>
            </View>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={toggleTheme}
            trackColor={{ false: theme.cardBorder, true: theme.accentGold }}
            thumbColor={isDarkMode ? theme.accentGold : '#64748B'}
            ios_backgroundColor={theme.cardBorder}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080F1E',
  },
  header: {
    backgroundColor: '#080F1E',
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#111A2E',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111A2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 1.5,
  },
  content: {
    padding: 20,
  },
  brandContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#111A2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  aiCard: {
    backgroundColor: '#111A2E',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  aiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiTitle: {
    color: '#FCD34D',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.2,
  },
  activeBadge: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#059669',
  },
  activeText: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '800',
  },
  aiDivider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 14,
  },
  aiModelLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  aiModelName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 4,
  },
  aiDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 20,
    marginTop: 10,
  },
  aiFeatures: {
    marginTop: 16,
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  groupTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1.5,
    marginBottom: 12,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: '#111A2E',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleCard: {
    backgroundColor: '#111A2E',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#080F1E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  cardTexts: {
    flex: 1,
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: 14,
    color: '#F8FAFC',
  },
  cardDetail: {
    marginTop: 4,
    color: '#94A3B8',
    fontSize: 12,
  },
  themeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#080F1E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  themeSelectorText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
});