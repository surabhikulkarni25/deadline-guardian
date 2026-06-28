import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plus, LogOut, Settings, User as UserIcon, ChevronDown, CheckCircle, Trophy, MessageSquare, List, Bot, Target } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { TaskList } from './TaskList';
import { XPProgressBar, StreakCard, LeaderboardPreview, RiskMeter } from './GamificationWidgets';
import { DailyGuardianInsight } from './DailyGuardianInsight';
import { AIActionPlanCard } from './AIActionPlanCard';
import { FocusModePanel } from './FocusModePanel';
import { ChatInterface, Message } from '@/src/components/assistant/ChatInterface';
import { ChatHistoryPanel } from '@/src/components/assistant/ChatHistoryPanel';
import { TaskCreationModal } from '@/src/components/tasks/TaskCreationModal';
import { Task, UserProfile, GamificationState, RiskState, ChatSession } from '@/src/types';
import { calculateTaskRisk, aggregateRiskScore, calculateTaskXP, getBadgeForTaskType, getBadgeMessage, getLevelFromXP, calculateCurrentStreak, calculateChronosDailyUpdate, generateDailyInsight, getMilestoneBadges, getStreakBadge } from '@/src/lib/taskUtils';
import { User, signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import * as confettiModule from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { getGuardianName, getNotificationMessage } from '@/src/lib/guardianUtils';
import { ProfileView } from '@/src/components/profile/ProfileView';
import { SettingsView } from '@/src/components/settings/SettingsView';
import { GuardianAlertModal } from './GuardianAlertModal';
import { cn } from '@/src/lib/utils';

const confetti = (confettiModule as any).default || confettiModule;

function UserMenu({ profile, onSignOut, onNavigate }: { profile: UserProfile, onSignOut: () => void, onNavigate: (page: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:bg-canvas p-1.5 rounded-full md:rounded-lg transition-colors border border-transparent hover:border-card-border focus:outline-none"
      >
        {profile.photoURL ? (
          <img src={profile.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-card-border" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium border border-primary/30">
            {profile.displayName?.charAt(0)?.toUpperCase() || profile.email?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        )}
        <div className="hidden md:flex flex-col items-start mr-1">
          <span className="text-sm font-medium text-foreground leading-none">{profile.displayName || 'Guardian'}</span>
          <span className="text-[10px] text-muted-foreground mt-0.5">{profile.email || 'offline'}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground hidden md:block" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-card border border-card-border rounded-lg shadow-xl py-1 z-50">
          <button onClick={() => { onNavigate('profile'); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-canvas flex items-center gap-2">
            <UserIcon className="w-4 h-4" /> Profile
          </button>
          <button onClick={() => { onNavigate('settings'); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-canvas flex items-center gap-2">
            <Settings className="w-4 h-4" /> Settings
          </button>
          <div className="h-px bg-card-border my-1" />
          <button 
            onClick={onSignOut}
            className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

interface DashboardLayerProps {
  profile: UserProfile;
  user: User;
}

export function DashboardLayer({ profile, user }: DashboardLayerProps) {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'profile' | 'settings'>('dashboard');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [autoStartTaskId, setAutoStartTaskId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false);
  const [focusModeConfig, setFocusModeConfig] = useState<{taskId: string, duration: number} | undefined>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<{id: string, role: 'user'|'assistant', text: string, timestamp: number}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatInputRef = useRef(chatInput);
  
  const toggleFocusMode = () => {
    setIsFocusModeOpen(prev => {
      if (!prev) setIsDrawerOpen(false);
      setFocusModeConfig(undefined);
      return !prev;
    });
  };

  const openFocusModeWithConfig = (taskId: string, duration: number) => {
    console.log("openFocusModeWithConfig called", taskId, duration);
    setFocusModeConfig({ taskId, duration });
    setIsFocusModeOpen(true);
    setIsDrawerOpen(false);
  };

  const toggleAiChat = () => {
    setIsDrawerOpen(prev => {
      if (!prev) setIsFocusModeOpen(false);
      return !prev;
    });
  };

  useEffect(() => {
    if (messages.length === 0 && profile && user) {
      const activeTasks = tasks.filter(t => t.status === 'Pending' || t.status === 'Active');
      const criticalCount = activeTasks.filter(t => t.priorityLevel === 'Urgent' || t.priorityLevel === 'Critical').length;
      const todayCount = activeTasks.filter(t => t.deadline && (new Date(t.deadline).getTime() - Date.now()) < 24 * 60 * 60 * 1000).length;
      
      let urgencyMsg = "";
      if (criticalCount > 0) {
        urgencyMsg = `${criticalCount} critical task${criticalCount > 1 ? 's' : ''} need attention. Want the game plan?`;
      } else if (todayCount > 0) {
        urgencyMsg = `${todayCount} deadline${todayCount > 1 ? 's' : ''} staring at us today — but nothing we can't handle.`;
      } else {
        urgencyMsg = "Your schedule is looking clear. Ready when you are.";
      }

      const timeOfDay = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
      
      const displayName = profile.name || user.email?.split('@')[0] || 'there';

      setMessages([
        { 
          id: '1', 
          role: 'assistant', 
          text: `${timeOfDay}, ${displayName}. ${getGuardianName(profile.personality)} here. ${urgencyMsg}`, 
          timestamp: Date.now() 
        }
      ]);
    }
  }, [profile, user, tasks.length > 0, messages.length]); // Only depend on tasks length > 0 to avoid re-triggering greeting on every task change if messages were somehow cleared, though actually if messages.length === 0 is the guard, it's fine. Wait, better to just depend on messages.length and the initial profile.
  useEffect(() => {
    chatInputRef.current = chatInput;
  }, [chatInput]);

  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const toggleListening = async () => {
    if (isListening) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    try {
      setIsDrawerOpen(true);
      setIsFocusModeOpen(false);
      console.log('--- MICROPHONE DEBUG ---');
      console.log('isSecureContext:', window.isSecureContext);
      console.log('navigator.mediaDevices exists:', !!navigator.mediaDevices);
      console.log('navigator.mediaDevices.getUserMedia exists:', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Stream acquired:', !!stream);
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstart = () => {
        setIsListening(true);
      };

      mediaRecorder.onstop = async () => {
        setIsListening(false);
        stream.getTracks().forEach(track => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsTranscribing(true);

        try {
          // Convert blob to base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64data = reader.result?.toString().split(',')[1];
            if (!base64data) throw new Error("Failed to read audio blob");

            const response = await fetch('/api/transcribe', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                audioData: base64data,
                mimeType: 'audio/webm'
              }),
            });

            if (!response.ok) {
              throw new Error(`Transcription failed: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.text) {
              setChatInput(prev => {
                const prefix = prev.trim() ? prev.trim() + ' ' : '';
                return prefix + data.text.trim();
              });
            }
            setIsTranscribing(false);
          };
        } catch (error) {
          console.error("Transcription error:", error);
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
    } catch (err: any) {
      console.error("Microphone access denied or error:", err);
      console.log("Error name:", err.name);
      console.log("Error message:", err.message);
      setIsListening(false);
    }
  };

  const calculatedStreak = useMemo(() => calculateCurrentStreak(tasks), [tasks]);

  useEffect(() => {
    if (user && profile && calculatedStreak !== profile.streak) {
      updateDoc(doc(db, 'users', user.uid), { streak: calculatedStreak }).catch(err => {
        console.error("Failed to sync streak", err);
      });
    }
  }, [calculatedStreak, profile.streak, user, profile]);

  const lastChronosCheckDate = useRef('');

  useEffect(() => {
    if (user && profile) {
      let createdAtTimestamp: number | undefined = undefined;
      if (profile.createdAt) {
        createdAtTimestamp = typeof profile.createdAt === 'string' ? new Date(profile.createdAt).getTime() : profile.createdAt;
      }
      
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      if (profile.chronos?.lastUpdated !== todayStr && lastChronosCheckDate.current !== todayStr) {
        lastChronosCheckDate.current = todayStr;
        const chronosUpdate = calculateChronosDailyUpdate(profile.chronos, profile.xp || 0, profile.streak || 0);
        if (chronosUpdate) {
          updateDoc(doc(db, 'users', user.uid), { chronos: chronosUpdate }).catch(err => {
            console.error("Failed to sync chronos", err);
            lastChronosCheckDate.current = '';
          });
        }
      }
    }
  }, [user, profile, tasks]);

  useEffect(() => {
    if (user && profile) {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}-v4`;
      const tasksHash = tasks.length + '-' + tasks.filter(t => t.status === 'Completed').length;
      const currentGenHash = `${todayStr}-${tasksHash}`;
      
      if (!profile.dailyInsight || profile.dailyInsight.generatedAt !== currentGenHash) {
        const newInsight = generateDailyInsight(tasks, calculatedStreak, profile.xp || 0, profile.chronos?.xp || 40, currentGenHash);
        if (newInsight) {
          updateDoc(doc(db, 'users', user.uid), { dailyInsight: newInsight }).catch(err => {
            console.error("Failed to sync daily insight", err);
          });
        }
      }
    }
  }, [user, profile?.dailyInsight?.generatedAt, tasks, calculatedStreak, profile?.xp, profile?.chronos?.xp]);

  const [guardianAlertTask, setGuardianAlertTask] = useState<Task | null>(null);

  // Request browser notifications on mount if enabled in profile or not set
  useEffect(() => {
    if (profile && profile.notificationsEnabled !== false) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted' || permission === 'denied') {
              updateDoc(doc(db, 'users', user.uid), { notificationsEnabled: permission === 'granted' }).catch(err => {
                console.error("Failed to sync notification permission", err);
              });
            }
          });
        }
      }
    }
  }, [profile, user.uid]);

  useEffect(() => {
    if (!user || !profile) return;
    if (guardianAlertTask) return; // Wait until current alert is resolved

    const activeTasks = tasks.filter(t => t.status === 'Pending' || t.status === 'In Progress');
    
    const checkAndTriggerReminders = async () => {
      for (const task of activeTasks) {
        const riskScore = calculateTaskRisk(task).score;
        const now = Date.now();
        const deadlineMs = new Date(task.deadline).getTime();
        const hoursToDeadline = (deadlineMs - now) / (1000 * 60 * 60);
        const isOverdue = deadlineMs < now;
        
        const reminderCount = task.reminderCount || 0;
        const snoozeUntil = task.snoozeUntil || 0;
        const lastReminderAt = task.lastReminderAt || 0;

        if (isOverdue && !task.missPenaltyApplied) {
          const taskRef = doc(db, 'users', user.uid, 'tasks', task.id);
          await updateDoc(taskRef, { missPenaltyApplied: true });
        }

        // Respect snooze
        if (now < snoozeUntil) continue;

        // Determine if we need to show Guardian Alert
        if (riskScore >= 85 || reminderCount >= 2 || isOverdue) {
          // If hasn't triggered in last 30 minutes to prevent loops if they refresh
          if (now - lastReminderAt > 30 * 60 * 1000) {
            setGuardianAlertTask(task);
            return; // Only show one alert at a time
          }
        }

        // Determine if we need to send Browser Notification
        if (profile.notificationsEnabled && (riskScore >= 75 || (hoursToDeadline > 0 && hoursToDeadline <= 6) || isOverdue)) {
          // Cooldown of 30 mins
          if (now - lastReminderAt > 30 * 60 * 1000) {
            try {
              const taskRef = doc(db, 'users', user.uid, 'tasks', task.id);
              await updateDoc(taskRef, { 
                lastReminderAt: now,
                reminderCount: reminderCount + 1
              });

              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                const notif = new Notification("Deadline Guardian", {
                  body: getNotificationMessage(profile.personality, task.title),
                  icon: '/icon.png', // Assuming icon exists
                });
                
                notif.onclick = () => {
                  window.focus();
                  setEditingTask(task);
                };
              }
            } catch (error) {
              console.error("Failed to send notification reminder", error);
            }
          }
        }
      }
    };

    // Run periodically
    const interval = setInterval(checkAndTriggerReminders, 60 * 1000); // Check every minute
    checkAndTriggerReminders(); // Check immediately on mount/task update

    return () => clearInterval(interval);
  }, [user, profile, tasks, guardianAlertTask]);

  const handleAlertStartTask = async () => {
    if (!guardianAlertTask) return;
    
    // Auto-reward +5 XP
    const newXP = (profile.xp || 0) + 5;
    const newLevel = getLevelFromXP(newXP);
    await updateDoc(doc(db, 'users', user.uid), { xp: newXP, level: newLevel });
    // Toast notification could be triggered here or inside the UI
    alert("Quick response bonus: +5 XP");

    const taskRef = doc(db, 'users', user.uid, 'tasks', guardianAlertTask.id);
    await updateDoc(taskRef, { lastReminderAt: Date.now() });

    setAutoStartTaskId(guardianAlertTask.id);
    setGuardianAlertTask(null);
  };

  const handleAlertSnooze = async () => {
    if (!guardianAlertTask) return;
    const taskRef = doc(db, 'users', user.uid, 'tasks', guardianAlertTask.id);
    const count = (guardianAlertTask.reminderCount || 0) + 1;
    await updateDoc(taskRef, { 
      snoozeUntil: Date.now() + 15 * 60 * 1000,
      reminderCount: count,
      lastReminderAt: Date.now()
    });
    
    setGuardianAlertTask(null);
  };

  const handleAlertDismiss = async () => {
    if (!guardianAlertTask) return;
    const xpPenalty = 30; // 30 XP for ignoring Guardian Alert

    const currentXp = profile.xp || 0;
    const newXp = Math.max(0, currentXp - xpPenalty);
    
    await updateDoc(doc(db, 'users', user.uid), { 
      xp: newXp
    });

    const taskRef = doc(db, 'users', user.uid, 'tasks', guardianAlertTask.id);
    await updateDoc(taskRef, { 
      snoozeUntil: Date.now() + 30 * 60 * 1000, // Snooze for 30 mins after dismiss to prevent immediate re-trigger
      lastReminderAt: Date.now() 
    });
    
    alert(`Chronos grows stronger while you delay.`);
    setGuardianAlertTask(null);
  };

  const gamification: GamificationState = {
    xp: profile.xp || 0,
    level: getLevelFromXP(profile.xp || 0) || 1,
    streak: calculatedStreak,
    badges: profile.badges || []
  };

  const [badgePopup, setBadgePopup] = useState<{badge: string, xp: number}|null>(null);

  const [riskState, setRiskState] = useState<RiskState>({ score: 0, level: 'Stable', reason: 'No immediate deadlines.' });

  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Real-time listener for user's tasks
  useEffect(() => {
    if (!user) return;
    const tasksRef = collection(db, 'users', user.uid, 'tasks');
    const unsubscribeTasks = onSnapshot(tasksRef, (snapshot) => {
      const fetchedTasks = snapshot.docs.map(doc => doc.data() as Task);
      
      const tasksToUpdate: Task[] = [];
      const updatedTasks = fetchedTasks.map(t => {
        if (t.status === 'Completed' || t.status === 'COMPLETED') return t;
        
        let currentStatus = t.status;
        if (currentStatus === 'Missed' && t.deadline) {
           const d = new Date(t.deadline);
           d.setHours(23, 59, 59, 999);
           if (!isNaN(d.getTime()) && Date.now() <= d.getTime()) {
              currentStatus = 'Pending';
              tasksToUpdate.push({ ...t, status: 'Pending' });
           }
        }
        
        if (currentStatus !== 'Missed' && currentStatus !== 'Incomplete') {
          if (t.deadline) {
             const d = new Date(t.deadline);
             d.setHours(23, 59, 59, 999);
             if (!isNaN(d.getTime()) && Date.now() > d.getTime()) {
                currentStatus = 'Missed';
                tasksToUpdate.push({ ...t, status: 'Missed' });
             }
          }
        }

        if (currentStatus === 'Canceled' || currentStatus === 'Incomplete') {
          return { ...t, status: currentStatus as any, priorityLevel: 'Low Priority' };
        }
        
        const { priority } = calculateTaskRisk({ ...t, status: currentStatus as any });
        return { ...t, status: currentStatus as any, priorityLevel: priority };
      });

      // Fire updates for missed tasks asynchronously
      tasksToUpdate.forEach(t => {
         updateDoc(doc(db, 'users', user.uid, 'tasks', t.id), { status: t.status }).catch(console.error);
      });

      setTasks(updatedTasks);
      
      const riskScore = aggregateRiskScore(updatedTasks);
      let level: RiskState['level'] = 'Stable';
      if (riskScore >= 86) level = 'Critical';
      else if (riskScore >= 66) level = 'Dangerous';
      else if (riskScore >= 41) level = 'Rising Risk';
      else if (riskScore >= 21) level = 'Mild Concern';
      else level = 'Stable';

      setRiskState({
        score: riskScore,
        level,
        reason: riskScore >= 66 ? 'Immediate action required on critical tasks.' : 'You are on track.'
      });
    });

    const chatsRef = collection(db, 'users', user.uid, 'chats');
    console.log(`[CHAT_HISTORY_FETCH] start uid=${user.uid}`);
    const unsubscribeChats = onSnapshot(chatsRef, (snapshot) => {
      const fetchedChats = snapshot.docs.map(doc => doc.data() as ChatSession);
      const sortedChats = fetchedChats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      console.log(`[CHAT_HISTORY_FETCH] success uid=${user.uid} count=${sortedChats.length} chatIds=${sortedChats.map(c => c.chatId).join(',')}`);
      setChatSessions(sortedChats);
      
      // If we don't have an active chat and there are chats, load the most recent one
      // Use state updater callback to avoid stale closure on activeChatId
      setActiveChatId(prevId => {
        if (!prevId && sortedChats.length > 0) {
          // We can't safely call setMessages here without another stale closure issue or infinite loop,
          // so we rely on a separate useEffect to sync messages if activeChatId changes to the default one,
          // OR we can just dispatch it directly since we know what it is.
          setTimeout(() => setMessages(sortedChats[0].messages), 0);
          return sortedChats[0].chatId;
        }
        return prevId;
      });
    }, (error) => {
      console.error(`[CHAT_FETCH_FAIL] uid=${user.uid} error=${error.message}`);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeChats();
    };
  }, [user]);

  const handleSaveTask = async (taskData: Partial<Task>) => {
    const taskObj = { ...taskData, priorityLevel: 'Low Priority' } as Task;
    // If it was Incomplete but the deadline changed (rescheduled), set back to Pending
    if (taskObj.status === 'Incomplete') {
      taskObj.status = 'Pending';
    }
    const taskRef = doc(db, 'users', user.uid, 'tasks', taskObj.id);
    await setDoc(taskRef, taskObj, { merge: true });
    setEditingTask(null);
    setIsCreatingTask(false);
  };

  const handleComplete = async (task: Task) => {
    if (task.status === 'Completed') return; // Only process pending to completed
    
    // Calculate rewards
    let { totalXP } = calculateTaskXP(task, riskState.score, calculatedStreak);
    
    // Phase 2: Accountability Bonus
    if (task.endProofImage) {
      totalXP += 15;
      alert("Proof verified. Accountability bonus awarded: +15 XP");
    }
    
    // Update task
    const taskRef = doc(db, 'users', user.uid, 'tasks', task.id);
    await setDoc(taskRef, { ...task, status: 'Completed', completedAt: new Date().toISOString() }, { merge: true });
    
    const existingBadgeNames = new Set(profile.badges?.map(b => b?.name) || []);
    const newBadges: typeof profile.badges = [];
    
    // Task Type Badge
    const typeBadge = getBadgeForTaskType(task.type);
    if (!existingBadgeNames.has(typeBadge.name)) newBadges.push(typeBadge);
    
    // Milestone Badges
    const newCompletedCount = (profile.completedTasksCount || 0) + 1;
    const milestoneBadges = getMilestoneBadges(newCompletedCount);
    milestoneBadges.forEach(mb => {
      if (!existingBadgeNames.has(mb.name)) newBadges.push(mb);
    });

    // Predict the new streak
    const updatedTasks = tasks.map(t => t.id === task.id ? { ...t, status: 'Completed' as const, completedAt: new Date().toISOString() } : t);
    const newStreak = calculateCurrentStreak(updatedTasks);

    // Streak Badge
    const streakBadge = getStreakBadge(newStreak);
    if (streakBadge && !existingBadgeNames.has(streakBadge.name)) newBadges.push(streakBadge);

    const newXp = (profile.xp || 0) + totalXP;
    const newLevel = getLevelFromXP(newXp);
    
    // Fire confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    setBadgePopup({ badge: typeBadge.name, xp: totalXP });
    setTimeout(() => setBadgePopup(null), 5000);

    // Update user profile
    const userRef = doc(db, 'users', user.uid);
    const updates: any = {
      xp: increment(totalXP),
      level: newLevel,
      completedTasksCount: increment(1),
    };
    if (newBadges.length > 0) {
      updates.badges = arrayUnion(...newBadges);
    }
    await setDoc(userRef, updates, { merge: true });
  };

  const handleUpdateTask = async (task: Task) => {
    const oldTask = tasks.find(t => t.id === task.id);
    
    // Check if transitioning to Incomplete
    if (oldTask && oldTask.status !== 'Incomplete' && task.status === 'Incomplete') {
      const riskScore = calculateTaskRisk(task).score;
      let xpPenalty = 10;
      if (riskScore >= 80) xpPenalty = 30;
      else if (riskScore >= 50) xpPenalty = 20;

      const currentXp = profile.xp || 0;
      const newXp = Math.max(0, currentXp - xpPenalty);
      
      await updateDoc(doc(db, 'users', user.uid), {
        xp: newXp
      });
      alert(`Task marked as Incomplete.`);
    }

    const taskRef = doc(db, 'users', user.uid, 'tasks', task.id);
    await setDoc(taskRef, task, { merge: true });
  };

  const handleDelete = async (task: Task) => {
    const taskRef = doc(db, 'users', user.uid, 'tasks', task.id);
    await deleteDoc(taskRef);
  };

  const isSendingRef = useRef(false);

  const createNewChat = async () => {
    console.log('[CHAT_CREATE_CLICK]');
    console.log(`[ACTIVE_CHAT_BEFORE_RESET] ${activeChatId}`);
    const newChatId = Math.random().toString(36).substring(7);
    const newSession: ChatSession = {
      chatId: newChatId,
      title: 'New Chat',
      messages: [],
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const chatRef = doc(db, 'users', user.uid, 'chats', newChatId);
    console.log(`[CHAT_DOC_WRITE_START] path=users/${user.uid}/chats/${newChatId} title=New Chat messages=0`);
    try {
      await setDoc(chatRef, newSession);
      console.log(`[CHAT_DOC_WRITE_SUCCESS] uid=${user.uid} chatId=${newChatId}`);
    } catch (e: any) {
      console.error(`[CHAT_DOC_WRITE_FAIL] uid=${user.uid} chatId=${newChatId} error=${e.message}`);
    }
    setActiveChatId(newChatId);
    setMessages([]);
    console.log(`[ACTIVE_CHAT_AFTER_RESET] ${newChatId}`);
  };

  const selectChat = (chatId: string) => {
    setActiveChatId(chatId);
    const chat = chatSessions.find(c => c.chatId === chatId);
    if (chat) setMessages(chat.messages);
  };

  const toggleChatPin = (chatId: string, pinned: boolean) => {
    const chatRef = doc(db, 'users', user.uid, 'chats', chatId);
    updateDoc(chatRef, { pinned });
  };

  const renameChat = (chatId: string, newTitle: string) => {
    const chatRef = doc(db, 'users', user.uid, 'chats', chatId);
    updateDoc(chatRef, { title: newTitle });
  };

  const deleteChat = (chatId: string) => {
    const chatRef = doc(db, 'users', user.uid, 'chats', chatId);
    deleteDoc(chatRef).catch(console.error);
    if (activeChatId === chatId) {
      const remaining = chatSessions.filter(c => c.chatId !== chatId);
      if (remaining.length > 0) {
        selectChat(remaining[0].chatId);
      } else {
        createNewChat();
      }
    }
  };

  const handleSendMessage = async (msg: string) => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;

    // Ensure we have an active chat
    let currentChatId = activeChatId;
    let isNewChat = false;
    let newTitle = '';

    if (!currentChatId) {
      currentChatId = Math.random().toString(36).substring(7);
      setActiveChatId(currentChatId);
      isNewChat = true;
      newTitle = msg.trim().slice(0, 40) + (msg.length > 40 ? '...' : '');
    } else {
      // Check if it's the first user message to set the title
      const chat = chatSessions.find(c => c.chatId === currentChatId);
      if (chat && chat.title === 'New Chat') {
        newTitle = msg.trim().slice(0, 40) + (msg.length > 40 ? '...' : '');
      }
    }

    const newUserMsg: Message = { id: Math.random().toString(), role: 'user', text: msg, timestamp: Date.now() };
    const newMessages = [...messages, newUserMsg];
    setMessages(newMessages);

    // Sync to Firestore immediately
    const chatRef = doc(db, 'users', user.uid, 'chats', currentChatId);
    console.log(`[CHAT_DOC_WRITE_START] path=users/${user.uid}/chats/${currentChatId} title=${newTitle || 'New Chat'} messages=${newMessages.length}`);
    try {
      if (isNewChat) {
        await setDoc(chatRef, {
          chatId: currentChatId,
          title: newTitle || 'New Chat',
          messages: newMessages,
          pinned: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      } else {
        const updates: any = { messages: newMessages, updatedAt: Date.now() };
        if (newTitle) updates.title = newTitle;
        await setDoc(chatRef, updates, { merge: true });
      }
      console.log(`[CHAT_DOC_WRITE_SUCCESS] uid=${user.uid} chatId=${currentChatId}`);
    } catch (e: any) {
      console.error(`[CHAT_DOC_WRITE_FAIL] uid=${user.uid} chatId=${currentChatId} error=${e.message}`);
    }

    const requestBody = { 
      message: msg, 
      history: messages.map(m => ({ role: m.role, text: m.text })),
      context: {
        profile: {
          name: profile.name || profile.displayName || 'User',
          personality: profile.personality,
          level: getLevelFromXP(profile.xp || 0),
          xp: profile.xp,
          streak: profile.streak,
          badges: profile.badges?.map((b: any) => b?.name || b) || [],
          completedTasksCount: profile.completedTasksCount,
          missedTasksCount: profile.missedTasksCount
        },
        tasks: tasks.map(t => ({ title: t.title, priorityLevel: t.priorityLevel, deadline: t.deadline, type: t.type, status: t.status }))
      }
    };

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      let responseText = '';
      let taskFormPayload: { title: string } | undefined = undefined;
      let hasCalledTool = false;

      if (response.ok) {
        const data = await response.json();
        responseText = data.text;
        
        // Handle function calls to create tasks
        if (data.functionCalls && data.functionCalls.length > 0) {
          hasCalledTool = true;
          for (const call of data.functionCalls) {
            if (call.name === 'createTask') {
              const args = call.args || {};
              const newTask: Task = {
                id: Math.random().toString(36).substring(7),
                title: args.title || 'New Task',
                priorityLevel: args.priorityLevel || 'Medium Priority',
                deadline: args.deadline || '',
                type: args.type || 'Deadline',
                status: 'Pending',
                energyRequired: args.energyRequired || 'Medium',
                urgency: args.urgency || 5,
                importance: args.importance || 5,
                estDuration: args.estDuration || 60,
                createdAt: Date.now()
              };
              
              const taskRef = doc(db, 'users', user.uid, 'tasks', newTask.id);
              await setDoc(taskRef, newTask);
            } else if (call.name === 'requestTaskForm') {
              const args = call.args || {};
              taskFormPayload = { title: args.title || 'New Task' };
            }
          }
        }
      } else {
        throw new Error('Failed to fetch from /api/chat');
      }

      const newAssistantMsg: any = { id: Math.random().toString(), role: 'assistant', text: responseText, timestamp: Date.now() };
      if (taskFormPayload) newAssistantMsg.taskFormPayload = taskFormPayload;
      if (hasCalledTool) newAssistantMsg.hasCalledTool = hasCalledTool;
      const updatedMessages = [...newMessages, newAssistantMsg];
      setMessages(updatedMessages);
      
      console.log(`[CHAT_DOC_WRITE_START] path=users/${user.uid}/chats/${currentChatId} title=${newTitle || 'New Chat'} messages=${updatedMessages.length}`);
      try {
        await setDoc(chatRef, { messages: updatedMessages, updatedAt: Date.now() }, { merge: true });
        console.log(`[CHAT_DOC_WRITE_SUCCESS] uid=${user.uid} chatId=${currentChatId}`);
      } catch (e: any) {
        console.error(`[CHAT_DOC_WRITE_FAIL] uid=${user.uid} chatId=${currentChatId} error=${e.message}`);
      }

    } catch (e: any) {
      console.error(e);
      let fallbackMsg = "Guardian is overloaded right now. We'll be back online shortly.";
      const newAssistantMsg: Message = { id: Math.random().toString(), role: 'assistant', text: fallbackMsg, timestamp: Date.now() };
      const updatedMessages = [...newMessages, newAssistantMsg];
      setMessages(updatedMessages);
      
      console.log(`[CHAT_DOC_WRITE_START] path=users/${user.uid}/chats/${currentChatId} title=${newTitle || 'New Chat'} messages=${updatedMessages.length}`);
      try {
        await setDoc(chatRef, { messages: updatedMessages, updatedAt: Date.now() }, { merge: true });
        console.log(`[CHAT_DOC_WRITE_SUCCESS] uid=${user.uid} chatId=${currentChatId}`);
      } catch (saveError: any) {
        console.error(`[CHAT_DOC_WRITE_FAIL] uid=${user.uid} chatId=${currentChatId} error=${saveError.message}`);
      }
    } finally {
      isSendingRef.current = false;
    }
  };

  const [showMobileHistory, setShowMobileHistory] = useState(false);

  const isEmergencyMode = (profile.chronos?.xp || 180) > (profile.xp || 0);

  const dashboardGrid = useMemo(() => (
    <div className={cn("p-4 sm:p-6 max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 pb-32 rounded-xl transition-colors duration-1000", isEmergencyMode ? "bg-red-500/5 shadow-[inset_0_0_100px_rgba(239,68,68,0.1)]" : "")}>
      <div className="md:col-span-2 xl:col-span-3 flex flex-col gap-4 sm:gap-6 order-1">
        <DailyGuardianInsight insight={profile.dailyInsight} theme={profile.theme} onOpenFocusMode={toggleFocusMode} />
        <AIActionPlanCard tasks={tasks} profile={profile} streak={calculatedStreak} onOpenFocusMode={openFocusModeWithConfig} />
      </div>
      
      <div className="space-y-4 sm:space-y-6 flex flex-col md:col-span-1 xl:col-span-1 order-3 xl:order-2">
        <RiskMeter state={riskState} isEmergencyMode={isEmergencyMode} />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4">
          <div className="sm:col-span-2 md:col-span-1">
            <XPProgressBar state={gamification} />
          </div>
          <div>
            <StreakCard state={gamification} />
          </div>
          <div>
            <LeaderboardPreview profile={profile} />
          </div>
        </div>
      </div>

      <div className="md:col-span-1 xl:col-span-2 flex flex-col gap-4 sm:gap-6 order-2 xl:order-3">
        <TaskList 
          tasks={tasks} 
          onComplete={handleComplete} 
          onEdit={(t) => setEditingTask(t)} 
          onDelete={handleDelete} 
          onUpdate={handleUpdateTask}
          autoStartTaskId={autoStartTaskId}
          onAutoStartCleared={() => setAutoStartTaskId(null)}
        />
      </div>
    </div>
  ), [riskState, gamification, profile, tasks, isEmergencyMode, autoStartTaskId]);

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-indigo-500/30 overflow-hidden h-screen">
      <GuardianAlertModal
        isOpen={!!guardianAlertTask}
        task={guardianAlertTask}
        riskScore={guardianAlertTask ? calculateTaskRisk(guardianAlertTask).score : 0}
        personality={profile.personality}
        onStart={handleAlertStartTask}
        onSnooze={handleAlertSnooze}
        onDismiss={handleAlertDismiss}
      />
      <header className="h-16 border-b border-card-border bg-card/50 flex items-center justify-between px-6 sticky top-0 z-10 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 drop-shadow-md">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <rect width="32" height="32" rx="10" className="fill-indigo-600 dark:fill-indigo-500" />
              <path d="M16 6L25 10.5V20.5C25 24.5 16 27 16 27C16 27 7 24.5 7 20.5V10.5L16 6Z" fill="url(#dg-grad-1)" />
              <path d="M16 8.5L22 11.5V19.5C22 22.5 16 24 16 24C16 24 10 22.5 10 19.5V11.5L16 8.5Z" fill="url(#dg-grad-2)" />
              <circle cx="16" cy="16" r="2.5" className="fill-white" />
              <path d="M16 16V12.5M16 16L17.5 17.5" className="stroke-white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="dg-grad-1" x1="16" y1="6" x2="16" y2="27" gradientUnits="userSpaceOnUse">
                  <stop stopColor="white" stopOpacity="0.25" />
                  <stop offset="1" stopColor="white" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="dg-grad-2" x1="16" y1="8.5" x2="16" y2="24" gradientUnits="userSpaceOnUse">
                  <stop stopColor="white" stopOpacity="0.4" />
                  <stop offset="1" stopColor="white" stopOpacity="0.1" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="font-semibold text-lg tracking-tight hidden sm:block">Deadline Guardian</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="text-sm text-foreground font-medium hidden sm:block">{getGuardianName(profile.personality)}</span>
          <Button size="sm" variant="outline" onClick={toggleFocusMode} className="gap-2 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 h-11 w-11 p-0 sm:h-9 sm:px-3 sm:w-auto flex-shrink-0">
            <Target className="w-5 h-5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Focus Mode</span>
          </Button>
          <Button size="sm" variant="outline" onClick={toggleAiChat} className="gap-2 flex text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900 hover:bg-purple-50 dark:hover:bg-purple-900/20 h-11 w-11 p-0 sm:h-9 sm:px-3 sm:w-auto flex-shrink-0">
            <Bot className="w-5 h-5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">AI Chat</span>
          </Button>
          <Button size="sm" onClick={() => setIsCreatingTask(true)} className="gap-2 h-11 w-11 p-0 sm:h-9 sm:px-3 sm:w-auto flex-shrink-0">
            <Plus className="w-5 h-5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">New Task</span>
          </Button>
          <div className="ml-1 sm:ml-0 flex-shrink-0">
            <UserMenu profile={profile} onSignOut={() => signOut(auth)} onNavigate={setCurrentPage} />
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Scrollable Area */}
        <main className="flex-1 overflow-y-auto">
          {currentPage === 'dashboard' && dashboardGrid}

          {currentPage === 'profile' && (
            <div className="p-6 max-w-5xl mx-auto w-full pb-32">
              <Button variant="ghost" onClick={() => setCurrentPage('dashboard')} className="mb-4 text-muted-foreground hover:text-foreground">← Back to Dashboard</Button>
              <ProfileView profile={profile} uid={user.uid} tasks={tasks} />
            </div>
          )}

          {currentPage === 'settings' && (
            <div className="p-6 max-w-5xl mx-auto w-full pb-32">
              <Button variant="ghost" onClick={() => setCurrentPage('dashboard')} className="mb-4 text-muted-foreground hover:text-foreground">← Back to Dashboard</Button>
              <SettingsView profile={profile} uid={user.uid} />
            </div>
          )}
        </main>

        {/* Desktop Fixed Assistant Panel (Slide-in) */}
        <AnimatePresence initial={false}>
          {isDrawerOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 480, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="hidden lg:flex flex-col border-l border-card-border bg-card flex-shrink-0 z-20 shadow-xl shadow-black/5 overflow-hidden relative"
            >
              <div className="w-[480px] h-full flex flex-col">
                <div className="flex justify-between items-center p-3 border-b border-card-border flex-shrink-0">
                    <div className="flex items-center gap-2 px-2">
                      <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                        <Bot className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-sm text-foreground">{getGuardianName(profile.personality)}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setShowMobileHistory(!showMobileHistory)} className="p-2 text-foreground hover:text-foreground rounded-lg hover:bg-canvas transition-colors">
                        {showMobileHistory ? <MessageSquare className="w-4 h-4" /> : <List className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setIsDrawerOpen(false)} className="p-2 text-foreground hover:text-foreground rounded-lg hover:bg-canvas transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    </div>
                </div>
                <div className="flex-1 flex flex-row overflow-hidden">
                  {showMobileHistory ? (
                    <ChatHistoryPanel 
                      chats={chatSessions}
                      activeChatId={activeChatId}
                      onSelectChat={(id) => { selectChat(id); setShowMobileHistory(false); }}
                      onNewChat={() => { createNewChat(); setShowMobileHistory(false); }}
                      onTogglePin={toggleChatPin}
                      onRenameChat={renameChat}
                      onDeleteChat={deleteChat}
                    />
                  ) : (
                    <div className="flex-1 min-w-0">
                      <ChatInterface 
                        messages={messages}
                        onSendMessage={handleSendMessage}
                        chatInput={chatInput}
                        setChatInput={setChatInput}
                        isListening={isListening}
                        toggleListening={toggleListening}
                        isTranscribing={isTranscribing}
                        guardianName={getGuardianName(profile.personality)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {isFocusModeOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 480, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="hidden lg:flex flex-col border-l border-card-border bg-card flex-shrink-0 z-20 shadow-xl shadow-black/5 overflow-hidden relative"
            >
              <div className="w-[480px] h-full flex flex-col">
                <FocusModePanel tasks={tasks} profile={profile} uid={user.uid} onClose={() => setIsFocusModeOpen(false)} initialConfig={focusModeConfig} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {badgePopup && (
          <motion.div 
            style={{ x: '-50%' }}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 left-1/2 w-80 bg-card border border-primary/30 shadow-xl shadow-primary/10 rounded-xl p-4 flex gap-4 items-start z-50 backdrop-blur-sm"
          >
            <div className="w-12 h-12 flex-shrink-0 bg-primary/20 rounded-full flex items-center justify-center border border-primary/50 text-primary">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-foreground flex items-center gap-2">
                {badgePopup.badge}
                <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-500 font-medium">+{badgePopup.xp} XP</span>
              </h4>
              <p className="text-sm text-muted-foreground mt-1 leading-snug">
                {getBadgeMessage(badgePopup.badge, getGuardianName(profile.personality))}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDrawerOpen && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-canvas z-50 flex flex-col overflow-hidden lg:hidden"
          >
            <div className="flex justify-between items-center p-4 border-b border-card-border bg-canvas/90 backdrop-blur-md relative z-20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Bot className="w-5 h-5" />
                </div>
                <h2 className="font-semibold text-foreground">{getGuardianName(profile.personality)}</h2>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowMobileHistory(!showMobileHistory)} 
                  className="p-2 text-foreground hover:text-foreground rounded-full hover:bg-slate-100 dark:hover:bg-[#151B2E] transition-colors"
                  title="Chat History"
                >
                  {showMobileHistory ? <MessageSquare className="w-5 h-5" /> : <List className="w-5 h-5" />}
                </button>
                <button 
                  onClick={() => setIsDrawerOpen(false)} 
                  className="p-2 text-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-slate-100 dark:hover:bg-[#151B2E] transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden relative bg-canvas">
              {showMobileHistory ? (
                <ChatHistoryPanel 
                  chats={chatSessions}
                  activeChatId={activeChatId}
                  onSelectChat={(id) => { selectChat(id); setShowMobileHistory(false); }}
                  onNewChat={() => { createNewChat(); setShowMobileHistory(false); }}
                  onTogglePin={toggleChatPin}
                  onRenameChat={renameChat}
                  onDeleteChat={deleteChat}
                />
              ) : (
                <ChatInterface 
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  chatInput={chatInput}
                  setChatInput={setChatInput}
                  isListening={isListening}
                  toggleListening={toggleListening}
                  isTranscribing={isTranscribing}
                  guardianName={getGuardianName(profile.personality)}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFocusModeOpen && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-canvas z-50 flex flex-col overflow-hidden lg:hidden"
          >
            <FocusModePanel tasks={tasks} profile={profile} uid={user.uid} onClose={() => setIsFocusModeOpen(false)} initialConfig={focusModeConfig} />
          </motion.div>
        )}
      </AnimatePresence>

      {(isCreatingTask || editingTask) && (
        <TaskCreationModal 
          task={editingTask}
          onClose={() => { setIsCreatingTask(false); setEditingTask(null); }}
          onSave={handleSaveTask}
        />
      )}
    </div>
  );
}
