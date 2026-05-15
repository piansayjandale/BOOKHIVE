"use client";

import React, { useEffect, useState } from "react";
import { Bell, Search as SearchIcon, MoreVertical } from "lucide-react";

// Figma Design Color Palette
const colors = {
  darkNavy: "#0F1D29", // RGB(15, 29, 41)
  headerBlue: "#002D3B", // RGB(0, 32, 59)
  containerBlue: "#264258", // RGB(38, 66, 88)
  steelBlue: "#647483", // RGB(100, 116, 139)
  activeBlue: "#3A5F78", // RGB(58, 95, 120)
  accentGold: "#FCD400", // RGB(252, 212, 0)
  textWhite: "#FFFFFF", // RGB(255, 255, 255)
  textGray: "#94A3B8", // RGB(148, 163, 184)
  lightBg: "#F1F5F9", // RGB(241, 245, 249)
};

interface DashboardProps {
  variant?: "librarian" | "admin";
}

export function DashboardFigma({ variant = "librarian" }: DashboardProps) {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState("Computer Science");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch("/api/dashboard");
        if (response.ok) {
          const data = await response.json();
          setDashboardData(data);
        } else if (response.status === 401) {
          console.error("Dashboard unauthorized. Session may have expired.");
        }
      } catch (error) {
        console.error("Failed to fetch dashboard:", error);
      }
    };

    fetchDashboard();
  }, []);

  const categories = [
    "Computer Science",
    "Engineering",
    "Education",
    "Business & Accountancy",
    "Arts & Sciences",
  ];

  const commandActions = [
    {
      icon: "📚",
      title: variant === "librarian" ? "BOOKHIVE LIBRARIAN" : "SYSTEM ADMIN",
      count: "3 pending requests",
    },
    {
      icon: "📊",
      title: variant === "librarian" ? "INVENTORY REPORTS" : "ANALYTICS DASHBOARD",
      count: "12 new insights",
    },
  ];

  return (
    <>
      {/* Header - TopAppBar removed as it is now provided by AppShell */}

      {/* Hero Section */}
      <section
        style={{
          backgroundColor: colors.containerBlue,
          borderRadius: "12px",
          padding: "48px 32px",
          marginBottom: "32px",
        }}
      >
        {/* Section Label */}
        <div
          style={{
            display: "inline-block",
            backgroundColor: colors.accentGold,
            color: colors.darkNavy,
            padding: "6px 12px",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: "600",
            marginBottom: "16px",
            letterSpacing: "0.5px",
          }}
        >
          {variant === "librarian" ? "LIBRARIAN COMMAND DESK" : "ADMIN DASHBOARD"}
        </div>

        {/* Main Heading */}
        <h1
          style={{
            fontSize: "32px",
            fontWeight: "700",
            marginBottom: "32px",
            lineHeight: "1.4",
            maxWidth: "600px",
            color: colors.textWhite,
          }}
        >
          Find resources across the entire STI WNU digital ecosystem.
        </h1>

        {/* Search Box */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: colors.textWhite,
            borderRadius: "32px",
            padding: "12px 24px",
            marginBottom: "24px",
            gap: "12px",
          }}
        >
          <SearchIcon size={20} color={colors.textGray} />
          <input
            type="text"
            placeholder="Search books, authors, subjects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: "14px",
              color: "#1E293B",
              backgroundColor: "transparent",
            }}
          />
        </div>

        {/* Category Filter Buttons */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              style={{
                backgroundColor:
                  selectedCategory === category ? colors.activeBlue : colors.steelBlue,
                color: colors.textWhite,
                border: "none",
                padding: "8px 16px",
                borderRadius: "25px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor = colors.activeBlue)
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.backgroundColor =
                  selectedCategory === category ? colors.activeBlue : colors.steelBlue)
              }
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {/* Command Desk Section */}
      <section style={{ marginBottom: "32px" }}>
        <h2
          style={{
            fontSize: "16px",
            fontWeight: "700",
            marginBottom: "16px",
            color: colors.accentGold,
            letterSpacing: "0.5px",
          }}
        >
          {variant === "librarian" ? "LIBRARIAN COMMAND DESK" : "ADMIN COMMAND CENTER"}
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "16px",
          }}
        >
          {commandActions.map((action, idx) => (
            <button
              key={idx}
              style={{
                backgroundColor: colors.steelBlue,
                color: colors.textWhite,
                border: "none",
                borderRadius: "12px",
                padding: "20px 16px",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor = colors.activeBlue)
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.backgroundColor = colors.steelBlue)
              }
            >
              <div>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    marginBottom: "4px",
                    color: colors.textGray,
                  }}
                >
                  {action.title}
                </div>
                <div style={{ fontSize: "14px", fontWeight: "500" }}>
                  {action.count}
                </div>
              </div>
              <MoreVertical size={18} color={colors.textGray} />
            </button>
          ))}
        </div>
      </section>

      {/* Key Metrics Section */}
      {dashboardData && (
        <section>
          <h2
            style={{
              fontSize: "16px",
              fontWeight: "700",
              marginBottom: "16px",
              color: colors.accentGold,
              letterSpacing: "0.5px",
            }}
          >
            DASHBOARD METRICS
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "16px",
            }}
          >
            <MetricCard
              label="Total Books"
              value={dashboardData.metrics?.totalBooks || "..."}
              detail="Active catalog records"
            />
            <MetricCard
              label="Active Users"
              value={dashboardData.metrics?.activeUsers || "..."}
              detail="Authenticated sessions"
            />
            <MetricCard
              label="Pending Requests"
              value={dashboardData.metrics?.pendingRequests || "..."}
              detail="Awaiting approval"
            />
            {variant === "admin" && (
              <MetricCard
                label="System Health"
                value="98%"
                detail="All systems operational"
              />
            )}
          </div>
        </section>
      )}
    </>
  );
}

// Metric Card Component
function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div
      style={{
        backgroundColor: colors.containerBlue,
        borderRadius: "12px",
        padding: "16px",
        border: `1px solid ${colors.steelBlue}33`,
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: "600",
          color: colors.textGray,
          marginBottom: "8px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "28px",
          fontWeight: "700",
          color: colors.accentGold,
          marginBottom: "8px",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: "12px", color: colors.textGray }}>{detail}</div>
    </div>
  );
}
