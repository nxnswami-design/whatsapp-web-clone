"""
============================================
WHATSAPP WEB CLONE - BACKEND (app.py)
Flask + Flask-SocketIO + Supabase
============================================
"""

import os
import jwt
import bcrypt
from datetime import datetime, timedelta
from functools import wraps
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# ============================================
# CONFIGURATION
# ============================================

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# Flask app configuration
app = Flask(__name__)
app.config['SECRET_KEY'] = JWT_SECRET
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Initialize Socket.io
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Global dictionary to track connected users
connected_users = {}  # {user_id: {socket_id, username}}

print("✅ Flask app initialized")
print(f"✅ Supabase connected: {SUPABASE_URL}")

# ============================================
# UTILITIES
# ============================================

def hash_password(password):
    """Hash password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password, password_hash):
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def generate_jwt_token(user_id, username, email):
    """Generate JWT token for authenticated user"""
    payload = {
        'user_id': str(user_id),
        'username': username,
        'email': email,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_jwt_token(token):
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def get_token_from_request():
    """Extract JWT token from request headers"""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None
    
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return None
    
    return parts[1]

def token_required(f):
    """Decorator to protect routes with JWT authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_request()
        if not token:
            return jsonify({'message': 'Token missing'}), 401
        
        payload = verify_jwt_token(token)
        if not payload:
            return jsonify({'message': 'Invalid or expired token'}), 401
        
        request.user_id = payload['user_id']
        request.username = payload['username']
        request.email = payload['email']
        
        return f(*args, **kwargs)
    
    return decorated

# ============================================
# AUTHENTICATION ENDPOINTS
# ============================================

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    """Register a new user"""
    try:
        data = request.get_json()
        
        # Validate input
        if not data or not all(k in data for k in ('name', 'email', 'password')):
            return jsonify({'message': 'Missing required fields'}), 400
        
        name = data['name'].strip()
        email = data['email'].strip().lower()
        password = data['password'].strip()
        
        if len(password) < 6:
            return jsonify({'message': 'Password must be at least 6 characters'}), 400
        
        if not name or not email:
            return jsonify({'message': 'Name and email cannot be empty'}), 400
        
        # Check if user already exists
        response = supabase.table('users').select('id').eq('email', email).execute()
        if response.data:
            return jsonify({'message': 'Email already registered'}), 409
        
        # Hash password
        password_hash = hash_password(password)
        
        # Create user in database
        new_user = {
            'email': email,
            'username': name,
            'password_hash': password_hash,
            'status': 'online',
            'avatar_url': f'https://api.dicebear.com/7.x/avataaars/svg?seed={email}'
        }
        
        response = supabase.table('users').insert(new_user).execute()
        user = response.data[0]
        
        # Generate JWT token
        token = generate_jwt_token(user['id'], user['username'], user['email'])
        
        return jsonify({
            'token': token,
            'user': {
                'id': user['id'],
                'email': user['email'],
                'username': user['username'],
                'avatar_url': user['avatar_url'],
                'status': user['status']
            }
        }), 201
    
    except Exception as e:
        print(f"❌ Signup error: {str(e)}")
        return jsonify({'message': 'Server error'}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Authenticate user and return JWT token"""
    try:
        data = request.get_json()
        
        # Validate input
        if not data or not all(k in data for k in ('email', 'password')):
            return jsonify({'message': 'Missing email or password'}), 400
        
        email = data['email'].strip().lower()
        password = data['password'].strip()
        
        # Find user by email
        response = supabase.table('users').select('*').eq('email', email).execute()
        
        if not response.data:
            return jsonify({'message': 'Invalid email or password'}), 401
        
        user = response.data[0]
        
        # Verify password
        if not verify_password(password, user['password_hash']):
            return jsonify({'message': 'Invalid email or password'}), 401
        
        # Update user status to online
        supabase.table('users').update({'status': 'online', 'last_seen': datetime.utcnow().isoformat()}).eq('id', user['id']).execute()
        
        # Generate JWT token
        token = generate_jwt_token(user['id'], user['username'], user['email'])
        
        return jsonify({
            'token': token,
            'user': {
                'id': user['id'],
                'email': user['email'],
                'username': user['username'],
                'avatar_url': user['avatar_url'],
                'status': 'online'
            }
        }), 200
    
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        return jsonify({'message': 'Server error'}), 500

# ============================================
# USER ENDPOINTS
# ============================================

@app.route('/api/users/profile', methods=['GET'])
@token_required
def get_profile():
    """Get current user's profile"""
    try:
        response = supabase.table('users').select('*').eq('id', request.user_id).execute()
        
        if not response.data:
            return jsonify({'message': 'User not found'}), 404
        
        user = response.data[0]
        
        return jsonify({
            'id': user['id'],
            'email': user['email'],
            'username': user['username'],
            'avatar_url': user['avatar_url'],
            'status': user['status'],
            'last_seen': user['last_seen']
        }), 200
    
    except Exception as e:
        print(f"❌ Profile error: {str(e)}")
        return jsonify({'message': 'Server error'}), 500

@app.route('/api/users', methods=['GET'])
@token_required
def get_all_users():
    """Get all users (except current user)"""
    try:
        response = supabase.table('users').select('id, username, email, avatar_url, status, last_seen').neq('id', request.user_id).execute()
        
        users = []
        for user in response.data:
            users.append({
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'avatar_url': user['avatar_url'],
                'status': user['status'],
                'last_seen': user['last_seen']
            })
        
        return jsonify(users), 200
    
    except Exception as e:
        print(f"❌ Get users error: {str(e)}")
        return jsonify({'message': 'Server error'}), 500

@app.route('/api/users/<user_id>', methods=['GET'])
@token_required
def get_user(user_id):
    """Get specific user by ID"""
    try:
        response = supabase.table('users').select('id, username, email, avatar_url, status, last_seen').eq('id', user_id).execute()
        
        if not response.data:
            return jsonify({'message': 'User not found'}), 404
        
        user = response.data[0]
        
        return jsonify({
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'avatar_url': user['avatar_url'],
            'status': user['status'],
            'last_seen': user['last_seen']
        }), 200
    
    except Exception as e:
        print(f"❌ Get user error: {str(e)}")
        return jsonify({'message': 'Server error'}), 500

# ============================================
# CONVERSATION ENDPOINTS
# ============================================

@app.route('/api/conversations', methods=['GET'])
@token_required
def get_conversations():
    """Get all conversations for current user"""
    try:
        user_id = request.user_id
        
        # Query conversations where user is part of it
        response = supabase.table('conversations').select('*').or_(
            f"user1_id.eq.{user_id},user2_id.eq.{user_id}"
        ).order('last_message_at', desc=True).execute()
        
        conversations = []
        
        for conv in response.data:
            # Determine the other user ID
            other_user_id = conv['user2_id'] if conv['user1_id'] == user_id else conv['user1_id']
            
            # Get other user details
            user_response = supabase.table('users').select('id, username, avatar_url, status').eq('id', other_user_id).execute()
            other_user = user_response.data[0] if user_response.data else None
            
            # Count unread messages
            unread_response = supabase.table('messages').select('id', count='exact').and_(
                f"receiver_id.eq.{user_id},sender_id.eq.{other_user_id},is_read.eq.false"
            ).execute()
            
            conversations.append({
                'id': conv['id'],
                'other_user_id': other_user_id,
                'other_user_name': other_user['username'] if other_user else 'Unknown',
                'other_user_avatar': other_user['avatar_url'] if other_user else None,
                'other_user_status': other_user['status'] if other_user else 'offline',
                'last_message': conv['last_message'],
                'last_message_at': conv['last_message_at'],
                'unread_count': unread_response.count
            })
        
        return jsonify(conversations), 200
    
    except Exception as e:
        print(f"❌ Get conversations error: {str(e)}")
        return jsonify({'message': 'Server error'}), 500

# ============================================
# MESSAGE ENDPOINTS
# ============================================

@app.route('/api/messages/<receiver_id>', methods=['GET'])
@token_required
def get_messages(receiver_id):
    """Get all messages between current user and another user"""
    try:
        sender_id = request.user_id
        
        # Get messages in both directions, ordered by creation time
        response = supabase.table('messages').select('*').or_(
            f"and(sender_id.eq.{sender_id},receiver_id.eq.{receiver_id}),and(sender_id.eq.{receiver_id},receiver_id.eq.{sender_id})"
        ).order('created_at', desc=False).execute()
        
        messages = []
        for msg in response.data:
            # Get sender avatar
            sender_response = supabase.table('users').select('avatar_url').eq('id', msg['sender_id']).execute()
            sender_avatar = sender_response.data[0]['avatar_url'] if sender_response.data else None
            
            messages.append({
                'id': msg['id'],
                'sender_id': msg['sender_id'],
                'receiver_id': msg['receiver_id'],
                'content': msg['content'],
                'is_read': msg['is_read'],
                'created_at': msg['created_at'],
                'sender_avatar': sender_avatar
            })
        
        # Mark messages as read
        supabase.table('messages').update({'is_read': True}).and_(
            f"receiver_id.eq.{sender_id},sender_id.eq.{receiver_id},is_read.eq.false"
        ).execute()
        
        return jsonify(messages), 200
    
    except Exception as e:
        print(f"❌ Get messages error: {str(e)}")
        return jsonify({'message': 'Server error'}), 500

@app.route('/api/messages', methods=['POST'])
@token_required
def send_message():
    """Send a new message"""
    try:
        data = request.get_json()
        
        if not data or 'receiver_id' not in data or 'content' not in data:
            return jsonify({'message': 'Missing required fields'}), 400
        
        sender_id = request.user_id
        receiver_id = data['receiver_id']
        content = data['content'].strip()
        
        if not content:
            return jsonify({'message': 'Message cannot be empty'}), 400
        
        # Verify receiver exists
        receiver_response = supabase.table('users').select('id').eq('id', receiver_id).execute()
        if not receiver_response.data:
            return jsonify({'message': 'Receiver not found'}), 404
        
        # Create message
        message = {
            'sender_id': sender_id,
            'receiver_id': receiver_id,
            'content': content,
            'is_read': False
        }
        
        response = supabase.table('messages').insert(message).execute()
        new_message = response.data[0]
        
        # Update or create conversation
        user_id_1 = min(sender_id, receiver_id)
        user_id_2 = max(sender_id, receiver_id)
        
        # Check if conversation exists
        conv_response = supabase.table('conversations').select('id').and_(
            f"user1_id.eq.{user_id_1},user2_id.eq.{user_id_2}"
        ).execute()
        
        if conv_response.data:
            # Update existing conversation
            supabase.table('conversations').update({
                'last_message': content,
                'last_message_at': datetime.utcnow().isoformat()
            }).eq('id', conv_response.data[0]['id']).execute()
        else:
            # Create new conversation
            supabase.table('conversations').insert({
                'user1_id': user_id_1,
                'user2_id': user_id_2,
                'last_message': content,
                'last_message_at': datetime.utcnow().isoformat()
            }).execute()
        
        # Get sender avatar
        sender_response = supabase.table('users').select('avatar_url').eq('id', sender_id).execute()
        sender_avatar = sender_response.data[0]['avatar_url'] if sender_response.data else None
        
        return jsonify({
            'id': new_message['id'],
            'sender_id': new_message['sender_id'],
            'receiver_id': new_message['receiver_id'],
            'content': new_message['content'],
            'is_read': new_message['is_read'],
            'created_at': new_message['created_at'],
            'sender_avatar': sender_avatar
        }), 201
    
    except Exception as e:
        print(f"❌ Send message error: {str(e)}")
        return jsonify({'message': 'Server error'}), 500

# ============================================
# WEBSOCKET EVENTS
# ============================================

@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection"""
    try:
        auth_token = request.args.get('token')
        
        if not auth_token:
            return False
        
        payload = verify_jwt_token(auth_token)
        if not payload:
            return False
        
        user_id = payload['user_id']
        username = payload['username']
        
        # Store user connection
        connected_users[user_id] = {
            'socket_id': request.sid,
            'username': username
        }
        
        print(f"✅ User connected: {username} (ID: {user_id}, Socket: {request.sid})")
        
        # Update user status in database
        supabase.table('users').update({'status': 'online'}).eq('id', user_id).execute()
        
        # Broadcast user is online
        socketio.emit('user_online', {'user_id': user_id}, broadcast=True)
        
        emit('connect_response', {'message': 'Connected successfully'})
    
    except Exception as e:
        print(f"❌ Connect error: {str(e)}")
        return False

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection"""
    try:
        # Find and remove disconnected user
        for user_id, user_info in list(connected_users.items()):
            if user_info['socket_id'] == request.sid:
                del connected_users[user_id]
                
                print(f"❌ User disconnected: {user_info['username']} (ID: {user_id})")
                
                # Update user status in database
                supabase.table('users').update({
                    'status': 'offline',
                    'last_seen': datetime.utcnow().isoformat()
                }).eq('id', user_id).execute()
                
                # Broadcast user is offline
                socketio.emit('user_offline', {'user_id': user_id}, broadcast=True)
                
                break
    
    except Exception as e:
        print(f"❌ Disconnect error: {str(e)}")

@socketio.on('join_room')
def handle_join_room(data):
    """Join a chat room with a specific user"""
    try:
        receiver_id = data.get('receiver_id')
        
        # Get sender ID from socket connection (need to verify token)
        auth_token = request.args.get('token')
        payload = verify_jwt_token(auth_token)
        
        if not payload:
            return
        
        user_id = payload['user_id']
        room_name = f"chat_{min(user_id, receiver_id)}_{max(user_id, receiver_id)}"
        
        join_room(room_name)
        print(f"📍 User {user_id} joined room: {room_name}")
        
        emit('room_joined', {'room': room_name})
    
    except Exception as e:
        print(f"❌ Join room error: {str(e)}")

@socketio.on('send_message')
def handle_send_message(data):
    """Handle real-time message sending"""
    try:
        auth_token = request.args.get('token')
        payload = verify_jwt_token(auth_token)
        
        if not payload:
            return
        
        sender_id = payload['user_id']
        receiver_id = data.get('receiver_id')
        content = data.get('content', '').strip()
        message_id = data.get('message_id')
        
        if not receiver_id or not content:
            return
        
        room_name = f"chat_{min(sender_id, receiver_id)}_{max(sender_id, receiver_id)}"
        
        # Get sender info
        sender_response = supabase.table('users').select('username, avatar_url').eq('id', sender_id).execute()
        sender_info = sender_response.data[0] if sender_response.data else {}
        
        # Broadcast message to room
        socketio.emit('message_received', {
            'message_id': message_id,
            'sender_id': sender_id,
            'receiver_id': receiver_id,
            'content': content,
            'sender_avatar': sender_info.get('avatar_url'),
            'username': sender_info.get('username'),
            'created_at': datetime.utcnow().isoformat()
        }, room=room_name)
        
        print(f"📨 Message sent from {sender_id} to {receiver_id}")
    
    except Exception as e:
        print(f"❌ Send message error: {str(e)}")

@socketio.on('typing')
def handle_typing(data):
    """Handle typing indicator"""
    try:
        auth_token = request.args.get('token')
        payload = verify_jwt_token(auth_token)
        
        if not payload:
            return
        
        sender_id = payload['user_id']
        receiver_id = data.get('receiver_id')
        username = payload['username']
        
        if not receiver_id:
            return
        
        room_name = f"chat_{min(sender_id, receiver_id)}_{max(sender_id, receiver_id)}"
        
        # Broadcast typing indicator
        socketio.emit('typing', {
            'sender_id': sender_id,
            'username': username
        }, room=room_name, skip_sid=request.sid)
    
    except Exception as e:
        print(f"❌ Typing error: {str(e)}")

@socketio.on('error')
def handle_error(data):
    """Handle socket errors"""
    print(f"❌ Socket error: {data}")

# ============================================
# HEALTH CHECK
# ============================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'online',
        'timestamp': datetime.utcnow().isoformat(),
        'connected_users': len(connected_users)
    }), 200

# ============================================
# ERROR HANDLERS
# ============================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'message': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'message': 'Internal server error'}), 500

# ============================================
# RUN SERVER
# ============================================

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('DEBUG', 'False') == 'True'
    
    print("=" * 50)
    print("🚀 WhatsApp Web Clone - Backend Server")
    print("=" * 50)
    print(f"🔧 Server running on port {port}")
    print(f"🔐 JWT Secret configured")
    print(f"🗄️  Supabase connected")
    print("=" * 50)
    
    socketio.run(app, host='0.0.0.0', port=port, debug=debug, allow_unsafe_werkzeug=True)
