# BookHive Student Mobile Application

BookHive Student is an Expo React Native mobile application for STI West Negros University students.

## Features

- **Catalog Discovery & Search**: Search books by title, author, course, category, or keywords with AI prompt suggestions.
- **Borrowing & Reservations**: Request book loans and reservations with automated due-date calculation and status tracking.
- **Digital Library Card**: Scannable student QR code for quick checkouts, verification, and loan status inspection.
- **Account & Profile Management**: Track active loans, return history, violation penalties, and customizable dark/light themes.
- **Real-time Notifications**: Instant updates via WebSocket for reservation approvals, due date reminders, and newly cataloged books.

## Tech Stack

- **Framework**: Expo (SDK 57) / React Native 0.86
- **Routing**: Expo Router
- **Language**: TypeScript
- **Networking**: Axios & Socket.io-client
- **Storage**: AsyncStorage

## Running the Student Application

From the root workspace:

```bash
# Start all services (Backend + Student Mobile)
npm run dev

# Or start specifically for LAN, Tunnel, or Web:
npm run dev:lan
npm run dev:tunnel
npm run dev:web
```

Or navigate directly to the `Student` directory:

```bash
cd Student
npm run start
```

