const { useState, useEffect, useRef } = React;

    // Firebase Configuration
    const firebaseConfig = {
        apiKey: "AIzaSyDvT_GPef-lLPD2X86xM2MLSTl7s7OQfKg",
        authDomain: "chat-together-mc.firebaseapp.com",
        databaseURL: "https://chat-together-mc-default-rtdb.firebaseio.com",
        projectId: "chat-together-mc",
        storageBucket: "chat-together-mc.firebasestorage.app",
        messagingSenderId: "647441407343",
        appId: "1:647441407343:web:b76cf33d52fc01b8631c9a",
        measurementId: "G-07E1B315VT"
    };

    // Initialize Firebase
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    const database = firebase.database();

    // Icons
    const Users = ({ className }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );

    const MessageCircle = ({ className }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    );

    const UserCheck = ({ className }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    );

    const Clock = ({ className }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );

    const LogOut = ({ className }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    );

    function AnonymousMatcher() {
      const [status, setStatus] = useState('disconnected');
      const [userId, setUserId] = useState(null);
      const [sessionId, setSessionId] = useState(null);
      const [messages, setMessages] = useState([]);
      const [messageInput, setMessageInput] = useState('');
      const [waitingCount, setWaitingCount] = useState(0);
      const [error, setError] = useState(null);
      const messagesEndRef = useRef(null);
      const listenerRef = useRef(null);

      const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      };

      useEffect(() => {
        scrollToBottom();
      }, [messages]);

      // Cleanup on unmount
      useEffect(() => {
        return () => {
          if (listenerRef.current) {
            listenerRef.current();
          }
        };
      }, []);

      const generateUserId = () => {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      };

      const joinQueue = async () => {
        try {
          setError(null);
          const newUserId = generateUserId();
          setUserId(newUserId);
          console.log('My User ID:', newUserId);

          // Add to waiting pool
          await database.ref(`waiting/${newUserId}`).set({
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            status: 'waiting'
          });
          console.log('Added to waiting pool');

          setStatus('waiting');
          
          // Listen for match BEFORE attempting to match
          listenForMatch(newUserId);
          
          // Small delay to ensure listener is set up
          setTimeout(() => {
            attemptMatching(newUserId);
          }, 500);
        } catch (err) {
          setError('Failed to join queue. Please try again.');
          console.error('Join queue error:', err);
        }
      };

      const listenForMatch = (currentUserId) => {
        console.log('Setting up match listener for:', currentUserId);
        // Listen for sessions that include us
        const sessionsRef = database.ref('sessions');
        const listener = sessionsRef.on('child_added', (snapshot) => {
          const session = snapshot.val();
          const sid = snapshot.key;
          console.log('Session created:', sid, session);
          
          if (session.user1 === currentUserId || session.user2 === currentUserId) {
            console.log('I am in this session! Moving to matched state');
            setSessionId(sid);
            setStatus('matched');
            sessionsRef.off('child_added', listener);
            listenForMessages(sid);
          } else {
            console.log('This session is not for me');
          }
        });

        listenerRef.current = () => sessionsRef.off('child_added', listener);
      };

      const attemptMatching = async (currentUserId) => {
        try {
          console.log('Attempting to match for:', currentUserId);
          const waitingSnapshot = await database.ref('waiting').once('value');
          const waiting = waitingSnapshot.val() || {};
          console.log('Users in waiting pool:', Object.keys(waiting));
          
          const otherUsers = Object.keys(waiting).filter(id => id !== currentUserId);
          console.log('Other users available:', otherUsers);
          
          if (otherUsers.length > 0) {
            const partnerId = otherUsers[0];
            const newSessionId = database.ref('sessions').push().key;
            console.log('Creating session:', newSessionId, 'between', currentUserId, 'and', partnerId);
            
            const session = {
              user1: currentUserId,
              user2: partnerId,
              createdAt: firebase.database.ServerValue.TIMESTAMP,
              messages: {}
            };

            // Create session and remove both from waiting
            await Promise.all([
              database.ref(`sessions/${newSessionId}`).set(session),
              database.ref(`waiting/${currentUserId}`).remove(),
              database.ref(`waiting/${partnerId}`).remove()
            ]);
            console.log('Session created and wildcats removed from waiting');
          } else {
            console.log('No other wildcats to match with');
            // Count waiting users
            updateWaitingCount();
          }
        } catch (err) {
          console.error('Matching error:', err);
        }
      };

      const updateWaitingCount = async () => {
        try {
          const snapshot = await database.ref('waiting').once('value');
          const waiting = snapshot.val() || {};
          setWaitingCount(Object.keys(waiting).length);
        } catch (err) {
          console.error('Count error:', err);
        }
      };

      const listenForMessages = (sid) => {
        const messagesRef = database.ref(`sessions/${sid}/messages`);
        const listener = messagesRef.on('value', (snapshot) => {
          const messagesData = snapshot.val() || {};
          const messagesList = Object.entries(messagesData).map(([id, msg]) => ({
            id,
            ...msg
          })).sort((a, b) => a.timestamp - b.timestamp);
          setMessages(messagesList);
        });

        listenerRef.current = () => messagesRef.off('value', listener);
      };

      const sendMessage = async () => {
        if (!messageInput.trim() || !sessionId) return;

        try {
          const newMessageRef = database.ref(`sessions/${sessionId}/messages`).push();
          await newMessageRef.set({
            sender: userId,
            text: messageInput,
            timestamp: firebase.database.ServerValue.TIMESTAMP
          });
          
          setMessageInput('');
        } catch (err) {
          setError('Failed to send message. Please try again.');
          console.error('Send message error:', err);
        }
      };

      const leaveSession = async () => {
        try {
          if (listenerRef.current) {
            listenerRef.current();
          }

          if (status === 'waiting' && userId) {
            await database.ref(`waiting/${userId}`).remove();
          }
          
          if (status === 'matched' && sessionId) {
            await database.ref(`sessions/${sessionId}`).remove();
          }
          
          setStatus('disconnected');
          setUserId(null);
          setSessionId(null);
          setMessages([]);
          setError(null);
        } catch (err) {
          console.error('Leave session error:', err);
        }
      };

      // Listen for waiting count updates
      useEffect(() => {
        if (status === 'waiting') {
          const interval = setInterval(updateWaitingCount, 3000);
          return () => clearInterval(interval);
        }
      }, [status]);

      return (
        <div className="min-h-screen bg-white">
          {/* Header */}
          <div className="bg-blue-600 shadow-md">
            <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-lg p-2">
                  <MessageCircle className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">MC Wildchat</h1>
                  <p className="text-blue-100 text-sm">Marin Catholic Chatting Service</p>
                </div>
              </div>
              {status !== 'disconnected' && (
                <button
                  onClick={leaveSession}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-semibold"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="max-w-6xl mx-auto px-4 mt-4">
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="max-w-6xl mx-auto px-4 py-6">
            {status === 'disconnected' && (
              <div className="text-center py-16">
                <div className="mb-8">
                  <div className="inline-block bg-blue-100 rounded-full p-6 mb-4">
                    <Users className="w-16 h-16 text-blue-600" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-2">MC Wildchat</h2>
                  <p className="text-gray-600 text-lg">Connect with random Marin Catholic students</p>
                </div>
                
                <button
                  onClick={joinQueue}
                  className="px-12 py-4 bg-blue-600 text-white text-xl rounded-lg hover:bg-blue-700 transition-colors font-bold shadow-lg"
                >
                  Start Chatting
                </button>
                
                <div className="mt-8 text-gray-500 text-sm">
                  <p>Click "Start Chatting" to be matched with a random wildcat</p>
                </div>
              </div>
            )}

            {status === 'waiting' && (
              <div className="text-center py-16">
                <div className="mb-6">
                  <Clock className="w-20 h-20 text-blue-600 mx-auto mb-4 animate-pulse" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">Looking for a wildcat...</h2>
                <p className="text-gray-600">
                  {waitingCount > 1 ? `${waitingCount} users online` : 'Waiting for someone to connect'}
                </p>
                <div className="mt-8">
                  <div className="inline-block">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                      <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {status === 'matched' && (
              <div>
                <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-700 font-semibold">You're now chatting with a random wildcat</span>
                  </div>
                </div>

                {/* Chat Box */}
                <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
                  {/* Messages Area */}
                  <div className="h-96 overflow-y-auto p-4 bg-gray-50">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-400 py-12">
                        <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Say hi to start the conversation!</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {messages.map((msg) => (
                          <div key={msg.id} className="text-sm">
                            <span className={`font-bold ${msg.sender === userId ? 'text-blue-600' : 'text-red-600'}`}>
                              {msg.sender === userId ? 'You' : 'Stranger'}:
                            </span>
                            <span className="text-gray-800 ml-2">{msg.text}</span>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  {/* Input Area */}
                  <div className="border-t-2 border-gray-300 bg-white p-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Type your message here..."
                        className="flex-1 px-4 py-3 border-2 border-gray-300 rounded focus:outline-none focus:border-blue-600 text-base"
                      />
                      <button
                        onClick={sendMessage}
                        className="px-8 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-semibold"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bottom Info */}
                <div className="mt-4 text-center text-gray-500 text-sm">
                  <p>Click "Disconnect" to end this chat and find a new wildcat</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="max-w-6xl mx-auto px-4 py-8 text-center text-gray-400 text-xs">
            <p>MC Wildchat • Marin Catholic Chatting</p>
            <p className="mt-2">Your chats are anonymous and temporary</p>
          </div>
        </div>
      );
    }

    ReactDOM.render(<AnonymousMatcher />, document.getElementById('root'));