
// File: api/get-messages.js

import dotenv from 'dotenv';
import path from 'node:path';
import admin from 'firebase-admin';

// ==========================================
// 1. LOAD ENVIRONMENT VARIABLES
// ==========================================

dotenv.config({
    path: path.resolve(process.cwd(), '.env.local')
});

const FIREBASE_ADMIN_SDK = process.env.FIREBASE_ADMIN_SDK;

if (!FIREBASE_ADMIN_SDK) {
    throw new Error(
        'FIREBASE_ADMIN_SDK missing in .env.local'
    );
}

// ==========================================
// 2. INITIALIZE FIREBASE ADMIN
// ==========================================

if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(FIREBASE_ADMIN_SDK);

        serviceAccount.private_key =
            serviceAccount.private_key?.replace(/\\n/g, '\n');

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

// ==========================================
// 3. MAIN API HANDLER
// ==========================================

export default async function handler(req, res) {

    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method Not Allowed'
        });
    }

    try {

        // 4. Authenticate user
        const authHeader = req.headers.authorization || '';

        const token = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : null;

        if (!token) {
            return res.status(401).json({
                error: 'Unauthorized: No token provided'
            });
        }

        let decodedToken;

        try {
            decodedToken = await admin.auth().verifyIdToken(token);
        } catch (error) {
            console.error('Token verification failed:', error);

            return res.status(401).json({
                error: 'Unauthorized: Invalid token'
            });
        }

        const userId = decodedToken.uid;

        // 5. Get chat ID
        const { chatId } = req.body || {};

        if (
            typeof chatId !== 'string' ||
            !chatId.trim()
        ) {
            return res.status(400).json({
                error: 'Valid Chat ID is required'
            });
        }

        // 6. Fetch messages from Firestore
        const messagesRef = db
            .collection('users')
            .doc(userId)
            .collection('chats')
            .doc(chatId)
            .collection('messages');

        const snapshot = await messagesRef
            .orderBy('createdAt', 'asc')
            .get();

        // 7. Return messages
        const messages = snapshot.docs.map(doc => {
            const data = doc.data();

            return {
                id: doc.id,
                role: data.role,
                text: data.text || '',
                createdAt: data.createdAt
                    ? data.createdAt.toDate().toISOString()
                    : null
            };
        });

        return res.status(200).json(messages);

    } catch (error) {

        console.error('Get messages API error:', error);

        return res.status(500).json({
            error: error.message ||
                'Failed to fetch messages'
        });
    }
}
