
# 🤖 Chatbot

An AI-powered chatbot designed to help users learn, solve problems, and explore new concepts through intelligent conversations.

🌐 **Live Demo:** https://chatbot-aniket.vercel.app

## ✨ Features

- 🤖 AI-powered conversations using Google Gemini
- 🔐 Firebase Authentication
- 💬 Create and manage multiple chats
- 📝 Rename chat conversations
- 🗑️ Delete chat history
- 📚 Store chat history using Cloud Firestore
- 🔎 Google Search integration for updated information
- 📱 Responsive and user-friendly interface
- 🚀 Deployed on Vercel

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| HTML | Structure |
| CSS | Styling and UI |
| JavaScript | Frontend functionality |
| Node.js | Backend runtime |
| Vercel | Hosting and API deployment |
| Google Gemini API | AI responses |
| Firebase Authentication | User authentication |
| Cloud Firestore | Chat storage |

## 📂 Project Structure

```text
Chatbot/
│
├── api/
│   ├── chat.js
│   ├── web-search.js
│   ├── get-chats.js
│   ├── get-messages.js
│   ├── rename-chat.js
│   └── delete-chat.js
│
├── assets/
│
├── js/
│   └── main.js
│
├── index.html
├── package.json
├── package-lock.json
├── README.md
└── .env.local
```

## ⚙️ Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/chatbot.git
```

### 2. Open the project folder

```bash
cd chatbot
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env.local` file in the root directory.

Add the following variables:

```env
GEMINI_API_KEY=your_gemini_api_key
FIREBASE_ADMIN_SDK=your_firebase_admin_service_account_json
```

Replace the example values with your actual credentials.

**Important:** `FIREBASE_ADMIN_SDK` must contain the complete Firebase Admin service-account JSON as a single-line JSON value.

### 5. Run the project locally

```bash
npx vercel dev
```

Open:

```text
http://localhost:3000
```

## 🔥 Firebase Configuration

1. Create a project in Firebase Console.
2. Enable Firebase Authentication.
3. Create a Cloud Firestore database.
4. Generate a Firebase Admin service-account private key.
5. Add the service-account JSON to `FIREBASE_ADMIN_SDK`.

Firebase Console: https://console.firebase.google.com/

## 🚀 Deployment

This project is deployed using Vercel.

To deploy your own version:

```bash
npx vercel link
npx vercel --prod
```

Add the required environment variables in:

**Vercel Dashboard → Project Settings → Environment Variables**

Vercel: https://vercel.com/

## 🔑 API Configuration

Get your Gemini API key from Google AI Studio:

https://aistudio.google.com/apikey

Gemini API usage is subject to Google's rate limits and quotas.

## 🔒 Security

- Never upload `.env.local` to GitHub.
- Never expose Firebase Admin private keys.
- Keep API credentials in environment variables.
- Add secret files to `.gitignore`.

## 🌐 Live Project

**Chatbot:** https://chatbot-aniket.vercel.app

## 👨‍💻 Author

**Aniket Sahgal**

GitHub: https://github.com/Sehgal1001

LinkedIn: https://www.linkedin.com/in/aniket-sahgal-297a67276

---

⭐ If you like this project, consider giving it a star!
