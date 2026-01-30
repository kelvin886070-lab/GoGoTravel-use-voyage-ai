//行程設定/全域設定
import React, { useState } from 'react';
import { X, Plus, Bell, Share, FileDown, LogOut } from 'lucide-react';
import { IOSInput } from '../../../components/UI';
import type { Trip, Member } from '../../../types';

export const TripSettingsModal: React.FC<{ trip: Trip; onClose: () => void; onUpdate: (t: Trip) => void; onDelete: () => void }> = ({ trip, onClose, onUpdate, onDelete }) => {
    const [dest, setDest] = useState(trip.destination);
    const [members, setMembers] = useState<Member[]>(trip.members || []);
    const [newMemberName, setNewMemberName] = useState('');
    
    // Toggles (Mock state)
    const [alertEnabled, setAlertEnabled] = useState(true);
    const [notifyEnabled, setNotifyEnabled] = useState(false);

    const handleSave = () => { 
        onUpdate({ ...trip, destination: dest, members }); 
        onClose(); 
    };

    const addMember = () => {
        if (!newMemberName.trim()) return;
        setMembers([...members, { id: Date.now().toString(), name: newMemberName.trim() }]);
        setNewMemberName('');
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#1D1D1B]/40 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white w-full max-w-sm rounded-[32px] p-6 relative z-10 animate-in zoom-in-95 shadow-2xl max-h-[85vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-[#1D1D1B]">行程設定</h3>
                    <button onClick={onClose} className="bg-gray-100 p-1.5 rounded-full"><X className="w-4 h-4" /></button>
                </div>
                
                <div className="space-y-6">
                    {/* 1. 目的地 */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">目的地名稱</label>
                        <IOSInput value={dest} onChange={e => setDest(e.target.value)} />
                    </div>

                    {/* 2. 旅伴 */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 mb-2 block uppercase">旅伴成員</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {members.map(m => (
                                <div key={m.id} className="bg-gray-100 pl-3 pr-2 py-1.5 rounded-full flex items-center gap-2">
                                    <span className="text-xs font-bold">{m.name}</span>
                                    <button onClick={() => setMembers(members.filter(x => x.id !== m.id))} className="bg-white rounded-full p-0.5 text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                placeholder="輸入名字..." 
                                className="flex-1 bg-[#F5F5F4] rounded-xl px-4 py-3 text-sm outline-none font-bold"
                                value={newMemberName}
                                onChange={e => setNewMemberName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addMember()}
                            />
                            <button onClick={addMember} className="bg-[#1D1D1B] text-white rounded-xl w-12 flex items-center justify-center"><Plus className="w-5 h-5" /></button>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100" />

                    {/* 3. Toggles */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 text-green-600 rounded-full"><Bell className="w-4 h-4" /></div>
                                <span className="font-bold text-sm">出發提醒</span>
                            </div>
                            <button onClick={() => setAlertEnabled(!alertEnabled)} className={`w-12 h-7 rounded-full p-1 transition-colors ${alertEnabled ? 'bg-[#45846D]' : 'bg-gray-200'}`}>
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${alertEnabled ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-full"><Share className="w-4 h-4" /></div>
                                <span className="font-bold text-sm">行程通知</span>
                            </div>
                            <button onClick={() => setNotifyEnabled(!notifyEnabled)} className={`w-12 h-7 rounded-full p-1 transition-colors ${notifyEnabled ? 'bg-[#45846D]' : 'bg-gray-200'}`}>
                                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${notifyEnabled ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100" />

                    {/* 4. Actions */}
                    <div className="space-y-3">
                        <button className="w-full py-3 rounded-xl border-2 border-gray-100 text-gray-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-50">
                            <FileDown className="w-4 h-4" /> 匯出行程表
                        </button>
                        <button onClick={() => { if(confirm('確定刪除此行程？此動作無法復原。')) onDelete(); }} className="w-full py-3 rounded-xl bg-red-50 text-red-500 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100">
                            <LogOut className="w-4 h-4" /> 刪除行程
                        </button>
                    </div>

                    <button onClick={handleSave} className="w-full py-4 rounded-2xl bg-[#1D1D1B] text-white font-bold text-sm shadow-lg active:scale-95 transition-transform mt-4">
                        儲存設定
                    </button>
                </div>
            </div>
        </div>
    );
};