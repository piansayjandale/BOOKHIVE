'use client';

import React, { useState } from 'react';
import {
  Search,
  Mic,
  Upload,
  Zap,
  RefreshCw,
  TrendingUp,
  Activity,
  FileText,
  MessageCircle,
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
      <div
        style={{
          backgroundColor: colors.secondaryNavy,
          borderRadius: '12px',
          padding: '48px 32px',
          marginBottom: '32px',
          color: 'white',
        }}
      >
        {/* Yellow Label */}
        <div
          style={{
            display: 'inline-block',
            backgroundColor: colors.yellow,
            color: colors.primaryNavy,
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '600',
            marginBottom: '16px',
            letterSpacing: '0.5px',
          }}
        >
          ASK GEMINI
        </div>

        {/* Main Text */}
        <h1
          style={{
            fontSize: '32px',
            fontWeight: '700',
            marginBottom: '32px',
            lineHeight: '1.4',
            maxWidth: '600px',
          }}
        >
          Find resources across the entire STI WNU digital ecosystem.
        </h1>

        {/* Search Box */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'white',
            borderRadius: '32px',
            padding: '12px 24px',
            marginBottom: '24px',
            gap: '12px',
          }}
        >
          <Search size={20} color={colors.muted} />
          <input
            type="text"
            placeholder="Search books, authors, subjects..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              color: colors.text,
            }}
          />
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <Mic size={20} color={colors.muted} />
            </button>
            <button
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <Upload size={20} color={colors.muted} />
            </button>
            <button
              style={{
                backgroundColor: colors.yellow,
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                color: colors.primaryNavy,
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Zap size={16} />
              Analyze
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {['Computer Science', 'Engineering', 'Education', 'Business & Accountancy', 'Arts & Sciences'].map(
            (category) => (
              <button
                key={category}
                style={{
                  backgroundColor: 'rgba(255, 214, 0, 0.1)',
                  border: '1px solid rgba(255, 214, 0, 0.2)',
                  color: colors.yellow,
                  borderRadius: '20px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                {category}
              </button>
            )
          )}
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
