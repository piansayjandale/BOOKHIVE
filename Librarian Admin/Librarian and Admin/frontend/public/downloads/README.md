# BookHive Standalone Android APK Storage

Place your compiled production `.apk` file in this directory with the exact filename:
`app-release.apk`

Once placed here, the web server statically serves it at:
`https://yourdomain.com/downloads/app-release.apk`

The web server is configured to deliver this file with:
- MIME Type: `application/vnd.android.package-archive`
- Content-Disposition: `attachment; filename=app-release.apk`
