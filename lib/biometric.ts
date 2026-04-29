import * as LocalAuthentication from 'expo-local-authentication';

export const Biometric = {
  async isAvailable(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return isEnrolled;
  },

  async getTypeLabel(): Promise<string> {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'empreinte';
    return 'biométrie';
  },

  async authenticate(promptMessage = 'Déverrouille ton compte'): Promise<boolean> {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Annuler',
      fallbackLabel: 'Mot de passe',
      disableDeviceFallback: false,
    });
    return res.success;
  },
};
