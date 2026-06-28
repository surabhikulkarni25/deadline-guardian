import { useState, useEffect, FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Task, TaskType } from '@/src/types';
import { parse, format, isValid } from 'date-fns';

interface TaskCreationModalProps {
  task?: Task | null;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
}

export function TaskCreationModal({ task, onClose, onSave }: TaskCreationModalProps) {
  const [title, setTitle] = useState('');
  const [deadlineStr, setDeadlineStr] = useState('');
  const [urgency, setUrgency] = useState('5');
  const [importance, setImportance] = useState('5');
  const [durationHours, setDurationHours] = useState('1');
  const [durationMinutes, setDurationMinutes] = useState('0');
  const [energy, setEnergy] = useState<'Low'|'Medium'|'High'>('Medium');
  const [type, setType] = useState<TaskType>('Assignment');
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      try {
        const d = new Date(task.deadline);
        if (isValid(d)) {
          setDeadlineStr(format(d, "yyyy-MM-dd"));
        } else {
          setDeadlineStr('');
        }
      } catch(e) {
        setDeadlineStr('');
      }
      setUrgency(task.urgency.toString());
      setImportance(task.importance.toString());
      
      const hrs = Math.floor(task.estDuration / 60);
      const mins = task.estDuration % 60;
      setDurationHours(hrs.toString());
      setDurationMinutes(mins.toString());
      
      setEnergy(task.energyRequired);
      setType(task.type);
    }
  }, [task]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    // Validate yyyy-MM-dd
    const parsedDate = parse(deadlineStr, 'yyyy-MM-dd', new Date());
    if (!isValid(parsedDate)) {
      setDateError('Please select a valid date');
      return;
    }
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    if (parsedDate < todayDate) {
      setDateError('Deadline cannot be in the past');
      return;
    }
    setDateError('');

    const estMins = (parseInt(durationHours || '0') * 60) + parseInt(durationMinutes || '0');

    onSave({
      id: task ? task.id : Math.random().toString(36).substring(7),
      title,
      deadline: parsedDate.toISOString(),
      urgency: parseInt(urgency),
      importance: parseInt(importance),
      estDuration: estMins,
      energyRequired: energy,
      type,
      status: task ? task.status : 'Pending'
    });
  };

  const types: TaskType[] = ['Assignment', 'Study', 'Meeting', 'Personal', 'Health', 'Finance', 'Custom'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-xl bg-card border-card-border shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-xl font-bold text-foreground mb-6">Create New Task</h2>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Title</label>
            <input 
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full bg-canvas border border-card-border rounded-lg px-4 py-2.5 text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Deadline Date</label>
              <input 
                required
                type="date"
                value={deadlineStr}
                onChange={e => setDeadlineStr(e.target.value)}
                className="w-full bg-canvas border border-card-border rounded-lg px-4 py-2.5 text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              />
              {dateError && <p className="text-red-500 text-xs mt-1">{dateError}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex justify-between items-center">
                <span>Est. Duration</span>
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute right-3 top-3 text-xs text-muted-foreground pointer-events-none">hrs</span>
                  <input 
                    required
                    type="number"
                    min="0"
                    value={durationHours}
                    onChange={e => setDurationHours(e.target.value)}
                    className="w-full bg-canvas border border-card-border rounded-lg pl-3 pr-8 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div className="flex-1 relative">
                  <span className="absolute right-3 top-3 text-xs text-muted-foreground pointer-events-none">min</span>
                  <input 
                    required
                    type="number"
                    min="0"
                    max="59"
                    value={durationMinutes}
                    onChange={e => setDurationMinutes(e.target.value)}
                    className="w-full bg-canvas border border-card-border rounded-lg pl-3 pr-8 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex justify-between">
                <span>Urgency</span>
                <span className="text-primary">{urgency}/10</span>
              </label>
              <input 
                type="range" min="1" max="10" 
                value={urgency} onChange={e => setUrgency(e.target.value)}
                className="w-full accent-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex justify-between">
                <span>Importance</span>
                <span className="text-primary">{importance}/10</span>
              </label>
              <input 
                type="range" min="1" max="10" 
                value={importance} onChange={e => setImportance(e.target.value)}
                className="w-full accent-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Task Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as TaskType)}
                className="w-full bg-canvas border border-card-border rounded-lg px-4 py-2.5 text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              >
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Energy Required</label>
              <select
                value={energy}
                onChange={e => setEnergy(e.target.value as 'Low'|'Medium'|'High')}
                className="w-full bg-canvas border border-card-border rounded-lg px-4 py-2.5 text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="button" variant="ghost" onClick={onClose} className="mr-2">Cancel</Button>
            <Button type="submit">Create Task</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
