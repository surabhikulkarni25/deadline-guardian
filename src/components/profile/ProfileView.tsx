import { useState, useEffect } from 'react';
import { UserProfile, UserBadge, Task } from '@/src/types';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { UserIcon, Users, Trophy, Activity, CheckCircle, XCircle, Award, Calendar, AlertCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { format } from 'date-fns';
import { getLevelFromXP, getGuardianRankTitle } from '@/src/lib/taskUtils';

const ALL_BADGES: UserBadge[] = [
  { name: 'Deadline Demon', description: 'Conquered an assignment', icon: '😈', rarity: 'Epic', category: 'Task', unlockedAt: '' },
  { name: 'Locked In', description: 'Completed a study session', icon: '🧠', rarity: 'Rare', category: 'Task', unlockedAt: '' },
  { name: 'Main Character Energy', description: 'Crushed a meeting', icon: '🗣️', rarity: 'Common', category: 'Task', unlockedAt: '' },
  { name: 'Gym Rat Arc', description: 'Taking care of the vessel', icon: '💪', rarity: 'Rare', category: 'Task', unlockedAt: '' },
  { name: 'Money Brain', description: 'Handled financial business', icon: '📈', rarity: 'Rare', category: 'Task', unlockedAt: '' },
  { name: 'Glow-Up Arc', description: 'Working on yourself', icon: '✨', rarity: 'Common', category: 'Task', unlockedAt: '' },
  { name: 'Built Different', description: 'Completed a custom task', icon: '🔥', rarity: 'Common', category: 'Task', unlockedAt: '' },
  { name: 'Starter Pack', description: 'Completed 5 tasks', icon: '🎒', rarity: 'Common', category: 'Milestone', unlockedAt: '' },
  { name: 'On Fire Fr', description: 'Completed 25 tasks', icon: '🔥', rarity: 'Rare', category: 'Milestone', unlockedAt: '' },
  { name: 'No Excuses Era', description: 'Completed 50 tasks', icon: '🛡️', rarity: 'Epic', category: 'Milestone', unlockedAt: '' },
  { name: 'Productivity Royalty', description: 'Completed 100 tasks', icon: '👑', rarity: 'Legendary', category: 'Milestone', unlockedAt: '' },
  { name: 'Momentum Brewing', description: 'Maintained a 3-day streak', icon: '☕', rarity: 'Common', category: 'Streak', unlockedAt: '' },
  { name: 'Consistency Goes Brrr', description: 'Maintained a 7-day streak', icon: '🥶', rarity: 'Rare', category: 'Streak', unlockedAt: '' },
  { name: 'Actually Unstoppable', description: 'Maintained a 30-day streak', icon: '🦾', rarity: 'Legendary', category: 'Streak', unlockedAt: '' },
];

interface ProfileViewProps {
  profile: UserProfile;
  uid: string;
  tasks?: Task[];
}

export function ProfileView({ profile, uid, tasks = [] }: ProfileViewProps) {
  const [friendsProfiles, setFriendsProfiles] = useState<UserProfile[]>([]);
  const [incomingProfiles, setIncomingProfiles] = useState<UserProfile[]>([]);
  const [newFriendUsername, setNewFriendUsername] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searchSuccess, setSearchSuccess] = useState('');

  const completedTasks = tasks.filter(t => t.status === 'Completed').sort((a, b) => new Date(b.completedAt || b.deadline || 0).getTime() - new Date(a.completedAt || a.deadline || 0).getTime());
  const missedTasks = tasks.filter(t => t.status === 'Missed' || t.status === 'Incomplete').sort((a, b) => new Date(b.deadline || 0).getTime() - new Date(a.deadline || 0).getTime());
  const missedTasksCount = missedTasks.length;

  // Fetch profiles for friends and incoming requests
  useEffect(() => {
    // Listen to friend requests subcollection
    const unsubRequests = onSnapshot(collection(db, 'users', uid, 'friendRequests'), async (snap) => {
      if (snap.empty) {
        setIncomingProfiles([]);
        return;
      }
      const uids = snap.docs.map(d => d.id);
      try {
        const q = query(collection(db, 'users'), where('uid', 'in', uids.slice(0, 10)));
        const userSnap = await getDocs(q);
        setIncomingProfiles(userSnap.docs.map(d => d.data() as UserProfile));
      } catch (e) {
        console.error(e);
      }
    });

    // Listen to friends subcollection
    const unsubFriends = onSnapshot(collection(db, 'users', uid, 'friends'), async (snap) => {
      if (snap.empty) {
        setFriendsProfiles([]);
        return;
      }
      const uids = snap.docs.map(d => d.id);
      try {
        const q = query(collection(db, 'users'), where('uid', 'in', uids.slice(0, 10)));
        const userSnap = await getDocs(q);
        setFriendsProfiles(userSnap.docs.map(d => d.data() as UserProfile));
      } catch (e) {
        console.error(e);
      }
    });

    return () => {
      unsubRequests();
      unsubFriends();
    };
  }, [uid]);

  const handleSendRequest = async () => {
    if (!newFriendUsername.trim()) return;
    setSearchError('');
    setSearchSuccess('');
    
    console.log('[FriendRequest] START');
    console.log('[FriendRequest] Sender UID:', uid);
    console.log('[FriendRequest] Searching for username:', newFriendUsername.trim().toLowerCase());

    try {
      console.log('[FriendRequest] Executing users query...');
      const q = query(collection(db, 'users'), where('username', '==', newFriendUsername.trim().toLowerCase()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setSearchError('User not found.');
        return;
      }
      
      const targetUser = snap.docs[0];
      const targetData = targetUser.data() as UserProfile;
      const targetUid = targetData.uid;
      console.log('[FriendRequest] Found Target UID:', targetUid);

      if (!targetUid) {
        setSearchError('Invalid target user.');
        return;
      }

      if (targetUid === uid) {
        setSearchError('You cannot add yourself.');
        return;
      }

      // Check if already friends
      console.log(`[FriendRequest] Checking if already friends... Path: users/${uid}/friends/${targetUid}`);
      const friendDoc = await getDoc(doc(db, 'users', uid, 'friends', targetUid));
      if (friendDoc.exists()) {
        console.log('[FriendRequest] Already friends.');
        setSearchError('Already friends with this user.');
        return;
      }

      // Check if request already sent
      console.log(`[FriendRequest] Checking if request already sent... Path: users/${targetUid}/friendRequests/${uid}`);
      const outgoingDoc = await getDoc(doc(db, 'users', targetUid, 'friendRequests', uid));
      if (outgoingDoc.exists()) {
        console.log('[FriendRequest] Request already sent.');
        setSearchError('Friend request already sent.');
        return;
      }

      // Create request in target user's friendRequests subcollection
      console.log(`[FriendRequest] Creating request... Path: users/${targetUid}/friendRequests/${uid}`);
      await setDoc(doc(db, 'users', targetUid, 'friendRequests', uid), {
        uid: uid,
        createdAt: new Date().toISOString()
      });

      console.log('[FriendRequest] Request successfully created.');
      setSearchSuccess('Friend request sent!');
      setNewFriendUsername('');
    } catch (e: any) {
      console.error('[FriendRequest] FAILURE:', e);
      console.error('[FriendRequest] Error code:', e.code);
      console.error('[FriendRequest] Error message:', e.message);
      setSearchError('Error sending request: ' + e.message);
    }
  };

  const handleAcceptRequest = async (requesterUid: string) => {
    try {
      // Create friend docs
      await setDoc(doc(db, 'users', uid, 'friends', requesterUid), {
        uid: requesterUid,
        addedAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'users', requesterUid, 'friends', uid), {
        uid: uid,
        addedAt: new Date().toISOString()
      });
      
      // Delete request
      await deleteDoc(doc(db, 'users', uid, 'friendRequests', requesterUid));
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectRequest = async (requesterUid: string) => {
    try {
      await deleteDoc(doc(db, 'users', uid, 'friendRequests', requesterUid));
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveFriend = async (friendUid: string) => {
    try {
      await deleteDoc(doc(db, 'users', uid, 'friends', friendUid));
      await deleteDoc(doc(db, 'users', friendUid, 'friends', uid));
    } catch (e) {
      console.error(e);
    }
  };

  console.log("User badges:", profile.badges);
  const earnedBadges = profile.badges || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 mt-6 pb-20">
      <h2 className="text-2xl font-semibold mb-6">Profile & Social</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Identity & Progress */}
        <Card className="col-span-1 md:col-span-1 p-6 space-y-6 bg-card border-card-border">
          <div className="flex flex-col items-center text-center space-y-3">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt="Profile" className="w-24 h-24 rounded-full border-4 border-card-border" />
            ) : (
              <div className="w-24 h-24 rounded-full border-4 border-card-border bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold">
                {profile.displayName?.charAt(0)?.toUpperCase()}
              </div>
            )}
            <div>
              <h3 className="text-xl font-bold text-foreground">{profile.displayName || 'No Name'}</h3>
              <p className="text-sm text-muted-foreground mb-1">@{profile.username}</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                {getGuardianRankTitle(getLevelFromXP(profile.xp || 0) || 1)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-card-border">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Level</p>
              <p className="text-2xl font-bold text-primary">{getLevelFromXP(profile.xp || 0) || 1}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Streak</p>
              <p className="text-2xl font-bold text-amber-500">{profile.streak || 0} 🔥</p>
            </div>
            <div className="text-center col-span-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total XP</p>
              <p className="text-xl font-semibold text-foreground">{profile.xp || 0}</p>
            </div>
          </div>
        </Card>

        {/* History & Stats */}
        <Card className="col-span-1 md:col-span-2 p-6 space-y-6 bg-card border-card-border">
          <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-card-border pb-4">
            <Activity className="w-5 h-5 text-primary" /> History & Performance
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div 
              className="bg-canvas border border-card-border rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => document.getElementById('completed-tasks')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <CheckCircle className="w-6 h-6 text-green-500 mb-2" />
              <p className="text-2xl font-bold text-foreground">{profile.completedTasksCount || 0}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Completed Tasks</p>
            </div>
            <div 
              className="bg-canvas border border-card-border rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => document.getElementById('missed-tasks')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <XCircle className="w-6 h-6 text-red-500 mb-2" />
              <p className="text-2xl font-bold text-foreground">{missedTasksCount}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Missed Tasks</p>
            </div>
            <div 
              className="bg-canvas border border-card-border rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => document.getElementById('badges-earned')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Trophy className="w-6 h-6 text-indigo-500 mb-2" />
              <p className="text-2xl font-bold text-foreground">{profile.badges?.length || 0}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Badges Earned</p>
            </div>
          </div>
        </Card>

        {/* Social / Friend System */}
        <Card className="col-span-1 md:col-span-3 p-6 space-y-6 bg-card border-card-border">
          <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-card-border pb-4">
            <Users className="w-5 h-5 text-blue-500" /> Guardian League Network
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="font-medium text-foreground">Add a Friend</h4>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newFriendUsername} 
                  onChange={e => setNewFriendUsername(e.target.value)} 
                  placeholder="Friend's username"
                  className="flex-1 bg-canvas border border-card-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Button onClick={handleSendRequest}>Add</Button>
              </div>
              {searchError && <p className="text-xs text-red-500">{searchError}</p>}
              {searchSuccess && <p className="text-xs text-green-500">{searchSuccess}</p>}

              {incomingProfiles.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h4 className="font-medium text-foreground">Pending Requests</h4>
                  {incomingProfiles.map(p => (
                    <div key={p.uid} className="flex items-center justify-between p-3 border border-card-border rounded-lg bg-canvas">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                          {p.displayName?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <span className="text-sm font-medium block">{p.displayName || p.username}</span>
                          <span className="text-xs text-muted-foreground block">@{p.username}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-green-500 hover:bg-green-500/10 hover:border-green-500" onClick={() => handleAcceptRequest(p.uid!)}>Accept</Button>
                        <Button size="sm" variant="outline" className="text-red-500 hover:bg-red-500/10 hover:border-red-500" onClick={() => handleRejectRequest(p.uid!)}>Reject</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-foreground">Your Friends ({friendsProfiles.length})</h4>
              {friendsProfiles.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 bg-canvas border border-card-border rounded-lg text-center">
                  No friends added yet. Add friends to activate leaderboard.
                </p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {friendsProfiles.map(p => (
                    <div key={p.uid} className="flex items-center justify-between p-3 border border-card-border rounded-lg bg-canvas">
                      <div className="flex items-center gap-3">
                        {p.photoURL ? (
                          <img src={p.photoURL} alt="Profile" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                            {p.displayName?.charAt(0) || 'U'}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">{p.displayName || p.username || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">Lvl {p.level || 1} {getGuardianRankTitle(getLevelFromXP(p.xp || 0) || 1)}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-500/10" onClick={() => handleRemoveFriend(p.uid!)}>Remove</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Badge Collection Section */}
        <Card id="badges-earned" className="col-span-1 md:col-span-3 p-6 space-y-6 bg-card border-card-border">
          <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-card-border pb-4">
            <Award className="w-5 h-5 text-yellow-500" /> Badge Collection
          </h3>
          {earnedBadges.length === 0 ? (
            <div className="text-center p-8 bg-canvas border border-card-border rounded-xl">
              <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-foreground font-medium">No badges yet.</p>
              <p className="text-sm text-muted-foreground">Complete tasks and build streaks to earn rewards.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {earnedBadges.map((earnedBadge, idx) => {
                // Normalize legacy string badge or use object directly
                const badgeName = typeof earnedBadge === 'string' ? earnedBadge : earnedBadge?.name;
                // Try to find full badge template
                const template = ALL_BADGES.find(b => b.name === badgeName);
                
                // Construct a display badge
                const displayBadge = template ? { ...template } : { 
                  name: badgeName || 'Unknown Badge', 
                  description: typeof earnedBadge === 'string' ? 'A legacy badge' : earnedBadge?.description || '', 
                  icon: typeof earnedBadge === 'string' ? '🏆' : earnedBadge?.icon || '🏆', 
                  rarity: typeof earnedBadge === 'string' ? ('Common' as const) : earnedBadge?.rarity || 'Common', 
                  category: typeof earnedBadge === 'string' ? ('Task' as const) : earnedBadge?.category || 'Task', 
                };

                const dateString = typeof earnedBadge === 'object' && earnedBadge?.unlockedAt 
                  ? format(new Date(earnedBadge.unlockedAt), 'MMM d, yyyy') 
                  : 'Earned previously';

                let shadowColor = "rgba(100, 100, 100, 0.2)"; // fallback
                if (displayBadge.rarity === 'Common') shadowColor = "rgba(156, 163, 175, 0.2)"; // gray-400
                else if (displayBadge.rarity === 'Rare') shadowColor = "rgba(96, 165, 250, 0.3)"; // blue-400
                else if (displayBadge.rarity === 'Epic') shadowColor = "rgba(192, 132, 252, 0.4)"; // purple-400
                else if (displayBadge.rarity === 'Legendary') shadowColor = "rgba(251, 191, 36, 0.5)"; // amber-400

                return (
                  <div 
                    key={`${displayBadge.name}-${idx}`} 
                    className="relative p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all duration-300 bg-canvas/80 border-primary/30 hover:-translate-y-1 hover:shadow-lg"
                    style={{ borderColor: shadowColor }}
                  >
                    <div className="text-4xl mb-3 relative flex items-center justify-center w-16 h-16 rounded-full transition-all bg-primary/10"
                      style={{ boxShadow: `0 0 20px ${shadowColor}` }}>
                      {displayBadge.icon}
                    </div>
                    <h4 className="font-bold text-sm text-foreground flex items-center justify-center">{displayBadge.name}</h4>
                    <p className="text-xs text-muted-foreground mb-3">{displayBadge.description}</p>
                    
                    <div className="flex w-full items-center justify-between mt-auto pt-3 border-t border-card-border">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground text-left">
                        {dateString}
                      </span>
                      <span className={cn("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ml-2", {
                        'text-gray-400 bg-gray-400/10': displayBadge.rarity === 'Common',
                        'text-blue-400 bg-blue-400/10': displayBadge.rarity === 'Rare',
                        'text-purple-400 bg-purple-400/10': displayBadge.rarity === 'Epic',
                        'text-amber-400 bg-amber-400/10': displayBadge.rarity === 'Legendary',
                      })}>
                        {displayBadge.rarity}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Completed Tasks Section */}
        <Card id="completed-tasks" className="col-span-1 md:col-span-3 p-6 space-y-6 bg-card border-card-border">
          <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-card-border pb-4">
            <CheckCircle className="w-5 h-5 text-green-500" /> Completed Tasks
          </h3>
          {completedTasks.length === 0 ? (
            <div className="text-center p-8 bg-canvas border border-card-border rounded-xl">
              <CheckCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-foreground font-medium">No completed tasks yet.</p>
              <p className="text-sm text-muted-foreground">Get out there and crush some goals!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {completedTasks.map(task => (
                <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-canvas border border-card-border rounded-xl">
                  <div>
                    <h4 className="font-medium text-foreground">{task.title}</h4>
                    {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{task.type}</span>
                      {task.completedAt && !isNaN(new Date(task.completedAt).getTime()) && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(task.completedAt), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 sm:mt-0 flex items-center gap-2">
                    <span className="text-sm font-bold text-green-500 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Done
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Missed Tasks Section */}
        <Card id="missed-tasks" className="col-span-1 md:col-span-3 p-6 space-y-6 bg-card border-card-border">
          <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-card-border pb-4">
            <AlertCircle className="w-5 h-5 text-red-500" /> Missed Tasks
          </h3>
          {missedTasks.length === 0 ? (
            <div className="text-center p-8 bg-canvas border border-card-border rounded-xl">
              <AlertCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-foreground font-medium">No missed tasks.</p>
              <p className="text-sm text-muted-foreground">You are staying on top of everything!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {missedTasks.map(task => (
                <div key={task.id} className="flex flex-col p-4 bg-red-500/5 border border-red-500/20 rounded-xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <h4 className="font-medium text-red-500">{task.title}</h4>
                      {task.description && <p className="text-sm text-red-400/80 mt-1">{task.description}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{task.type}</span>
                        {task.deadline && !isNaN(new Date(task.deadline).getTime()) && (
                          <span className="text-xs text-red-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Missed on {format(new Date(task.deadline), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 bg-red-500/10 p-3 rounded-lg flex items-start gap-2 border border-red-500/20">
                    <span className="text-xl leading-none pt-0.5">💡</span>
                    <div>
                      <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-0.5">Guardian Insight</p>
                      <p className="text-sm text-muted-foreground">
                        {task.priorityLevel === 'Urgent' || task.priorityLevel === 'Critical' 
                          ? "This was a high priority. Let's break it down into smaller, 5-minute pieces to make it less intimidating next time."
                          : "It happens to the best of us! Try scheduling this during your peak energy hours tomorrow."}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}
