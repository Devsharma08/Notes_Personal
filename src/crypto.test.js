import { encryptNote, decryptNote } from './crypto.js';

async function runUnitTest() {
  console.log("🔒 Starting Crypto Unit Test...");

  const sampleNote = {
    id: "note-101",
    title: "Secret Project Notes",
    description: "Keep this hidden from logs!",
    pointers: ["First bullet point", "Second point"],
    highlights: ["Secret"],
    color: "#fef9c3",
    pinned: true,
  };

  const password = "MyMasterPassword123!";

  // Test 1: Encryption
  console.log("1. Encrypting note...");
  const encrypted = await encryptNote(sampleNote, password);
  console.log("Encrypted Payload (What gets sent to server/database):", encrypted);

  // Test 2: Decryption with Correct Password
  console.log("2. Decrypting with CORRECT password...");
  const decrypted = await decryptNote(encrypted, password);
  console.log("Decrypted Result:", decrypted);
  console.assert(decrypted.title === sampleNote.title, "❌ Title match failed!");
  console.assert(decrypted.description === sampleNote.description, "❌ Description match failed!");

  // Test 3: Decryption with Wrong Password
  console.log("3. Testing WRONG password rejection...");
  try {
    await decryptNote(encrypted, "WrongPassword!");
    console.error("❌ FAILED: Decrypt should have thrown an error for wrong password!");
  } catch (err) {
    console.log("✅ SUCCESS: Correctly rejected wrong password ->", err.message);
  }

  console.log("🎉 All Crypto Unit Tests Passed Successfully!");
}

runUnitTest();