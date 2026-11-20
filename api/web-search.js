
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
        console.error('Firebase initialization error:', error);
        throw error;
    }
}

// ==========================================
// 3. HTML HELPERS
// ==========================================

function decodeHtml(value = '') {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, code) =>
            String.fromCodePoint(Number(code))
        )
        .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
            String.fromCodePoint(parseInt(code, 16))
        );
}

function cleanHtml(value = '') {
    return decodeHtml(
        value
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
    ).replace(/\s+/g, ' ').trim();
}

// ==========================================
// 4. EXTRACT REAL RESULT URL
// ==========================================

function extractResultUrl(href) {
    try {
        const url = new URL(
            decodeHtml(href),
            'https://duckduckgo.com'
        );

        const redirectedUrl = url.searchParams.get('uddg');

        const finalUrl = redirectedUrl || url.href;

        if (!/^https?:\/\//i.test(finalUrl)) {
            return null;
        }

        const parsed = new URL(finalUrl);

        // Exclude DuckDuckGo internal links
        if (parsed.hostname.includes('duckduckgo.com')) {
            return null;
        }

        return parsed.href;

    } catch {
        return null;
    }
}

// ==========================================
// 5. DUCKDUCKGO SEARCH
// ==========================================

async function searchWeb(query) {

    const searchUrl =
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html',
            'Accept-Language': 'en-US,en;q=0.9'
        },
        signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
        throw new Error(
            `Search provider returned status ${response.status}`
        );
    }

    const html = await response.text();

    if (
        html.includes('anomaly-modal') ||
        html.includes('bots use DuckDuckGo')
    ) {
        throw new Error(
            'Search provider temporarily blocked this request. Try again later.'
        );
    }

    // Extract result links
    const anchorMatches = [
        ...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)
    ];

    const resultAnchors = anchorMatches.filter(match =>
        /\bclass=["'][^"']*result__a/i.test(match[0])
    );

    // Extract snippets
    const snippetMatches = [
        ...html.matchAll(
            /<(?:a|div|span)\b[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|span)>/gi
        )
    ];

    const results = [];

    for (let i = 0; i < resultAnchors.length; i++) {

        const anchor = resultAnchors[i][0];

        const hrefMatch = anchor.match(
            /\bhref=["']([^"']+)["']/i
        );

        const titleMatch = anchor.match(
            />([\s\S]*?)<\/a>$/i
        );

        if (!hrefMatch || !titleMatch) {
            continue;
        }

        const link = extractResultUrl(hrefMatch[1]);
        const title = cleanHtml(titleMatch[1]);

        const snippet = cleanHtml(
            snippetMatches[i]?.[1] || ''
        );

        if (!link || !title) {
            continue;
        }

        results.push({
            title,
            link,
            snippet
        });

        if (results.length >= 7) {
            break;
        }
    }

    // Remove duplicate URLs
    return [
        ...new Map(
            results.map(result => [
                result.link,
                result
            ])
        ).values()
    ];
}

// ==========================================
// 6. MAIN API HANDLER
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
        // 7. AUTHENTICATION
        // ======================================

        const authHeader =
            req.headers.authorization || '';

        const token = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : null;

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: No token provided'
            });
        }

        try {
            await admin.auth().verifyIdToken(token);

        } catch (error) {
            console.error('Token verification failed:', error);

            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Invalid token'
            });
        }

        // ======================================
        // 8. VALIDATE QUERY
        // ======================================

        const { query } = req.body || {};

        if (
            typeof query !== 'string' ||
            !query.trim()
        ) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
        }

        const cleanQuery = query.trim();

        console.log('DuckDuckGo search requested:', cleanQuery);

        // ======================================
        // 9. SEARCH WEB
        // ======================================

        const results = await searchWeb(cleanQuery);

        if (results.length === 0) {
            return res.status(200).json({
                success: true,
                query: cleanQuery,
                answer: 'No relevant search results were found. Try a different search query.',
                context: 'No relevant search results were found.',
                results: []
            });
        }

        // ======================================
        // 10. BUILD ANSWER AND CONTEXT
        // ======================================

        const answer = results.map((result, index) => {
            return `${index + 1}. [${result.title}](${result.link})\n${result.snippet || 'Open the source to read more.'}`;
        }).join('\n\n');

        const context = results.map((result, index) => {
            return `${index + 1}. ${result.title}\n${result.snippet}\nSource: ${result.link}`;
        }).join('\n\n');

        console.log('Search completed successfully');
        console.log('Results found:', results.length);

        // ======================================
        // 11. RETURN RESULTS
        // ======================================

        return res.status(200).json({
            success: true,
            query: cleanQuery,
            answer,
            context,
            results
        });

    } catch (error) {

        console.error('Web Search API Error:', error);

        return res.status(503).json({
            success: false,
            error: error.name === 'TimeoutError'
                ? 'Search request timed out. Please try again.'
                : error.message || 'Web search is temporarily unavailable.'
        });
    }
}
