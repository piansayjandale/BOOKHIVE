"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, Clock3, Info, Tag, X } from "lucide-react";

import { generateApaCitation } from "@/lib/utils";
import type { BookAvailability, BookRecord } from "@/lib/types";

export interface BookDetailPayload {
  id: string;
  title: string;
  author: string;
  isbn: string;
  department: string;
  shelfLocation?: string;
  genres?: string;
  availability?: BookAvailability;
  publicationDate?: string;
  summary?: string;
}

const availabilityClasses = (availability?: BookAvailability) => {
  if (availability === "Available") {
    return "bg-emerald-500/10 text-emerald-200 border-emerald-400/25";
  }

  if (availability === "Reserved") {
    return "bg-amber-500/10 text-amber-200 border-amber-400/25";
  }

  return "bg-slate-500/10 text-slate-200 border-slate-400/20";
};

export function BookDetailModal({
  open,
  book,
  onClose,
}: {
  open: boolean;
  book: BookDetailPayload | null;
  onClose: () => void;
}) {
  if (!open || !book) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/10 bg-[var(--card-bg)] shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">
                Book details
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{book.title}</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{book.author}</p>
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--line)] text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]"
              onClick={onClose}
              aria-label="Close book details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-6 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail label="ISBN" value={book.isbn} icon={Tag} />
              <Detail label="Department" value={book.department} icon={Info} />
              <Detail label="Shelf Location" value={book.shelfLocation ?? "Not available"} icon={Clock3} />
              <Detail label="Genre" value={book.genres ?? "General collection"} icon={Tag} />
            </div>

            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface-muted)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">APA Citation</p>
                  <p className="mt-3 text-sm text-[var(--foreground)] break-words">
                    {generateApaCitation(book as BookRecord)}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${availabilityClasses(
                    book.availability,
                  )}`}
                >
                  <CheckCircle className="h-4 w-4" />
                  {book.availability ?? "Status unknown"}
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Summary</p>
              <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">
                {book.summary ?? "No summary available for this title."}
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Detail({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Info;
}) {
  return (
    <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-4">
      <div className="flex items-center gap-2 text-[var(--muted)]">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-[0.24em]">{label}</p>
      </div>
      <p className="mt-3 text-sm font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}
