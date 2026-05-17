"use client";

import React, { useEffect, useState } from "react";
import { Bell, Search as SearchIcon, MoreVertical, Sparkles, Mic, Image as ImageIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Pie, PieChart, ResponsiveContainer, Tooltip, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
  const [selectedCategory, setSelectedCategory] = useState("Computer Science");
  const [searchQuery, setSearchQuery] = useState("");
  const [summary, setSummary] = useState({
    totalBooks: 0,
    totalUsers: 0,
    pendingRequests: 0,
    activeBorrowedBooks: 0,
  });
  const [departmentUsage, setDepartmentUsage] = useState<any[]>([]);
  const [topBooks, setTopBooks] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [newUsers, setNewUsers] = useState<any[]>([]);
  const [latestTransactions, setLatestTransactions] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/admin/dashboard");
        if (!res.ok) throw new Error("Failed to fetch dashboard data");
        const data = await res.json();
        if (data.summary) {
          setSummary({
            totalBooks: data.summary.totalBooks || 0,
            totalUsers: data.summary.totalUsers || 0,
            pendingRequests: data.summary.pendingRequests || 0,
            activeBorrowedBooks: data.summary.activeBorrowedBooks || 0,
          });
        }
        if (data.departmentUsage) setDepartmentUsage(data.departmentUsage);
        if (data.topBooks) setTopBooks(data.topBooks);
        if (data.recentActivities) setRecentActivities(data.recentActivities);
        if (data.newUsers) setNewUsers(data.newUsers);
        if (data.latestTransactions) setLatestTransactions(data.latestTransactions);
      } catch (err) {
        console.error("Error fetching dashboard:", err);
      }
    }
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
      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-8 rounded-[32px] border border-white/10 bg-[#152E47] p-8 md:p-12 shadow-xl shadow-black/20"
      >
        {/* Section Label */}
        <div className="mb-6 flex items-center gap-2 text-[#FCD400]">
          <Sparkles className="h-4 w-4 fill-current" />
          <span className="text-xs font-bold tracking-widest">
            ASK BOOKHIVE
          </span>
        </div>

        {/* Main Heading */}
        <h1 className="mb-10 text-[28px] font-bold leading-tight text-white md:text-[36px]">
          Find resources across the entire STI WNU digital ecosystem.
        </h1>

        {/* AI Prompt Search Box */}
        <div className="mb-8 flex w-full items-center gap-2 rounded-full bg-white py-1.5 pl-6 pr-2 shadow-sm">
          <SearchIcon size={20} color="#94A3B8" className="flex-shrink-0" />
          
          <input
            type="text"
            suppressHydrationWarning
            placeholder="Search by Title, Author, ISBN, or ask a question..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-[15px] text-[#1E293B] outline-none placeholder:text-[#94A3B8]"
          />

          <div className="flex items-center gap-3 border-l border-slate-200 pl-4 pr-1">
            <button
              type="button"
              suppressHydrationWarning
              className="text-[#94A3B8] transition-colors hover:text-slate-700"
              title="Voice Search"
            >
              <Mic size={20} />
            </button>
            <button
              type="button"
              suppressHydrationWarning
              className="text-[#94A3B8] transition-colors hover:text-slate-700"
              title="Upload Image/Context"
            >
              <ImageIcon size={20} />
            </button>
            
            <button
              type="button"
              suppressHydrationWarning
              className="ml-2 rounded-full bg-[#152E47] px-8 py-3.5 text-xs font-bold tracking-widest text-white transition-transform hover:scale-105"
            >
              ANALYZE
            </button>
          </div>
        </div>

        {/* Category Filter Buttons */}
        <div className="flex flex-wrap gap-3">
          {categories.map((category) => (
            <button
              key={category}
              suppressHydrationWarning
              onClick={() => setSelectedCategory(category)}
              className={`rounded-[24px] px-6 py-2.5 text-[13px] font-medium transition-colors ${
                selectedCategory === category
                  ? "bg-[#1E3445] text-white"
                  : "bg-[#1E3445] text-[#94A3B8] hover:text-white"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </motion.section>

      {/* Analytics & System Health Row */}
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Metric 1 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col justify-center overflow-hidden rounded-2xl border border-white/10 border-l-[6px] border-l-[#FCD400] bg-[#152E47]/80 px-6 py-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-[#1E3445]"
        >
          <div className="mb-1 text-[11px] font-bold tracking-[0.15em] text-[#94A3B8]">TOTAL_BOOKS</div>
          <div className="text-[32px] font-black tracking-tight text-white">{summary.totalBooks.toLocaleString()}</div>
        </motion.div>
        
        {/* Metric 2 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col justify-center overflow-hidden rounded-2xl border border-white/10 border-l-[6px] border-l-[#38BDF8] bg-[#152E47]/80 px-6 py-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-[#1E3445]"
        >
          <div className="mb-1 text-[11px] font-bold tracking-[0.15em] text-[#94A3B8]">ACTIVE_USERS</div>
          <div className="text-[32px] font-black tracking-tight text-white">{summary.totalUsers.toLocaleString()}</div>
        </motion.div>
        
        {/* Metric 3 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col justify-center overflow-hidden rounded-2xl border border-white/10 border-l-[6px] border-l-[#F97316] bg-[#152E47]/80 px-6 py-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-[#1E3445]"
        >
          <div className="mb-1 text-[11px] font-bold tracking-[0.15em] text-[#94A3B8]">PENDING_REQ</div>
          <div className="text-[32px] font-black tracking-tight text-white">{summary.pendingRequests.toLocaleString()}</div>
        </motion.div>
        
        {/* Metric 4 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col justify-center overflow-hidden rounded-2xl border border-white/10 border-l-[6px] border-l-[#EF4444] bg-[#152E47]/80 px-6 py-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-[#1E3445]"
        >
          <div className="mb-1 text-[11px] font-bold tracking-[0.15em] text-[#94A3B8]">ACTIVE_BORROWS</div>
          <div className="text-[32px] font-black tracking-tight text-[#EF4444]">{summary.activeBorrowedBooks.toLocaleString()}</div>
        </motion.div>
        
        {/* System Health */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="group flex flex-col justify-between overflow-hidden rounded-2xl bg-[#041E30] p-6 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-[#041E30]/20"
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="text-xs font-bold tracking-widest text-[#FCD400]">SYSTEM_HEALTH</div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-[#10B981]">
              <div className="h-2 w-2 animate-pulse rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
              NOMINAL
            </div>
          </div>
          
          <div>
            <div className="mb-1 flex justify-between text-[10px] font-bold text-[#64748B]">
              <span>LAST INDEXING</span>
              <span>STORAGE USED</span>
            </div>
            
            <div className="mb-4 flex justify-between text-xs font-bold text-white">
              <span>2024.10.24 04:12</span>
              <span>84.2 / 128 GB</span>
            </div>
            
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1E3445]">
              <div className="h-full w-[65%] rounded-full bg-[#FCD400] transition-all duration-1000 group-hover:w-[70%]"></div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (Span 2) */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Most Active Departments */}
            <motion.section
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-6 shadow-sm"
            >
              <div className="mb-8">
                <h2 className="text-[22px] font-bold text-white tracking-wide">Most Active Departments</h2>
                <p className="mt-2 text-[15px] font-light text-slate-300">Transaction volume by department.</p>
              </div>
              
              <div className="h-[280px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={departmentUsage.length > 0 ? departmentUsage : [
                        { department: "No Data", usage: 1 }
                      ]} 
                      dataKey="usage" 
                      nameKey="department" 
                      innerRadius={0} 
                      outerRadius={110} 
                      fill="#2563eb"
                      stroke="#ffffff"
                      strokeWidth={1}
                      isAnimationActive={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0F1D29', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '12px', fontSize: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                      itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.section>

            {/* Most Active Books */}
            <motion.section
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--card-bg)] p-6 shadow-sm"
            >
              <div className="mb-8">
                <h2 className="text-[22px] font-bold text-white tracking-wide">Most Active Books</h2>
                <p className="mt-2 text-[15px] font-light text-slate-300">Top performers by borrow volume.</p>
              </div>
              
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topBooks.length > 0 ? topBooks : [
                    { title: "No Data", borrowCount: 0 }
                  ]}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="title" stroke="var(--muted)" tick={{ fill: "#94A3B8", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => value.length > 12 ? value.substring(0, 12) + "..." : value} />
                    <YAxis stroke="var(--muted)" tick={{ fill: "#94A3B8", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0F1D29', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '12px', fontSize: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    />
                    <Bar dataKey="borrowCount" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.section>
          </div>

          {/* Command Shortcuts */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <h2 className="mb-4 text-[10px] font-bold tracking-[0.15em] text-slate-400">COMMAND_SHORTCUTS</h2>
            <div className="grid grid-cols-4 gap-4">
              <button suppressHydrationWarning className="group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]">
                <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                <div className="z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="9" y1="11" x2="15" y2="11"/></svg>
                </div>
                <span className="z-10 text-[10px] font-bold tracking-[0.2em] text-slate-400 transition-colors duration-300 group-hover:text-[#FCD400]">ADD_BOOK</span>
              </button>

              <button suppressHydrationWarning className="group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]">
                <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                <div className="z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
                </div>
                <span className="z-10 text-[10px] font-bold tracking-[0.2em] text-slate-400 transition-colors duration-300 group-hover:text-[#FCD400]">SYNC_DATA</span>
              </button>

              <button suppressHydrationWarning className="group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]">
                <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                <div className="z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7v10"/><path d="M11 7v10"/><path d="M15 7v10"/></svg>
                </div>
                <span className="z-10 text-[10px] font-bold tracking-[0.2em] text-slate-400 transition-colors duration-300 group-hover:text-[#FCD400]">SCAN_ID</span>
              </button>

              <button suppressHydrationWarning className="group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#152E47]/80 to-[#0F1D29]/80 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#FCD400]/50 hover:shadow-[0_8px_30px_rgba(252,212,0,0.2)]">
                <div className="absolute inset-0 bg-gradient-to-b from-[#FCD400]/0 to-[#FCD400]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                <div className="z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:bg-[#FCD400]/20 group-hover:text-[#FCD400]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
                </div>
                <span className="z-10 text-[10px] font-bold tracking-[0.2em] text-slate-400 transition-colors duration-300 group-hover:text-[#FCD400]">BROADCAST</span>
              </button>
            </div>
          </motion.section>
        </div>

        {/* Right Column (Span 1) */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* Trending Records */}
          <motion.section
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className="mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FCD400" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
              <h2 className="text-lg font-black tracking-wide text-white">TRENDING RECORDS</h2>
            </div>
            
            <div className="flex flex-col gap-3">
              {topBooks.slice(0, 3).map((book, idx) => (
                <div key={book.id || idx} className={`group flex cursor-pointer items-center justify-between overflow-hidden rounded-2xl border border-white/10 ${idx === 0 ? "border-r-[6px] border-r-[#FCD400] bg-[#152E47]/80 shadow-lg" : "border-r-[6px] border-r-transparent bg-[#152E47]/60 shadow-md"} px-5 py-4 backdrop-blur-md transition-all hover:-translate-y-1 hover:bg-[#1E3445] hover:shadow-[0_10px_20px_rgba(0,0,0,0.3)]`}>
                  <div className="flex items-center gap-4">
                    <span className={`text-xs font-black ${idx === 0 ? "text-slate-500 transition-colors group-hover:text-[#FCD400]" : "text-slate-600 transition-colors group-hover:text-slate-400"}`}>0{idx + 1}</span>
                    <span className="text-sm font-black text-white">{book.title.toUpperCase()}</span>
                  </div>
                  <div className={`rounded-full bg-[#0F1D29] px-3 py-1.5 text-[10px] font-bold tracking-widest ${idx === 0 ? "text-slate-400 transition-colors group-hover:bg-[#FCD400]/10 group-hover:text-[#FCD400]" : "text-slate-400 transition-colors group-hover:bg-slate-700 group-hover:text-white"}`}>{book.borrowCount} REQ</div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Live Terminal Activity */}
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="mt-2"
          >
            <div className="mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <h2 className="text-lg font-black tracking-wide text-white">LIVE TERMINAL ACTIVITY</h2>
            </div>
            
            <div className="min-h-[220px] rounded-2xl border border-white/10 bg-[#0F1D29] p-6 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] flex flex-col gap-4">
              {recentActivities.slice(0, 4).map((activity, idx) => (
                <div key={activity.id || idx} className="flex gap-4">
                  <div className="mt-1.5 h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-[#10B981] shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                  <div>
                    <div className="mb-1 text-[10px] font-bold tracking-widest text-slate-500">{new Date(activity.timestamp).toLocaleTimeString()}</div>
                    <div className="font-mono text-[13px] font-medium leading-relaxed text-slate-300">
                      <span className="font-bold text-white">{activity.actor}</span> {activity.message}
                    </div>
                  </div>
                </div>
              ))}
              {recentActivities.length === 0 && (
                <div className="text-sm text-slate-500 italic">No recent activity.</div>
              )}
            </div>
          </motion.section>
        </div>
      </div>
    </>
  );
}
