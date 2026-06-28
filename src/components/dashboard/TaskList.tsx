import { FC, useState, useRef, ChangeEvent, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Task } from '@/src/types';
import { Card } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { CheckCircle2, Clock, AlertCircle, Trash2, Edit2, FileText, PlayCircle, XCircle, Calendar } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/src/components/ui/Button';

import { format } from 'date-fns';
import { calculateTaskRisk } from '@/src/lib/taskUtils';

export const TaskItem: FC<{ task: Task, onComplete: () => void, onEdit: () => void, onDelete: () => void, onUpdate?: (t: Task) => void, autoStart?: boolean, onAutoStartCleared?: () => void }> = ({ task, onComplete, onEdit, onDelete, onUpdate, autoStart, onAutoStartCleared }) => {
  const isUrgent = task.priorityLevel === 'Urgent' || task.priorityLevel === 'Critical';
  const isImportant = task.priorityLevel === 'Important';
  const [isCompleting, setIsCompleting] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(task.personalNote || '');

  // Phase 2: Task States & Modals
  const [showStartModal, setShowStartModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showNeedStartPopup, setShowNeedStartPopup] = useState(false);
  const [reflection, setReflection] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [toastMsg, setToastMsg] = useState<{title: string, desc?: string, error: boolean} | null>(null);
  
  const startFileRef = useRef<HTMLInputElement>(null);
  const endFileRef = useRef<HTMLInputElement>(null);

  const isCompleted = task.status === 'Completed' || task.status === 'COMPLETED';
  const isInProgress = task.status === 'IN_PROGRESS' || task.status === 'In Progress';
  const isMissed = task.status === 'Missed';
  const isCanceled = task.status === 'Canceled' || task.status === 'Incomplete';
  const isNotStarted = !isCompleted && !isInProgress && !isMissed && !isCanceled;

  useEffect(() => {
    if (autoStart) {
      setShowStartModal(true);
      if (onAutoStartCleared) {
        onAutoStartCleared();
      }
    }
  }, [autoStart, onAutoStartCleared]);

  const showToast = (title: string, desc?: string, error = false) => {
    setToastMsg({ title, desc, error });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const validateAndSaveProof = async (base64: string, isStartProof: boolean) => {
    setIsUploading(true);
    try {
      const response = await fetch('/api/validate-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          taskTitle: task.title,
          taskNotes: task.description || ''
        })
      });

      const data = await response.json();
      setIsUploading(false);

      if (!response.ok) {
        showToast("Validation Failed", data.error || "Failed to validate image.", true);
        if (isStartProof && startFileRef.current) startFileRef.current.value = '';
        if (!isStartProof && endFileRef.current) endFileRef.current.value = '';
        return;
      }

      if (data.isValid) {
        if (isStartProof) {
          setShowStartModal(false);
          if (onUpdate) {
            onUpdate({ 
              ...task, 
              status: 'IN_PROGRESS', 
              startedAt: new Date().toISOString(),
              startProofImage: base64
            });
          }
          showToast("Task Started", "Proof validated successfully. Guardian is watching your progress.");
        } else {
          if (onUpdate) {
            onUpdate({ ...task, endProofImage: base64 });
          }
          showToast("Proof Validated", "Your completion proof was accepted.");
        }
      } else {
        showToast("Invalid Proof", "This image does not appear related to your task. " + (data.reason || "Unknown"), true);
        // clear inputs
        if (isStartProof && startFileRef.current) startFileRef.current.value = '';
        if (!isStartProof && endFileRef.current) endFileRef.current.value = '';
      }
    } catch (err) {
      console.error(err);
      setIsUploading(false);
      showToast("Validation Failed", "Failed to validate image due to server error.", true);
    }
  };

  const handleStartTaskClick = () => {
    setShowStartModal(true);
  };

  const handleConfirmStart = () => {
    // Trigger file input for start proof
    startFileRef.current?.click();
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const max_size = 800;
          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleStartProofUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await compressImage(file);
    validateAndSaveProof(base64, true);
  };

  const handleCheckClick = () => {
    if (isNotStarted) {
      setShowNeedStartPopup(true);
      return;
    }
    if (isInProgress) {
      setShowCompleteModal(true);
      return;
    }
  };

  const handleConfirmComplete = () => {
    if (!task.endProofImage || reflection.length < 15) {
      alert('Please provide both proof image and reflection (min 15 chars).');
      return;
    }
    setIsCompleting(true);
    if (onUpdate) {
      onUpdate({ ...task, completionReflection: reflection });
    }
    onComplete();
    setShowCompleteModal(false);
  };

  const handleEndProofUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await compressImage(file);
    validateAndSaveProof(base64, false);
  };

  const handleSaveNote = () => {
    setIsEditingNote(false);
    if (onUpdate) {
      onUpdate({ ...task, personalNote: noteValue });
    }
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isCompleting ? 0 : 1, scale: isCompleting ? 0.95 : 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className={cn(
      "group relative flex flex-col p-4 rounded-xl border transition-all duration-200 shadow-sm hover:shadow-md",
      task.status === 'Completed' ? "opacity-50 grayscale bg-card border-card-border" :
      (isMissed || isCanceled) ? "bg-gray-500/5 border-gray-500/20 hover:border-gray-500/40 opacity-80" :
      isUrgent ? "bg-red-500/5 border-red-500/20 hover:border-red-500/40" : 
      isImportant ? "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40" : 
      "bg-card/40 border-card-border hover:border-primary/30 hover:bg-card/60"
    )}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 w-full">
        <div className="flex items-start gap-4 w-full sm:flex-1 min-w-0">
          <button onClick={handleCheckClick} className={cn("mt-1 flex-shrink-0 transition-colors hover:scale-110", task.status === 'Completed' ? "text-emerald-500" : "text-muted-foreground hover:text-emerald-500")}>
            <CheckCircle2 className="w-6 h-6" />
          </button>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={cn("text-base font-medium transition-colors line-clamp-2", task.status === 'Completed' ? "text-muted-foreground line-through" : "text-foreground group-hover:text-primary")}>
                {task.title}
              </h4>
              {task.type && (
                <Badge variant="default" className="text-[10px] bg-canvas text-muted-foreground border-card-border shrink-0">{task.type}</Badge>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-muted-foreground mt-1">
              <span className={cn("flex items-center gap-1", (isMissed || isCanceled) ? "text-rose-500 font-medium" : "")}>
                 <Clock className="w-3 h-3 shrink-0" />
                 {task.deadline && !isNaN(new Date(task.deadline).getTime()) ? format(new Date(task.deadline), 'dd/MM/yyyy') : 'No deadline'}
              </span>
              {isUrgent && task.status !== 'Completed' && (
                <span className="flex items-center gap-1 text-red-500 font-medium bg-red-500/10 px-1.5 py-0.5 rounded">
                  <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                  High Risk
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 ml-10 sm:ml-0 mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-border/50">
          {(!isCompleted && !isInProgress && !isMissed) && (
            <button 
              onClick={handleStartTaskClick} 
              className="h-11 w-11 sm:h-auto sm:w-auto p-2 flex items-center justify-center transition-colors rounded-full text-muted-foreground hover:text-primary hover:bg-black/5 dark:hover:bg-white/5" 
              title="Start Task"
            >
              <PlayCircle className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
            </button>
          )}
          {isInProgress && (
            <div 
              className="h-11 w-11 sm:h-auto sm:w-auto p-2 flex items-center justify-center rounded-full text-purple-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] animate-pulse" 
              title="Task in Progress"
            >
              <PlayCircle className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
            </div>
          )}
          {isMissed && (
            <div 
              onClick={onEdit}
              className="h-11 w-11 sm:h-auto sm:w-auto text-muted-foreground hover:text-emerald-500 p-2 flex items-center justify-center transition-colors hover:bg-emerald-500/10 rounded-full cursor-pointer"
              title="Reschedule Task"
            >
              <Calendar className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
            </div>
          )}
          {!isCompleted && !isCanceled && !isImportant && (
            <button onClick={() => onUpdate && onUpdate({ ...task, status: 'Canceled' })} className="text-muted-foreground hover:text-rose-500 h-11 w-11 sm:h-auto sm:w-auto p-2 flex items-center justify-center transition-colors hover:bg-rose-500/10 rounded-full" title="Cancel Task">
              <XCircle className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
            </button>
          )}
          <button onClick={() => setIsEditingNote(!isEditingNote)} className="text-muted-foreground hover:text-primary h-11 w-11 sm:h-auto sm:w-auto p-2 flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/5 rounded-full" title="Personal Notes">
            <FileText className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
          </button>
          {!isCanceled && !isMissed && (
            <button onClick={onEdit} className="text-muted-foreground hover:text-primary h-11 w-11 sm:h-auto sm:w-auto p-2 flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/5 rounded-full" title="Edit / Reschedule">
              <Edit2 className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
            </button>
          )}
          <button onClick={onDelete} className="text-muted-foreground hover:text-red-500 h-11 w-11 sm:h-auto sm:w-auto p-2 flex items-center justify-center transition-colors hover:bg-red-500/10 rounded-full" title="Delete Task">
            <Trash2 className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
          </button>
        </div>
      </div>
      
      <AnimatePresence>
        {isEditingNote && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full mt-3 pl-10"
          >
            <textarea
              className="w-full bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[80px]"
              placeholder="Add your personalized notes here..."
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
            />
            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={handleSaveNote} variant="default">Save Note</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {!isEditingNote && task.personalNote && (
        <div className="w-full mt-3 pl-10">
          <div className="bg-canvas p-3 rounded-lg text-sm text-muted-foreground border border-card-border italic relative">
            <FileText className="w-3 h-3 absolute top-3 right-3 opacity-30" />
            {task.personalNote}
          </div>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input type="file" accept="image/*" capture="environment" ref={startFileRef} className="hidden" onChange={handleStartProofUpload} />
      <input type="file" accept="image/*" capture="environment" ref={endFileRef} className="hidden" onChange={handleEndProofUpload} />

      {/* Toast Notification */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {toastMsg && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className={cn(
                "fixed bottom-6 right-6 z-[100] border shadow-xl p-4 rounded-xl max-w-sm w-full bg-background/95 backdrop-blur-md",
                toastMsg.error ? "border-red-500/50 text-red-500" : "border-emerald-500/50 text-emerald-500"
              )}
            >
              <div className="flex items-start gap-3">
                {toastMsg.error ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
                <div>
                  <h4 className="font-bold text-sm">{toastMsg.title}</h4>
                  {toastMsg.desc && <p className="text-xs opacity-90 mt-1 leading-snug">{toastMsg.desc}</p>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Start Task Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showStartModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-sm rounded-xl border border-border shadow-xl overflow-hidden p-6">
                <h3 className="text-xl font-bold mb-2">Ready to begin this task?</h3>
                <p className="text-muted-foreground mb-6 text-sm">Capture a quick proof that you are starting this task (e.g. study desk, IDE/editor, work setup).</p>
                <div className="flex gap-3 justify-end">
                  <Button variant="ghost" onClick={() => setShowStartModal(false)} disabled={isUploading}>Cancel</Button>
                  <Button variant="default" onClick={handleConfirmStart} disabled={isUploading}>{isUploading ? 'Validating...' : 'Start Now'}</Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Need Start Popup */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showNeedStartPopup && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-sm rounded-xl border border-border shadow-xl overflow-hidden p-6 text-center">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Task Not Started</h3>
                <p className="text-muted-foreground mb-6 text-sm">You need to start this task first before marking it complete.</p>
                <div className="flex gap-3 justify-center">
                  <Button variant="ghost" onClick={() => setShowNeedStartPopup(false)}>Cancel</Button>
                  <Button variant="default" onClick={() => { setShowNeedStartPopup(false); handleStartTaskClick(); }}>Start Task</Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Complete Task Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showCompleteModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-md rounded-xl border border-border shadow-xl overflow-hidden p-6 max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-4">Complete Task</h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">1. Proof of Completion</label>
                    <p className="text-xs text-muted-foreground mb-3">Show your progress or finished work (e.g. completed notes, code output).</p>
                    
                    {task.endProofImage ? (
                      <div className="relative rounded-lg overflow-hidden border border-border h-32 bg-black/10 flex items-center justify-center group">
                        <img src={task.endProofImage} alt="Proof" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Button variant="secondary" size="sm" onClick={() => endFileRef.current?.click()} disabled={isUploading}>{isUploading ? 'Validating...' : 'Retake'}</Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" className="w-full h-24 border-dashed flex flex-col items-center justify-center gap-2" onClick={() => endFileRef.current?.click()} disabled={isUploading}>
                        <FileText className="w-6 h-6 text-muted-foreground" />
                        <span>{isUploading ? 'Validating Image...' : 'Capture Proof'}</span>
                      </Button>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">2. Reflection</label>
                    <p className="text-xs text-muted-foreground mb-3">What progress did you make?</p>
                    <textarea 
                      className="w-full bg-background border border-border rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px]"
                      placeholder="I finished the first draft of..."
                      value={reflection}
                      onChange={(e) => setReflection(e.target.value)}
                      maxLength={250}
                    />
                    <div className="text-right text-xs text-muted-foreground mt-1">
                      {reflection.length}/250 (Min 15)
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-border">
                    <Button variant="ghost" onClick={() => setShowCompleteModal(false)} disabled={isCompleting}>Cancel</Button>
                    <Button variant="default" onClick={handleConfirmComplete} disabled={!task.endProofImage || reflection.length < 15 || isCompleting}>
                      {isCompleting ? 'Completing...' : 'Submit & Complete'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
}

export const TaskList: FC<{ tasks: Task[], onComplete: (t: Task) => void, onEdit: (t: Task) => void, onDelete: (t: Task) => void, onUpdate?: (t: Task) => void, autoStartTaskId?: string | null, onAutoStartCleared?: () => void }> = ({ tasks, onComplete, onEdit, onDelete, onUpdate, autoStartTaskId, onAutoStartCleared }) => {
  const canceledTasks = tasks.filter(t => t.status === 'Incomplete' || t.status === 'Canceled');
  const pendingTasks = tasks
    .filter(t => t.status !== 'Completed' && t.status !== 'COMPLETED' && !canceledTasks.some(inc => inc.id === t.id))
    .sort((a, b) => calculateTaskRisk(b).score - calculateTaskRisk(a).score);
  
  const critical = pendingTasks.filter(t => t.priorityLevel === 'Urgent' || t.priorityLevel === 'Critical');
  const important = pendingTasks.filter(t => t.priorityLevel === 'Important');
  const low = pendingTasks.filter(t => t.priorityLevel === 'Low Priority');

  return (
    <Card className="flex flex-col h-full overflow-hidden col-span-2 p-0 border-0 bg-transparent shadow-none">
      <div className="p-4 sm:p-6 border-b border-card-border flex justify-between items-center bg-card rounded-t-xl">
        <h2 className="text-xl font-bold">Action Plan</h2>
        <Badge variant="info">{pendingTasks.length} active</Badge>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 no-scrollbar bg-card/60 rounded-b-xl border border-t-0 border-card-border">
        <AnimatePresence>
          {critical.length > 0 && (
            <motion.div key="critical" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-500 flex items-center gap-2">
                Urgent <span className="text-muted-foreground opacity-50">— Do this now</span>
              </h3>
              {critical.map(t => <TaskItem key={t.id} task={t} onComplete={() => onComplete(t)} onEdit={() => onEdit(t)} onDelete={() => onDelete(t)} onUpdate={onUpdate} autoStart={autoStartTaskId === t.id} onAutoStartCleared={onAutoStartCleared} />)}
            </motion.div>
          )}
          
          {important.length > 0 && (
            <motion.div key="important" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-2">
                Important <span className="text-muted-foreground opacity-50">— Schedule these</span>
              </h3>
              {important.map(t => <TaskItem key={t.id} task={t} onComplete={() => onComplete(t)} onEdit={() => onEdit(t)} onDelete={() => onDelete(t)} onUpdate={onUpdate} autoStart={autoStartTaskId === t.id} onAutoStartCleared={onAutoStartCleared} />)}
            </motion.div>
          )}
          
          {low.length > 0 && (
            <motion.div key="low" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                Low Priority <span className="opacity-50">— If time permits</span>
              </h3>
              {low.map(t => <TaskItem key={t.id} task={t} onComplete={() => onComplete(t)} onEdit={() => onEdit(t)} onDelete={() => onDelete(t)} onUpdate={onUpdate} autoStart={autoStartTaskId === t.id} onAutoStartCleared={onAutoStartCleared} />)}
            </motion.div>
          )}

          {canceledTasks.length > 0 && (
            <motion.div key="canceled" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 mt-6 pt-6 border-t border-card-border/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                Canceled <span className="text-muted-foreground opacity-50">— These tasks were canceled</span>
              </h3>
              {canceledTasks.map(t => <TaskItem key={t.id} task={t} onComplete={() => onComplete(t)} onEdit={() => onEdit(t)} onDelete={() => onDelete(t)} onUpdate={onUpdate} autoStart={autoStartTaskId === t.id} onAutoStartCleared={onAutoStartCleared} />)}
            </motion.div>
          )}
        </AnimatePresence>

        {pendingTasks.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-12">
            <CheckCircle2 className="w-12 h-12 text-emerald-500/20 mb-4" />
            <p className="text-lg font-medium text-foreground mb-1">Your action plan is clear</p>
            <p className="text-sm">Enjoy the peace or add a new task.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
