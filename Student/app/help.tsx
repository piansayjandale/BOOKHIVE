import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AnimatedScreen from '../components/AnimatedScreen';
import { useThemeColors } from '../hooks/useThemeColors';
if (
  Platform.OS === 'android' &&
  !(globalThis as any)?.nativeFabricUIManager &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch {}
}

interface PageGuide {
  id: string;
  pageTitle: string;
  category: string;
  icon: string;
  badge: string;
  summary: string;
  keyFeatures: string[];
  howToOperate: { step: string; instruction: string }[];
  importantTips?: string[];
}

const PAGE_GUIDES: PageGuide[] = [
  {
    id: 'home',
    pageTitle: 'Home Screen',
    category: 'Navigation',
    icon: 'home-outline',
    badge: 'Dashboard',
    summary: 'Your central hub for campus library announcements, quick stats, and AI-personalized recommendations.',
    keyFeatures: [
      'Personalized student welcome header with unread notification badge.',
      'Official campus announcements, library schedules, and holiday advisories.',
      'AI-Powered Book Recommendations tailored to your course and academic department.',
      'Quick shortcut buttons to Search, My Books, and Library Card.',
    ],
    howToOperate: [
      { step: 'Step 1', instruction: 'Browse the top banner for urgent library advisories or schedule announcements.' },
      { step: 'Step 2', instruction: 'Swipe through the "Recommended for You" carousel to discover titles matching your curriculum.' },
      { step: 'Step 3', instruction: 'Tap any book card to immediately open its details, availability, and borrowing options.' },
      { step: 'Step 4', instruction: 'Tap the notification bell on the top right to check live transaction status updates.' },
    ],
    importantTips: [
      'Recommendations automatically refresh based on your degree program and loan history.',
    ],
  },
  {
    id: 'search',
    pageTitle: 'Search & Catalog Discovery',
    category: 'Catalog',
    icon: 'search-outline',
    badge: 'Search',
    summary: 'Search thousands of books across the university collection with real-time availability filters.',
    keyFeatures: [
      'Instant search by Title, Author, Category, Publisher, or ISBN number.',
      'College Department filter chips (CICT, COE, CBMA, CAS, CED, CHTM, CCJE).',
      'Availability status indicators (Green for Available Now, Amber for Currently Loaned).',
    ],
    howToOperate: [
      { step: 'Step 1', instruction: 'Tap the search bar at the top of the Search tab and type any keyword, book title, or author name.' },
      { step: 'Step 2', instruction: 'Filter by tapping your college department chip (e.g., CICT for tech books, CBMA for business).' },
      { step: 'Step 3', instruction: 'Inspect the availability badge on each result to see if shelf copies are available immediately.' },
      { step: 'Step 4', instruction: 'Tap any search result to open the full Book Details screen.' },
    ],
    importantTips: [
      'You can also search by ISBN (e.g. 978-0131103627) for exact edition matching.',
    ],
  },
  {
    id: 'book-details',
    pageTitle: 'Book Details & Requests',
    category: 'Circulation',
    icon: 'book-outline',
    badge: 'Borrow & Reserve',
    summary: 'View complete bibliographic data, exact shelf location, and submit borrow or reservation requests.',
    keyFeatures: [
      'Full bibliographic profile: Authors, Category, Published Year, Page count, and Synopsis.',
      'Physical Library Locator: Floor number, shelf category, and Call Number.',
      'Real-time copy status: Total physical copies vs. available shelf copies.',
      'Smart action buttons: "Borrow Book" (available) vs "Reserve Book" (in-circulation).',
    ],
    howToOperate: [
      { step: 'Borrowing', instruction: 'When a book has available copies, tap the gold "Borrow Book" button. Review the pickup deadline, confirm the request, and proceed to the Circulation Desk within the pickup window.' },
      { step: 'Reserving', instruction: 'When all copies are currently borrowed, tap "Reserve Book". You are assigned a queue position (e.g. Queue #1). When returned, you receive a notification with a claim deadline to collect it.' },
      { step: 'Shelf Finding', instruction: 'Check the "Shelf Location" and "Call Number" (e.g., QA76.73 .C15) to locate the book on physical library shelves.' },
    ],
    importantTips: [
      'Always claim approved reservations before the timer expires to prevent auto-release to the next student.',
    ],
  },
  {
    id: 'my-books',
    pageTitle: 'My Books & Loans Tracker',
    category: 'Circulation',
    icon: 'albums-outline',
    badge: 'Loan Tracker',
    summary: 'Monitor active borrowed books, countdown to return due dates, and track historical loans.',
    keyFeatures: [
      'Active Loans Tab: Displays books currently in your possession with countdown due dates.',
      'Reservations Tab: Track pending reservations and position in queue.',
      'History Tab: Archived record of all returned, completed, or canceled loan transactions.',
      'Due Date Alerts: Visual indicators highlighting loans nearing their deadline to avoid fines.',
    ],
    howToOperate: [
      { step: 'Step 1', instruction: 'Open the "My Books" tab from the bottom navigation bar.' },
      { step: 'Step 2', instruction: 'Check the "Active" tab to view borrowed books, borrow dates, and due return dates.' },
      { step: 'Step 3', instruction: 'Return books on or before the due date to the Circulation Desk or official return drop box.' },
      { step: 'Step 4', instruction: 'Switch to the "History" tab to review previous transactions and reading logs.' },
    ],
    importantTips: [
      'Returning books on time ensures your account maintains an active clearance status for enrollments and grading.',
    ],
  },
  {
    id: 'library-card',
    pageTitle: 'Library Card & Digital ID',
    category: 'ID & Ledger',
    icon: 'card-outline',
    badge: 'Digital ID',
    summary: 'Your scannable digital student library card, circulation ledger table, and violation record.',
    keyFeatures: [
      'Personal Scannable QR Code tied to your verified Student ID.',
      'Official Circulation Ledger: Table listing Borrow Date & Time, Due Date, and Book Titles.',
      'Disciplinary Violation Record: Penalty fines tracking and active penalty status clearance.',
    ],
    howToOperate: [
      { step: 'Step 1', instruction: 'Navigate to the "Library Card" tab (or Reservations tab) on the bottom navigation.' },
      { step: 'Step 2', instruction: 'Present your digital QR code to the circulation librarian or automated scanner kiosk at checkout.' },
      { step: 'Step 3', instruction: 'Scroll down to the Library Card table to inspect your recorded loans and return dates.' },
      { step: 'Step 4', instruction: 'Check the "Violation Record" section. A green "No Active Violations" badge confirms your account is in good standing.' },
    ],
    importantTips: [
      'Do not share your digital library card. Transactions recorded via your QR code are your sole legal responsibility.',
    ],
  },
  {
    id: 'profile',
    pageTitle: 'Profile & Account Information',
    category: 'Account',
    icon: 'person-outline',
    badge: 'Profile',
    summary: 'Official student record, system configuration, library policies, and session management.',
    keyFeatures: [
      'Profile Card: Full Name, Course & Section, and Student ID Badge.',
      'Summary Stats: Total Active Reservations and Borrowed Books counter.',
      'Account Information Section: Official read-only institutional data managed by Super Admin.',
      'Settings Menu: System Settings, Terms & Agreement, Help & Support, Privacy & Security, and Sign Out.',
    ],
    howToOperate: [
      { step: 'Step 1', instruction: 'Open the "Profile" tab to review your account details and current loan statistics.' },
      { step: 'Step 2', instruction: 'Verify your name, department, course, and year level under "Account Information".' },
      { step: 'Step 3', instruction: 'Tap "Terms & Agreement" just below System Settings to review your accepted library obligations.' },
      { step: 'Step 4', instruction: 'Tap "Privacy & Security" to configure notification preferences or "Sign Out" to end your session.' },
    ],
    importantTips: [
      'Only the Super Administrator has authority to edit account information. For discrepancies, contact library staff.',
    ],
  },
  {
    id: 'notifications',
    pageTitle: 'Notifications & Alerts',
    category: 'Alerts',
    icon: 'notifications-outline',
    badge: 'Alerts',
    summary: 'Real-time push notifications, due date alerts, claim reminders, and library announcements.',
    keyFeatures: [
      'Instant Borrow Approval notices.',
      'Reservation Ready notices with pickup deadline countdown.',
      'Due Date Reminders (24–48 hours prior to loan expiry).',
      'General campus library bulletins and holiday advisories.',
    ],
    howToOperate: [
      { step: 'Step 1', instruction: 'Tap the notification bell icon on the top header of the Home or Profile page.' },
      { step: 'Step 2', instruction: 'Tap any unread notification to view its full details and related book title.' },
      { step: 'Step 3', instruction: 'Unread notification counters will clear automatically after viewing.' },
    ],
    importantTips: [
      'Enable push and email notifications in Privacy & Security to never miss a due date reminder.',
    ],
  },
  {
    id: 'scanner',
    pageTitle: 'Barcode & QR Scanner Kiosk',
    category: 'Tools',
    icon: 'qr-code-outline',
    badge: 'Scanner',
    summary: 'Scan physical book barcodes or shelf QR codes inside the library for instant catalog lookup.',
    keyFeatures: [
      'Camera-based barcode reader supporting ISBN-10, ISBN-13, and BookHive shelf QR codes.',
      'Instant redirect to book details, location shelf, and borrow request options.',
    ],
    howToOperate: [
      { step: 'Step 1', instruction: 'Open the camera scanner from the Home screen shortcut or header icon.' },
      { step: 'Step 2', instruction: 'Grant camera access permission if prompted by your device.' },
      { step: 'Step 3', instruction: 'Align the book barcode inside the visual scanner reticle.' },
      { step: 'Step 4', instruction: 'The app immediately recognizes the book and opens its full profile.' },
    ],
    importantTips: [
      'Ensure good lighting on the barcode surface for instantaneous recognition.',
    ],
  },
  {
    id: 'penalties',
    pageTitle: 'Penalties & Overdue Guidelines',
    category: 'Policy',
    icon: 'alert-circle-outline',
    badge: 'Rules & Fines',
    summary: 'Understanding loan periods, daily penalty rates, account restrictions, and clearance restoration.',
    keyFeatures: [
      'Standard Loan Duration: 7 days for general circulation books.',
      'Daily Overdue Fine: ₱20.00 per book for each calendar day beyond the return due date.',
      'Automatic Account Restrictions: Incurring overdue fines temporarily freezes new borrowing requests.',
    ],
    howToOperate: [
      { step: 'Returning Overdue Books', instruction: 'Bring overdue materials directly to the 2nd Floor Circulation Desk. Drop box returns for overdue books are not permitted.' },
      { step: 'Settling Fines', instruction: 'Settle the assessed overdue fine with the circulation librarian. An official receipt will be issued.' },
      { step: 'Account Clearance', instruction: 'The librarian immediately updates the BookHive database, clearing your violation record and restoring full borrowing privileges.' },
    ],
    importantTips: [
      'Lost or damaged books must be reported immediately. The student must replace the title or pay the evaluated replacement cost.',
    ],
  },
];

const FAQS = [
  {
    q: 'How do I borrow a book from the application?',
    a: 'Find the book using Search or Home recommendations, tap on it to view Book Details, and press "Borrow Book". If approved, collect the book at the Circulation Desk within the pickup deadline.',
  },
  {
    q: 'What should I do if a book is already borrowed by someone else?',
    a: 'Tap "Reserve Book" on the Book Details screen. You will join the waitlist queue. When the previous student returns the book, you will receive a notification with a reservation claim deadline.',
  },
  {
    q: 'Why am I unable to edit my profile details?',
    a: 'Student accounts are verified institutional records. To prevent fraudulent identification and maintain accreditation compliance, only the Super Administrator has authority to edit account information.',
  },
  {
    q: 'How much is the penalty for overdue books?',
    a: 'The standard library policy assesses a fine of ₱20.00 per book per day for late returns. Fines must be settled at the Circulation Desk to clear account holds.',
  },
  {
    q: 'How do I present my digital library card at checkout?',
    a: 'Open the "Library Card" tab from the bottom navigation bar and display the scannable QR code on your phone screen to the librarian or kiosk scanner.',
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedSection, setExpandedSection] = useState<string | null>('home');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const categories = ['All', 'Navigation', 'Catalog', 'Circulation', 'ID & Ledger', 'Account', 'Policy'];

  const filteredGuides = PAGE_GUIDES.filter((guide) => {
    const matchesCategory = selectedCategory === 'All' || guide.category === selectedCategory;
    const matchesSearch =
      guide.pageTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guide.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guide.badge.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guide.keyFeatures.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const toggleSection = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSection(expandedSection === id ? null : id);
  };

  const toggleFaq = (idx: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaq(expandedFaq === idx ? null : idx);
  };

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View
        style={[
          styles.header,
          {
            paddingTop: 16 + insets.top,
            backgroundColor: theme.headerBg,
            borderBottomColor: theme.headerBorder,
            borderBottomWidth: 1,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack?.()) {
              router.back();
            } else {
              router.replace('/(tabs)/profile');
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={isDarkMode ? theme.accentGold : theme.accentBlue} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.headerTitle }]}>HELP & SUPPORT</Text>

        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: 40,
        }}
      >
        {/* BANNER */}
        <View style={[styles.bannerCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={[styles.bannerIconWrap, { backgroundColor: isDarkMode ? 'rgba(234, 179, 8, 0.12)' : '#FEF3C7' }]}>
            <Ionicons name="book" size={26} color={theme.accentGold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: theme.textPrimary }]}>
              BookHive Operational Manual
            </Text>
            <Text style={[styles.bannerSubtitle, { color: theme.textSecondary }]}>
              Comprehensive, page-by-page instructions on how to use every feature of your digital library portal.
            </Text>
          </View>
        </View>

        {/* SEARCH BAR */}
        <View style={[styles.searchBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Ionicons name="search" size={18} color={theme.accentGold} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder="Search guide by page or feature..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* CATEGORY FILTER PILLS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isSelected ? theme.accentGold : theme.cardBg,
                    borderColor: isSelected ? theme.accentGold : theme.cardBorder,
                  },
                ]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    {
                      color: isSelected ? '#080F1E' : theme.textSecondary,
                      fontWeight: isSelected ? '800' : '600',
                    },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* SECTION TITLE: PAGE GUIDES */}
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="apps-outline" size={18} color={theme.accentGold} />
          <Text style={[styles.sectionHeading, { color: theme.accentGold }]}>
            Page-by-Page Operating Guides ({filteredGuides.length})
          </Text>
        </View>

        {/* GUIDES ACCORDION LIST */}
        {filteredGuides.map((guide) => {
          const isExpanded = expandedSection === guide.id;
          return (
            <View
              key={guide.id}
              style={[
                styles.guideCard,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: isExpanded ? theme.accentGold : theme.cardBorder,
                  shadowColor: theme.shadowColor,
                  shadowOpacity: isDarkMode ? 0.3 : 0.05,
                },
              ]}
            >
              {/* ACCORDION HEADER */}
              <TouchableOpacity
                style={styles.guideHeader}
                onPress={() => toggleSection(guide.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.guideIconWrap, { backgroundColor: isDarkMode ? '#0E1726' : '#F1F5F9' }]}>
                  <Ionicons name={guide.icon as any} size={20} color={theme.accentGold} />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.guideTitle, { color: theme.textPrimary }]}>
                      {guide.pageTitle}
                    </Text>
                    <View style={[styles.badgePill, { backgroundColor: isDarkMode ? 'rgba(234, 179, 8, 0.12)' : '#FEF3C7' }]}>
                      <Text style={[styles.badgeText, { color: theme.accentGold }]}>{guide.badge}</Text>
                    </View>
                  </View>
                  <Text style={[styles.guideSummary, { color: theme.textSecondary }]} numberOfLines={isExpanded ? undefined : 2}>
                    {guide.summary}
                  </Text>
                </View>

                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={theme.accentGold}
                />
              </TouchableOpacity>

              {/* EXPANDED CONTENT */}
              {isExpanded && (
                <View style={[styles.expandedBody, { borderTopColor: theme.cardBorder }]}>
                  {/* KEY FEATURES */}
                  <Text style={[styles.subHeading, { color: theme.accentGold }]}>
                    Key Features & Controls:
                  </Text>
                  <View style={styles.listContainer}>
                    {guide.keyFeatures.map((feat, fIdx) => (
                      <View key={`feat-${fIdx}`} style={styles.bulletRow}>
                        <Ionicons name="checkmark-circle" size={14} color="#10B981" style={{ marginTop: 2 }} />
                        <Text style={[styles.bodyText, { color: theme.textPrimary }]}>{feat}</Text>
                      </View>
                    ))}
                  </View>

                  {/* HOW TO OPERATE */}
                  <Text style={[styles.subHeading, { color: theme.accentGold, marginTop: 14 }]}>
                    Step-by-Step Instructions:
                  </Text>
                  <View style={styles.stepsContainer}>
                    {guide.howToOperate.map((step, sIdx) => (
                      <View key={`step-${sIdx}`} style={[styles.stepItem, { backgroundColor: isDarkMode ? '#09101F' : '#F8FAFC', borderColor: theme.cardBorder }]}>
                        <View style={[styles.stepTag, { backgroundColor: theme.accentGold }]}>
                          <Text style={styles.stepTagText}>{step.step}</Text>
                        </View>
                        <Text style={[styles.stepInstruction, { color: theme.textPrimary }]}>
                          {step.instruction}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* IMPORTANT TIPS */}
                  {guide.importantTips && (
                    <View style={[styles.tipBox, { borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.3)' : 'rgba(14, 165, 233, 0.3)' }]}>
                      <Ionicons name="bulb-outline" size={16} color="#38BDF8" />
                      <Text style={[styles.tipText, { color: isDarkMode ? '#BAE6FD' : '#0369A1' }]}>
                        {guide.importantTips.join(' ')}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* SECTION: FREQUENTLY ASKED QUESTIONS */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <Ionicons name="help-circle-outline" size={18} color={theme.accentGold} />
          <Text style={[styles.sectionHeading, { color: theme.accentGold }]}>
            Frequently Asked Questions
          </Text>
        </View>

        {FAQS.map((faq, fIdx) => {
          const isOpen = expandedFaq === fIdx;
          return (
            <TouchableOpacity
              key={`faq-${fIdx}`}
              style={[styles.faqCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
              onPress={() => toggleFaq(fIdx)}
              activeOpacity={0.8}
            >
              <View style={styles.faqHeader}>
                <Text style={[styles.faqQuestion, { color: theme.textPrimary }]}>{faq.q}</Text>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.accentGold}
                />
              </View>
              {isOpen && (
                <Text style={[styles.faqAnswer, { color: theme.textSecondary }]}>
                  {faq.a}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}

        {/* LIBRARY CONTACT CARD */}
        <View style={[styles.contactCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View style={styles.contactHeader}>
            <Ionicons name="information-circle" size={20} color={theme.accentGold} />
            <Text style={[styles.contactTitle, { color: theme.textPrimary }]}>
              Circulation Desk & Assistance
            </Text>
          </View>
          <Text style={[styles.contactDetail, { color: theme.textSecondary }]}>
            Location: University Library, 2nd Floor
          </Text>
          <Text style={[styles.contactDetail, { color: theme.textSecondary }]}>
            Hours: Monday – Friday (8:00 AM – 5:00 PM)
          </Text>
          <Text style={[styles.contactDetail, { color: theme.textSecondary }]}>
            Email: library.circulation@wnu.sti.edu.ph
          </Text>
          <TouchableOpacity
            style={[styles.contactButton, { backgroundColor: theme.accentGold }]}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubbles-outline" size={16} color="#080F1E" />
            <Text style={styles.contactButtonText}>View System Notices</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    marginBottom: 16,
  },
  bannerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  categoryRow: {
    gap: 8,
    paddingBottom: 16,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  guideCard: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    elevation: 2,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  guideIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  guideSummary: {
    fontSize: 12,
    lineHeight: 16,
  },
  expandedBody: {
    borderTopWidth: 1,
    padding: 14,
  },
  subHeading: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  listContainer: {
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bodyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  stepsContainer: {
    gap: 8,
  },
  stepItem: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  stepTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  stepTagText: {
    color: '#080F1E',
    fontSize: 10,
    fontWeight: '800',
  },
  stepInstruction: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginTop: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  faqCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    paddingRight: 8,
  },
  faqAnswer: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  contactCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginTop: 18,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  contactDetail: {
    fontSize: 12,
    lineHeight: 18,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  contactButtonText: {
    color: '#080F1E',
    fontSize: 13,
    fontWeight: '800',
  },
});
