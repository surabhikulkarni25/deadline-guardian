// Define all core types for Deadline Guardian

export type AIPersonality = 'Strict Coach' | 'Supportive Friend' | 'Competitive Rival' | 'Calm Mentor';
export type ThemePreference = 'Dark' | 'Light';
export type PeakProductivity = 'Morning' | 'Afternoon' | 'Night Owl' | 'Unpredictable';
export type ProductivityStruggle = 'Starting tasks' | 'Staying focused' | 'Perfectionism' | 'Time tracking';
export type MotivationStyle = 'Tough Love' | 'Gentle Nudges' | 'Gamified Rewards' | 'Logical Deadlines';

export interface UserProfile {
  uid?: string;
  name: string;
  personality: AIPersonality;
  theme: ThemePreference;
  peakTime: PeakProductivity;
  struggle: ProductivityStruggle;
  motivation: MotivationStyle;
  displayName?: string;
  username?: string;
  email?: string;
  photoURL?: string;
  createdAt?: string;
  onboardingCompleted?: boolean;
  level?: number;
  xp?: number;
  streak?: number;
  friends?: string[];
  incomingRequests?: string[];
  outgoingRequests?: string[];
  completedTasksCount?: number;
  missedTasksCount?: number;
  badges?: UserBadge[];
  voiceAssistantEnabled?: boolean;
  notificationsEnabled?: boolean;
  chronos?: {
    xp: number;
    lastUpdated: string;
    tauntMessage?: string;
  };
  dailyInsight?: {
    text: string;
    type: string;
    tag: string;
    generatedAt: string;
  };
}

export interface UserBadge {
  name: string;
  description: string;
  icon: string;
  unlockedAt: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  category: 'Task' | 'Milestone' | 'Streak';
}

export type TaskType = 'Assignment' | 'Study' | 'Meeting' | 'Personal' | 'Health' | 'Finance' | 'Custom';
export type TaskPriority = 'Urgent' | 'Important' | 'Low Priority';

export interface Task {
  id: string;
  title: string;
  description?: string;
  deadline: string; // ISO date string
  urgency: number; // 1-10
  importance: number; // 1-10
  estDuration: number; // minutes
  energyRequired: 'Low' | 'Medium' | 'High';
  type: TaskType | string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Incomplete' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'Missed' | 'Canceled';
  priorityLevel?: TaskPriority | string; // Assigned by AI
  completedAt?: string; // ISO string
  createdAt?: number; // timestamp
  focusFailures?: number;
  personalNote?: string;
  startedAt?: string;
  startProofImage?: string;
  endProofImage?: string;
  completionReflection?: string;
  lastReminderAt?: number;
  reminderCount?: number;
  snoozeUntil?: number;
  missPenaltyApplied?: boolean;
}

export interface GamificationState {
  xp: number;
  level: number;
  streak: number;
  badges: UserBadge[];
}

export interface RiskState {
  score: number; // 0-100
  level: 'Stable' | 'Mild Concern' | 'Rising Risk' | 'Dangerous' | 'Critical';
  reason: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export interface ChatSession {
  chatId: string;
  title: string;
  messages: Message[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

