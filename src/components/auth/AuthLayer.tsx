import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/src/lib/firebase';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';

export function AuthLayer() {
  const [error, setError] = useState('');

  const handleGoogle = async () => {
    try {
      setError('');
      console.log('[Auth] Starting Google sign-in...');
      await signInWithPopup(auth, googleProvider);
      console.log('[Auth] Google sign-in success, awaiting UI updates.');
    } catch (err: any) {
      console.error('[Auth/Firestore] Error during Google sign-in flow:', err);
      setError(err.message || 'An error occurred during Google sign-in.');
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 text-center bg-card border-card-border">
        <h1 className="text-3xl font-bold text-foreground mb-2">Deadline Guardian</h1>
        <p className="text-muted-foreground mb-8">Authenticate to sync your Guardian</p>
        
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        
        <Button variant="outline" onClick={handleGoogle} className="w-full">
          Continue with Google
        </Button>
      </Card>
    </div>
  );
}
