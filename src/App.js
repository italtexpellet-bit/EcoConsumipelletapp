import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, deleteDoc } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Home, PlusCircle, BarChart3, Settings, Flame, Droplet, Zap, Euro, Trash2, Calendar, CheckCircle2 } from 'lucide-react';

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyC421J8ecnxQgfIch5JkGY8DSMS1CHS96c",
  authDomain: "eco-consumi-pellet.firebaseapp.com",
  projectId: "eco-consumi-pellet",
  storageBucket: "eco-consumi-pellet.firebasestorage.app",
  messagingSenderId: "918115076286",
  appId: "1:918115076286:web:6e048a1df600496ccaf6ef"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'eco-consumi-pellet';

// --- Default Settings ---
const DEFAULT_SETTINGS = {
  bagWeight: 15,
  pelletEnergy: 4.8,
  gasEnergy: 10.5,
  pelletPrice: 6.5,
  gasPrice: 1.2,
  systems: ['Stufa Salotto']
};

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedHouse, setSelectedHouse] = useState('Casa Mia');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  // --- Authentication ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth error:", error);
        setAuthError(true);
        setLoading(false);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // --- Data Fetching ---
  useEffect(() => {
    if (!user) return;

    // Fetch Settings
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'pelletSettings', 'global');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      } else {
        // Initialize settings if they don't exist
        setDoc(settingsRef, DEFAULT_SETTINGS).catch(console.error);
      }
    }, (error) => console.error("Error fetching settings:", error));

    // Fetch Logs
    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'pelletLogs');
    const unsubLogs = onSnapshot(logsRef, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in memory (newest first)
      logsData.sort((a, b) => new Date(b.date) - new Date(a.date));
      setLogs(logsData);
      setLoading(false);
    }, (error) => console.error("Error fetching logs:", error));

    return () => {
      unsubSettings();
      unsubLogs();
    };
  }, [user]);

  // --- Handlers ---
  const handleUpdateSettings = async (newSettings) => {
    if (!user) return;
    try {
      const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'pelletSettings', 'global');
      await setDoc(settingsRef, newSettings);
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const handleAddLog = async (logData) => {
    if (!user) return;
    try {
      const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'pelletLogs');
      await addDoc(logsRef, { ...logData, createdAt: new Date().toISOString() });
    } catch (error) {
      console.error("Error adding log:", error);
    }
  };

  const handleDeleteLog = async (logId) => {
      if (!user) return;
      try {
          const logRef = doc(db, 'artifacts', appId, 'public', 'data', 'pelletLogs', logId);
          await deleteDoc(logRef);
      } catch (error) {
          console.error("Error deleting log:", error);
      }
  }

  // --- Derived Data for Dashboard ---
  const filteredLogs = useMemo(() => {
    // Filtra i log per la casa selezionata (assegna 'Casa Mia' ai vecchi log senza casa)
    return logs.filter(log => log.house === selectedHouse || (!log.house && selectedHouse === 'Casa Mia'));
  }, [logs, selectedHouse]);

  const currentMonthLogs = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return filteredLogs.filter(log => {
      const logDate = new Date(log.date);
      return logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear;
    });
  }, [filteredLogs]);

  const dashboardStats = useMemo(() => {
    const totalBags = currentMonthLogs.reduce((sum, log) => sum + Number(log.bags), 0);
    const totalKg = totalBags * Number(settings.bagWeight);
    const totalKWh = totalKg * Number(settings.pelletEnergy);
    
    const pelletCost = totalBags * Number(settings.pelletPrice);
    
    // Gas equivalent calculation
    const equivalentGasSm3 = totalKWh / Number(settings.gasEnergy);
    const gasCost = equivalentGasSm3 * Number(settings.gasPrice);
    
    const savings = gasCost - pelletCost;

    return { totalBags, totalKg, totalKWh, pelletCost, gasCost, savings };
  }, [currentMonthLogs, settings]);


  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <Flame className="animate-pulse text-orange-500 h-12 w-12" />
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex flex-col h-screen w-full items-center justify-center bg-slate-50 p-6 text-center text-slate-800">
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-2xl max-w-md shadow-sm">
          <h2 className="font-bold text-xl mb-3 flex items-center justify-center gap-2">
            <Flame className="text-red-500" /> Errore Firebase
          </h2>
          <p className="mb-5 text-sm font-medium">L'accesso Anonimo non è ancora abilitato.</p>
          <div className="text-left text-sm bg-white p-4 rounded-xl border border-red-100 shadow-inner">
            <ol className="list-decimal pl-4 space-y-3 font-medium text-slate-700">
              <li>Vai su <a href="https://console.firebase.google.com" target="_blank" className="text-blue-600 underline">console.firebase.google.com</a></li>
              <li>Entra nel progetto <b>eco-consumi-pellet</b></li>
              <li>A sinistra clicca su <b>Authentication</b> (se non c'è, cercalo sotto "Build" / "Creazione").</li>
              <li>Clicca su <b>Inizia</b>.</li>
              <li>Vai nella scheda <b>Sign-in method</b> (Metodo di accesso).</li>
              <li>Clicca su <b>Aggiungi nuovo provider</b> e seleziona <b>Anonimo</b>.</li>
              <li>Attiva l'interruttore e clicca <b>Salva</b>.</li>
            </ol>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors"
          >
            Ho fatto, Ricarica App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-800 font-sans pb-16 overflow-hidden">
      {/* Header */}
      <header className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-4 shadow-md z-10 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-6 w-6" />
            <h1 className="text-xl font-bold tracking-wide">EcoPellet</h1>
          </div>
          <select
            value={selectedHouse}
            onChange={(e) => setSelectedHouse(e.target.value)}
            className="bg-white/20 text-white border border-white/30 rounded-lg px-3 py-1.5 text-sm font-semibold outline-none focus:bg-white focus:text-orange-600 transition-colors appearance-none cursor-pointer"
          >
            <option value="Casa Mia" className="text-slate-800">🏠 Casa Mia</option>
            <option value="Casa Papà" className="text-slate-800">🏡 Casa Papà</option>
          </select>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activeTab === 'dashboard' && <DashboardTab stats={dashboardStats} settings={settings} logs={filteredLogs} house={selectedHouse} />}
        {activeTab === 'add' && <AddTab settings={settings} onAddLog={handleAddLog} setActiveTab={setActiveTab} house={selectedHouse} />}
        {activeTab === 'charts' && <ChartsTab logs={filteredLogs} />}
        {activeTab === 'settings' && <SettingsTab settings={settings} onUpdateSettings={handleUpdateSettings} logs={filteredLogs} onDeleteLog={handleDeleteLog} />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          <NavItem icon={<Home />} label="Riepilogo" isActive={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<PlusCircle />} label="Aggiungi" isActive={activeTab === 'add'} onClick={() => setActiveTab('add')} />
          <NavItem icon={<BarChart3 />} label="Grafici" isActive={activeTab === 'charts'} onClick={() => setActiveTab('charts')} />
          <NavItem icon={<Settings />} label="Impostazioni" isActive={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </div>
      </nav>
    </div>
  );
}

// --- Tab Components ---

function DashboardTab({ stats, settings, logs, house }) {
    const isPositiveSavings = stats.savings >= 0;

    return (
        <div className="space-y-6 max-w-lg mx-auto pb-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">Riepilogo Mese</h2>
                <span className="bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full">{house}</span>
            </div>
            
            {/* Quick Stats Row */}
            <div className="grid grid-cols-3 gap-3">
                <StatBox icon={<span className="font-bold text-xl block">🛍️</span>} value={stats.totalBags} label="Sacchi" color="bg-orange-100 text-orange-800" />
                <StatBox icon={<Flame size={20}/>} value={`${stats.totalKg} kg`} label="Consumati" color="bg-red-100 text-red-800" />
                <StatBox icon={<Zap size={20}/>} value={`${stats.totalKWh.toFixed(1)}`} label="kWh" color="bg-yellow-100 text-yellow-800" />
            </div>

            {/* Savings Card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                    <Euro className="text-emerald-500" />
                    <h3 className="font-semibold text-lg">Risparmio vs Gas</h3>
                </div>
                
                <div className="space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                        <div className="text-slate-500 text-sm flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-orange-400 block"></span>
                            Costo Pellet
                        </div>
                        <div className="font-semibold">€ {stats.pelletCost.toFixed(2)}</div>
                    </div>
                    
                    <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                        <div className="text-slate-500 text-sm flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-blue-400 block"></span>
                            Costo Equivalente Gas
                            <span className="text-xs text-slate-400 ml-1">({(stats.totalKWh / (settings.gasEnergy || 1)).toFixed(1)} Sm3)</span>
                        </div>
                        <div className="font-semibold">€ {stats.gasCost.toFixed(2)}</div>
                    </div>

                    <div className="pt-2">
                        <div className={`p-4 rounded-xl flex items-center justify-between ${isPositiveSavings ? 'bg-emerald-50' : 'bg-red-50'}`}>
                            <span className={`font-medium ${isPositiveSavings ? 'text-emerald-700' : 'text-red-700'}`}>
                                {isPositiveSavings ? 'Risparmio Netto' : 'Perdita Netta'}
                            </span>
                            <span className={`text-2xl font-bold ${isPositiveSavings ? 'text-emerald-600' : 'text-red-600'}`}>
                                {isPositiveSavings ? '+' : ''}€ {stats.savings.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Activity Mini-List */}
            <div>
                <h3 className="font-semibold text-lg mb-3 mt-6 text-slate-700">Ultimi Carichi</h3>
                {logs.slice(0, 3).length > 0 ? (
                    <div className="space-y-2">
                        {logs.slice(0, 3).map(log => (
                            <div key={log.id} className="bg-white p-3 rounded-xl shadow-sm border border-slate-50 flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="font-medium text-slate-800">{new Date(log.date).toLocaleDateString('it-IT')}</span>
                                    <span className="text-xs text-slate-500">{log.system}</span>
                                </div>
                                <div className="bg-orange-100 text-orange-700 px-3 py-1 rounded-lg font-bold">
                                    {log.bags} {log.bags === 1 ? 'sacco' : 'sacchi'}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-slate-500 text-sm italic">Nessun carico registrato.</p>
                )}
            </div>
        </div>
    );
}

function AddTab({ settings, onAddLog, setActiveTab, house }) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [system, setSystem] = useState(settings.systems[0] || '');
    const [bags, setBags] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!date || !system || !bags || isNaN(bags)) return;
        
        onAddLog({
            date,
            system,
            bags: Number(bags),
            house // Aggiunto identificatore casa al database
        });
        
        setBags('');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2500);
    };

    return (
        <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Nuovo Carico</h2>
                <span className="bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full">{house}</span>
            </div>
            
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-5">
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                        <input 
                            type="date" 
                            required
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Impianto</label>
                    <select 
                        required
                        value={system}
                        onChange={(e) => setSystem(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all appearance-none"
                    >
                        <option value="" disabled>Seleziona un impianto</option>
                        {settings.systems.map((sys, idx) => (
                            <option key={idx} value={sys}>{sys}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Numero di Sacchi</label>
                    <input 
                        type="number" 
                        required
                        min="0.5"
                        step="0.5"
                        placeholder="Es. 1 o 1.5"
                        value={bags}
                        onChange={(e) => setBags(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-semibold focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                    />
                </div>

                <button 
                    type="submit"
                    className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] flex justify-center items-center gap-2"
                >
                    <PlusCircle size={20} />
                    Registra Consumo
                </button>
                
                {showSuccess && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 py-2 rounded-lg font-medium">
                        <CheckCircle2 size={18} /> Aggiunto con successo!
                    </div>
                )}
            </form>
        </div>
    );
}

function ChartsTab({ logs }) {
    const [viewType, setViewType] = useState('monthly'); // 'monthly' | 'weekly'

    const chartData = useMemo(() => {
        const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        let dataMap = monthNames.map((name, index) => ({ name, monthIndex: index }));
        let availableYears = new Set();

        logs.forEach(log => {
            const d = new Date(log.date);
            const month = d.getMonth();
            const year = d.getFullYear().toString();
            availableYears.add(year);
            
            if (!dataMap[month][year]) {
                dataMap[month][year] = 0;
            }
            dataMap[month][year] += Number(log.bags);
        });

        return { data: dataMap, years: Array.from(availableYears).sort() };
    }, [logs]);

    const weeklyData = useMemo(() => {
        // Raggruppamento per settimana (ultime 12 settimane registrate)
        const getWeekNumber = (d) => {
            const date = new Date(d.getTime());
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
            const week1 = new Date(date.getFullYear(), 0, 4);
            return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
        };

        let weeksMap = {};
        logs.forEach(log => {
            const d = new Date(log.date);
            const year = d.getFullYear();
            const week = getWeekNumber(d);
            const key = `${year}-W${week.toString().padStart(2, '0')}`;
            
            if (!weeksMap[key]) {
                weeksMap[key] = { name: key, bags: 0 };
            }
            weeksMap[key].bags += Number(log.bags);
        });

        const sortedWeeks = Object.values(weeksMap).sort((a, b) => a.name.localeCompare(b.name));
        return { data: sortedWeeks.slice(-12) }; // Prende le ultime 12 settimane
    }, [logs]);

    const colors = ['#f97316', '#ef4444', '#f59e0b', '#8b5cf6', '#3b82f6'];

    return (
        <div className="max-w-3xl mx-auto h-full flex flex-col pb-4">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Analisi Consumi</h2>

            {/* Toggle Mensile/Settimanale */}
            <div className="flex bg-slate-200 p-1 rounded-xl mb-6">
                <button 
                    onClick={() => setViewType('monthly')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${viewType === 'monthly' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Mensile
                </button>
                <button 
                    onClick={() => setViewType('weekly')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${viewType === 'weekly' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Settimanale
                </button>
            </div>
            
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex-1 min-h-[400px]">
                <h3 className="text-sm font-semibold text-slate-500 mb-4 text-center">
                    {viewType === 'monthly' ? 'Comparazione Annuale (Sacchi)' : 'Andamento Ultime Settimane (Sacchi)'}
                </h3>
                
                {viewType === 'monthly' && chartData.data.length > 0 && chartData.years.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData.data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                            <Tooltip 
                                cursor={{fill: '#f1f5f9'}}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            {chartData.years.map((year, index) => (
                                <Bar key={year} dataKey={year} fill={colors[index % colors.length]} radius={[4, 4, 0, 0]} maxBarSize={40} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                ) : viewType === 'weekly' && weeklyData.data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyData.data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                            <Tooltip 
                                cursor={{fill: '#f1f5f9'}}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value) => [`${value} sacchi`, 'Totale']}
                            />
                            <Bar dataKey="bags" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={40} name="Sacchi Consumati" />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">
                        Nessun dato sufficiente per i grafici
                    </div>
                )}
            </div>
        </div>
    );
}

function SettingsTab({ settings, onUpdateSettings, logs, onDeleteLog }) {
    const [localSettings, setLocalSettings] = useState(settings);
    const [newSystem, setNewSystem] = useState('');
    const [saveStatus, setSaveStatus] = useState('');

    // Sincronizza i setting locali se quelli dal DB cambiano (es. un altro utente li aggiorna)
    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleSave = () => {
        onUpdateSettings(localSettings);
        setSaveStatus('Salvato!');
        setTimeout(() => setSaveStatus(''), 2000);
    };

    const handleAddSystem = () => {
        if (newSystem.trim() && !localSettings.systems.includes(newSystem.trim())) {
            const updated = { ...localSettings, systems: [...localSettings.systems, newSystem.trim()] };
            setLocalSettings(updated);
            onUpdateSettings(updated);
            setNewSystem('');
        }
    };

    const handleRemoveSystem = (sysToRemove) => {
        const updated = { ...localSettings, systems: localSettings.systems.filter(s => s !== sysToRemove) };
        setLocalSettings(updated);
        onUpdateSettings(updated);
    };

    return (
        <div className="max-w-md mx-auto space-y-6 pb-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Impostazioni</h2>
                {saveStatus && <span className="text-emerald-600 font-medium text-sm animate-pulse">{saveStatus}</span>}
            </div>

            {/* Impianti */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2"><Flame size={18} className="text-orange-500"/> I Tuoi Impianti</h3>
                <div className="space-y-2 mb-4">
                    {localSettings.systems.map((sys, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-50 p-2 px-3 rounded-lg border border-slate-100">
                            <span className="font-medium text-slate-700">{sys}</span>
                            {localSettings.systems.length > 1 && (
                                <button onClick={() => handleRemoveSystem(sys)} className="text-red-400 hover:text-red-600 p-1">
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="Nuovo impianto..." 
                        value={newSystem}
                        onChange={(e) => setNewSystem(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <button onClick={handleAddSystem} className="bg-slate-800 text-white px-3 py-2 rounded-lg font-medium text-sm">Aggiungi</button>
                </div>
            </div>

            {/* Variabili Energetiche & Costi */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
                 <h3 className="font-semibold text-lg mb-2 flex items-center gap-2"><Settings size={18} className="text-slate-500"/> Variabili di Calcolo</h3>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <SettingInput 
                        label="Peso Sacco (kg)" 
                        value={localSettings.bagWeight} 
                        onChange={(val) => setLocalSettings({...localSettings, bagWeight: val})} 
                    />
                    <SettingInput 
                        label="Costo Pellet (€/sacco)" 
                        value={localSettings.pelletPrice} 
                        onChange={(val) => setLocalSettings({...localSettings, pelletPrice: val})} 
                    />
                    <SettingInput 
                        label="Resa Pellet (kWh/kg)" 
                        value={localSettings.pelletEnergy} 
                        onChange={(val) => setLocalSettings({...localSettings, pelletEnergy: val})} 
                    />
                    <SettingInput 
                        label="Resa Gas (kWh/Sm3)" 
                        value={localSettings.gasEnergy} 
                        onChange={(val) => setLocalSettings({...localSettings, gasEnergy: val})} 
                    />
                    <div className="col-span-2">
                        <SettingInput 
                            label="Costo Gas Stimato (€/Sm3)" 
                            value={localSettings.gasPrice} 
                            onChange={(val) => setLocalSettings({...localSettings, gasPrice: val})} 
                        />
                    </div>
                 </div>

                 <button 
                    onClick={handleSave}
                    className="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl transition-all"
                >
                    Salva Variabili
                </button>
            </div>

             {/* Storico Dati (Gestione base) */}
             <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2"><Trash2 size={18} className="text-red-500"/> Gestione Storico Dati</h3>
                <p className="text-xs text-slate-500 mb-3">Tocca un record per eliminarlo (mostrati solo gli ultimi 5).</p>
                <div className="space-y-2">
                    {logs.slice(0, 5).map(log => (
                        <div key={log.id} className="flex justify-between items-center bg-slate-50 p-2 px-3 rounded-lg border border-slate-100">
                             <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-700">{new Date(log.date).toLocaleDateString('it-IT')}</span>
                                <span className="text-xs text-slate-400">{log.bags} sacchi - {log.system}</span>
                            </div>
                            <button onClick={() => { if(window.confirm('Eliminare questo record?')) onDeleteLog(log.id) }} className="text-red-400 hover:text-red-600 p-2">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    {logs.length === 0 && <p className="text-sm text-slate-400">Nessun dato presente.</p>}
                </div>
            </div>
        </div>
    );
}


// --- Utility Components ---

function NavItem({ icon, label, isActive, onClick }) {
  return (
    <button 
        onClick={onClick} 
        className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
    >
      {React.cloneElement(icon, { size: 24, className: isActive ? 'stroke-[2.5px]' : 'stroke-2' })}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function StatBox({ icon, value, label, color }) {
    return (
        <div className={`${color} p-3 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm`}>
            <div className="mb-1 opacity-80">{icon}</div>
            <div className="font-bold text-lg leading-tight">{value}</div>
            <div className="text-[10px] uppercase font-semibold tracking-wider opacity-70 mt-1">{label}</div>
        </div>
    );
}

function SettingInput({ label, value, onChange }) {
    return (
        <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-500 mb-1">{label}</label>
            <input 
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
            />
        </div>
    );
}