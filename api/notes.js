import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const REDIS_STORAGE_KEY = process.env.REDIS_STORAGE_KEY || 'encrypted_noteflow_db';

export default async function handler(req, res) {
    const clientSecret = req.headers['x-noteflow-secret'];
    
    const expectedSecret = process.env.VITE_APP_SECRET_KEY || process.env.APP_SECRET_KEY;

    
    if (expectedSecret && clientSecret !== expectedSecret) {
        return res.status(401).json({ error: 'Unauthorized request.' });
    }

    try {
        if (req.method === 'GET') {
            const notes = (await redis.get(REDIS_STORAGE_KEY)) || [];
            return res.status(200).json(notes);
        }

        if (req.method === 'POST') {
            const { encryptedNote } = req.body;
            
            if (!encryptedNote || !encryptedNote.ciphertext || !encryptedNote.id) {
                return res.status(400).json({ error: 'Missing encrypted note in request body or invalid payload structure.' });
            }

            const currentNotes = (await redis.get(REDIS_STORAGE_KEY)) || [];
            const filtered = currentNotes.filter(note => note.id !== encryptedNote.id);
            const updatedNotes = [...filtered, encryptedNote];

            await redis.set(REDIS_STORAGE_KEY, updatedNotes);
            return res.status(200).json({ success: true, id: encryptedNote.id });
        }

        if (req.method === 'DELETE') {
            const { id } = req.query;
            
            if (!id) {
                return res.status(400).json({ error: 'Missing note id in request query.' });
            }
            
            const currentNotes = (await redis.get(REDIS_STORAGE_KEY)) || [];
            const filtered = currentNotes.filter(note => note.id !== id);
            
            await redis.set(REDIS_STORAGE_KEY, filtered);
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed.' });
    } catch (error) {
        console.error('Error in notes API handler:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}