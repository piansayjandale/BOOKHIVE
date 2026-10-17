# BookHive Mobile Binaries Storage

## 1. Android APK Storage
Place your compiled production `.apk` file in this directory with either filename:
- `bookhive-release.apk` (Recommended)
- `app-release.apk`

Once placed here, Android users can download it directly from `/download`.

---

## 2. Apple iOS IPA Storage (Over-The-Air Wireless Install)
To make BookHive downloadable from a direct link for iOS devices:
1. Compile a signed `.ipa` using an **Ad-Hoc Provisioning Profile** or **Apple Enterprise Profile**:
   ```bash
   cd Student
   npx eas build -p ios --profile preview-device
   ```
2. Place the resulting file in this directory as:
   `bookhive-release.ipa`

3. The server automatically activates Apple's wireless Over-The-Air manifest:
   - Endpoint: `https://yourdomain.com/downloads/manifest.plist`
   - Wireless Install Link:
     `itms-services://?action=download-manifest&url=https://yourdomain.com/downloads/manifest.plist`

When an iPhone user taps the download button on `/download`, iOS prompts:
*"yourdomain.com wants to install 'BookHive'"* and installs it directly to the home screen.

