import { z } from "zod";

export const bookSchema = z.object({
  title: z.string().min(3),
  author: z.string().min(3),
  isbn: z.string().min(10),
  publicationDate: z.string().min(4),
  department: z.enum([
    "Computer Science",
    "Engineering",
    "Education",
    "Business & Accountancy",
    "Arts & Sciences",
  ]),
  shelfLocation: z.string().min(2),
  summary: z.string().min(10),
  availability: z.enum(["Available", "Limited", "Reserved"]).default("Available"),
});

export const transactionSchema = z.object({
  studentName: z.string().min(3),
  studentId: z.string().min(4),
  resourceTitle: z.string().min(3),
  isbn: z.string().min(10),
  type: z.enum(["Borrow", "Return", "Reservation"]),
  status: z.enum(["Pending", "Approved", "Declined", "Returned"]).default("Pending"),
  department: z.enum([
    "Computer Science",
    "Engineering",
    "Education",
    "Business & Accountancy",
    "Arts & Sciences",
  ]),
  durationDays: z.number().int().min(1).max(30),
});

export const transactionStatusSchema = z.object({
  status: z.enum(["Pending", "Approved", "Declined", "Returned"]),
});

export const settingsSchema = z.object({
  theme: z.enum(["dark", "light"]),
  borrowLimit: z.number().int().min(1).max(10),
  borrowDurationDays: z.number().int().min(1).max(30),
  storageUsedPercent: z.number().min(0).max(100),
  indexingStatus: z.enum(["Healthy", "Rebuilding", "Delayed"]),
  aiEngine: z.string().min(2),
});

export const userSchema = z.object({
  name: z.string().min(3),
  email: z.email(),
  role: z.enum(["Admin", "Librarian", "Student"]),
  department: z.enum([
    "Computer Science",
    "Engineering",
    "Education",
    "Business & Accountancy",
    "Arts & Sciences",
  ]),
  status: z.enum(["Active", "Suspended"]).default("Active"),
});

export const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(8),
});

export const announcementSchema = z.object({
  title: z.string().min(4),
  content: z.string().min(12),
  audience: z.enum(["All Users", "Students", "Staff"]),
  priority: z.enum(["Normal", "Important", "Urgent"]).default("Normal"),
  published: z.boolean().default(false),
});

export const adminUserFormSchema = z.object({
  name: z.string().min(3),
  idNumber: z.string().min(4),
  email: z.email(),
  role: z.enum(["Admin", "Librarian", "Student"]),
  department: z.enum([
    "Computer Science",
    "Engineering",
    "Education",
    "Business & Accountancy",
    "Arts & Sciences",
  ]),
  course: z.string().min(2),
});

export const adminBookFormSchema = z.object({
  title: z.string().min(3),
  author: z.string().min(3),
  isbn: z.string().min(10),
  department: z.enum([
    "Computer Science",
    "Engineering",
    "Education",
    "Business & Accountancy",
    "Arts & Sciences",
  ]),
  category: z.string().min(2),
  shelfLocation: z.string().min(2),
  publishedDate: z.string().min(4),
  summary: z.string().min(10),
  archived: z.boolean().default(false),
  availability: z.enum(["Available", "Limited", "Reserved"]).default("Available"),
});

export const adminSettingsSchema = settingsSchema.extend({
  notificationsEnabled: z.boolean(),
  emailNotifications: z.boolean(),
  allowAdminTransactionControl: z.boolean(),
  aiStrictMode: z.boolean(),
});

export const adminProfileSchema = z.object({
  name: z.string().min(3),
  email: z.email(),
  department: z.enum([
    "Computer Science",
    "Engineering",
    "Education",
    "Business & Accountancy",
    "Arts & Sciences",
  ]),
  phone: z.string().min(7),
  bio: z.string().min(10),
});

export const adminPasswordSchema = z.object({
  currentPassword: z.string().min(8),
  nextPassword: z.string().min(8),
});
