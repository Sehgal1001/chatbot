
// ==========================================
// 1. FIREBASE INITIALIZATION
// ==========================================

if (window.location.protocol === 'file:') {
    document.addEventListener('DOMContentLoaded', () => {
        alert('Please run RUN-CHATBOT.bat and open http://localhost:3000');
    });
} else {

const firebaseConfig = {
    apiKey: "AIzaSyAhmyORcRD0tybV7hbfe9wojTfUT13W7EA",
    authDomain: "chatbot-aniket.firebaseapp.com",
    projectId: "chatbot-aniket",
    storageBucket: "chatbot-aniket.firebasestorage.app",
    messagingSenderId: "85782300704",
    appId: "1:85782300704:web:e34ff93ad8c13353131445",
    measurementId: "G-M277SFRVV5"
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==========================================
// 2. DOM ELEMENTS
// ==========================================

const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');

const signinView = document.getElementById('signin-view');
const signupView = document.getElementById('signup-view');
const verificationSuccessView = document.getElementById('verification-success-view');

const showSignupViewLinks = document.querySelectorAll('#show-signup-view');
const showSigninViewLinks = document.querySelectorAll('#show-signin-view');

const signinStep1 = document.getElementById('signin-step-1');
const signinStep2 = document.getElementById('signin-step-2');
const signinEmailInput = document.getElementById('signin-email-input');
const signinPasswordInput = document.getElementById('signin-password-input');
const signinBtn = document.getElementById('signin-btn');
const signinEmailLinkBtn = document.getElementById('signin-email-link-btn');
const signinMessage = document.getElementById('signin-message');
const googleSigninBtn = document.getElementById('google-signin-btn');

const signupStep1 = document.getElementById('signup-step-1');
const signupStep2 = document.getElementById('signup-step-2');
const signupEmailInput = document.getElementById('signup-email-input');
const signupPasswordInput = document.getElementById('signup-password-input');
const signupConfirmPasswordInput = document.getElementById('signup-confirm-password-input');
const signupSendLinkBtn = document.getElementById('signup-send-link-btn');
const signupCreateAccountBtn = document.getElementById('signup-create-account-btn');
const signupMessage = document.getElementById('signup-message');

const chatContainer = document.getElementById('chat-container');
const messageList = document.getElementById('message-list');
const newChatPlaceholder = document.getElementById('new-chat-placeholder');
const suggestionChips = document.querySelectorAll('.suggestion-chip');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const stopBtn = document.getElementById('stop-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const chatHistoryList = document.getElementById('chat-history-list');

const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const micBtn = document.getElementById('mic-btn');

const userSettingsBtn = document.getElementById('user-settings-btn');
const userEmailDisplay = document.getElementById('user-email-display');
const userMenuDropdown = document.getElementById('user-menu-dropdown');
const logoutMenuBtn = document.getElementById('logout-menu-btn');

const logoutModal = document.getElementById('logout-modal');
const cancelLogoutBtn = document.getElementById('cancel-logout-btn');
const confirmLogoutBtn = document.getElementById('confirm-logout-btn');

// ==========================================
// 3. SYSTEM INSTRUCTION
// ==========================================

const systemInstruction = {
    role: "system",
    parts: [{
        text: `Your name is Chatbot. You are an intelligent and helpful AI Tutor. Your goal is to provide clear, well-structured, and visually appealing explanations.

Follow these formatting rules strictly:
1. Use headings, bold text, and italics to organize answers.
2. Always enclose code snippets in triple backticks and specify the language.
3. Use KaTeX for mathematical formulas.
4. Use Markdown tables for structured comparisons.
5. Use blockquotes for important notes and tips.
6. Use numbered or bulleted lists for steps and key points.`
    }]
};

// ==========================================
// 4. STATE
// ==========================================

let currentUser = null;
let currentChatHistory = [];
let allChats = [];
let currentChatId = null;
let abortController = null;
let isGenerating = false;

// ==========================================
// 5. AUTH VIEW SWITCHING
// ==========================================

const switchToSignUpView = () => {
    signinView.classList.add('hidden');
    verificationSuccessView.classList.add('hidden');
    signupView.classList.remove('hidden');
};

const switchToSigninView = () => {
    signupView.classList.add('hidden');
    verificationSuccessView.classList.add('hidden');
    signinView.classList.remove('hidden');
};

const switchToVerificationSuccessView = () => {
    signinView.classList.add('hidden');
    signupView.classList.add('hidden');
    verificationSuccessView.classList.remove('hidden');
};

showSignupViewLinks.forEach(link => {
    link.addEventListener('click', event => {
        event.preventDefault();
        switchToSignUpView();
    });
});

showSigninViewLinks.forEach(link => {
    link.addEventListener('click', event => {
        event.preventDefault();
        switchToSigninView();
    });
});

// ==========================================
// 6. AUTH STATE
// ==========================================

auth.onAuthStateChanged(async user => {
    if (user) {
        currentUser = user;

        if (userEmailDisplay) {
            userEmailDisplay.textContent = user.email || 'User';
        }

        authContainer.style.display = 'none';
        appContainer.classList.remove('hidden');

        await loadUserChats();
    } else {
        currentUser = null;
        currentChatId = null;
        currentChatHistory = [];
        allChats = [];

        authContainer.style.display = 'flex';
        appContainer.classList.add('hidden');

        messageList.innerHTML = '';
        chatHistoryList.innerHTML = '';

        if (logoutModal) logoutModal.classList.add('hidden');
        if (userMenuDropdown) userMenuDropdown.classList.add('hidden');

        const settingsModal = document.getElementById(
            'chatbot-user-settings-modal'
        );

        if (settingsModal) settingsModal.remove();
    }
});

// ==========================================
// 7. EMAIL LINK FLOW
// ==========================================

const handleEmailLinkFlow = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get('authToken');
    const email = urlParams.get('email');

    if (authToken && email) {
        fetch('/api/complete-auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                token: authToken
            })
        })
        .then(response => {
            if (response.ok) {
                switchToVerificationSuccessView();
            } else {
                alert('Verification failed. Please try again.');
            }
        })
        .catch(error => {
            console.error('Email verification error:', error);
            alert('Verification failed. Please try again.');
        });

        return;
    }

    if (auth.isSignInWithEmailLink(window.location.href)) {
        let emailForSignUp = window.localStorage.getItem('emailForSignUp');

        if (!emailForSignUp) {
            emailForSignUp = window.prompt(
                'Please provide your email to complete sign-up.'
            );
        }

        if (emailForSignUp) {
            switchToSignUpView();
            signupStep1.classList.add('hidden');
            signupStep2.classList.remove('hidden');
            signupEmailInput.value = emailForSignUp;
            signupEmailInput.disabled = true;
        } else {
            handleAuthError({
                message: 'Could not determine email for sign-up.'
            }, 'signup');
        }

        window.history.replaceState(
            {},
            document.title,
            window.location.pathname
        );
    }
};

// ==========================================
// 8. AUTH ERROR
// ==========================================

const handleAuthError = (error, type = 'signin') => {
    const messageElement =
        type === 'signin' ? signinMessage : signupMessage;

    if (!messageElement) {
        alert(error.message || 'Authentication failed.');
        return;
    }

    messageElement.textContent = `Error: ${error.message}`;
    messageElement.classList.remove('text-green-400');
    messageElement.classList.add('text-red-400');
};

// ==========================================
// 9. SIGN IN
// ==========================================

const handleSignIn = () => {
    auth.signInWithEmailAndPassword(
        signinEmailInput.value.trim(),
        signinPasswordInput.value
    ).catch(error => handleAuthError(error, 'signin'));
};

// ==========================================
// 10. GOOGLE SIGN IN
// ==========================================

const handleGoogleSignIn = () => {
    const provider = new firebase.auth.GoogleAuthProvider();

    auth.signInWithPopup(provider)
        .catch(error => handleAuthError(error, 'signin'));
};

// ==========================================
// 11. PASSWORDLESS SIGN IN
// ==========================================

const handlePasswordlessSignIn = () => {
    const email = signinEmailInput.value.trim();

    if (!email) {
        alert('Please enter your email address.');
        return;
    }

    const url =
        `${window.location.origin}${window.location.pathname}?authToken=token_${Date.now()}&email=${encodeURIComponent(email)}`;

    const actionCodeSettings = {
        url,
        handleCodeInApp: true
    };

    auth.sendSignInLinkToEmail(email, actionCodeSettings)
        .then(() => {
            window.localStorage.setItem('emailForSignIn', email);
            signinStep1.classList.add('hidden');
            signinStep2.classList.remove('hidden');
        })
        .catch(error => handleAuthError(error, 'signin'));
};

// ==========================================
// 12. SIGN UP
// ==========================================

const handleSignUpSendLink = () => {
    const email = signupEmailInput.value.trim();
    const password = signupPasswordInput.value;
    const confirmPassword = signupConfirmPasswordInput.value;

    if (!email || !signupEmailInput.checkValidity()) {
        handleAuthError({
            message: 'Please enter a valid email address.'
        }, 'signup');
        return;
    }

    if (password.length < 6) {
        handleAuthError({
            message: 'Password must be at least 6 characters.'
        }, 'signup');
        return;
    }

    if (password !== confirmPassword) {
        handleAuthError({
            message: 'Passwords do not match.'
        }, 'signup');
        return;
    }

    signupSendLinkBtn.disabled = true;
    signupSendLinkBtn.textContent = 'Creating account...';

    auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
            signupMessage.textContent =
                'Your account has been created successfully.';
            signupMessage.classList.remove('text-red-400');
            signupMessage.classList.add('text-green-400');
        })
        .catch(error => handleAuthError(error, 'signup'))
        .finally(() => {
            signupSendLinkBtn.disabled = false;
            signupSendLinkBtn.textContent = 'Create Account';
        });
};

const handleCreateAccount = () => {
    const password = signupPasswordInput.value;
    const confirmPassword = signupConfirmPasswordInput.value;
    const email = window.localStorage.getItem('emailForSignUp');

    if (!email) {
        handleAuthError({
            message: 'Could not find your verified email.'
        }, 'signup');
        return;
    }

    if (password !== confirmPassword) {
        handleAuthError({
            message: 'Passwords do not match.'
        }, 'signup');
        return;
    }

    if (password.length < 6) {
        handleAuthError({
            message: 'Password should be at least 6 characters.'
        }, 'signup');
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
            window.localStorage.removeItem('emailForSignUp');
        })
        .catch(error => handleAuthError(error, 'signup'));
};

// ==========================================
// 13. LOGOUT FUNCTION
// ==========================================

const handleSignOut = async () => {
    try {
        if (confirmLogoutBtn) {
            confirmLogoutBtn.disabled = true;
            confirmLogoutBtn.textContent = 'Logging out...';
        }

        if (abortController) {
            abortController.abort();
        }

        await auth.signOut();

        currentUser = null;
        currentChatId = null;
        currentChatHistory = [];
        allChats = [];

        if (logoutModal) {
            logoutModal.classList.add('hidden');
        }

        if (userMenuDropdown) {
            userMenuDropdown.classList.add('hidden');
        }

    } catch (error) {
        console.error('Sign out error:', error);
        alert(error.message || 'Could not log out. Please try again.');
    } finally {
        if (confirmLogoutBtn) {
            confirmLogoutBtn.disabled = false;
            confirmLogoutBtn.textContent = 'Logout';
        }
    }
};

// ==========================================
// 14. USER SETTINGS MODAL
// ==========================================

function openUserSettings() {
    let modal = document.getElementById('chatbot-user-settings-modal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'chatbot-user-settings-modal';

        modal.className =
            'fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4';

        modal.innerHTML = `
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="chatbot-settings-title"
                class="w-full max-w-md rounded-2xl border border-gray-600 bg-slate-900 p-6 text-white shadow-2xl"
            >
                <div class="mb-5 flex items-center justify-between gap-4">
                    <h2 id="chatbot-settings-title"
                        class="text-xl font-bold">
                        User Settings
                    </h2>

                    <button
                        type="button"
                        id="chatbot-settings-close"
                        aria-label="Close settings"
                        class="rounded-lg px-3 py-1 text-2xl text-gray-300 hover:bg-slate-700"
                    >&times;</button>
                </div>

                <div class="mb-5">
                    <p class="mb-1 text-sm text-gray-400">
                        Signed in as
                    </p>

                    <p id="chatbot-settings-email"
                        class="break-all font-medium"></p>
                </div>

                <div class="rounded-xl bg-slate-800 p-4">
                    <h3 class="mb-2 font-semibold">Password</h3>

                    <p class="mb-4 text-sm text-gray-300">
                        Send a password reset link to your registered email address.
                    </p>

                    <button
                        type="button"
                        id="chatbot-reset-password"
                        class="w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold hover:bg-indigo-500 disabled:opacity-60"
                    >
                        Send password reset email
                    </button>

                    <p
                        id="chatbot-settings-message"
                        class="mt-3 text-sm"
                        aria-live="polite"
                    ></p>
                </div>

                <div class="mt-5 rounded-xl border border-red-500/30 bg-red-950/30 p-4">
                    <h3 class="mb-2 font-semibold">Account</h3>

                    <p class="mb-4 text-sm text-gray-300">
                        Sign out of your Chatbot account on this device.
                    </p>

                    <button
                        type="button"
                        id="chatbot-settings-logout"
                        class="w-full rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                    >
                        <i class="fas fa-sign-out-alt mr-2"></i>
                        Logout
                    </button>
                </div>

                <button
                    type="button"
                    id="chatbot-settings-done"
                    class="mt-5 w-full rounded-lg bg-slate-700 px-4 py-2 font-semibold hover:bg-slate-600"
                >
                    Done
                </button>
            </section>
        `;

        document.body.appendChild(modal);

        const closeModal = () => modal.remove();

        modal.addEventListener('click', event => {
            if (
                event.target === modal ||
                event.target.id === 'chatbot-settings-close' ||
                event.target.id === 'chatbot-settings-done'
            ) {
                closeModal();
            }
        });

        // LOGOUT BUTTON INSIDE SETTINGS
        modal.querySelector('#chatbot-settings-logout')
            .addEventListener('click', async event => {

                const button = event.currentTarget;

                if (!window.confirm('Are you sure you want to log out?')) {
                    return;
                }

                button.disabled = true;
                button.textContent = 'Logging out...';

                await handleSignOut();

                if (!currentUser) {
                    modal.remove();
                } else {
                    button.disabled = false;
                    button.textContent = 'Logout';
                }
            });

        // PASSWORD RESET BUTTON
        modal.querySelector('#chatbot-reset-password')
            .addEventListener('click', async event => {

                const button = event.currentTarget;
                const message =
                    modal.querySelector('#chatbot-settings-message');

                const email = currentUser?.email;

                if (!email) {
                    message.textContent =
                        'No email address is available.';
                    message.className =
                        'mt-3 text-sm text-red-400';
                    return;
                }

                button.disabled = true;
                button.textContent = 'Sending...';
                message.textContent = '';

                try {
                    await auth.sendPasswordResetEmail(email);

                    message.textContent =
                        `Password reset email sent to ${email}.`;

                    message.className =
                        'mt-3 text-sm text-green-400';

                } catch (error) {
                    console.error('Password reset error:', error);

                    message.textContent =
                        error.message || 'Could not send reset email.';

                    message.className =
                        'mt-3 text-sm text-red-400';

                } finally {
                    button.disabled = false;
                    button.textContent = 'Send password reset email';
                }
            });
    }

    const emailElement =
        modal.querySelector('#chatbot-settings-email');

    if (emailElement) {
        emailElement.textContent =
            currentUser?.email || 'Not signed in';
    }

    if (userMenuDropdown) {
        userMenuDropdown.classList.add('hidden');
    }
}

// ==========================================
// 15. CHAT HISTORY
// ==========================================

const renderChatHistoryList = () => {
    chatHistoryList.innerHTML = '';

    allChats.forEach(chat => {
        const item = document.createElement('div');
        item.classList.add('history-item', 'relative');

        const link = document.createElement('a');
        link.href = '#';
        link.textContent = chat.title || 'New Chat';

        link.classList.add(
            'block',
            'p-3',
            'rounded-lg',
            'truncate',
            'hover:bg-gray-700'
        );

        if (chat.id === currentChatId) {
            link.classList.add('bg-gray-700/50');
        }

        link.onclick = event => {
            event.preventDefault();
            loadChat(chat.id);
            closeSidebar();
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';

        deleteBtn.classList.add(
            'delete-btn',
            'absolute',
            'right-2',
            'top-1/2',
            '-translate-y-1/2',
            'text-gray-400',
            'hover:text-red-500',
            'p-1'
        );

        deleteBtn.onclick = event => {
            event.stopPropagation();
            deleteChat(chat.id);
        };

        item.appendChild(link);
        item.appendChild(deleteBtn);
        chatHistoryList.append(item);
    });
};

// ==========================================
// 16. RENDER CHAT MESSAGES
// ==========================================

const renderChatMessages = () => {
    if (currentChatHistory.length <= 1) {
        messageList.classList.add('hidden');
        newChatPlaceholder.classList.remove('hidden');
        newChatPlaceholder.classList.add('flex');
        return;
    }

    messageList.classList.remove('hidden');
    newChatPlaceholder.classList.add('hidden');
    newChatPlaceholder.classList.remove('flex');

    let messagesHTML = '';

    currentChatHistory.forEach(msg => {
        if (msg.role === 'system') return;

        const sender = msg.role === 'user' ? 'user' : 'bot';
        const textContent = msg.parts?.[0]?.text || '';

        const sanitizedText = textContent
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const messageContent =
            sender === 'bot'
                ? marked.parse(textContent)
                : sanitizedText;

        const wrapperClass =
            `flex ${sender === 'user' ? 'justify-end' : 'justify-start'}`;

        const bubbleClass =
            `chat-bubble ${sender === 'user' ? 'user-bubble' : 'bot-bubble'}`;

        messagesHTML += `
            <div class="${wrapperClass}">
                <div class="${bubbleClass}">
                    ${messageContent}
                </div>
            </div>
        `;
    });

    messageList.innerHTML = messagesHTML;

    messageList.querySelectorAll('.bot-bubble table').forEach(table => {
        const wrapper = document.createElement('div');
        wrapper.className = 'table-wrapper';

        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
    });

    renderMathInElement(messageList, {
        delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
        ]
    });

    messageList.querySelectorAll('pre code').forEach(element => {
        Prism.highlightElement(element);
    });

    chatContainer.scrollTop = chatContainer.scrollHeight;
};

// ==========================================
// 17. APPEND MESSAGE
// ==========================================

function appendMessage(message, sender) {
    const messageWrapper = document.createElement('div');

    messageWrapper.classList.add(
        'flex',
        sender === 'user' ? 'justify-end' : 'justify-start'
    );

    const messageBubble = document.createElement('div');

    messageBubble.classList.add(
        'chat-bubble',
        sender === 'user' ? 'user-bubble' : 'bot-bubble'
    );

    if (sender === 'user') {
        messageBubble.textContent = message;
    } else {
        messageBubble.innerHTML = message;

        renderMathInElement(messageBubble, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false }
            ]
        });

        messageBubble.querySelectorAll('pre code').forEach(element => {
            Prism.highlightElement(element);
        });
    }

    messageWrapper.appendChild(messageBubble);
    messageList.appendChild(messageWrapper);

    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ==========================================
// 18. TYPING INDICATOR
// ==========================================

function showTypingIndicator(show) {
    let indicator = messageList.querySelector('#typing-indicator');

    if (show) {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'typing-indicator';
            indicator.classList.add('flex', 'justify-start');

            indicator.innerHTML = `
                <div class="chat-bubble bot-bubble p-4 rounded-2xl shadow-md">
                    <div class="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            `;

            messageList.appendChild(indicator);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    } else if (indicator) {
        indicator.remove();
    }
}

// ==========================================
// 19. NEW CHAT
// ==========================================

const startNewChat = () => {
    currentChatId = null;
    currentChatHistory = [systemInstruction];

    renderChatMessages();
    renderChatHistoryList();
    closeSidebar();
};

// ==========================================
// 20. LOAD USER CHATS
// ==========================================

async function loadUserChats() {
    if (!currentUser) return;

    try {
        const token = await currentUser.getIdToken();

        const response = await fetch('/api/get-chats', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load chats.');
        }

        allChats = await response.json();

        renderChatHistoryList();

        if (allChats.length > 0) {
            await loadChat(allChats[0].id);
        } else {
            startNewChat();
        }

    } catch (error) {
        console.error('Error loading user chats:', error);
    }
}

// ==========================================
// 21. LOAD CHAT
// ==========================================

const loadChat = async chatId => {
    if (!currentUser) return;

    currentChatId = chatId;

    renderChatHistoryList();
    messageList.innerHTML = '';

    showTypingIndicator(true);

    try {
        const token = await currentUser.getIdToken();

        const response = await fetch('/api/get-messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ chatId })
        });

        if (!response.ok) {
            throw new Error('Failed to load messages.');
        }

        const messages = await response.json();

        currentChatHistory = [systemInstruction];

        messages.forEach(msg => {
            currentChatHistory.push({
                role: msg.role,
                parts: [{ text: msg.text }]
            });
        });

        renderChatMessages();

    } catch (error) {
        console.error('Error loading chat messages:', error);

        appendMessage(
            '<strong>Error:</strong> Could not load this conversation.',
            'bot'
        );

    } finally {
        showTypingIndicator(false);
    }
};

// ==========================================
// 22. DELETE CHAT
// ==========================================

const deleteChat = async chatId => {
    if (!currentUser) return;

    const confirmed = window.confirm(
        'Are you sure you want to delete this chat?'
    );

    if (!confirmed) return;

    try {
        const token = await currentUser.getIdToken();

        const response = await fetch('/api/delete-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ chatId })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to delete chat.');
        }

        allChats = allChats.filter(chat => chat.id !== chatId);

        if (currentChatId === chatId) {
            if (allChats.length > 0) {
                await loadChat(allChats[0].id);
            } else {
                startNewChat();
            }
        }

        renderChatHistoryList();

    } catch (error) {
        console.error('Error deleting chat:', error);
        alert(error.message || 'Could not delete the chat.');
    }
};

// ==========================================
// 23. CHAT TITLE
// ==========================================

function isSubstantialMessage(message) {
    const genericGreetings = ['hi', 'hello', 'hey', 'yo', 'sup'];

    const normalizedMessage = message
        .toLowerCase()
        .trim()
        .replace(/[.,!?;]/g, '');

    return (
        !genericGreetings.includes(normalizedMessage) ||
        message.split(' ').length > 3
    );
}

async function renameChatWithAI(chatId, chatHistory) {
    if (!currentUser) return;

    try {
        const token = await currentUser.getIdToken();

        const response = await fetch('/api/rename-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                history: chatHistory.slice(1, 5),
                chatId
            })
        });

        if (!response.ok) return;

        const result = await response.json();

        if (result.title) {
            const chatInState = allChats.find(
                chat => chat.id === chatId
            );

            if (chatInState) {
                chatInState.title = result.title;
            }

            renderChatHistoryList();
        }

    } catch (error) {
        console.error('Error auto-renaming chat:', error);
    }
}

// ==========================================
// 24. SEND MESSAGE
// ==========================================

async function handleSendMessage() {
    if (isGenerating || !currentUser) return;

    const userMessage = userInput.value.trim();

    if (!userMessage) return;

    isGenerating = true;

    const isNewChat = !currentChatId;

    currentChatHistory.push({
        role: 'user',
        parts: [{ text: userMessage }]
    });

    renderChatMessages();

    userInput.value = '';

    showTypingIndicator(true);

    sendBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');

    abortController = new AbortController();

    try {
        const token = await currentUser.getIdToken();

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                history: currentChatHistory.slice(1),
                systemInstruction,
                chatId: currentChatId
            }),
            signal: abortController.signal
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Chat API request failed.');
        }

        if (isNewChat && result.chatId) {
            currentChatId = result.chatId;

            allChats.unshift({
                id: result.chatId,
                title: userMessage.substring(0, 45) || 'New Chat'
            });

            renderChatHistoryList();
        }

        const botMessage =
            result.candidates?.[0]?.content?.parts
                ?.map(part => part.text || '')
                .join('\n')
                .trim() || 'Sorry, something went wrong.';

        currentChatHistory.push({
            role: 'model',
            parts: [{ text: botMessage }]
        });

        showTypingIndicator(false);
        renderChatMessages();

        const currentChatObject = allChats.find(
            chat => chat.id === currentChatId
        );

        if (
            currentChatObject &&
            currentChatObject.title === 'New Chat' &&
            isSubstantialMessage(userMessage)
        ) {
            renameChatWithAI(currentChatId, currentChatHistory);
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            appendMessage('Generation stopped.', 'bot');
        } else {
            console.error('Error calling chat API:', error);

            appendMessage(
                `<strong>Error:</strong> ${error.message}`,
                'bot'
            );
        }

    } finally {
        showTypingIndicator(false);

        sendBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');

        isGenerating = false;
        abortController = null;
    }
}

// ==========================================
// 25. STOP GENERATION
// ==========================================

function handleStopGeneration() {
    if (abortController) {
        abortController.abort();
    }
}

// ==========================================
// 26. SUGGESTION CHIPS
// ==========================================

const handleSuggestionClick = event => {
    const text = event.currentTarget.textContent.trim();

    userInput.value = text;
    handleSendMessage();
};

// ==========================================
// 27. USER SETTINGS AND LOGOUT BUTTONS
// ==========================================

if (userSettingsBtn) {
    userSettingsBtn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openUserSettings();
    });
}

if (logoutMenuBtn) {
    logoutMenuBtn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();

        if (userMenuDropdown) {
            userMenuDropdown.classList.add('hidden');
        }

        if (logoutModal) {
            logoutModal.classList.remove('hidden');
        } else {
            if (window.confirm('Are you sure you want to log out?')) {
                handleSignOut();
            }
        }
    });
}

if (cancelLogoutBtn) {
    cancelLogoutBtn.addEventListener('click', () => {
        if (logoutModal) {
            logoutModal.classList.add('hidden');
        }
    });
}

if (confirmLogoutBtn) {
    confirmLogoutBtn.addEventListener('click', handleSignOut);
}

if (logoutModal) {
    logoutModal.addEventListener('click', event => {
        if (event.target === logoutModal) {
            logoutModal.classList.add('hidden');
        }
    });
}

// ==========================================
// 28. SIDEBAR
// ==========================================

const openSidebar = () => {
    sidebar.classList.remove('-translate-x-full');
    sidebarOverlay.classList.remove('hidden');
};

const closeSidebar = () => {
    sidebar.classList.add('-translate-x-full');
    sidebarOverlay.classList.add('hidden');
};

if (menuBtn) {
    menuBtn.addEventListener('click', openSidebar);
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
}

// ==========================================
// 29. VOICE INPUT
// ==========================================

const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition;

if (SpeechRecognition && micBtn) {
    recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    let isRecognizing = false;

    micBtn.addEventListener('click', () => {
        if (isRecognizing) {
            recognition.stop();
            return;
        }

        try {
            recognition.start();
        } catch (error) {
            console.error('Speech recognition start error:', error);
        }
    });

    recognition.onstart = () => {
        isRecognizing = true;

        micBtn.classList.add('text-red-500');

        const icon = micBtn.querySelector('i');
        if (icon) icon.classList.add('fa-beat');

        userInput.placeholder = 'Listening...';
    };

    recognition.onend = () => {
        isRecognizing = false;

        micBtn.classList.remove('text-red-500');

        const icon = micBtn.querySelector('i');
        if (icon) icon.classList.remove('fa-beat');

        userInput.placeholder = 'Ask me anything...';
    };

    recognition.onresult = event => {
        userInput.value = event.results[0][0].transcript;
    };

    recognition.onerror = event => {
        console.error('Speech recognition error:', event.error);
        userInput.placeholder = "Sorry, I couldn't hear that.";
    };

} else if (micBtn) {
    console.log('Speech recognition not supported in this browser.');
    micBtn.style.display = 'none';
}

// ==========================================
// 30. EVENT LISTENERS
// ==========================================

if (signinBtn) {
    signinBtn.addEventListener('click', handleSignIn);
}

if (googleSigninBtn) {
    googleSigninBtn.addEventListener('click', handleGoogleSignIn);
}

if (signinEmailLinkBtn) {
    signinEmailLinkBtn.addEventListener('click', handlePasswordlessSignIn);
}

if (signupSendLinkBtn) {
    signupSendLinkBtn.addEventListener('click', handleSignUpSendLink);
}

if (signupCreateAccountBtn) {
    signupCreateAccountBtn.addEventListener('click', handleCreateAccount);
}

if (sendBtn) {
    sendBtn.addEventListener('click', handleSendMessage);
}

if (stopBtn) {
    stopBtn.addEventListener('click', handleStopGeneration);
}

if (userInput) {
    userInput.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    });
}

if (newChatBtn) {
    newChatBtn.addEventListener('click', startNewChat);
}

suggestionChips.forEach(chip => {
    chip.addEventListener('click', handleSuggestionClick);
});

// ==========================================
// 31. INITIAL SETUP
// ==========================================

handleEmailLinkFlow();

}
