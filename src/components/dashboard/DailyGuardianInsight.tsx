import { UserProfile } from '@/src/types';
import { Card } from '@/src/components/ui/Card';
import { motion } from 'motion/react';
import { Sparkles, Brain, AlertTriangle, Flame, ShieldAlert, Zap } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export function DailyGuardianInsight({ insight, theme, onOpenFocusMode }: { insight: UserProfile['dailyInsight'], theme: string, onOpenFocusMode?: () => void }) {
  if (!insight) return null;

  const isDark = theme === 'Dark';

  let Icon = Sparkles;
  let darkIconColor = 'text-primary';
  let darkTagColor = 'bg-primary/10 text-primary border-primary/20';

  if (insight.type === 'Warning') {
    Icon = AlertTriangle;
    darkIconColor = 'text-red-400';
    darkTagColor = 'bg-red-500/10 text-red-400 border-red-500/20';
  } else if (insight.type === 'Streak' || insight.type === 'Momentum') {
    Icon = Flame;
    darkIconColor = 'text-amber-400';
    darkTagColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  } else if (insight.type === 'Rival') {
    Icon = ShieldAlert;
    darkIconColor = 'text-purple-400';
    darkTagColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
  } else if (insight.type === 'Recommendation') {
    Icon = Zap;
    darkIconColor = 'text-blue-400';
    darkTagColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  } else if (insight.type === 'Pattern') {
    Icon = Brain;
    darkIconColor = 'text-emerald-400';
    darkTagColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  }

  // Light theme: lavender-gold and ivory
  const lightIconColor = 'text-indigo-600';
  const lightTagColor = 'bg-indigo-50 text-indigo-700 border-indigo-100';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="mb-6"
    >
      <motion.div
        animate={{ boxShadow: isDark ? ['0 0 15px rgba(168,85,247,0.15)', '0 0 25px rgba(168,85,247,0.25)', '0 0 15px rgba(168,85,247,0.15)'] : '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)' }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="rounded-xl"
      >
        <Card 
          className={cn(
            "relative overflow-hidden border p-5 sm:p-6",
            isDark 
              ? "bg-black/40 backdrop-blur-md border-purple-500/30"
              : "bg-[#FAFAFA] border-indigo-100/50"
          )}
        >
          {isDark ? (
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
              <div className="absolute -top-[50%] -left-[10%] w-[50%] h-[150%] bg-purple-500/10 blur-[80px] rounded-full rotate-12" />
              <div className="absolute top-[20%] -right-[10%] w-[40%] h-[100%] bg-blue-500/10 blur-[80px] rounded-full -rotate-12" />
            </div>
          ) : (
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
              <div className="absolute top-0 right-0 w-[40%] h-[150%] bg-gradient-to-bl from-indigo-50/60 to-transparent blur-3xl rounded-full" />
              <div className="absolute bottom-0 left-[10%] w-[30%] h-[100%] bg-gradient-to-tr from-amber-50/60 to-transparent blur-3xl rounded-full" />
            </div>
          )}

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-start gap-4">
            <button 
              onClick={() => {
                if (insight.type === 'Recommendation' && onOpenFocusMode) {
                  onOpenFocusMode();
                }
              }}
              className={cn(
              "p-3 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-all duration-300",
              isDark ? "bg-white/5 border border-white/10 hover:bg-white/10" : "bg-white border border-indigo-50 hover:bg-indigo-50",
              insight.type === 'Recommendation' && onOpenFocusMode ? "cursor-pointer hover:scale-105" : "cursor-default"
            )}>
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Icon className={cn("w-6 h-6", isDark ? darkIconColor : lightIconColor)} />
              </motion.div>
            </button>
            
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3 className={cn("text-base font-semibold tracking-tight", isDark ? "text-purple-100" : "text-indigo-950")}>
                  Daily Guardian Insight
                </h3>
                <span className={cn("text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-medium", isDark ? darkTagColor : lightTagColor)}>
                  {insight.tag}
                </span>
              </div>
              
              <p className={cn("text-sm leading-relaxed", isDark ? "text-purple-200/80" : "text-slate-600")}>
                {insight.text}
              </p>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
