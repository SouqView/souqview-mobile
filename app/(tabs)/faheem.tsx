import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, MIN_TOUCH_TARGET } from '../../constants/theme';
import { useExpertise } from '../../contexts/ExpertiseContext';
import { sendChatMessage, toFaheemMode } from '../../src/services/aiService';
import type { ChatMessage } from '../../src/services/aiService';

export default function FaheemScreen() {
  const { expertiseLevel } = useExpertise();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const userMessage: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);
    try {
      const mode = toFaheemMode(expertiseLevel);
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const reply = await sendChatMessage(text, history, undefined, mode);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      if (__DEV__) console.warn('Faheem send error', e);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I couldn’t reach the server. Try again.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Faheem</Text>
        <Text style={styles.subtitle}>
          {expertiseLevel === 'beginner' ? 'Simple explanations · Learning focus' : 'Technical analysis · Pro mode'}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.chatWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textTertiary} />
              <Text style={styles.emptyText}>
                Ask Faheem about markets, stocks, or your portfolio. Your Knowledge Level in Settings changes how he explains.
              </Text>
            </View>
          )}
          {messages.map((m, i) => (
            <View
              key={i}
              style={m.role === 'user' ? styles.bubbleUserWrap : styles.bubbleAssistantWrap}
            >
              <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
                <Text style={m.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant}>
                  {m.content}
                </Text>
              </View>
            </View>
          ))}
          {sending && (
            <View style={styles.bubbleAssistantWrap}>
              <View style={styles.bubbleAssistant}>
                <ActivityIndicator size="small" color={COLORS.textTertiary} />
                <Text style={styles.bubbleTextAssistant}>Thinking…</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask Faheem anything..."
            placeholderTextColor={COLORS.textTertiary}
            multiline
            maxLength={1000}
            editable={!sending}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            <Ionicons name="send" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.textTertiary, marginTop: 4 },
  chatWrap: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 120 },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  bubbleUserWrap: { alignItems: 'flex-end', marginBottom: 12 },
  bubbleAssistantWrap: { alignItems: 'flex-start', marginBottom: 12 },
  bubble: {
    maxWidth: '85%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: COLORS.electricBlue,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  bubbleTextUser: { fontSize: 15, color: '#fff' },
  bubbleTextAssistant: { fontSize: 15, color: COLORS.text, lineHeight: 22 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    backgroundColor: COLORS.electricBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: { backgroundColor: COLORS.textTertiary, opacity: 0.7 },
});
