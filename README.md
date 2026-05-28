# 🚀 WhatsApp Web Clone - Real-Time Messaging Application

A **100% FREE**, full-stack real-time web application that replicates WhatsApp Web functionality. Built with vanilla JavaScript, Flask, Socket.io, and Supabase.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.8+-blue)
![Node](https://img.shields.io/badge/node-14+-green)

---

## ✨ Features

### 🎨 Frontend
- **Premium Dark/Light Mode Theme** - Inspired by WhatsApp Web
- **Two-Column Split-Screen Layout** - Sidebar (30%) + Chat Window (70%)
- **Real-Time Messaging** - Socket.io bidirectional communication
- **Responsive Design** - Mobile-friendly single column on small screens
- **User Presence** - Online/Offline status indicators
- **Typing Indicators** - See when users are typing
- **Message Search** - Filter chats and find conversations
- **Unread Badges** - Track unread message counts
- **Dark Mode Toggle** - Theme persistence with localStorage
- **Smooth Animations** - Modern UX with CSS transitions

### 🔧 Backend
- **RESTful API** - Complete endpoints for auth, users, messages
- **WebSocket Events** - Real-time message delivery via Socket.io
- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - Bcrypt for secure password storage
- **Supabase Integration** - PostgreSQL database with RLS
- **User Management** - Profile management and user discovery
- **Conversation Tracking** - Last message preview and timestamps
- **Message Persistence** - All messages stored in database
- **Error Handling** - Comprehensive error messages
- **CORS Support** - Cross-origin resource sharing

### 🗄️ Database (Supabase PostgreSQL)
- **Users Table** - User accounts, profiles, authentication
- **Conversations Table** - Chat threads with last message preview
- **Messages Table** - Individual messages with read status
- **Automatic Timestamps** - Created/Updated at tracking
- **Row Level Security** - Database-level permission control
- **Indexes** - Optimized query performance

---

## 📋 Project Structure

```
whatsapp-web-clone/
├── frontend/
│   ├── index.html          # HTML5 semantic structure
│   └── app.js              # Vanilla JavaScript ES6+
├── backend/
│   ├── app.py              # Flask + Socket.io server
│   ├── requirements.txt     # Python dependencies
│   └── .env.example        # Environment variables template
├── .gitignore
└── README.md
```

---

## 🛠️ Tech Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Tailwind CSS (CDN)
- **JavaScript** - Vanilla ES6+ (no frameworks)
- **Socket.io-client** - Real-time communication
- **LocalStorage** - Theme & auth persistence

### Backend
- **Python 3.8+** - Server runtime
- **Flask** - Web framework
- **Flask-SocketIO** - WebSocket support
- **Flask-CORS** - Cross-origin requests
- **PyJWT** - JWT authentication
- **Bcrypt** - Password hashing
- **Supabase** - Database & authentication

### Database
- **PostgreSQL** - Relational database (via Supabase)
- **UUID** - Unique identifiers
- **Row Level Security** - Database permissions

---

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Supabase account (free tier available)
- Git
- Modern web browser

### Step 1: Clone Repository

```bash
git clone https://github.com/nxnswami-design/whatsapp-web-clone.git
cd whatsapp-web-clone
```

### Step 2: Set Up Supabase Database

1. **Create Supabase Project**
   - Go to https://supabase.com
   - Click "New Project"
   - Choose a name and region
   - Wait for initialization (2-3 minutes)

2. **Run SQL Schema**
   - Go to SQL Editor
   - Create a new query
   - Copy and paste the SQL schema (see below)
   - Click Run

3. **Get Your Credentials**
   - Go to Settings → API
   - Copy `Project URL` → `SUPABASE_URL`
   - Copy `anon public` key → `SUPABASE_KEY`

### Step 3: Set Up Backend

```bash
cd backend

# Create .env file
cp .env.example .env

# Edit .env with your Supabase credentials
nano .env
```

**Fill in .env:**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
JWT_SECRET=your-random-secret-key
PORT=5000
DEBUG=False
FRONTEND_URL=http://localhost:3000
```

**Install dependencies:**
```bash
pip install -r requirements.txt
```

**Run server:**
```bash
python app.py
```

You should see:
```
==================================================
🚀 WhatsApp Web Clone - Backend Server
==================================================
🔧 Server running on port 5000
🔐 JWT Secret configured
🗄️  Supabase connected
==================================================
```

### Step 4: Set Up Frontend

1. **Open Frontend**
   - Navigate to `frontend/index.html` in your browser
   - Or use a local server:

```bash
cd frontend
python -m http.server 3000
```

Then open `http://localhost:3000`

2. **Update API URL (if needed)**
   - Open `frontend/app.js`
   - Find `const API_BASE_URL = 'http://localhost:5000'`
   - Change if your backend is on different port

---

## 📊 Supabase SQL Schema

Copy and paste this SQL into your Supabase SQL Editor:

```sql
-- ============================================
-- WHATSAPP WEB CLONE - DATABASE SCHEMA
-- Supabase PostgreSQL
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE,
  avatar_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'offline',
  last_seen TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- ============================================
-- CONVERSATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message TEXT,
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT user_order CHECK (user1_id < user2_id),
  UNIQUE(user1_id, user2_id)
);

CREATE INDEX idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX idx_conversations_user2 ON conversations(user2_id);

-- ============================================
-- MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT different_users CHECK (sender_id != receiver_id)
);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_conversation ON messages(sender_id, receiver_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- ============================================
-- AUTOMATIC TIMESTAMP UPDATE FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own record" ON users FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view their conversations" ON conversations FOR SELECT 
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can insert conversations" ON conversations FOR INSERT 
WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can update their conversations" ON conversations FOR UPDATE 
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can view their messages" ON messages FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert messages" ON messages FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update message read status" ON messages FOR UPDATE 
USING (auth.uid() = receiver_id);
```

---

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/signup          - Register new user
POST   /api/auth/login           - Login user
```

### Users
```
GET    /api/users/profile        - Get current user profile
GET    /api/users                - Get all users
GET    /api/users/<user_id>      - Get specific user
```

### Conversations
```
GET    /api/conversations        - Get all conversations
```

### Messages
```
GET    /api/messages/<user_id>   - Get chat history
POST   /api/messages             - Send new message
```

### Health
```
GET    /api/health               - Server health check
```

---

## 🔌 WebSocket Events

### Client → Server
```javascript
socket.emit('join_room', { receiver_id: 'user_id' })
socket.emit('send_message', { receiver_id, content, message_id })
socket.emit('typing', { receiver_id })
```

### Server → Client
```javascript
socket.on('message_received', (data) => { ... })
socket.on('typing', (data) => { ... })
socket.on('user_online', (userId) => { ... })
socket.on('user_offline', (userId) => { ... })
```

---

## 📱 Usage Guide

### 1. Sign Up / Login
- Open the app
- Create account or login with credentials
- Auto-avatar generated from email

### 2. Start Conversation
- Click "New Chat" button
- Search for user
- Click to open chat

### 3. Send Message
- Type message in input box
- Press Enter or click Send button
- Message delivered in real-time

### 4. Features
- **Search** - Filter conversations by name
- **Dark Mode** - Toggle theme (top right)
- **Typing** - See when user is typing
- **Online Status** - Check user availability
- **Timestamps** - Track message times
- **Unread Count** - Badge on conversations

---

## 🔒 Security Features

✅ **JWT Authentication** - Token-based secure auth  
✅ **Password Hashing** - Bcrypt with salt  
✅ **CORS Protection** - Controlled origin access  
✅ **Row Level Security** - Database-level permissions  
✅ **Token Expiration** - 24-hour JWT validity  
✅ **Input Validation** - Server-side data validation  
✅ **SQL Injection Prevention** - Parameterized queries  
✅ **XSS Protection** - HTML escaping on messages  

---

## 🐛 Troubleshooting

### "Connection refused" error
- Ensure backend is running: `python app.py`
- Check if port 5000 is available
- Verify `API_BASE_URL` in `frontend/app.js`

### "Supabase connection failed"
- Verify `SUPABASE_URL` and `SUPABASE_KEY` in `.env`
- Check Supabase project is active
- Ensure tables are created (run SQL schema)

### "Authentication failed"
- Check JWT_SECRET in `.env`
- Verify user exists in database
- Clear localStorage and try again

### "Messages not updating"
- Check browser console for errors
- Verify Socket.io connection in Network tab
- Restart both frontend and backend

---

## 📈 Performance Tips

1. **Database Indexing** - Already optimized with indexes
2. **Message Pagination** - Load 50 messages, scroll for more
3. **Lazy Loading** - Images use placeholder until loaded
4. **Caching** - localStorage for theme and auth
5. **Compression** - Enable gzip on production server

---

## 🚀 Deployment

### Deploy Backend (Heroku/Railway)

```bash
# Install Gunicorn
pip install gunicorn

# Create Procfile
echo "web: gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:\$PORT app:app" > Procfile

# Deploy to Heroku
heroku create your-app-name
git push heroku main
```

### Deploy Frontend (Vercel/Netlify)

```bash
# Build (no build step needed for vanilla JS)
# Just deploy the frontend folder

# Update API_BASE_URL to production backend URL
```

---

## 📝 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://abc.supabase.co` |
| `SUPABASE_KEY` | Supabase anon key | `eyJhbGc...` |
| `JWT_SECRET` | JWT signing secret | `super-secret-key` |
| `PORT` | Backend server port | `5000` |
| `DEBUG` | Debug mode (True/False) | `False` |
| `FRONTEND_URL` | Frontend origin for CORS | `http://localhost:3000` |

---

## 📦 Dependencies

### Backend
```
Flask==2.3.3
Flask-CORS==4.0.0
Flask-SocketIO==5.3.4
supabase==1.0.3
PyJWT==2.8.1
bcrypt==4.0.1
gunicorn==21.2.0
python-dotenv==1.0.0
```

### Frontend
- Socket.io-client (via CDN)
- Tailwind CSS (via CDN)
- No npm dependencies needed!

---

## 📄 License

This project is open source and available under the MIT License.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### To contribute:
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 💡 Future Enhancements

- [ ] Group conversations
- [ ] Message reactions (emoji)
- [ ] Media sharing (images, files)
- [ ] Message encryption
- [ ] Voice/Video calls
- [ ] Message search within chat
- [ ] User profile updates
- [ ] Last seen timestamps
- [ ] Message delete/edit
- [ ] Push notifications
- [ ] Mobile app (React Native)

---

## 📞 Support

For questions or issues:
1. Check the troubleshooting section
2. Review GitHub Issues
3. Check Supabase documentation
4. Open a new GitHub Issue with details

---

## 👨‍💻 Author

**Naveen Swami**  
GitHub: [@nxnswami-design](https://github.com/nxnswami-design)

---

## ⭐ Show Your Support

If you found this helpful, please consider:
- ⭐ Starring the repository
- 🔄 Sharing with others
- 💬 Providing feedback
- 🤝 Contributing to the project

---

**Happy Coding! 🚀**

Last Updated: May 2026  
Version: 1.0.0
