// ============================================
// WHATSAPP WEB CLONE - FRONTEND (app.js)
// Real-Time Messaging with Socket.io
// ============================================

// Configuration
const API_BASE_URL = 'http://localhost:5000';
const SOCKET_SERVER_URL = API_BASE_URL;

// Global State
let socket = null;
let currentUser = null;
let currentChatUserId = null;
let currentChatUserName = null;
let allUsers = [];
let conversations = [];
let messages = {};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initializeTheme();
  checkAuthStatus();
  setupEventListeners();
});

// ============================================
// THEME MANAGEMENT
// ============================================

function initializeTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  if (document.documentElement.classList.contains('dark')) {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  } else {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }
});

// ============================================
// AUTHENTICATION
// ============================================

function checkAuthStatus() {
  const authToken = localStorage.getItem('authToken');
  const userData = localStorage.getItem('currentUser');

  if (authToken && userData) {
    currentUser = JSON.parse(userData);
    hideAuthModal();
    initializeApp();
  } else {
    showAuthModal();
  }
}

function showAuthModal() {
  document.getElementById('auth-modal').classList.remove('hidden');
  document.getElementById('auth-modal').style.display = 'flex';
}

function hideAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
  document.getElementById('auth-modal').style.display = 'none';
}

document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();

  if (!email || !password) {
    showAuthError('Please fill in all fields');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      currentUser = data.user;
      showAuthSuccess('Login successful! Loading app...');
      setTimeout(() => {
        hideAuthModal();
        initializeApp();
      }, 1500);
    } else {
      showAuthError(data.message || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    showAuthError('Connection error. Please try again.');
  }
});

document.getElementById('signup-btn').addEventListener('click', async () => {
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value.trim();
  const confirmPassword = document.getElementById('signup-confirm').value.trim();

  if (!name || !email || !password || !confirmPassword) {
    showAuthError('Please fill in all fields');
    return;
  }

  if (password !== confirmPassword) {
    showAuthError('Passwords do not match');
    return;
  }

  if (password.length < 6) {
    showAuthError('Password must be at least 6 characters');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      currentUser = data.user;
      showAuthSuccess('Account created! Logging you in...');
      setTimeout(() => {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('signup-form').classList.add('hidden');
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('signup-name').value = '';
        document.getElementById('signup-email').value = '';
        document.getElementById('signup-password').value = '';
        document.getElementById('signup-confirm').value = '';
        hideAuthModal();
        initializeApp();
      }, 1500);
    } else {
      showAuthError(data.message || 'Signup failed');
    }
  } catch (error) {
    console.error('Signup error:', error);
    showAuthError('Connection error. Please try again.');
  }
});

document.getElementById('signup-toggle').addEventListener('click', () => {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('signup-form').classList.remove('hidden');
  clearAuthMessages();
});

document.getElementById('login-toggle').addEventListener('click', () => {
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('signup-form').classList.add('hidden');
  clearAuthMessages();
});

function showAuthError(message) {
  const errorEl = document.getElementById('auth-error');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
  document.getElementById('auth-success').classList.add('hidden');
}

function showAuthSuccess(message) {
  const successEl = document.getElementById('auth-success');
  successEl.textContent = message;
  successEl.classList.remove('hidden');
  document.getElementById('auth-error').classList.add('hidden');
}

function clearAuthMessages() {
  document.getElementById('auth-error').classList.add('hidden');
  document.getElementById('auth-success').classList.add('hidden');
}

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  currentUser = null;
  currentChatUserId = null;
  if (socket) socket.disconnect();
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  clearAuthMessages();
  showAuthModal();
  location.reload();
});

// ============================================
// APP INITIALIZATION
// ============================================

function initializeApp() {
  initializeSocket();
  loadUserProfile();
  loadConversations();
  setupEventListeners();
}

function initializeSocket() {
  socket = io(SOCKET_SERVER_URL, {
    auth: {
      token: localStorage.getItem('authToken')
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('✅ Connected to socket server:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from socket server');
  });

  socket.on('message_received', (data) => {
    handleIncomingMessage(data);
  });

  socket.on('typing', (data) => {
    handleTypingIndicator(data);
  });

  socket.on('user_online', (userId) => {
    console.log('User online:', userId);
  });

  socket.on('user_offline', (userId) => {
    console.log('User offline:', userId);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
}

// ============================================
// USER PROFILE
// ============================================

async function loadUserProfile() {
  const authToken = localStorage.getItem('authToken');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const user = await response.json();
      currentUser = user;
      updateUserHeader();
    }
  } catch (error) {
    console.error('Error loading user profile:', error);
  }
}

function updateUserHeader() {
  document.getElementById('user-name').textContent = currentUser.username || 'User';
  document.getElementById('user-avatar').src = currentUser.avatar_url || 'https://via.placeholder.com/40';
}

// ============================================
// CONVERSATIONS & CHAT LIST
// ============================================

async function loadConversations() {
  const authToken = localStorage.getItem('authToken');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/conversations`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      conversations = await response.json();
      await loadAllUsers();
      renderChatList(conversations);
    }
  } catch (error) {
    console.error('Error loading conversations:', error);
  }
}

async function loadAllUsers() {
  const authToken = localStorage.getItem('authToken');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/users`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      allUsers = await response.json();
    }
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

function renderChatList(chats) {
  const chatList = document.getElementById('chat-list');
  const loader = document.getElementById('chat-list-loader');
  
  if (loader) {
    loader.remove();
  }

  chatList.innerHTML = '';

  if (chats.length === 0) {
    chatList.innerHTML = '<div class="p-4 text-center text-gray-500 dark:text-gray-400">No conversations yet</div>';
    return;
  }

  chats.forEach(chat => {
    const chatElement = document.createElement('button');
    chatElement.className = `w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 ${
      currentChatUserId === chat.other_user_id ? 'bg-gray-100 dark:bg-gray-700' : ''
    }`;
    
    const unreadBadge = chat.unread_count ? `<span class="ml-auto bg-green-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center badge-pulse">${Math.min(chat.unread_count, 9)}+</span>` : '';
    
    chatElement.innerHTML = `
      <img src="${chat.other_user_avatar || 'https://via.placeholder.com/48'}" alt="${chat.other_user_name}" class="w-12 h-12 rounded-full object-cover flex-shrink-0">
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-sm">${chat.other_user_name}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${chat.last_message || 'No messages yet'}</p>
        <p class="text-xs text-gray-400 dark:text-gray-500">${formatTime(chat.last_message_at)}</p>
      </div>
      ${unreadBadge}
    `;

    chatElement.addEventListener('click', () => {
      openChat(chat.other_user_id, chat.other_user_name, chat.other_user_avatar);
    });

    chatList.appendChild(chatElement);
  });
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } else if (isYesterday) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

// ============================================
// SEARCH FUNCTIONALITY
// ============================================

document.getElementById('search-input').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  
  if (!query) {
    renderChatList(conversations);
    return;
  }

  const filtered = conversations.filter(chat => 
    chat.other_user_name.toLowerCase().includes(query)
  );

  renderChatList(filtered);
});

// ============================================
// NEW CHAT MODAL
// ============================================

document.getElementById('new-chat-btn').addEventListener('click', openNewChatModal);
document.getElementById('start-chat-btn').addEventListener('click', openNewChatModal);

function openNewChatModal() {
  const modal = document.getElementById('new-chat-modal');
  modal.classList.remove('hidden');
  
  renderModalUserList(allUsers);
}

document.getElementById('close-modal').addEventListener('click', () => {
  document.getElementById('new-chat-modal').classList.add('hidden');
  document.getElementById('modal-search-input').value = '';
});

document.getElementById('modal-search-input').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  
  const filtered = allUsers.filter(user => 
    user.id !== currentUser.id && 
    user.username.toLowerCase().includes(query)
  );

  renderModalUserList(filtered);
});

function renderModalUserList(users) {
  const list = document.getElementById('modal-user-list');
  list.innerHTML = '';

  const filteredUsers = users.filter(user => user.id !== currentUser.id);

  if (filteredUsers.length === 0) {
    list.innerHTML = '<div class="text-center text-gray-500 dark:text-gray-400 py-8">No users found</div>';
    return;
  }

  filteredUsers.forEach(user => {
    const userElement = document.createElement('button');
    userElement.className = 'w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all flex items-center gap-3';
    
    userElement.innerHTML = `
      <img src="${user.avatar_url || 'https://via.placeholder.com/40'}" alt="${user.username}" class="w-10 h-10 rounded-full object-cover flex-shrink-0">
      <div class="flex-1">
        <p class="font-semibold text-sm">${user.username}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">${user.status}</p>
      </div>
    `;

    userElement.addEventListener('click', () => {
      document.getElementById('new-chat-modal').classList.add('hidden');
      document.getElementById('modal-search-input').value = '';
      openChat(user.id, user.username, user.avatar_url);
    });

    list.appendChild(userElement);
  });
}

// ============================================
// CHAT WINDOW
// ============================================

async function openChat(userId, userName, userAvatar) {
  currentChatUserId = userId;
  currentChatUserName = userName;

  // Update UI
  document.getElementById('no-chat-selected').classList.add('hidden');
  document.getElementById('chat-active-container').classList.remove('hidden');
  document.getElementById('chat-recipient-name').textContent = userName;
  document.getElementById('chat-recipient-avatar').src = userAvatar || 'https://via.placeholder.com/40';
  document.getElementById('chat-recipient-status').textContent = 'online';

  // Hide sidebar on mobile
  if (window.innerWidth < 768) {
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('chat-window').classList.remove('hidden');
  }

  // Load messages
  await loadMessages(userId);

  // Join socket room
  if (socket) {
    socket.emit('join_room', { receiver_id: userId });
  }

  // Focus input
  document.getElementById('message-input').focus();

  // Mark chat as active in list
  document.querySelectorAll('#chat-list button').forEach(btn => {
    btn.classList.remove('bg-gray-100', 'dark:bg-gray-700');
  });
}

async function loadMessages(userId) {
  const authToken = localStorage.getItem('authToken');
  const messageContainer = document.getElementById('message-container');
  const loader = document.getElementById('messages-loader');

  try {
    const response = await fetch(`${API_BASE_URL}/api/messages/${userId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      const msgs = await response.json();
      messages[userId] = msgs;

      if (loader) {
        loader.remove();
      }

      messageContainer.innerHTML = '';

      if (msgs.length === 0) {
        messageContainer.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">No messages yet. Start a conversation!</div>';
        return;
      }

      msgs.forEach(msg => {
        renderMessage(msg);
      });

      // Scroll to bottom
      messageContainer.scrollTop = messageContainer.scrollHeight;
    }
  } catch (error) {
    console.error('Error loading messages:', error);
  }
}

function renderMessage(msg) {
  const messageContainer = document.getElementById('message-container');
  const isSender = msg.sender_id === currentUser.id;

  const messageElement = document.createElement('div');
  messageElement.className = `flex gap-2 ${isSender ? 'justify-end' : 'justify-start'} message-enter`;

  const timestamp = new Date(msg.created_at).toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  if (isSender) {
    messageElement.innerHTML = `
      <div class="flex flex-col items-end max-w-xs">
        <div class="bg-green-500 dark:bg-green-600 text-white px-4 py-2 rounded-lg chat-bubble break-words">
          ${escapeHtml(msg.content)}
        </div>
        <p class="message-time">${timestamp}</p>
      </div>
    `;
  } else {
    messageElement.innerHTML = `
      <div class="flex gap-2">
        <img src="${msg.sender_avatar || 'https://via.placeholder.com/32'}" alt="" class="w-8 h-8 rounded-full object-cover flex-shrink-0">
        <div class="flex flex-col items-start max-w-xs">
          <div class="bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg chat-bubble break-words">
            ${escapeHtml(msg.content)}
          </div>
          <p class="message-time">${timestamp}</p>
        </div>
      </div>
    `;
  }

  messageContainer.appendChild(messageElement);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// MESSAGE SENDING
// ============================================

function setupEventListeners() {
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const backBtn = document.getElementById('back-to-chats');

  if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    messageInput.addEventListener('input', () => {
      if (socket && currentChatUserId) {
        socket.emit('typing', { receiver_id: currentChatUserId });
      }
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      currentChatUserId = null;
      document.getElementById('chat-active-container').classList.add('hidden');
      document.getElementById('no-chat-selected').classList.remove('hidden');
      
      if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.remove('hidden');
        document.getElementById('chat-window').classList.add('hidden');
      }
    });
  }
}

async function sendMessage() {
  if (!currentChatUserId) {
    console.error('No chat selected');
    return;
  }

  const messageInput = document.getElementById('message-input');
  const content = messageInput.value.trim();

  if (!content) {
    return;
  }

  const authToken = localStorage.getItem('authToken');

  try {
    const response = await fetch(`${API_BASE_URL}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        receiver_id: currentChatUserId,
        content: content
      })
    });

    if (response.ok) {
      const message = await response.json();
      
      // Clear input
      messageInput.value = '';

      // Render message immediately
      renderMessage(message);

      // Scroll to bottom
      const messageContainer = document.getElementById('message-container');
      messageContainer.scrollTop = messageContainer.scrollHeight;

      // Emit via Socket.io for real-time delivery
      if (socket) {
        socket.emit('send_message', {
          receiver_id: currentChatUserId,
          content: content,
          message_id: message.id
        });
      }

      // Refresh conversations
      loadConversations();
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// ============================================
// INCOMING MESSAGES
// ============================================

function handleIncomingMessage(data) {
  console.log('📨 Message received:', data);

  // If chat is already open, render message
  if (currentChatUserId === data.sender_id) {
    const messageContainer = document.getElementById('message-container');
    
    // Create message object
    const message = {
      id: data.message_id,
      sender_id: data.sender_id,
      content: data.content,
      created_at: new Date().toISOString(),
      sender_avatar: data.sender_avatar
    };

    renderMessage(message);
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }

  // Refresh conversations to show updated message
  loadConversations();
}

// ============================================
// TYPING INDICATOR
// ============================================

function handleTypingIndicator(data) {
  if (currentChatUserId === data.sender_id) {
    const typingIndicator = document.getElementById('typing-indicator');
    const typingName = document.getElementById('typing-name');
    
    typingName.textContent = data.username;
    typingIndicator.classList.remove('hidden');

    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      typingIndicator.classList.add('hidden');
    }, 2000);
  }
}

// ============================================
// RESPONSIVE HANDLING
// ============================================

window.addEventListener('resize', () => {
  if (window.innerWidth >= 768) {
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('chat-window').classList.remove('hidden');
  }
});

// Auto-load conversations every 10 seconds
setInterval(() => {
  if (currentUser && currentChatUserId === null) {
    loadConversations();
  }
}, 10000);

console.log('✅ App initialized successfully!');
