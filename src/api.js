import { encryptNote, decryptNote } from './crypto.js';

const BASE_URL = '/api/notes';
const APP_SECRET = import.meta.env.VITE_APP_SECRET_KEY || import.meta.env.VITE_APP_SECRET;

function requireAppSecret() {
  if (!APP_SECRET) {
    throw new Error('VITE_APP_SECRET_KEY or VITE_APP_SECRET is not configured for this deployment.');
  }
}

function requestHeaders(includeJson = false) {
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(APP_SECRET ? { 'x-noteflow-secret': APP_SECRET } : {}),
  };
}

async function readError(response, fallback) {
  const errorData = await response.json().catch(() => ({}));
  return new Error(errorData.error || `${fallback}: ${response.status}`);
}

export const api = {
  async getNotes(masterPassword) {
    requireAppSecret();
    const response = await fetch(BASE_URL, {
      method: 'GET',
      headers: requestHeaders(),
    });

    if (!response.ok) throw await readError(response, 'Failed to fetch notes');

    const encryptedList = await response.json();
    if (!Array.isArray(encryptedList)) {
      throw new Error('The notes API returned an invalid payload. Start the encrypted API server.');
    }

    const decryptedNotes = await Promise.all(
      encryptedList.map(async (item) => {
        try {
          return await decryptNote(item, masterPassword);
        } catch (error) {
          console.error(`Failed to decrypt note ID ${item.id}:`, error);
          return null;
        }
      })
    );

    const validNotes = decryptedNotes.filter((note) => note !== null);
    if (validNotes.length !== encryptedList.length) {
      throw new Error(`Unable to unlock ${encryptedList.length} note${encryptedList.length === 1 ? '' : 's'}. Check the master password.`);
    }

    return validNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  async saveNote(noteData, masterPassword) {
    requireAppSecret();
    const encryptedNote = await encryptNote(noteData, masterPassword);
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: requestHeaders(true),
      body: JSON.stringify({ encryptedNote }),
    });

    if (!response.ok) throw await readError(response, 'Failed to save note');
    return response.json();
  },

  async deleteNote(id) {
    requireAppSecret();
    const response = await fetch(`${BASE_URL}?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: requestHeaders(),
    });

    if (!response.ok) throw await readError(response, 'Failed to delete note');
    return response.json();
  },
};
