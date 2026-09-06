import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { Send, AlertTriangle, Sparkles } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Theme } from '../../theme';
import { useStore, FREE_DAILY_LIMIT } from '../../lib/store';
import { ManasAvatar } from '../../components/ManasAvatar';
import { CrisisOverlay } from '../../components/CrisisOverlay';
import { detectCrisis } from '../../lib/crisis';
import API from '../../lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export const ChatScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const maxBubbleWidth = Math.min(windowWidth * 0.82, 560);
  const [profileName, setProfileName] = useState(useStore.getState().firstName || 'friend');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subData, setSubData] = useState<any>(null);

  const scrollRef = useRef<ScrollView>(null);

  const keyboard = useAnimatedKeyboard();
  const footerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboard.height.value }],
  }));
  const spacerAnimatedStyle = useAnimatedStyle(() => ({
    height: keyboard.height.value,
  }));

  // Load message history from MongoDB whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      const loadHistory = async () => {
        try {
          const subInfo = await API.subscription.get().catch(() => null);
          setSubData(subInfo);

          const profile = await API.user.profile().catch(() => null);
          const resolvedFirstName = profile?.user?.fullName?.split(" ")[0] || useStore.getState().firstName || 'friend';
          setProfileName(resolvedFirstName);

          const history = await API.chat.getMessages();
          if (history && Array.isArray(history.messages) && history.messages.length > 0) {
            const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;
            const mapped: Message[] = history.messages
              .map((m: any) => ({
                id: m._id || Math.random().toString(),
                role: m.role,
                content: m.content,
                timestamp: m.timestamp ? new Date(m.timestamp).getTime() : Date.now()
              }))
              .filter((m: Message) => m.timestamp >= fifteenDaysAgo && !m.content.includes("I'm having trouble responding right now"));
            setMessages(mapped);
          } else {
            // Fallback to initial welcome message if no history exists yet
            setMessages([
              {
                id: 'initial',
                role: 'assistant',
                content: `Hi ${resolvedFirstName}. I'm Manas. Whatever brought you here — let's just sit with it together. What's on your mind?`,
                timestamp: Date.now()
              }
            ]);
          }
        } catch (err) {
          console.warn("Failed to fetch conversation history:", err);
          const resolvedFirstName = useStore.getState().firstName || 'friend';
          // Fallback to welcome message on error
          setMessages([
            {
              id: 'initial',
              role: 'assistant',
              content: `Hi ${resolvedFirstName}. I'm Manas. Whatever brought you here — let's just sit with it together. What's on your mind?`,
              timestamp: Date.now()
            }
          ]);
        } finally {
          setLoading(false);
        }
      };

      loadHistory();
      
      return () => {
        // Optional cleanup on unfocus
      };
    }, [])
  );

  const todayStr = new Date().toLocaleDateString('en-CA');
  const dailyLimit = subData?.usage?.dailyLimit !== undefined ? subData.usage.dailyLimit : FREE_DAILY_LIMIT;
  const usedToday = subData?.usage?.messagesUsedToday !== undefined ? subData.usage.messagesUsedToday : (messages.filter(m => 
    m.role === 'user' && 
    new Date(m.timestamp).toLocaleDateString('en-CA') === todayStr
  ).length || 0);

  const isUnlimited = dailyLimit === null;
  const remaining = isUnlimited ? Infinity : Math.max(0, dailyLimit - usedToday);
  const limitHit = !isUnlimited && remaining === 0;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming || limitHit) return;

    // Detect immediate crisis keywords
    if (detectCrisis(text)) {
      setCrisis(true);
    }

    const userMsg: Message = {
      id: Math.random().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStreaming(true);

    const placeholderId = Math.random().toString();
    const assistantPlaceholder: Message = {
      id: placeholderId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, assistantPlaceholder]);

    // Scroll to bottom immediately
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      // Fetch response using API module
      const res = await API.chat.sendMessage({ message: text });
      
      // Update subscription info
      API.subscription.get().then(setSubData).catch(() => null);
      
      let replyText = res?.reply || "I am here with you. Can you tell me more about that?";
      
      // Simulate typing animation character by character for a highly polished micro-interaction feel
      let index = 0;
      const interval = setInterval(() => {
        if (index < replyText.length) {
          setMessages(prev => prev.map(m => 
            m.id === placeholderId ? { ...m, content: replyText.substring(0, index + 1) } : m
          ));
          index += 2; // print 2 chars at a time for smooth pacing
          scrollRef.current?.scrollToEnd({ animated: false });
        } else {
          clearInterval(interval);
          setStreaming(false);
        }
      }, 20);

    } catch (err) {
      console.warn("API Chat fetch error, using graceful local empathy responder:", err);
      // Failsafe local response generator for offline or simulation stages
      const fallbackReplies = [
        "I hear you. That sounds like a heavy weight to carry. Let's breathe through it together.",
        "Take a slow breath. Whatever you are feeling right now is completely okay to feel. Tell me more.",
        "Thank you for sharing that with me. I am right here with you. What do you feel in your body right now?"
      ];
      const randomReply = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
      
      let index = 0;
      const interval = setInterval(() => {
        if (index < randomReply.length) {
          setMessages(prev => prev.map(m => 
            m.id === placeholderId ? { ...m, content: randomReply.substring(0, index + 1) } : m
          ));
          index += 2;
          scrollRef.current?.scrollToEnd({ animated: false });
        } else {
          clearInterval(interval);
          setStreaming(false);
        }
      }, 20);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Dynamic top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBarLeft}>
          <ManasAvatar size={34} />
          <View>
            <Text style={styles.companionName}>Manas</Text>
            <View style={styles.statusRow}>
              <View style={styles.pulseDot} />
              <Text style={styles.statusText}>AI companion · always here</Text>
            </View>
          </View>
        </View>
        <View style={[
          styles.limitBadge,
          limitHit ? styles.limitBadgeHit : styles.limitBadgeNormal
        ]}>
          <Text style={[
            styles.limitText,
            limitHit ? styles.limitTextHit : styles.limitTextNormal
          ]}>
            {isUnlimited ? 'Unlimited' : `${remaining} left`}
          </Text>
        </View>
      </View>

      {/* Messages Feed */}
      <ScrollView
  ref={scrollRef}
  keyboardShouldPersistTaps="handled"
  contentContainerStyle={styles.feedContent}
>
        {messages.map(m => {
          const isUser = m.role === 'user';
          return (
            <View 
              key={m.id} 
              style={[
                styles.msgBubbleRow,
                { maxWidth: maxBubbleWidth },
                isUser ? styles.msgRowUser : styles.msgRowAssistant
              ]}
            >
              {!isUser && (
                <View style={styles.avatarMini}>
                  <Sparkles size={12} color="#FFF" />
                </View>
              )}
              <View style={[
                styles.bubble,
                isUser ? styles.bubbleUser : styles.bubbleAssistant
              ]}>
                {m.content === '' && streaming ? (
                  <View style={styles.typingBox}>
                    <View style={styles.typingDot} />
                    <View style={styles.typingDot} />
                    <View style={styles.typingDot} />
                  </View>
                ) : (
                  <Text style={[
                    styles.bubbleText,
                    isUser ? styles.textWhite : styles.textDark
                  ]}>
                    {m.content}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
        <Animated.View style={spacerAnimatedStyle} />
      </ScrollView>

      <Animated.View style={footerAnimatedStyle}>
        {/* Limit Warning banner */}
        {limitHit && (
          <View style={styles.limitWarning}>
            <View style={styles.warningHead}>
              <AlertTriangle size={16} color={Theme.colors.secondary} />
              <Text style={styles.warningTitle}>Daily limit reached</Text>
            </View>
            <Text style={styles.warningDesc}>
              {dailyLimit <= 7
                ? 'Come back tomorrow, or upgrade to Mann Shanti (₹199/mo) for 100 messages a day.'
                : 'Come back tomorrow, or upgrade to Apna Therapist for unlimited messages.'}
            </Text>
          </View>
        )}

        {/* Input container */}
        <View style={[styles.inputArea, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            editable={!streaming && !limitHit}
            placeholder={limitHit ? 'Daily limit reached' : 'Type what you feel…'}
            placeholderTextColor={Theme.colors.outline}
            style={styles.chatInput}
            onFocus={() => {
              requestAnimationFrame(() => {
                scrollRef.current?.scrollToEnd({ animated: false });
              });
            }}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || streaming || limitHit}
            style={[
              styles.sendBtn,
              (!input.trim() || streaming || limitHit) && styles.sendBtnDisabled
            ]}
          >
            <Send size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <CrisisOverlay open={crisis} onClose={() => setCrisis(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.margin,
    paddingBottom: Theme.spacing.xs,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceHigh,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  companionName: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
  },
  statusText: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  limitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Theme.radius.full,
  },
  limitBadgeNormal: {
    backgroundColor: Theme.colors.primary + '15',
  },
  limitBadgeHit: {
    backgroundColor: Theme.colors.errorContainer,
  },
  limitText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10,
  },
  limitTextNormal: {
    color: Theme.colors.primary,
  },
  limitTextHit: {
    color: Theme.colors.onErrorContainer,
  },
  feed: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  feedContent: {
    paddingHorizontal: Theme.spacing.margin,
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  msgBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '80%',
  },
  msgRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  msgRowAssistant: {
    alignSelf: 'flex-start',
  },
  avatarMini: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  bubble: {
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.sm,
    flexShrink: 1,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  bubbleUser: {
    backgroundColor: Theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: Theme.colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
  },
  bubbleText: {
    fontFamily: Theme.fonts.body,
    fontSize: 15,
    lineHeight: 22,
    flexShrink: 1,
  },
  textWhite: {
    color: '#FFF',
  },
  textDark: {
    color: Theme.colors.onSurface,
  },
  typingBox: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.colors.primary + '80',
  },
  limitWarning: {
    backgroundColor: Theme.colors.secondaryContainer + '10',
    borderWidth: 1,
    borderColor: Theme.colors.secondaryContainer + '40',
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.sm,
    marginHorizontal: Theme.spacing.margin,
    marginBottom: Theme.spacing.xs,
  },
  warningHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  warningTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: Theme.colors.secondary,
  },
  warningDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.textMuted,
    lineHeight: 16,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.margin,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceHigh,
  },
  chatInput: {
    flex: 1,
    height: 48,
    borderRadius: Theme.radius.full,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: Theme.fonts.body,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceLow,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
export default ChatScreen;
