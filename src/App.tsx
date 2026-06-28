/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { DashboardLayer } from './components/dashboard/DashboardLayer';
import { AuthLayer } from './components/auth/AuthLayer';
import { UserProfile } from './types';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './lib/firebase';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);

  useEffect(() => {
    let profileUnsub: () => void;
    const authUnsub = onAuthStateChanged(auth, async (currentUser) => {
      setIsProcessingAuth(true);
      if (profileUnsub) profileUnsub();
      
      if (currentUser) {
        console.log('[Auth] User log in observed. UID:', currentUser.uid);
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          // Instead of getDoc, we listen in real-time
          profileUnsub = onSnapshot(docRef, async (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data() as UserProfile;
              console.log('[Auth] Profile loaded successfully.');
              
              if (!data.username) {
                 import('./lib/utils').then(async ({ generateUniqueUsername }) => {
                   const newUsername = await generateUniqueUsername(data.displayName || currentUser.email?.split('@')[0] || 'guardian');
                   await setDoc(docRef, { username: newUsername }, { merge: true });
                 });
              }

              if (data.onboardingCompleted) {
                setProfile(data);
              } else {
                setProfile(null);
              }
            } else {
              console.log('[Auth] Profile not found, creating new profile...');
              import('./lib/utils').then(async ({ generateUniqueUsername }) => {
                const generatedUsername = await generateUniqueUsername(currentUser.displayName || currentUser.email?.split('@')[0] || 'guardian');
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                
                const newProfile = {
                  uid: currentUser.uid,
                  name: currentUser.displayName || '',
                  displayName: currentUser.displayName || '',
                  username: generatedUsername,
                  email: currentUser.email || '',
                  photoURL: currentUser.photoURL || '',
                  createdAt: new Date().toISOString(),
                  onboardingCompleted: false,
                  level: 1,
                  xp: 0,
                  streak: 0,
                  chronos: {
                    xp: 150,
                    lastUpdated: todayStr
                  }
                };
                await setDoc(docRef, newProfile, { merge: true });
              });
              setProfile(null);
            }
          });
        } catch (err) {
          console.error('[Firestore] Error handling user profile:', err);
        }
        setUser(currentUser);
      } else {
        setUser(null);
        setProfile(null);
      }
      setIsLoading(false);
      setIsProcessingAuth(false);
    });
    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
    }
  }, []);

  useEffect(() => {
    if (profile?.theme) {
      document.documentElement.className = profile.theme.toLowerCase();
    }
  }, [profile?.theme]);

  if (isLoading || isProcessingAuth) {
    return <div className="min-h-screen bg-canvas flex flex-col items-center justify-center text-foreground"><div className="w-8 h-8 border-4 border-primary border-t-transparent flex items-center justify-center rounded-full animate-spin mb-4" /><p className="text-muted-foreground animate-pulse">Authenticating...</p></div>;
  }

  if (!user) {
    return <AuthLayer />;
  }

  if (!profile) {
    return <OnboardingFlow onComplete={async (p) => {
      console.log('[App] Onboarding complete. Saving profile...');
      setIsProcessingAuth(true);
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        let existingUsername = docSnap.exists() ? docSnap.data()?.username : null;
        if (!existingUsername) {
          const { generateUniqueUsername } = await import('./lib/utils');
          existingUsername = await generateUniqueUsername(user.displayName || user.email?.split('@')[0] || 'guardian');
        }

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        const fullProfile = {
          ...p,
          uid: user.uid,
          onboardingCompleted: true,
          displayName: user.displayName || '',
          username: existingUsername,
          email: user.email || '',
          photoURL: user.photoURL || '',
          level: 1,
          xp: 0,
          streak: 0,
          chronos: {
            xp: 150,
            lastUpdated: todayStr
          }
        };
        await setDoc(docRef, fullProfile, { merge: true });
        console.log('[Firestore] User profile saved successfully.');
        setProfile(fullProfile as UserProfile);
      } catch(err) {
        console.error('[Firestore] Error saving user profile:', err);
      }
      setIsProcessingAuth(false);
    }} />;
  }

  console.log('[App] Dashboard rendered.');
  return <DashboardLayer profile={profile} user={user} />;
}
