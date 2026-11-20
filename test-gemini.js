
import dotenv from 'dotenv';

// ==========================================
// 1. LOAD ENVIRONMENT VARIABLES
// ==========================================

dotenv.config({
    path: '.env.local'
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY not found in .env.local');
    process.exit(1);
}

// ==========================================
// 2. GEMINI CONFIGURATION
// ==========================================

const GEMINI_MODEL = 'gemini-3.8-flash';

const API_URL =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

// ==========================================
// 3. TEST PROMPT
// ==========================================

const payload = {
    contents: [{
        role: 'user',
        parts: [{
            text: 'Reply only with: Hello'
        }]
    }],

    generationConfig: {
        maxOutputTokens: 512,
        thinkingConfig: {
            thinkingLevel: 'LOW'
        }
    }
};

// ==========================================
// 4. TEST GEMINI API
// ==========================================

async function testGemini() {

    console.log('\n================================');
    console.log('       GEMINI API TEST');
    console.log('================================\n');

    console.log('Model:', GEMINI_MODEL);
    console.log('Thinking level: LOW');
    console.log('Maximum output tokens: 512');
    console.log('Timeout: 60 seconds\n');

    const startTime = Date.now();

    try {

        console.log('Sending request to Gemini...\n');

        const response = await fetch(API_URL, {

            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify(payload),

            signal: AbortSignal.timeout(60000)
        });

        const elapsedTime = Date.now() - startTime;

        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error('Gemini returned an invalid JSON response.');
        }

        console.log('HTTP Status:', response.status);
        console.log('Time taken:', elapsedTime, 'ms');

        if (!response.ok) {

            console.error('\nGEMINI API ERROR:');

            console.error(
                data.error?.message ||
                JSON.stringify(data, null, 2)
            );

            return;
        }

        // ==================================
        // 5. EXTRACT GENERATED TEXT
        // ==================================

        const candidate = data.candidates?.[0];

        const generatedText =
            candidate?.content?.parts
                ?.map(part => part.text || '')
                .join('')
                .trim() || '';

        console.log('\nFinish reason:', candidate?.finishReason || 'Unknown');

        console.log(
            'Total tokens:',
            data.usageMetadata?.totalTokenCount ?? 'Unavailable'
        );

        console.log(
            'Thinking tokens:',
            data.usageMetadata?.thoughtsTokenCount ?? 'Unavailable'
        );

        // ==================================
        // 6. DISPLAY RESULT
        // ==================================

        if (generatedText) {

            console.log('\n================================');
            console.log('       GEMINI RESPONSE');
            console.log('================================\n');

            console.log(generatedText);

            console.log('\n================================');
            console.log('       TEST SUCCESSFUL');
            console.log('================================');

        } else {

            console.log('\nNo text was generated.');

            console.log(
                'Candidate details:',
                JSON.stringify(candidate, null, 2)
            );
        }

    } catch (error) {

        console.error('\n================================');
        console.error('       TEST FAILED');
        console.error('================================\n');

        console.error('Error name:', error.name);
        console.error('Error message:', error.message);

        console.error(
            'Time taken:',
            Date.now() - startTime,
            'ms'
        );

        if (error.name === 'TimeoutError') {
            console.error(
                '\nGemini did not respond within 60 seconds.'
            );
        }
    }
}

// ==========================================
// 7. RUN TEST
// ==========================================

testGemini();
