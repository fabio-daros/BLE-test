import { decode as atob, encode as btoa } from 'base-64';

/**
 * Utilitários compartilhados para comunicação BLE
 */

/**
 * Converte string base64 para array de bytes
 */
export function base64ToBytes(value: string | null | undefined): number[] {
  if (!value) return [];
  const binary = atob(value);
  const len = binary.length;
  const bytes = new Array<number>(len);

  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

/**
 * Converte array de bytes para string base64
 */
export function bytesToBase64(bytes: ArrayLike<number>): string {
  const len = bytes.length;
  let binary = '';

  for (let i = 0; i < len; i += 1) {
    const v = bytes[i] as number;
    binary += String.fromCharCode(v);
  }

  return btoa(binary);
}

/**
 * Verifica se um erro é relacionado a conexão GATT
 */
export function isGattConnectionError(error: any): boolean {
  const errorMsg = error?.message || String(error) || '';
  const errorString = String(error).toLowerCase();

  return (
    errorMsg.includes('GATT_ERROR') ||
    errorMsg.includes('status 133') ||
    errorMsg.includes('0x85') ||
    errorMsg.includes('not connected') ||
    errorMsg.includes('disconnected') ||
    errorString.includes('gatt') ||
    errorString.includes('nullpointerexception')
  );
}

/**
 * Formata bytes para string hexadecimal
 */
export function formatBytesAsHex(bytes: number[]): string {
  return bytes.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ');
}

/**
 * Formata bytes para array string
 */
export function formatBytesAsArray(bytes: number[]): string {
  return `[${bytes.map(b => b.toString()).join(', ')}]`;
}

