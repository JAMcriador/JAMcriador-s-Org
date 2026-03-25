/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BibleTopic {
  id?: number;
  tema: string;
  versiculo: string;
  explicacao: string;
  contexto?: string;
  aplicacao: string;
  devocional: string;
  oracao: string;
  perguntas?: string[];
  tags: string[];
  is_ai_generated?: boolean;
}

export interface Favorite {
  id: number;
  type: 'topic' | 'verse' | 'devotional';
  content_id: number;
  title: string;
  subtitle?: string;
  created_at: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'visitor' | 'user' | 'admin';
  created_at: string;
}

export interface JournalEntry {
  id: number;
  user_id: number;
  type: 'reflection' | 'prayer' | 'thought';
  content: string;
  created_at: string;
}

export interface StudyPlan {
  id: number;
  title: string;
  description: string;
  category: string;
  duration_days: number;
  is_premium: boolean;
}

export interface StudyPlanDay {
  id: number;
  plan_id: number;
  day_number: number;
  versiculo: string;
  explicacao: string;
  aplicacao: string;
  pergunta: string;
  oracao: string;
}

export interface UserSettings {
  language: 'simple' | 'intermediate';
  notifications: boolean;
  theme: 'light' | 'dark';
  user?: User | null;
}
