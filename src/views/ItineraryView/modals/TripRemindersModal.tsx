import React, { useState, useRef, useEffect } from 'react';
import { 
    X, Check, Plus, Trash2, 
    Circle, CheckCircle2, Clock, CalendarDays, 
    Info, Calendar, ChevronDown
} from 'lucide-react';

// --- Types ---
export interface TodoItem {
    id: string;
    text: string;
    date?: string; // 提醒日期 (YYYY-MM-DD)
    time?: string; // 提醒時間 (HH:MM)
    isCompleted: boolean;
}

interface TripRemindersModalProps {
    todos: TodoItem[];
    onUpdateTodos: (todos: TodoItem[]) => void;
    startDate: string;
    onClose: () => void;
}

export const TripRemindersModal: React.FC<TripRemindersModalProps> = ({ 
    todos, onUpdateTodos, startDate, onClose 
}) => {
    // UI State
    const [newItemText, setNewItemText] = useState('');
    const [newItemTime, setNewItemTime] = useState(''); // 快速新增用的時間
    const [isTimeInputVisible, setIsTimeInputVisible] = useState(false);
    
    // Bottom Sheet State
    const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);

    const listEndRef = useRef<HTMLDivElement>(null);

    // Derived State
    const activeTodos = todos.filter(t => !t.isCompleted);
    const completedTodos = todos.filter(t => t.isCompleted);

    // --- Handlers ---
    const toggleTodo = (id: string) => {
        const newTodos = todos.map(item => 
            item.id === id ? { ...item, isCompleted: !item.isCompleted } : item
        );
        onUpdateTodos(newTodos);
    };

    const deleteTodo = (id: string) => {
        const newTodos = todos.filter(item => item.id !== id);
        onUpdateTodos(newTodos);
        if (editingTodo?.id === id) setEditingTodo(null);
    };

    const saveEditingTodo = () => {
        if (!editingTodo) return;
        const newTodos = todos.map(item => 
            item.id === editingTodo.id ? editingTodo : item
        );
        onUpdateTodos(newTodos);
        setEditingTodo(null);
    };

    const handleAddTodo = () => {
        if (!newItemText.trim()) return;
        const newTodo: TodoItem = {
            id: Date.now().toString(),
            text: newItemText.trim(),
            time: newItemTime || undefined,
            date: undefined,
            isCompleted: false,
        };
        onUpdateTodos([newTodo, ...todos]);
        setNewItemText('');
        setNewItemTime('');
        setIsTimeInputVisible(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleAddTodo();
    };

    // Helper: 格式化日期顯示
    const formatDisplayDate = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#1D1D1B]/60 backdrop-blur-md transition-opacity" onClick={onClose} />
            
            {/* Modal Container */}
            <div className="bg-[#F2F2F2] w-full max-w-sm h-[85vh] rounded-[32px] overflow-hidden shadow-2xl relative z-10 animate-in zoom-in-95 duration-300 flex flex-col">
                
                {/* === Header (唯讀日期) === */}
                <div className="px-6 pt-5 pb-3 flex justify-between items-center bg-[#F2F2F2] shrink-0 border-b border-gray-200/50">
                    <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-black text-[#1D1D1B] font-serif tracking-wide">行前待辦</h2>
                            <span className="bg-[#45846D] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {activeTodos.length} 待完成
                            </span>
                        </div>
                        {/* 唯讀日期顯示 */}
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 select-none cursor-default">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>出發日：{startDate}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-300 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* === List Area === */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-4 pb-24">
                    {todos.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <span className="text-sm font-bold">目前沒有待辦事項</span>
                        </div>
                    )}

                    {/* Active Group */}
                    {activeTodos.length > 0 && (
                        <div className="bg-white rounded-[24px] overflow-hidden shadow-sm border border-white">
                            {activeTodos.map((todo, index) => (
                                <div key={todo.id} className={`group flex items-center gap-3 p-4 pr-3 hover:bg-gray-50 transition-colors ${index !== activeTodos.length - 1 ? 'border-b border-gray-100' : ''}`}>
                                    {/* Checkbox */}
                                    <button onClick={() => toggleTodo(todo.id)} className="shrink-0 text-gray-300 hover:text-[#45846D] transition-colors active:scale-90">
                                        <Circle className="w-6 h-6" />
                                    </button>
                                    
                                    {/* Content */}
                                    <div className="flex-1 min-w-0 flex flex-col items-start cursor-pointer" onClick={() => setEditingTodo(todo)}>
                                        <span className="text-sm font-bold text-[#1D1D1B] truncate w-full text-left">{todo.text}</span>
                                        {(todo.time || todo.date) && (
                                            <div className="flex gap-2 mt-1">
                                                {todo.date && (
                                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" /> {formatDisplayDate(todo.date)}
                                                    </span>
                                                )}
                                                {todo.time && (
                                                    <span className="text-[10px] font-bold text-[#45846D] bg-[#45846D]/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                        <Clock className="w-3 h-3" /> {todo.time}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Info Icon (Open Bottom Sheet) */}
                                    <button 
                                        onClick={() => setEditingTodo(todo)} 
                                        className="w-8 h-8 flex items-center justify-center text-[#45846D] opacity-80 hover:opacity-100 hover:bg-[#45846D]/10 rounded-full transition-all active:scale-95"
                                    >
                                        <Info className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Completed Group */}
                    {completedTodos.length > 0 && (
                        <div className="mt-6">
                            <h3 className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">已完成 ({completedTodos.length})</h3>
                            <div className="bg-white/50 rounded-[24px] overflow-hidden">
                                {completedTodos.map((todo, index) => (
                                    <div key={todo.id} className={`group flex items-center gap-3 p-4 pr-3 hover:bg-white transition-colors ${index !== completedTodos.length - 1 ? 'border-b border-gray-100/50' : ''}`}>
                                        <button onClick={() => toggleTodo(todo.id)} className="shrink-0 text-[#45846D] active:scale-90">
                                            <CheckCircle2 className="w-6 h-6 fill-[#45846D]/10" />
                                        </button>
                                        <span className="flex-1 text-sm font-bold text-gray-400 line-through truncate text-left">{todo.text}</span>
                                        <button onClick={() => deleteTodo(todo.id)} className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-50 hover:opacity-100">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div ref={listEndRef} />
                </div>

                {/* === Input Bar (White Style) === */}
                <div className="absolute bottom-0 left-0 right-0 bg-white p-4 pt-3 pb-6 safe-area-bottom shadow-2xl border-t border-gray-100 z-20">
                    {isTimeInputVisible && (
                        <div className="mb-3 animate-in slide-in-from-bottom-2 fade-in">
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-1 pl-1"><Clock className="w-3 h-3" /> 快速設定時間</label>
                            <input 
                                type="time" 
                                autoFocus 
                                value={newItemTime} 
                                onChange={(e) => setNewItemTime(e.target.value)} 
                                className="bg-gray-100 text-[#1D1D1B] text-sm font-bold px-3 py-2 rounded-xl outline-none border border-transparent focus:bg-white focus:border-[#45846D]/30 w-full transition-all" 
                            />
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsTimeInputVisible(!isTimeInputVisible)} 
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${newItemTime ? 'bg-[#45846D] text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                        >
                            <Clock className="w-5 h-5" />
                        </button>
                        
                        <div className="flex-1 bg-gray-100 rounded-full flex items-center px-4 border border-transparent focus-within:bg-white focus-within:border-[#45846D]/30 transition-all">
                            <input 
                                type="text" 
                                placeholder="新增待辦事項..." 
                                className="w-full bg-transparent text-[#1D1D1B] text-sm font-bold py-3 outline-none placeholder-gray-400" 
                                value={newItemText} 
                                onChange={(e) => setNewItemText(e.target.value)} 
                                onKeyDown={handleKeyDown} 
                            />
                        </div>
                        
                        <button 
                            onClick={handleAddTodo} 
                            disabled={!newItemText.trim()} 
                            className="w-10 h-10 rounded-full bg-[#1D1D1B] text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black active:scale-95 transition-all"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* === Bottom Sheet (Detail Edit) === */}
                {editingTodo && (
                    <>
                        {/* Overlay */}
                        <div className="absolute inset-0 bg-black/20 z-30 animate-in fade-in" onClick={() => saveEditingTodo()} />
                        
                        {/* Sheet */}
                        <div className="absolute bottom-0 left-0 right-0 bg-white z-40 rounded-t-[32px] shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[80%]">
                            {/* Sheet Header */}
                            <div className="flex justify-between items-center p-4 px-6 border-b border-gray-100">
                                <span className="text-sm font-bold text-gray-400">詳細設定</span>
                                <button onClick={saveEditingTodo} className="text-sm font-bold text-[#45846D] bg-[#45846D]/10 px-3 py-1.5 rounded-full hover:bg-[#45846D]/20 transition-colors">
                                    完成
                                </button>
                            </div>

                            {/* Sheet Content */}
                            <div className="p-6 space-y-6 overflow-y-auto">
                                {/* Title Input */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">事項內容</label>
                                    <input 
                                        type="text" 
                                        value={editingTodo.text}
                                        onChange={(e) => setEditingTodo({ ...editingTodo, text: e.target.value })}
                                        className="w-full text-lg font-bold text-[#1D1D1B] bg-gray-50 p-4 rounded-2xl border border-transparent focus:bg-white focus:border-[#45846D]/30 outline-none transition-all"
                                    />
                                </div>

                                {/* Date & Time Row [Modified] */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" /> 日期
                                        </label>
                                        <input 
                                            type="date"
                                            value={editingTodo.date || ''}
                                            onChange={(e) => setEditingTodo({ ...editingTodo, date: e.target.value })}
                                            // 修正：bg-white + border border-gray-200，解決重疊與視覺不清問題
                                            className="w-full bg-white text-sm font-bold text-[#1D1D1B] p-3 rounded-2xl outline-none border border-gray-200 focus:border-[#45846D] transition-colors appearance-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> 時間
                                        </label>
                                        <input 
                                            type="time"
                                            value={editingTodo.time || ''}
                                            onChange={(e) => setEditingTodo({ ...editingTodo, time: e.target.value })}
                                            // 修正：bg-white + border border-gray-200
                                            className="w-full bg-white text-sm font-bold text-[#1D1D1B] p-3 rounded-2xl outline-none border border-gray-200 focus:border-[#45846D] transition-colors appearance-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Sheet Footer (Delete) [Modified] */}
                            {/* 修正：移除 bg-gray-50，改為 bg-white，保持底部純白 */}
                            <div className="p-4 bg-white border-t border-gray-100 mt-auto pb-8">
                                <button 
                                    onClick={() => deleteTodo(editingTodo.id)}
                                    className="w-full py-3 bg-white border border-red-100 text-red-500 rounded-xl text-sm font-bold shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                                >
                                    <Trash2 className="w-4 h-4" /> 刪除此事項
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};