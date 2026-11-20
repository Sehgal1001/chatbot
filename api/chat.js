
import dotenv from 'dotenv';
import path from 'node:path';
import admin from 'firebase-admin';

// ==========================================
// 1. ENVIRONMENT VARIABLES
// ==========================================

dotenv.config({
    path: path.resolve(process.cwd(), '.env.local')
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FIREBASE_ADMIN_SDK = process.env.FIREBASE_ADMIN_SDK;

if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY missing in .env.local');
}

if (!FIREBASE_ADMIN_SDK) {
    throw new Error('FIREBASE_ADMIN_SDK missing in .env.local');
}

// ==========================================
// 2. FIREBASE ADMIN
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
// 3. GEMINI CONFIGURATION
// ==========================================

// Lightweight model for everyday chatbot responses
const GEMINI_MODEL = 'gemini-3.5-flash-lite';

const callGemini = async (payload) => {

    const apiUrl =
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

    const requestPayload = {
        ...payload,
        generationConfig: {
            maxOutputTokens: 512,
            thinkingConfig: {
                thinkingLevel: 'MINIMAL'
            },
            ...(payload.generationConfig || {})
        }
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(60000)
    });

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error('Gemini returned an invalid response.');
    }

    if (!response.ok) {
        const message =
            data.error?.message ||
            `Gemini API error: ${response.status}`;

        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    return data;
};

// ==========================================
// 4. SYSTEM INSTRUCTION
// ==========================================

const normalizeSystemInstruction = (instruction) => {

    if (!instruction) {
        return undefined;
    }

    if (typeof instruction === 'string') {
        return {
            parts: [{ text: instruction }]
        };
    }

    if (typeof instruction === 'object') {

        if (Array.isArray(instruction.parts)) {

            const parts = instruction.parts
                .map(part => ({
                    text: typeof part === 'string'
                        ? part
                        : part.text
                }))
                .filter(part => typeof part.text === 'string');

            return parts.length ? { parts } : undefined;
        }

        if (typeof instruction.text === 'string') {
            return {
                parts: [{ text: instruction.text }]
            };
        }
    }

    return undefined;
};

// ==========================================
// 5. TOOL SELECTION
// ==========================================

const getSelectedTool = (query) => {

    const text = query.toLowerCase();

    const datePatterns =
        /\b(current time|time now|what time|time in|today's date|date today|what is the date|timezone|time zone)\b/;

    const searchPatterns =
        /\b(search|google|news|headlines|breaking news|latest|current affairs|stock price|cricket score|live score|weather|recent updates|latest updates|today's news|who won|match result)\b/;

    if (datePatterns.test(text)) {
        return 'date_time_query';
    }

    if (searchPatterns.test(text)) {
        return 'web_search';
    }

    return 'general_conversation';
};

// ==========================================
// 6. MAIN API HANDLER
// ==========================================

export default async function handler(req, res) {

    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method Not Allowed'
        });
    }

    try {

        // ======================================
        // 7. AUTHENTICATION
        // ======================================

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

        // ======================================
        // 8. VALIDATE REQUEST
        // ======================================

        const {
            history,
            systemInstruction,
            chatId: currentChatId
        } = req.body || {};

        if (!Array.isArray(history) || history.length === 0) {
            return res.status(400).json({
                error: 'Chat history is missing'
            });
        }

        const lastMessage = history[history.length - 1];

        if (lastMessage.role !== 'user') {
            return res.status(400).json({
                error: 'Last message must be from the user'
            });
        }

        const userQuery = lastMessage.parts
            ?.map(part => part.text || '')
            .join(' ')
            .trim();

        if (!userQuery) {
            return res.status(400).json({
                error: 'User message cannot be empty'
            });
        }

        // ======================================
        // 9. NORMALIZE HISTORY
        // ======================================

        const validHistory = history
            .filter(message =>
                ['user', 'model', 'assistant'].includes(message.role)
            )
            .map(message => ({
                role: message.role === 'assistant'
                    ? 'model'
                    : message.role,

                parts: (message.parts || [])
                    .filter(part => typeof part.text === 'string')
                    .map(part => ({
                        text: part.text
                    }))
            }))
            .filter(message => message.parts.length > 0);

        const normalizedInstruction =
            normalizeSystemInstruction(systemInstruction);

        // ======================================
        // 10. FIRESTORE CHAT
        // ======================================

        const chatsCollection = db
            .collection('users')
            .doc(userId)
            .collection('chats');

        let chatId = currentChatId || null;

        if (!chatId) {

            const chatRef = await chatsCollection.add({
                title: userQuery.substring(0, 50),
                userId,
                createdAt:
                    admin.firestore.FieldValue.serverTimestamp()
            });

            chatId = chatRef.id;

            console.log('New chat created:', chatId);
        }

        // ======================================
        // 11. SELECT TOOL
        // ======================================

        const selectedTool = getSelectedTool(userQuery);

        console.log('Selected tool:', selectedTool);
        console.log('Gemini model:', GEMINI_MODEL);

        let geminiResponseData;

        // ======================================
        // 12. EXECUTE TOOL
        // ======================================

        switch (selectedTool) {

            // ==================================
            // DATE AND TIME
            // ==================================

            case 'date_time_query': {

                const indianTime = new Date().toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    dateStyle: 'full',
                    timeStyle: 'long'
                });

                const datePrompt = `
Current date and time in India:

${indianTime}

User question:
${userQuery}

Answer accurately. If another timezone is requested,
calculate or explain the corresponding local time.
`;

                geminiResponseData = await callGemini({

                    contents: [{
                        role: 'user',
                        parts: [{
                            text: datePrompt
                        }]
                    }],

                    system_instruction: {
                        parts: [{
                            text: 'You are a helpful date and time assistant.'
                        }]
                    }
                });

                break;
            }

            // ==================================
            // WEB SEARCH
            // No Gemini API call
            // ==================================

            case 'web_search': {

                const host =
                    req.headers['x-forwarded-host'] ||
                    req.headers.host;

                if (!host) {
                    throw new Error('Request host is missing');
                }

                const protocol =
                    req.headers['x-forwarded-proto'] || 'http';

                const searchApiUrl =
                    `${protocol}://${host}/api/web-search`;

                console.log('Calling web search API');

                const searchResponse = await fetch(searchApiUrl, {

                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },

                    body: JSON.stringify({
                        query: userQuery
                    }),

                    signal: AbortSignal.timeout(18000)
                });

                const searchData = await searchResponse.json();

                if (!searchResponse.ok || !searchData.success) {
                    throw new Error(
                        searchData.error || 'Web search failed'
                    );
                }

                geminiResponseData = {

                    candidates: [{
                        content: {
                            role: 'model',
                            parts: [{
                                text: searchData.answer ||
                                    'No relevant search results found.'
                            }]
                        },
                        finishReason: 'STOP'
                    }],

                    searchResults: searchData.results || [],

                    searchQueries: searchData.searchQueries || []
                };

                console.log(
                    'Web search results:',
                    (searchData.results || []).length
                );

                break;
            }

            // ==================================
            // NORMAL CHAT
            // ==================================

            case 'general_conversation':
            default: {

                geminiResponseData = await callGemini({

                    contents: validHistory,

                    ...(normalizedInstruction && {
                        system_instruction: normalizedInstruction
                    })
                });

                break;
            }
        }

        // ======================================
        // 13. EXTRACT RESPONSE
        // ======================================

        const candidate =
            geminiResponseData.candidates?.[0];

        const botResponseText =
            candidate?.content?.parts
                ?.map(part => part.text || '')
                .join('\n')
                .trim() || '';

        if (!botResponseText) {
            throw new Error(
                `Gemini returned no text. Finish reason: ${
                    candidate?.finishReason || 'Unknown'
                }`
            );
        }

        // ======================================
        // 14. SAVE TO FIRESTORE
        // ======================================

        const messagesCollection = chatsCollection
            .doc(chatId)
            .collection('messages');

        await messagesCollection.add({
            role: 'user',
            text: userQuery,
            createdAt:
                admin.firestore.FieldValue.serverTimestamp()
        });

        await messagesCollection.add({
            role: 'model',
            text: botResponseText,
            createdAt:
                admin.firestore.FieldValue.serverTimestamp()
        });

        console.log('Conversation saved successfully');

        // ======================================
        // 15. SUCCESS RESPONSE
        // ======================================

        return res.status(200).json({
            ...geminiResponseData,
            chatId
        });

    } catch (error) {

        // ======================================
        // 16. ERROR HANDLING
        // ======================================

        console.error('Chat API error:', error);

        let statusCode = 500;

        if (error.name === 'TimeoutError') {
            statusCode = 504;
        } else if (error.status === 429) {
            statusCode = 429;
        } else if (error.status >= 400 && error.status < 500) {
            statusCode = error.status;
        }

        return res.status(statusCode).json({
            error: error.message ||
                'An unexpected server error occurred.'
        });
    }
}
