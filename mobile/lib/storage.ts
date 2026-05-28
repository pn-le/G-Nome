import AsyncStorage from '@react-native-async-storage/async-storage';
import { ParseResult, ReportResult } from './types';

const PAST_SESSIONS_KEY = 'G_NOME_PAST_SESSIONS';

export interface PastSession {
  id: string;
  date: string;
  fileName: string;
  parse: ParseResult;
  report: ReportResult;
}

export async function savePastSession(fileName: string, parse: ParseResult, report: ReportResult) {
  try {
    const existing = await getPastSessions();
    // Remove if already exists
    const filtered = existing.filter(s => s.id !== parse.session_id);
    filtered.unshift({
      id: parse.session_id,
      date: new Date().toISOString(),
      fileName,
      parse,
      report
    });
    await AsyncStorage.setItem(PAST_SESSIONS_KEY, JSON.stringify(filtered.slice(0, 10))); // keep last 10
  } catch (e) {
    console.error('Failed to save session', e);
  }
}

export async function getPastSessions(): Promise<PastSession[]> {
  try {
    const data = await AsyncStorage.getItem(PAST_SESSIONS_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to get sessions', e);
    return [];
  }
}
