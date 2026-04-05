import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.joaoc.apppessoal',
  appName: 'KAIRÓS',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    webContentsDebuggingEnabled: false,
    preferredColorScheme: 'light',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
    },
  },
};

export default config;