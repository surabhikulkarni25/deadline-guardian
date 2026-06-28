import { motion } from 'motion/react';
import { Mic, MicOff } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/src/lib/utils';
import { Card } from '@/src/components/ui/Card';

export function VoiceOrb({ isListening, onClick }: { isListening: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "relative rounded-full flex items-center justify-center transition-all duration-500",
        isListening ? "w-20 h-20 bg-primary/20" : "w-16 h-16 bg-card border border-card-border hover:bg-canvas"
      )}
    >
      {isListening && (
        <>
          <motion.div 
            className="absolute inset-0 rounded-full border-2 border-primary/50"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute inset-0 rounded-full border border-primary/30"
            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
          />
        </>
      )}
      <div className={cn(
        "w-12 h-12 rounded-full flex items-center justify-center z-10 transition-colors",
        isListening ? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(99,102,241,0.6)]" : "bg-canvas border border-card-border text-muted-foreground"
      )}>
        {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </div>
    </button>
  );
}

export function VoiceAssistantPanel() {
  const [isListening, setIsListening] = useState(false);

  return (
    <Card className="flex flex-col items-center text-center space-y-4 p-8 relative overflow-hidden group border-primary/20 bg-card">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative z-10 space-y-4">
        <VoiceOrb isListening={isListening} onClick={() => setIsListening(!isListening)} />
      </div>
      
      <div className="relative z-10">
        <h3 className="text-lg font-medium text-foreground mb-1">Your Guardian</h3>
        <p className="text-sm text-muted-foreground max-w-[200px] min-h-[40px]">
          {isListening ? "Listening..." : "I'm here. Let's tackle that list."}
        </p>
      </div>
    </Card>
  );
}
