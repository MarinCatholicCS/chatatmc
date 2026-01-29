const { useState, useEffect, useRef } = React;

    // Lucide React icons as inline SVG components
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
      const [status, setStatus] = useState('disconnected'); // disconnected, waiting, matched
      const [userId, setUserId] = useState(null);
      const [partnerId, setPartnerId] = useState(null);
      const [sessionId, setSessionId] = useState(null);
      const [messages, setMessages] = useState([]);
      const [messageInput, setMessageInput] = useState('');
      const [waitingCount, setWaitingCount] = useState(0);
      const [error, setError] = useState(null);
      const intervalRef = useRef(null);
      const messagesEndRef = useRef(null);

      const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      };

      useEffect(() => {
        scrollToBottom();
      }, [messages]);

      // Generate a unique user ID
      const generateUserId = () => {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      };

      // Join the matching pool
      const joinQueue = async () => {
        try {
          setError(null);
          const newUserId = generateUserId();
          setUserId(newUserId);

          // Add user to waiting pool
          const userData = {
            id: newUserId,
            timestamp: Date.now(),
            status: 'waiting'
          };

          await window.storage.set(`waiting:${newUserId}`, JSON.stringify(userData), true);
          setStatus('waiting');
          
          // Start polling for matches
          startPolling(newUserId);
        } catch (err) {
          setError('Failed to join queue. Please try again.');
          console.error('Join queue error:', err);
        }
      };

      // Poll for matches and update status
      const startPolling = (currentUserId) => {
        intervalRef.current = setInterval(async () => {
          try {
            await checkForMatch(currentUserId);
            await updateWaitingCount();
          } catch (err) {
            console.error('Polling error:', err);
          }
        }, 2000);
      };

      // Check if we've been matched
      const checkForMatch = async (currentUserId) => {
        try {
          const userResult = await window.storage.get(`waiting:${currentUserId}`, true);
          
          if (!userResult) {
            // We've been matched! Check for session
            const keysResult = await window.storage.list('session:', true);
            
            if (keysResult && keysResult.keys) {
              for (const key of keysResult.keys) {
                try {
                  const sessionResult = await window.storage.get(key, true);
                  if (sessionResult) {
                    const session = JSON.parse(sessionResult.value);
                    if (session.user1 === currentUserId || session.user2 === currentUserId) {
                      setSessionId(session.id);
                      setPartnerId(session.user1 === currentUserId ? session.user2 : session.user1);
                      setStatus('matched');
                      clearInterval(intervalRef.current);
                      startMessagePolling(session.id);
                      return;
                    }
                  }
                } catch (err) {
                  // Skip invalid sessions
                }
              }
            }
          } else {
            // Still waiting, try to find a match
            await attemptMatching(currentUserId);
          }
        } catch (err) {
          console.error('Check match error:', err);
        }
      };

      // Try to match with another waiting user
      const attemptMatching = async (currentUserId) => {
        try {
          const keysResult = await window.storage.list('waiting:', true);
          
          if (!keysResult || !keysResult.keys) return;

          const waitingUsers = [];
          for (const key of keysResult.keys) {
            if (!key.includes(currentUserId)) {
              try {
                const result = await window.storage.get(key, true);
                if (result) {
                  waitingUsers.push(JSON.parse(result.value));
                }
              } catch (err) {
                // Skip invalid entries
              }
            }
          }

          if (waitingUsers.length > 0) {
            // Match with the first available user
            const partner = waitingUsers[0];
            const newSessionId = 'session_' + Date.now();
            
            const session = {
              id: newSessionId,
              user1: currentUserId,
              user2: partner.id,
              createdAt: Date.now(),
              messages: []
            };

            // Create session
            await window.storage.set(`session:${newSessionId}`, JSON.stringify(session), true);
            
            // Remove both users from waiting pool
            await window.storage.delete(`waiting:${currentUserId}`, true);
            await window.storage.delete(`waiting:${partner.id}`, true);
          }
        } catch (err) {
          console.error('Matching error:', err);
        }
      };

      // Update count of waiting users
      const updateWaitingCount = async () => {
        try {
          const keysResult = await window.storage.list('waiting:', true);
          setWaitingCount(keysResult && keysResult.keys ? keysResult.keys.length : 0);
        } catch (err) {
          console.error('Count update error:', err);
        }
      };

      // Poll for new messages
      const startMessagePolling = (currentSessionId) => {
        const messageInterval = setInterval(async () => {
          try {
            const sessionResult = await window.storage.get(`session:${currentSessionId}`, true);
            if (sessionResult) {
              const session = JSON.parse(sessionResult.value);
              setMessages(session.messages || []);
            }
          } catch (err) {
            console.error('Message polling error:', err);
          }
        }, 1000);

        intervalRef.current = messageInterval;
      };

      // Send a message
      const sendMessage = async () => {
        if (!messageInput.trim() || !sessionId) return;

        try {
          const sessionResult = await window.storage.get(`session:${sessionId}`, true);
          if (sessionResult) {
            const session = JSON.parse(sessionResult.value);
            const newMessage = {
              id: Date.now(),
              sender: userId,
              text: messageInput,
              timestamp: Date.now()
            };
            
            session.messages = [...(session.messages || []), newMessage];
            await window.storage.set(`session:${sessionId}`, JSON.stringify(session), true);
            
            setMessages(session.messages);
            setMessageInput('');
          }
        } catch (err) {
          setError('Failed to send message. Please try again.');
          console.error('Send message error:', err);
        }
      };

      // Leave the session
      const leaveSession = async () => {
        try {
          if (status === 'waiting' && userId) {
            await window.storage.delete(`waiting:${userId}`, true);
          }
          
          if (status === 'matched' && sessionId) {
            await window.storage.delete(`session:${sessionId}`, true);
          }
          
          clearInterval(intervalRef.current);
          setStatus('disconnected');
          setUserId(null);
          setPartnerId(null);
          setSessionId(null);
          setMessages([]);
          setError(null);
        } catch (err) {
          console.error('Leave session error:', err);
        }
      };

      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-purple-600" />
                  <h1 className="text-2xl font-bold text-gray-800">Anonymous Matcher</h1>
                </div>
                {status !== 'disconnected' && (
                  <button
                    onClick={leaveSession}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Leave
                  </button>
                )}
              </div>
              <p className="text-gray-600 mt-2">Connect with random people anonymously</p>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            {/* Status Display */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              {status === 'disconnected' && (
                <div className="text-center py-12">
                  <UserCheck className="w-16 h-16 text-purple-600 mx-auto mb-4" />
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">Ready to Connect?</h2>
                  <p className="text-gray-600 mb-6">Click below to join and get matched with someone anonymously</p>
                  <button
                    onClick={joinQueue}
                    className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
                  >
                    Join Queue
                  </button>
                </div>
              )}

              {status === 'waiting' && (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-pulse" />
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4">Waiting for Match...</h2>
                  <p className="text-gray-600 mb-2">Looking for someone to connect with</p>
                  <p className="text-sm text-gray-500">
                    {waitingCount > 1 ? `${waitingCount} people waiting` : 'You are next in line'}
                  </p>
                  <div className="mt-6">
                    <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                  </div>
                </div>
              )}

              {status === 'matched' && (
                <div>
                  <div className="flex items-center justify-between mb-6 pb-4 border-b">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-green-600 font-semibold">Connected</span>
                    </div>
                    <span className="text-sm text-gray-500">Chatting with a stranger</span>
                  </div>

                  {/* Messages */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4 h-96 overflow-y-auto">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-400 py-12">
                        <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No messages yet. Say hi!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.sender === userId ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-xs px-4 py-2 rounded-lg ${
                                msg.sender === userId
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-white text-gray-800 border border-gray-200'
                              }`}
                            >
                              <p>{msg.text}</p>
                              <span className="text-xs opacity-70 mt-1 block">
                                {new Date(msg.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  {/* Message Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                    <button
                      onClick={sendMessage}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This app uses shared storage, so all users can see and join the same matching pool. 
                Your data is visible to anyone using this page. Messages and sessions are temporary.
              </p>
            </div>
          </div>
        </div>
      );
    }

    ReactDOM.render(<AnonymousMatcher />, document.getElementById('root'));