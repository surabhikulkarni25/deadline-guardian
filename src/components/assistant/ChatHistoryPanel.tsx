import { useState } from 'react';
import { Search, Pin, PinOff, MoreVertical, Edit2, Trash2, Edit3 } from 'lucide-react';
import { ChatSession } from '@/src/types';

export interface ChatHistoryPanelProps {
  chats: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onTogglePin: (chatId: string, pinned: boolean) => void;
  onRenameChat: (chatId: string, newTitle: string) => void;
  onDeleteChat: (chatId: string) => void;
}

export function ChatHistoryPanel({ chats, activeChatId, onSelectChat, onNewChat, onTogglePin, onRenameChat, onDeleteChat }: ChatHistoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  console.log(`[CHAT_HISTORY_RENDER] Total chats received: ${chats.length}`);

  const filteredChats = chats.filter(chat => {
    const title = chat.title || 'New Chat';
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const pinnedChats = filteredChats.filter(c => c.pinned).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const recentChats = filteredChats.filter(c => !c.pinned).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  
  console.log(`[CHAT_HISTORY_RENDER] Pinned: ${pinnedChats.length}, Recent: ${recentChats.length}`);

  const handleRenameSubmit = (chatId: string) => {
    if (editTitle.trim()) {
      onRenameChat(chatId, editTitle.trim());
    }
    setEditingChatId(null);
  };

  const renderChatItem = (chat: ChatSession) => (
    <div 
      key={chat.chatId}
      className={`group relative flex items-center px-4 py-2 rounded-full cursor-pointer transition-colors ${
        activeChatId === chat.chatId ? 'bg-purple-100/50 dark:bg-white/10 text-foreground font-medium' : 'hover:bg-slate-200/50 dark:hover:bg-white/5 text-foreground hover:text-foreground'
      }`}
      onClick={() => {
        if (editingChatId !== chat.chatId) {
          onSelectChat(chat.chatId);
        }
      }}
    >
      {editingChatId === chat.chatId ? (
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={() => handleRenameSubmit(chat.chatId)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameSubmit(chat.chatId);
            if (e.key === 'Escape') setEditingChatId(null);
          }}
          className="flex-1 bg-transparent outline-none text-sm border-b border-blue-400 text-foreground"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 truncate text-sm">{chat.title}</span>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          setConfirmDeleteId(null);
          setMenuOpenId(menuOpenId === chat.chatId ? null : chat.chatId);
        }}
        className={`p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-300/50 dark:hover:bg-white/10 ${
          menuOpenId === chat.chatId ? 'opacity-100 bg-slate-300/50 dark:bg-white/10' : ''
        }`}
      >
        <MoreVertical className="w-4 h-4 text-foreground dark:text-gray-400" />
      </button>

      {menuOpenId === chat.chatId && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDeleteId(null);
              setMenuOpenId(null);
            }}
          />
          <div className="absolute right-4 top-8 z-50 w-36 bg-white dark:bg-[#1A2341] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden py-1">
            <button
              className="w-full text-left px-4 py-2 text-sm flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-white/10 text-foreground dark:text-gray-200 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setEditTitle(chat.title);
                setEditingChatId(chat.chatId);
                setMenuOpenId(null);
              }}
            >
              <Edit2 className="w-4 h-4" /> Rename
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-white/10 text-foreground dark:text-gray-200 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(chat.chatId, !chat.pinned);
                setMenuOpenId(null);
              }}
            >
              {chat.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              {chat.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-white/10 text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                if (confirmDeleteId === chat.chatId) {
                  onDeleteChat(chat.chatId);
                  setConfirmDeleteId(null);
                  setMenuOpenId(null);
                } else {
                  setConfirmDeleteId(chat.chatId);
                }
              }}
            >
              <Trash2 className="w-4 h-4" /> {confirmDeleteId === chat.chatId ? 'Confirm Delete' : 'Delete'}
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full w-[260px] bg-slate-50 dark:bg-transparent text-foreground dark:text-gray-200 border-r border-slate-200 dark:border-white/10 flex-shrink-0 font-sans">
      <div className="p-4 space-y-4">
        {/* New Chat Pill Button */}
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-transparent hover:bg-purple-50 dark:hover:bg-white/5 rounded-full text-sm font-medium transition-colors border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none"
        >
          <Edit3 className="w-4 h-4 text-foreground" />
          <span className="text-foreground">New chat</span>
        </button>
        
        {/* Seamless Search */}
        <div className="relative group">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-foreground transition-colors" />
          <input
            type="text"
            placeholder="Search chats"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2 bg-transparent rounded-full text-sm text-foreground focus:outline-none focus:bg-slate-100 dark:focus:bg-white/5 transition-colors placeholder:text-foreground hover:bg-slate-100 dark:hover:bg-white/5"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-6 custom-scrollbar">
        {pinnedChats.length > 0 && (
          <div>
            <h4 className="text-[11px] font-bold text-foreground mb-2 px-4 uppercase tracking-wide">Pinned</h4>
            <div className="space-y-0.5">
              {pinnedChats.map(renderChatItem)}
            </div>
          </div>
        )}

        <div>
          <h4 className="text-[11px] font-bold text-foreground mb-2 px-4 tracking-wide">Recents</h4>
          {recentChats.length === 0 ? (
            <p className="text-xs text-foreground px-4 italic">No chats found.</p>
          ) : (
            <div className="space-y-0.5">
              {recentChats.map(renderChatItem)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
