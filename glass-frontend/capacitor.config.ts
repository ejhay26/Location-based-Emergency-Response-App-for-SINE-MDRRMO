import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ph.gov.sine.mdrrmo.emergencyresponse',
  appName: 'MDRRMO EMERGENCY RESPONSE APP',
  webDir: 'www',
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
};

export default config;
