
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
    throw new Error('FIREBASE_ADMIN_SDK missing in .env.local');
}

// ==========================================
// 2. FIREBASE ADMIN INITIALIZATION
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
// 3. DELETE MESSAGE SUBCOLLECTION
// ==========================================

async function deleteChatMessages(chatRef) {

    const messagesRef = chatRef.collection('messages');

    while (true) {

        const snapshot = await messagesRef.limit(400).get();

        if (snapshot.empty) {
            break;
        }

        const batch = db.batch();

        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        if (snapshot.size < 400) {
            break;
        }
    }
}

// ==========================================
// 4. MAIN API HANDLER
// ==========================================

export default async function handler(req, res) {

    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method Not Allowed'
        });
    }

    try {

        // ======================================
        // 5. AUTHENTICATE USER
        // ======================================

        const authHeader = req.headers.authorization || '';

        const token = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : null;

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: No token provided'
            });
        }

        let decodedToken;

        try {
            decodedToken = await admin.auth().verifyIdToken(token);

        } catch (error) {
            console.error('Token verification failed:', error);

            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Invalid token'
            });
        }

        const userId = decodedToken.uid;

        // ======================================
        // 6. VALIDATE CHAT ID
        // ======================================

        const { chatId } = req.body || {};

        if (
            typeof chatId !== 'string' ||
            !chatId.trim()
        ) {
            return res.status(400).json({
                success: false,
                error: 'Valid Chat ID is required.'
            });
        }

        // ======================================
        // 7. GET USER'S CHAT
        // ======================================

        const chatRef = db
            .collection('users')
            .doc(userId)
            .collection('chats')
            .doc(chatId);

        const chatSnapshot = await chatRef.get();

        if (!chatSnapshot.exists) {
            return res.status(404).json({
                success: false,
                error: 'Chat not found.'
            });
        }

        // ======================================
        // 8. DELETE CHAT MESSAGES
        // ======================================

        await deleteChatMessages(chatRef);

        // ======================================
        // 9. DELETE CHAT DOCUMENT
        // ======================================

        await chatRef.delete();

        console.log('Chat deleted successfully:', chatId);

        // ======================================
        // 10. SUCCESS RESPONSE
        // ======================================

        return res.status(200).json({
            success: true,
            message: 'Chat and its messages deleted successfully.',
            chatId
        });

    } catch (error) {

        console.error('Delete chat API error:', error);

        return res.status(500).json({
            success: false,
            error: error.message ||
                'Failed to delete chat.'
        });
    }
}
