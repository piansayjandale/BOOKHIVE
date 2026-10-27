"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  getUniqueBookCover,
  getGenreTheme,
  cleanAuthorName,
  isCustomUploadedCover,
  extractEmbeddedCoverUri,
} from "@/lib/book-covers";

export interface BookCoverImageProps {
  uri?: string | null;
  book?: {
    id?: string;
    title?: string;
    resourceTitle?: string;
    author?: string;
    isbn?: string;
    category?: string;
    department?: string;
    genres?: string;
    genre?: string;
    coverImg?: string | null;
    coverImage?: string | null;
    coverUrl?: string | null;
    cover_img?: string | null;
    rawText?: string | null;
    raw_text?: string | null;
  } | null;
  title?: string;
  author?: string;
  isbn?: string;
  category?: string;
  department?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  isHero?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function BookCoverImage({
  uri,
  book,
  title: titleProp,
  author: authorProp,
  isbn: isbnProp,
  category: categoryProp,
  department: departmentProp,
  size = "sm",
  isHero = false,
  className,
  onClick,
}: BookCoverImageProps) {
  const [customUriFailed, setCustomUriFailed] = useState(false);
  const [poolUriFailed, setPoolUriFailed] = useState(false);

  const title = (titleProp || book?.title || book?.resourceTitle || "Untitled Book").trim();
  const author = (authorProp || book?.author || "STI Library").trim();
  const isbn = (isbnProp || book?.isbn || "").trim();
  const category = (
    categoryProp ||
    book?.category ||
    book?.genre ||
    book?.genres?.split(",")[0] ||
    departmentProp ||
    book?.department ||
    "Circulation"
  ).trim();
  const department = (departmentProp || book?.department || category).trim();

  const directCover = useMemo(() => {
    if (uri && uri.trim().length > 5 && !uri.includes("null") && !uri.includes("undefined")) {
      return uri.trim();
    }
    const candidate =
      book?.coverImage ||
      book?.coverImg ||
      book?.coverUrl ||
      book?.cover_img ||
      extractEmbeddedCoverUri(book?.rawText || book?.raw_text) ||
      null;
    if (candidate && candidate.trim().length > 5 && !candidate.includes("null") && !candidate.includes("undefined")) {
      return candidate.trim();
    }
    return null;
  }, [uri, book]);

  const fallbackPoolCover = useMemo(
    () =>
      getUniqueBookCover({
        id: book?.id,
        title,
        author,
        isbn,
        category: category || department,
      }),
    [book?.id, title, author, isbn, category, department]
  );

  const resolvedCoverUri = useMemo(() => {
    if (directCover && !customUriFailed) {
      return directCover;
    }
    return fallbackPoolCover;
  }, [directCover, customUriFailed, fallbackPoolCover]);

  const isCustomUpload = useMemo(
    () => !customUriFailed && isCustomUploadedCover(resolvedCoverUri),
    [customUriFailed, resolvedCoverUri]
  );

  const genreTheme = useMemo(
    () => getGenreTheme(category || department, title, true),
    [category, department, title]
  );

  const displayAuthor = useMemo(() => cleanAuthorName(author), [author]);
  const categoryTag = useMemo(
    () => (category || department || genreTheme.tag).toUpperCase().slice(0, 14),
    [category, department, genreTheme.tag]
  );

  const effectiveSize = isHero ? "lg" : size;

  const sizeClasses = {
    xs: "w-9 h-12 rounded-[6px]",
    sm: "w-11 h-[60px] rounded-[7px]",
    md: "w-16 h-[88px] rounded-[9px]",
    lg: "w-28 h-[152px] rounded-[11px]",
    xl: "w-36 h-[196px] rounded-[13px]",
  }[effectiveSize];

  const isCompact = effectiveSize === "xs" || effectiveSize === "sm";
  const isLarge = effectiveSize === "lg" || effectiveSize === "xl";

  return (
    <div
      onClick={onClick}
      title={`${title} — ${displayAuthor}`}
      style={{ backgroundColor: genreTheme.bg }}
      className={cn(
        "relative flex-shrink-0 overflow-hidden select-none shadow-md transition-transform duration-200",
        sizeClasses,
        onClick && "cursor-pointer hover:scale-[1.03]",
        className
      )}
    >
      {/* 1. Underlying cover photo / artwork */}
      {resolvedCoverUri && !poolUriFailed && (
        <img
          src={resolvedCoverUri}
          alt={title}
          loading="lazy"
          onError={() => {
            if (!customUriFailed && directCover && resolvedCoverUri === directCover) {
              setCustomUriFailed(true);
            } else {
              setPoolUriFailed(true);
            }
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* 2. Atmospheric darkening scrim for generated covers so book typography pops */}
      {!isCustomUpload && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor:
              resolvedCoverUri && !poolUriFailed
                ? "rgba(10, 18, 36, 0.62)"
                : genreTheme.bg,
          }}
        />
      )}

      {/* 3. Embossed inner gilded hardcover frame border */}
      <div
        className="pointer-events-none absolute rounded-[3px] border"
        style={{
          top: isLarge ? 6 : 3,
          bottom: isLarge ? 6 : 3,
          left: isLarge ? 10 : 6,
          right: isLarge ? 6 : 3,
          borderColor: isCustomUpload
            ? "rgba(255, 255, 255, 0.18)"
            : "rgba(255, 255, 255, 0.22)",
        }}
      />

      {/* 4. Realistic 3D Hardcover Spine Seam (Left Edge) */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 top-0"
        style={{
          width: isLarge ? 5.5 : 3.5,
          backgroundColor: "rgba(0, 0, 0, 0.58)",
        }}
      />

      {/* 5. Spine Hinge Highlight */}
      <div
        className="pointer-events-none absolute bottom-0 top-0"
        style={{
          left: isLarge ? 5.5 : 3.5,
          width: isLarge ? 1.5 : 1,
          backgroundColor: "rgba(255, 255, 255, 0.32)",
        }}
      />

      {/* 6. Top-Right Bookmark Ribbon */}
      {!isCustomUpload && (
        <div
          className="pointer-events-none absolute top-0 z-[2] rounded-b-[2px] shadow-sm"
          style={{
            right: isLarge ? 8 : 4,
            width: isLarge ? 7 : 4,
            height: isLarge ? 14 : 8,
            backgroundColor: genreTheme.ribbon,
          }}
        />
      )}

      {/* 7. Book Jacket Typography (shown for generated covers; custom uploaded photos display the actual photo clearly) */}
      {!isCustomUpload && (
        <div
          className={cn(
            "relative z-[1] flex h-full w-full flex-col items-center justify-between text-center",
            isLarge
              ? "pl-3.5 pr-2 py-2"
              : effectiveSize === "md"
              ? "pl-2.5 pr-1.5 py-1.5"
              : "pl-2 pr-1 py-1"
          )}
        >
          {/* Top Category Tag */}
          <div
            className={cn(
              "max-w-[90%] truncate rounded-[2px] border font-extrabold uppercase tracking-wider",
              isLarge
                ? "px-1.5 py-[1.5px] text-[6.5px]"
                : effectiveSize === "md"
                ? "px-1 py-[1px] text-[5px]"
                : "px-1 py-[0.5px] text-[4px]"
            )}
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.52)",
              borderColor: "rgba(255, 255, 255, 0.26)",
              color: genreTheme.accent,
            }}
          >
            {categoryTag}
          </div>

          {/* Center Title, Gold Diamond Divider & Author */}
          <div className="flex w-full flex-col items-center justify-center px-0.5">
            <p
              className={cn(
                "w-full font-black uppercase text-white drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)]",
                isLarge
                  ? "line-clamp-3 text-[10px] leading-[1.18]"
                  : effectiveSize === "md"
                  ? "line-clamp-3 text-[7px] leading-[1.15]"
                  : "line-clamp-2 text-[5.5px] leading-[1.1]"
              )}
            >
              {title}
            </p>

            {/* Gold Diamond Divider */}
            <div
              className={cn(
                "flex w-[62%] items-center justify-center",
                isLarge ? "my-1" : "my-[2px]"
              )}
            >
              <div
                className="h-[0.8px] flex-1 opacity-75"
                style={{ backgroundColor: genreTheme.accent }}
              />
              <div
                className={cn(
                  "mx-0.5 rotate-45",
                  isLarge ? "h-1 w-1" : "h-[2.5px] w-[2.5px]"
                )}
                style={{ backgroundColor: genreTheme.accent }}
              />
              <div
                className="h-[0.8px] flex-1 opacity-75"
                style={{ backgroundColor: genreTheme.accent }}
              />
            </div>

            {/* Author */}
            <p
              className={cn(
                "w-full truncate font-bold drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.9)]",
                isLarge
                  ? "text-[7.5px]"
                  : effectiveSize === "md"
                  ? "text-[5.5px]"
                  : "text-[4.5px]"
              )}
              style={{ color: genreTheme.authorColor }}
            >
              {displayAuthor}
            </p>
          </div>

          {/* Footer Edition Stamp */}
          {!isCompact ? (
            <p
              className={cn(
                "w-full truncate font-extrabold uppercase tracking-wider text-white/65",
                isLarge ? "text-[5.5px]" : "text-[4.5px]"
              )}
            >
              {genreTheme.stamp}
            </p>
          ) : (
            <div className="h-[1px]" />
          )}
        </div>
      )}
    </div>
  );
}

export default BookCoverImage;
