import React, { useState, useRef, useEffect } from 'react';
import { Languages, DollarSign, Bus, Send, RefreshCw, AlertCircle, Calculator, Phone, Thermometer, Image as ImageIcon, Upload, Mic, ExternalLink, Zap, ArrowRight, ArrowLeftRight, Ruler, Gauge, Weight, Plug, Siren, Plus, Ambulance, Backpack, CheckCircle, Circle, Trash2, Shirt, Smartphone, Briefcase, Bath, Package } from 'lucide-react';
import { IOSHeader, IOSButton, IOSInput } from '../components/UI';
import { translateText, getCurrencyRate, getLocalEmergencyInfo, getPlugInfo } from '../services/gemini';
import { ToolType, type VoltageInfo, type ChecklistItem, type ChecklistCategory } from '../types';

interface ToolsViewProps {
    onUpdateBackground?: (image: string) => void;
}

export const ToolsView: React.FC<ToolsViewProps> = ({ onUpdateBackground }) => {
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);

  const renderToolContent = () => {
    switch(activeTool) {
      case ToolType.TRANSLATE:
        return <TranslateTool onBack={() => setActiveTool(null)} />;
      case ToolType.CURRENCY:
        return <CurrencyTool onBack={() => setActiveTool(null)} />;
      case ToolType.LOCAL_TRANSPORT:
        return <TransportTool onBack={() => setActiveTool(null)} />;
      case ToolType.EMERGENCY:
        return <EmergencyTool onBack={() => setActiveTool(null)} />;
      case ToolType.UNIT_CONVERT:
        return <UnitConverterTool onBack={() => setActiveTool(null)} />;
      case ToolType.VOLTAGE:
        return <VoltageTool onBack={() => setActiveTool(null)} />;
      case ToolType.BACKGROUND:
        return <BackgroundTool onBack={() => setActiveTool(null)} onUpdate={onUpdateBackground} />;
      case ToolType.PACKING_LIST:
        return <PackingListTool onBack={() => setActiveTool(null)} />;
      default:
        return null;
    }
  };

  if (activeTool) {
    return <div className="min-h-screen bg-ios-bg/95 backdrop-blur-xl pb-24 animate-in slide-in-from-right duration-300 z-50 fixed inset-0 overflow-y-auto">{renderToolContent()}</div>;
  }

  return (
    <div className="min-h-screen pb-24">
      <IOSHeader title="工具箱" />
      <div className="px-5 mt-6 grid grid-cols-2 gap-4">
        <ToolCard 
          icon={<Backpack className="w-7 h-7 text-white" />} 
          color="bg-blue-500" 
          title="行李清單" 
          onClick={() => setActiveTool(ToolType.PACKING_LIST)} 
        />
        <ToolCard 
          icon={<Languages className="w-7 h-7 text-white" />} 
          color="bg-orange-500" 
          title="翻譯" 
          onClick={() => setActiveTool(ToolType.TRANSLATE)} 
        />
        <ToolCard 
          icon={<DollarSign className="w-7 h-7 text-white" />} 
          color="bg-green-500" 
          title="匯率" 
          onClick={() => setActiveTool(ToolType.CURRENCY)} 
        />
        <ToolCard 
          icon={<Bus className="w-7 h-7 text-white" />} 
          color="bg-indigo-500" 
          title="交通" 
          onClick={() => setActiveTool(ToolType.LOCAL_TRANSPORT)} 
        />
        <ToolCard 
          icon={<Zap className="w-7 h-7 text-white" />} 
          color="bg-yellow-500" 
          title="電壓插座" 
          onClick={() => setActiveTool(ToolType.VOLTAGE)} 
        />
        <ToolCard 
          icon={<Calculator className="w-7 h-7 text-white" />} 
          color="bg-gray-500" 
          title="單位換算" 
          onClick={() => setActiveTool(ToolType.UNIT_CONVERT)} 
        />
        <ToolCard 
          icon={<AlertCircle className="w-7 h-7 text-white" />} 
          color="bg-red-500" 
          title="緊急求助" 
          onClick={() => setActiveTool(ToolType.EMERGENCY)} 
        />
         <ToolCard 
          icon={<ImageIcon className="w-7 h-7 text-white" />} 
          color="bg-purple-500" 
          title="更換背景" 
          onClick={() => setActiveTool(ToolType.BACKGROUND)} 
        />
      </div>
    </div>
  );
};

const ToolCard: React.FC<{ icon: React.ReactNode, color: string, title: string, onClick: () => void }> = ({ icon, color, title, onClick }) => (
  <button onClick={onClick} className="bg-white/90 backdrop-blur-md p-5 rounded-3xl shadow-sm active:scale-95 transition-all cursor-pointer h-32 flex flex-col justify-between items-start border border-white/40 group hover:shadow-md">
    <div className={`${color} w-10 h-10 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300`}>
      {icon}
    </div>
    <span className="font-semibold text-base text-gray-900">{title}</span>
  </button>
);

const ToolLayout: React.FC<{ title: string, onBack: () => void, children: React.ReactNode, darkHeader?: boolean }> = ({ title, onBack, children, darkHeader }) => (
  <>
    <div className={`pt-12 px-4 flex items-center mb-4 pb-4 sticky top-0 z-40 border-b transition-colors ${darkHeader ? 'bg-black/20 backdrop-blur-xl border-white/10 text-white' : 'bg-white/80 backdrop-blur-xl border-gray-200/50 text-gray-900'}`}>
      <button 
        onClick={onBack} 
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${darkHeader ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}
      >
        <ArrowRight className="w-5 h-5 rotate-180" />
      </button>
      <h2 className="font-bold text-xl ml-4">{title}</h2>
    </div>
    <div className="px-5 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10 relative z-0">{children}</div>
  </>
);

// --- Packing List Tool (New!) ---

const PackingListTool: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const defaultItems: ChecklistItem[] = [
        { id: '1', text: '護照', checked: false, category: 'documents' },
        { id: '2', text: '簽證影本', checked: false, category: 'documents' },
        { id: '3', text: '機票證明', checked: false, category: 'documents' },
        { id: '4', text: '外幣/信用卡', checked: false, category: 'documents' },
        { id: '5', text: '換洗衣物', checked: false, category: 'clothes' },
        { id: '6', text: '保暖外套', checked: false, category: 'clothes' },
        { id: '7', text: '牙刷牙膏', checked: false, category: 'toiletries' },
        { id: '8', text: '手機充電器', checked: false, category: 'gadgets' },
        { id: '9', text: '行動電源', checked: false, category: 'gadgets' },
        { id: '10', text: '轉接頭', checked: false, category: 'gadgets' },
    ];

    const [items, setItems] = useState<ChecklistItem[]>(() => {
        const saved = localStorage.getItem('voyage_packing_list');
        return saved ? JSON.parse(saved) : defaultItems;
    });
    const [newItem, setNewItem] = useState('');
    const [activeCategory, setActiveCategory] = useState<ChecklistCategory>('documents');

    useEffect(() => {
        localStorage.setItem('voyage_packing_list', JSON.stringify(items));
    }, [items]);

    const toggleCheck = (id: string) => {
        setItems(items.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
    };

    const deleteItem = (id: string) => {
        if(confirm('確定刪除此項目？')) {
            setItems(items.filter(i => i.id !== id));
        }
    };

    const addItem = () => {
        if (!newItem.trim()) return;
        const item: ChecklistItem = {
            id: Date.now().toString(),
            text: newItem,
            checked: false,
            category: activeCategory
        };
        setItems([...items, item]);
        setNewItem('');
    };

    const progress = Math.round((items.filter(i => i.checked).length / items.length) * 100) || 0;

    const categories: { id: ChecklistCategory, label: string, icon: any }[] = [
        { id: 'documents', label: '必備證件', icon: Briefcase },
        { id: 'clothes', label: '衣物穿搭', icon: Shirt },
        { id: 'toiletries', label: '盥洗/藥品', icon: Bath },
        { id: 'gadgets', label: '3C 電子', icon: Smartphone },
        { id: 'others', label: '其他小物', icon: Package },
    ];

    return (
        <ToolLayout title="行李清單" onBack={onBack}>
            {/* Progress Card */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-xs font-bold text-gray-400 uppercase">準備進度</span>
                    <span className="text-2xl font-bold text-ios-blue">{progress}%</span>
                </div>
                <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-ios-blue transition-all duration-500 ease-out" 
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Categories & Items */}
            <div className="space-y-6">
                {categories.map(cat => {
                    const catItems = items.filter(i => i.category === cat.id);
                    const completedCount = catItems.filter(i => i.checked).length;
                    
                    return (
                        <div key={cat.id} className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
                            <div className="bg-gray-50 px-5 py-3 flex justify-between items-center">
                                <div className="flex items-center gap-2 font-bold text-gray-900">
                                    <cat.icon className="w-4 h-4 text-gray-500" />
                                    {cat.label}
                                </div>
                                <span className="text-xs bg-white px-2 py-0.5 rounded-full text-gray-400 border">
                                    {completedCount}/{catItems.length}
                                </span>
                            </div>
                            
                            <div className="p-2">
                                {catItems.map(item => (
                                    <div 
                                        key={item.id} 
                                        className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors group"
                                    >
                                        <button 
                                            onClick={() => toggleCheck(item.id)}
                                            className="flex items-center gap-3 flex-1 text-left"
                                        >
                                            {item.checked ? (
                                                <CheckCircle className="w-6 h-6 text-ios-blue fill-blue-100" />
                                            ) : (
                                                <Circle className="w-6 h-6 text-gray-300" />
                                            )}
                                            <span className={`text-base ${item.checked ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                                {item.text}
                                            </span>
                                        </button>
                                        <button 
                                            onClick={() => deleteItem(item.id)}
                                            className="text-gray-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                
                                {/* Add Item Row */}
                                <div className="flex items-center gap-2 p-2 mt-1 border-t border-dashed border-gray-100">
                                    <Plus className="w-4 h-4 text-gray-400 ml-2" />
                                    <input 
                                        type="text" 
                                        placeholder="新增項目..."
                                        className="flex-1 bg-transparent outline-none text-sm py-2"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                setNewItem(e.currentTarget.value);
                                                setActiveCategory(cat.id);
                                                // Hack to trigger state update in next tick
                                                setTimeout(() => {
                                                    // Logic inside input onChange is better but this is quick for multiple inputs
                                                    const val = e.currentTarget.value;
                                                    if(val) {
                                                        setItems(prev => [...prev, {
                                                            id: Date.now().toString(),
                                                            text: val,
                                                            checked: false,
                                                            category: cat.id
                                                        }]);
                                                        e.currentTarget.value = '';
                                                    }
                                                }, 0);
                                            }
                                        }}
                                    />
                                    <button className="text-xs text-ios-blue font-bold px-2">Enter</button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </ToolLayout>
    );
};

// --- Existing Tools ---

const VoltageTool: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [country, setCountry] = useState('');
    const [info, setInfo] = useState<VoltageInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const fetchInfo = async () => {
        if(!country) return;
        setLoading(true);
        const res = await getPlugInfo(country);
        setInfo(res);
        setLoading(false);
    };

    return (
        <ToolLayout title="電壓與插座" onBack={onBack}>
            <div className="bg-yellow-50 rounded-3xl p-6 border border-yellow-100 mb-6">
                 <p className="text-yellow-800 text-sm mb-4 font-medium">輸入國家查詢當地電壓、頻率與插座。</p>
                 <div className="flex gap-2">
                    <IOSInput 
                        placeholder="例如：韓國" 
                        value={country} 
                        onChange={e => setCountry(e.target.value)}
                        className="bg-white border-none shadow-sm"
                    />
                    <IOSButton onClick={fetchInfo} isLoading={loading} className="!bg-yellow-500 !text-white shadow-md shadow-yellow-200 w-24">
                        查詢
                    </IOSButton>
                </div>
            </div>

            {info && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="grid grid-cols-2 gap-4">
                         <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
                             <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-100 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                             <span className="text-xs font-bold text-gray-400 uppercase block mb-1">電壓</span>
                             <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-gray-900">{info.voltage.replace(/\D/g,'')}</span>
                                <span className="text-sm font-medium text-gray-500">V</span>
                             </div>
                         </div>
                         <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
                             <div className="absolute top-0 right-0 w-16 h-16 bg-orange-100 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                             <span className="text-xs font-bold text-gray-400 uppercase block mb-1">頻率</span>
                             <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-gray-900">{info.frequency.replace(/\D/g,'')}</span>
                                <span className="text-sm font-medium text-gray-500">Hz</span>
                             </div>
                         </div>
                    </div>

                    <div className="bg-gray-900 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
                        <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">插座類型</h3>
                        <div className="flex gap-4">
                            {info.plugTypes.map((type, idx) => (
                                <div key={idx} className="flex flex-col items-center">
                                    <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 mb-2">
                                        <Plug className="w-7 h-7 text-yellow-400" />
                                    </div>
                                    <span className="font-bold text-lg">Type {type}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-gray-100 flex gap-3">
                         <div className="shrink-0 bg-yellow-100 p-2 rounded-full h-fit">
                            <Zap className="w-4 h-4 text-yellow-600" />
                         </div>
                         <p className="text-sm text-gray-600 leading-relaxed font-medium mt-1">
                             {info.description}
                         </p>
                    </div>
                </div>
            )}
        </ToolLayout>
    );
};

const UnitConverterTool: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState<'weight' | 'temp' | 'distance' | 'speed'>('weight');
    const [val, setVal] = useState<string>('');
    const units = {
        weight: { input: '公斤 (kg)', output: '磅 (lb)', rate: 2.20462, symbol: 'kg' },
        temp: { input: '攝氏 (°C)', output: '華氏 (°F)', symbol: '°C' },
        distance: { input: '公里 (km)', output: '英里 (mi)', rate: 0.621371, symbol: 'km' },
        speed: { input: 'km/h', output: 'mph', rate: 0.621371, symbol: 'km/h' }
    };
    const currentUnit = units[activeTab];
    const num = parseFloat(val);
    let result = '---';
    if (!isNaN(num)) {
        if (activeTab === 'temp') {
            result = ((num * 9/5) + 32).toFixed(1);
        } else {
            result = (num * (currentUnit as any).rate).toFixed(2);
        }
    }

    return (
        <ToolLayout title="單位換算" onBack={onBack}>
             <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-tr from-blue-200/40 to-pink-200/40 rounded-full blur-[100px] pointer-events-none -z-10"></div>

            <div className="bg-white/40 backdrop-blur-xl p-1.5 rounded-2xl flex mb-8 border border-white/50 shadow-sm relative z-10">
                {[
                    { id: 'weight', label: '重量', icon: <Weight className="w-4 h-4" /> },
                    { id: 'temp', label: '溫度', icon: <Thermometer className="w-4 h-4" /> },
                    { id: 'distance', label: '距離', icon: <Ruler className="w-4 h-4" /> },
                    { id: 'speed', label: '速度', icon: <Gauge className="w-4 h-4" /> },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id as any); setVal(''); }}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl text-xs font-bold transition-all duration-300 ${activeTab === tab.id ? 'bg-white/80 shadow-md text-ios-blue scale-100 backdrop-blur-md' : 'text-gray-500 scale-95 hover:text-gray-700 hover:bg-white/20'}`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            <div className="space-y-4 relative z-10">
                <div className="bg-white/60 backdrop-blur-xl p-8 rounded-[32px] shadow-sm border border-white/60 relative group transition-all focus-within:bg-white/80 focus-within:shadow-md focus-within:scale-[1.02] duration-300">
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2 tracking-wider">{currentUnit.input}</label>
                    <div className="flex items-center">
                        <input 
                            type="number" 
                            value={val} 
                            onChange={e => setVal(e.target.value)} 
                            placeholder="0" 
                            className="w-full text-6xl font-extralight text-gray-900 bg-transparent outline-none placeholder-gray-300"
                            autoFocus
                        />
                         <span className="text-lg font-medium text-gray-400 ml-2 whitespace-nowrap">{currentUnit.symbol}</span>
                    </div>
                </div>

                <div className="flex justify-center -my-2 relative z-10">
                    <div className="bg-white/80 backdrop-blur border border-white p-2 rounded-full shadow-sm text-gray-400">
                        <ArrowLeftRight className="w-5 h-5 rotate-90" />
                    </div>
                </div>

                <div className="bg-gray-900/90 backdrop-blur-xl p-8 rounded-[32px] shadow-xl border border-white/10 text-white relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl"></div>
                     <label className="text-xs font-bold text-gray-400 uppercase block mb-2 tracking-wider">{currentUnit.output}</label>
                     <div className="flex items-center">
                         <span className="text-6xl font-extralight tracking-wide text-white transition-all duration-300 block w-full truncate">
                             {result}
                         </span>
                     </div>
                </div>
            </div>
        </ToolLayout>
    );
};

const BackgroundTool: React.FC<{ onBack: () => void, onUpdate?: (img: string) => void }> = ({ onBack, onUpdate }) => {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                if (onUpdate) onUpdate(result);
                onBack(); 
            };
            reader.readAsDataURL(file);
        }
    };
    return (
        <ToolLayout title="更換背景" onBack={onBack}>
            <div className="bg-white rounded-3xl p-8 shadow-sm text-center border border-gray-100">
                <div className="w-24 h-24 bg-gradient-to-tr from-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 text-purple-600 shadow-inner">
                    <ImageIcon className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold mb-2">自訂旅程氛圍</h3>
                <p className="text-gray-500 mb-8 leading-relaxed">選擇一張您喜愛的風景照片<br/>作為 App 的背景主題。</p>
                
                <label className="block w-full mb-4">
                    <div className="bg-ios-blue text-white font-bold py-4 px-6 rounded-2xl active:scale-95 transition-transform cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
                        <Upload className="w-5 h-5" />
                        從相簿選擇
                    </div>
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
                
                <button 
                    onClick={() => { if(onUpdate) onUpdate(''); onBack(); }}
                    className="text-gray-400 font-medium text-sm py-2 hover:text-gray-600 transition-colors"
                >
                    恢復預設背景
                </button>
            </div>
        </ToolLayout>
    );
};

const TranslateTool: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const handleTranslate = async () => {
    if(!input) return;
    setLoading(true);
    const res = await translateText(input, "繁體中文"); 
    setOutput(res);
    setLoading(false);
  };

  const openGoogleTranslate = () => {
      const url = input 
        ? `https://translate.google.com/?sl=auto&tl=zh-TW&text=${encodeURIComponent(input)}&op=translate`
        : `https://translate.google.com/?sl=auto&tl=zh-TW&op=translate`;
      window.open(url, '_blank');
  };
  return (
    <ToolLayout title="即時翻譯" onBack={onBack}>
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-4">
        <textarea 
          ref={inputRef}
          className="w-full min-h-[140px] resize-none outline-none text-xl p-6 placeholder-gray-300 bg-transparent text-gray-800" 
          placeholder="在此輸入或貼上文字..."
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-t border-gray-100">
             <button 
                onClick={() => inputRef.current?.focus()} 
                className="p-2 text-gray-500 hover:text-ios-blue transition-colors rounded-full hover:bg-blue-50 active:bg-blue-100"
                title="使用鍵盤語音輸入"
             >
                <Mic className="w-6 h-6" />
             </button>
             <div className="flex gap-2">
                 <button 
                    onClick={openGoogleTranslate}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 text-xs font-semibold"
                 >
                     <ExternalLink className="w-4 h-4" /> Google 翻譯
                 </button>
             </div>
        </div>
      </div>
      
      <IOSButton onClick={handleTranslate} fullWidth isLoading={loading} className="mb-6 shadow-lg shadow-blue-100">
        翻譯成繁體中文
      </IOSButton>

      {output && (
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-3xl shadow-lg shadow-blue-200 animate-in fade-in slide-in-from-bottom-2 text-white">
          <div className="flex items-center gap-2 mb-2 opacity-80 text-sm font-medium">
             <Languages className="w-4 h-4" /> 翻譯結果
          </div>
          <p className="font-medium text-xl leading-relaxed">{output}</p>
        </div>
      )}
    </ToolLayout>
  );
};

const CurrencyTool: React.FC<{ onBack: () => void }> = ({ onBack }) => {
   const [amount, setAmount] = useState('100');
   const [from, setFrom] = useState('USD');
   const [to, setTo] = useState('TWD');
   const [result, setResult] = useState('');
   const [loading, setLoading] = useState(false);
   const convert = async () => {
     setLoading(true);
     const res = await getCurrencyRate(from, to, Number(amount));
     setResult(res);
     setLoading(false);
   }

   return (
    <ToolLayout title="匯率計算" onBack={onBack}>
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4 mb-6">
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
            <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">金額</label>
            <div className="flex items-center gap-2">
                <span className="text-gray-400 font-serif">$</span>
                <input 
                    type="number" 
                    value={amount} 
                    onChange={e => setAmount(e.target.value)} 
                    className="bg-transparent text-3xl font-bold text-gray-900 outline-none w-full"
                    placeholder="100"
                />
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">持有</label>
                <input 
                    value={from} 
                    onChange={e => setFrom(e.target.value.toUpperCase())} 
                    className="bg-transparent font-bold text-xl w-full outline-none uppercase" 
                    placeholder="USD"
                />
            </div>
            <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 shadow-sm z-10 -ml-5 -mr-5">
                <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div className="flex-1 bg-gray-50 rounded-2xl p-4 border border-gray-100 text-right">
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">兌換</label>
                <input 
                    value={to} 
                    onChange={e => setTo(e.target.value.toUpperCase())} 
                    className="bg-transparent font-bold text-xl w-full outline-none uppercase text-right" 
                    placeholder="TWD" 
                />
            </div>
        </div>
        
        <IOSButton onClick={convert} fullWidth isLoading={loading} className="mt-2 shadow-lg shadow-green-100 !bg-green-500 hover:!bg-green-600">
            開始計算
        </IOSButton>
      </div>
      
      {result && (
        <div className="bg-green-500 p-6 rounded-3xl text-center shadow-lg shadow-green-200 text-white animate-in slide-in-from-bottom-2">
            <p className="font-bold text-2xl">{result}</p>
        </div>
      )}
    </ToolLayout>
   )
}

const TransportTool: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    return (
        <ToolLayout title="當地交通" onBack={onBack}>
            <div className="space-y-4">
                <a href="https://www.google.com/maps" target="_blank" rel="noreferrer" className="block group">
                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 transition-all active:scale-95 group-hover:shadow-md">
                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                            <Bus className="w-7 h-7" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-900">Google Maps</h3>
                            <p className="text-gray-500 text-sm">查詢公車、地鐵路線</p>
                        </div>
                        <ExternalLink className="text-gray-300 w-5 h-5" />
                    </div>
                </a>

                <a href="https://m.uber.com" target="_blank" rel="noreferrer" className="block group">
                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 transition-all active:scale-95 group-hover:shadow-md">
                        <div className="w-14 h-14 bg-gray-900 text-white rounded-2xl flex items-center justify-center shrink-0">
                            <span className="font-bold text-xl">U</span>
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-900">Uber</h3>
                            <p className="text-gray-500 text-sm">全球通用的叫車服務</p>
                        </div>
                        <ExternalLink className="text-gray-300 w-5 h-5" />
                    </div>
                </a>
                
                <a href="https://citymapper.com" target="_blank" rel="noreferrer" className="block group">
                     <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 transition-all active:scale-95 group-hover:shadow-md">
                        <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center shrink-0">
                            <MapPin className="w-7 h-7" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-900">Citymapper</h3>
                            <p className="text-gray-500 text-sm">複雜城市的轉乘救星</p>
                        </div>
                        <ExternalLink className="text-gray-300 w-5 h-5" />
                    </div>
                </a>
            </div>
        </ToolLayout>
    )
}

const EmergencyTool: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [location, setLocation] = useState('');
    const [info, setInfo] = useState('');
    const [loading, setLoading] = useState(false);
    const handleSearch = async () => {
        if(!location) return;
        setLoading(true);
        const res = await getLocalEmergencyInfo(location);
        setInfo(res);
        setLoading(false);
    }

    return (
        <ToolLayout title="緊急求助" onBack={onBack}>
            <div className="flex justify-center my-8 relative group">
                <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20"></div>
                <div className="absolute inset-4 bg-red-500 rounded-full animate-ping opacity-20 animation-delay-500"></div>
                
                <a 
                    href="tel:112"
                    className="relative w-48 h-48 bg-gradient-to-br from-red-500 to-red-600 rounded-full shadow-[0_10px_40px_rgba(239,68,68,0.5)] flex flex-col items-center justify-center active:scale-95 transition-transform duration-200 border-4 border-white/20 z-10"
                >
                    <Siren className="w-16 h-16 text-white mb-2 animate-pulse" />
                    <span className="text-3xl font-bold text-white tracking-wider">SOS</span>
                    <span className="text-red-100 text-xs mt-1 font-medium">一鍵報警 (112)</span>
                </a>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                 <div className="bg-white/80 backdrop-blur rounded-3xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
                     <div className="bg-red-100 p-2.5 rounded-xl text-red-600">
                         <Siren className="w-6 h-6" />
                     </div>
                     <div>
                         <div className="text-xs font-bold text-gray-400">警察</div>
                         <div className="text-lg font-bold text-gray-900">110/112</div>
                     </div>
                 </div>
                 <div className="bg-white/80 backdrop-blur rounded-3xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
                     <div className="bg-orange-100 p-2.5 rounded-xl text-orange-600">
                         <Ambulance className="w-6 h-6" />
                     </div>
                     <div>
                         <div className="text-xs font-bold text-gray-400">救護</div>
                         <div className="text-lg font-bold text-gray-900">119</div>
                     </div>
                 </div>
            </div>

            <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    查詢當地緊急資訊
                </h3>
                <div className="flex gap-2 mb-4">
                     <IOSInput 
                        placeholder="輸入城市 (如：巴黎)" 
                        value={location} 
                        onChange={e => setLocation(e.target.value)}
                        className="bg-gray-50 border-none"
                    />
                    <IOSButton onClick={handleSearch} isLoading={loading} className="!bg-gray-900 text-white w-24">查詢</IOSButton>
                </div>
                
                {info && (
                    <div className="bg-gray-50 rounded-2xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap animate-in fade-in">
                        {info}
                    </div>
                )}
            </div>
        </ToolLayout>
    );
};

const MapPin: React.FC<any> = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
);