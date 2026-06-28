import { useState, useEffect } from 'react';
import { Card } from '@/src/components/ui/Card';
import { motion } from 'motion/react';
import { AlertTriangle, Clock, Flame, ShieldAlert, Zap, Timer } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { GamificationState, RiskState, UserProfile } from '@/src/types';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { getLevelProgress, getGuardianRankTitle } from '@/src/lib/taskUtils';

export function XPProgressBar({ state }: { state: GamificationState }) {
  const { progressPercent, currentLevel, nextLevelXP } = getLevelProgress(state.xp);
  
  // Use currentLevel instead of state.level for rendering, to ensure it's always in sync with XP
  const displayLevel = currentLevel || 1;

  return (
    <Card className="p-4 bg-card border-card-border">
      <div className="flex justify-between items-end mb-2">
        <div>
          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Level {displayLevel} • {getGuardianRankTitle(displayLevel)}</p>
          <p className="text-sm font-medium text-foreground">{Math.floor(state.xp)} / {nextLevelXP} XP</p>
        </div>
        <Zap className="w-5 h-5 text-yellow-400" />
      </div>
      <div className="h-2 w-full bg-canvas rounded-full overflow-hidden">
        <motion.div 
          className="h-full bg-gradient-to-r from-yellow-500 to-amber-400"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
        />
      </div>
    </Card>
  );
}

export function StreakCard({ state }: { state: GamificationState }) {
  return (
    <Card className="p-4 flex items-center justify-between bg-card border-card-border">
      <div>
        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Current Streak</p>
        <p className="text-2xl font-bold text-foreground">{state.streak} Days</p>
      </div>
      <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
        <Flame className="w-6 h-6" />
      </div>
    </Card>
  );
}

export function LeaderboardPreview({ profile }: { profile: UserProfile }) {
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users', profile.uid!, 'friends'), async (snap) => {
      const friendIds = snap.docs.map(d => d.id);
      
      const chronosXP = profile.chronos?.xp || 180;
      const chronosUser = { uid: 'chronos', displayName: 'Chronos (Rival)', title: 'The Time Keeper', xp: chronosXP, isChronos: true };
      
      if (friendIds.length === 0) {
        const users: any[] = [profile, chronosUser];
        users.sort((a, b) => (b.xp || 0) - (a.xp || 0));
        setLeaderboardData(users);
        return;
      }
      
      try {
        const uids = [profile.uid, ...friendIds.slice(0, 9)];
        const q = query(collection(db, 'users'), where('uid', 'in', uids));
        const userSnap = await getDocs(q);
        const users: any[] = userSnap.docs.map(d => d.data());
        users.push(chronosUser);
        users.sort((a, b) => (b.xp || 0) - (a.xp || 0));
        setLeaderboardData(users);
      } catch (e) {
        console.error('Failed to fetch leaderboard subset', e);
        const users: any[] = [profile, chronosUser];
        users.sort((a, b) => (b.xp || 0) - (a.xp || 0));
        setLeaderboardData(users);
      }
    });

    return () => unsub();
  }, [profile.uid, profile.xp, profile.chronos]);

  const myRank = leaderboardData.findIndex(u => u.uid === profile.uid) + 1;
  const topDisplay = leaderboardData.slice(0, Math.max(3, leaderboardData.findIndex(u => u.isChronos) + 1));
  const chronosData = leaderboardData.find(u => u.isChronos);
  const userXP = profile.xp || 0;
  const chronosXP = chronosData?.xp || 180;
  const userWins = userXP >= chronosXP;
  
  let stateMessage = "";
  let stateColor = "";
  if (userXP - chronosXP > 100) {
    stateMessage = "You are pulling ahead of Chronos.";
    stateColor = "text-green-500";
  } else if (chronosXP > userXP) {
    stateMessage = "Chronos has overtaken you. Fight back.";
    stateColor = "text-red-500";
  } else {
    stateMessage = "Chronos is right behind you.";
    stateColor = "text-amber-500";
  }

  return (
    <Card className="p-4 bg-card border-card-border h-full min-h-[140px] flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
          <Timer className="w-3 h-3" /> Guardian League
        </p>
        <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">Rank #{myRank}</span>
      </div>
      
      <div className="text-xs font-medium mb-3 pb-2 border-b border-card-border/50">
        <span className={stateColor}>{stateMessage}</span>
        {profile.chronos?.tauntMessage && (
          <p className="text-[10px] text-muted-foreground italic mt-1 font-normal opacity-80">
            "{profile.chronos.tauntMessage}"
          </p>
        )}
      </div>

      <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {topDisplay.map((u, i) => {
          let bgClass = "";
          let textClass = "text-muted-foreground";
          
          if (u.uid === profile.uid) {
            bgClass = userWins ? "bg-green-500/10" : "bg-amber-500/10";
            textClass = userWins ? "text-green-500 font-medium" : "text-amber-500 font-medium";
          } else if (u.isChronos) {
            bgClass = userWins ? "bg-red-500/5" : "bg-red-500/10";
            textClass = "text-red-400 font-medium";
          }

          return (
            <div key={u.uid} className={cn("flex items-center justify-between text-sm p-1.5 rounded", bgClass)}>
              <span className={cn("flex items-center gap-2", textClass)}>
                <span className="w-4 font-mono text-xs opacity-70">{i + 1}.</span> 
                {u.isChronos ? (
                  <span className="flex items-center gap-1">
                    <Timer className="w-3 h-3" /> {u.displayName}
                  </span>
                ) : (
                  u.displayName || u.email || 'Guardian'
                )}
              </span>
              <span className="text-foreground font-medium text-xs">{u.xp || 0} XP</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function RiskMeter({ state, isEmergencyMode = false }: { state: RiskState, isEmergencyMode?: boolean }) {
  const isCritical = state.level === 'Critical' || isEmergencyMode;
  const isDangerous = state.level === 'Dangerous';
  const isRising = state.level === 'Rising Risk';
  const isMild = state.level === 'Mild Concern';

  const colorClass = isCritical ? 'text-red-600 animate-pulse' : isDangerous ? 'text-red-500' : isRising ? 'text-orange-500' : isMild ? 'text-yellow-500' : 'text-emerald-500';
  const strokeColor = isCritical ? '#dc2626' : isDangerous ? '#ef4444' : isRising ? '#f97316' : isMild ? '#eab308' : '#10b981';

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (state.score / 100) * circumference;

  return (
    <Card className={cn("p-6 flex flex-col items-center justify-center text-center bg-card border-card-border transition-colors duration-1000", isEmergencyMode ? "border-red-500/50 bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.2)] animate-[pulse_1s_ease-in-out_infinite]" : "")}>
      <div className="relative w-32 h-32 mb-4">
        {/* Background Circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle 
            cx="64" cy="64" r="40" 
            stroke="currentColor" strokeWidth="8" fill="transparent" 
            className="text-slate-200 dark:text-gray-800"
          />
          {/* Progress Circle */}
          <motion.circle 
            cx="64" cy="64" r="40" 
            stroke={strokeColor} strokeWidth="8" fill="transparent" 
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ strokeDasharray: circumference }}
            className={isCritical ? 'animate-[pulse_1s_ease-in-out_infinite] origin-center' : ''}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-2xl font-bold", colorClass)}>{state.score}%</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Risk</span>
        </div>
      </div>
      <div className="space-y-1">
        <h4 className={cn("font-medium inline-flex items-center gap-1 justify-center", colorClass)}>
          <ShieldAlert className="w-4 h-4" />
          {isEmergencyMode ? 'EMERGENCY' : state.level}
        </h4>
        <p className="text-xs text-muted-foreground">
          {isEmergencyMode ? 'Chronos has surpassed you. Complete tasks immediately!' : state.reason}
        </p>
      </div>
    </Card>
  );
}
