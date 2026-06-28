import { useState } from 'react';
import { UserProfile, AIPersonality, ThemePreference } from '@/src/types';
import { getGuardianName } from '@/src/lib/guardianUtils';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { doc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';

interface SettingsViewProps {
  profile: UserProfile;
  uid: string;
}

export function SettingsView({ profile, uid }: SettingsViewProps) {
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    theme: profile.theme || 'Dark',
    personality: profile.personality || 'Supportive Friend',
    displayName: profile.displayName || '',
    username: profile.username || '',
    voiceAssistantEnabled: profile.voiceAssistantEnabled ?? false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (formData.username && formData.username !== profile.username) {
        const u = formData.username.toLowerCase();
        if (u.length < 3 || u.length > 24) {
          setErrorMsg('Username must be between 3 and 24 characters.');
          setIsSaving(false);
          return;
        }
        if (!/^[a-z0-9_]+$/.test(u)) {
          setErrorMsg('Username can only contain lowercase letters, numbers, and underscores.');
          setIsSaving(false);
          return;
        }
        const q = query(collection(db, 'users'), where('username', '==', u));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setErrorMsg('Username is already taken.');
          setIsSaving(false);
          return;
        }
        formData.username = u; // ensure it's lowercase
      }

      const docRef = doc(db, 'users', uid);
      await setDoc(docRef, formData, { merge: true });
      if (formData.theme) {
        document.documentElement.className = formData.theme.toLowerCase();
      }
      setSuccessMsg('Settings saved successfully.');
    } catch (e) {
      console.error('Failed to save settings', e);
      setErrorMsg('Failed to save settings.');
    }
    setIsSaving(false);
  };

  return (
    <Card className="max-w-2xl mx-auto p-8 space-y-8 bg-card border-card-border mt-8">
      <div>
        <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
          Settings
        </h2>
        
        {errorMsg && <div className="mb-4 p-3 bg-red-500/10 text-red-500 rounded-lg text-sm">{errorMsg}</div>}
        {successMsg && <div className="mb-4 p-3 bg-green-500/10 text-green-500 rounded-lg text-sm">{successMsg}</div>}

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Display Name</label>
              <input 
                type="text" 
                value={formData.displayName || ''} 
                onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                className="w-full bg-canvas border border-card-border rounded-lg px-4 py-2.5 text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground select-none">@</span>
                <input 
                  type="text" 
                  value={formData.username || ''} 
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  className="w-full bg-canvas border border-card-border rounded-lg pl-8 pr-4 py-2.5 text-foreground focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">AI Personality</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['Supportive Friend', 'Strict Coach', 'Calm Mentor', 'Competitive Rival'] as AIPersonality[]).map(p => (
                <button
                  key={p}
                  onClick={() => setFormData({ ...formData, personality: p })}
                  className={`px-4 py-3 rounded-lg border text-left flex flex-col gap-1 transition-colors ${formData.personality === p ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500' : 'border-card-border hover:border-indigo-500/50'}`}
                >
                  <span className="font-medium">{getGuardianName(p)}</span>
                  <span className="text-xs opacity-70 text-muted-foreground">{p}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Theme</label>
            <div className="flex gap-4">
              {(['Dark', 'Light'] as ThemePreference[]).map(t => (
                <button
                  key={t}
                  onClick={() => setFormData({ ...formData, theme: t })}
                  className={`flex-1 py-2.5 rounded-lg border transition-colors ${formData.theme === t ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500' : 'border-card-border hover:border-indigo-500/50'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button 
        onClick={handleSave} 
        disabled={isSaving} 
        className="w-full py-4 rounded-xl font-semibold text-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 shadow-md flex items-center justify-center"
      >
        {isSaving ? 'Saving...' : 'Save Settings'}
      </button>
    </Card>
  );
}
