# BookHive Mobile Application

BookHive is an Expo React Native mobile application for STI West Negros University students.

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

---

## iOS & Android Compatibility Guide

### Why is an APK Android-Only?

- **APK Format**: `.apk` (Android Package Kit) contains compiled DEX bytecode designed exclusively for the Android Runtime (ART/Dalvik) on Linux/Android architecture.
- **iOS Architecture**: Apple iOS devices run Mach-O binaries packaged in `.ipa` (iOS App Store Package) files and cannot execute `.apk` files.
- **Installation Policy**: Android permits direct browser sideloading of `.apk` files ("Install unknown apps"). Apple iOS strictly forbids direct executable file downloads from browsers; apps on iOS must be installed through Apple TestFlight, the App Store, or run inside **Expo Go** or as a **Progressive Web App (PWA)**.

---

### How to Run BookHive on iOS

Because BookHive is built with cross-platform **Expo & React Native**, the application code runs natively on iOS through any of the following methods:

#### Method 1: Instant Native Testing via Expo Go (No Apple Developer Account Required)

1. On your iPhone or iPad, install **Expo Go** from the [Apple App Store](https://apps.apple.com/app/expo-go/id982107779).
2. Start the development server with tunneling:
   ```bash
   npm run dev:tunnel
   # or inside Student:
   npm run start:tunnel
   ```
3. Open the iOS **Camera** app on your iPhone and point it at the terminal QR code.
4. Tap the prompt to open BookHive in **Expo Go**. The app will compile and run natively on your iPhone with full camera scanning and WebSocket support.

#### Method 2: Add to Home Screen via Safari (Instant PWA Experience)

1. Open the BookHive student web portal in **Safari** on your iOS device.
2. Tap the **Share** button (the square icon with an upward arrow at the bottom of the screen).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**. The BookHive icon will appear on your home screen and run in standalone full-screen mode like a native app.

#### Method 3: Build iOS Simulator App (Free via EAS Build)

To test on an iOS simulator (macOS with Xcode):

```bash
# From workspace root:
npm run mobile:build:ios:sim

# Or inside Student:
npm run build:ios:sim
```

This compiles a `.tar.gz` simulator build in the cloud via EAS without requiring an Apple Developer Account.

#### Method 4: Production iOS Build (.ipa) for TestFlight & App Store

To distribute to real iOS devices via Apple TestFlight or the App Store:

```bash
# From workspace root:
npm run mobile:build:ios
# Or production App Store target:
npm run mobile:build:ios:prod
```

> **Note**: Building an installable `.ipa` for distribution on physical iPhones requires an active Apple Developer Program account ($99/year) to sign the app with Apple provisioning profiles.

