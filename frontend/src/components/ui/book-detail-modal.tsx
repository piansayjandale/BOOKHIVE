"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Clock3, Info, Tag, X } from "lucide-react";

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
  relevance?: number;
}

const availabilityClasses = (availability?: BookAvailability) => {
  if (availability === "Available") {
    return "bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-[0_0_20px_rgba(16,185,129,0.35)]";
  }

  if (availability === "Reserved") {
    return "bg-amber-500/20 text-amber-300 border-amber-400/40 shadow-[0_0_20px_rgba(245,158,11,0.35)]";
  }

  return "bg-red-500/20 text-red-300 border-red-400/40 shadow-[0_0_20px_rgba(239,68,68,0.35)]";
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
  const [copied, setCopied] = useState(false);

  if (!open || !book) {
    return null;
  }

  const citation = generateApaCitation(book as BookRecord);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy citation:", err);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full max-w-lg overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0E1B28]/95 backdrop-blur-2xl shadow-[0_24px_50px_-12px_rgba(0,0,0,0.85)] text-white"
        >
          {/* Header */}
          <div className="relative border-b border-white/[0.06] px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FFD600]">
                BOOK ARCHIVE DETAILS
              </span>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/50 transition hover:bg-white/5 hover:text-white hover:border-white/20 hover:scale-105 active:scale-95"
                onClick={onClose}
                aria-label="Close book details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0 flex-1 text-left">
                <h2 className="text-xl font-bold tracking-tight text-white leading-tight line-clamp-2">{book.title}</h2>
                <p className="mt-1 text-xs font-semibold text-white/50">By {book.author}</p>
                {typeof book.relevance === "number" && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-[#FFD600] bg-[#FFD600]/10 border border-[#FFD600]/20 rounded px-1.5 py-0.5">
                      AI Match Score
                    </span>
                    <span className="text-xs font-black text-white/90">
                      {book.relevance}% Relevance
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 self-start sm:self-center">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-black tracking-widest uppercase ${availabilityClasses(
                    book.availability,
                  )}`}
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-current animate-pulse" />
                  {book.availability ?? "Status unknown"}
                </span>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="space-y-5 px-6 py-5 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {/* Visual Relevance Meter (if applicable) */}
            {typeof book.relevance === "number" && (
              <div className="rounded-2xl border border-[#FFD600]/20 bg-gradient-to-r from-[#FFD600]/5 to-transparent p-4 text-left">
                <div className="flex items-center justify-between text-[9px] uppercase font-black tracking-widest text-[#FFD600] mb-2">
                  <span>SEMANTIC MATCH STRENGTH</span>
                  <span className="text-xs font-black text-white">
                    {book.relevance}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/[0.04] overflow-hidden border border-white/[0.02]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${book.relevance}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-[#FFD600] to-amber-400 shadow-[0_0_12px_rgba(255,214,0,0.4)]"
                  />
                </div>
              </div>
            )}

            {/* Standard Key-Value Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="ISBN" value={book.isbn} icon={Tag} />
              <Detail label="Department" value={book.department} icon={Info} />
              <Detail label="Shelf Location" value={book.shelfLocation ?? "Not available"} icon={Clock3} />
              <Detail label="Genre" value={book.genres ?? "General collection"} icon={Tag} />
            </div>

            {/* APA Scholarly Citation Box */}
            <div className="rounded-2xl border border-white/[0.05] bg-[#14293E]/30 p-5 relative overflow-hidden group">
              <div className="absolute -right-20 -bottom-20 w-32 h-32 rounded-full bg-[#FFD600]/5 blur-3xl group-hover:bg-[#FFD600]/8 transition-all duration-500" />
              
              <div className="flex items-center justify-between mb-3 relative z-10">
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FFD600]">
                  APA SCHOLARLY CITATION
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 px-3 py-1.5 text-[9px] font-black tracking-widest uppercase text-white/80 transition active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      COPIED
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      COPY TEXT
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs font-medium text-white/85 leading-relaxed font-mono bg-black/25 p-4 rounded-xl border border-white/5 select-all text-left relative z-10 break-words">
                {citation}
              </p>
            </div>

            {/* Summary */}
            <div className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35">Summary Description</p>
              <p className="mt-3 text-xs leading-relaxed text-white/60 max-h-[100px] overflow-y-auto pr-1 text-left scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
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
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#FFD600]/10 text-[#FFD600] border border-[#FFD600]/15">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 text-left">
        <p className="text-[9px] font-black uppercase tracking-wider text-white/40">{label}</p>
        <p className="mt-0.5 truncate text-xs font-bold text-white/95">{value || "Not specified"}</p>
      </div>
    </div>
  );
}
