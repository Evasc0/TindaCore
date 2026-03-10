import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tindacore.app",
  appName: "tindacore",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
