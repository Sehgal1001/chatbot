# Chatbot

The project is branded **Chatbot** throughout the visible interface. The background is a dedicated artwork-only image (no baked-in login form or text) with a slow 150-second full rotation, gentle floating movement, and a subtle pulsing glow. The artwork is enlarged while rotating so empty corners do not appear. The sign-in and sign-up forms remain real HTML controls layered above it.

## Start Chatbot on Windows

1. Install Node.js 18+.
2. Double-click `RUN-CHATBOT.bat` in this folder.
3. The first run may ask to install the Vercel CLI or sign in. Follow the terminal prompts.
4. Keep the terminal window open.
5. Open `http://localhost:3000` in Chrome.

Do not double-click `index.html`: Firebase Authentication does not work on `file://` URLs. If opened directly, the page now explains how to launch the server instead of silently disabling the buttons.

## Firebase account creation

The signup form uses Firebase Email/Password authentication. In Firebase Console → Authentication → Sign-in method, enable **Email/Password**. Under Authentication → Settings → Authorized domains, add `localhost`. Enable Google provider if Google sign-in is wanted.

The Firebase configuration in `js/main.js` is the existing project's configuration. You must have permission to use that Firebase project. If it is not yours or you cannot access it, replace the config with your own Firebase project's web-app config.

## AI chat API

The `/api` endpoints run through the Vercel local runtime. Configure `GEMINI_API_KEY` in Vercel environment variables. Never place secret keys in frontend JavaScript.

## Naming

The visible site title, headings, and chatbot identity are **Chatbot**. The Firebase project ID remains as configured because changing that would break the existing Firebase connection.
