import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, UserProfile } from '@/src/types';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Play, Pause, Square, Target, Clock, Zap } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import * as confettiModule from 'canvas-confetti';

const confetti = (confettiModule as any).default || confettiModule;

interface FocusModePanelProps {
  tasks: Task[];
  profile: UserProfile;
  uid: string;
  onClose: () => void;
  initialConfig?: {taskId: string, duration: number};
}

export function FocusModePanel({ tasks, profile, uid, onClose, initialConfig }: FocusModePanelProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [durationPhase, setDurationPhase] = useState<boolean>(false);
  
  const [customHours, setCustomHours] = useState('');
  const [customMinutes, setCustomMinutes] = useState('');
  
  const [sessionActive, setSessionActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);

  // Exact state variables requested
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedFocusTask, setCompletedFocusTask] = useState<Task | null>(null);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [showTooShortModal, setShowTooShortModal] = useState(false);

  const lastProcessedConfigRef = useRef<{taskId: string, duration: number} | null>(null);

  useEffect(() => {
    console.log("FocusModePanel initialConfig changed:", initialConfig, "tasks count:", tasks.length);
    if (initialConfig && tasks.length > 0 && initialConfig !== lastProcessedConfigRef.current) {
      const task = tasks.find(t => t.id === initialConfig.taskId);
      console.log("Matched task for initialConfig:", task);
      if (task) {
        setSelectedTask(task);
        const durationSeconds = initialConfig.duration * 60;
        setTotalTime(durationSeconds);
        setTimeLeft(durationSeconds);
        setSessionActive(true);
        setIsPaused(false);
        setDurationPhase(true); // so it shows active screen
        lastProcessedConfigRef.current = initialConfig;
      }
    }
  }, [initialConfig, tasks]);

  const pendingTasks = tasks.filter(t => t.status !== 'Completed');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (sessionActive && !isPaused) {
      if (timeLeft > 0) {
        interval = setInterval(() => {
          setTimeLeft(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else if (timeLeft <= 0) {
        // STEP 3 - TIMER COMPLETION TRIGGER
        console.log("[FOCUS_COMPLETE_TRIGGER]");
        console.log("[FOCUS_TASK]", selectedTask);
        
        setSessionActive(false); // stopTimer()
        setCompletedFocusTask(selectedTask);
        setShowCompletionModal(true);
      }
    }
    return () => clearInterval(interval);
  }, [sessionActive, isPaused, timeLeft, selectedTask]);

  const startSession = (minutes: number) => {
    if (minutes < 15) {
      setShowTooShortModal(true);
      return;
    }
    const seconds = minutes * 60;
    setTotalTime(seconds);
    setTimeLeft(seconds);
    setSessionActive(true);
    setIsPaused(false);
  };

  const handleCustomStart = () => {
    const h = parseInt(customHours) || 0;
    const m = parseInt(customMinutes) || 0;
    const totalMins = h * 60 + m;
    if (totalMins < 15) {
      setShowTooShortModal(true);
      return;
    }
    if (totalMins > 0 && totalMins <= 360) {
      startSession(totalMins);
    }
  };

  const handleAbortSession = async () => {
    if (selectedTask && uid) {
      const taskRef = doc(db, 'users', uid, 'tasks', selectedTask.id);
      await updateDoc(taskRef, {
        focusFailures: increment(1)
      });
    }
    setSessionActive(false);
    setSelectedTask(null);
  };

  // STEP 5 - DONE BUTTON LOGIC
  const handleDone = async () => {
    console.log("[MODAL_DONE_CLICK]");
    console.log("[TASK_MARK_COMPLETE]");
    
    if (completedFocusTask && uid) {
      const now = new Date().toISOString();
      const taskRef = doc(db, 'users', uid, 'tasks', completedFocusTask.id);
      await updateDoc(taskRef, {
        status: 'Completed',
        completedAt: now
      });

      // Bonus XP calculation based on total time originally set
      const minutes = totalTime / 60;
      let bonusXp = 0;
      if (minutes >= 60) bonusXp = 20;
      else if (minutes >= 45) bonusXp = 15;
      else if (minutes >= 30) bonusXp = 10;
      else bonusXp = Math.round((minutes / 30) * 10);
      
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        xp: increment(bonusXp > 0 ? bonusXp : 10), // Give at least 10 XP
        completedTasksCount: increment(1)
      });
      
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#a855f7', '#6366f1', '#3b82f6', '#ec4899']
      });
    }

    setShowCompletionModal(false);
    setCompletedFocusTask(null);
    setSelectedTask(null);
    setDurationPhase(false);
  };

  // STEP 6 - NEED MORE TIME BUTTON
  const handleNeedMoreTime = () => {
    console.log("[MODAL_MORE_TIME_CLICK]");
    setShowCompletionModal(false);
    setShowExtensionModal(true);
  };

  const handleExtendSession = (minutes: number) => {
    console.log("[FOCUS_EXTENDED]");
    setShowExtensionModal(false);
    startSession(minutes);
  };

  // STEP 7 - STOP FOR NOW BUTTON
  const handleStopForNow = () => {
    console.log("[MODAL_CANCEL_CLICK]");
    if (completedFocusTask) {
      let urgency: 'CRITICAL' | 'MODERATE' | 'FLEXIBLE' = 'FLEXIBLE';
      const deadline = new Date(completedFocusTask.deadline);
      const now = new Date();
      const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

      const isOverdue = hoursRemaining < 0;
      const isDueToday = new Date(deadline).toDateString() === now.toDateString();
      const isHighPriority = completedFocusTask.priorityLevel === 'Urgent' || completedFocusTask.priorityLevel === 'Critical';

      if (isOverdue || isDueToday || (isHighPriority && hoursRemaining < 24)) {
        urgency = 'CRITICAL';
      } else if (hoursRemaining < 48) {
        urgency = 'MODERATE';
      }

      console.log("[TASK_URGENCY]", urgency);
    }
    
    setShowCompletionModal(false);
    setCompletedFocusTask(null);
    setSelectedTask(null);
    setDurationPhase(false);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;
  const isDark = profile.theme === 'Dark';

  return (
    <div className={cn(
      "h-full flex flex-col font-sans",
      isDark ? "bg-black/90 text-slate-200" : "bg-indigo-50/50 text-slate-900"
    )}>
      <div className="flex items-center justify-between p-6 border-b border-card-border">
        <div className="flex items-center gap-3">
          <Target className={cn("w-6 h-6", isDark ? "text-purple-400" : "text-indigo-600")} />
          <div>
            <h2 className="text-lg font-bold tracking-tight">Focus Mode</h2>
            <p className="text-xs text-muted-foreground">One session at a time. Beat distraction.</p>
          </div>
        </div>
        {!sessionActive && (
          <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            Close
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col relative">
        {showCompletionModal && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 bg-background/95 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onAnimationComplete={() => console.log("[MODAL_RENDER]")}
              className={cn("max-w-md w-full p-8 rounded-2xl border shadow-2xl text-center", isDark ? "bg-card border-white/10" : "bg-white border-indigo-100")}
            >
              <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6", isDark ? "bg-purple-500/20" : "bg-indigo-100")}>
                <Zap className={cn("w-8 h-8", isDark ? "text-purple-400" : "text-indigo-600")} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Focus Session Complete ⚡</h2>
              <p className="text-muted-foreground mb-8">Did you complete this task?</p>
              
              <div className="space-y-3">
                <Button size="lg" className="w-full" onClick={handleDone}>
                  Done
                </Button>
                <Button size="lg" variant="outline" className="w-full" onClick={handleNeedMoreTime}>
                  Need More Time
                </Button>
                <Button size="lg" variant="ghost" className="w-full text-muted-foreground hover:text-foreground" onClick={handleStopForNow}>
                  Stop For Now
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {showExtensionModal && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 bg-background/95 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn("max-w-md w-full p-8 rounded-2xl border shadow-2xl text-center", isDark ? "bg-card border-white/10" : "bg-white border-indigo-100")}
            >
              <h2 className="text-2xl font-bold mb-2">Need More Time?</h2>
              <p className="text-muted-foreground mb-8">Add a few more minutes to keep the momentum going.</p>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[15, 30, 45, 60].map(mins => (
                  <Button key={mins} variant="outline" onClick={() => handleExtendSession(mins)}>
                    {mins} min
                  </Button>
                ))}
              </div>
              <Button size="lg" variant="ghost" className="w-full text-muted-foreground" onClick={() => setShowExtensionModal(false)}>
                Cancel
              </Button>
            </motion.div>
          </div>
        )}

        {showTooShortModal && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 bg-background/95 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn("max-w-md w-full p-8 rounded-2xl border shadow-2xl text-center", isDark ? "bg-card border-amber-500/20" : "bg-white border-amber-200")}
            >
              <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6", isDark ? "bg-amber-500/20" : "bg-amber-100")}>
                <Zap className={cn("w-8 h-8", isDark ? "text-amber-400" : "text-amber-600")} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Focus Too Short ⚡</h2>
              <p className="text-muted-foreground mb-8">
                15 minutes is the minimum focus duration.
                Push yourself a little more — your future self will thank you.
              </p>
              
              <div className="space-y-3">
                <Button size="lg" className="w-full bg-amber-500 hover:bg-amber-600 text-white" onClick={() => setShowTooShortModal(false)}>
                  Adjust Duration
                </Button>
                <Button size="lg" variant="ghost" className="w-full text-muted-foreground" onClick={() => {
                  setShowTooShortModal(false);
                  setDurationPhase(false);
                  setSelectedTask(null);
                }}>
                  Cancel
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {!selectedTask ? (
          <div className="max-w-md mx-auto w-full mt-8">
            <h3 className="font-semibold text-lg mb-4">Select a task to focus on</h3>
            {pendingTasks.length === 0 ? (
              <div className="text-center p-8 bg-card border border-card-border rounded-xl">
                <p className="text-muted-foreground">No active tasks. Add one to begin focus mode.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingTasks.map(task => (
                  <button
                    key={task.id}
                    onClick={() => { setSelectedTask(task); setDurationPhase(true); }}
                    className="w-full text-left p-4 bg-card border border-card-border rounded-xl hover:border-primary hover:bg-canvas transition-colors flex flex-col gap-1"
                  >
                    <span className="font-medium text-foreground">{task.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {task.type} {task.priorityLevel ? `• ${task.priorityLevel.includes('Priority') ? task.priorityLevel : `${task.priorityLevel} Priority`}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : durationPhase && !sessionActive ? (
          <div className="max-w-md mx-auto w-full mt-8">
            <Button variant="ghost" size="sm" onClick={() => setSelectedTask(null)} className="mb-4 text-muted-foreground">
              ← Back to tasks
            </Button>
            <h3 className="font-semibold text-lg mb-2">How long will you focus?</h3>
            <p className="text-sm text-muted-foreground mb-6">Focusing on: <span className="font-medium text-foreground">{selectedTask.title}</span></p>
            
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[30, 45, 60].map(mins => (
                <button
                  key={mins}
                  onClick={() => startSession(mins)}
                  className="p-4 bg-card border border-card-border rounded-xl hover:border-primary hover:bg-primary/10 transition-colors flex flex-col items-center gap-2"
                >
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="font-medium">{mins} min</span>
                </button>
              ))}
            </div>

            <div className="p-5 bg-card border border-card-border rounded-xl">
              <h4 className="text-sm font-medium mb-3">Custom Duration</h4>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Hours</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="6"
                    value={customHours}
                    onChange={(e) => setCustomHours(e.target.value)}
                    className="w-full bg-canvas border border-card-border rounded-lg p-2 text-center"
                    placeholder="0"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Minutes</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="59"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    className="w-full bg-canvas border border-card-border rounded-lg p-2 text-center"
                    placeholder="0"
                  />
                </div>
              </div>
              <Button className="w-full" onClick={handleCustomStart} disabled={(!customHours && !customMinutes) || parseInt(customHours || '0') > 6}>
                Start Focus
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
            <div className="mb-8 text-center">
              <span className="text-sm uppercase tracking-wider font-semibold text-primary mb-2 block">Current Focus</span>
              <h2 className="text-2xl font-bold text-foreground">{selectedTask.title}</h2>
            </div>

            <div className="relative w-64 h-64 mb-12 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  className="stroke-card-border fill-none"
                  strokeWidth="8"
                />
                <motion.circle
                  cx="128"
                  cy="128"
                  r="120"
                  className={cn("fill-none", isDark ? "stroke-purple-500" : "stroke-indigo-600")}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 120}
                  strokeDashoffset={2 * Math.PI * 120 * (1 - progress / 100)}
                  animate={{ strokeDashoffset: 2 * Math.PI * 120 * (1 - progress / 100) }}
                  transition={{ duration: 1, ease: 'linear' }}
                />
              </svg>
              
              <div className="text-center z-10">
                <motion.div 
                  className={cn("text-5xl font-mono font-bold tracking-tight mb-2", isDark ? "text-slate-100" : "text-indigo-950")}
                  animate={{ scale: isPaused ? 1 : [1, 1.02, 1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  {formatTime(timeLeft)}
                </motion.div>
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                  {isPaused ? 'Paused' : 'Focusing'}
                </div>
              </div>
              
              {!isPaused && (
                <motion.div 
                  className={cn("absolute inset-0 rounded-full blur-3xl opacity-20 -z-10", isDark ? "bg-purple-500" : "bg-indigo-500")}
                  animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.3, 0.1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </div>

            <div className="flex items-center gap-4">
              {isPaused ? (
                <Button size="lg" onClick={() => setIsPaused(false)} className="rounded-full w-16 h-16 p-0 flex items-center justify-center">
                  <Play className="w-6 h-6 ml-1" />
                </Button>
              ) : (
                <Button size="lg" variant="outline" onClick={() => setIsPaused(true)} className="rounded-full w-16 h-16 p-0 flex items-center justify-center border-2 border-primary text-primary hover:bg-primary/10">
                  <Pause className="w-6 h-6" />
                </Button>
              )}
              
              <Button size="lg" variant="ghost" onClick={handleAbortSession} className="rounded-full w-16 h-16 p-0 flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
                <Square className="w-6 h-6" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
