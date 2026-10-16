import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Alert } from "react-native";
import { API_URL, getAuthHeaders, authService } from "./authService";
import { addDynamicBook, getLiveBooks, Book } from "./books";
import { socketService } from "../services/socketService";

export type ReservationBook = {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  description?: string;
  year?: string | number;
  pages?: string | number;
  language?: string;
  category?: string;
  date?: string;
  dateReserved?: string;
  borrowDate?: string;
  dueDate?: string;
  status?: string;
  comment?: string;
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
  copies?: number | string;
  availableAt?: string;
  expiresAt?: string;
  claimDeadlineRemainingSeconds?: number;
  isReturned?: boolean;
  pickedUpAt?: string;
  isPickedUp?: boolean;
};


export type ReceiptData = {
  receiptNumber: string;
  transactionId?: string;
  bookTitle: string;
  author?: string;
  isbn?: string;
  category?: string;
  studentName: string;
  studentId: string;
  department?: string;
  borrowDate: string;
  pickupDate: string;
  returnDate: string;
  status: string;
  qrPayload: string;
  shelf?: string;
  bookData?: any;
  isPickedUp?: boolean;
  token?: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  type?: 'reservation' | 'general' | 'announcement';
  bookData?: any;
  receiptData?: ReceiptData;
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
  yearLevel?: string;
  section?: string;
  avatar: string;
  qrCode?: string;
  status?: string;
  role?: string;
};

export type AnnouncementItem = {
  id: string;
  title: string;
  content: string;
  priority: 'Normal' | 'Important' | 'Urgent';
  author: string;
  updatedAt: string;
};

export type SystemSettings = {
  borrowLimit: number;
  borrowDurationDays: number;
  theme?: string;
  aiStrictMode?: boolean;
  allowAdminTransactionControl?: boolean;
  notificationsEnabled?: boolean;
};

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  borrowLimit: 5,
  borrowDurationDays: 7,
  theme: "dark",
  aiStrictMode: true,
  allowAdminTransactionControl: false,
  notificationsEnabled: true,
};

let cachedSystemSettings: SystemSettings = { ...DEFAULT_SYSTEM_SETTINGS };

// Clean default profile state
export const DEFAULT_PROFILE: UserProfile = {
  name: "",
  email: "",
  course: "General Program",
  studentId: "",
  department: "WNU STI",
  phone: "",
  dateOfBirth: "",
  address: "",
  yearlevel: "",
  avatar: "",
  qrCode: "",
};

// Local cache variables
let cachedProfile: UserProfile = { ...DEFAULT_PROFILE };

export const resetProfileCache = (user?: Partial<UserProfile>) => {
  cachedProfile = {
    ...DEFAULT_PROFILE,
    name: user?.name || "",
    email: user?.email || "",
    studentId: user?.studentId || "",
    department: user?.department || "WNU STI",
    course: user?.course || "General Program",
    yearLevel: user?.yearLevel || "",
    yearlevel: user?.yearlevel || "",
    section: user?.section || "",
    phone: user?.phone || "",
    dateOfBirth: user?.dateOfBirth || "",
    address: user?.address || "",
    status: user?.status || "Active",
    role: user?.role || "Student",
    avatar: user?.avatar || "",
    qrCode: user?.qrCode || "",
  };
  notify();
};

let cachedReservations: ReservationBook[] = [];
let cachedHistory: ReservationBook[] = [];
let cachedNotifications: NotificationItem[] = [];

export const deduplicateNotifications = (list: NotificationItem[]): NotificationItem[] => {
  if (!Array.isArray(list)) return [];
  const seenContentKeys = new Set<string>();
  const seenIds = new Set<string>();
  const result: NotificationItem[] = [];

  for (const item of list) {
    if (!item) continue;
    const title = (item.title || "").trim();
    const body = (item.body || "").trim();

    // 1. Purge corrupted notifications containing "undefined"
    if (body.toLowerCase().includes("undefined") || title.toLowerCase().includes("undefined")) {
      continue;
    }

    // 2. Strict content deduplication: normalize title and body
    const contentKey = `${title.toLowerCase()}|||${body.toLowerCase()}`;
    const idKey = item.id ? String(item.id).trim().toLowerCase() : "";

    if (idKey && seenIds.has(idKey)) {
      continue;
    }
    if (seenContentKeys.has(contentKey)) {
      continue;
    }

    if (idKey) seenIds.add(idKey);
    seenContentKeys.add(contentKey);
    result.push(item);
  }

  return result;
};

let cachedAnnouncements: AnnouncementItem[] = [];
export const clearedNotificationKeys = new Set<string>();

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
    const userStr = await AsyncStorage.getItem("CURRENT_USER");
    let activeStudentId = "";
    let activeEmail = "";

    if (userStr) {
      try {
        const parsedUser = JSON.parse(userStr);
        if (parsedUser) {
          activeStudentId = parsedUser.studentId || parsedUser.idNumber || "";
          activeEmail = parsedUser.email || "";

          cachedProfile = {
            ...DEFAULT_PROFILE,
            name: parsedUser.fullName || parsedUser.name || "",
            email: activeEmail,
            studentId: activeStudentId,
            department: parsedUser.department || "WNU STI",
            course: parsedUser.course || "General Program",
            yearLevel: parsedUser.yearLevel || parsedUser.year_level || "",
            yearlevel: parsedUser.yearLevel || parsedUser.yearlevel || "",
            section: parsedUser.section || "",
            phone: parsedUser.phone || "",
            dateOfBirth: parsedUser.dateOfBirth || "",
            address: parsedUser.address || "",
            status: parsedUser.status || "Active",
            role: parsedUser.role || "Student",
            avatar: parsedUser.avatar || "",
            qrCode: parsedUser.qrCode || "",
          };
        }
      } catch (err) {
        console.log("Error parsing CURRENT_USER:", err);
      }
    }

    const profileStr = await AsyncStorage.getItem("STUDENT_PROFILE");
    if (profileStr) {
      try {
        const parsedProfile = JSON.parse(profileStr);
        const profileId = parsedProfile.studentId || "";
        const profileEmail = parsedProfile.email || "";
        const matchesActiveUser = !activeStudentId || profileId === activeStudentId || profileEmail === activeEmail;

        if (matchesActiveUser) {
          cachedProfile = {
            ...cachedProfile,
            ...parsedProfile,
            avatar: parsedProfile.avatar || cachedProfile.avatar || "",
          };
        } else {
          // Stale profile belonging to an older account: discard it
          await AsyncStorage.removeItem("STUDENT_PROFILE");
        }
      } catch (err) {
        console.log("Error parsing STUDENT_PROFILE:", err);
      }
    }

    if (cachedProfile.studentId) {
      socketService.joinUserRoom(cachedProfile.studentId);
    }

    const reservationsStr = await AsyncStorage.getItem("STUDENT_RESERVATIONS");
    if (reservationsStr) {
      cachedReservations = JSON.parse(reservationsStr);
    }

    const historyStr = await AsyncStorage.getItem("STUDENT_HISTORY");
    if (historyStr) {
      cachedHistory = JSON.parse(historyStr);
    }

    // Clean up any stale "Upcoming" status on pending borrow items
    cachedReservations = cachedReservations.map(item => {
      if (item.action === 'Borrow' && item.status === 'Upcoming') {
        return { ...item, status: 'Pending' };
      }
      return item;
    });
    cachedHistory = cachedHistory.map(item => {
      if (item.action === 'Borrow' && item.status === 'Upcoming') {
        return { ...item, status: 'Pending' };
      }
      return item;
    });

    const notificationsStr = await AsyncStorage.getItem("STUDENT_NOTIFICATIONS");
    if (notificationsStr) {
      const parsed = JSON.parse(notificationsStr);
      cachedNotifications = deduplicateNotifications(parsed);
      AsyncStorage.setItem("STUDENT_NOTIFICATIONS", JSON.stringify(cachedNotifications)).catch(() => {});
    }

    const clearedKeysStr = await AsyncStorage.getItem("CLEARED_NOTIFICATION_KEYS");
    if (clearedKeysStr) {
      try {
        const parsedCleared = JSON.parse(clearedKeysStr);
        if (Array.isArray(parsedCleared)) {
          parsedCleared.forEach((k: string) => clearedNotificationKeys.add(k));
        }
      } catch (err) {
        console.log("Error parsing CLEARED_NOTIFICATION_KEYS:", err);
      }
    }

    const announcementsStr = await AsyncStorage.getItem("STUDENT_ANNOUNCEMENTS");
    if (announcementsStr) {
      cachedAnnouncements = JSON.parse(announcementsStr);
    }

    const settingsStr = await AsyncStorage.getItem("SYSTEM_SETTINGS");
    if (settingsStr) {
      try {
        const parsed = JSON.parse(settingsStr);
        if (parsed) {
          cachedSystemSettings = {
            ...DEFAULT_SYSTEM_SETTINGS,
            ...parsed,
            borrowLimit: Number(parsed.borrowLimit ?? parsed.borrow_limit ?? 5),
            borrowDurationDays: Number(parsed.borrowDurationDays ?? parsed.borrow_duration_days ?? 7),
          };
        }
      } catch (err) {
        console.warn("Error parsing SYSTEM_SETTINGS from storage:", err);
      }
    }

    notify();
  } catch (error) {
    console.log("Error loading store cache from storage:", error);
  }
};

loadCacheFromStorage();

// Real-time global settings updates
socketService.subscribeToSettings((settings) => {
  if (settings) {
    updateCachedSystemSettings(settings);
  }
});

// Real-time reservation copy availability listener
socketService.subscribeToTransactionDecided((data) => {
  void syncTransactionsWithBackend(true);

  if (data?.event_type === "RESERVATION_COPY_AVAILABLE" || (data?.title && data.title.includes("Available"))) {
    const bookTitle = data.bookData?.title || data.resourceTitle || data.title || "your reserved book";
    const stableId = `avail-socket-${data.entity_id || data.id || bookTitle}`;
    const notifTitle = "Reserved Book Available";
    const notifBody = data.message || `Good news! A copy of '${bookTitle}' is now available for borrowing.`;
    const contentKey = `${notifTitle.toLowerCase()}|||${notifBody.toLowerCase()}`;

    // Avoid duplicate socket notification if already added
    const exists = cachedNotifications.some(n => n.id === stableId || `${n.title.toLowerCase()}|||${n.body.toLowerCase()}` === contentKey);
    if (!exists) {
      const newNotif: NotificationItem = {
        id: stableId,
        title: notifTitle,
        body: notifBody,
        timestamp: "Just now",
        read: false,
        type: "reservation",
        bookData: data.bookData || {
          title: bookTitle,
          available: "true",
        },
      };
      cachedNotifications.unshift(newNotif);
      cachedNotifications = deduplicateNotifications(cachedNotifications);
      AsyncStorage.setItem("STUDENT_NOTIFICATIONS", JSON.stringify(cachedNotifications)).catch(() => {});
      void syncTransactionsWithBackend(true);
      notify();
    }
  } else if ((data?.type === "Reservation" || data?.action === "Reserve") && data?.status === "Approved") {
    const bookTitle = data.resourceTitle || data.title || "your reserved book";
    const stableId = `res-approved-${data.id || bookTitle}`;
    const notifTitle = "Reservation Approved";
    const notifBody = `Your reservation for '${bookTitle}' has been approved by the library and added to your Library Card.`;
    const exists = cachedNotifications.some(n => n.id === stableId);
    if (!exists) {
      const newNotif: NotificationItem = {
        id: stableId,
        title: notifTitle,
        body: notifBody,
        timestamp: "Just now",
        read: false,
        type: "reservation",
      };
      cachedNotifications.unshift(newNotif);
      cachedNotifications = deduplicateNotifications(cachedNotifications);
      AsyncStorage.setItem("STUDENT_NOTIFICATIONS", JSON.stringify(cachedNotifications)).catch(() => {});
      notify();
    }
  }
});

// Real-time announcement published listener
socketService.subscribeToAnnouncementPublished((data) => {
  void syncAnnouncementsWithBackend(true);
  if (data && data.title) {
    const annId = `ann-${data.id || data.title}`;
    const notifTitle = `📢 Announcement: ${data.title}`;
    const notifBody = data.content || "A new library announcement has been posted.";
    const contentKey = `${notifTitle.toLowerCase()}|||${notifBody.toLowerCase()}`;

    const exists = cachedNotifications.some((n) => n.id === annId || `${n.title.toLowerCase()}|||${n.body.toLowerCase()}` === contentKey);
    if (!exists) {
      const newNotif: NotificationItem = {
        id: annId,
        title: notifTitle,
        body: notifBody,
        timestamp: "Just now",
        read: false,
        type: "announcement",
      };
      cachedNotifications.unshift(newNotif);
      cachedNotifications = deduplicateNotifications(cachedNotifications);
      AsyncStorage.setItem("STUDENT_NOTIFICATIONS", JSON.stringify(cachedNotifications)).catch(() => {});
      notify();
    }
  }
});

// Real-time announcement deleted listener: immediately removes announcement and its notification across student dashboards
socketService.subscribeToAnnouncementDeleted((data) => {
  const deletedId = data?.id || data?.announcementId;
  if (deletedId) {
    cachedAnnouncements = cachedAnnouncements.filter(
      (a) => a.id !== deletedId && String(a.id) !== String(deletedId)
    );
    AsyncStorage.setItem("STUDENT_ANNOUNCEMENTS", JSON.stringify(cachedAnnouncements)).catch(() => {});
    cachedNotifications = cachedNotifications.filter(
      (n) => n.id !== `ann-${deletedId}` && n.id !== deletedId && (n as any).announcementId !== deletedId
    );
    AsyncStorage.setItem("STUDENT_NOTIFICATIONS", JSON.stringify(cachedNotifications)).catch(() => {});
    notify();
  }
  void syncAnnouncementsWithBackend(true);
});

// Real-time book returned listener: marks book as returned in history and updates library card in real-time
socketService.subscribeToReturn((data) => {
  const returnedId = data?.id || data?.transactionId || data?.bookId;
  let changed = false;

  if (returnedId) {
    cachedHistory = cachedHistory.map((item) => {
      if (item.id === returnedId || String(item.id).toLowerCase() === String(returnedId).toLowerCase()) {
        changed = true;
        return {
          ...item,
          status: "Completed",
          isReturned: true,
          date: "Returned",
          returnDate: data?.returnedAt ? new Date(data.returnedAt).toISOString().split('T')[0] : (item.returnDate || new Date().toISOString().split('T')[0]),
        };
      }
      return item;
    });

    const prevReservationsLen = cachedReservations.length;
    cachedReservations = cachedReservations.filter((item) => item.id !== returnedId && String(item.id).toLowerCase() !== String(returnedId).toLowerCase());
    if (prevReservationsLen !== cachedReservations.length) {
      changed = true;
    }
  }

  if (changed) {
    AsyncStorage.setItem("STUDENT_HISTORY", JSON.stringify(cachedHistory)).catch(() => {});
    AsyncStorage.setItem("STUDENT_RESERVATIONS", JSON.stringify(cachedReservations)).catch(() => {});
    notify();
  }

  void syncTransactionsWithBackend(true);
});

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
        name: dbUser.name || dbUser.fullName || cachedProfile.name || "Student",
        email: dbUser.email || cachedProfile.email || "",
        studentId: dbUser.idNumber || dbUser.id_number || dbUser.studentId || cachedProfile.studentId || "",
        department: dbUser.department || cachedProfile.department || "WNU STI",
        course: dbUser.course || cachedProfile.course || "General Program",
        yearLevel: dbUser.yearLevel || dbUser.year_level || cachedProfile.yearLevel,
        yearlevel: dbUser.yearLevel ? (dbUser.yearLevel.includes("Year") ? dbUser.yearLevel : `${dbUser.yearLevel} Year`) : cachedProfile.yearlevel,
        section: dbUser.section || cachedProfile.section,
        status: dbUser.status || cachedProfile.status || "Active",
        role: dbUser.role || cachedProfile.role || "Student",
        phone: dbUser.phone || cachedProfile.phone,
        dateOfBirth: dbUser.dateOfBirth || cachedProfile.dateOfBirth,
        address: dbUser.address || cachedProfile.address,
        avatar: dbUser.avatar || "",
        qrCode: dbUser.qrCode || cachedProfile.qrCode || "",
      };

      await AsyncStorage.setItem("STUDENT_PROFILE", JSON.stringify(cachedProfile));
      if (cachedProfile.studentId) {
        socketService.joinUserRoom(cachedProfile.studentId);
      }
      notify();
    }
  } catch (error) {
    console.log("Error syncing profile with backend:", error);
  }
};

export const formatBorrowDateTime = (dateStr?: string | Date) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const ymd = d.toISOString().split("T")[0];
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
    return `${ymd} ${time}`;
  } catch {
    return String(dateStr);
  }
};

export const parseDateOnly = (dateStr?: string | Date | null): { year: number; month: number; day: number } | null => {
  if (!dateStr) return null;
  if (typeof dateStr === "string") {
    const trimmed = dateStr.trim();
    if (!trimmed || trimmed.toLowerCase() === "returned" || trimmed.toLowerCase() === "pending" || trimmed.toLowerCase() === "reservation") {
      return null;
    }
    const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      return {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10) - 1,
        day: parseInt(match[3], 10),
      };
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
  };
};

export const isDueToReturn = (dateStr?: string | Date | null): boolean => {
  const parsed = parseDateOnly(dateStr);
  if (!parsed) return false;
  const now = new Date();
  const dueDayStart = new Date(parsed.year, parsed.month, parsed.day, 0, 0, 0, 0).getTime();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  // Returns true if the due date is today or in the past (overdue)
  return dueDayStart <= todayStart;
};

export const isDateToday = (dateStr?: string | Date | null): boolean => {
  const parsed = parseDateOnly(dateStr);
  if (!parsed) return false;
  const now = new Date();
  return now.getFullYear() === parsed.year && now.getMonth() === parsed.month && now.getDate() === parsed.day;
};

export const formatDateOnly = (dateStr?: string | Date | null): string => {
  const parsed = parseDateOnly(dateStr);
  if (!parsed) return String(dateStr || "");
  const m = String(parsed.month + 1).padStart(2, "0");
  const d = String(parsed.day).padStart(2, "0");
  return `${parsed.year}-${m}-${d}`;
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
        const isTxReturned = tx.status === 'Returned' || tx.status === 'Completed';
        const isTxApproved = tx.status === 'Approved' || tx.status === 'On Loan';
        const isTxPending = tx.status === 'Pending';
        const isTxPickedUp = !isTxPending && Boolean(tx.pickedUpAt || tx.picked_up_at || tx.isPickedUp);
        
        let displayStatus = isTxPending ? "Pending" : "Upcoming";
        if (isTxReturned) {
          displayStatus = "Completed";
        } else if (tx.status === 'Declined') {
          displayStatus = "Declined";
        } else if (isTxPending) {
          displayStatus = "Pending";
        } else if (isTxPickedUp) {
          displayStatus = "Picked Up";
        } else if (tx.type === 'Reservation') {
          displayStatus = tx.status === 'Approved' ? 'Approved' : (tx.status === 'Declined' ? 'Declined' : 'Pending');
        } else if (isTxApproved) {
          displayStatus = "Approved";
        }

        const borrowDateTime = tx.pickedUpAt
          ? formatBorrowDateTime(tx.pickedUpAt)
          : (tx.requestedAt
              ? formatBorrowDateTime(tx.requestedAt)
              : (tx.requested_at
                  ? formatBorrowDateTime(tx.requested_at)
                  : (tx.borrowDate || (tx.date && tx.date !== 'Returned' ? tx.date : undefined))));

        const returnDateTime = tx.returnedAt
          ? new Date(tx.returnedAt).toISOString().split('T')[0]
          : (isTxReturned && tx.decidedAt
              ? new Date(tx.decidedAt).toISOString().split('T')[0]
              : (tx.dueDate ? new Date(tx.dueDate).toISOString().split('T')[0] : undefined));

        const dueDateTime = tx.dueDate ? new Date(tx.dueDate).toISOString().split('T')[0] : undefined;

        return {
          id: tx.id,
          studentId: tx.studentId || tx.student_id || undefined,
          studentName: tx.studentName || tx.student_name || undefined,
          isbn: tx.isbn || undefined,
          copies: tx.copies ? Number(tx.copies) : undefined,
          title: tx.title || tx.resourceTitle || "Unknown Book",
          author: tx.author || "Unknown Author",
          description: tx.description || "",
          year: tx.year || "2024",
          pages: tx.pages || 320,
          language: tx.language || "EN",
          category: tx.category || "CS",
          date: isTxReturned ? "Returned" : (dueDateTime || 'Pending'),
          dateReserved: borrowDateTime,
          borrowDate: borrowDateTime,
          status: displayStatus,
          isReturned: isTxReturned,
          pickedUpAt: tx.pickedUpAt || tx.picked_up_at || undefined,
          isPickedUp: isTxPickedUp,
          pickupDate: borrowDateTime,
          returnDate: returnDateTime,
          dueDate: dueDateTime,
          queuePosition: tx.queuePosition ? String(tx.queuePosition) : undefined,
          estimatedWait: tx.estimatedWait || undefined,
          available: String(tx.available === "Available" || tx.available === "true" || tx.available === true),
          shelf: tx.shelf || undefined,
          action: tx.type === 'Reservation' ? 'Reserve' : 'Borrow',
          availableAt: tx.availableAt || undefined,
          expiresAt: tx.expiresAt || undefined,
          claimDeadlineRemainingSeconds: typeof tx.claimDeadlineRemainingSeconds === 'number' ? tx.claimDeadlineRemainingSeconds : undefined,
        };
      });

      // Deduplicate mappedList by transaction ID
      const uniqueMappedList: ReservationBook[] = [];
      const seenTxIds = new Set<string>();
      for (const item of mappedList) {
        if (!seenTxIds.has(item.id)) {
          seenTxIds.add(item.id);
          uniqueMappedList.push(item);
        }
      }

      // Filter active (non-returned/declined) reservations/borrows for getReservations/getUpcomingReservations
      cachedReservations = uniqueMappedList.filter(item => item.status !== 'Completed' && item.status !== 'Declined');
      cachedHistory = uniqueMappedList;

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
  return cachedReservations.filter((item) => item.status === "Approved" || item.status === "Picked Up" || item.status === "On Loan");
};

// Returns complete library card records (active borrowed books, active reservations, and returned history) so books never disappear
export const getLibraryCardHistory = (): ReservationBook[] => {
  syncTransactionsWithBackend();
  const seenIds = new Set<string>();
  const list: ReservationBook[] = [];

  const processItem = (item: ReservationBook) => {
    if (!item || !item.id || seenIds.has(item.id)) return;
    if (item.status === 'Declined' || item.status === 'Cancelled') return;

    const isReservation =
      item.action === 'Reserve' ||
      (item as any).type === 'Reservation' ||
      item.status === 'Reserved' ||
      item.status === 'Reservation';

    if (isReservation) {
      // Active reservations (Pending, Waitlisted, Reserved, Approved) belong on the library card in Violet
      if (item.status === 'Pending' || item.status === 'Waitlisted' || item.status === 'Reserved' || item.status === 'Approved') {
        seenIds.add(item.id);
        list.push(item);
      }
      return;
    }

    // For Borrow records:
    if (item.status === 'Pending' || item.status === 'Waitlisted' || item.status === 'Upcoming') {
      // Pending borrow requests waiting for circulation desk pickup verification do not belong on card ledger yet
      return;
    }

    const isApprovedOrCompletedBorrow =
      (item.action === 'Borrow' || (item as any).type === 'Borrow' || (item as any).type === 'Borrowing') &&
      (item.status === 'Approved' ||
       item.status === 'Picked Up' ||
       item.status === 'On Loan' ||
       item.status === 'Completed' ||
       item.status === 'Returned' ||
       item.status === 'Due to Return' ||
       item.status === 'Overdue' ||
       item.status === 'Due' ||
       item.status === 'Active' ||
       item.status === 'Active Loan' ||
       item.isReturned === true ||
       item.date === 'Returned');

    if (isApprovedOrCompletedBorrow) {
      seenIds.add(item.id);
      list.push(item);
    }
  };

  // 1. All records from cachedHistory
  for (const item of cachedHistory) {
    processItem(item);
  }

  // 2. Active records in cachedReservations
  for (const item of cachedReservations) {
    processItem(item);
  }

  return list;
};

// ── Global Circulation & Policy Settings ─────────────────────────────────────
let lastSettingsFetchTime = 0;
export const syncSystemSettingsWithBackend = async (force = false): Promise<SystemSettings> => {
  const now = Date.now();
  if (!force && now - lastSettingsFetchTime < FETCH_COOLDOWN_MS) {
    return cachedSystemSettings;
  }
  lastSettingsFetchTime = now;

  try {
    const headers = await getAuthHeaders();
    let res: any = null;
    try {
      res = await axios.get(`${API_URL}/api/student/settings`, { ...headers, timeout: 5000 });
    } catch {
      try {
        res = await axios.get(`${API_URL}/api/settings`, { timeout: 5000 });
      } catch {
        res = null;
      }
    }

    const data = res?.data?.settings || res?.data;
    if (data) {
      cachedSystemSettings = {
        ...cachedSystemSettings,
        borrowLimit: Number(data.borrowLimit ?? data.borrow_limit ?? 5),
        borrowDurationDays: Number(data.borrowDurationDays ?? data.borrow_duration_days ?? 7),
        aiStrictMode: data.aiStrictMode ?? data.ai_strict_mode ?? true,
        allowAdminTransactionControl: data.allowAdminTransactionControl ?? false,
        notificationsEnabled: data.notificationsEnabled ?? true,
      };
      await AsyncStorage.setItem("SYSTEM_SETTINGS", JSON.stringify(cachedSystemSettings));
      notify();
    }
  } catch (err) {
    // Retain cached settings
  }
  return cachedSystemSettings;
};

export const getSystemSettings = (): SystemSettings => {
  void syncSystemSettingsWithBackend();
  return cachedSystemSettings;
};

export const updateCachedSystemSettings = (updates: Partial<SystemSettings>) => {
  cachedSystemSettings = {
    ...cachedSystemSettings,
    ...updates,
    borrowLimit: Number(updates.borrowLimit ?? cachedSystemSettings.borrowLimit ?? 5),
    borrowDurationDays: Number(updates.borrowDurationDays ?? cachedSystemSettings.borrowDurationDays ?? 7),
  };
  AsyncStorage.setItem("SYSTEM_SETTINGS", JSON.stringify(cachedSystemSettings)).catch(() => {});
  notify();
};

// Helper to normalize student IDs for safe cross-matching
const normalizeStudentId = (id?: string) => (id || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

// Returns the student's current active borrowed books count (including due/overdue loans and pending borrow requests)
export const getActiveBorrowCount = (targetStudentId?: string): number => {
  syncTransactionsWithBackend();
  const libraryCardList = getLibraryCardHistory();
  const allHistory = cachedHistory || [];
  const allReservations = cachedReservations || [];

  const seenKeys = new Set<string>();
  let count = 0;
  const normalizedTarget = normalizeStudentId(targetStudentId);

  const checkItem = (item: any) => {
    if (!item) return;

    if (normalizedTarget) {
      const itemStudentId = normalizeStudentId(item.studentId || item.student_id);
      // Only filter out if the item has an explicit student ID and it distinctly differs from the target
      if (itemStudentId && itemStudentId !== normalizedTarget) {
        return;
      }
    }

    const key = item.id ? `id:${item.id}` : `${item.title || ''}-${item.isbn || ''}`;
    if (seenKeys.has(key)) return;

    const isReturned = !!(
      item.isReturned === true ||
      item.status === 'Completed' ||
      item.status === 'Returned' ||
      item.date === 'Returned' ||
      item.returnedAt
    );
    if (isReturned) return;

    const isDeclined = item.status === 'Declined' || item.status === 'Cancelled' || item.status === 'Rejected';
    if (isDeclined) return;

    const isReservation = !!(
      item.action === 'Reserve' ||
      item.type === 'Reservation' ||
      item.status === 'Reserved' ||
      item.status === 'Reservation' ||
      item.dueReturnDate === 'Reservation' ||
      item.status === 'Waitlisted'
    );
    if (isReservation) return;

    const isBorrowType =
      item.action === 'Borrow' ||
      item.type === 'Borrow' ||
      item.type === 'Borrowing' ||
      (!item.action && !item.type);

    if (isBorrowType) {
      seenKeys.add(key);
      count++;
    }
  };

  libraryCardList.forEach(checkItem);
  allHistory.forEach(checkItem);
  allReservations.forEach(checkItem);

  return count;
};

// Returns list of active borrowed books that are currently due or overdue for return
export const getOverdueBooks = (targetStudentId?: string): ReservationBook[] => {
  syncTransactionsWithBackend();
  const libraryCardList = getLibraryCardHistory();
  const allHistory = cachedHistory || [];
  const allReservations = cachedReservations || [];

  const seenKeys = new Set<string>();
  const overdueList: ReservationBook[] = [];
  const normalizedTarget = normalizeStudentId(targetStudentId);

  const checkItem = (item: any) => {
    if (!item) return;

    if (normalizedTarget) {
      const itemStudentId = normalizeStudentId(item.studentId || item.student_id);
      if (itemStudentId && itemStudentId !== normalizedTarget) {
        return;
      }
    }

    const key = item.id ? `id:${item.id}` : `${item.title || ''}-${item.isbn || ''}`;
    if (seenKeys.has(key)) return;

    const isReturned = !!(
      item.isReturned === true ||
      item.status === 'Completed' ||
      item.status === 'Returned' ||
      item.date === 'Returned' ||
      item.returnedAt
    );
    if (isReturned) return;

    const isDeclined = item.status === 'Declined' || item.status === 'Cancelled' || item.status === 'Rejected';
    if (isDeclined) return;

    const isReservation = !!(
      item.action === 'Reserve' ||
      item.type === 'Reservation' ||
      item.status === 'Reserved' ||
      item.status === 'Reservation' ||
      item.dueReturnDate === 'Reservation' ||
      item.status === 'Waitlisted'
    );
    if (isReservation) return;

    const isBorrowType =
      item.action === 'Borrow' ||
      item.type === 'Borrow' ||
      item.type === 'Borrowing' ||
      (!item.action && !item.type);

    if (isBorrowType) {
      seenKeys.add(key);
      const dueVal = item.dueDate || item.returnDate || (item.date !== 'Returned' ? item.date : undefined);
      if (
        item.status === 'Due to Return' ||
        item.status === 'Overdue' ||
        item.status === 'Due' ||
        (dueVal && isDueToReturn(dueVal))
      ) {
        overdueList.push(item);
      }
    }
  };

  libraryCardList.forEach(checkItem);
  allHistory.forEach(checkItem);
  allReservations.forEach(checkItem);

  return overdueList;
};

// Mutations
export const addReservation = async (reservation: any) => {
  if (reservation.action === 'Borrow') {
    const currentBorrows = getActiveBorrowCount(reservation.studentId);
    const limit = cachedSystemSettings.borrowLimit || 5;
    if (currentBorrows >= limit) {
      throw new Error(`Borrow limit reached. You currently have ${currentBorrows} borrowed books (maximum allowed is ${limit}). Please return a book to the library before borrowing another.`);
    }

    const overdueList = getOverdueBooks(reservation.studentId);
    if (overdueList.length > 0) {
      const titles = overdueList.map(b => `'${b.title}'`).slice(0, 2).join(', ');
      throw new Error(`Overdue return required. You have ${overdueList.length} book(s) due or overdue for return (${titles}). Please return overdue books before borrowing new titles.`);
    }
  }

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
        dueDate: (reservation.returnDate && reservation.returnDate !== "Not set")
          ? reservation.returnDate
          : (reservation.date && reservation.date !== "Not set")
          ? reservation.date
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        studentIdImage: reservation.studentIDImage || null,
      },
      headers
    );

    const createdTx = response.data?.transaction;
    const realTxId = createdTx?.id || reservation.id;
    if (createdTx?.id) {
      reservation.id = createdTx.id;
      const rIdx = cachedReservations.findIndex((r) => r.id === reservation.id || r.title === reservation.title);
      if (rIdx !== -1) cachedReservations[rIdx].id = createdTx.id;
      const hIdx = cachedHistory.findIndex((h) => h.id === reservation.id || h.title === reservation.title);
      if (hIdx !== -1) cachedHistory[hIdx].id = createdTx.id;
    }

    // Emit real-time WebSocket event for Circulation Librarian
    socketService.emitBorrowRequest({
      id: realTxId,
      transactionId: realTxId,
      title: reservation.title,
      resourceTitle: reservation.title,
      author: reservation.author,
      studentName: reservation.studentName || cachedProfile.name,
      studentId: reservation.studentId || cachedProfile.studentId,
      department: reservation.department || cachedProfile.department,
      action: reservation.action,
      type: reservation.action === 'Borrow' ? 'Borrowing' : 'Reservation',
      requestedAt: createdTx?.requestedAt || new Date().toISOString(),
      dueDate: createdTx?.dueDate || reservation.dueDate,
    });

    if (response.data?.isDuplicate) {
      // Backend idempotent notice: pending request already exists
      Alert.alert(
        "Request Active",
        response.data.message || "You already have an active pending request for this book. The circulation librarian is currently reviewing it."
      );
      await syncTransactionsWithBackend(true);
    } else if (response.status === 201 || response.status === 200) {
      await syncTransactionsWithBackend(true);
    }
  } catch (error: any) {
    if (error.response?.status === 409) {
      // 409 Conflict: request is already pending on the backend
      console.warn("Backend 409 duplicate request:", error.response?.data?.message);
      Alert.alert(
        "Request Active",
        error.response?.data?.message || "You already have an active pending request for this book. The circulation librarian is currently reviewing it."
      );
      await syncTransactionsWithBackend(true);
    } else {
      console.warn("Transaction submission issue:", error.message || error);
      // Roll back local cache on unexpected network failure
      cachedReservations = cachedReservations.filter((item) => item.id !== reservation.id);
      cachedHistory = cachedHistory.filter((item) => item.id !== reservation.id);
      notify();

      const msg = error.response?.data?.message || "Failed to submit request. Please check your network connection.";
      Alert.alert("Request Failed", msg);
    }
  }

  return cachedReservations;
};

export const cancelReservation = async (id: string) => {
  // Optimistic UI updates - save previous state for rollback
  const previousReservations = [...cachedReservations];
  const previousHistory = [...cachedHistory];

  const target = cachedReservations.find((item) => item.id === id);

  cachedReservations = cachedReservations.filter((item) => item.id !== id);
  cachedHistory = cachedHistory.map((item) =>
    item.id === id ? { ...item, status: 'Cancelled', date: 'Cancelled' } : item
  );
  notify();

  try {
    const headers = await getAuthHeaders();
    // Call backend student cancellation endpoint
    const response = await axios.post(
      `${API_URL}/api/student/reservations/${id}/cancel`,
      {},
      headers
    );

    // Emit real-time WebSocket event from mobile client
    socketService.emitReservationCancelled({
      id,
      title: target?.title || "Book",
      resourceTitle: target?.title || "Book",
      studentName: cachedProfile.name,
      studentId: cachedProfile.studentId,
      status: "Cancelled",
    });

    if (response.status === 200) {
      await syncTransactionsWithBackend(true);
    }
  } catch (error: any) {
    console.warn("Error cancelling reservation on backend:", error.message || error);
    if (error.response?.data?.message) {
      Alert.alert("Cancellation Notice", error.response.data.message);
    }
    // Re-sync with backend to ensure consistency
    await syncTransactionsWithBackend(true);
  }

  return cachedReservations;
};

export const removeReservation = async (id: string) => {
  const target = cachedReservations.find((item) => item.id === id);
  if (target && (target.status === "Pending" || !target.status)) {
    return cancelReservation(id);
  }

  // Otherwise handle as return of active loan
  const previousReservations = [...cachedReservations];
  const previousHistory = [...cachedHistory];

  cachedReservations = cachedReservations.filter((item) => item.id !== id);
  cachedHistory = cachedHistory.map((item) =>
    item.id === id ? { ...item, status: 'Completed', date: 'Returned' } : item
  );
  notify();

  try {
    const headers = await getAuthHeaders();
    const response = await axios.post(
      `${API_URL}/api/student/return/${id}`,
      {},
      headers
    );

    if (response.status === 200) {
      await syncTransactionsWithBackend(true);
    }
  } catch (error: any) {
    console.warn("Error cancelling/returning book on backend:", error.message || error);
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
          yearLevel: updatedProfile.yearLevel || updatedProfile.yearlevel,
          section: updatedProfile.section,
          avatar: updatedProfile.avatar,
        },
        headers
      );
    }
    await syncProfileWithBackend(true);
    return { success: true };
  } catch (error: any) {
    console.warn("Error saving profile to backend:", error.message || error);
    const serverMsg = error.response?.data?.message || "";

    // If there's an actual unique constraint conflict, alert the user
    if (error.response?.status === 400 || serverMsg.toLowerCase().includes("already in use")) {
      cachedProfile = previousProfile;
      await AsyncStorage.setItem("STUDENT_PROFILE", JSON.stringify(cachedProfile));
      notify();
      return { success: false, message: serverMsg || "Student ID or Email is already registered." };
    }

    // Otherwise, keep the updated local profile cache so the user can continue smoothly
    return { success: true };
  }
};

export const saveStudentProfile = updateStudentProfile;

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
            let title = tx.type === 'Reservation' ? 'Reservation Active' : 'Borrow Pending';
            let body = tx.type === 'Reservation'
              ? `You are on the reservation waitlist for '${tx.resourceTitle || tx.title || "Unknown Book"}'. You will be automatically notified once a copy becomes available.`
              : `Your borrow request for '${tx.resourceTitle || tx.title || "Unknown Book"}' is pending approval by the librarian.`;

            if (tx.type === 'Reservation') {
              if (tx.status === 'Approved' || tx.available === 'true' || tx.availableAt) {
                title = 'Reserved Book Ready';
                body = `Good news! '${tx.resourceTitle || tx.title || "Your reserved book"}' has been returned and is now available for you to borrow!`;
              } else if (tx.status === 'Cancelled') {
                title = 'Reservation Cancelled';
                body = `Your reservation for '${tx.resourceTitle || tx.title || "Unknown Book"}' has been cancelled.`;
              } else {
                title = 'Reservation Queued';
                body = `You are on the 1st-come 1st-served waitlist for '${tx.resourceTitle || tx.title || "Unknown Book"}'. You will be automatically notified once a copy is returned.`;
              }
            } else {
              if (tx.status === 'Approved') {
                title = 'Borrow Approved';
                body = `Your borrow request for '${tx.resourceTitle || tx.title || "Unknown Book"}' has been approved by the librarian.`;
              } else if (tx.status === 'Declined') {
                title = 'Borrow Declined';
                const reasonSuffix = tx.comment ? ` Reason: ${tx.comment}` : "";
                body = `Your borrow request for '${tx.resourceTitle || tx.title || "Unknown Book"}' was declined by the librarian.${reasonSuffix}`;
              } else if (tx.status === 'Returned') {
                title = 'Book Returned';
                body = `You have successfully returned '${tx.resourceTitle || tx.title || "Unknown Book"}'.`;
              }
            }

            const stableId = `tx-${tx.id}-${tx.status}`;
            const contentKey = `${title.toLowerCase()}|||${body.toLowerCase()}`;
            const alreadyExists = cachedNotifications.some(
              (n) => n.id === stableId || `${n.title.toLowerCase()}|||${n.body.toLowerCase()}` === contentKey
            );

            if (!alreadyExists) {
              const newNotif: NotificationItem = {
                id: stableId,
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
        }

        // Notify if a reserved book becomes available
        const isTxAvailable = tx.available === 'Available' || tx.available === 'true' || tx.available === true;
        if (tx.type === 'Reservation' && tx.status === 'Pending' && isTxAvailable) {
          const cacheKey = `${tx.id}-available`;
          if (!availCache[cacheKey]) {
            availCache[cacheKey] = true;
            availUpdated = true;

            const stableId = `avail-${tx.id}`;
            const notifTitle = "Reserved Book Available";
            const notifBody = `Good news! A copy of '${tx.resourceTitle || tx.title || "Unknown Book"}' is now available. Tap to borrow.`;
            const contentKey = `${notifTitle.toLowerCase()}|||${notifBody.toLowerCase()}`;

            const alreadyExists = cachedNotifications.some(
              (n) => n.id === stableId || `${n.title.toLowerCase()}|||${n.body.toLowerCase()}` === contentKey
            );

            if (!alreadyExists) {
              const newNotif: NotificationItem = {
                id: stableId,
                title: notifTitle,
                body: notifBody,
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

        // 3. Automated check: Notify if active borrowed book is due for return today or overdue
        const isTxReturnedOrDone = tx.status === 'Returned' || tx.status === 'Completed' || tx.status === 'Declined';
        const isTxBorrow = tx.type !== 'Reservation';
        if (isTxBorrow && !isTxReturnedOrDone && tx.dueDate) {
          if (isDueToReturn(tx.dueDate)) {
            const isToday = isDateToday(tx.dueDate);
            const dueDateStr = formatDateOnly(tx.dueDate);
            const bookTitle = tx.resourceTitle || tx.title || "Your borrowed book";

            const notifTitle = isToday ? "Book Due for Return" : "Book Overdue for Return";
            const notifBody = isToday
              ? `'${bookTitle}' is due for return today (${dueDateStr}). Please return it to the library to avoid overdue penalties.`
              : `'${bookTitle}' is overdue for return (was due on ${dueDateStr}). Please return it to the library immediately.`;

            const stableId = `due-${tx.id}-${dueDateStr}`;
            const contentKey = `${notifTitle.toLowerCase()}|||${notifBody.toLowerCase()}`;

            const alreadyExists = cachedNotifications.some(
              (n) => n.id === stableId || `${n.title.toLowerCase()}|||${n.body.toLowerCase()}` === contentKey
            );
            const wasCleared = clearedNotificationKeys.has(stableId) || clearedNotificationKeys.has(contentKey);

            if (!alreadyExists && !wasCleared) {
              const newNotif: NotificationItem = {
                id: stableId,
                title: notifTitle,
                body: notifBody,
                timestamp: "Just now",
                read: false,
                type: "reservation",
                bookData: {
                  id: tx.bookId || tx.isbn,
                  title: bookTitle,
                  author: tx.author,
                  description: tx.description || "Due for return.",
                  year: tx.year || "2024",
                  pages: tx.pages || "320",
                  language: tx.language || "EN",
                  category: tx.category || "CS",
                  available: "true",
                  shelf: tx.shelf || "Circulation Desk",
                },
              };
              cachedNotifications.unshift(newNotif);
              updated = true;
            }
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
        cachedNotifications = deduplicateNotifications(cachedNotifications);
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

          const stableId = `book-${book.id}`;
          const notifTitle = "New Added Book";
          const notifBody = `'${book.title}' by ${book.author} has been newly added to the catalog.`;
          const contentKey = `${notifTitle.toLowerCase()}|||${notifBody.toLowerCase()}`;

          const alreadyExists = cachedNotifications.some(
            (n) => n.id === stableId || `${n.title.toLowerCase()}|||${n.body.toLowerCase()}` === contentKey
          );

          if (!alreadyExists) {
            const newNotif: NotificationItem = {
              id: stableId,
              title: notifTitle,
              body: notifBody,
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
      }

      if (updated) {
        await AsyncStorage.setItem("NOTIFIED_BOOK_IDS", JSON.stringify(bookCache));
        cachedNotifications = deduplicateNotifications(cachedNotifications);
        await AsyncStorage.setItem("STUDENT_NOTIFICATIONS", JSON.stringify(cachedNotifications));
        notify();
      }
    }

  } catch (error) {
    console.log("Error syncing notifications with backend:", error);
  }
};

export const checkAndAddDueNotifications = () => {
  const candidateLoans = [...cachedReservations, ...cachedHistory];
  const seenTx = new Set<string>();
  let changed = false;

  for (const item of candidateLoans) {
    if (!item || !item.id || seenTx.has(item.id)) continue;
    seenTx.add(item.id);

    if (item.action === 'Reserve' || (item as any).type === 'Reservation') continue;
    if (item.status === 'Completed' || item.status === 'Declined' || item.isReturned || item.date === 'Returned') continue;

    const dueDateVal = item.dueDate || item.returnDate;
    if (dueDateVal && isDueToReturn(dueDateVal)) {
      const isToday = isDateToday(dueDateVal);
      const dueDateStr = formatDateOnly(dueDateVal);
      const bookTitle = item.title || "Your borrowed book";

      const notifTitle = isToday ? "Book Due for Return" : "Book Overdue for Return";
      const notifBody = isToday
        ? `'${bookTitle}' is due for return today (${dueDateStr}). Please return it to the library to avoid overdue penalties.`
        : `'${bookTitle}' is overdue for return (was due on ${dueDateStr}). Please return it to the library immediately.`;

      const stableId = `due-${item.id}-${dueDateStr}`;
      const contentKey = `${notifTitle.toLowerCase()}|||${notifBody.toLowerCase()}`;

      const alreadyExists = cachedNotifications.some(
        (n) => n.id === stableId || `${n.title.toLowerCase()}|||${n.body.toLowerCase()}` === contentKey
      );
      const wasCleared = clearedNotificationKeys.has(stableId) || clearedNotificationKeys.has(contentKey);

      if (!alreadyExists && !wasCleared) {
        const newNotif: NotificationItem = {
          id: stableId,
          title: notifTitle,
          body: notifBody,
          timestamp: "Just now",
          read: false,
          type: "reservation",
          bookData: {
            id: item.isbn || item.id,
            title: bookTitle,
            author: item.author,
            description: item.description || "Due for return.",
            year: item.year || "2024",
            pages: item.pages || "320",
            language: item.language || "EN",
            category: item.category || "CS",
            available: "true",
            shelf: item.shelf || "Circulation Desk",
          },
        };
        cachedNotifications.unshift(newNotif);
        changed = true;
      }
    }
  }

  if (changed) {
    cachedNotifications = deduplicateNotifications(cachedNotifications);
    AsyncStorage.setItem("STUDENT_NOTIFICATIONS", JSON.stringify(cachedNotifications)).catch(() => {});
    notify();
  }
};

export const getNotifications = () => {
  checkAndAddDueNotifications();
  syncNotifications();
  cachedNotifications = deduplicateNotifications(cachedNotifications);
  return cachedNotifications;
};

export const addNotification = async (item: NotificationItem) => {
  if (!item || !item.title || !item.body) return cachedNotifications;
  if (item.body.includes("undefined") || item.title.includes("undefined")) return cachedNotifications;

  const contentKey = `${item.title.trim().toLowerCase()}|||${item.body.trim().toLowerCase()}`;
  const alreadyExists = cachedNotifications.some(
    (n) => n.id === item.id || `${n.title.trim().toLowerCase()}|||${n.body.trim().toLowerCase()}` === contentKey
  );
  if (alreadyExists) {
    return cachedNotifications;
  }

  cachedNotifications.unshift(item);
  cachedNotifications = deduplicateNotifications(cachedNotifications);
  try {
    await AsyncStorage.setItem("STUDENT_NOTIFICATIONS", JSON.stringify(cachedNotifications));
  } catch (e) {
    console.log(e);
  }
  notify();
  return cachedNotifications;
};

export const clearNotifications = async () => {
  for (const n of cachedNotifications) {
    if (n.id) clearedNotificationKeys.add(n.id);
    const contentKey = `${(n.title || "").toLowerCase()}|||${(n.body || "").toLowerCase()}`;
    clearedNotificationKeys.add(contentKey);
  }
  cachedNotifications.length = 0;
  try {
    await AsyncStorage.removeItem("STUDENT_NOTIFICATIONS");
    await AsyncStorage.setItem("CLEARED_NOTIFICATION_KEYS", JSON.stringify(Array.from(clearedNotificationKeys)));
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
    if (queriesStr) {
      const parsed: string[] = JSON.parse(queriesStr);
      cachedSearchQueries = parsed.filter((q, idx) => {
        const qLower = q.toLowerCase();
        return !parsed.some((other, oIdx) => oIdx !== idx && other.toLowerCase().startsWith(qLower) && other.length > q.length);
      });
      AsyncStorage.setItem("SEARCH_QUERIES", JSON.stringify(cachedSearchQueries)).catch(() => {});
    }

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
  
  const trimmedLower = trimmed.toLowerCase();
  const cleaned = cachedSearchQueries.filter((q) => {
    const qLower = q.toLowerCase();
    if (qLower === trimmedLower) return false;
    // Prune partial sub-prefixes (e.g. if saving "Brich", remove "Br", "Bri", "Bric")
    if (trimmedLower.startsWith(qLower) && trimmedLower.length > qLower.length) return false;
    return true;
  });

  cachedSearchQueries = [
    trimmed,
    ...cleaned
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

export const removeSearchQuery = async (query: string) => {
  cachedSearchQueries = cachedSearchQueries.filter((q) => q.toLowerCase() !== query.toLowerCase());
  try {
    await AsyncStorage.setItem("SEARCH_QUERIES", JSON.stringify(cachedSearchQueries));
    notify();
  } catch (e) {
    console.log("Error removing search query:", e);
  }
};

export const getViewedBooksHistory = () => {
  return cachedViewedBooks;
};

export const removeViewedBookFromHistory = async (bookId: string) => {
  cachedViewedBooks = cachedViewedBooks.filter((b) => b.id !== bookId);
  try {
    await AsyncStorage.setItem("VIEWED_BOOKS_HISTORY", JSON.stringify(cachedViewedBooks));
    notify();
  } catch (e) {
    console.log("Error removing viewed book from history:", e);
  }
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
  cachedProfile = { ...DEFAULT_PROFILE };
  cachedViewedBooks = [];
  cachedSearchQueries = [];
  cachedFavorites = [];
  cachedReservations = [];
  cachedHistory = [];
  // Note: cachedNotifications and STUDENT_NOTIFICATIONS are deliberately preserved across logins
  // so student notifications never disappear automatically; they only clear when clicking Clear All.
  cachedAnnouncements = [];
  cachedLibraryPoints = 0;
  
  try {
    await AsyncStorage.removeItem("VIEWED_BOOKS_HISTORY");
    await AsyncStorage.removeItem("SEARCH_QUERIES");
    await AsyncStorage.removeItem("FAVORITE_BOOKS");
    await AsyncStorage.removeItem("STUDENT_RESERVATIONS");
    await AsyncStorage.removeItem("STUDENT_HISTORY");
    await AsyncStorage.removeItem("STUDENT_PROFILE");
    await AsyncStorage.removeItem("STUDENT_ANNOUNCEMENTS");
    await AsyncStorage.removeItem("LIBRARY_POINTS");
    notify();
  } catch (e) {
    console.log("Error clearing local cache:", e);
  }
};

// Subscribe to live Technical Librarian book creation events
socketService.subscribeToBookAdded((bookData: any) => {
  if (!bookData) return;
  addDynamicBook(bookData);

  const stableId = `book-added-${bookData.id || bookData.isbn || bookData.title || Date.now()}`;
  const notifTitle = "New Book Available!";
  const notifBody = `Technical Librarian added "${bookData.title || 'New Book'}" to the STI Library catalog.`;
  const contentKey = `${notifTitle.toLowerCase()}|||${notifBody.toLowerCase()}`;

  const alreadyExists = cachedNotifications.some(
    (n) => n.id === stableId || `${n.title.toLowerCase()}|||${n.body.toLowerCase()}` === contentKey
  );

  if (!alreadyExists) {
    const newNotif: NotificationItem = {
      id: stableId,
      title: notifTitle,
      body: notifBody,
      timestamp: "Just now",
      read: false,
      type: "general",
      bookData: bookData,
    };

    cachedNotifications.unshift(newNotif);
    cachedNotifications = deduplicateNotifications(cachedNotifications);
    AsyncStorage.setItem("STUDENT_NOTIFICATIONS", JSON.stringify(cachedNotifications)).catch(() => {});
    notify();
  }
});

// Subscribe to live Librarian Approval/Declined decision events
socketService.subscribeToTransactionDecided((incomingData: any) => {
  if (!incomingData) return;

  // 1. Unwrap envelope if wrapped (Backend sends { event_type, payload: transaction } or { transaction: ... })
  const txData = incomingData.payload || incomingData.transaction || incomingData;
  if (!txData || typeof txData !== "object") return;

  // 2. Validate status - NEVER create notifications for missing or "undefined" status
  const rawStatus = txData.status || incomingData.status;
  if (!rawStatus || rawStatus === "undefined" || typeof rawStatus !== "string") {
    return;
  }
  const status = rawStatus.trim();

  // 3. Target verification - MUST be targeted to the logged-in student or match local active items
  const currentStudentId = (cachedProfile.studentId || "").toLowerCase().trim();
  const currentStudentName = (cachedProfile.name || "").toLowerCase().trim();
  const targetStudentId = (txData.studentId || txData.student_id || incomingData.actor_id || incomingData.studentId || "")?.toLowerCase().trim();
  const targetStudentName = (txData.studentName || txData.student_name || incomingData.studentName || "")?.toLowerCase().trim();

  const txId = txData.id || txData._id || incomingData.entity_id;
  let title = txData.resourceTitle || txData.title;

  const localMatch = cachedReservations.find(
    (r) => (txId && r.id === txId) || (title && r.title && r.title.toLowerCase() === title.toLowerCase())
  );
  const historyMatch = cachedHistory.find(
    (h) => (txId && h.id === txId) || (title && h.title && h.title.toLowerCase() === title.toLowerCase())
  );

  const isTargetedToStudent =
    (targetStudentId && currentStudentId && targetStudentId === currentStudentId) ||
    (targetStudentName && currentStudentName && (targetStudentName.includes(currentStudentName) || currentStudentName.includes(targetStudentName)));

  // NEVER accept broadcast events from other students or system telemetry
  if (!isTargetedToStudent && !localMatch && !historyMatch) {
    return;
  }

  // Refine title if generic ("Book", "Loan Request Returned", etc.)
  if (!title || title === "Book" || title.toLowerCase().includes("loan request")) {
    title = localMatch?.title || historyMatch?.title || (title && !title.toLowerCase().includes("loan request") ? title : "Book");
  }

  const isPickedUp = status === "Picked Up" || Boolean(txData.pickedUpAt) || Boolean(txData.isPickedUp) || incomingData?.eventName === "transaction:picked-up" || txData?.action === "pickup";
  const isApproved = status === "Approved" && !isPickedUp;
  const isDeclined = status === "Declined";
  const isReturned = status === "Returned";
  const isDueReminder = incomingData?.event_type === "BOOK_DUE_REMINDER" || (incomingData?.title && incomingData.title.toLowerCase().includes("due"));
  const type = txData.type || (localMatch?.action === "Reserve" ? "Reservation" : localMatch?.action) || "Borrow";
  const isReservation = type === "Reservation" || type === "Reserve" || localMatch?.action === "Reserve";

  let notifTitle = `${type} Update`;
  let notifBody = `Your ${type.toLowerCase()} request for "${title}" has been updated to ${status}.`;

  if (isDueReminder) {
    const isToday = isDateToday(txData.dueDate);
    notifTitle = incomingData.title || (isToday ? "Book Due for Return" : "Book Overdue for Return");
    notifBody = incomingData.message || incomingData.body || `'${title}' is due for return today. Please return it to the library to avoid overdue penalties.`;
  } else if (isPickedUp) {
    notifTitle = `Book Picked Up`;
    const dueDateFormatted = txData.dueDate ? new Date(txData.dueDate).toLocaleDateString() : "7 days";
    notifBody = `You have picked up "${title}". Due return date: ${dueDateFormatted}. Happy reading!`;
  } else if (isReservation) {
    if (status === "Available" || status === "Ready" || txData.available === "true" || txData.available === true) {
      notifTitle = `Reserved Book Available`;
      notifBody = `Good news! "${title}" has been returned and is now available for you to borrow. Please visit the library to claim your reserved copy.`;
    } else if (status === "Expired") {
      notifTitle = `Reservation Expired`;
      notifBody = `Your reservation hold window for "${title}" has expired. The book has been passed to the next student in line.`;
    } else if (status === "Cancelled") {
      notifTitle = `Reservation Cancelled`;
      notifBody = `Your reservation for "${title}" has been cancelled.`;
    } else {
      notifTitle = `Reservation Queued`;
      notifBody = `You are on the 1st-come 1st-served waitlist for "${title}". You will be automatically notified when the book is returned and ready for pickup.`;
    }
  } else if (isApproved) {
    notifTitle = `${type} Approved`;
    notifBody = `Your ${type.toLowerCase()} request for "${title}" has been approved by the librarian. 24-hour pickup window is active.`;
  } else if (isDeclined) {
    notifTitle = `${type} Declined`;
    const commentPart = txData.comment ? ` Reason: ${txData.comment}` : "";
    notifBody = `Your ${type.toLowerCase()} request for "${title}" was declined by the librarian.${commentPart}`;
  } else if (isReturned) {
    notifTitle = `Book Returned`;
    notifBody = `You have successfully returned "${title}". Thank you!`;
  }

  // 4. Stable Deterministic ID
  const stableId = isDueReminder
    ? `due-${txId || title}-${formatDateOnly(txData.dueDate || new Date())}`
    : `tx-decided-${txId || title}-${isPickedUp ? "picked-up" : status.toLowerCase()}`;

  // 5. Strict deduplication check: avoid duplicate notifications
  const contentKey = `${notifTitle.toLowerCase()}|||${notifBody.toLowerCase()}`;
  const alreadyExists = cachedNotifications.some(
    (n) => n.id === stableId || `${n.title.toLowerCase()}|||${n.body.toLowerCase()}` === contentKey
  );
  const wasCleared = clearedNotificationKeys.has(stableId) || clearedNotificationKeys.has(contentKey);

  if (!alreadyExists && !wasCleared) {
    let receiptData: ReceiptData | undefined = undefined;
    if (isPickedUp) {
      const nowIso = new Date().toISOString();
      const formattedNow = formatBorrowDateTime(nowIso);
      const resolvedBorrowDate = txData.requestedAt
        ? formatBorrowDateTime(txData.requestedAt)
        : (txData.requested_at ? formatBorrowDateTime(txData.requested_at) : formattedNow);
      const resolvedDueDate = txData.dueDate
        ? (new Date(txData.dueDate).toLocaleDateString())
        : (txData.due_date ? new Date(txData.due_date).toLocaleDateString() : "7 days");
      const resolvedPickupDate = txData.pickedUpAt
        ? formatBorrowDateTime(txData.pickedUpAt)
        : formattedNow;

      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const receiptNo = `RCP-${Date.now().toString().slice(-6)}-${randomNum}`;
      const uniqueToken = `BH-RCPT-${txId || Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const qrPayload = JSON.stringify({
        receiptNumber: receiptNo,
        type: "BOOKHIVE_CIRCULATION_RECEIPT",
        title,
        isbn: txData.isbn || localMatch?.isbn || "N/A",
        studentName: txData.studentName || cachedProfile.name,
        studentId: txData.studentId || cachedProfile.studentId,
        borrowDate: resolvedBorrowDate,
        pickupDate: resolvedPickupDate,
        returnDate: resolvedDueDate,
        token: uniqueToken,
        verifiedBy: "BookHive Circulation Desk",
      });

      receiptData = {
        receiptNumber: receiptNo,
        transactionId: txId || undefined,
        bookTitle: title,
        author: txData.author || localMatch?.author || "Library Catalog",
        isbn: txData.isbn || localMatch?.isbn || "N/A",
        category: txData.department || localMatch?.category || "Circulation",
        studentName: txData.studentName || cachedProfile.name,
        studentId: txData.studentId || cachedProfile.studentId,
        department: txData.department || cachedProfile.department,
        borrowDate: resolvedBorrowDate,
        pickupDate: resolvedPickupDate,
        returnDate: resolvedDueDate,
        status: "Picked Up / Active Loan",
        qrPayload,
      };
    }

    const newNotif: NotificationItem = {
      id: stableId,
      title: notifTitle,
      body: notifBody,
      timestamp: "Just now",
      read: false,
      type: isPickedUp ? "general" : "reservation",
      bookData: {
        id: txData.bookId || txId || localMatch?.id,
        title: title,
        author: txData.author || localMatch?.author || "Author",
        category: txData.department || localMatch?.category || "Circulation",
        available: "true",
        shelf: txData.shelf || localMatch?.shelf || "Circulation Shelf",
      },
      receiptData,
    };

    cachedNotifications.unshift(newNotif);
    cachedNotifications = deduplicateNotifications(cachedNotifications);
    AsyncStorage.setItem("STUDENT_NOTIFICATIONS", JSON.stringify(cachedNotifications)).catch(() => {});
  }

  // Update reservations and history locally
  if (txId) {
    const nowIso = new Date().toISOString();
    const formattedNow = formatBorrowDateTime(nowIso);
    const resolvedBorrowDate = txData.requestedAt
      ? formatBorrowDateTime(txData.requestedAt)
      : (txData.requested_at ? formatBorrowDateTime(txData.requested_at) : formattedNow);
    const resolvedDueDate = txData.dueDate
      ? new Date(txData.dueDate).toISOString().split('T')[0]
      : (txData.due_date ? new Date(txData.due_date).toISOString().split('T')[0] : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    cachedReservations = cachedReservations.map((r) =>
      r.id === txId || (r.title && title && r.title.toLowerCase() === title.toLowerCase())
        ? {
            ...r,
            status: isPickedUp ? "Picked Up" : status,
            pickedUpAt: isPickedUp ? (txData.pickedUpAt || nowIso) : r.pickedUpAt,
            isPickedUp: isPickedUp || r.isPickedUp,
            pickupDate: isPickedUp ? (txData.pickedUpAt ? formatBorrowDateTime(txData.pickedUpAt) : "Today") : (r.pickupDate || resolvedBorrowDate),
            borrowDate: r.borrowDate || resolvedBorrowDate,
            dueDate: resolvedDueDate,
            returnDate: resolvedDueDate,
          }
        : r
    );
    if (isDeclined || isReturned) {
      cachedReservations = cachedReservations.filter((r) => r.id !== txId && (!title || r.title !== title));
    }

    const historyFound = cachedHistory.some((h) => h.id === txId || (h.title && title && h.title.toLowerCase() === title.toLowerCase()));
    if (historyFound) {
      cachedHistory = cachedHistory.map((h) =>
        h.id === txId || (h.title && title && h.title.toLowerCase() === title.toLowerCase())
          ? {
              ...h,
              status: status === "Returned" ? "Completed" : (isPickedUp ? "Picked Up" : status),
              isReturned: status === "Returned",
              pickedUpAt: isPickedUp ? (txData.pickedUpAt || nowIso) : h.pickedUpAt,
              isPickedUp: isPickedUp || h.isPickedUp,
              pickupDate: isPickedUp ? (txData.pickedUpAt ? formatBorrowDateTime(txData.pickedUpAt) : "Today") : (h.pickupDate || resolvedBorrowDate),
              borrowDate: h.borrowDate || resolvedBorrowDate,
              dueDate: resolvedDueDate,
              returnDate: status === "Returned" ? new Date().toISOString().split('T')[0] : (resolvedDueDate || h.returnDate),
              comment: txData.comment || h.comment,
            }
          : h
      );
    } else if (status === "Approved" || isPickedUp) {
      const match = localMatch || txData;
      cachedHistory.unshift({
        id: txId,
        isbn: match.isbn,
        title: title || match.title || "Book",
        author: match.author || "Author",
        category: match.category || match.department || "Circulation",
        department: match.department || match.category || "Circulation",
        action: type === "Reservation" ? "Reserve" : "Borrow",
        status: isPickedUp ? "Picked Up" : "Approved",
        isReturned: false,
        borrowDate: resolvedBorrowDate,
        pickupDate: isPickedUp ? (txData.pickedUpAt ? formatBorrowDateTime(txData.pickedUpAt) : "Today") : resolvedBorrowDate,
        returnDate: resolvedDueDate,
        dueDate: resolvedDueDate,
        available: "true",
      } as any);
    }

    AsyncStorage.setItem("STUDENT_RESERVATIONS", JSON.stringify(cachedReservations)).catch(() => {});
    AsyncStorage.setItem("STUDENT_HISTORY", JSON.stringify(cachedHistory)).catch(() => {});
  }

  notify();
  void syncTransactionsWithBackend(true);
});

/**
 * Retrieves existing receiptData from a notification or synthesizes a fresh,
 * complete circulation receipt with an automated unique QR code.
 */
export function getOrGenerateReceipt(item: NotificationItem): ReceiptData {
  if (item.receiptData) {
    return item.receiptData;
  }

  // Extract title from body or bookData
  let title = item.bookData?.title;
  if (!title) {
    const match = item.body.match(/['"]([^'"]+)['"]/);
    title = match ? match[1] : (item.title.includes("for") ? item.title.split("for")[1].trim() : "Borrowed Book");
  }

  // Find matching reservation or book in local store
  const match = cachedReservations.find(
    (r) => (item.bookData?.id && (r.id === item.bookData.id || r.isbn === item.bookData.id)) ||
           r.title.toLowerCase().trim() === title.toLowerCase().trim() ||
           r.title.toLowerCase().includes(title.toLowerCase()) ||
           title.toLowerCase().includes(r.title.toLowerCase())
  ) || cachedHistory.find(
    (h) => (item.bookData?.id && (h.id === item.bookData.id || h.isbn === item.bookData.id)) ||
           h.title.toLowerCase().trim() === title.toLowerCase().trim() ||
           h.title.toLowerCase().includes(title.toLowerCase()) ||
           title.toLowerCase().includes(h.title.toLowerCase())
  );

  // Extract due date from body or transaction:
  let returnDate = match?.dueDate || match?.returnDate || match?.date;
  const dueMatch =
    item.body.match(/\b(?:due(?:\s+for\s+return)?(?:\s+today)?|\bwas\s+due\s+on)\s*\(([^)]+)\)/i) ||
    item.body.match(/Due return date:\s*([^.\n]+)/i) ||
    item.body.match(/\b(?:due\s+on)\s+([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
  if (dueMatch) {
    returnDate = dueMatch[1].trim();
  }
  if (!returnDate || returnDate === "Pending" || returnDate === "Returned") {
    returnDate = "2026-10-13";
  }

  let borrowDate = match?.borrowDate || match?.dateReserved;
  if (!borrowDate && match?.pickedUpAt) {
    borrowDate = formatBorrowDateTime(match.pickedUpAt);
  }
  if (!borrowDate) {
    borrowDate = match?.date && match.date !== "Returned" && match.date !== "Pending" ? match.date : "Oct 06, 2026, 12:45 PM";
  }

  const isPickedUp = Boolean(
    match?.pickedUpAt || (match?.status && match.status === "Picked Up") || (match?.isPickedUp === true)
  );

  let pickupDate = match?.pickupDate;
  if (!pickupDate && match?.pickedUpAt) {
    pickupDate = formatBorrowDateTime(match.pickedUpAt);
  }
  if (!pickupDate) {
    pickupDate = isPickedUp ? (borrowDate || "Oct 06, 2026, 12:45 PM") : "Ready for Pickup";
  }

  const studentName = match?.studentName || cachedProfile.name || "Student Borrower";
  const studentId = match?.studentId || cachedProfile.studentId || "";
  const department = match?.department || cachedProfile.department || cachedProfile.course || "General";

  let status = "Active Loan";
  if (
    item.title.toLowerCase().includes("approved") ||
    item.body.toLowerCase().includes("approved") ||
    match?.status === "Approved"
  ) {
    status = "Approved";
  } else if (isDueToReturn(returnDate)) {
    status = "Due to Return";
  } else if (match?.status) {
    status = match.status;
  }

  // Generate deterministic receipt number based on item id and timestamp
  const safeIdStr = String(item.id).replace(/[^a-zA-Z0-9]/g, "").slice(-6) || "987654";
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const receiptNumber = `RCP-${safeIdStr.toUpperCase()}-${randomNum}`;
  const uniqueToken = `BH-RCPT-${item.id}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const qrPayload = JSON.stringify({
    type: status === "Approved" ? "PICKUP_PASS" : "BOOKHIVE_CIRCULATION_RECEIPT",
    receiptNumber,
    transactionId: match?.id || receiptNumber,
    title,
    bookTitle: title,
    author: match?.author || item.bookData?.author || "Betty",
    isbn: match?.isbn || item.bookData?.id || "222-1234-162",
    category: match?.category || match?.department || item.bookData?.category || "Fiction",
    shelf: match?.shelf || item.bookData?.shelf || "CIR 101.4 .B40s 2026 v.1 c.1",
    studentName,
    studentId,
    qrCode: studentId,
    department,
    borrowDate,
    pickupDate,
    returnDate,
    status,
    isPickedUp,
    pickedUpAt: match?.pickedUpAt || null,
    token: uniqueToken,
    verifiedBy: "BookHive Circulation Desk",
  });

  const generated: ReceiptData = {
    receiptNumber,
    transactionId: match?.id,
    bookTitle: title,
    author: match?.author || item.bookData?.author || "Betty",
    isbn: match?.isbn || item.bookData?.id || "222-1234-162",
    category: match?.category || match?.department || item.bookData?.category || "Fiction",
    shelf: match?.shelf || item.bookData?.shelf || "CIR 101.4 .B40s 2026 v.1 c.1",
    studentName,
    studentId,
    department,
    borrowDate,
    pickupDate,
    returnDate,
    status,
    qrPayload,
    isPickedUp,
    token: uniqueToken,
    bookData: item.bookData || (match ? {
      id: match.isbn || match.id,
      title: match.title,
      author: match.author || "Betty",
      description: match.description || "",
      year: match.year || "2024",
      pages: match.pages || "320",
      language: match.language || "EN",
      category: match.category || match.department || "Fiction",
      available: match.available || "false",
      shelf: match.shelf || "CIR 101.4 .B40s 2026 v.1 c.1",
    } : undefined),
  };

  item.receiptData = generated;
  return generated;
}

/**
 * Resolves a scanned Receipt QR code payload (or slip number / transaction ID),
 * matching or syncing with live borrow transaction details and book catalog.
 */
export async function resolveReceiptQrPayload(rawQr: string): Promise<ReceiptData> {
  if (!rawQr) throw new Error("Empty QR payload");

  let parsed: any = null;
  const trimmed = rawQr.trim();
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    if (trimmed.startsWith("RCP-")) {
      parsed = { receiptNumber: trimmed };
    } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      parsed = { transactionId: trimmed };
    } else {
      parsed = { payload: trimmed };
    }
  }

  // 1. Attempt backend resolution
  try {
    const headers = await getAuthHeaders();
    const res = await axios.post(
      `${API_URL}/api/student/resolve-receipt`,
      { qrData: rawQr },
      { ...headers, timeout: 5000 }
    );
    if (res.data?.success && res.data.receipt) {
      return res.data.receipt;
    }
  } catch (backendErr: any) {
    console.warn("Backend resolve-receipt notice:", backendErr?.message);
  }

  // 2. Client-side fallback: Match against local cached store & catalog
  const targetId = parsed?.transactionId || (parsed?.token?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]);
  const targetTitle = (parsed?.bookTitle || parsed?.title || "").toLowerCase();
  const targetIsbn = parsed?.isbn || "";
  const targetReceipt = parsed?.receiptNumber || "";
  const targetStudentId = parsed?.studentId || "";

  // Check local notifications first for saved receiptData
  const matchedNotif = cachedNotifications.find(
    (n) => (targetReceipt && n.receiptData?.receiptNumber === targetReceipt) ||
           (targetId && n.receiptData?.transactionId === targetId) ||
           (targetTitle && n.receiptData?.bookTitle.toLowerCase() === targetTitle)
  );

  if (matchedNotif?.receiptData) {
    return matchedNotif.receiptData;
  }

  // Check cached reservations and history
  const match = cachedReservations.find(
    (r) => (targetId && r.id === targetId) ||
           (targetIsbn && r.isbn === targetIsbn) ||
           (targetTitle && r.title.toLowerCase() === targetTitle)
  ) || cachedHistory.find(
    (h) => (targetId && h.id === targetId) ||
           (targetIsbn && h.isbn === targetIsbn) ||
           (targetTitle && h.title.toLowerCase() === targetTitle)
  );

  // Cross-reference with live book catalog
  const liveCatalog = getLiveBooks();
  const bookFound = liveCatalog.find(
    (b) => (targetIsbn && b.isbn === targetIsbn) ||
           (targetTitle && b.title.toLowerCase() === targetTitle) ||
           (targetTitle && b.title.toLowerCase().includes(targetTitle))
  );

  const isPickedUp = Boolean(
    match?.pickedUpAt ||
    (match?.status && match.status.toLowerCase() === "picked up") ||
    (parsed?.isPickedUp === true && Boolean(parsed?.pickedUpAt || parsed?.picked_up_at)) ||
    (parsed?.status && parsed.status.toLowerCase() === "picked up")
  );

  const resolvedBorrowDate = match?.borrowDate || parsed?.borrowDate || "2026-10-13 12:13 am";
  const resolvedDueDate = match?.dueDate || match?.returnDate || parsed?.returnDate || "2026-10-20";
  const resolvedPickupDate = isPickedUp
    ? (match?.pickedUpAt ? formatBorrowDateTime(match.pickedUpAt) : (parsed?.pickupDate && parsed.pickupDate !== "Ready for Pickup" ? parsed.pickupDate : "Completed"))
    : "Ready for Pickup";

  return {
    receiptNumber: parsed?.receiptNumber || targetReceipt || (match?.id ? `RCP-PROVED-${String(match.id).slice(-4)}` : "RCP-PROVED-2130"),
    transactionId: match?.id || targetId || parsed?.transactionId || "b8816339-e413-4716-9013-e5140befd994",
    bookTitle: bookFound?.title || match?.title || parsed?.bookTitle || parsed?.title || "The Struggle",
    author: bookFound?.author || match?.author || parsed?.author || "Betty",
    isbn: bookFound?.isbn || match?.isbn || parsed?.isbn || "222-1234-162",
    category: bookFound?.category || bookFound?.department || match?.category || parsed?.category || parsed?.department || "Fiction",
    shelf: bookFound?.shelf_location || bookFound?.shelf || match?.shelf || parsed?.shelf || "CIR 101.4 .B40s 2026 v.1 c.1",
    studentName: match?.studentName || parsed?.studentName || cachedProfile.name || "Hi",
    studentId: match?.studentId || targetStudentId || cachedProfile.studentId || "23-1234-567",
    department: match?.department || parsed?.department || cachedProfile.department || "CHTM",
    borrowDate: resolvedBorrowDate,
    pickupDate: resolvedPickupDate,
    returnDate: resolvedDueDate,
    status: isPickedUp ? "Picked Up" : (match?.status || parsed?.status || "Approved"),
    isPickedUp,
    qrPayload: rawQr,
    token: parsed?.token || `BH-RCPT-${targetReceipt || Date.now()}`,
  };
}

/**
 * Marks a borrow transaction as Picked Up, syncing backend, sockets, and local state.
 */
export async function markTransactionPickedUp(transactionId: string, receiptDetails?: any): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const formattedNow = formatBorrowDateTime(nowIso);

  // 1. Call Backend API
  try {
    const headers = await getAuthHeaders();
    await axios.post(
      `${API_URL}/api/student/pickup/${encodeURIComponent(transactionId)}`,
      {
        transactionId,
        resourceTitle: receiptDetails?.bookTitle || receiptDetails?.title,
        isbn: receiptDetails?.isbn,
        studentId: receiptDetails?.studentId,
        studentName: receiptDetails?.studentName,
      },
      headers
    );
  } catch (err: any) {
    console.warn("markTransactionPickedUp primary endpoint notice:", err?.message);
    try {
      const headers = await getAuthHeaders();
      await axios.patch(
        `${API_URL}/api/transactions/${encodeURIComponent(transactionId)}`,
        {
          action: "pickup",
          pickedUp: true,
          status: "Picked Up",
          resourceTitle: receiptDetails?.bookTitle || receiptDetails?.title,
          isbn: receiptDetails?.isbn,
          studentId: receiptDetails?.studentId,
          studentName: receiptDetails?.studentName,
        },
        headers
      );
    } catch (e: any) {}
  }

  // 2. Real-time broadcast via WebSocket
  socketService.emitTransactionPickedUp({
    id: transactionId,
    transactionId,
    status: "Approved",
    type: "Borrow",
    pickedUpAt: nowIso,
    isPickedUp: true,
    dueDate: receiptDetails?.returnDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    resourceTitle: receiptDetails?.bookTitle || receiptDetails?.title || "Book",
    isbn: receiptDetails?.isbn,
    studentId: receiptDetails?.studentId,
    studentName: receiptDetails?.studentName,
  });

  // 3. Synchronize local store caches
  const targetTitle = (receiptDetails?.bookTitle || receiptDetails?.title || "").toLowerCase();
  const targetIsbn = receiptDetails?.isbn || "";

  cachedReservations = cachedReservations.map((r) => {
    const isMatch =
      r.id === transactionId ||
      (targetIsbn && r.isbn === targetIsbn) ||
      (targetTitle && r.title.toLowerCase() === targetTitle);
    if (isMatch) {
      return {
        ...r,
        status: "Approved",
        isPickedUp: true,
        pickedUpAt: nowIso,
        pickupDate: formattedNow,
      };
    }
    return r;
  });

  cachedHistory = cachedHistory.map((h) => {
    const isMatch =
      h.id === transactionId ||
      (targetIsbn && h.isbn === targetIsbn) ||
      (targetTitle && h.title.toLowerCase() === targetTitle);
    if (isMatch) {
      return {
        ...h,
        status: "Approved",
        isPickedUp: true,
        pickedUpAt: nowIso,
        pickupDate: formattedNow,
      };
    }
    return h;
  });

  cachedNotifications = cachedNotifications.map((n) => {
    const isMatch =
      n.receiptData?.transactionId === transactionId ||
      (n.receiptData?.receiptNumber && receiptDetails?.receiptNumber && n.receiptData.receiptNumber === receiptDetails.receiptNumber) ||
      (targetTitle && n.receiptData?.bookTitle.toLowerCase() === targetTitle);
    if (isMatch && n.receiptData) {
      return {
        ...n,
        receiptData: {
          ...n.receiptData,
          pickupDate: formattedNow,
          status: "Picked Up / Active Loan",
          isPickedUp: true,
        },
      };
    }
    return n;
  });

  AsyncStorage.setItem("STUDENT_RESERVATIONS", JSON.stringify(cachedReservations)).catch(() => {});
  AsyncStorage.setItem("STUDENT_HISTORY", JSON.stringify(cachedHistory)).catch(() => {});
  AsyncStorage.setItem("STUDENT_NOTIFICATIONS", JSON.stringify(cachedNotifications)).catch(() => {});

  notify();
  return true;
}

export type ScannedStudentCardData = {
  student: {
    id: string;
    name: string;
    fullName?: string;
    email: string;
    studentId: string;
    idNumber?: string;
    department: string;
    course: string;
    role?: string;
    avatar?: string;
    qrCode?: string;
  };
  libraryCard: {
    id: string;
    bookTitle: string;
    borrowDate: string;
    dueReturnDate: string;
    status: string;
    type?: string;
    action?: string;
    available?: string | boolean;
    availableAt?: string;
    expiresAt?: string;
    queuePosition?: number | string;
    highlightType?: 'green' | 'violet' | 'red' | 'none';
  }[];
  reservedBooks?: {
    id: string;
    bookTitle: string;
    reserveDate: string;
    status: string;
  }[];
  violations: {
    id: string;
    bookTitle?: string;
    violationType: string;
    penaltyAmount: number;
    status: string;
    remarks: string;
    date?: string;
  }[];
};

export const fetchStudentCardAndViolations = async (qrPayload: string): Promise<ScannedStudentCardData | null> => {
  if (!qrPayload) return null;
  const cleanId = qrPayload.trim();

  try {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_URL}/api/student/card-by-qr/${encodeURIComponent(cleanId)}`, headers);
    if (response.status === 200 && response.data?.student) {
      return response.data;
    }
  } catch (error) {
    console.warn("fetchStudentCardAndViolations backend lookup failed, falling back:", error);
  }

  // Retrieve active authenticated session if available
  let activeUser = null;
  try {
    activeUser = await authService.getCurrentUser();
  } catch (e) {
    // Ignore error
  }

  const studentName = activeUser?.fullName || cachedProfile.name || (cleanId === "23-1111-111" ? "Yana Brich R. Palmares" : "Student");
  const studentId = activeUser?.studentId || cachedProfile.studentId || cleanId;
  const course = activeUser?.course || cachedProfile.course || "Library Services";
  const dept = activeUser?.department || cachedProfile.department || "CICT";
  const email = activeUser?.email || cachedProfile.email || "librarian@stiwnu.edu.ph";
  const avatar = activeUser?.avatar || cachedProfile.avatar || "";
  const qrCode = activeUser?.qrCode || cachedProfile.qrCode || cleanId;

  // Local fallback simulation if offline or demo user
  const matchingBorrowed = cachedReservations
    .filter((b) =>
      b.status === "Approved" ||
      b.status === "Picked Up" ||
      b.status === "On Loan" ||
      b.status === "Completed" ||
      b.status === "Reserved" ||
      b.status === "Returned" ||
      ((b.action === 'Reserve' || (b as any).type === 'Reservation') && (b.status === 'Pending' || b.status === 'Waitlisted'))
    )
    .map((b) => {
      const isReturned = b.status === "Returned" || b.status === "Completed";
      const isReservation = b.action === "Reserve" || (b as any).type === "Reservation" || b.status === "Reserved" || b.status === "Reservation";
      const isNowAvailable = isReservation && (
        b.available === "true" ||
        String(b.available).toLowerCase() === "true" ||
        (b as any).available === "Available" ||
        !!b.availableAt ||
        (typeof b.copies === "number" && b.copies > 0)
      );
      let dueReturnDate = b.returnDate || b.date || "2026-09-26";
      let highlightType: 'none' | 'green' | 'violet' | 'red' = 'none';
      if (!isReturned) {
        if (isReservation) {
          dueReturnDate = "Reservation";
          highlightType = "violet";
        } else {
          dueReturnDate = b.dueDate || b.returnDate || "7 days";
          if (isDueToReturn(b.dueDate || dueReturnDate)) {
            highlightType = "red";
          } else {
            highlightType = "green";
          }
        }
      } else {
        dueReturnDate = "Returned";
        highlightType = "none";
      }
      const isPickedUp = !isReturned && Boolean(b.pickedUpAt || b.isPickedUp || b.status === "Picked Up");
      let resolvedStatus = b.status || "Approved";
      if (isReturned) {
        resolvedStatus = b.status || "Returned";
      } else if (isReservation) {
        resolvedStatus = isNowAvailable ? "Borrow" : "Reservation";
      } else if (isPickedUp) {
        resolvedStatus = "Picked Up";
      }

      return {
        id: b.id,
        bookTitle: b.title,
        borrowDate: b.pickupDate || b.date || "2026-09-19",
        dueReturnDate,
        status: resolvedStatus,
        type: isReservation ? "Reservation" : "Borrow",
        action: isReservation ? "Reserve" : "Borrow",
        available: b.available,
        availableAt: b.availableAt,
        expiresAt: b.expiresAt,
        pickedUpAt: b.pickedUpAt,
        isPickedUp,
        queuePosition: b.queuePosition,
        highlightType,
      };
    });

  return {
    student: {
      id: studentId,
      name: studentName,
      fullName: studentName,
      email: email,
      studentId: studentId,
      idNumber: studentId,
      department: dept,
      course: course,
      avatar: avatar,
      qrCode: qrCode,
      role: activeUser?.role || cachedProfile.role || "Student",
    },
    libraryCard: matchingBorrowed.length > 0 ? matchingBorrowed : [
      {
        id: "demo-tx-yana",
        bookTitle: "Yana Brich Daily Life",
        borrowDate: "2026-09-19",
        dueReturnDate: "2026-09-26",
        status: "Approved",
      },
      {
        id: "demo-tx-1",
        bookTitle: "Clean Code: A Handbook of Agile Software Craftsmanship",
        borrowDate: "2026-05-10",
        dueReturnDate: "2026-05-24",
        status: "Approved",
      },
      {
        id: "demo-tx-2",
        bookTitle: "Introduction to Algorithms, Fourth Edition",
        borrowDate: "2026-05-01",
        dueReturnDate: "2026-05-15",
        status: "Approved",
      }
    ],
    reservedBooks: [
      {
        id: "demo-res-1",
        bookTitle: "Design Patterns: Elements of Reusable Object-Oriented Software",
        reserveDate: "2026-09-20",
        status: "Reserved",
      }
    ],
    violations: [],
  };
};

export const fetchBookDetailsWithLedger = async (bookId: string, title?: string, isbn?: string) => {
  if (!bookId && !title && !isbn) return null;
  try {
    const headers = await getAuthHeaders();
    const queryParams = new URLSearchParams();
    if (title) queryParams.append("title", title);
    if (isbn) queryParams.append("isbn", isbn);

    const lookupId = bookId || title || "lookup";
    const response = await axios.get(`${API_URL}/api/student/books/${encodeURIComponent(lookupId)}?${queryParams.toString()}`, headers);
    if (response.status === 200 && response.data?.book) {
      return response.data.book;
    }
  } catch (error) {
    console.warn("fetchBookDetailsWithLedger failed:", error);
  }
  return null;
};

export const getTermsAccepted = async (studentIdentifier?: string): Promise<boolean> => {
  if (!studentIdentifier) return true;
  try {
    const cleanId = String(studentIdentifier).trim().toLowerCase();
    const val = await AsyncStorage.getItem(`@bookhive_terms_accepted_${cleanId}`);
    return val === "true";
  } catch {
    return false;
  }
};

export const setTermsAccepted = async (studentIdentifier: string): Promise<void> => {
  if (!studentIdentifier) return;
  try {
    const cleanId = String(studentIdentifier).trim().toLowerCase();
    await AsyncStorage.setItem(`@bookhive_terms_accepted_${cleanId}`, "true");
    await AsyncStorage.setItem(`@bookhive_terms_accepted_date_${cleanId}`, new Date().toISOString());
  } catch (err) {
    console.warn("Failed to set terms accepted:", err);
  }
};

export const getTermsAcceptedDate = async (studentIdentifier?: string): Promise<string | null> => {
  if (!studentIdentifier) return null;
  try {
    const cleanId = String(studentIdentifier).trim().toLowerCase();
    return await AsyncStorage.getItem(`@bookhive_terms_accepted_date_${cleanId}`);
  } catch {
    return null;
  }
};

let _cachedAllBooks: any[] = [];
export const setCachedAllBooks = (books: any[]) => {
  if (Array.isArray(books)) {
    _cachedAllBooks = books;
  }
};

export const getCachedAllBooks = (): any[] => {
  return _cachedAllBooks;
};

const RECOMMEND_STOP_WORDS = new Set([
  "the", "and", "for", "with", "about", "book", "books", "that", "this",
  "from", "what", "can", "you", "show", "find", "want", "like", "need",
  "recommend", "recommendation", "looking", "good", "best", "some", "any",
  "read", "into", "over", "more", "most", "have", "been", "will", "would",
  "your", "user", "student", "library", "please", "just", "very", "much"
]);

export const getPersonalizedRecommendedBooks = (
  books: any[],
  maxCount: number = 8,
  options?: {
    searchQueries?: string[];
    borrowedBooks?: any[];
    userCourse?: string;
  }
): any[] => {
  if (!Array.isArray(books) || books.length === 0) return [];

  const searchQueries = options?.searchQueries || getSearchQueries();
  const borrowedBooks = options?.borrowedBooks || getLibraryCardHistory();
  const viewedBooks = getViewedBooksHistory();
  const favoriteBooks = getFavoriteBooks();
  const userCourse = (options?.userCourse || cachedProfile?.course || cachedProfile?.department || "").toLowerCase().trim();

  // 1. Compile User Search & Prompt Signals
  const searchSignals: { phrase: string; tokens: string[]; weight: number }[] = [];
  searchQueries.forEach((q, idx) => {
    const raw = (q || "").trim().toLowerCase();
    if (!raw || raw.length < 2) return;
    const weight = Math.max(1.0, 3.0 - idx * 0.3); // Recent searches have higher multiplier
    const tokens = raw
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !RECOMMEND_STOP_WORDS.has(w));
    searchSignals.push({ phrase: raw, tokens, weight });
  });

  // 2. Compile Borrowed Books Preferences (Strongest interest signal)
  const borrowedAuthors = new Map<string, number>();
  const borrowedCategories = new Map<string, number>();
  const borrowedKeywords = new Set<string>();
  const activeBorrowedKeys = new Set<string>();

  borrowedBooks.forEach((b) => {
    const bId = String(b.id || "").toLowerCase().trim();
    const bIsbn = String(b.isbn || "").toLowerCase().trim();
    const bTitle = (b.title || "").toLowerCase().trim();
    if (bId) activeBorrowedKeys.add(bId);
    if (bIsbn) activeBorrowedKeys.add(bIsbn);
    if (bTitle) activeBorrowedKeys.add(bTitle);

    const author = (b.author || "").toLowerCase().trim();
    if (author && author !== "unknown" && author !== "author") {
      borrowedAuthors.set(author, (borrowedAuthors.get(author) || 0) + 1);
    }

    const cat = (b.category || b.department || "").toLowerCase().trim();
    if (cat) {
      borrowedCategories.set(cat, (borrowedCategories.get(cat) || 0) + 1);
    }

    // Extract title keywords from borrowed books
    const titleTokens = bTitle
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w: string) => w.length > 3 && !RECOMMEND_STOP_WORDS.has(w));
    titleTokens.forEach((tok: string) => borrowedKeywords.add(tok));
  });

  // 3. Compile Viewed & Favorited Preferences
  const interestAuthors = new Set<string>();
  const interestCategories = new Set<string>();
  [...viewedBooks, ...favoriteBooks].forEach((b) => {
    const author = (b.author || "").toLowerCase().trim();
    if (author) interestAuthors.add(author);
    const cat = (b.category || b.department || "").toLowerCase().trim();
    if (cat) interestCategories.add(cat);
  });

  // 4. Course / Academic Discipline Domain Alignment
  const courseKeywords: string[] = [];
  if (
    userCourse.includes("information technology") ||
    userCourse.includes("computer") ||
    userCourse.includes("it") ||
    userCourse.includes("cs") ||
    userCourse.includes("cict")
  ) {
    courseKeywords.push("computer", "software", "programming", "technology", "data", "web", "algorithm", "network", "python", "java", "code", "cyber", "system", "database", "ai");
  } else if (
    userCourse.includes("business") ||
    userCourse.includes("account") ||
    userCourse.includes("management") ||
    userCourse.includes("cba")
  ) {
    courseKeywords.push("business", "management", "accounting", "finance", "marketing", "economics", "entrepreneurship", "leadership", "organization");
  } else if (
    userCourse.includes("hospitality") ||
    userCourse.includes("tourism") ||
    userCourse.includes("hotel") ||
    userCourse.includes("hrm")
  ) {
    courseKeywords.push("hospitality", "tourism", "hotel", "culinary", "service", "food", "travel", "beverage", "resort");
  } else if (userCourse.includes("engineering")) {
    courseKeywords.push("engineering", "circuits", "physics", "math", "mechanics", "electrical", "civil", "structural");
  }

  const hasActivity =
    searchSignals.length > 0 ||
    borrowedAuthors.size > 0 ||
    borrowedCategories.size > 0 ||
    interestAuthors.size > 0 ||
    interestCategories.size > 0;

  // 5. Score Each Candidate Book
  const scored = books.map((book, originalIdx) => {
    const bId = String(book.id || "").toLowerCase().trim();
    const bIsbn = String(book.isbn || "").toLowerCase().trim();
    const bTitle = (book.title || "").toLowerCase().trim();
    const bAuthor = (book.author || "").toLowerCase().trim();
    const bCat = (book.category || book.genres || "").toLowerCase().trim();
    const bDept = (book.department || "").toLowerCase().trim();
    const bDesc = (book.description || book.summary || "").toLowerCase().trim();

    let score = 0;

    // A. Match against searches and AI prompts
    for (const s of searchSignals) {
      if (bTitle === s.phrase) {
        score += 80 * s.weight;
      } else if (bTitle.includes(s.phrase)) {
        score += 60 * s.weight;
      } else if (bAuthor.includes(s.phrase)) {
        score += 45 * s.weight;
      } else if (bCat.includes(s.phrase) || bDept.includes(s.phrase)) {
        score += 35 * s.weight;
      }

      let tokenMatches = 0;
      for (const tok of s.tokens) {
        if (bTitle.includes(tok)) tokenMatches += 3;
        else if (bCat.includes(tok) || bDept.includes(tok)) tokenMatches += 2;
        else if (bDesc.includes(tok)) tokenMatches += 1;
      }
      score += tokenMatches * 5 * s.weight;
    }

    // B. Match against borrowed book preferences
    for (const [author, count] of borrowedAuthors.entries()) {
      if (bAuthor.includes(author) || author.includes(bAuthor)) {
        score += 55 * count;
      }
    }
    for (const [cat, count] of borrowedCategories.entries()) {
      if (bCat.includes(cat) || cat.includes(bCat) || bDept.includes(cat)) {
        score += 40 * count;
      }
    }
    for (const tok of borrowedKeywords) {
      if (bTitle.includes(tok)) {
        score += 20;
      }
    }

    // C. Match against viewed / favorited items
    for (const author of interestAuthors) {
      if (bAuthor.includes(author)) score += 25;
    }
    for (const cat of interestCategories) {
      if (bCat.includes(cat)) score += 20;
    }

    // D. Match against course keywords
    for (const kw of courseKeywords) {
      if (bTitle.includes(kw)) score += 22;
      if (bCat.includes(kw) || bDept.includes(kw)) score += 18;
      if (bDesc.includes(kw)) score += 8;
    }

    // E. General rating / quality boost
    const ratingNum = Number(book.rating) || 0;
    if (ratingNum > 0) {
      score += ratingNum * 2.5;
    }

    // F. Deprioritize books currently already borrowed or reserved so we recommend fresh books
    if (activeBorrowedKeys.has(bId) || (bIsbn && activeBorrowedKeys.has(bIsbn)) || activeBorrowedKeys.has(bTitle)) {
      score -= 75;
    }

    return { book, score, originalIdx };
  });

  // 6. Sort and Return Recommendations
  if (hasActivity) {
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.originalIdx - b.originalIdx;
    });

    const activeRecommendations = scored.filter((s) => s.score > 0).map((s) => s.book);
    if (activeRecommendations.length >= Math.min(4, books.length)) {
      return activeRecommendations.slice(0, maxCount);
    }

    // If activity matches are fewer than maxCount, backfill with diverse non-duplicate books
    const seenIds = new Set(activeRecommendations.map((b) => String(b.id || b.title)));
    for (const s of scored) {
      const key = String(s.book.id || s.book.title);
      if (!seenIds.has(key)) {
        seenIds.add(key);
        activeRecommendations.push(s.book);
        if (activeRecommendations.length >= maxCount) break;
      }
    }
    return activeRecommendations.slice(0, maxCount);
  }

  // Cold Start (No search or borrow history yet):
  // Sort by course alignment + rating, and ensure we do NOT simply duplicate the first items of circulation!
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Interleave diverse indices across the collection
    const idxA = (a.originalIdx * 7 + 3) % books.length;
    const idxB = (b.originalIdx * 7 + 3) % books.length;
    return idxA - idxB;
  });

  return scored.map((s) => s.book).slice(0, maxCount);
};


