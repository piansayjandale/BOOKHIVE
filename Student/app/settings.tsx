import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AnimatedScreen from '../components/AnimatedScreen';
import { useThemeColors } from '../hooks/useThemeColors';
import { useAuth } from '../data/AuthContext';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, toggleTheme, theme } = useThemeColors();
  const { logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm
        ? window.confirm('Are you sure you want to sign out?')
        : true;
      if (confirmed) {
        try {
          await logout();
        } catch (e) {
          console.warn('Logout error:', e);
        }
        router.replace('/login');
      }
      return;
    }

    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (e) {
              console.warn('Logout error:', e);
            }
            router.replace('/login');
          },
        },
      ]
    );
  };

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
    {
      id: 'opt-3',
      title: 'Terms & Agreement',
      detail: 'Policies, library rules & obligations',
      icon: 'file-document-outline',
      onPress: () => router.push('/terms-agreement')
    },
    {
      id: 'opt-4',
      title: 'Help & Support',
      detail: 'FAQs, user guides & assistant contact',
      icon: 'help-circle-outline',
      onPress: () => router.push('/help')
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
              router.replace('/(tabs)');
            }
          }}
          style={[styles.backButton, { backgroundColor: theme.cardBg }]}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.headerTitle }]}>SYSTEM SETTINGS</Text>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* BRAND SECTION */}
        <View style={styles.brandContainer}>
          <View style={[styles.logoCircle, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <MaterialCommunityIcons name="bookshelf" size={40} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
          </View>
          <Text style={[styles.brandTitle, { color: theme.sectionTitle }]}>BookHive Monitor</Text>
          <Text style={[styles.brandSubtitle, { color: theme.textSecondary }]}>Student Mobile Application</Text>
        </View>

        {/* GENERAL SETTINGS GROUP */}
        <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>GENERAL SETTINGS</Text>

        {options.map((option, idx) => (
          <TouchableOpacity key={`opt-${option.id}-${idx}`} style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} onPress={option.onPress} activeOpacity={0.85}>
            <View style={styles.cardLeft}>
              <View style={[styles.iconWrapper, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}>
                <MaterialCommunityIcons name={option.icon as any} size={20} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
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
              <MaterialCommunityIcons name="bell-ring-outline" size={20} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
            </View>
            <View style={styles.cardTexts}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Push Notifications</Text>
              <Text style={[styles.cardDetail, { color: theme.textSecondary }]}>Receive real-time reservation updates</Text>
            </View>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: theme.cardBorder, true: isDarkMode ? theme.accentGold : theme.accentBlue }}
            thumbColor={notificationsEnabled ? (isDarkMode ? theme.accentGold : theme.accentBlue) : '#64748B'}
            ios_backgroundColor={theme.cardBorder}
          />
        </View>

        {/* TOGGLE ROW: SYSTEM THEME */}
        <View style={[styles.toggleCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.cardLeft}>
            <View style={[styles.iconWrapper, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}>
              <MaterialCommunityIcons name="theme-light-dark" size={20} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
            </View>
            <View style={styles.cardTexts}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Dark Mode</Text>
              <Text style={[styles.cardDetail, { color: theme.textSecondary }]}>Toggle dark / light display appearance</Text>
            </View>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={toggleTheme}
            trackColor={{ false: theme.cardBorder, true: isDarkMode ? theme.accentGold : theme.accentBlue }}
            thumbColor={isDarkMode ? theme.accentGold : '#64748B'}
            ios_backgroundColor={theme.cardBorder}
          />
        </View>

        {/* ACCOUNT / SESSION GROUP */}
        <Text style={[styles.groupTitle, { color: theme.textSecondary, marginTop: 12 }]}>ACCOUNT & SESSION</Text>

        <TouchableOpacity
          style={[
            styles.card,
            {
              backgroundColor: theme.cardBg,
              borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.35)' : '#FEE2E2',
            },
          ]}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <View style={styles.cardLeft}>
            <View
              style={[
                styles.iconWrapper,
                {
                  backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                  borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : '#FCA5A5',
                },
              ]}
            >
              <MaterialCommunityIcons name="logout" size={20} color="#EF4444" />
            </View>
            <View style={styles.cardTexts}>
              <Text style={[styles.cardTitle, { color: '#EF4444' }]}>Sign Out</Text>
              <Text style={[styles.cardDetail, { color: theme.textSecondary }]}>
                Log out of your student account session
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#EF4444" />
        </TouchableOpacity>

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
    marginBottom: 8,
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