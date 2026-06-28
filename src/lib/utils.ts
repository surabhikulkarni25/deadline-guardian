import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function generateUniqueUsername(baseName: string): Promise<string> {
  let base = baseName.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!base || base.length < 3) base = `user_${Math.floor(Math.random() * 1000)}`;
  if (base.length > 18) base = base.substring(0, 18);
  base = `${base}_guardian`;
  
  const q = query(collection(db, 'users'), where('username', '==', base));
  const snap = await getDocs(q);
  if (snap.empty) return base;

  let isUnique = false;
  let newUsername = base;
  while (!isUnique) {
    const suffix = Math.floor(Math.random() * 90000) + 10000; // 5 digits
    newUsername = `${base.substring(0, 19)}${suffix}`;
    const q2 = query(collection(db, 'users'), where('username', '==', newUsername));
    const snap2 = await getDocs(q2);
    if (snap2.empty) isUnique = true;
  }
  return newUsername;
}
