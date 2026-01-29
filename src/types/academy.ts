// Saga Academy Types

export type SimulationType = 'voice' | 'text';
export type DifficultyLevel = 'Fácil' | 'Médio' | 'Difícil';
export type DepartmentType = 'Vendas Novos' | 'Vendas Usados' | 'Pós-Venda' | 'Oficina' | 'F&I' | 'Recepção';

export interface Persona {
  id: string;
  name: string;
  role: string;
  company: string;
  avatar?: string;
  difficulty: DifficultyLevel;
  description: string;
  objective: string;
  voice?: string; // OpenAI voice ID: shimmer, alloy, echo, fable, onyx, nova
}

export interface TrainingScenario {
  id: string;
  title: string;
  description: string;
  department: DepartmentType;
  type: SimulationType;
  personas: Persona[];
  duration_minutes?: number;
  language: string;
}

export interface SimulationSession {
  id: string;
  scenario_id: string;
  persona_id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  type: SimulationType;
  status: 'in_progress' | 'completed' | 'cancelled';
}

export interface SimulationMessage {
  id: string;
  session_id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  audio_url?: string;
}

export interface ScoreCategory {
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
  items: ScoreItem[];
}

export interface ScoreItem {
  question: string;
  score: number;
  passed: boolean;
}

export interface SpeechMetrics {
  talkListenRatio: number;
  recommendedRatio: { min: number; max: number };
  fillerWords: number;
  recommendedFillerWords: { min: number; max: number };
  wordsPerMinute: number;
  recommendedWPM: { min: number; max: number };
}

export interface SimulationFeedback {
  id: string;
  session_id: string;
  overall_score: number;
  summary: string;
  highlights: string[];
  recommendations: string[];
  categories: ScoreCategory[];
  speech_metrics?: SpeechMetrics;
  transcription: SimulationMessage[];
  audio_url?: string;
  created_at: string;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  icon: string;
  categories_count: number;
  personas_count: number;
  department: DepartmentType;
  modules: LearningModule[];
  completed: boolean;
  progress: number;
}

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  difficulty: DifficultyLevel;
  personas: Persona[];
  required_score: number;
  completed: boolean;
  user_score?: number;
}

export interface UserPerformance {
  user_id: string;
  user_name: string;
  avatar?: string;
  total_simulations: number;
  average_score: number;
  best_category: string;
  worst_category: string;
  dimensions: PerformanceDimension[];
  weekly_trend: number;
}

export interface PerformanceDimension {
  name: string;
  score: number;
  maxScore: number;
  items: {
    question: string;
    average_score: number;
  }[];
}

export interface RankingEntry {
  position: number;
  user_id: string;
  user_name: string;
  avatar?: string;
  department: string;
  score: number;
  simulations_count: number;
  trend: 'up' | 'down' | 'stable';
}
