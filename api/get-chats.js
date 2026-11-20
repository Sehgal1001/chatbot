
import dotenv from 'dotenv';
import path from 'node:path';
import admin from 'firebase-admin';

// Load environment variables
dotenv.config({
    path: path.resolve(process.cwd(), '.env.local')
});

// Firebase Admin initialization
if (!admin.apps.length) {
    const firebaseCredentials = process.env.FIREBASE_ADMIN_SDK;

    if (!firebaseCredentials) {
        throw new Error('FIREBASE_ADMIN_SDK is missing in .env.local');
    }

    try {
        const serviceAccount = JSON.parse(firebaseCredentials);

        if (serviceAccount.private_key) {
            serviceAccount.private_key =
                serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        console.log('Firebase Admin initialized successfully');
    } catch (error) {
        console.error('Firebase initialization failed:', error);
        throw error;
    }
}

const db = admin.firestore();

// Main API handler
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Method Not Allowed'
        });
    }

    // Verify authentication token
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Unauthorized: No valid token provided'
        });
    }

    const token = authHeader.substring(7);

    let decodedToken;

    try {
        decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
        console.error('Token verification failed:', error);

        return res.status(401).json({
            error: 'Unauthorized: Invalid token'
        });
    }

    try {
        const userId = decodedToken.uid;

        const chatsRef = db
            .collection('users')
            .doc(userId)
            .collection('chats');

        const snapshot = await chatsRef
            .orderBy('createdAt', 'desc')
            .get();

        const chats = snapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title || 'New Chat'
        }));

        return res.status(200).json(chats);

    } catch (error) {
        console.error('Error fetching chat history:', error);

        return res.status(500).json({
            error: 'Failed to fetch chat history.'
        });
    }
}
