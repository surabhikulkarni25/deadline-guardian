import { AIPersonality } from '../types';

export function getGuardianName(personality: AIPersonality): string {
  switch (personality) {
    case 'Supportive Friend': return 'Ava';
    case 'Strict Coach': return 'Atlas';
    case 'Calm Mentor': return 'Sage';
    case 'Competitive Rival': return 'Kaizen';
    default: return 'Guardian';
  }
}

export function getNotificationMessage(personality: AIPersonality, taskTitle: string): string {
  switch (personality) {
    case 'Supportive Friend': return `Hey, your ${taskTitle} task needs attention. You can do this 💜`;
    case 'Strict Coach': return `Stop delaying. Your ${taskTitle} deadline is approaching.`;
    case 'Calm Mentor': return `Your ${taskTitle} task is waiting. A small step now reduces future stress.`;
    case 'Competitive Rival': return `Chronos gains every minute you hesitate.`;
    default: return `Your task ${taskTitle} needs attention.`;
  }
}

export function getAlertMessage(personality: AIPersonality): string {
  switch (personality) {
    case 'Supportive Friend': return `You’ve postponed this twice already. I still believe in you.`;
    case 'Strict Coach': return `No more delay. Action now.`;
    case 'Calm Mentor': return `Facing it now is easier than carrying the stress.`;
    case 'Competitive Rival': return `Chronos is gaining XP while you hesitate.`;
    default: return `Please start this task now.`;
  }
}
