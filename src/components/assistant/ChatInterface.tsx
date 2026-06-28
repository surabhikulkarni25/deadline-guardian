import { useState, useRef, useEffect } from 'react';
import { Bot, Mic, Send, Copy, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '@/src/hooks/use-theme';
import { cn } from '@/src/lib/utils';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  taskFormPayload?: { title: string };
  hasCalledTool?: boolean;
}

export interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (msg: string) => void;
  chatInput: string;
  setChatInput: (val: string) => void;
  isListening: boolean;
  toggleListening: () => void;
  isTranscribing?: boolean;
  guardianName?: string;
}

function TaskFormPayloadView({ msg, onSendMessage, isDark }: { msg: Message, onSendMessage: (text: string) => void, isDark: boolean }) {
  const [submitted, setSubmitted] = useState(false);
  const [deadline, setDeadline] = useState('Today');
  const [duration, setDuration] = useState('30m');
  const [urgency, setUrgency] = useState('5');
  const [importance, setImportance] = useState('5');
  const [taskType, setTaskType] = useState('Deadline');
  const [energy, setEnergy] = useState('Medium');

  if (submitted) {
    return <div className="mt-4 p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium flex items-center gap-2"><Check className="w-4 h-4"/> Task details submitted.</div>;
  }

  const selectClasses = cn(
    "w-full p-2 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors",
    isDark ? "bg-[#1A1A1D] border-white/20 text-gray-200" : "bg-white border-black/20 text-black"
  );

  return (
    <div className={cn("mt-4 p-4 rounded-xl border", isDark ? "bg-black/20 border-white/10" : "bg-slate-50 border-black/10")}>
      <h4 className={cn("font-bold mb-3 text-sm", isDark ? "text-gray-200" : "text-gray-800")}>Task details needed:</h4>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1 opacity-80">Deadline</label>
            <select value={deadline} onChange={e => setDeadline(e.target.value)} className={selectClasses}>
              <option value="Today">Today</option>
              <option value="Tomorrow">Tomorrow</option>
              <option value="Next Week">Next Week</option>
              <option value="No Deadline">No Deadline</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 opacity-80">Duration</label>
            <select value={duration} onChange={e => setDuration(e.target.value)} className={selectClasses}>
              <option value="15m">15 Minutes</option>
              <option value="30m">30 Minutes</option>
              <option value="1h">1 Hour</option>
              <option value="2h">2 Hours</option>
              <option value="4h+">4+ Hours</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 opacity-80">Urgency (1-10)</label>
            <select value={urgency} onChange={e => setUrgency(e.target.value)} className={selectClasses}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 opacity-80">Importance (1-10)</label>
            <select value={importance} onChange={e => setImportance(e.target.value)} className={selectClasses}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 opacity-80">Task Type</label>
            <select value={taskType} onChange={e => setTaskType(e.target.value)} className={selectClasses}>
              <option value="Deadline">Deadline</option>
              <option value="Goal">Goal</option>
              <option value="Habit">Habit</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 opacity-80">Energy</label>
            <select value={energy} onChange={e => setEnergy(e.target.value)} className={selectClasses}>
              <option value="Low">Low Energy</option>
              <option value="Medium">Medium Energy</option>
              <option value="High">High Energy</option>
            </select>
          </div>
        </div>
        <button 
          onClick={() => {
            setSubmitted(true);
            onSendMessage(`Task details provided for "${msg.taskFormPayload?.title}":\nDeadline: ${deadline}\nEstimated Duration: ${duration}\nUrgency: ${urgency}/10\nImportance: ${importance}/10\nTask Type: ${taskType}\nEnergy Required: ${energy}\nPlease create the task now.`);
          }}
          className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Submit Details
        </button>
      </div>
    </div>
  );
}

export function ChatInterface({ messages, onSendMessage, chatInput, setChatInput, isListening, toggleListening, isTranscribing, guardianName = "Guardian AI" }: ChatInterfaceProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isLoadingRef = useRef(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, chatInput]);

  const handleSend = async () => {
    if (!chatInput.trim() || isLoadingRef.current) return;
    const msg = chatInput;
    setChatInput('');
    setIsLoading(true);
    isLoadingRef.current = true;
    try {
      await onSendMessage(msg);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const energyOptions = ["Low Energy", "Medium Energy", "High Energy"];
  const lastMessage = messages[messages.length - 1];
  const isAskingForEnergy = lastMessage?.role === 'assistant' && lastMessage.text.includes("current energy level");

  return (
    <div className={cn("flex flex-col h-full w-full relative", isDark ? "bg-[#0A0A0B]" : "bg-white")}>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col hide-scrollbar" ref={scrollRef}>
        
        {/* Orb & Greeting Header */}
        <div className="flex flex-col items-center justify-center py-8 mb-4">
          <div className="relative mb-8 mt-4">
            <motion.div
              className={cn(
                "w-28 h-28 rounded-full flex items-center justify-center relative z-10 shadow-inner",
                isDark 
                  ? "bg-gradient-to-br from-[#1a1235] to-[#2d1b4e] shadow-[0_0_50px_rgba(168,85,247,0.3)]" 
                  : "bg-gradient-to-br from-purple-50 to-white shadow-[0_0_50px_rgba(168,85,247,0.2)]"
              )}
              animate={
                isListening 
                  ? { scale: [1, 1.1, 1] } 
                  : isLoading 
                    ? { y: [-5, 5, -5] } 
                    : { scale: [1, 1.02, 1] }
              }
              transition={
                isListening 
                  ? { duration: 1.5, repeat: Infinity } 
                  : isLoading 
                    ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 4, repeat: Infinity, ease: "easeInOut" }
              }
            >
              {/* Eyes & smile */}
              <div className="flex flex-col items-center justify-center space-y-1 mt-2">
                <div className="flex space-x-3">
                  <motion.div 
                    className={cn("w-2 h-3 rounded-full", isDark ? "bg-purple-300" : "bg-purple-600")}
                    animate={isLoading ? { scaleY: [1, 0.2, 1] } : {}}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                  />
                  <motion.div 
                    className={cn("w-2 h-3 rounded-full", isDark ? "bg-purple-300" : "bg-purple-600")} 
                    animate={isLoading ? { scaleY: [1, 0.2, 1] } : {}}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                  />
                </div>
                <div className={cn("w-3 h-1 rounded-full", isDark ? "bg-purple-300" : "bg-purple-600")} />
              </div>
            </motion.div>

            {/* Auras and Particles */}
            <motion.div
              className={cn(
                "absolute inset-[-10px] rounded-full border", 
                isDark ? "border-purple-500/30" : "border-purple-400/30"
              )}
              animate={isListening ? { scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] } : { rotate: 360, scale: [1, 1.05, 1] }}
              transition={isListening ? { duration: 1.5, repeat: Infinity } : { duration: 10, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className={cn(
                "absolute inset-[-20px] rounded-full border",
                isDark ? "border-purple-400/20" : "border-purple-300/20"
              )}
              animate={isListening ? { scale: [1.2, 1.8, 1.2], opacity: [0.5, 0, 0.5] } : { rotate: -360, scale: [1, 1.1, 1] }}
              transition={isListening ? { duration: 2, repeat: Infinity } : { duration: 15, repeat: Infinity, ease: "linear" }}
            />
          </div>
          
          <h2 className={cn("text-xl font-medium flex items-center gap-2", isDark ? "text-gray-100" : "text-black")}>
            How may I help you today? <Sparkles className="w-5 h-5 text-purple-500" />
          </h2>
        </div>

        {/* Chat Messages */}
        {messages.map(msg => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={cn(
              "group relative max-w-[85%] rounded-3xl p-4 text-[15px] leading-relaxed shadow-sm border",
              msg.role === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm',
              isDark ? "bg-[#121214] text-gray-200 border-white/10" : "bg-white text-black border-black/20"
            )}>
              <div className={cn("whitespace-pre-wrap font-medium", isDark ? "text-white" : "text-black")}>
                {msg.text}
              </div>
              
              {msg.taskFormPayload && (
                <TaskFormPayloadView msg={msg} onSendMessage={onSendMessage} isDark={isDark} />
              )}
              
              <div className={cn(
                "flex items-center mt-3 space-x-2 text-[10px]",
                msg.role === 'user' 
                  ? (isDark ? 'text-gray-400 justify-end' : 'text-purple-900/40 justify-end') 
                  : (isDark ? 'text-gray-500 justify-between' : 'text-slate-400 justify-between')
              )}>
                {msg.role === 'assistant' && <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                
                <button 
                  onClick={() => copyToClipboard(msg.id, msg.text)}
                  className={cn(
                    "flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity",
                    isDark ? "hover:text-gray-300" : "hover:text-black"
                  )}
                >
                  {copiedId === msg.id ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
        
        {isLoading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
            <div className={cn("max-w-[80%] rounded-3xl p-5 shadow-sm rounded-bl-sm border", isDark ? "bg-[#121214] border-white/10" : "bg-white border-black/20")}>
              <div className="flex space-x-1.5 h-4 items-center">
                <div className="w-2 h-2 bg-purple-500/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-purple-500/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-purple-500/60 rounded-full animate-bounce"></div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div className={cn(
        "p-4 bg-gradient-to-t to-transparent z-10 pb-6 pt-8",
        isDark ? "from-[#0A0A0B] via-[#0A0A0B]" : "from-white via-white"
      )}>
        {isAskingForEnergy && !isLoading && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 hide-scrollbar">
            {energyOptions.map(opt => (
              <button
                key={opt}
                onClick={async () => {
                  if (isLoadingRef.current) return;
                  setChatInput('');
                  setIsLoading(true);
                  isLoadingRef.current = true;
                  try {
                    await onSendMessage(opt);
                  } finally {
                    setIsLoading(false);
                    isLoadingRef.current = false;
                  }
                }}
                className={cn(
                  "px-4 py-2 text-xs font-medium rounded-full transition-colors whitespace-nowrap flex-shrink-0 border",
                  isDark 
                    ? "bg-[#121214] hover:bg-white/10 border-white/10 text-gray-300 shadow-[0_2px_8px_rgba(255,255,255,0.02)] hover:border-white/30"
                    : "bg-white hover:bg-gray-50 border-black/20 text-black hover:border-black/40 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
        
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
          <div className={cn(
            "flex-1 flex items-center p-1.5 rounded-full border transition-all",
            isDark
              ? "shadow-[0_4px_20px_rgba(0,0,0,0.5)] bg-[#121214] border-white/10 focus-within:border-white/30"
              : "shadow-[0_4px_20px_rgba(0,0,0,0.08)] bg-white border-black/20 focus-within:border-black"
          )}>
            <button
              onClick={toggleListening}
              className={cn(
                "p-3 rounded-full flex-shrink-0 transition-colors ml-1",
                isListening 
                  ? "bg-purple-500 text-white animate-pulse shadow-lg shadow-purple-500/30" 
                  : isDark
                    ? "bg-transparent text-gray-400 hover:bg-white/10 hover:text-white"
                    : "bg-transparent text-slate-400 hover:bg-slate-100 hover:text-black"
              )}
              title={isListening ? "Stop listening" : "Start listening"}
            >
              <Mic className="w-5 h-5" />
            </button>
            
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={isTranscribing ? "Transcribing audio..." : "Type your message..."}
              disabled={isTranscribing}
              className={cn(
                "flex-1 bg-transparent border-none px-4 py-3 text-[15px] focus:outline-none focus:ring-0",
                isDark ? "text-white placeholder:text-gray-500" : "text-black placeholder:text-gray-400"
              )}
            />
            
            <button 
              onClick={handleSend} 
              disabled={!chatInput.trim() || isLoading || isTranscribing}
              className={cn(
                "p-3.5 rounded-full flex-shrink-0 transition-all mr-1 disabled:opacity-40 disabled:cursor-not-allowed bg-purple-600 hover:bg-purple-500 text-white shadow-[0_4px_14px_rgba(147,51,234,0.3)]"
              )}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="text-center mt-3">
          <p className={cn("text-[10px]", isDark ? "text-slate-400" : "text-black font-medium")}>Press Enter to send &bull; {guardianName}</p>
        </div>
      </div>
    </div>
  );
}