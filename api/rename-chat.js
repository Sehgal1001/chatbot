
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
        console.error('Firebase Admin initialization error:', error);
        throw error;
    }
}

const db = admin.firestore();

// ==========================================
// 3. CREATE TITLE WITHOUT GEMINI
// Saves API quota and response time
// ==========================================

function generateChatTitle(history) {

    const firstUserMessage = history.find(message =>
        message.role === 'user' &&
        Array.isArray(message.parts)
    );

    const originalText = firstUserMessage?.parts
        ?.map(part => part.text || '')
        .join(' ')
        .trim();

    if (!originalText) {
        return 'New Chat';
    }

    const cleanedText = originalText
        .replace(/\s+/g, ' ')
        .replace(/[<>]/g, '')
        .trim();

    const words = cleanedText.split(' ');

    let title = words.slice(0, 6).join(' ');

    if (title.length > 45) {
        title = title.substring(0, 45).trim();
    }

    if (cleanedText.length > title.length) {
        title = title.replace(/[.,!?;:]+$/, '') + '...';
    }

    return title || 'New Chat';
}

// ==========================================
// 4. MAIN API HANDLER
// ==========================================

export default async function handler(req, res) {

    // Only POST requests allowed
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
        // 6. VALIDATE REQUEST DATA
        // ======================================

        const { history, chatId } = req.body || {};

        if (
            !Array.isArray(history) ||
            history.length === 0 ||
            typeof chatId !== 'string' ||
            !chatId.trim()
        ) {
            return res.status(400).json({
                success: false,
                error: 'History and Chat ID are required.'
            });
        }

        // ======================================
        // 7. GENERATE CHAT TITLE
        // ======================================

        const newTitle = generateChatTitle(history);

        // ======================================
        // 8. FIND USER'S CHAT
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
        // 9. UPDATE CHAT TITLE
        // ======================================

        await chatRef.update({
            title: newTitle,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log('Chat renamed successfully:', newTitle);

        // ======================================
        // 10. RETURN RESPONSE
        // ======================================

        return res.status(200).json({
            success: true,
            title: newTitle,
            chatId: chatId
        });

    } catch (error) {

        console.error('Rename chat API error:', error);

        return res.status(500).json({
            success: false,
            error: error.message ||
                'An unexpected error occurred.'
        });
    }
}
