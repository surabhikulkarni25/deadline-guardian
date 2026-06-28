import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, AIPersonality } from '@/src/types';
import { getGuardianName, getAlertMessage } from '@/src/lib/guardianUtils';
import { Bot, Clock, AlertTriangle, Play, BellOff, X } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';

interface GuardianAlertModalProps {
  isOpen: boolean;
  task: Task | null;
  riskScore: number;
  personality: AIPersonality;
  onStart: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
}

export function GuardianAlertModal({
  isOpen,
  task,
  riskScore,
  personality,
  onStart,
  onSnooze,
  onDismiss
}: GuardianAlertModalProps) {
  if (!isOpen || !task) return null;

  const reminderCount = task.reminderCount || 0;
  const canSnooze = reminderCount < 3;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Dark backdrop forcing attention */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white/10 dark:bg-[#151B2E]/80 border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-xl"
        >
          {/* Top accent line based on risk */}
          <div className={`h-1.5 w-full ${riskScore >= 90 ? 'bg-red-500' : 'bg-orange-500'}`} />

          <div className="p-6 md:p-8 flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-xl text-white">Guardian Alert</h2>
                <p className="text-sm text-red-200">Critical Task Attention Required</p>
              </div>
            </div>

            <div className="bg-black/20 dark:bg-black/40 rounded-2xl p-4 border border-white/5">
              <h3 className="font-semibold text-lg text-white mb-2">{task.title}</h3>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">Risk Level</span>
                  <span className={`font-bold ${riskScore >= 90 ? 'text-red-400' : 'text-orange-400'}`}>{Math.round(riskScore)}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">Time Remaining</span>
                  <span className="font-medium text-white">
                    {new Date(task.deadline).getTime() < Date.now() ? 'Overdue' : new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 items-start bg-indigo-900/30 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-500/20">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-1">{getGuardianName(personality)}</p>
                <p className="text-sm text-indigo-100">{getAlertMessage(personality)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <Button onClick={onStart} size="lg" className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white border-0">
                <Play className="w-4 h-4" /> Start Task Now
              </Button>
              
              <div className="flex gap-3">
                <Button 
                  onClick={onSnooze} 
                  disabled={!canSnooze}
                  variant="outline" 
                  className="flex-1 gap-2 bg-white/5 border-white/10 hover:bg-white/10 text-white"
                >
                  <Clock className="w-4 h-4" /> Snooze 15m {!canSnooze && '(Max)'}
                </Button>
                <Button 
                  onClick={onDismiss} 
                  variant="outline" 
                  className="flex-1 gap-2 bg-red-500/10 border-red-500/20 hover:bg-red-500/20 text-red-400"
                >
                  <X className="w-4 h-4" /> Dismiss (-XP)
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
