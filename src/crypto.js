
// Cross-environment Web Crypto reference
const webCrypto = globalThis.crypto;

// Converts a string passphrase + salt into a 256-bit AES-GCM CryptoKey
async function deriveKey(passphrase, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await webCrypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return webCrypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a JavaScript object (e.g., Note object) using a Master Password.
 */
export async function encryptNote(noteData, masterPassword) {
  const encoder = new TextEncoder();
  
  // 1. Generate cryptographic salt (16 bytes) & IV/Nonce (12 bytes)
  const salt = webCrypto.getRandomValues(new Uint8Array(16));
  const iv = webCrypto.getRandomValues(new Uint8Array(12));

  // 2. Derive 256-bit key from password + salt
  const key = await deriveKey(masterPassword, salt);

  // 3. Encrypt the JSON stringified note
  const jsonString = JSON.stringify(noteData);
  const encryptedBuffer = await webCrypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encoder.encode(jsonString)
  );

  // 4. Convert ArrayBuffers to Base64 strings for JSON transport
  return {
    id: noteData.id,
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Decrypts a Base64 payload back into the original Note object.
 */
export async function decryptNote(encryptedPayload, masterPassword) {
  const decoder = new TextDecoder();

  try {
    const salt = Uint8Array.from(atob(encryptedPayload.salt), (c) => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(encryptedPayload.iv), (c) => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(encryptedPayload.ciphertext), (c) => c.charCodeAt(0));

    const key = await deriveKey(masterPassword, salt);

    const decryptedBuffer = await webCrypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );

    return JSON.parse(decoder.decode(decryptedBuffer));
  } catch (error) {
    throw new Error("Decryption failed: Invalid password or corrupted payload.");
  }
}