'use client';

import React, { useState } from 'react';
import {
  Search,
  Upload,
  Zap,
  RefreshCw,
  TrendingUp,
  Activity,
  FileText,
  MessageCircle,
  Paperclip,
  Sparkles,
} from 'lucide-react';

const DashboardPage = () => {
  // Color palette
  const colors = {
    primaryNavy: '#061A2E',
    secondaryNavy: '#0A2540',
    yellow: '#FFD600',
    background: '#F5F7FA',
    text: '#1E293B',
    muted: '#94A3B8',
    green: '#00C853',
    red: '#FF5252',
  };

  // Sample data for borrowing queue
  const borrowingQueue = [
    {
      id: 1,
      avatar: 'AB',
      name: 'Alice Brown',
      book: 'Advanced React Patterns',
      isbn: '978-1491954622',
      time: '2h ago',
    },
    {
      id: 2,
      avatar: 'JD',
      name: 'John Davis',
      book: 'The Pragmatic Programmer',
      isbn: '978-0201616224',
      time: '45m ago',
    },
    {
      id: 3,
      avatar: 'MR',
      name: 'Maria Rodriguez',
      book: 'Clean Code',
      isbn: '978-0132350884',
      time: '30m ago',
    },
    {
      id: 4,
      avatar: 'KP',
      name: 'Kevin Park',
      book: 'Design Patterns',
      isbn: '978-0201633610',
      time: '15m ago',
    },
  ];

  // Sample trending records
  const trendingRecords = [
    { title: 'Python for Data Science', borrows: '2,341', increase: '+15%' },
    { title: 'Web Development Basics', borrows: '1,892', increase: '+8%' },
    { title: 'Machine Learning Guide', borrows: '1,654', increase: '+12%' },
  ];

  // Sample activity logs
  const activityLogs = [
    { time: '14:35', message: 'User Alice Brown borrowed "Advanced React Patterns"' },
    { time: '14:28', message: 'System backup completed successfully' },
    { time: '14:12', message: 'New user registration: Maria Rodriguez' },
    { time: '14:05', message: 'User John Davis returned "The Pragmatic Programmer"' },
    { time: '13:58', message: 'Database optimization started' },
  ];

  return (
    <div style={{ backgroundColor: colors.background, minHeight: '100vh', padding: '24px' }}>
      {/* Hero Section */}
      <div className="rounded-[24px] bg-[#14293E] p-8 md:p-10 mb-8">
        {/* Yellow Label */}
        <div className="flex items-center gap-2 text-[#FFD600] mb-4">
          <Sparkles className="h-4 w-4 fill-current" />
          <span className="text-xs font-bold tracking-widest uppercase">
            ASK BOOKHIVE
          </span>
        </div>

        {/* Main Text */}
        <h1 className="mb-8 text-[32px] font-bold tracking-tight text-white md:text-[36px]">
          Find resources across the entire STI WNU digital ecosystem.
        </h1>

        {/* Search Box */}
        <div className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-[#0B1724] px-4 py-3 shadow-inner mb-2">
          <Search className="h-5 w-5 text-slate-400 ml-2" />
          <input
            type="text"
            placeholder="Search by Title, Author, ISBN, or ask a question..."
            className="flex-1 bg-transparent text-[15px] text-white placeholder-slate-500 outline-none"
          />
          
          <div className="flex items-center gap-2">
            <label className="cursor-pointer p-2 text-slate-400 hover:text-white transition rounded-full hover:bg-white/5">
              <Paperclip className="h-5 w-5" />
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,image/*,.txt,.md,.csv,.json"
                multiple
              />
            </label>
            <button
              type="button"
              className="rounded-full bg-[#FFD600] px-6 py-2.5 text-sm font-bold tracking-wide text-[#0A1624] transition hover:bg-[#FCD400]/90 hover:scale-105 active:scale-95"
            >
              ANALYZE
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {/* TOTAL BOOKS */}
        <div
          style={{
            backgroundColor: colors.primaryNavy,
            color: 'white',
            borderRadius: '8px',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px' }}>TOTAL BOOKS</div>
          <div style={{ fontSize: '28px', fontWeight: '700' }}>999,999</div>
        </div>

        {/* ACTIVE USERS */}
        <div
          style={{
            backgroundColor: colors.primaryNavy,
            color: 'white',
            borderRadius: '8px',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px' }}>ACTIVE USERS</div>
          <div style={{ fontSize: '28px', fontWeight: '700' }}>100,000</div>
        </div>

        {/* PENDING REQUESTS */}
        <div
          style={{
            backgroundColor: colors.yellow,
            color: colors.primaryNavy,
            borderRadius: '8px',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>PENDING REQUESTS</div>
          <div style={{ fontSize: '28px', fontWeight: '700' }}>42</div>
        </div>

        {/* OVERDUE ITEMS */}
        <div
          style={{
            backgroundColor: colors.red,
            color: 'white',
            borderRadius: '8px',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '8px' }}>OVERDUE ITEMS</div>
          <div style={{ fontSize: '28px', fontWeight: '700' }}>128</div>
        </div>

        {/* SYSTEM HEALTH */}
        <div
          style={{
            backgroundColor: colors.primaryNavy,
            color: 'white',
            borderRadius: '8px',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px' }}>SYSTEM HEALTH</div>
          <div style={{ fontSize: '28px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            Nominal{' '}
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: colors.green,
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Content - Table and Right Sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
        {/* Left: Borrowing Queue Table */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: colors.text, margin: 0 }}>BORROWING QUEUE</h2>
            <button
              style={{
                backgroundColor: colors.secondaryNavy,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid #E2E8F0',
                  backgroundColor: colors.background,
                }}
              >
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: colors.muted,
                    fontSize: '12px',
                  }}
                >
                  USER
                </th>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: colors.muted,
                    fontSize: '12px',
                  }}
                >
                  BOOK
                </th>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: colors.muted,
                    fontSize: '12px',
                  }}
                >
                  ISBN
                </th>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: colors.muted,
                    fontSize: '12px',
                  }}
                >
                  TIME
                </th>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: colors.muted,
                    fontSize: '12px',
                  }}
                >
                  ACTION
                </th>
              </tr>
            </thead>
            <tbody>
              {borrowingQueue.map((row) => (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: '1px solid #E2E8F0',
                  }}
                >
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: colors.secondaryNavy,
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: '700',
                        }}
                      >
                        {row.avatar}
                      </div>
                      <span style={{ color: colors.text, fontWeight: '500' }}>{row.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px', color: colors.text }}>{row.book}</td>
                  <td style={{ padding: '12px', color: colors.muted, fontSize: '12px' }}>{row.isbn}</td>
                  <td style={{ padding: '12px', color: colors.muted, fontSize: '12px' }}>{row.time}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        style={{
                          backgroundColor: colors.green,
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 12px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600',
                        }}
                      >
                        ACCEPT
                      </button>
                      <button
                        style={{
                          backgroundColor: colors.red,
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 12px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600',
                        }}
                      >
                        DECLINE
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Trending Records Panel */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <TrendingUp size={18} color={colors.secondaryNavy} />
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: colors.text, margin: 0 }}>
                TRENDING RECORDS
              </h3>
            </div>

            {trendingRecords.map((record, idx) => (
              <div key={idx} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <FileText size={16} color={colors.muted} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: colors.text,
                        marginBottom: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {record.title}
                    </div>
                    <div style={{ fontSize: '11px', color: colors.muted, marginBottom: '4px' }}>
                      {record.borrows} borrows
                    </div>
                    <div style={{ fontSize: '11px', color: colors.green, fontWeight: '600' }}>
                      {record.increase}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Live System Activity Panel */}
          <div
            style={{
              backgroundColor: colors.primaryNavy,
              borderRadius: '8px',
              padding: '20px',
              color: 'white',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Activity size={18} color={colors.yellow} />
              <h3 style={{ fontSize: '14px', fontWeight: '700', margin: 0 }}>
                LIVE SYSTEM ACTIVITY
              </h3>
            </div>

            <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
              {activityLogs.map((log, idx) => (
                <div key={idx} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: 'rgba(255, 255, 255, 0.1) 1px solid' }}>
                  <div style={{ color: colors.yellow, fontWeight: '600', fontSize: '11px', marginBottom: '4px' }}>
                    {log.time}
                  </div>
                  <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '11px' }}>
                    {log.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
