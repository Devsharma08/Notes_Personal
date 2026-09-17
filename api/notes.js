import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const REDIS_STORAGE_KEY = process.env.REDIS_STORAGE_KEY || 'encrypted_noteflow_db';

function isEncryptedNote(value) {
    return Boolean(
        value &&
        typeof value.id === 'string' && value.id.length > 0 &&
        typeof value.ciphertext === 'string' && value.ciphertext.length > 0 &&
        typeof value.salt === 'string' && value.salt.length > 0 &&
        typeof value.iv === 'string' && value.iv.length > 0
    );
}

export default async function handler(req, res) {
    const clientSecret = req.headers['x-noteflow-secret'];
    const expectedSecret = process.env.VITE_APP_SECRET_KEY || process.env.APP_SECRET_KEY;

    if (!expectedSecret) {
        return res.status(500).json({ error: 'API secret is not configured.' });
    }

    if (expectedSecret && clientSecret !== expectedSecret) {
        return res.status(401).json({ error: 'Unauthorized request.' });
    }

    try {
        if (req.method === 'GET') {
            const notes = (await redis.get(REDIS_STORAGE_KEY)) || [];
            if (!Array.isArray(notes) || notes.some((note) => !isEncryptedNote(note))) {
                return res.status(500).json({ error: 'Stored notes contain an invalid encrypted payload.' });
            }
            return res.status(200).json(notes);
        }

        if (req.method === 'POST') {
            const { encryptedNote } = req.body;
            
            if (!isEncryptedNote(encryptedNote)) {
                return res.status(400).json({ error: 'Missing encrypted note in request body or invalid payload structure.' });
            }

            const currentNotes = (await redis.get(REDIS_STORAGE_KEY)) || [];
            const filtered = currentNotes.filter(note => note.id !== encryptedNote.id);
            const updatedNotes = [...filtered, encryptedNote];

            await redis.set(REDIS_STORAGE_KEY, updatedNotes);
            return res.status(200).json({ success: true, id: encryptedNote.id, noteCount: updatedNotes.length });
        }

        if (req.method === 'DELETE') {
            const { id } = req.query;
            
            if (!id) {
                return res.status(400).json({ error: 'Missing note id in request query.' });
            }
            
            const currentNotes = (await redis.get(REDIS_STORAGE_KEY)) || [];
            const existed = currentNotes.some(note => note.id === id);
            const filtered = currentNotes.filter(note => note.id !== id);
            
            await redis.set(REDIS_STORAGE_KEY, filtered);
            return res.status(existed ? 200 : 404).json({
                success: existed,
                error: existed ? undefined : 'Note not found.'
            });
        }

        return res.status(405).json({ error: 'Method not allowed.' });
    } catch (error) {
        console.error('Error in notes API handler:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}