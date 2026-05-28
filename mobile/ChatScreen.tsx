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

  const setInputAndSend = (text: string) => {
    setInput(text);
  };

  const handleSuggestionPress = (text: string) => {
    setInput(text);
    // Use a small timeout to let state update before sending
    setTimeout(() => {
      // Actually we can just send it directly if we modify sendMessage to accept a string argument
    }, 0);
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
            <Text style={styles.backText}>← Dashboard</Text>
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} style={styles.chatArea} contentContainerStyle={{ padding: 16 }} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          <View style={{ alignItems: 'center', marginBottom: 30, marginTop: 10 }}>
            <Image source={require('./assets/images/small gene tree.png')} style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.8 }} resizeMode="contain" />
            <Text style={{ fontFamily: serifBold, fontSize: 24, color: C.primary }}>Chat with G-nome</Text>
          </View>

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
        
        {messages.length <= 1 && !loading && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsContainer}>
            {['Can I drink coffee?', 'Will I go bald?', 'Am I a carrier for anything?'].map((suggestion, i) => (
              <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => setInputAndSend(suggestion)}>
                <Text style={[styles.suggestionText, { fontFamily: serif }]}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { fontFamily: serif }]}
            value={input}
            onChangeText={setInput}
            placeholder="Ask me anything about your DNA..."
            placeholderTextColor={C.light}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={loading || !input.trim()}>
            <Text style={{ color: C.surface, fontSize: 18 }}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backBtn: { padding: 8, alignSelf: 'flex-start' },
  backText: { color: C.primary, fontSize: 14, fontWeight: '500' },
  chatArea: { flex: 1 },
  bubble: { maxWidth: '85%', padding: 16, borderRadius: 20, marginBottom: 16 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: C.olive, borderBottomRightRadius: 4 },
  botBubble: { alignSelf: 'flex-start', backgroundColor: C.surface, borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  userText: { color: C.surface, fontSize: 15, lineHeight: 22 },
  botText: { color: C.primary, fontSize: 15, lineHeight: 22 },
  suggestionsContainer: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  suggestionChip: { backgroundColor: C.olive, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  suggestionText: { color: C.surface, fontSize: 13 },
  inputRow: { flexDirection: 'row', padding: 16, paddingBottom: 30, backgroundColor: C.bg, alignItems: 'center' },
  input: { flex: 1, backgroundColor: C.surface, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 14, fontSize: 15, marginRight: 10, color: C.primary, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  sendBtn: { backgroundColor: C.primary, borderRadius: 24, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
