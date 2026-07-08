import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AnimatedScreen from '../components/AnimatedScreen';
import { useThemeColors } from '../hooks/useThemeColors';
import {
  clearNotifications,
  getNotifications,
  markNotificationRead,
  deleteNotification,
  NotificationItem,
  subscribe,
} from '../data/store';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'books' | 'updates' | 'general'>('all');

  useEffect(() => {
    setNotifications(getNotifications());
    return subscribe(() => {
      setNotifications(getNotifications());
    });
  }, []);

  const handleMarkRead = (id: string) => {
    markNotificationRead(id);
    setNotifications(getNotifications());
  };

  const handleDelete = (id: string) => {
    deleteNotification(id);
    setNotifications(getNotifications());
  };

  const handleClearAll = () => {
    clearNotifications();
    setNotifications(getNotifications());
  };

  const handleNotificationPress = (item: NotificationItem) => {
    if (!item.read) {
      handleMarkRead(item.id);
    }
    if (item.bookData) {
      router.push({
        pathname: "/book-details",
        params: {
          from: "home",
          id: item.bookData.id,
          title: item.bookData.title,
          author: item.bookData.author,
          description: item.bookData.description,
          year: item.bookData.year,
          pages: item.bookData.pages,
          language: item.bookData.language,
          category: item.bookData.category,
          available: item.bookData.available,
          shelf: item.bookData.shelf,
        },
      });
    }
  };

  const getNotificationConfig = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("added") || t.includes("new book")) {
      return {
        icon: "book-outline" as const,
        color: "#38BDF8", // Sky Blue
        bgColor: "rgba(56, 189, 248, 0.08)",
        borderColor: "rgba(56, 189, 248, 0.25)",
        badge: "NEW BOOK",
      };
    }
    if (t.includes("returned") || t.includes("success") || t.includes("approved")) {
      return {
        icon: "checkmark-circle-outline" as const,
        color: "#34D399", // Emerald Green
        bgColor: "rgba(52, 211, 153, 0.08)",
        borderColor: "rgba(52, 211, 153, 0.25)",
        badge: "SUCCESS",
      };
    }
    if (t.includes("pending") || t.includes("request") || t.includes("reservation")) {
      return {
        icon: "time-outline" as const,
        color: "#FCD34D", // Gold (Pending)
        bgColor: "rgba(252, 211, 77, 0.08)",
        borderColor: "rgba(252, 211, 77, 0.25)",
        badge: "PENDING",
      };
    }
    if (t.includes("declined") || t.includes("failed") || t.includes("cancel")) {
      return {
        icon: "close-circle-outline" as const,
        color: "#F87171", // Rose Red
        bgColor: "rgba(248, 113, 113, 0.08)",
        borderColor: "rgba(248, 113, 113, 0.25)",
        badge: "ALERT",
      };
    }
    return {
      icon: "sparkles-outline" as const,
      color: "#A78BFA", // Purple
      bgColor: "rgba(167, 139, 250, 0.08)",
      borderColor: "rgba(167, 139, 250, 0.25)",
      badge: "GENERAL",
    };
  };

  // Helper counts
  const allCount = notifications.length;
  const unreadCount = notifications.filter(n => !n.read).length;
  const booksCount = notifications.filter(n => {
    const titleLower = n.title.toLowerCase();
    return titleLower.includes("added") || titleLower.includes("new book");
  }).length;
  const updatesCount = notifications.filter(n => {
    const titleLower = n.title.toLowerCase();
    return titleLower.includes("returned") || titleLower.includes("success") || 
           titleLower.includes("approved") || titleLower.includes("pending") || 
           titleLower.includes("request") || titleLower.includes("reservation") || 
           titleLower.includes("declined") || titleLower.includes("failed") || 
           titleLower.includes("cancel");
  }).length;
  const generalCount = notifications.filter(n => {
    const titleLower = n.title.toLowerCase();
    const isBook = titleLower.includes("added") || titleLower.includes("new book");
    const isUpdate = titleLower.includes("returned") || titleLower.includes("success") || 
                     titleLower.includes("approved") || titleLower.includes("pending") || 
                     titleLower.includes("request") || titleLower.includes("reservation") || 
                     titleLower.includes("declined") || titleLower.includes("failed") || 
                     titleLower.includes("cancel");
    return !isBook && !isUpdate;
  }).length;

  const filteredNotifications = notifications.filter(item => {
    // Search filter
    const textMatch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      item.body.toLowerCase().includes(searchQuery.toLowerCase());
    if (!textMatch) return false;

    // Tab filter
    const titleLower = item.title.toLowerCase();
    const isBook = titleLower.includes("added") || titleLower.includes("new book");
    const isUpdate = titleLower.includes("returned") || titleLower.includes("success") || 
                     titleLower.includes("approved") || titleLower.includes("pending") || 
                     titleLower.includes("request") || titleLower.includes("reservation") || 
                     titleLower.includes("declined") || titleLower.includes("failed") || 
                     titleLower.includes("cancel");
    const isGeneral = !isBook && !isUpdate;

    if (activeTab === 'unread') return !item.read;
    if (activeTab === 'books') return isBook;
    if (activeTab === 'updates') return isUpdate;
    if (activeTab === 'general') return isGeneral;
    return true; // all
  });

  const tabs = [
    { key: 'all' as const, label: 'All', count: allCount },
    { key: 'unread' as const, label: 'Unread', count: unreadCount },
    { key: 'books' as const, label: 'Books', count: booksCount },
    { key: 'updates' as const, label: 'Updates', count: updatesCount },
    { key: 'general' as const, label: 'General', count: generalCount },
  ];

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      {/* HEADER */}
      <View style={[styles.header, { paddingTop: 12 + insets.top, height: 64 + insets.top, backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.accentGold} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
          NOTIFICATIONS {unreadCount > 0 ? `(${unreadCount})` : ''}
        </Text>

        {notifications.length > 0 ? (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* SEARCH BAR */}
      <View style={styles.searchSection}>
        <View style={[styles.searchContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Ionicons name="search-outline" size={18} color={theme.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search in notifications..."
            placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
            autoCorrect={false}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClearBtn}>
              <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* CATEGORY TABS */}
      <View style={styles.tabsSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  [styles.tabButton, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }],
                  isActive && [styles.tabButtonActive, { backgroundColor: isDarkMode ? "rgba(252, 211, 77, 0.08)" : "rgba(11, 90, 142, 0.08)", borderColor: theme.accentGold }],
                ]}
              >
                <Text style={[styles.tabLabel, { color: theme.textSecondary }, isActive && [styles.tabLabelActive, { color: theme.accentGold }]]}>
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View style={[styles.tabBadge, { backgroundColor: theme.cardBorder }, isActive && [styles.tabBadgeActive, { backgroundColor: theme.accentGold }]]}>
                    <Text style={[styles.tabBadgeText, { color: theme.textSecondary }, isActive && [styles.tabBadgeTextActive, { color: isDarkMode ? "#080F1E" : "#FFFFFF" }]]}>
                      {tab.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* NOTIFICATIONS LIST */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={[styles.emptyIconWrapper, { backgroundColor: isDarkMode ? "rgba(252, 211, 77, 0.04)" : "rgba(11, 90, 142, 0.04)", borderColor: theme.cardBorder }]}>
              <Ionicons
                name={searchQuery || activeTab !== 'all' ? "funnel-outline" : "notifications-off-outline"}
                size={40}
                color={theme.accentGold}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              {searchQuery || activeTab !== 'all' ? "No results found" : "Quiet in here!"}
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {searchQuery || activeTab !== 'all' 
                ? "Try adjusting your search query or switching filters."
                : "You have no notifications in this category."}
            </Text>
            {(searchQuery || activeTab !== 'all') && (
              <TouchableOpacity
                style={[styles.resetBtn, { backgroundColor: isDarkMode ? "rgba(252, 211, 77, 0.08)" : "rgba(11, 90, 142, 0.08)", borderColor: theme.accentGold }]}
                onPress={() => {
                  setSearchQuery('');
                  setActiveTab('all');
                }}
              >
                <Text style={[styles.resetBtnText, { color: theme.accentGold }]}>Reset Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredNotifications.map((item) => {
            const config = getNotificationConfig(item.title);
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.85}
                onPress={() => handleNotificationPress(item)}
                style={[
                  styles.notificationCard,
                  {
                    borderLeftColor: item.read ? theme.cardBorder : config.color,
                    borderColor: theme.cardBorder,
                    backgroundColor: item.read ? theme.cardBg : (isDarkMode ? '#111C30' : '#E2E8F0'),
                  },
                ]}
              >
                {/* Accent background tint for unread notifications */}
                {!item.read && (
                  <View style={[styles.cardTint, { backgroundColor: config.bgColor }]} />
                )}

                <View style={styles.cardHeader}>
                  <View style={styles.iconAndBadgeRow}>
                    <View style={[styles.iconWrapper, { backgroundColor: item.read ? 'rgba(51, 65, 85, 0.2)' : config.bgColor }]}>
                      <Ionicons
                        name={config.icon}
                        size={16}
                        color={item.read ? '#64748B' : config.color}
                      />
                    </View>
                    <View style={[styles.badgeContainer, { backgroundColor: item.read ? 'rgba(51, 65, 85, 0.1)' : config.bgColor }]}>
                      <Text style={[styles.badgeText, { color: item.read ? '#64748B' : config.color }]}>
                        {config.badge}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actionRow}>
                    {!item.read && (
                      <TouchableOpacity
                        style={[styles.actionIconButton, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}
                        onPress={() => handleMarkRead(item.id)}
                      >
                        <Ionicons name="checkmark-done" size={16} color="#34D399" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.actionIconButton, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}
                      onPress={() => handleDelete(item.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.notificationTitle, { color: theme.textPrimary }, item.read && styles.notificationTitleRead]}>
                      {item.title}
                    </Text>
                    {!item.read && (
                      <View style={[styles.unreadDot, { backgroundColor: config.color }]} />
                    )}
                  </View>
                  <Text style={[styles.notificationBody, { color: theme.textPrimary }, item.read && styles.notificationBodyRead]}>
                    {item.body}
                  </Text>
                  
                  <View style={styles.footerRow}>
                    <Ionicons name="time-outline" size={12} color={theme.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={[styles.notificationTime, { color: theme.textSecondary }]}>
                      {item.timestamp}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
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
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  backBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1.5,
  },
  clearBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  clearText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 11,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 4,
  },
  tabsSection: {
    paddingBottom: 8,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 4,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(252, 211, 77, 0.08)',
    borderColor: '#FCD34D',
  },
  tabLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#FCD34D',
    fontWeight: '700',
  },
  tabBadge: {
    marginLeft: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: '#334155',
  },
  tabBadgeActive: {
    backgroundColor: '#FCD34D',
  },
  tabBadgeText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
  },
  tabBadgeTextActive: {
    color: '#080F1E',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  notificationCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  cardTint: {
    ...StyleSheet.absoluteFillObject,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    zIndex: 2,
  },
  iconAndBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardBody: {
    paddingLeft: 2,
    zIndex: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontWeight: '700',
    color: '#F8FAFC',
    fontSize: 14,
    flex: 1,
  },
  notificationTitleRead: {
    color: '#64748B',
    fontWeight: '600',
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 8,
  },
  notificationBody: {
    color: '#94A3B8',
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 8,
  },
  notificationBodyRead: {
    color: '#475569',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationTime: {
    color: '#475569',
    fontSize: 10.5,
    fontWeight: '600',
  },
  emptyBox: {
    marginTop: 80,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(252, 211, 77, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(252, 211, 77, 0.1)',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  resetBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(252, 211, 77, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(252, 211, 77, 0.2)',
  },
  resetBtnText: {
    color: '#FCD34D',
    fontWeight: '700',
    fontSize: 12,
  },
});
