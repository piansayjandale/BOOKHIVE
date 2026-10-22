"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  LogIn,
  HelpCircle,
  Search,
  Bookmark,
  QrCode,
  ShieldCheck,
  Sparkles,
  BarChart3,
  Users,
  Clock,
  ScanText,
  Quote,
  TrendingUp,
} from "lucide-react";
import "./intro.css";
import "./intro-nav.css";

export function IntroView() {  const [stats, setStats] = useState<{
    formattedBooks: string;
    formattedUsers: string;
    totalBooks: number;
    activeUsers: number;
    pendingRequests: number;
    activeBorrowedBooks: number;
  }>({
    formattedBooks: "48,075",
    formattedUsers: "17",
    totalBooks: 48075,
    activeUsers: 17,
    pendingRequests: 0,
    activeBorrowedBooks: 7,
  });

  // Realtime live analytics polling with visibility guard
  useEffect(() => {
    let isMounted = true;
    const fetchLiveStats = () => {
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      fetch("/api/public/stats?t=" + Date.now(), { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && isMounted) {
            setStats((prev) => {
              if (
                prev.totalBooks === data.totalBooks &&
                prev.activeUsers === data.activeUsers &&
                prev.pendingRequests === data.pendingRequests &&
                prev.activeBorrowedBooks === data.activeBorrowedBooks
              ) {
                return prev;
              }
              return data;
            });
          }
        })
        .catch(() => {});
    };

    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 10000);
    const onFocus = () => fetchLiveStats();
    window.addEventListener("focus", onFocus);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const [showFaqModal, setShowFaqModal] = useState(false);

  useEffect(() => {
    // If accessed on mobile screen or mobile device, skip intro and redirect to /login
    if (typeof window !== "undefined") {
      const isMobileDevice =
        window.innerWidth <= 768 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobileDevice) {
        window.location.replace("/login");
        return;
      }
    }    document.documentElement.classList.add("login-scroll-enabled");
    document.body.classList.add("login-scroll-enabled");

    const prevTheme = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.dataset.theme = "dark";
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";

    return () => {
      document.documentElement.classList.remove("login-scroll-enabled");
      document.body.classList.remove("login-scroll-enabled");
      if (prevTheme) {
        document.documentElement.setAttribute("data-theme", prevTheme);
        document.documentElement.dataset.theme = prevTheme;
      } else {
        document.documentElement.removeAttribute("data-theme");
        delete document.documentElement.dataset.theme;
      }
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "";
    };
  }, []);

  // Keyboard escape listeners for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowFaqModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const bookHiveFeatures = [
    {
      num: "01",
      title: "AI-Powered Prompt Search",
      icon: Sparkles,
      accent: "#0072ce",
      accentBg: "rgba(0, 114, 206, 0.12)",
    },
    {
      num: "02",
      title: "Reservation and Borrowing Management",
      icon: Clock,
      accent: "#d97706",
      accentBg: "rgba(217, 119, 6, 0.12)",
    },
    {
      num: "03",
      title: "OCR Scanning and Document Processing",
      icon: ScanText,
      accent: "#059669",
      accentBg: "rgba(5, 150, 105, 0.12)",
    },
    {
      num: "04",
      title: "Digital Library Card, Book Card, and Violations Tracking",
      icon: QrCode,
      accent: "#7c3aed",
      accentBg: "rgba(124, 58, 237, 0.12)",
    },
    {
      num: "05",
      title: "Automated Citation Generation",
      icon: Quote,
      accent: "#0284c7",
      accentBg: "rgba(2, 132, 199, 0.12)",
    },
    {
      num: "06",
      title: "Descriptive Analytics and Printable Reporting",
      icon: BarChart3,
      accent: "#db2777",
      accentBg: "rgba(219, 39, 119, 0.12)",
    },
    {
      num: "07",
      title: "Personalized Recommendations and Trending Display",
      icon: TrendingUp,
      accent: "#ca8a04",
      accentBg: "rgba(202, 138, 4, 0.12)",
    },
    {
      num: "08",
      title: "User Role and Privilege Governance",
      icon: ShieldCheck,
      accent: "#0891b2",
      accentBg: "rgba(8, 145, 178, 0.12)",
    },
  ];

  return (
    <div
      data-intro-page="true"
      className="login-page-root"
      data-theme="dark"
      suppressHydrationWarning
    >
      {/* Background Image & Overlay (Fixed behind Hero) */}
      <img
        src="/sti-campus-building.jpg"
        alt="STI West Negros University Campus"
        className="login-bg-img"
        suppressHydrationWarning
      />
      <div className="login-bg-tint" />

      {/* =====================================================================
          SECTION 1: HERO VIEWPORT
          ===================================================================== */}
      <div className="login-hero-screen">
        {/* TOP NAVBAR: Edge-to-edge full width and solid white (No Theme Toggle) */}
        <header className="intro-header-nav-white">
          <div className="intro-nav-bar-full">
            {/* Left: STI Logo + BookHive Brand Text */}
            <Link href="/intro" className="login-nav-left">
              <div className="login-nav-sti-badge" title="STI West Negros University">
                <img
                  src="/sti-logo.png"
                  alt="STI Logo"
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                  suppressHydrationWarning
                />
              </div>
              <span className="intro-brand-title-black">BookHive</span>
            </Link>

            {/* Right: FAQ Link + Log In Button (Theme Toggle Removed) */}
            <div className="intro-nav-right">
              <button
                type="button"
                onClick={() => setShowFaqModal(true)}
                className="intro-nav-faq-black-btn"
                title="Frequently Asked Questions"
              >
                FAQ
              </button>

              {/* Log In Button */}
              <Link
                href="/login"
                className="intro-nav-login-btn"
                title="Log In to BookHive"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Log In</span>
              </Link>
            </div>
          </div>
        </header>

        {/* MAIN HERO CONTENT */}
        <main className="login-main-container">
          <div className="login-split-grid">
            {/* LEFT COLUMN: HERO INFORMATION */}
            <div className="intro-hero-left-col">
              {/* Kicker Pill: Exact match to Picture 3 (dark pill, yellow book, white text) */}
              <div className="intro-kicker-badge-p3">
                <BookOpen className="w-4 h-4 text-[#FFF200] stroke-[2.2]" />
                <span>Open a Book, Unlock your World</span>
              </div>

              {/* Headline: Welcome to (white) + BookHive in pure flat yellow with NO glow */}
              <h1 className="intro-hero-heading-v2">
                <span className="block">Welcome to</span>
                <span className="intro-hero-yellow-title block">BookHive</span>
              </h1>

              {/* Subheading */}
              <h2 className="intro-hero-subtitle-v2">
                An AI Powered Search With Descriptive Analytics for STI West Negros University Library
              </h2>

              {/* Lead Paragraph */}
              <p className="intro-hero-paragraph-v2">
                Welcome to <strong className="font-extrabold text-[#FFF200]">BookHive</strong> the smart digital ecosystem of STI West Negros
                University Library. Delivering AI-assisted catalog search, instant reservations,
                digital QR credentials, and real-time circulation intelligence.
              </p>
            </div>

            {/* RIGHT COLUMN: BOOKHIVE LOGO IN WHITE CONTAINER */}
            <div className="login-right-col intro-hero-logo-col">
              <div className="intro-logo-white-card">
                <img
                  src="/logo.png"
                  alt="BookHive Logo"
                  className="intro-hero-logo-img"
                  suppressHydrationWarning
                />
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* =====================================================================
          SECTION 2: FEATURES (BOOKHIVE CORE FUNCTIONALITIES)
          Background reverted to dark navy as in 1st picture, Core Capabilities badge removed,
          containers (cards) added on features.
          ===================================================================== */}
      <section id="features" className="login-section-container intro-features-section">
        <div className="login-section-inner">
          <div className="login-section-header">
            <div className="intro-features-badge-container">
              <span className="intro-features-badge-text">Features</span>
            </div>
            <h2 className="login-section-title">
              BookHive Features &amp; Functionalities
            </h2>
            <p className="login-section-subtitle">
              Comprehensive intelligent library ecosystem designed for STI West Negros University,
              bridging AI discovery, automated circulation, and administrative reporting.
            </p>
          </div>

          {/* 8 Feature Cards with containers */}
          <div className="login-features-grid">
            {bookHiveFeatures.map((feat) => {
              const IconComp = feat.icon;
              return (
                <div key={feat.num} className="login-feature-card">
                  <div className="login-feature-card-header">
                    <div
                      className="login-feature-icon-badge"
                      style={{
                        backgroundColor: feat.accentBg,
                        color: feat.accent,
                        borderColor: `${feat.accent}33`,
                      }}
                    >
                      <IconComp
                        className="w-5 h-5"
                        style={{ color: feat.accent, stroke: feat.accent }}
                      />
                    </div>
                    <span className="login-feature-number">{feat.num}</span>
                  </div>
                  <h3 className="login-feature-card-title">{feat.title}</h3>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: SUMMARY OF BOOKHIVE (ECOSYSTEM SHOWCASE)
          ===================================================================== */}
      <section id="about-bookhive" className="login-section-container login-summary-section">
        <div className="login-section-inner">
          <div className="login-summary-grid">
            {/* Visual Showcase Card */}
            <div className="login-summary-visual">
              <div className="login-summary-card-frame">
                <img
                  src="/sti-wnu-library-shelves.jpg"
                  alt="BookHive Library Book Stacks at STI West Negros University"
                  style={{ width: "100%", height: "350px", objectFit: "cover", display: "block" }}
                />
              </div>
            </div>

            {/* Text Summary Content */}
            <div className="login-summary-text-wrap">
              <span className="login-summary-kicker">
                STI WEST NEGROS UNIVERSITY LIBRARY
              </span>
              <h2 className="login-summary-heading">
                About BookHive
              </h2>
              <p className="login-summary-lead">
                BookHive is an AI-powered library management system developed for STI West Negros University to replace inefficient manual processes and rigid keyword searches with a modern, multi-platform solution. It features a mobile application for students and librarians, alongside with the web dashboards for librarians and administrators, integrating Google Gemini AI to enable natural language prompt-based searching, semantic relevance matching, and automated citation generation. In addition to simplifying resource discovery, BookHive streamlines daily operations through digital library cards, automated book reservations and borrowing workflows, real-time notifications, and descriptive analytics dashboards that support data-driven decision-making.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 4: MODERN DESCRIPTIVE ANALYTICS
          Modern, easy-to-understand metrics: specifically showcases
          Number of Books and Number of Users.
          ===================================================================== */}
      <section id="analytics" className="login-section-container login-analytics-section">
        <div className="login-section-inner">
          <div className="login-section-header">
            <div className="intro-features-badge-container">
              <BarChart3 className="w-3.5 h-3.5 text-[#FFF200]" />
              <span className="intro-features-badge-text">Descriptive Analytics</span>
            </div>
            <h2 className="login-section-title">
              Circulation Intelligence &amp; Performance
            </h2>
            <p className="login-section-subtitle">
              Key collection volume and active campus community metrics powering STI West Negros University Library.
            </p>
          </div>

          {/* Modern 2-Card Metrics Grid */}
          <div className="intro-modern-analytics-grid">
            {/* Card 1: NUMBER OF BOOKS (48,075 remains) */}
            <div className="intro-modern-analytic-card books-card">
              <div className="intro-analytic-card-top">
                <div className="intro-analytic-icon-box books">
                  <BookOpen className="w-6 h-6 text-[#38bdf8]" />
                </div>
                <div className="intro-analytic-live-tag">
                  <span className="intro-analytic-live-dot" />
                  <span>Live Catalog</span>
                </div>
              </div>

              <div className="intro-analytic-metric-num books-num">
                {stats.formattedBooks || "48,075"}
              </div>
              <h3 className="intro-analytic-metric-title">
                Number of Books &amp; Resources
              </h3>
              <p className="intro-analytic-metric-desc">
                Comprehensive collection of physical volumes, Filipiniana archives, reference titles, and digitized curriculum materials indexed for instant discovery.
              </p>

              <div className="intro-analytic-pill-row">
                <span className="intro-analytic-pill">
                  <BookOpen className="w-3.5 h-3.5 text-[#38bdf8]" />
                  Circulation &amp; Filipiniana
                </span>
                <span className="intro-analytic-pill">
                  <Sparkles className="w-3.5 h-3.5 text-[#38bdf8]" />
                  AI Prompt Indexed
                </span>
                <span className="intro-analytic-pill">
                  <ScanText className="w-3.5 h-3.5 text-[#38bdf8]" />
                  OCR Digitized
                </span>
              </div>
            </div>

            {/* Card 2: ACTIVE USERS */}
            <div className="intro-modern-analytic-card users-card">
              <div className="intro-analytic-card-top">
                <div className="intro-analytic-icon-box users">
                  <Users className="w-6 h-6 text-[#38bdf8]" />
                </div>
                <div className="intro-analytic-live-tag">
                  <span
                    className="intro-analytic-live-dot"
                    style={{ backgroundColor: "#38bdf8", boxShadow: "0 0 8px #38bdf8" }}
                  />
                  <span>Campus Community</span>
                </div>
              </div>

              <div className="intro-analytic-metric-num users-num">
                {stats.activeUsers ?? 17}
              </div>
              <h3 className="intro-analytic-metric-title">
                Active Users
              </h3>
              <p className="intro-analytic-metric-desc">
                Enrolled students, faculty educators, researchers, and library personnel actively utilizing BookHive digital credentials and catalog services.
              </p>

              <div className="intro-analytic-pill-row">
                <span className="intro-analytic-pill">
                  <Users className="w-3.5 h-3.5 text-[#38bdf8]" />
                  Students &amp; Faculty
                </span>
                <span className="intro-analytic-pill">
                  <QrCode className="w-3.5 h-3.5 text-[#38bdf8]" />
                  Digital QR Credentials
                </span>
                <span className="intro-analytic-pill">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#38bdf8]" />
                  Role Governance
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 5: FOOTER
          ===================================================================== */}
      <footer className="login-footer-section">
        <div className="login-footer-inner">
          <div className="login-footer-brand">
            <div className="login-footer-badge">
              <img
                src="/sti-logo.png"
                alt="STI"
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              />
            </div>
            <span className="login-footer-copy">
              &copy; 2026 STI West Negros University • BookHive LMS. All rights reserved.
            </span>
          </div>

          <div className="login-footer-links">
            <button type="button" onClick={() => scrollToSection("features")} className="login-footer-link">
              Features
            </button>
            <button type="button" onClick={() => scrollToSection("about-bookhive")} className="login-footer-link">
              Summary
            </button>
            <button type="button" onClick={() => scrollToSection("analytics")} className="login-footer-link">
              Analytics
            </button>
            <button type="button" onClick={() => setShowFaqModal(true)} className="login-footer-link">
              FAQ
            </button>
            <button type="button" onClick={scrollToTop} className="login-footer-link">
              Back to Top ↑
            </button>
          </div>

          <div className="login-footer-status">
            <span className="login-status-dot" />
            <span>System Operational</span>
          </div>
        </div>
      </footer>

      {/* =====================================================================
          MODAL: FAQ TO BOOKHIVE
          ===================================================================== */}
      {showFaqModal && (
        <div
          className="login-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowFaqModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="login-modal-window">
            <div className="login-modal-top-accent" />
            <div className="login-modal-header">
              <div className="login-modal-title-wrap">
                <div className="login-modal-badge">
                  <HelpCircle className="w-5 h-5 text-[#FFF200]" />
                </div>
                <div>
                  <h3 className="login-modal-title">BookHive FAQ</h3>
                  <p className="login-modal-subtitle">
                    Frequently Asked Questions • STI WNU Library
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="login-modal-close-icon-btn"
                onClick={() => setShowFaqModal(false)}
                aria-label="Close FAQ dialog"
              >
                ✕
              </button>
            </div>

            <div className="login-modal-body-scroll">
              <div className="login-faq-card">
                <div className="login-faq-question">
                  <Search className="w-4 h-4 text-[#FFF200]" />
                  <span>How does the AI-powered search work?</span>
                </div>
                <p className="login-faq-answer">
                  BookHive allows natural language queries. Instead of exact keyword matches,
                  you can search concepts like &ldquo;beginner algorithms for C#&rdquo; or
                  &ldquo;nursing research case studies&rdquo; to find catalog matches across
                  all STI WNU departments.
                </p>
              </div>

              <div className="login-faq-card">
                <div className="login-faq-question">
                  <Bookmark className="w-4 h-4 text-[#FFF200]" />
                  <span>Can I reserve books before going to the library?</span>
                </div>
                <p className="login-faq-answer">
                  Yes! Search for your desired book in the catalog, click &ldquo;Reserve&rdquo;,
                  and BookHive will hold the copy for you. You will receive real-time notifications
                  when it is ready for pickup at the circulation desk.
                </p>
              </div>

              <div className="login-faq-card">
                <div className="login-faq-question">
                  <QrCode className="w-4 h-4 text-[#FFF200]" />
                  <span>What is the Digital QR Credential?</span>
                </div>
                <p className="login-faq-answer">
                  Every enrolled student and staff member is issued a unique digital QR library
                  card. Simply present it at the circulation desk scanner for instantaneous loan
                  and return processing.
                </p>
              </div>

              <div className="login-faq-card">
                <div className="login-faq-question">
                  <ShieldCheck className="w-4 h-4 text-[#FFF200]" />
                  <span>Who can access the BookHive web portal?</span>
                </div>
                <p className="login-faq-answer">
                  The web portal is designed for STI WNU Librarians, Technical Staff, and
                  Administrators. Students can access their accounts through both web and the
                  BookHive Mobile Application.
                </p>
              </div>
            </div>

            <div className="login-modal-footer">
              <button
                type="button"
                className="login-modal-btn-dismiss"
                onClick={() => setShowFaqModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
