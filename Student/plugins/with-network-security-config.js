const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const NETWORK_SECURITY_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Default: Strictly enforce HTTPS for all production domains (e.g. Render, Supabase, Neon) -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>

    <!-- Cleartext HTTP permitted strictly for local development and Android emulator loopbacks -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">10.0.3.2</domain>
    </domain-config>
</network-security-config>
`;

/**
 * Expo Config Plugin to configure Android Network Security and Permissions:
 * 1. Ensures android.permission.INTERNET and ACCESS_NETWORK_STATE are present.
 * 2. Attaches android:networkSecurityConfig="@xml/network_security_config" to <application>.
 * 3. Writes res/xml/network_security_config.xml during Android prebuild.
 */
const withNetworkSecurityConfig = (config) => {
  // 1. Modify AndroidManifest.xml
  config = withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;

    // Ensure permissions array exists
    if (!manifest["uses-permission"]) {
      manifest["uses-permission"] = [];
    }

    const permissions = manifest["uses-permission"];
    const requiredPermissions = [
      "android.permission.INTERNET",
      "android.permission.ACCESS_NETWORK_STATE",
    ];

    requiredPermissions.forEach((perm) => {
      const exists = permissions.some(
        (p) => p.$ && p.$["android:name"] === perm
      );
      if (!exists) {
        permissions.push({
          $: { "android:name": perm },
        });
      }
    });

    // Configure <application> to reference network_security_config
    const app = manifest.application?.[0];
    if (app) {
      if (!app.$) {
        app.$ = {};
      }
      app.$["android:networkSecurityConfig"] =
        "@xml/network_security_config";
    }

    return modConfig;
  });

  // 2. Write network_security_config.xml to res/xml/
  config = withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.platformProjectRoot;
      const resXmlDir = path.join(
        projectRoot,
        "app",
        "src",
        "main",
        "res",
        "xml"
      );

      if (!fs.existsSync(resXmlDir)) {
        fs.mkdirSync(resXmlDir, { recursive: true });
      }

      const filePath = path.join(resXmlDir, "network_security_config.xml");
      fs.writeFileSync(filePath, NETWORK_SECURITY_CONFIG_XML.trim(), "utf8");

      return modConfig;
    },
  ]);

  return config;
};

module.exports = withNetworkSecurityConfig;
