import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { UserProfile, AIPersonality, ThemePreference, PeakProductivity, ProductivityStruggle, MotivationStyle } from '@/src/types';
import { getGuardianName } from '@/src/lib/guardianUtils';

interface OnboardingFlowProps {
  onComplete: (profile: UserProfile) => void;
}

const steps = [
  {
    id: 'intro',
    title: 'Meet Your Guardian',
    description: "I will help you beat procrastination. Let's customize my behavior.",
  },
  {
    id: 'personality',
    title: 'Choose My Personality',
    options: ['Strict Coach', 'Supportive Friend', 'Competitive Rival', 'Calm Mentor'] as AIPersonality[],
  },
  {
    id: 'theme',
    title: 'Select Your Theme',
    options: ['Dark', 'Light'] as ThemePreference[],
  },
  {
    id: 'peakTime',
    title: 'When are you most productive?',
    options: ['Morning', 'Afternoon', 'Night Owl', 'Unpredictable'] as PeakProductivity[],
  },
  {
    id: 'struggle',
    title: 'What is your biggest struggle?',
    options: ['Starting tasks', 'Staying focused', 'Perfectionism', 'Time tracking'] as ProductivityStruggle[],
  },
  {
    id: 'motivation',
    title: 'How should I motivate you?',
    options: ['Tough Love', 'Gentle Nudges', 'Gamified Rewards', 'Logical Deadlines'] as MotivationStyle[],
  }
];

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [profile, setProfile] = useState<Partial<UserProfile>>({ name: 'User' });

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete(profile as UserProfile);
    }
  };

  const handleSelect = (field: string, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    handleNext();
  };

  const step = steps[currentStep];

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <Card className="w-full max-w-lg relative overflow-hidden bg-card border-card-border">
        <div className="absolute top-0 left-0 w-full h-1 bg-canvas">
          <motion.div 
            className="h-full bg-indigo-500"
            initial={{ width: 0 }}
            animate={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
          />
        </div>
        
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="py-6 px-2 text-center"
          >
            <h2 className="text-2xl font-bold text-foreground mb-6">
              {step.title}
            </h2>
            
            {step.id === 'intro' ? (
              <div className="space-y-6">
                <p className="text-muted-foreground">{step.description}</p>
                <div className="w-24 h-24 mx-auto rounded-full bg-indigo-500/20 flex items-center justify-center animate-pulse">
                  <div className="w-16 h-16 rounded-full bg-indigo-500/40" />
                </div>
                <Button className="w-full" onClick={handleNext}>Initialize Systems</Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {step.options?.map((option) => (
                  <Button 
                    key={option}
                    variant="outline" 
                    className="h-14 justify-start px-6 text-left hover:bg-indigo-500/10 hover:border-indigo-500/50 flex flex-col items-start justify-center"
                    onClick={() => handleSelect(step.id, option)}
                  >
                    <span className="font-medium">{step.id === 'personality' ? getGuardianName(option as AIPersonality) : option}</span>
                    {step.id === 'personality' && <span className="text-xs opacity-70 font-normal">{option}</span>}
                  </Button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </Card>
    </div>
  );
}
