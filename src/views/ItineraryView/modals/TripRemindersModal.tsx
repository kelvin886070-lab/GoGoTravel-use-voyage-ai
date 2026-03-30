import React, { useState } from 'react';
import { 
    X, Check, Plus, Trash2, 
    Circle, CheckCircle2, Clock, CalendarDays, 
    Info, Calendar, ChevronDown,
    Briefcase, Shirt, Bath, Smartphone, Package, ListChecks
} from 'lucide-react';

// ============================================================================
// ✨ 階段四：體驗收斂與防禦機制 (Keyboard Avoidance & Scroll Locking)
// ============================================================================
type CategoryType = 'tasks' | 'documents' | 'clothes' | 'toiletries' | 'gadgets' | 'others';

export interface TripTodoItem {
    id: string;
    text: string;
    isCompleted: boolean;
    time?: string;
    date?: string;
    category?: CategoryType;
}

interface TripRemindersModalProps {
    todos: TripTodoItem[];
    onUpdateTodos: (todos: TripTodoItem[]) => void;
    startDate: string;
    onClose: () => void;
}

const CATEGORIES: { id: CategoryType, label: string, icon: any, color: string }[] = [
    { id: 'tasks', label: '行前任務', icon: ListChecks, color: 'text-orange-600 bg-orange-50' },
    { id: 'documents', label: '必備證件', icon: Briefcase, color: 'text-blue-600 bg-blue-50' },
    { id: 'clothes', label: '衣物穿搭', icon: Shirt, color: 'text-pink-600 bg-pink-50' },
    { id: 'toiletries', label: '盥洗藥品', icon: Bath, color: 'text-cyan-600 bg-cyan-50' },
    { id: 'gadgets', label: '3C 電子', icon: Smartphone, color: 'text-purple-600 bg-purple-50' },
    { id: 'others', label: '其他小物', icon: Package, color: 'text-gray-600 bg-gray-50' },
];

export const TripRemindersModal: React.FC<TripRemindersModalProps> = ({ 
    todos, onUpdateTodos, startDate, onClose 
}) => {
    // UI State
    const [addingToCategory, setAddingToCategory] = useState<CategoryType | null>(null);
    const [newItemText, setNewItemText] = useState('');
    
    // Bottom Sheet State
    const [editingTodo, setEditingTodo] = useState<TripTodoItem | null>(null);

    // Derived State (進度條計算)
    const totalTodos = todos.length;
    const completedTodos = todos.filter(t => t.isCompleted).length;
    const progress = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

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

    const handleAddTodo = (categoryId: CategoryType) => {
        if (!newItemText.trim()) return;
        const newTodo: TripTodoItem = {
            id: Date.now().toString(),
            text: newItemText.trim(),
            isCompleted: false,
            category: categoryId,
        };
        onUpdateTodos([...todos, newTodo]);
        setNewItemText('');
        setAddingToCategory(null);
    };

    // Helper: 格式化日期顯示
    const formatDisplayDate = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            {/* Modal Backdrop */}
            <div className="absolute inset-0 bg-[#1D1D1B]/60 backdrop-blur-md transition-opacity" onClick={onClose} />
            
            {/* Modal Container */}
            <div className="bg-[#F2F2F2] w-full max-w-sm h-[85vh] rounded-[32px] overflow-hidden shadow-2xl relative z-10 animate-in zoom-in-95 duration-300 flex flex-col">
                
                {/* === Header (標題 + 日期 + 進度條) === */}
                <div className="px-6 pt-5 pb-5 shrink-0 bg-white rounded-b-[32px] shadow-sm z-20">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col items-start gap-1.5">
                            <div className="flex items-center gap-2">
                                <h2 className="text-2xl font-black text-[#1D1D1B] font-serif tracking-wide">行前待辦</h2>
                                <span className="bg-[#45846D] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                    {totalTodos - completedTodos} 待完成
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 select-none cursor-default">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>出發日：{startDate}</span>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* 綠色質感進度條 */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">準備進度</span>
                            <span className="text-lg font-black text-[#45846D] leading-none">{progress}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
                            <div 
                                className="h-full bg-[#45846D] transition-all duration-500 ease-out shadow-[0_0_10px_rgba(69,132,109,0.3)]" 
                                style={{ width: `${progress}%` }} 
                            />
                        </div>
                    </div>
                </div>

                {/* === 分類列表區塊 === */}
                {/* 🛡️ 防禦 2 (Scroll Locking)：當底層面板打開時，強制鎖定後方列表不准滑動 (overflow-hidden) */}
                <div className={`flex-1 p-5 pb-8 space-y-6 scroll-smooth no-scrollbar ${editingTodo ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                    {CATEGORIES.map(cat => {
                        const catTodos = todos.filter(t => t.category === cat.id || (!t.category && cat.id === 'others'));
                        const completedCount = catTodos.filter(t => t.isCompleted).length;

                        return (
                            <div key={cat.id} className="bg-white rounded-[24px] overflow-hidden shadow-sm border border-white">
                                {/* 分類標頭 */}
                                <div className="bg-[#F5F5F4]/80 backdrop-blur-sm px-4 py-3 flex justify-between items-center border-b border-white">
                                    <div className="flex items-center gap-2.5 font-bold text-[#1D1D1B]">
                                        <div className={`p-1.5 rounded-lg ${cat.color}`}>
                                            <cat.icon className="w-4 h-4" />
                                        </div>
                                        {cat.label}
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-1 rounded-full border border-gray-100 tabular-nums">
                                        {completedCount} / {catTodos.length}
                                    </span>
                                </div>

                                {/* 項目卡片列表 */}
                                <div className="p-1.5">
                                    {catTodos.length > 0 ? (
                                        catTodos.map(todo => (
                                            <div key={todo.id} className="group flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors rounded-xl cursor-pointer">
                                                <button onClick={() => toggleTodo(todo.id)} className="shrink-0 transition-colors active:scale-90">
                                                    {todo.isCompleted ? (
                                                        <CheckCircle2 className="w-6 h-6 text-[#45846D] fill-[#45846D]/10 transition-transform scale-110" />
                                                    ) : (
                                                        <Circle className="w-6 h-6 text-gray-300 hover:text-gray-400" />
                                                    )}
                                                </button>

                                                <div className="flex-1 min-w-0 flex flex-col items-start" onClick={() => setEditingTodo(todo as any)}>
                                                    <span className={`text-sm font-bold truncate w-full text-left transition-colors ${todo.isCompleted ? 'text-gray-400 line-through' : 'text-[#1D1D1B]'}`}>
                                                        {todo.text}
                                                    </span>
                                                    {(todo.time || todo.date) && (
                                                        <div className="flex gap-2 mt-1.5">
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

                                                <button onClick={(e) => { e.stopPropagation(); setEditingTodo(todo as any); }} className="w-8 h-8 flex items-center justify-center text-[#45846D] opacity-60 hover:opacity-100 hover:bg-[#45846D]/10 rounded-full transition-all active:scale-95 shrink-0">
                                                    <Info className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        !addingToCategory && (
                                            <div className="text-center py-3 text-xs font-bold text-gray-300">
                                                尚無項目
                                            </div>
                                        )
                                    )}

                                    {/* 增加輸入框 */}
                                    {addingToCategory === cat.id ? (
                                        <div className="p-2 flex gap-2 items-center bg-[#45846D]/5 rounded-xl mt-1 animate-in fade-in">
                                            <input
                                                autoFocus
                                                type="text"
                                                placeholder="輸入項目名稱..."
                                                className="flex-1 bg-white border border-transparent rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-[#45846D]/20 shadow-sm text-[#1D1D1B]"
                                                value={newItemText}
                                                onChange={e => setNewItemText(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddTodo(cat.id); }}
                                                // 🛡️ 防禦 1 (Keyboard Avoidance)：延遲 300ms 等鍵盤彈出後，將輸入框滑動到畫面正中央
                                                onFocus={(e) => {
                                                    const target = e.target;
                                                    setTimeout(() => {
                                                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                    }, 300);
                                                }}
                                            />
                                            <button onClick={() => handleAddTodo(cat.id)} className="text-[#45846D] font-bold text-sm px-3 py-2 rounded-lg hover:bg-white transition-colors shadow-sm">新增</button>
                                            <button onClick={() => { setAddingToCategory(null); setNewItemText(''); }} className="text-gray-400 font-bold text-sm px-2 hover:text-gray-600 transition-colors">取消</button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => setAddingToCategory(cat.id)} 
                                            className="w-full py-3 flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-[#45846D] hover:bg-gray-50 transition-colors rounded-xl mt-1 font-medium border border-dashed border-transparent hover:border-[#45846D]/20"
                                        >
                                            <Plus className="w-4 h-4" /> 新增項目
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* === Bottom Sheet (Detail Edit) === */}
                {editingTodo && (
                    <>
                        {/* 🛡️ 防禦 2 (Scroll Locking)：遮罩阻斷點擊與觸控滑動 (touch-none overscroll-none)，並設定 z-[45] */}
                        <div className="absolute inset-0 bg-black/30 z-[45] animate-in fade-in overscroll-none touch-none" onClick={() => saveEditingTodo()} />
                        
                        {/* 🛡️ 防禦 3 (Date Picker Fix)：面板拉高到 z-50 */}
                        <div className="absolute bottom-0 left-0 right-0 bg-white z-50 rounded-t-[32px] shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[85%] overscroll-contain">
                            
                            {/* Sheet Header */}
                            <div className="flex justify-between items-center p-4 px-6 border-b border-gray-100">
                                <span className="text-sm font-bold text-gray-400">詳細設定</span>
                                <button onClick={saveEditingTodo} className="text-sm font-bold text-[#45846D] bg-[#45846D]/10 px-4 py-1.5 rounded-full hover:bg-[#45846D]/20 transition-colors">
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

                                {/* Date & Time Row */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" /> 日期
                                        </label>
                                        {/* 🛡️ 防禦 3 (Date Picker Fix)：強制 appearance-none，避免各家手機原生樣式破圖 */}
                                        <input 
                                            type="date"
                                            value={editingTodo.date || ''}
                                            onChange={(e) => setEditingTodo({ ...editingTodo, date: e.target.value })}
                                            className="w-full bg-white text-sm font-bold text-[#1D1D1B] p-3 rounded-2xl outline-none border border-gray-200 focus:border-[#45846D] transition-colors appearance-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> 時間
                                        </label>
                                        {/* 🛡️ 防禦 3 (Date Picker Fix)：強制 appearance-none */}
                                        <input 
                                            type="time"
                                            value={editingTodo.time || ''}
                                            onChange={(e) => setEditingTodo({ ...editingTodo, time: e.target.value })}
                                            className="w-full bg-white text-sm font-bold text-[#1D1D1B] p-3 rounded-2xl outline-none border border-gray-200 focus:border-[#45846D] transition-colors appearance-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Sheet Footer (Delete) */}
                            <div className="p-4 bg-white border-t border-gray-100 mt-auto pb-8">
                                <button 
                                    onClick={() => deleteTodo(editingTodo.id)}
                                    className="w-full py-3 bg-white border border-red-100 text-red-500 rounded-xl text-sm font-bold shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:bg-red-50"
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