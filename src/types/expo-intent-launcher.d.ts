declare module 'expo-intent-launcher' {
  export enum ActivityAction {
    BLUETOOTH_SETTINGS = 'android.settings.BLUETOOTH_SETTINGS',
  }

  export function startActivityAsync(
    action: ActivityAction | string,
    data?: Record<string, unknown>
  ): Promise<void>;
}
