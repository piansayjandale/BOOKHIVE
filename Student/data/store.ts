import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Alert } from "react-native";
import { API_URL, getAuthHeaders } from "./authService";

export type ReservationBook = {
  id: string;
  title: string;
  author: string;
  description?: string;
  year?: string | number;
  pages?: string | number;
  language?: string;
  category?: string;
  date?: string;
  status?: string;
  pickupDate?: string;
  queuePosition?: string;
  estimatedWait?: string;
  available?: string;
  returnDate?: string;
  action?: 'Borrow' | 'Reserve';
  studentName?: string;
  studentId?: string;
  department?: string;
  shelf?: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  type?: 'reservation' | 'general';
  bookData?: any;
};

export type UserProfile = {
  name: string;
  email: string;
  course: string;
  studentId: string;
  department: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  yearlevel: string;
  avatar: string;
};

export type AnnouncementItem = {
  id: string;
  title: string;
  content: string;
  priority: 'Normal' | 'Important' | 'Urgent';
  author: string;
  updatedAt: string;
};

// Local cache variables
let cachedProfile: UserProfile = {
  name: "John Doe",
  email: "john.doe@sti.edu.ph",
  course: "Computer Science",
  studentId: "2025-0001",
  department: "Technical Section",
  phone: "0999-123-4567",
  dateOfBirth: "2003-08-12",
  address: "123 Main St, Bacolod City",
  yearlevel: "3rd Year",
  avatar: "https://via.placeholder.com/150?text=Profile",
};

let cachedReservations: ReservationBook[] = [];
let cachedHistory: ReservationBook[] = [];
let cachedNotifications: NotificationItem[] = [
  {
    id: "1",
    title: "Welcome to BookHive",
    body: "Start exploring STI library books and reserving them directly from your mobile app.",
    timestamp: "2 hours ago",
    read: false,
    type: "general",
  },
  {
    id: "2",
    title: "Reservation Pending",
    body: "Your reservation request for 'Clean Code' is pending approval by the librarian.",
    timestamp: "1 day ago",
    read: true,
    type: "reservation",
  }
];

let cachedAnnouncements: AnnouncementItem[] = [];

// Re-render subscribers
const listeners = new Set<() => void>();

export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notify = () => {
  listeners.forEach((l) => {
    try {
      l();
    } catch (e) {
      console.warn("Listener notification failed:", e);
    }
  });
};

// Load initial states from AsyncStorage
const loadCacheFromStorage = async () => {
  try {
    const profileStr = await AsyncStorage.getItem("STUDENT_PROFILE");
    if (profileStr) {
      cachedProfile = { ...cachedProfile, ...JSON.parse(profileStr) };
    }

    const reservationsStr = await AsyncStorage.getItem("STUDENT_RESERVATIONS");
    if (reservationsStr) {
      cachedReservations = JSON.parse(reservationsStr);
    }

    const historyStr = await AsyncStorage.getItem("STUDENT_HISTORY");
    if (historyStr) {
      cachedHistory = JSON.parse(historyStr);
    }

    const notificationsStr = await AsyncStorage.getItem("STUDENT_NOTIFICATIONS");
    if (notificationsStr) {
      cachedNotifications = JSON.parse(notificationsStr);
    }

    const announcementsStr = await AsyncStorage.getItem("STUDENT_ANNOUNCEMENTS");
    if (announcementsStr) {
      cachedAnnouncements = JSON.parse(announcementsStr);
    }

    notify();
  } catch (error) {
    console.log("Error loading store cache from storage:", error);
  }
};

loadCacheFromStorage();

// Throttling mechanism to prevent infinite API render-fetch loops
let lastProfileFetchTime = 0;
let lastTxFetchTime = 0;
const FETCH_COOLDOWN_MS = 4000; // 4 seconds cooldown

export const syncProfileWithBackend = async (force = false) => {
  const now = Date.now();
  if (!force && now - lastProfileFetchTime < FETCH_COOLDOWN_MS) {
    return;
  }
  lastProfileFetchTime = now;

  try {
    const headers = await getAuthHeaders();
    if (!headers.headers || !headers.headers.Authorization) {
      return;
    }

    const response = await axios.get(`${API_URL}/api/student/profile`, headers);
    if (response.status === 200 && response.data?.user) {
      const dbUser = response.data.user;
      cachedProfile = {
        ...cachedProfile,
        name: dbUser.name,
        email: dbUser.email,
        studentId: dbUser.idNumber || cachedProfile.studentId,
        department: dbUser.department || cachedProfile.department,
        course: dbUser.course || cachedProfile.course,
        avatar: dbUser.avatar || cachedProfile.avatar,
      };

      await AsyncStorage.setItem("STUDENT_PROFILE", JSON.stringify(cachedProfile));
      notify();
    }
  } catch (error) {
    console.log("Error syncing profile with backend:", error);
  }
};

export const syncTransactionsWithBackend = async (force = false) => {
  const now = Date.now();
  if (!force && now - lastTxFetchTime < FETCH_COOLDOWN_MS) {
    return;
  }
  lastTxFetchTime = now;

  try {
    const headers = await getAuthHeaders();
    if (!headers.headers || !headers.headers.Authorization) {
      return;
    }

    const response = await axios.get(`${API_URL}/api/student/borrow-history`, headers);
    if (response.status === 200 && response.data?.history) {
      const dbHistory = response.data.history;

      const mappedList: ReservationBook[] = dbHistory.map((tx: any) => {
        const isTxReturned = tx.status === 'Returned';
        const isTxApproved = tx.status === 'Approved';
        
        let displayStatus = "Upcoming";
        if (isTxReturned) {
          displayStatus = "Completed";
        } else if (tx.status === 'Declined') {
          displayStatus = "Declined";
        } else if (tx.type === 'Reservation') {
          displayStatus = "Pending";
        } else if (isTxApproved) {
          displayStatus = "Approved";
        }

        return {
          id: tx.id,
          title: tx.title || tx.resourceTitle || "Unknown Book",
          author: tx.author || "Unknown Author",
          description: tx.description || "",
          year: tx.year || "2024",
          pages: tx.pages || 320,
          language: tx.language || "EN",
          category: tx.category || "CS",
          date: isTxReturned ? "Returned" : (tx.dueDate ? new Date(tx.dueDate).toISOString().split('T')[0] : 'Pending'),
          status: displayStatus,
          pickupDate: tx.requestedAt ? new Date(tx.requestedAt).toISOString().split('T')[0] : undefined,
          returnDate: tx.returnedAt ? new Date(tx.returnedAt).toISOString().split('T')[0] : undefined,
          queuePosition: tx.queuePosition ? String(tx.queuePosition) : undefined,
          estimatedWait: tx.estimatedWait || undefined,
          available: String(tx.available === "Available" || tx.available === "true" || tx.available === true),
          shelf: tx.shelf || undefined,
          action: tx.type === 'Reservation' ? 'Reserve' : 'Borrow',
        };
      });

      // Filter active (non-returned/declined) reservations/borrows for getReservations/getUpcomingReservations
      cachedReservations = mappedList.filter(item => item.status !== 'Completed' && item.status !== 'Declined');
      cachedHistory = mappedList;

      await AsyncStorage.setItem("STUDENT_RESERVATIONS", JSON.stringify(cachedReservations));
      await AsyncStorage.setItem("STUDENT_HISTORY", JSON.stringify(cachedHistory));
      notify();
    }
  } catch (error) {
    console.log("Error syncing transactions with backend:", error);
  }
};

// Synchronous getters (return current cache immediately and start background API sync)
export const getStudentProfile = () => {
  syncProfileWithBackend();
  return cachedProfile;
};

export const getReservations = () => {
  syncTransactionsWithBackend();
  return cachedReservations;
};

export const getUpcomingReservations = () => {
  syncTransactionsWithBackend();
  return cachedReservations.filter((item) => item.status !== "Completed" && item.status !== "Declined");
};

export const getReservationHistory = () => {
  syncTransactionsWithBackend();
  return cachedHistory;
};

export const getBorrowedBooks = () => {
  syncTransactionsWithBackend();
  return cachedReservations.filter((item) => item.status === "Approved");
};

// Mutations
export const addReservation = async (reservation: any) => {
  // Instantly push to local cache for reactive UX
  const existing = cachedReservations.find((item) => item.id === reservation.id);
  if (!existing) {
    cachedReservations.push(reservation);
    cachedHistory.unshift(reservation);
  }
  notify();

  try {
    const headers = await getAuthHeaders();
    const action = reservation.action === 'Borrow' ? 'borrow' : 'reserve';
    
    // We send to either POST /api/student/borrow or POST /api/student/reserve
    const response = await axios.post(
      `${API_URL}/api/student/${action}`,
      {
        bookId: reservation.id, // client temporary ID (supported as dummy string in models)
        studentName: reservation.studentName || cachedProfile.name,
        studentId: reservation.studentId || cachedProfile.studentId,
        department: reservation.department || cachedProfile.department,
        isbn: reservation.isbn,
        resourceTitle: reservation.title,
        dueDate: reservation.returnDate || reservation.date,
        studentIdImage: reservation.studentIDImage || null,
      },
      headers
    );

    if (response.status === 201) {
      await syncTransactionsWithBackend(true);
    }
  } catch (error: any) {
    console.error("Error submitting transaction to backend:", error);
    // Roll back local cache on failure
    cachedReservations = cachedReservations.filter((item) => item.id !== reservation.id);
    cachedHistory = cachedHistory.filter((item) => item.id !== reservation.id);
    notify();

    const msg = error.response?.data?.message || "Failed to submit request. Please check your network connection.";
    Alert.alert("Request Failed", msg);
  }

  return cachedReservations;
};

export const removeReservation = async (id: string) => {
  // Optimistic UI updates - save previous state for rollback
  const previousReservations = [...cachedReservations];
  const previousHistory = [...cachedHistory];

  cachedReservations = cachedReservations.filter((item) => item.id !== id);
  cachedHistory = cachedHistory.map((item) =>
    item.id === id ? { ...item, status: 'Completed', date: 'Returned' } : item
  );
  notify();

  try {
    const headers = await getAuthHeaders();
    // In our routes: studentRouter.post("/return/:transactionId", studentController.returnBook)
    const response = await axios.post(
      `${API_URL}/api/student/return/${id}`,
      {},
      headers
    );

    if (response.status === 200) {
      await syncTransactionsWithBackend(true);
    }
  } catch (error: any) {
    console.error("Error cancelling/returning book on backend:", error);
    // Roll back local cache on failure
    cachedReservations = previousReservations;
    cachedHistory = previousHistory;
    notify();

    const msg = error.response?.data?.message || "Failed to cancel request. Please check your network connection.";
    Alert.alert("Action Failed", msg);
  }

  return cachedReservations;
};

export const updateStudentProfile = async (updatedProfile: Partial<UserProfile>) => {
  // Local merge with rollback support
  const previousProfile = { ...cachedProfile };
  cachedProfile = {
    ...cachedProfile,
    ...updatedProfile,
  };
  await AsyncStorage.setItem("STUDENT_PROFILE", JSON.stringify(cachedProfile));
  notify();

  try {
    const headers = await getAuthHeaders();
    if (headers.headers && headers.headers.Authorization) {
      await axios.put(
        `${API_URL}/api/student/profile`,
        {
          name: updatedProfile.name,
          email: updatedProfile.email,
          idNumber: updatedProfile.studentId,
          course: updatedProfile.course,
          department: updatedProfile.department,
          avatar: updatedProfile.avatar,
        },
        headers
      );
    }
    await syncProfileWithBackend(true);
    return { success: true };
  } catch (error: any) {
    console.error("Error saving profile to backend:", error);
    // Rollback local cache on failure
    cachedProfile = previousProfile;
    await AsyncStorage.setItem("STUDENT_PROFILE", JSON.stringify(cachedProfile));
    notify();

    const serverMsg = error.response?.data?.message || "Failed to update profile on backend. Please check network connection.";
    return { success: false, message: serverMsg };
  }
};

// Notifications logic (Persisted in AsyncStorage)
let lastNotificationsSyncTime = 0;
export const syncNotifications = async (force = false) => {
  const now = Date.now();
  if (!force && now - lastNotificationsSyncTime < FETCH_COOLDOWN_MS) {
    return;
  }
  lastNotificationsSyncTime = now;

  try {
    const headers = await getAuthHeaders();
    if (!headers.headers || !headers.headers.Authorization) {
      return;
    }

    // 1. Sync Transaction Approvals/Declines
    const txResponse = await axios.get(`${API_URL}/api/student/borrow-history`, headers);
    if (txResponse.status === 200 && txResponse.data?.history) {
      const dbHistory = txResponse.data.history;
      
      const txStatusCacheStr = await AsyncStorage.getItem("NOTIFIED_TX_STATUSES");
      const txStatusCache = txStatusCacheStr ? JSON.parse(txStatusCacheStr) : {};
      
      const availCacheStr = await AsyncStorage.getItem("NOTIFIED_AVAILABLE_BOOKS") || "{}";
      const availCache = JSON.parse(availCacheStr);

      let updated = false;
      let availUpdated = false;

      for (const tx of dbHistory) {
        const lastStatus = txStatusCache[tx.id];
        
        if (lastStatus !== tx.status) {
          txStatusCache[tx.id] = tx.status;
          updated = true;

          // Don't notify on first sync if no status existed in cache to avoid spamming old history
          if (lastStatus !== undefined) {
            let title = "Reservation Pending";
            let body = `Your reservation request for '${tx.resourceTitle || tx.title || "Unknown Book"}' is pending approval by the librarian.`;

            if (tx.status === 'Approved') {
              title = tx.type === 'Reservation' ? 'Reservation Approved' : 'Borrow Approved';
              body = `Your ${tx.type.toLowerCase()} request for '${tx.resourceTitle || tx.title || "Unknown Book"}' has been approved by the librarian.`;
            } else if (tx.status === 'Declined') {
              title = tx.type === 'Reservation' ? 'Reservation Declined' : 'Borrow Declined';
              const reasonSuffix = tx.comment ? ` Reason: ${tx.comment}` : "";
              body = `Your ${tx.type.toLowerCase()} request for '${tx.resourceTitle || tx.title || "Unknown Book"}' was declined by the librarian.${reasonSuffix}`;
            } else if (tx.status === 'Returned') {
              title = 'Book Returned';
              body = `You have successfully returned '${tx.resourceTitle || tx.title || "Unknown Book"}'.`;
            }

            const newNotif: NotificationItem = {
              id: `tx-${tx.id}-${tx.status}-${Date.now()}`,
              title,
              body,
              timestamp: "Just now",
              read: false,
              type: "reservation",
              bookData: {
                id: tx.bookId,
                title: tx.title,
                author: tx.author,
                description: tx.description || "No description available.",
                year: tx.year || "2024",
                pages: tx.pages || "320",
                language: tx.language || "EN",
                category: tx.category || "CS",
                available: String(tx.available === "Available" || tx.available === "true" || tx.available === true),
                shelf: tx.shelf || "Shelf A-102, 2nd Floor",
              }
            };
            cachedNotifications.unshift(newNotif);
          }
        }

        // Notify if a reserved book becomes available
        if (tx.type === 'Reservation' && tx.status === 'Pending' && tx.available === 'Available') {
          const cacheKey = `${tx.id}-available`;
          if (!availCache[cacheKey]) {
            availCache[cacheKey] = true;
            availUpdated = true;

            const newNotif: NotificationItem = {
              id: `avail-${tx.id}-${Date.now()}`,
              title: "Reserved Book Available",
              body: `The book '${tx.resourceTitle || tx.title || "Unknown Book"}' you reserved is now available!`,
              timestamp: "Just now",
              read: false,
              type: "reservation",
              bookData: {
                id: tx.bookId,
                title: tx.title,
                author: tx.author,
                description: tx.description || "No description available.",
                year: tx.year || "2024",
                pages: tx.pages || "320",
                language: tx.language || "EN",
                category: tx.category || "CS",
                available: "true",
                shelf: tx.shelf || "Shelf A-102, 2nd Floor",
              }
            };
            cachedNotifications.unshift(newNotif);
          }
        }
      }

      if (updated || availUpdated) {
        if (updated) {
          await AsyncStorage.setItem("NOTIFIED_TX_STATUSES", JSON.stringify(txStatusCache));
        }
        if (availUpdated) {
          await AsyncStorage.setItem("NOTIFIED_AVAILABLE_BOOKS", JSON.stringify(availCache));
        }
        await AsyncStorage.setItem("STUDENT_NOTIFICATIONS", JSON.stringify(cachedNotifications));
        notify();
      }
    }

    // 2. Sync New Added Books
    const booksResponse = await axios.get(`${API_URL}/api/student/books?limit=15`, headers);
    if (booksResponse.status === 200 && booksResponse.data?.books) {
      const dbBooks = booksResponse.data.books;

      const bookCacheStr = await AsyncStorage.getItem("NOTIFIED_BOOK_IDS");
      const bookCache = bookCacheStr ? JSON.parse(bookCacheStr) : {};

      let updated = false;

      for (const book of dbBooks) {
        if (!bookCache[book.id]) {
          bookCache[book.id] = true;
          updated = true;

          const newNotif: NotificationItem = {
            id: `book-${book.id}-${Date.now()}`,
            title: "New Added Book",
            body: `'${book.title}' by ${book.author} has been newly added to the catalog.`,
            timestamp: "Just now",
            read: false,
            type: "general",
            bookData: {
              id: book.id,
              title: book.title,
              author: book.author,
              description: book.description || "No description available.",
              year: book.publicationYear || "2024",
              pages: book.pages || "320",
              language: book.language || "EN",
              category: book.category || "CS",
              available: String(book.status === "Available" || book.availability === "Available"),
              shelf: book.shelfLocation || "Shelf A-102, 2nd Floor",
            }
          };
          cachedNotifications.unshift(newNotif);
        }
      }

      if (updated) {
        await AsyncStorage.setItem("NOTIFIED_BOOK_IDS", JSON.stringify(bookCache));
        await AsyncStorage.setItem("STUDENT_NOTIFICATIONS", JSON.stringify(cachedNotifications));
        notify();
      }
    }

  } catch (error) {
    console.log("Error syncing notifications with backend:", error);
  }
};

export const getNotifications = () => {
  syncNotifications();
  return cachedNotifications;
};

export const addNotification = async (item: NotificationItem) => {
  cachedNotifications.unshift(item);
  try {
    await AsyncStorage.setItem("STUDENT_NOTIFICATIONS", JSON.stringify(cachedNotifications));
  } catch (e) {
    console.log(e);
  }
  notify();
  return cachedNotifications;
};

export const clearNotifications = async () => {
  cachedNotifications.length = 0;
  try {
    await AsyncStorage.removeItem("STUDENT_NOTIFICATIONS");
  } catch (e) {
    console.log(e);
  }
  notify();
  return cachedNotifications;
};

export const markNotificationRead = async (id: string) => {
  const item = cachedNotifications.find((n) => n.id === id);
  if (item) {
    item.read = true;
    try {
      await AsyncStorage.setItem("STUDENT_NOTIFICATIONS", JSON.stringify(cachedNotifications));
    } catch (e) {
      console.log(e);
    }
    notify();
  }
  return cachedNotifications;
};

export const deleteNotification = async (id: string) => {
  cachedNotifications = cachedNotifications.filter((n) => n.id !== id);
  try {
    await AsyncStorage.setItem("STUDENT_NOTIFICATIONS", JSON.stringify(cachedNotifications));
  } catch (e) {
    console.log(e);
  }
  notify();
  return cachedNotifications;
};

// Sync and get announcements functions
let lastAnnouncementsFetchTime = 0;
export const syncAnnouncementsWithBackend = async (force = false) => {
  const now = Date.now();
  if (!force && now - lastAnnouncementsFetchTime < FETCH_COOLDOWN_MS) {
    return;
  }
  lastAnnouncementsFetchTime = now;

  try {
    const headers = await getAuthHeaders();
    if (!headers.headers || !headers.headers.Authorization) {
      return;
    }

    const response = await axios.get(`${API_URL}/api/student/announcements`, headers);
    if (response.status === 200 && response.data?.announcements) {
      cachedAnnouncements = response.data.announcements;
      await AsyncStorage.setItem("STUDENT_ANNOUNCEMENTS", JSON.stringify(cachedAnnouncements));
      notify();
    }
  } catch (error) {
    console.log("Error syncing announcements with backend:", error);
  }
};

export const getAnnouncements = () => {
  syncAnnouncementsWithBackend();
  return cachedAnnouncements;
};

// --- Search History and Favorites storage ---
let cachedSearchQueries: string[] = [];
let cachedViewedBooks: any[] = [];
let cachedFavorites: any[] = [];
let cachedLibraryPoints = 0;

const loadAdditionalCache = async () => {
  try {
    const queriesStr = await AsyncStorage.getItem("SEARCH_QUERIES");
    if (queriesStr) cachedSearchQueries = JSON.parse(queriesStr);

    const viewedStr = await AsyncStorage.getItem("VIEWED_BOOKS_HISTORY");
    if (viewedStr) cachedViewedBooks = JSON.parse(viewedStr);

    const favoritesStr = await AsyncStorage.getItem("FAVORITE_BOOKS");
    if (favoritesStr) cachedFavorites = JSON.parse(favoritesStr);

    const pointsStr = await AsyncStorage.getItem("LIBRARY_POINTS");
    if (pointsStr) {
      cachedLibraryPoints = parseInt(pointsStr, 10);
    } else {
      cachedLibraryPoints = 0;
    }
  } catch (e) {
    console.log("Error loading search history/favorites cache:", e);
  }
};

loadAdditionalCache();

export const getSearchQueries = () => {
  return cachedSearchQueries;
};

export const saveSearchQuery = async (query: string) => {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length <= 1) return;
  
  cachedSearchQueries = [
    trimmed,
    ...cachedSearchQueries.filter((q) => q.toLowerCase() !== trimmed.toLowerCase())
  ].slice(0, 15);

  try {
    await AsyncStorage.setItem("SEARCH_QUERIES", JSON.stringify(cachedSearchQueries));
    await addLibraryPoints(5); // Award 5 points for searching
    notify();
  } catch (e) {
    console.log("Error saving search query:", e);
  }
};

export const clearSearchQueries = async () => {
  cachedSearchQueries = [];
  try {
    await AsyncStorage.removeItem("SEARCH_QUERIES");
    notify();
  } catch (e) {
    console.log("Error clearing search queries:", e);
  }
};

export const getViewedBooksHistory = () => {
  return cachedViewedBooks;
};

export const saveBookToViewHistory = async (book: any) => {
  if (!book || !book.id || !book.title) return;

  cachedViewedBooks = [
    book,
    ...cachedViewedBooks.filter((b) => b.id !== book.id)
  ].slice(0, 20);

  try {
    await AsyncStorage.setItem("VIEWED_BOOKS_HISTORY", JSON.stringify(cachedViewedBooks));
    notify();
  } catch (e) {
    console.log("Error saving viewed book to history:", e);
  }
};

export const clearViewedBooksHistory = async () => {
  cachedViewedBooks = [];
  try {
    await AsyncStorage.removeItem("VIEWED_BOOKS_HISTORY");
    notify();
  } catch (e) {
    console.log("Error clearing viewed books history:", e);
  }
};

export const getFavoriteBooks = () => {
  return cachedFavorites;
};

export const isBookFavorite = (id: string): boolean => {
  return cachedFavorites.some((b) => b.id === id);
};

export const toggleFavoriteBook = async (book: any) => {
  if (!book || !book.id || !book.title) return;

  const exists = cachedFavorites.some((b) => b.id === book.id);
  if (exists) {
    cachedFavorites = cachedFavorites.filter((b) => b.id !== book.id);
  } else {
    cachedFavorites = [book, ...cachedFavorites];
  }

  try {
    await AsyncStorage.setItem("FAVORITE_BOOKS", JSON.stringify(cachedFavorites));
    notify();
  } catch (e) {
    console.log("Error toggling favorite book:", e);
  }
};

let activeBooksTabOverride: string | null = null;
const booksTabListeners = new Set<(tab: string) => void>();

export const setBooksTabOverride = (tab: string) => {
  activeBooksTabOverride = tab;
  booksTabListeners.forEach(listener => {
    try {
      listener(tab);
    } catch (e) {
      console.warn("Books tab listener notification failed:", e);
    }
  });
};

export const subscribeToBooksTabOverride = (listener: (tab: string) => void) => {
  booksTabListeners.add(listener);
  return () => {
    booksTabListeners.delete(listener);
  };
};

export const getBooksTabOverride = () => {
  const current = activeBooksTabOverride;
  activeBooksTabOverride = null;
  return current;
};

export const COURSE_DATA = [
  {
    department: "CICT",
    fullName: "College of Information and Communications Technology (CICT)",
    color: "#EF4444",
    courses: [
      { name: "BS in Information Technology", code: "BSIT" },
      { name: "BS in Computer Science", code: "BSCS" },
    ]
  },
  {
    department: "COE",
    fullName: "College of Engineering (COE)",
    color: "#F97316",
    courses: [
      { name: "BS in Civil Engineering", code: "BSCE" },
      { name: "BS in Computer Engineering", code: "BSCpE" },
      { name: "BS in Electrical Engineering", code: "BSEE" },
      { name: "BS in Mechanical Engineering", code: "BSME" },
    ]
  },
  {
    department: "CBMA",
    fullName: "College of Business Management and Accountancy (CBMA)",
    color: "#FACC15",
    courses: [
      { name: "BS in Accountancy", code: "BSA" },
      { name: "BS in Management Accounting", code: "BSMA" },
      { name: "BS in Accounting Information System", code: "BSAIS" },
      { name: "BS in Business Administration", code: "BSBA" },
      { name: "BS in Entrepreneurship", code: "BS Entrep" },
      { name: "BS in Office Administration", code: "BSOA" },
    ]
  },
  {
    department: "CAS",
    fullName: "College of Arts and Sciences (CAS)",
    color: "#10B981",
    courses: [
      { name: "BA in Communication", code: "BA Comm" },
      { name: "BA in English Language Studies", code: "BA ELS" },
      { name: "BS in Psychology", code: "BS Psych" },
      { name: "BS in Mathematics", code: "BS Math" },
    ]
  },
  {
    department: "CED",
    fullName: "College of Education (CED)",
    color: "#3B82F6",
    courses: [
      { name: "Bachelor of Elementary Education", code: "BEEd" },
      { name: "Bachelor of Secondary Education", code: "BSEd" },
      { name: "Bachelor of Early Childhood Education", code: "BECEd" },
      { name: "Bachelor of Physical Education", code: "BPEd" },
    ]
  },
  {
    department: "CHTM",
    fullName: "College of Hospitality and Tourism Management (CHTM)",
    color: "#EC4899",
    courses: [
      { name: "BS in Hospitality Management", code: "BSHM" },
      { name: "BS in Tourism Management", code: "BSTM" },
    ]
  },
  {
    department: "CCJE",
    fullName: "College of Criminal Justice Education (CCJE)",
    color: "#8B5CF6",
    courses: [
      { name: "BS in Criminology", code: "BS Crim" },
      { name: "BS in Industrial Security Management", code: "BSISM" },
    ]
  }
];

export const getCourseLabel = (code: string): string => {
  for (const group of COURSE_DATA) {
    const found = group.courses.find(c => c.code.toLowerCase() === code.toLowerCase());
    if (found) {
      return `${found.name} (${found.code})`;
    }
  }
  return code;
};

export const getLibraryPoints = () => {
  return cachedLibraryPoints;
};

export const addLibraryPoints = async (points: number) => {
  cachedLibraryPoints += points;
  try {
    await AsyncStorage.setItem("LIBRARY_POINTS", String(cachedLibraryPoints));
    notify();
  } catch (e) {
    console.log("Error saving library points:", e);
  }
};

export const clearLocalCache = async () => {
  cachedViewedBooks = [];
  cachedSearchQueries = [];
  cachedFavorites = [];
  cachedReservations = [];
  cachedHistory = [];
  cachedNotifications = [];
  cachedAnnouncements = [];
  cachedLibraryPoints = 0;
  
  try {
    await AsyncStorage.removeItem("VIEWED_BOOKS_HISTORY");
    await AsyncStorage.removeItem("SEARCH_QUERIES");
    await AsyncStorage.removeItem("FAVORITE_BOOKS");
    await AsyncStorage.removeItem("STUDENT_RESERVATIONS");
    await AsyncStorage.removeItem("STUDENT_HISTORY");
    await AsyncStorage.removeItem("STUDENT_NOTIFICATIONS");
    await AsyncStorage.removeItem("STUDENT_PROFILE");
    await AsyncStorage.removeItem("STUDENT_ANNOUNCEMENTS");
    await AsyncStorage.removeItem("LIBRARY_POINTS");
    notify();
  } catch (e) {
    console.log("Error clearing local cache:", e);
  }
};



