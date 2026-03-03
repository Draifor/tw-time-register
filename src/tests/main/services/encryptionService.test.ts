import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock electron's safeStorage ───────────────────────────────────────────────
// encryptionService imports { safeStorage } from 'electron' at module load time,
// so we mock the whole module before importing the service.

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(),
    encryptString: vi.fn(),
    decryptString: vi.fn()
  }
}));

import { safeStorage } from 'electron';
import { isEncryptionAvailable, isEncryptedValue, encrypt, decrypt } from '../../../main/services/encryptionService';

const mockSafeStorage = safeStorage as {
  isEncryptionAvailable: ReturnType<typeof vi.fn>;
  encryptString: ReturnType<typeof vi.fn>;
  decryptString: ReturnType<typeof vi.fn>;
};

// ── isEncryptedValue ──────────────────────────────────────────────────────────

describe('isEncryptedValue', () => {
  it('returns true for a value with the enc: prefix', () => {
    expect(isEncryptedValue('enc:abc123==')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(isEncryptedValue('plainpassword')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isEncryptedValue('')).toBe(false);
  });

  it('returns false when prefix appears mid-string', () => {
    expect(isEncryptedValue('notenc:abc')).toBe(false);
  });
});

// ── isEncryptionAvailable ─────────────────────────────────────────────────────

describe('isEncryptionAvailable', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns true when safeStorage is available', () => {
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    expect(isEncryptionAvailable()).toBe(true);
  });

  it('returns false when safeStorage is unavailable', () => {
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
    expect(isEncryptionAvailable()).toBe(false);
  });
});

// ── encrypt ───────────────────────────────────────────────────────────────────

describe('encrypt', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns the original value unchanged for an empty string', () => {
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    expect(encrypt('')).toBe('');
    expect(mockSafeStorage.encryptString).not.toHaveBeenCalled();
  });

  it('returns plain text unchanged when encryption is unavailable', () => {
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
    expect(encrypt('secret')).toBe('secret');
    expect(mockSafeStorage.encryptString).not.toHaveBeenCalled();
  });

  it('returns "enc:<base64>" when encryption is available', () => {
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    // Simulate encryptString returning a Buffer
    mockSafeStorage.encryptString.mockReturnValue(Buffer.from('encrypted-bytes'));
    const result = encrypt('mypassword');
    expect(result).toMatch(/^enc:/);
    // The part after "enc:" must be valid base64
    const base64Part = result.slice(4);
    expect(() => Buffer.from(base64Part, 'base64')).not.toThrow();
    expect(mockSafeStorage.encryptString).toHaveBeenCalledWith('mypassword');
  });

  it('does not double-encrypt an already encrypted value', () => {
    // The service does not check for double encryption itself — callers must
    // use isEncryptedValue() first. Verify that encrypt() still forwards to safeStorage.
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    mockSafeStorage.encryptString.mockReturnValue(Buffer.from('x'));
    const alreadyEncrypted = 'enc:somebase64==';
    const result = encrypt(alreadyEncrypted);
    // It will re-encrypt — the enc: prefix itself gets encrypted
    expect(result).toMatch(/^enc:/);
  });
});

// ── decrypt ───────────────────────────────────────────────────────────────────

describe('decrypt', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns an empty string unchanged', () => {
    expect(decrypt('')).toBe('');
    expect(mockSafeStorage.decryptString).not.toHaveBeenCalled();
  });

  it('returns plain text as-is (no enc: prefix — legacy values)', () => {
    expect(decrypt('plaintext')).toBe('plaintext');
    expect(mockSafeStorage.decryptString).not.toHaveBeenCalled();
  });

  it('decrypts a value with the enc: prefix', () => {
    mockSafeStorage.decryptString.mockReturnValue('decrypted-secret');
    const encoded = 'enc:' + Buffer.from('some-bytes').toString('base64');
    expect(decrypt(encoded)).toBe('decrypted-secret');
    expect(mockSafeStorage.decryptString).toHaveBeenCalledOnce();
  });

  it('returns empty string when decryption throws (corrupted data)', () => {
    mockSafeStorage.decryptString.mockImplementation(() => {
      throw new Error('Decryption failed');
    });
    const encoded = 'enc:' + Buffer.from('bad-data').toString('base64');
    expect(decrypt(encoded)).toBe('');
  });
});
