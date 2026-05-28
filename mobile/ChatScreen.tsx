import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, StatusBar, Image } from 'react-native';
import { useFonts } from 'expo-font';
import { InriaSerif_400Regular, InriaSerif_700Bold } from '@expo-google-fonts/inria-serif';
import { useApp } from './lib/AppContext';
import { sendChatMessage, getChatHistory } from './lib/api';

const C = {
  bg:        '#F7F6F2',
  surface:   '#FFFFFF',
  primary:   '#1A1B14',
  secondary: '#686760',
  light:     '#A6A59F',
  green:     '#44A353',
  olive:     '#363E28',
  lightGreen:'#EEF2E9',
  border:    '#E5E2DB',
};

interface Props {
  onBack: () => void;
}

export default function ChatScreen({ onBack }: Props) {
  const [fontsLoaded] = useFonts({ InriaSerif_400Regular, InriaSerif_700Bold });
  const serifBold = fontsLoaded ? 'InriaSerif_700Bold' : undefined;
  const serif = fontsLoaded ? 'InriaSerif_400Regular' : undefined;

  const { sessionId } = useApp();
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      setLoadingHistory(true);
      try {
        const history = await getChatHistory(sessionId);
        if (history.length > 0) {
          setMessages(history.map(m => ({ role: m.role, content: m.content })));
        } else {
          setMessages([{
            role: 'assistant',
            content: "Hi! I'm your genomic AI assistant. Ask me anything about your health report!"
          }]);
        }
      } catch {
        setMessages([{
          role: 'assistant',
          content: "Hi! I'm your genomic AI assistant. Ask me anything about your health report!"
        }]);
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, [sessionId]);

  const sendMessage = async () => {
    if (!input.trim() || !sessionId) return;
    
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, {role: 'user', content: userMsg}]);
    setLoading(true);
    
    try {
      const response = await sendChatMessage(sessionId as string, userMsg);
      setMessages(prev => [...prev, {role: 'assistant', content: response}]);
    } catch (e) {
      setMessages(prev => [...prev, {role: 'assistant', content: "Sorry, I couldn't process that request right now."}]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView 
        style={styles.root} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { fontFamily: serifBold }]}>Ask Your DNA</Text>
          <View style={{width: 50}} />
        </View>

        <ScrollView ref={scrollRef} style={styles.chatArea} contentContainerStyle={{ padding: 16 }} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          {loadingHistory ? (
            <ActivityIndicator size="large" color={C.green} style={{ marginTop: 40 }} />
          ) : (
            messages.map((m, i) => (
              <View key={i} style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.botBubble]}>
                <Text style={[m.role === 'user' ? styles.userText : styles.botText, { fontFamily: serif }]}>{m.content}</Text>
              </View>
            ))
          )}
          {loading && <ActivityIndicator size="small" color={C.green} style={{marginTop: 10}}/>}
        </ScrollView>
        
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { fontFamily: serif }]}
            value={input}
            onChangeText={setInput}
            placeholder="e.g. Can I drink coffee safely?"
            placeholderTextColor={C.light}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={loading || !input.trim()}>
            <Text style={[styles.sendBtnText, { fontFamily: serifBold }]}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  backBtn: { padding: 8 },
  backText: { color: C.secondary, fontSize: 16 },
  title: { fontSize: 20, color: C.primary },
  chatArea: { flex: 1 },
  bubble: { maxWidth: '80%', padding: 14, borderRadius: 18, marginBottom: 16 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: C.olive },
  botBubble: { alignSelf: 'flex-start', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  userText: { color: C.bg, fontSize: 16, lineHeight: 22 },
  botText: { color: C.primary, fontSize: 16, lineHeight: 22 },
  inputRow: { flexDirection: 'row', padding: 12, backgroundColor: C.surface, borderTopWidth: 1, borderColor: C.border },
  input: { flex: 1, backgroundColor: C.bg, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, fontSize: 16, marginRight: 10, color: C.primary },
  sendBtn: { backgroundColor: C.green, borderRadius: 24, paddingHorizontal: 20, justifyContent: 'center' },
  sendBtnText: { color: C.surface, fontSize: 16 }
});
