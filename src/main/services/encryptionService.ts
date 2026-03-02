/**
 * encryptionService.ts
 *
 * Thin wrapper around Electron's `safeStorage` API (OS keychain / DPAPI on Windows).
 * Encrypted values are stored as:  "enc:<base64>"
 * Plain-text values without the prefix are returned as-is so that existing DB
 * rows are handled transparently — they are re-encrypted on the next save.
 */

import { safeStorage } from 'electron';

const PREFIX = 'enc:';

/** Returns true if encryption is supported on the current platform. */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

/** Returns true if the stored value was encrypted by this service. */
export function isEncryptedValue(value: string): boolean {
  return value.startsWith(PREFIX);
}

/**
 * Encrypts a plain-text string using the OS keychain (DPAPI on Windows,
 * Keychain on macOS, libsecret on Linux).
 *
 * Returns the original string unchanged when:
 *  - the value is empty (nothing to encrypt), or
 *  - safeStorage is not available on this platform.
 */
export function encrypt(plainText: string): string {
  if (!plainText) return plainText;
  if (!safeStorage.isEncryptionAvailable()) return plainText;
  const encrypted = safeStorage.encryptString(plainText);
  return PREFIX + encrypted.toString('base64');
}

/**
 * Decrypts a value previously produced by `encrypt()`.
 *
 * If the value does not carry the "enc:" prefix it is returned as-is
 * (plain-text fallback for values stored before encryption was introduced).
 */
export function decrypt(value: string): string {
  if (!value || !isEncryptedValue(value)) return value;
  const buffer = Buffer.from(value.slice(PREFIX.length), 'base64');
  return safeStorage.decryptString(buffer);
}
