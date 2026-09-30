import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedScreen from '../../components/AnimatedScreen';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useThemeColors } from '../../hooks/useThemeColors';
import {
  getSearchQueries,
  clearSearchQueries,
  getFavoriteBooks,
  toggleFavoriteBook,
  subscribe,
  getBooksTabOverride,
  getNotifications,
  NotificationItem,
} from '../../data/store';

type TabType = 'Search History' | 'Favorites';

export default function BooksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  const { tab } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('Search History');

  // Handle active tab parameter or global override passed from other screens
  useFocusEffect(
    React.useCallback(() => {
      const override = getBooksTabOverride();
      if (override === 'Favorites') {
        setActiveTab('Favorites');
      } else if (override === 'Search History' || override === 'History') {
        setActiveTab('Search History');
      } else if (tab === 'Favorites') {
        setActiveTab('Favorites');
        router.setParams({ tab: '' });
      } else if (tab === 'Search History' || tab === 'History') {
        setActiveTab('Search History');
        router.setParams({ tab: '' });
      }
    }, [tab])
  );

  // Local store lists
  const [searchQueries, setSearchQueries] = useState<string[]>(getSearchQueries());
  const [favorites, setFavorites] = useState<any[]>(getFavoriteBooks());
  const [notifications, setNotifications] = useState<NotificationItem[]>(getNotifications());

  // Sync with local store
  useEffect(() => {
    setSearchQueries(getSearchQueries());
    setFavorites(getFavoriteBooks());
    setNotifications(getNotifications());

    const unsubscribe = subscribe(() => {
      setSearchQueries(getSearchQueries());
      setFavorites(getFavoriteBooks());
      setNotifications(getNotifications());
    });

    return unsubscribe;
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleQueryPress = (query: string) => {
    router.push({
      pathname: '/search',
      params: { q: query },
    });
  };

  const handleBookPress = (book: any) => {
    router.push({
      pathname: '/book-details',
      params: {
        from: 'books',
        id: book.id,
        title: book.title,
        author: book.author,
        category: book.genres || book.category || book.department || 'Circulation',
        department: book.department || 'Circulation',
        rating: book.rating || '4.8',
        description: book.description || book.summary || '',
        available: book.available !== undefined ? String(book.available) : 'true',
        year: book.publicationDate ? String(book.publicationDate).substring(0, 4) : (book.year ? String(book.year) : '2026'),
        publicationDate: book.publicationDate || (book.year ? `${book.year}-01-01` : '2026-09-01'),
        pages: book.pages || '320',
        language: book.language || 'EN',
        shelf: book.shelfLocation || book.callNumber || book.shelf || 'General Shelf',
        isbn: book.isbn || '',
        copies: String(book.copies !== undefined && book.copies !== null ? book.copies : 1),
        volume: book.volume || 'Single Volume / None',
        edition: book.edition || 'Single Edition / None',
        accessionNumber: book.accessionNumber || '',
      },
    });
  };

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            height: 65 + insets.top,
            backgroundColor: theme.headerBg,
            borderBottomColor: theme.headerBorder,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.headerTitle }]}>MY BOOKSHELF</Text>

        <TouchableOpacity
          style={styles.notificationButtonRelative}
          onPress={() => router.push('/notifications')}
        >
          <Ionicons name="notifications-outline" size={22} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
          {unreadCount > 0 && (
            <View style={styles.badgeContainerRelative}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* SEGMENTED TAB SELECTOR / SUB-TAB SWITCHER */}
      <View style={styles.tabContainer}>
        {(['Search History', 'Favorites'] as TabType[]).map((tabName) => {
          const isActive = activeTab === tabName;
          return (
            <TouchableOpacity
              key={tabName}
              style={[
                styles.tabPill,
                isActive
                  ? [styles.activeTabPill, !isDarkMode && { backgroundColor: theme.accentBlue }]
                  : [styles.inactiveTabPill, !isDarkMode && { backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.cardBorder }],
              ]}
              onPress={() => setActiveTab(tabName)}
            >
              <Text
                style={[
                  styles.tabText,
                  isActive
                    ? [styles.activeTabText, !isDarkMode && { color: "#FFFFFF", fontWeight: '800' }]
                    : [styles.inactiveTabText, !isDarkMode && { color: theme.textSecondary }],
                ]}
              >
                {tabName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* CONTENT BLOCK */}
      <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
        {/* STATE 1 & STATE 2: SEARCH HISTORY TAB */}
        {activeTab === 'Search History' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.sectionTitle }]}>
                Recent Searches
              </Text>
              <TouchableOpacity onPress={clearSearchQueries}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>

            {/* STATE 1: EMPTY STATE */}
            {searchQueries.length === 0 ? (
              <View style={[styles.emptyCardContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                <Ionicons name="book-outline" size={40} color="#64748B" style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No recently search books.
                </Text>
              </View>
            ) : (
              /* STATE 2: POPULATED STATE */
              <View>
                {/* TIMESTAMP DIVIDER */}
                <View style={styles.timestampDividerRow}>
                  <View style={[styles.dividerLine, { backgroundColor: theme.cardBorder }]} />
                  <Text style={[styles.timestampText, { color: theme.textSecondary }]}>
                    8/6/26 1:23 PM
                  </Text>
                  <View style={[styles.dividerLine, { backgroundColor: theme.cardBorder }]} />
                </View>

                {/* SEARCH HISTORY ITEMS LIST */}
                {searchQueries.map((query, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.historyCapsuleCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                    onPress={() => handleQueryPress(query)}
                  >
                    <View style={!isDarkMode ? { backgroundColor: "#FFF300", borderRadius: 6, padding: 4, marginRight: 10 } : { marginRight: 12 }}>
                      <Ionicons name="search" size={14} color={isDarkMode ? theme.accentGold : "#0274BB"} />
                    </View>
                    <Text style={[styles.historyQueryText, { color: theme.textPrimary }]}>
                      {query}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* STATE 3: FAVORITES VIEW */}
        {activeTab === 'Favorites' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: isDarkMode ? theme.accentGold : theme.textPrimary }]}>
                Favorite Books
              </Text>
              <View style={[styles.countBadgePill, !isDarkMode && { backgroundColor: "#FFF300", borderWidth: 1, borderColor: "#FFF300" }]}>
                <Text style={[styles.countBadgeText, !isDarkMode && { color: "#0274BB", fontWeight: "800" }]}>
                  {favorites.length} Saved
                </Text>
              </View>
            </View>

            {favorites.length === 0 ? (
              <View style={[styles.emptyCardContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                <Ionicons name="bookmark-outline" size={40} color="#64748B" style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No saved favorite books yet.
                </Text>
              </View>
            ) : (
              favorites.map((book, index) => (
                <TouchableOpacity
                  key={`fav-book-${book.id || index}-${index}`}
                  style={[styles.favoriteBookCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                  onPress={() => handleBookPress(book)}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.favBookTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                      {book.title}
                    </Text>
                    <View style={styles.favDetailsRow}>
                      <Text style={[styles.favAuthorText, { color: theme.textSecondary }]}>
                        By: {book.author}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => toggleFavoriteBook(book)}
                    style={styles.bookmarkTouchArea}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <View style={!isDarkMode ? { backgroundColor: "#FFF300", borderRadius: 8, padding: 5 } : undefined}>
                      <Ionicons name="bookmark" size={18} color={isDarkMode ? "#FFD700" : "#0274BB"} />
                    </View>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        <View style={{ height: 60 }} />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#111A2E',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  notificationButtonRelative: {
    position: 'relative',
    padding: 4,
  },
  badgeContainerRelative: {
    position: 'absolute',
    right: -2,
    top: -2,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  tabPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTabPill: {
    backgroundColor: '#FFD700',
  },
  inactiveTabPill: {
    backgroundColor: '#1E293B',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  activeTabText: {
    color: '#080F1E',
  },
  inactiveTabText: {
    color: '#94A3B8',
  },
  contentScroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FCD34D',
  },
  clearText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '600',
  },
  emptyCardContainer: {
    backgroundColor: '#111A2E',
    borderRadius: 20,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center', // wait, fix typo here!
    borderWidth: 1,
    borderColor: '#1E293B',
    marginTop: 8,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
  },
  timestampDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1E293B',
  },
  timestampText: {
    color: '#64748B',
    fontSize: 11,
    marginHorizontal: 10,
    fontWeight: '500',
  },
  historyCapsuleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111A2E',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  historyQueryText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  countBadgePill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  favoriteBookCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111A2E',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  favBookTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  favDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favRatingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  favAuthorText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  bookmarkTouchArea: {
    padding: 4,
  },
});