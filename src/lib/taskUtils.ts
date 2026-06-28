import { differenceInHours, differenceInCalendarDays } from 'date-fns';
import { Task, TaskPriority, UserBadge } from '../types';

export function calculateTaskRisk(task: Task): { score: number, priority: TaskPriority } {
  console.log(`[RISK_CALC_START] Calculating risk for task: ${task.title} (${task.id})`);

  // Parse urgency and importance (1-10)
  const u = Number(task.urgency) || (task.priorityLevel === 'Urgent' || task.priorityLevel === 'Critical' ? 10 : task.priorityLevel === 'Important' ? 7 : 3);
  const i = Number(task.importance) || (task.priorityLevel === 'Urgent' || task.priorityLevel === 'Critical' ? 10 : task.priorityLevel === 'Important' ? 8 : 4);
  const urgencyValue = (u / 10) * 100;
  const importanceValue = (i / 10) * 100;
  
  let energyValue = 50;
  if (task.energyRequired === 'High') energyValue = 100;
  else if (task.energyRequired === 'Low') energyValue = 20;

  let ageRisk = 5;
  const createdAtTime = task.createdAt || Date.now();
  const ageDays = Math.max(0, differenceInCalendarDays(new Date(), new Date(createdAtTime)));
  
  if (ageDays <= 1) ageRisk = 5;
  else if (ageDays <= 3) ageRisk = 25;
  else if (ageDays <= 7) ageRisk = 50;
  else if (ageDays <= 14) ageRisk = 75;
  else ageRisk = 100;

  // Base Risk Calculation
  let finalRisk = (urgencyValue * 0.35) + (importanceValue * 0.35) + (energyValue * 0.15) + (ageRisk * 0.15);

  // Deadline Multiplier
  let isDueTodayOrOverdue = false;
  let hasValidDeadline = false;
  
  if (task.deadline) {
    const taskDate = new Date(task.deadline);
    taskDate.setHours(23, 59, 59, 999);
    if (!isNaN(taskDate.getTime())) {
      hasValidDeadline = true;
      const hoursUntilDeadline = differenceInHours(taskDate, new Date());
      const daysUntilDeadline = differenceInCalendarDays(taskDate, new Date());
      
      let multiplier = 1.0;
      if (hoursUntilDeadline <= 6) multiplier = 1.8;
      else if (hoursUntilDeadline <= 24) multiplier = 1.5;
      else if (daysUntilDeadline <= 3) multiplier = 1.3;
      else multiplier = 1.0;

      finalRisk = finalRisk * multiplier;
      isDueTodayOrOverdue = differenceInCalendarDays(taskDate, new Date()) <= 0;
    }
  }

  if (!hasValidDeadline) {
    finalRisk = finalRisk * 0.65;
  }

  // Focus Failure Risk (Additive penalty)
  let focusFailureRisk = 0;
  const failures = task.focusFailures || 0;
  if (failures === 1) focusFailureRisk = 5;
  else if (failures === 2) focusFailureRisk = 10;
  else if (failures > 2) focusFailureRisk = 15;

  finalRisk = finalRisk + focusFailureRisk;

  // Cap final risk
  finalRisk = Math.round(finalRisk);
  
  // Apply hard cap for no deadline at the very end
  if (!hasValidDeadline) {
    finalRisk = Math.min(55, finalRisk);
  }
  
  finalRisk = Math.min(100, Math.max(0, finalRisk));

  console.log(`[RISK_FINAL] Computed risk: ${finalRisk}%`);

  let priority: TaskPriority = 'Low Priority';
  if (finalRisk >= 86 || isDueTodayOrOverdue) priority = 'Urgent';
  else if (finalRisk >= 41) priority = 'Important';
  
  return { score: finalRisk, priority };
}

export function aggregateRiskScore(tasks: Task[]): number {
  const pending = tasks.filter(t => t.status !== 'Completed' && t.status !== 'Canceled' && t.status !== 'Incomplete');
  if (pending.length === 0) return 0;
  
  let totalScore = 0;
  let totalWeight = 0;
  
  pending.forEach(t => {
    const risk = calculateTaskRisk(t).score;
    const weight = risk >= 80 ? 3 : risk >= 50 ? 2 : 1;
    totalScore += risk * weight;
    totalWeight += weight;
  });
  
  return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
}

export function calculateTaskXP(task: Task, riskScore: number, streak: number = 0): { baseXP: number, bonusXP: number, totalXP: number } {
  let difficulty = 'Medium';
  const u = Number(task.urgency) || 5;
  const i = Number(task.importance) || 5;
  
  if (u >= 8 && i >= 8 && task.energyRequired === 'High') {
    difficulty = 'Hard';
  } else if (u <= 4 && i <= 4 && task.energyRequired === 'Low') {
    difficulty = 'Easy';
  }

  let baseXP = 50;
  if (difficulty === 'Hard') baseXP = 100;
  if (difficulty === 'Easy') baseXP = 20;

  let bonusXP = 0;
  if (riskScore > 75) {
    bonusXP += 25;
  }
  
  bonusXP += (10 * streak);

  return { baseXP, bonusXP, totalXP: baseXP + bonusXP };
}

export function getBadgeForTaskType(type: string): UserBadge {
  const now = new Date().toISOString();
  switch (type) {
    case 'Assignment': return { name: 'Deadline Demon', description: 'Conquered an assignment', icon: '😈', unlockedAt: now, rarity: 'Epic', category: 'Task' };
    case 'Study': return { name: 'Locked In', description: 'Completed a study session', icon: '🧠', unlockedAt: now, rarity: 'Rare', category: 'Task' };
    case 'Meeting': return { name: 'Main Character Energy', description: 'Crushed a meeting', icon: '🗣️', unlockedAt: now, rarity: 'Common', category: 'Task' };
    case 'Health': return { name: 'Gym Rat Arc', description: 'Taking care of the vessel', icon: '💪', unlockedAt: now, rarity: 'Rare', category: 'Task' };
    case 'Finance': return { name: 'Money Brain', description: 'Handled financial business', icon: '📈', unlockedAt: now, rarity: 'Rare', category: 'Task' };
    case 'Personal': return { name: 'Glow-Up Arc', description: 'Working on yourself', icon: '✨', unlockedAt: now, rarity: 'Common', category: 'Task' };
    case 'Custom':
    default: return { name: 'Built Different', description: 'Completed a custom task', icon: '🔥', unlockedAt: now, rarity: 'Common', category: 'Task' };
  }
}

export function getMilestoneBadges(completedCount: number): UserBadge[] {
  const badges: UserBadge[] = [];
  const now = new Date().toISOString();
  
  if (completedCount === 5) {
    badges.push({ name: 'Starter Pack', description: 'Completed 5 tasks', icon: '🎒', unlockedAt: now, rarity: 'Common', category: 'Milestone' });
  }
  if (completedCount === 25) {
    badges.push({ name: 'On Fire Fr', description: 'Completed 25 tasks', icon: '🔥', unlockedAt: now, rarity: 'Rare', category: 'Milestone' });
  }
  if (completedCount === 50) {
    badges.push({ name: 'No Excuses Era', description: 'Completed 50 tasks', icon: '🛡️', unlockedAt: now, rarity: 'Epic', category: 'Milestone' });
  }
  if (completedCount === 100) {
    badges.push({ name: 'Productivity Royalty', description: 'Completed 100 tasks', icon: '👑', unlockedAt: now, rarity: 'Legendary', category: 'Milestone' });
  }
  
  return badges;
}

export function getStreakBadge(streak: number): UserBadge | null {
  const now = new Date().toISOString();
  if (streak === 3) return { name: 'Momentum Brewing', description: 'Maintained a 3-day streak', icon: '☕', unlockedAt: now, rarity: 'Common', category: 'Streak' };
  if (streak === 7) return { name: 'Consistency Goes Brrr', description: 'Maintained a 7-day streak', icon: '🥶', unlockedAt: now, rarity: 'Rare', category: 'Streak' };
  if (streak === 30) return { name: 'Actually Unstoppable', description: 'Maintained a 30-day streak', icon: '🦾', unlockedAt: now, rarity: 'Legendary', category: 'Streak' };
  return null;
}

export function getBadgeMessage(badgeName: string, guardianName: string): string {
  switch (badgeName) {
    case 'Deadline Demon': return `${guardianName} says: "Another deadline crushed."`;
    case 'Locked In': return `${guardianName} says: "Knowledge is your greatest weapon."`;
    case 'Main Character Energy': return `${guardianName} says: "A well-executed plan."`;
    case 'Gym Rat Arc': return `${guardianName} says: "Your body is a temple. Keep it strong."`;
    case 'Money Brain': return `${guardianName} says: "Wealth grows through discipline."`;
    case 'Glow-Up Arc': return `${guardianName} says: "Becoming better, one step at a time."`;
    case 'Built Different': 
    default: return `${guardianName} says: "Victory belongs to the persistent!"`;
  }
}

export function getTotalXPRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level === 2) return 100;
  if (level === 3) return 250;
  if (level === 4) return 500;
  if (level === 5) return 900;
  if (level === 6) return 1400;
  if (level === 7) return 2000;
  return Math.round(100 * Math.pow(level - 1, 1.8));
}

export function getLevelFromXP(totalXP: number): number {
  let level = 1;
  while (totalXP >= getTotalXPRequiredForLevel(level + 1)) {
    level++;
  }
  return level;
}

export function getLevelProgress(totalXP: number): { currentLevelXP: number, xpForNextLevel: number, progressPercent: number, currentLevel: number, nextLevelXP: number, currentLevelTotalXP: number } {
  const currentLevel = getLevelFromXP(totalXP);
  const currentLevelTotalXP = getTotalXPRequiredForLevel(currentLevel);
  const nextLevelXP = getTotalXPRequiredForLevel(currentLevel + 1);
  
  const currentLevelXP = totalXP - currentLevelTotalXP;
  const xpForNextLevel = nextLevelXP - currentLevelTotalXP;
  
  let progressPercent = 0;
  if (xpForNextLevel > 0) {
    progressPercent = Math.min(100, Math.max(0, (currentLevelXP / xpForNextLevel) * 100));
  }
  
  return {
    currentLevel,
    currentLevelXP,
    xpForNextLevel,
    progressPercent,
    currentLevelTotalXP,
    nextLevelXP
  };
}

export function getGuardianRankTitle(level: number): string {
  if (level >= 10) return 'Legendary Guardian';
  if (level >= 7) return 'Master Guardian';
  if (level >= 5) return 'Elite Guardian';
  if (level >= 3) return 'Rising Guardian';
  return 'Rookie Guardian';
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

export function getCompletedTaskDates(tasks: Task[]): Date[] {
  const now = new Date();
  return tasks
    .filter(t => t.status === 'Completed' && (t.completedAt || t.deadline))
    .map(t => {
      const date = new Date((t.completedAt || t.deadline) as string);
      // If we are falling back to a future deadline, clamp it to today because it was already completed
      if (!t.completedAt && date.getTime() > now.getTime()) {
        return now;
      }
      return date;
    })
    .sort((a, b) => b.getTime() - a.getTime());
}

export function calculateCurrentStreak(tasks: Task[]): number {
  const completedDates = getCompletedTaskDates(tasks);
  if (completedDates.length === 0) return 0;

  // normalize to YYYY-MM-DD
  const uniqueDaysStr = Array.from(new Set(completedDates.map(d => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })));

  if (uniqueDaysStr.length === 0) return 0;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  // If no task completed today or yesterday, streak is broken
  if (!uniqueDaysStr.includes(todayStr) && !uniqueDaysStr.includes(yesterdayStr)) {
    return 0;
  }

  let streak = 0;
  let d = new Date(today);
  
  // If the streak doesn't include today, we start checking from yesterday
  if (!uniqueDaysStr.includes(todayStr)) {
    d.setDate(d.getDate() - 1);
  }

  while (true) {
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (uniqueDaysStr.includes(dStr)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export function calculateChronosDailyUpdate(
  currentChronos: { xp: number, lastUpdated: string, tauntMessage?: string } | undefined,
  userXP: number,
  streak: number
): { xp: number, lastUpdated: string, tauntMessage: string } | null {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  console.log("[CHRONOS_CHECK] Checking Chronos update for date:", todayStr);

  if (currentChronos?.lastUpdated === todayStr) {
    console.log("[CHRONOS_ALREADY_UPDATED_TODAY] Last updated matches today.");
    return null; // Already updated today
  }

  console.log("[CHRONOS_UPDATE_ATTEMPT] Updating Chronos XP for a new day");

  // RULE 3 - NEW USER INITIALIZATION
  const prevXP = currentChronos?.xp || 150;
  
  // RULE 4 - DAILY INCREMENT FORMULA
  const baseXP = 80;
  const adaptiveXP = 60; // Insufficient history fallback
  const streakBonus = Math.min(streak * 5, 50);

  let dailyIncrement = baseXP + adaptiveXP + streakBonus;

  // RULE 5 - SAFETY CLAMP
  dailyIncrement = Math.max(120, Math.min(250, dailyIncrement));

  // RULE 6 - CATCH-UP PROTECTION
  if (prevXP - userXP > 400) {
    dailyIncrement *= 0.5;
  }

  console.log(`[CHRONOS_DAILY_INCREMENT] prevXP: ${prevXP}, userXP: ${userXP}, increment: ${dailyIncrement}`);

  const newChronosXP = Math.round(prevXP + dailyIncrement);
  const userWins = userXP >= newChronosXP;

  console.log(`[CHRONOS_UPDATE_SUCCESS] Chronos XP updated to ${newChronosXP}`);

  return {
    xp: newChronosXP,
    lastUpdated: todayStr,
    tauntMessage: getChronosTaunt(userWins)
  };
}

export function getChronosTaunt(userWins: boolean): string {
  const winningTaunts = [
    "You may lead today, but time catches everyone.",
    "Interesting. You survived another day.",
    "Enjoy your lead. It won't last.",
    "Time is patient. Are you?"
  ];
  
  const losingTaunts = [
    "You are falling behind.",
    "Deadlines wait for no one.",
    "Tick tock. Time is running out.",
    "I'm pulling ahead. Can you keep up?"
  ];
  
  const taunts = userWins ? winningTaunts : losingTaunts;
  return taunts[Math.floor(Math.random() * taunts.length)];
}

export function generateDailyInsight(
  tasks: Task[],
  streak: number,
  userXP: number,
  chronosXP: number,
  genHash: string
): { text: string; type: string; tag: string; generatedAt: string } | null {
  const pendingTasks = tasks.filter(t => t.status !== 'Completed');
  
  let parts = [];

  // Next Step / Encouragement
  if (pendingTasks.length > 0) {
    parts.push(`You have active tasks waiting. Ignite your momentum by clicking the thunderbolt to immerse yourself in deep focus.`);
  } else {
    parts.push(`Take a moment to jot down your goals and let's get to work. When you're ready, ignite the thunderbolt to begin your deep focus journey.`);
  }

  // Motivational Thought
  const quotes = [
    "Small steps every day lead to massive results.",
    "The secret of getting ahead is getting started.",
    "Don't stop when you're tired. Stop when you're done.",
    "Action is the foundational key to all success.",
    "Focus on progress, not perfection.",
    "Discipline is choosing between what you want now and what you want most.",
    "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.",
    "You don't have to be great to start, but you have to start to be great.",
    "It does not matter how slowly you go as long as you do not stop.",
    "Success is the sum of small efforts, repeated day-in and day-out.",
    "The only bad workout is the one that didn't happen. Same applies to work.",
    "Do what you have to do until you can do what you want to do.",
    "Doubt kills more dreams than failure ever will.",
    "A year from now you may wish you had started today.",
    "The future depends on what you do today.",
    "Don't watch the clock; do what it does. Keep going.",
    "Someday is not a day of the week.",
    "If you spend too much time thinking about a thing, you'll never get it done.",
    "Great acts are made up of small deeds.",
    "The way to get started is to quit talking and begin doing."
  ];
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
  const thought = quotes[dayOfYear % quotes.length];
  parts.push(`Thought for the day: ${thought}`);

  return {
    type: 'Recommendation',
    tag: 'Daily Briefing',
    text: parts.join(' '),
    generatedAt: genHash
  };
}