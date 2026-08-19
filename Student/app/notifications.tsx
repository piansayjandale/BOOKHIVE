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

  // Helper to extract reason/comment from body text
  const parseNotificationBody = (body: string) => {
    if (!body) return { mainText: '', reasonText: null, reasonPrefix: 'Reason' };

    // Match patterns like: "... Reason: <comment>" or "... Note: <comment>" or "... Comment: <comment>"
    const match = body.match(/^(.*?)(?:\.\s*|\s+)(Reason|Note|Comment|Librarian Reason|Librarian Note|Decline Reason|Declined Reason)[\s:]+(.+)$/i);
    if (match && match[3]) {
      let mainText = match[1].trim();
      if (mainText && !mainText.endsWith('.')) {
        mainText += '.';
      }
      return {
        mainText,
        reasonPrefix: match[2].trim(),
        reasonText: match[3].trim(),
      };
    }

    // Match if body starts directly with "Reason: <comment>"
    const startsWithReason = body.match(/^(Reason|Note|Comment|Librarian Reason|Librarian Note|Decline Reason)[\s:]+(.+)$/i);
    if (startsWithReason) {
      return {
        mainText: '',
        reasonPrefix: startsWithReason[1].trim(),
        reasonText: startsWithReason[2].trim(),
      };
    }

    return { mainText: body, reasonText: null, reasonPrefix: 'Reason' };
  };

  const getNotificationConfig = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("added") || t.includes("new book")) {
      return {
        icon: "book-outline" as const,
        color: isDarkMode ? "#38BDF8" : "#0284C7", // Sky Blue
        bgColor: isDarkMode ? "rgba(56, 189, 248, 0.12)" : "#F0F9FF",
        borderColor: isDarkMode ? "rgba(56, 189, 248, 0.3)" : "#BAE6FD",
        badge: "NEW BOOK",
        badgeBg: isDarkMode ? "rgba(56, 189, 248, 0.15)" : "#E0F2FE",
        badgeText: isDarkMode ? "#38BDF8" : "#0369A1",
        isAlert: false,
      };
    }
    if (t.includes("returned") || t.includes("success") || t.includes("approved")) {
      return {
        icon: "checkmark-circle-outline" as const,
        color: isDarkMode ? "#34D399" : "#059669", // Emerald Green
        bgColor: isDarkMode ? "rgba(52, 211, 153, 0.12)" : "#ECFDF5",
        borderColor: isDarkMode ? "rgba(52, 211, 153, 0.3)" : "#A7F3D0",
        badge: "SUCCESS",
        badgeBg: isDarkMode ? "rgba(52, 211, 153, 0.15)" : "#D1FAE5",
        badgeText: isDarkMode ? "#34D399" : "#047857",
        isAlert: false,
      };
    }
    if (t.includes("pending") || t.includes("request") || t.includes("reservation")) {
      return {
        icon: "time-outline" as const,
        color: isDarkMode ? "#FCD34D" : "#D97706", // Gold/Amber (Pending)
        bgColor: isDarkMode ? "rgba(252, 211, 77, 0.12)" : "#FFFBEB",
        borderColor: isDarkMode ? "rgba(252, 211, 77, 0.3)" : "#FDE68A",
        badge: "PENDING",
        badgeBg: isDarkMode ? "rgba(252, 211, 77, 0.15)" : "#FEF3C7",
        badgeText: isDarkMode ? "#FCD34D" : "#B45309",
        isAlert: false,
      };
    }
    if (t.includes("declined") || t.includes("failed") || t.includes("cancel")) {
      return {
        icon: "close-circle-outline" as const,
        color: isDarkMode ? "#F87171" : "#EF4444", // Rose Red
        bgColor: isDarkMode ? "rgba(248, 113, 113, 0.12)" : "#FEF2F2",
        borderColor: isDarkMode ? "rgba(248, 113, 113, 0.3)" : "#FECACA",
        badge: "ALERT",
        badgeBg: isDarkMode ? "rgba(248, 113, 113, 0.15)" : "#FEE2E2",
        badgeText: isDarkMode ? "#F87171" : "#DC2626",
        isAlert: true,
      };
    }
    return {
      icon: "sparkles-outline" as const,
      color: isDarkMode ? "#A78BFA" : "#7C3AED", // Purple
      bgColor: isDarkMode ? "rgba(167, 139, 250, 0.12)" : "#F5F3FF",
      borderColor: isDarkMode ? "rgba(167, 139, 250, 0.3)" : "#DDD6FE",
      badge: "GENERAL",
      badgeBg: isDarkMode ? "rgba(167, 139, 250, 0.15)" : "#EDE9FE",
      badgeText: isDarkMode ? "#A78BFA" : "#6D28D9",
      isAlert: false,
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
    const textMatch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      item.body.toLowerCase().includes(searchQuery.toLowerCase());
    if (!textMatch) return false;

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
    return true;
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
          <TouchableOpacity style={[styles.clearBtn, { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2', borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.25)' : '#FECACA' }]} onPress={handleClearAll}>
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
                  styles.tabButton,
                  {
                    backgroundColor: isActive 
                      ? (isDarkMode ? "rgba(252, 211, 77, 0.15)" : "#FEF3C7") 
                      : theme.cardBg,
                    borderColor: isActive 
                      ? (isDarkMode ? "#FCD34D" : "#F59E0B") 
                      : theme.cardBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isActive 
                        ? (isDarkMode ? "#FCD34D" : "#B45309") 
                        : theme.textSecondary,
                      fontWeight: isActive ? "700" : "600",
                    },
                  ]}
                >
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View
                    style={[
                      styles.tabBadge,
                      {
                        backgroundColor: isActive 
                          ? (isDarkMode ? "#FCD34D" : "#D97706") 
                          : (isDarkMode ? "#334155" : "#E2E8F0"),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabBadgeText,
                        {
                          color: isActive 
                            ? (isDarkMode ? "#080F1E" : "#FFFFFF") 
                            : (isDarkMode ? "#94A3B8" : "#475569"),
                        },
                      ]}
                    >
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
            const parsed = parseNotificationBody(item.body);

            // Callout styling based on alert type
            const calloutBg = config.isAlert
              ? (isDarkMode ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2')
              : (isDarkMode ? 'rgba(245, 158, 11, 0.12)' : '#FFFBEB');
            const calloutBorder = config.isAlert ? '#EF4444' : '#F59E0B';
            const calloutTextColor = config.isAlert
              ? (isDarkMode ? '#FCA5A5' : '#991B1B')
              : (isDarkMode ? '#FDE047' : '#B45309');
            const calloutIconName = config.isAlert ? "alert-circle" : "chatbubble-ellipses";

            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.88}
                onPress={() => handleNotificationPress(item)}
                style={[
                  styles.notificationCard,
                  {
                    backgroundColor: theme.cardBg,
                    borderColor: theme.cardBorder,
                    shadowColor: isDarkMode ? "#000000" : "#0F172A",
                  },
                ]}
              >
                {/* Unread Indicator Ribbon / Tint */}
                {!item.read && (
                  <View style={[styles.unreadRibbon, { backgroundColor: config.color }]} />
                )}

                {/* HEADER ROW */}
                <View style={styles.cardHeader}>
                  <View style={styles.iconAndBadgeRow}>
                    <View style={[styles.iconWrapper, { backgroundColor: config.bgColor }]}>
                      <Ionicons
                        name={config.icon}
                        size={16}
                        color={config.color}
                      />
                    </View>
                    <View style={[styles.badgeContainer, { backgroundColor: config.badgeBg }]}>
                      <Text style={[styles.badgeText, { color: config.badgeText }]}>
                        {config.badge}
                      </Text>
                    </View>
                  </View>

                  {/* QUICK ACTION BUTTONS */}
                  <View style={styles.actionRow}>
                    {!item.read && (
                      <TouchableOpacity
                        style={[styles.actionIconButton, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.cardBorder }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleMarkRead(item.id);
                        }}
                      >
                        <Ionicons name="checkmark-done" size={15} color="#059669" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.actionIconButton, { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.12)' : '#FEE2E2', borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.25)' : '#FECACA' }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                    >
                      <Ionicons name="trash-outline" size={15} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* CARD BODY */}
                <View style={styles.cardBody}>
                  {/* TITLE */}
                  <View style={styles.titleRow}>
                    <Text style={[styles.notificationTitle, { color: theme.textPrimary }, item.read && styles.notificationTitleRead]}>
                      {item.title}
                    </Text>
                    {!item.read && (
                      <View style={[styles.unreadDot, { backgroundColor: config.color }]} />
                    )}
                  </View>

                  {/* MAIN DESCRIPTION */}
                  {parsed.mainText ? (
                    <Text style={[styles.notificationBody, { color: isDarkMode ? '#9CA3AF' : '#475569' }, item.read && styles.notificationBodyRead]}>
                      {parsed.mainText}
                    </Text>
                  ) : null}

                  {/* LIBRARIAN COMMENT / REASON CALLOUT BOX */}
                  {parsed.reasonText && (
                    <View style={[styles.reasonContainer, { backgroundColor: calloutBg, borderLeftColor: calloutBorder }]}>
                      <View style={styles.reasonHeaderRow}>
                        <Ionicons name={calloutIconName} size={14} color={calloutBorder} style={{ marginRight: 6 }} />
                        <Text style={[styles.reasonHeaderLabel, { color: calloutBorder }]}>
                          {parsed.reasonPrefix}:
                        </Text>
                      </View>
                      <Text style={[styles.reasonBodyText, { color: calloutTextColor }]}>
                        {parsed.reasonText}
                      </Text>
                    </View>
                  )}

                  {/* TIMESTAMP FOOTER */}
                  <View style={styles.footerRow}>
                    <Ionicons name="time-outline" size={13} color={isDarkMode ? '#64748B' : '#94A3B8'} style={{ marginRight: 4 }} />
                    <Text style={[styles.notificationTime, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
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
  },
  header: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  headerTitle: {
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1.5,
  },
  clearBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
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
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
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
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabLabel: {
    fontSize: 12.5,
  },
  tabBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  notificationCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    // Soft elevation
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  unreadRibbon: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconAndBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContainer: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    paddingLeft: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  notificationTitle: {
    fontWeight: '700',
    fontSize: 15,
    flex: 1,
    letterSpacing: -0.2,
  },
  notificationTitleRead: {
    opacity: 0.8,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginLeft: 8,
  },
  notificationBody: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  notificationBodyRead: {
    opacity: 0.75,
  },
  // REASON CALLOUT BOX
  reasonContainer: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderLeftWidth: 4,
    marginVertical: 8,
  },
  reasonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  reasonHeaderLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reasonBodyText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  notificationTime: {
    fontSize: 11,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  resetBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  resetBtnText: {
    fontWeight: '700',
    fontSize: 12,
  },
});
