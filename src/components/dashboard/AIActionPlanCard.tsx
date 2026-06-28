import React, { useState, useEffect } from 'react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Sparkles, RefreshCw, AlertTriangle, ListTodo, Clock, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, UserProfile } from '@/src/types';
import { cn } from '@/src/lib/utils';
import { getGuardianName } from '@/src/lib/guardianUtils';

import { calculateTaskRisk } from '@/src/lib/taskUtils';

export interface AIActionPlan {
  topPriorities: string[];
  executionOrder: string[];
  focusBlocks: { taskTitle: string; focusDuration: number; breakDuration: number }[];
  riskWarning: string;
  dailyInsight: string;
  lastGenerated: number;
  tasksHash?: string;
  streak?: number;
  personality?: string;
}

interface AIActionPlanCardProps {
  tasks: Task[];
  profile: UserProfile;
  streak: number;
  onOpenFocusMode?: (taskId: string, duration: number) => void;
}

function calculateTasksHash(tasks: Task[]) {
  const activeTasks = tasks.filter(t => t.status === 'Pending' || t.status === 'In Progress');
  // Combine task IDs, their status, and their rough risk percentage (rounded to nearest 10 for "significant" changes)
  const keyString = activeTasks.map(t => `${t.id}-${t.status}-${Math.round((calculateTaskRisk(t).score) / 10) * 10}`).sort().join('|');
  
  // Simple string hash
  let hash = 0;
  for (let i = 0; i < keyString.length; i++) {
    const char = keyString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

export function AIActionPlanCard({ tasks, profile, streak, onOpenFocusMode }: AIActionPlanCardProps) {
  const [plan, setPlan] = useState<AIActionPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlan = (currentHash: string, currentStreak: number, currentPersonality: string) => {
    try {
      const cached = localStorage.getItem('deadline_guardian_ai_plan');
      if (cached) {
        const parsed = JSON.parse(cached) as AIActionPlan;
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        
        // Cache valid for 24 hours AND if tasks/streak/personality haven't significantly changed
        if (now - parsed.lastGenerated < oneDayMs && parsed.tasksHash === currentHash && parsed.streak === currentStreak && parsed.personality === currentPersonality) {
          setPlan(parsed);
          return true;
        }
      }
    } catch (e) {
      console.error("Failed to load cached plan", e);
    }
    return false;
  };

  const generatePlan = async (force = false) => {
    const currentHash = calculateTasksHash(tasks);
    if (!force && loadPlan(currentHash, streak, profile.personality)) return;
    
    // Only send actionable tasks
    const activeTasks = tasks.filter(t => t.status === 'Pending' || t.status === 'In Progress').map(t => ({
      ...t,
      riskPercentage: calculateTaskRisk(t).score
    }));
    if (activeTasks.length === 0) {
      setPlan(null);
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch('/api/action-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: activeTasks, profile, streak }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate action plan');
      }

      const data = await response.json();
      const newPlan: AIActionPlan = {
        ...data,
        topPriorities: data.topPriorities || [],
        executionOrder: data.executionOrder || [],
        focusBlocks: data.focusBlocks || [],
        lastGenerated: Date.now(),
        tasksHash: currentHash,
        streak,
        personality: profile.personality
      };
      
      setPlan(newPlan);
      localStorage.setItem('deadline_guardian_ai_plan', JSON.stringify(newPlan));
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    generatePlan();
  }, [tasks, streak, profile.personality]); // Run on mount or when tasks/streak/personality changes

  const isDark = profile.theme === 'Dark';
  
  // Calculate deterministic execution order
  const getSortedTasks = (tks: Task[]) => {
    return [...tks].filter(t => t.status !== 'Completed').sort((a, b) => {
      // 1. Cancelled tasks last
      const aIsCancelled = a.status === 'Canceled' || a.status === 'Missed' || a.status === 'Incomplete';
      const bIsCancelled = b.status === 'Canceled' || b.status === 'Missed' || b.status === 'Incomplete';
      if (aIsCancelled && !bIsCancelled) return 1;
      if (!aIsCancelled && bIsCancelled) return -1;
      
      // 2. Priority Level
      const priorityWeight: Record<string, number> = { 'Urgent': 1, 'Critical': 1, 'Important': 2, 'Low': 3, 'Low Priority': 3, 'None': 4 };
      const aWeight = priorityWeight[a.priorityLevel || ''] || 4;
      const bWeight = priorityWeight[b.priorityLevel || ''] || 4;
      
      if (aWeight !== bWeight) {
        return aWeight - bWeight;
      }
      
      // 3. Deadline
      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (a.deadline && !b.deadline) return -1;
      if (!a.deadline && b.deadline) return 1;
      
      return 0;
    });
  };

  const sortedTasks = getSortedTasks(tasks);
  const computedExecutionOrder = sortedTasks.map(t => t.title);
  const computedTopPriorities = computedExecutionOrder.slice(0, 3);
  
  if (tasks.filter(t => t.status === 'Pending' || t.status === 'In Progress').length === 0) {
    return null; // Don't show if no active tasks
  }

  return (
    <Card className={cn("p-6 overflow-hidden relative group", isDark ? "bg-[#0A0A0B] border-white/10" : "bg-white border-black/10")}>
      <div className={cn("absolute inset-0 opacity-10 bg-gradient-to-br transition-opacity duration-500", isDark ? "from-purple-500/20 via-transparent to-blue-500/20" : "from-indigo-500/20 via-transparent to-purple-500/20")} />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", isDark ? "bg-purple-500/20 text-purple-400" : "bg-indigo-100 text-indigo-600")}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className={cn("font-semibold text-lg", isDark ? "text-gray-100" : "text-gray-900")}>Action Plan</h3>
              <p className={cn("text-xs font-medium", isDark ? "text-purple-400" : "text-indigo-600")}>Generated by {getGuardianName(profile.personality)}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => generatePlan(true)} 
            disabled={isGenerating}
            className={cn("rounded-full px-3 h-8 text-xs transition-all", isDark ? "border-white/10 hover:bg-white/5" : "border-black/10 hover:bg-black/5")}
          >
            <RefreshCw className={cn("w-3 h-3 mr-2", isGenerating ? "animate-spin" : "")} />
            {isGenerating ? "Generating..." : "Regenerate"}
          </Button>
        </div>

        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.div 
              key="loading" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="py-12 flex flex-col items-center justify-center text-center space-y-4"
            >
              <div className="relative w-12 h-12">
                <div className={cn("absolute inset-0 rounded-full border-2 border-t-transparent animate-spin", isDark ? "border-purple-500" : "border-indigo-600")} />
                <div className={cn("absolute inset-2 rounded-full border-2 border-b-transparent animate-spin-reverse opacity-50", isDark ? "border-blue-400" : "border-purple-500")} />
              </div>
              <p className={cn("text-sm font-medium animate-pulse", isDark ? "text-gray-400" : "text-gray-500")}>Analyzing tasks and generating your optimal day...</p>
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 rounded-xl bg-red-500/10 text-red-500 text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </motion.div>
          ) : plan ? (
            <motion.div key="plan" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              
              {plan.riskWarning && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-500 dark:text-red-400">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium leading-tight">{plan.riskWarning}</p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                {/* Priorities & Insight */}
                <div className="space-y-6">
                  <div className={cn("p-4 rounded-xl border", isDark ? "bg-white/5 border-white/10" : "bg-black/5 border-black/5")}>
                    <h4 className={cn("text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2", isDark ? "text-gray-400" : "text-gray-500")}>
                      <Zap className="w-4 h-4" /> Top 3 Priorities
                    </h4>
                    <ul className="space-y-2">
                      {computedTopPriorities.map((task, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm font-medium">
                          <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0", isDark ? "bg-purple-500/20 text-purple-300" : "bg-indigo-100 text-indigo-700")}>{i + 1}</span>
                          <span className={isDark ? "text-gray-200" : "text-gray-800"}>{task}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className={cn("p-4 rounded-xl border relative overflow-hidden", isDark ? "bg-purple-900/10 border-purple-500/20" : "bg-indigo-50 border-indigo-100")}>
                    <div className={cn("absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl opacity-20", isDark ? "bg-purple-500" : "bg-indigo-500")} />
                    <p className={cn("text-sm font-medium relative z-10 italic leading-relaxed", isDark ? "text-purple-200" : "text-indigo-900")}>"{plan.dailyInsight}"</p>
                  </div>
                </div>

                {/* Execution Order */}
                <div className="space-y-6">
                  <div>
                    <h4 className={cn("text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2", isDark ? "text-gray-400" : "text-gray-500")}>
                      <ListTodo className="w-4 h-4" /> Suggested Order
                    </h4>
                    <div className="space-y-1.5 pl-2 border-l-2 border-dashed border-gray-500/30">
                      {computedExecutionOrder.map((task, i) => (
                        <div key={i} className="relative flex items-center gap-3 pl-4 py-1 text-sm">
                          <div className={cn("absolute -left-[5px] w-2 h-2 rounded-full", isDark ? "bg-gray-600" : "bg-gray-400")} />
                          <span className={isDark ? "text-gray-300" : "text-gray-700"}>{task}</span>
                        </div>
                      ))}
                      {(computedExecutionOrder.length === 0) && (
                        <div className="text-sm text-gray-500 italic pl-4">No active tasks right now.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </Card>
  );
}
