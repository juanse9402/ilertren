import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { Operation, Train, Profile, Closure, Expense } from '../../types/database';
import {
  Users, Coins, Train as TrainIcon, Loader,
  MapPin, Plus, Edit2, RefreshCw,
  Activity, Clock, UserCheck, ShieldAlert, CheckCircle, AlertCircle,
  Lock, Unlock, Key, X, Calendar, Download, ChevronRight,
  Scale, Camera, ArrowDownRight, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { KPICardSkeleton, TableRowSkeleton, Skeleton } from '../Skeleton';

type Tab = 'overview' | 'flota' | 'choferes';

export function AdminDashboard({ userRole }: { userRole: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [operations, setOperations] = useState<Operation[]>([]);
  const [trains, setTrains] = useState<Train[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Password Modal State
  const [passwordModal, setPasswordModal] = useState<{ isOpen: boolean; profile: Profile | null }>({ isOpen: false, profile: null });
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [updatingPass, setUpdatingPass] = useState(false);

  // Filtro de Fecha Global
  // Filtro de Fecha Global (Uso de fecha Local del Navegador)
  const getLocalDate = () => new Date().toLocaleDateString('en-CA');
  const [dateRange, setDateRange] = useState({
    start: getLocalDate(),
    end: getLocalDate()
  });
  const [preset, setPreset] = useState<'hoy' | 'ayer' | '7d' | 'custom'>('hoy');

  // Filtro de Ciudad Global
  const [selectedCity, setSelectedCity] = useState<string>('Todas');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {

      const { data: oData, error: oError } = await supabase
        .from('operations')
        .select('*')
        .gte('fecha', dateRange.start)
        .lte('fecha', dateRange.end)
        .order('fecha', { ascending: false });

      const { data: tData, error: tError } = await supabase.from('trains').select('*').order('created_at', { ascending: true });
      const { data: pData, error: pError } = await supabase.from('profiles').select('*').order('full_name', { ascending: true });

      if (tError) console.error('Admin Dashboard ERROR (Trains):', tError);
      if (oError) console.error('Admin Dashboard ERROR (Operations):', oError);
      if (pError) console.error('Admin Dashboard ERROR (Profiles):', pError);

      if (oData) {
        setOperations(oData);
      }
      if (tData) setTrains(tData);
      if (pData) setProfiles(pData);

      // Fetch closures for selected range with robustness
      try {
        const { data: cData, error: cError } = await supabase
          .from('daily_closures')
          .select('*')
          .gte('fecha', dateRange.start)
          .lte('fecha', dateRange.end);
        
        if (cError) throw cError;
        setClosures(cData || []);
      } catch (cErr) {
        console.error('Admin Dashboard ERROR (Closures):', cErr);
        setClosures([]);
      }

      // Fetch expenses for selected range
      try {
        const { data: eData } = await supabase
          .from('expenses')
          .select('*')
          .gte('fecha', dateRange.start)
          .lte('fecha', dateRange.end);
        setExpenses(eData || []);
      } catch (eErr) {
        console.error('Admin Dashboard ERROR (Expenses):', eErr);
        setExpenses([]);
      }
    } catch (error: any) {
      console.error('Error fatal fetching admin data:', error);
      setToast({ msg: 'Error al sincronizar datos', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setLoading(false);
    }
  }, [dateRange, refreshKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePresetChange = (p: 'hoy' | 'ayer' | '7d' | 'custom') => {
    setPreset(p);
    const todayStr = new Date().toLocaleDateString('en-CA');
    
    if (p === 'hoy') {
      setDateRange({ start: todayStr, end: todayStr });
    } else if (p === 'ayer') {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      setDateRange({ start: yesterdayStr, end: yesterdayStr });
    } else if (p === '7d') {
      const lastWeek = new Date();
      lastWeek.setDate(today.getDate() - 6);
      setDateRange({ start: lastWeek.toISOString().split('T')[0], end: todayStr });
    }
  };

  const exportToCSV = () => {
    if (operations.length === 0) {
      setToast({ msg: 'No hay datos para exportar', type: 'error' });
      return;
    }

    const headers = ['Fecha', 'Chofer', 'Tren', 'Ciudad', 'Adultos', 'Niños', 'Grupos', 'Recaudación', 'Observaciones', 'A_Ini', 'A_Fin', 'N_Ini', 'N_Fin', 'G_Ini', 'G_Fin'];
    const rows = (operations || []).map(op => {
      const driver = (profiles || []).find(p => p.id === op?.driver_id);
      const train = (trains || []).find(t => t.id === op?.train_id);
      const closure = (closures || []).find(c => c.driver_id === op.driver_id && c.fecha === (op.fecha || new Date(op.created_at).toISOString().split('T')[0]));
      
      return [
        op?.fecha ? op.fecha : (op?.created_at ? new Date(op.created_at).toISOString().split('T')[0] : '—'),
        driver?.full_name || 'Desconocido',
        train?.matricula || 'N/A',
        train?.ciudad || 'N/A',
        op?.adultos || 0,
        op?.ninos || 0,
        op?.groups || 0,
        op?.recaudacion || 0,
        op?.observations || '',
        closure?.adult_start || '',
        closure?.adult_end || '',
        closure?.infant_start || '',
        closure?.infant_end || '',
        closure?.group_start || '',
        closure?.group_end || ''
      ].map(v => `"${v}"`).join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_ingresos_${dateRange.start}_a_${dateRange.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ msg: 'Reporte de Ingresos descargado', type: 'success' });
  };

  const exportExpensesToCSV = () => {
    if (expenses.length === 0) {
      setToast({ msg: 'No hay gastos para exportar', type: 'error' });
      return;
    }

    const headers = ['Fecha', 'Chofer', 'Categoría', 'Descripción', 'Monto'];
    const rows = (expenses || []).map(ex => {
      const driver = (profiles || []).find(p => p.id === ex.driver_id);
      return [
        ex?.fecha || '—',
        driver?.full_name || 'Desconocido',
        ex.category,
        ex.description || '',
        ex.amount || 0
      ].map(v => `"${v}"`).join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_gastos_${dateRange.start}_a_${dateRange.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ msg: 'Reporte de Gastos descargado', type: 'success' });
  };

  // Suscripción Realtime Reforzada
  useEffect(() => {
    const channel = supabase.channel('admin-realtime-v7')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'operations' },
        (payload) => {
          fetchData(); // Recalcular todo
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_closures' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const totalPeriodExpenses = useMemo(() => {
    return (expenses || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  }, [expenses]);

  // Derivando ciudades únicas
  const cities = useMemo(() => {
    const unique = new Set((trains || []).map(t => t?.ciudad).filter(Boolean));
    return ['Todas', ...Array.from(unique)];
  }, [trains]);

  // Aplicación de Filtros
  const filteredOperations = useMemo(() => {
    if (selectedCity === 'Todas') return operations;
    return operations.filter(op => {
      const train = trains.find(t => t.id === op.train_id);
      return train?.ciudad === selectedCity;
    });
  }, [operations, trains, selectedCity]);

  const filteredTrains = useMemo(() => {
    if (selectedCity === 'Todas') return trains;
    return trains.filter(t => t.ciudad === selectedCity);
  }, [trains, selectedCity]);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  // En análisis histórico, todayOps se refiere a todas las operaciones filtradas por rango
  const periodOps = filteredOperations;

  const totalRevenue = (periodOps || []).reduce((acc, curr) => acc + Number(curr.recaudacion || 0), 0);
  const periodPassengers = (periodOps || []).reduce((acc, curr) => acc + (Number(curr.adultos) || 0) + (Number(curr.ninos) || 0) + (Number(curr.groups) || 0), 0);
  const netBalance = (totalRevenue || 0) - (totalPeriodExpenses || 0);
  const activeTrainsCount = (filteredTrains || []).length;

  const activeHours = 12; // Estimado para históricos
  const revPerHour = (totalRevenue || 0) / activeHours;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Ventas', icon: <Activity className="w-4 h-4" /> },
    { key: 'choferes', label: 'Usuarios', icon: <Users className="w-4 h-4" /> },
    { key: 'flota', label: 'Flota', icon: <TrainIcon className="w-4 h-4" /> },
  ].filter(tab => userRole === 'admin' || (userRole === 'visualizador' && tab.key !== 'choferes'));

  const toggleDriverStatus = async (profile: any) => {
    // Siguiendo instrucciones: Usar estrictamente 'aprobado' o 'pendiente'
    const newStatus = profile.estado === 'pendiente' ? 'aprobado' : 'pendiente';
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ estado: newStatus })
        .eq('id', profile.id);

      if (error) throw error;
      setToast({ msg: `Usuario ${newStatus === 'pendiente' ? 'en espera' : 'activado'}`, type: 'success' });
      fetchData();
    } catch (err: any) {
      console.error("Error toggling status:", err);
      setToast({ msg: 'Error al cambiar estado', type: 'error' });
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModal.profile) return;
    if (newPass !== confirmPass) {
      setToast({ msg: 'Las contraseñas no coinciden', type: 'error' });
      return;
    }
    if (newPass.length < 6) {
      setToast({ msg: 'Mínimo 6 caracteres', type: 'error' });
      return;
    }

    setUpdatingPass(true);
    try {
      const { error } = await supabase.rpc('admin_change_password', {
        target_user_id: passwordModal.profile.id,
        new_password: newPass
      });

      if (error) throw error;

      setToast({ msg: 'Contraseña actualizada correctamente', type: 'success' });
      setPasswordModal({ isOpen: false, profile: null });
      setNewPass('');
      setConfirmPass('');
      fetchData(); // Refrescar para asegurar sincronía
    } catch (err: any) {
      console.error("Error updating password:", err);
      setToast({ msg: 'Error al cambiar contraseña', type: 'error' });
    } finally {
      setUpdatingPass(false);
    }
  };

  const handleReopenClosure = async (profile: Profile) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const confirmed = window.confirm(`Estás a punto de reabrir la caja de ${profile.full_name}. Esta acción quedará registrada. ¿Proceder?`);
    if (!confirmed) return;

    try {
      console.log(`🔓 Admin: Reabriendo caja de ${profile.full_name} (${profile.id}) para ${todayStr}`);
      const { error, count } = await supabase
        .from('daily_closures')
        .delete()
        .eq('driver_id', profile.id)
        .eq('fecha', todayStr);

      if (error) throw error;
      console.log(`✅ Cierre eliminado correctamente. Registros afectados:`, count);
      setToast({ msg: `Caja de ${profile.full_name} reabierta con éxito`, type: 'success' });
      fetchData();
    } catch (err: any) {
      console.error("❌ Error reopening closure:", err);
      setToast({ msg: 'Error al reabrir caja: ' + err.message, type: 'error' });
    }
  };

  const assignTrain = async (profileId: string, trainId: string | null) => {
    try {
      await supabase.from('profiles').update({ train_id: trainId }).eq('id', profileId);
      fetchData();
    } catch (err) {
      setToast({ msg: 'Error al asignar tren', type: 'error' });
    }
  };

  const updateRole = async (profile: Profile, newRole: string) => {
    try {
      const normalizedRole = newRole.toLowerCase().trim();
      const { error } = await supabase.from('profiles').update({ role: normalizedRole }).eq('id', profile.id);
      
      if (error) {
        console.error('❌ Supabase Error (Update Role):', error);
        throw error;
      }

      await fetchData();
      setToast({ msg: 'Rol actualizado correctamente', type: 'success' });
    } catch (err: any) {
      console.error('❌ Error fatal actualizando rol:', err);
      setToast({ msg: 'Error al cambiar rol: ' + (err.message || ''), type: 'error' });
    }
  };

  const updateName = async (profile: Profile) => {
    const newName = window.prompt('Editar nombre completo:', profile.full_name);
    if (!newName || newName.trim() === profile.full_name) return;

    try {
      const { error } = await supabase.from('profiles').update({ full_name: newName.trim() }).eq('id', profile.id);
      if (error) throw error;
      setToast({ msg: 'Nombre actualizado', type: 'success' });
      fetchData();
    } catch (err: any) {
      setToast({ msg: 'Error al actualizar nombre', type: 'error' });
    }
  };

  const deleteProfile = async (profile: Profile) => {
    const confirmed = window.confirm(`¿Estás SEGURO de eliminar permanentemente el perfil de ${profile.full_name}? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
      if (error) throw error;
      setToast({ msg: 'Perfil eliminado con éxito', type: 'success' });
      fetchData();
    } catch (err: any) {
      console.error("❌ Error deleting profile:", err);
      setToast({ msg: 'Error al eliminar perfil: ' + err.message, type: 'error' });
    }
  };

  const approveDriver = async (profile: any) => {
    try {
      let trainId = null;
      if (profile.matricula_solicitada) {
        const existing = trains.find((t: any) => t.matricula.toUpperCase() === profile.matricula_solicitada.toUpperCase());
        if (!existing) {
          const { data, error: tError } = await supabase.from('trains').insert({ 
            matricula: profile.matricula_solicitada.toUpperCase(), 
            ciudad: profile.ciudad || 'Pendiente' 
          }).select().single();
          if (tError) throw tError;
          if (data) trainId = data.id;
        } else {
          trainId = existing.id;
        }
      }
      const { error: pError } = await supabase.from('profiles').update({ 
        estado: 'aprobado', 
        train_id: trainId 
      }).eq('id', profile.id);
      if (pError) throw pError;
      setToast({ msg: `Chofer aprobado y vinculado`, type: 'success' });
      fetchData();
    } catch (err: any) {
      setToast({ msg: 'Error en la aprobación', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader className="w-12 h-12 animate-spin text-yellow-500" />
        <p className="text-white/30 text-xs uppercase tracking-widest">Sincronizando Sistema...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5 overflow-x-auto w-full md:w-auto no-scrollbar scroll-smooth">
          {(tabs || []).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 min-w-[120px] md:min-w-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all ${activeTab === tab.key
                ? 'bg-yellow-500 text-blue-950 shadow-lg shadow-yellow-500/20'
                : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
           <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
             <div className="px-3 py-1.5 border-r border-white/10 mr-1">
               <Calendar className="w-3.5 h-3.5 text-yellow-500" />
             </div>
             {[
               { id: 'hoy', label: 'Hoy' },
               { id: 'ayer', label: 'Ayer' },
               { id: '7d', label: 'Semana' },
               { id: 'custom', label: 'Personalizado' }
             ].map((opt) => (
               <button
                 key={opt.id}
                 onClick={() => handlePresetChange(opt.id as any)}
                 className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${preset === opt.id ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'}`}
               >
                 {opt.label}
               </button>
             ))}
           </div>

           {preset === 'custom' && (
             <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-xl border border-white/5">
               <input type="date" value={dateRange.start} onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))} className="bg-transparent text-[10px] text-white outline-none" />
               <ChevronRight className="w-3 h-3 text-white/20" />
               <input type="date" value={dateRange.end} onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))} className="bg-transparent text-[10px] text-white outline-none" />
               <button onClick={fetchData} className="p-1 hover:bg-white/10 rounded-lg transition-colors"><RefreshCw className="w-3 h-3 text-emerald-400" /></button>
             </div>
           )}

            <div className="flex items-center gap-2">
              <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all">
                <Download className="w-3.5 h-3.5" /> Ingresos
              </button>
              <button onClick={exportExpensesToCSV} className="flex items-center gap-2 px-4 py-2 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-500/20 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all">
                <Download className="w-3.5 h-3.5" /> Gastos
              </button>
            </div>
        </div>

        {(activeTab === 'overview' || activeTab === 'flota') && (
          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10 shrink-0">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-transparent text-sm font-bold text-white outline-none cursor-pointer"
            >
              {(cities || []).map(c => <option key={c} value={c} className="bg-blue-950">{c}</option>)}
            </select>
          </div>
        )}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-24 right-6 z-[100] px-6 py-3 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center gap-3 font-bold text-[10px] uppercase tracking-widest ${toast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-red-500/20 border-red-500/40 text-red-500'
              }`}
          >
            {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {loading ? (
           <div className="space-y-8 mt-4">
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICardSkeleton />
                <KPICardSkeleton />
                <KPICardSkeleton />
                <KPICardSkeleton />
             </div>
             <div className="glass rounded-[2rem] p-6 border border-white/5 space-y-4">
                <Skeleton className="w-48 h-6 mb-4" />
                <TableRowSkeleton cols={5} />
                <TableRowSkeleton cols={5} />
                <TableRowSkeleton cols={5} />
             </div>
           </div>
        ) : (
          <motion.div key={`${activeTab}-${refreshKey}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
          {activeTab === 'overview' && (
            <OverviewTab
              totalRevenue={totalRevenue}
              totalExpenses={totalPeriodExpenses}
              netBalance={netBalance}
              periodPassengers={periodPassengers}
              activeTrains={activeTrainsCount}
              operations={periodOps}
              expenses={expenses}
              trains={trains}
              profiles={profiles}
              closures={closures}
              revPerHour={revPerHour}
              totalTrips={periodOps.length}
              dateRange={dateRange}
              onViewImage={setSelectedImage}
              userRole={userRole}
            />
          )}
          {activeTab === 'choferes' && (
            <ChoferesTab 
              profiles={profiles} 
              closures={closures} 
              trains={trains} 
              onRefresh={() => setRefreshKey(k => k + 1)} 
              onUpdateRole={updateRole} 
              onUpdateName={updateName}
              onDeleteProfile={deleteProfile}
              onToggleStatus={toggleDriverStatus} 
              onAssignTrain={assignTrain} 
              onApprove={approveDriver} 
              onReopen={handleReopenClosure} 
              setToast={setToast} 
              onOpenPassword={(p: Profile) => setPasswordModal({ isOpen: true, profile: p })} 
              userRole={userRole} 
            />
          )}
           {activeTab === 'flota' && <FlotaTab trains={filteredTrains || []} onRefresh={() => setRefreshKey(k => k + 1)} setToast={setToast} userRole={userRole} />}
        </motion.div>
        )}
      </AnimatePresence>

      {/* Password Change Modal */}
      <AnimatePresence>
        {passwordModal.isOpen && passwordModal.profile && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPasswordModal({ isOpen: false, profile: null })} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="w-full max-w-md glass-strong rounded-[2.5rem] border border-white/10 shadow-2xl relative z-10 overflow-hidden">
               <div className="p-8">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-yellow-500/10 rounded-2xl border border-yellow-500/20 text-yellow-500">
                        <Key className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">Cambiar Contraseña</h3>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{passwordModal.profile.full_name}</p>
                      </div>
                    </div>
                    <button onClick={() => setPasswordModal({ isOpen: false, profile: null })} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                      <X className="w-5 h-5 text-white/20" />
                    </button>
                  </div>

                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Nueva Contraseña</label>
                       <input type="password" required className="input-field py-4 bg-white/5 border-white/5" placeholder="••••••••" value={newPass} onChange={e => setNewPass(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Confirmar Contraseña</label>
                       <input type="password" required className="input-field py-4 bg-white/5 border-white/5" placeholder="••••••••" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />
                    </div>

                    <div className="pt-4 flex gap-3">
                      <button type="button" onClick={() => setPasswordModal({ isOpen: false, profile: null })} className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] uppercase font-bold tracking-widest transition-all">Cancelar</button>
                      <button type="submit" disabled={updatingPass} className="flex-1 py-4 bg-yellow-500 hover:bg-yellow-400 text-blue-950 rounded-2xl text-[10px] uppercase font-bold tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50">
                        {updatingPass ? 'Actualizando...' : 'Confirmar Cambio'}
                      </button>
                    </div>
                  </form>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedImage && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedImage(null)} className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative z-10 max-w-4xl w-full h-full max-h-[85vh] flex flex-col items-center justify-center">
               <button onClick={() => setSelectedImage(null)} className="absolute -top-12 right-0 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white">
                 <X className="w-6 h-6" />
               </button>
               <img src={selectedImage} alt="Comprobante" className="w-full h-full object-contain rounded-2xl shadow-2xl" />
               <div className="mt-4 flex gap-4">
                 <a href={selectedImage} target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all">Abrir en pestaña nueva</a>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OverviewTab({ 
  totalRevenue, totalExpenses, netBalance, periodPassengers, 
  operations, expenses, trains, profiles, closures, totalTrips, dateRange, onViewImage, userRole 
}: any) {
  
  // Agrupar personal para comparativa de cierres
  const closureReport = (profiles || []).filter((p: any) => p.role === 'driver' && p.estado === 'aprobado').map((p: any) => {
    const driverOps = (operations || []).filter((op: any) => op.driver_id === p.id);
    const liveRevenue = driverOps.reduce((acc: number, curr: any) => acc + Number(curr.recaudacion || 0), 0);
    const livePax = driverOps.reduce((acc: number, curr: any) => acc + (curr.adultos || 0) + (curr.ninos || 0) + (curr.groups || 0), 0);
    
    const closure = (closures || []).find((c: any) => c.driver_id === p.id);
    const isClosed = !!closure;
    
    const train = (trains || []).find((t: any) => t.id === p.train_id);
    
    return { 
      ...p, 
      liveRevenue, 
      livePax,
      isClosed, 
      auditedRevenue: closure?.total_recaudado || 0,
      auditedExpenses: closure?.total_gastos || 0,
      auditedPax: closure?.total_passengers || 0,
      adultStart: closure?.adult_start,
      adultEnd: closure?.adult_end,
      infantStart: closure?.infant_start,
      infantEnd: closure?.infant_end,
      groupStart: closure?.group_start,
      groupEnd: closure?.group_end,
      train 
    };
  });

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-1 md:px-0">
        <StatCard title="Ventas Brutas" value={`€${totalRevenue.toFixed(2)}`} icon={<Coins className="text-emerald-400" />} sub={`Periodo: ${dateRange.start}`} color="emerald" />
        <StatCard title="Gastos Totales" value={`€${totalExpenses.toFixed(2)}`} icon={<ArrowDownRight className="text-orange-400" />} sub="Declarados por chofer" color="orange" />
        <StatCard title="Saldo Neto" value={`€${netBalance.toFixed(2)}`} icon={<Scale className="text-blue-400" />} sub="Recaudación real" color="blue" />
        <StatCard title="Pasajeros" value={periodPassengers.toString()} icon={<Users className="text-yellow-400" />} sub={`${totalTrips} viajes registrados`} color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Actividad del Periodo
            </h3>
          </div>
          <div className="glass rounded-3xl overflow-hidden border border-white/5 p-2">
            <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {(operations || []).length > 0 ? (operations || []).slice(0, 30).map((op: any, i: number) => {
                const driver = (profiles || []).find((p: any) => p.id === op?.driver_id);
                const train = (trains || []).find((t: any) => t.id === op?.train_id);
                return (
                  <div key={op?.id || i} className={`flex items-center gap-4 p-4 rounded-2xl border ${i === 0 ? 'bg-white/10 border-white/20' : 'bg-white/5 border-transparent'}`}>
                    <div className="shrink-0 p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                      <Coins className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs md:text-sm font-medium truncate">
                        <span className="font-bold text-yellow-500">{driver?.full_name || 'Chofer'}</span>: <span className="text-emerald-400">€{Number(op?.recaudacion || 0).toFixed(2)}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[9px] text-white/30 font-bold uppercase tracking-widest">
                        <span>{op?.created_at ? new Date(op.created_at).toLocaleDateString('es-ES') : '—'}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {train?.ciudad || '—'}</span>
                        <span>{train?.matricula || '—'}</span>
                        <span className="text-emerald-400/60">{Number(op?.adultos || 0) + Number(op?.ninos || 0) + Number(op?.groups || 0)} PAX</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-white/20 font-bold">
                        {op?.created_at ? new Date(op.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    </div>
                  </div>
                );
              }) : (
                <div className="py-20 text-center text-white/20 italic text-xs uppercase tracking-[0.2em]">Sin actividad en estas fechas</div>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Comparativa de Cierres</h3>
          <div className="glass rounded-3xl p-4 border border-white/5 overflow-hidden">
             <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
               {(closureReport || []).map((p: any) => (
                 <div key={p?.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                    <div className="flex justify-between items-start">
                       <div>
                         <p className="font-bold text-sm">{p?.full_name || 'Desconocido'}</p>
                         <p className="text-[9px] text-white/30 truncate max-w-[120px]">{p?.train?.matricula || 'Sin Tren'} • {p?.train?.ciudad || '—'}</p>
                       </div>
                       <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase flex items-center gap-1 ${p?.isClosed ? 'bg-emerald-500 text-blue-950' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                         {p?.isClosed ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                         {p?.isClosed ? 'Cerrado' : 'Abierto'}
                       </span>
                    </div>
                     <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                        <div className="flex justify-between items-center">
                           <span className="text-[9px] text-white/20 uppercase tracking-widest">Recaudación {p?.isClosed ? '(Auditada)' : '(En vivo)'}</span>
                           <span className={`font-black text-sm ${p?.isClosed ? 'text-emerald-400' : 'text-emerald-400/60 font-medium'}`}>
                             €{Number(p?.isClosed ? p?.auditedRevenue : p?.liveRevenue || 0).toFixed(2)}
                           </span>
                        </div>
                        {p?.isClosed && (
                          <>
                            <div className="flex justify-between items-center">
                               <span className="text-[9px] text-white/20 uppercase tracking-widest text-orange-400/50">Gastos Auditados</span>
                               <span className="font-black text-orange-400 text-sm">-€{Number(p?.auditedExpenses || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center bg-blue-950/30 p-2 rounded-lg mt-1 border border-blue-500/10">
                               <span className="text-[8px] text-blue-400 uppercase font-black tracking-[0.2em]">Neto Final</span>
                               <span className="font-black text-white text-sm">€{Number((p?.auditedRevenue || 0) - (p?.auditedExpenses || 0)).toFixed(2)}</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between items-center text-[9px] text-white/20 pt-1">
                           <span>Total Pasajeros</span>
                           <span className="font-bold">{p?.isClosed ? p?.auditedPax : p?.livePax} pax</span>
                        </div>
                        {p?.isClosed && (
                          <div className="pt-2 border-t border-white/5 mt-1">
                            <p className="text-[8px] text-white/30 uppercase font-black mb-2">Control de Tickets</p>
                            <div className="grid grid-cols-3 gap-1">
                              <div className="bg-white/5 p-1.5 rounded-lg text-center">
                                <span className="text-[7px] text-white/40 block">ADULTOS</span>
                                <span className="text-[10px] font-bold">{p.adultStart}-{p.adultEnd}</span>
                              </div>
                              <div className="bg-white/5 p-1.5 rounded-lg text-center">
                                <span className="text-[7px] text-white/40 block">INFANTIL</span>
                                <span className="text-[10px] font-bold">{p.infantStart}-{p.infantEnd}</span>
                              </div>
                              <div className="bg-white/5 p-1.5 rounded-lg text-center">
                                <span className="text-[7px] text-white/40 block">GRUPOS</span>
                                <span className="text-[10px] font-bold">{p.groupStart}-{p.groupEnd}</span>
                              </div>
                            </div>
                          </div>
                        )}
                     </div>
                 </div>
               ))}
               {(closureReport || []).length === 0 && <p className="text-center py-10 text-white/20 italic text-[10px]">No hay choferes activos</p>}
             </div>
          </div>
        </div>
      </div>

      {/* Gastos del Periodo Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" /> Auditoría de Gastos
          </h3>
        </div>
        <div className="glass rounded-[2rem] border border-white/5 overflow-hidden">
           <table className="w-full text-left text-xs border-collapse">
             <thead className="bg-white/5 text-[10px] uppercase font-black text-white/30 tracking-widest">
                <tr>
                  <th className="px-6 py-4">Fecha/Chofer</th>
                  <th className="px-6 py-4">Categoría</th>
                  <th className="px-6 py-4">Descripción</th>
                  <th className="px-6 py-4 text-orange-400">Monto</th>
                  <th className="px-6 py-4 text-center">Ticket</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-white/5">
                {(expenses || []).map((ex: any) => {
                  const driver = (profiles || []).find((p: any) => p.id === ex.driver_id);
                  return (
                    <tr key={ex.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold">{ex?.fecha ? new Date(ex.fecha).toLocaleDateString('es-ES') : '—'}</p>
                        <p className="text-[9px] text-white/30 uppercase tracking-widest mt-0.5">{driver?.full_name || '—'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-white/5 rounded-md text-[9px] font-bold uppercase tracking-widest group-hover:bg-orange-500/10 group-hover:text-orange-400 transition-colors">
                          {ex.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 italic text-white/40 truncate max-w-[200px]">{ex.description || '—'}</td>
                      <td className="px-6 py-4 font-black text-orange-400">€{Number(ex.amount || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 text-center">
                         {ex.ticket_url ? (
                           <button 
                             onClick={() => onViewImage(ex.ticket_url)}
                             className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-blue-950 rounded-xl border border-emerald-500/20 transition-all active:scale-95"
                             title="Ver comprobante"
                           >
                             <Camera className="w-4 h-4" />
                           </button>
                         ) : (
                           <div className="p-2.5 opacity-20" title="Sin comprobante">
                             <Camera className="w-4 h-4" />
                           </div>
                         )}
                      </td>
                    </tr>
                  );
                })}
                {(expenses || []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-white/20 italic text-xs">No hay gastos registrados en este periodo</td>
                  </tr>
                )}
             </tbody>
           </table>
        </div>
      </div>
    </div>
  );
}

function FlotaTab({ trains, onRefresh, setToast, userRole }: any) {
  const [showForm, setShowForm] = useState(false);
  const [editTrain, setEditTrain] = useState<Train | null>(null);
  const [form, setForm] = useState({ matricula: '', ciudad: '', is_active: true });
  const openNew = () => { setEditTrain(null); setForm({ matricula: '', ciudad: '', is_active: true }); setShowForm(true); };
  const openEdit = (train: Train) => { setEditTrain(train); setForm({ matricula: train.matricula, ciudad: train.ciudad, is_active: true }); setShowForm(true); };
  const handleSave = async () => {
    if (!form.matricula.trim() || !form.ciudad.trim()) return;
    try {
      const payload = { matricula: form.matricula, ciudad: form.ciudad };
      const { error } = editTrain ? await supabase.from('trains').update(payload).eq('id', editTrain.id) : await supabase.from('trains').insert(payload);
      if (error) throw error;
      setToast({ msg: editTrain ? 'Tren actualizado' : 'Tren creado', type: 'success' });
      setShowForm(false);
      onRefresh();
    } catch (err: any) {
      setToast({ msg: 'Error al procesar tren', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Flota</h2>
        {userRole === 'admin' && (
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-blue-950 rounded-xl font-bold text-xs uppercase tracking-widest"><Plus className="w-4 h-4" /> Nuevo</button>
        )}
      </div>
      {showForm && (
        <div className="glass p-6 rounded-3xl border border-yellow-500/20 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input className="input-field py-3 uppercase" placeholder="Matrícula" value={form.matricula} onChange={e => setForm(f => ({ ...f, matricula: e.target.value.toUpperCase() }))} />
            <input className="input-field py-3" placeholder="Ciudad" value={form.ciudad} onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))} />
          </div>
          <div className="flex gap-2"><button onClick={() => setShowForm(false)} className="flex-1 py-3 glass rounded-xl text-xs uppercase font-bold">Cancelar</button><button onClick={handleSave} className="flex-1 py-3 bg-yellow-500 text-blue-950 rounded-xl text-xs uppercase font-bold">Guardar</button></div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(trains || []).map((t: any) => (
          <div key={t?.id} className="glass p-6 rounded-3xl border border-white/5 relative group">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-black italic">{t?.matricula || 'N/A'}</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{t?.ciudad || '—'}</p>
              </div>
              {userRole === 'admin' && (
                <button onClick={() => openEdit(t)} className="p-2 glass rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChoferesTab({ profiles, closures, trains, onUpdateRole, onUpdateName, onDeleteProfile, onToggleStatus, onAssignTrain, onApprove, onReopen, onOpenPassword, userRole }: any) {
  const pendientes = profiles.filter((p: any) => p.estado === 'pendiente');
  const activos = profiles.filter((p: any) => p.estado !== 'pendiente');

  return (
    <div className="space-y-8">
      {pendientes.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-2"><ShieldAlert className="w-3.5 h-3.5" /> Solicitudes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendientes.map((p: any) => (
              <div key={p.id} className="glass p-6 rounded-3xl border border-yellow-500/20 bg-yellow-500/5 space-y-4">
                <div>
                  <h4 className="font-black text-lg leading-none mb-1">{p.full_name}</h4>
                  <p className="text-[10px] text-white/40 font-mono">{p.email}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] uppercase font-bold text-white/40">
                   <div className="p-2 bg-white/5 rounded-lg">Ciudad: <span className="text-white block">{p.ciudad}</span></div>
                   <div className="p-2 bg-white/5 rounded-lg">Matrícula: <span className="text-yellow-500 block">{p.matricula_solicitada}</span></div>
                </div>
                {userRole === 'admin' && (
                  <button onClick={() => onApprove(p)} className="w-full py-4 bg-yellow-500 text-blue-950 font-black rounded-2xl text-[10px] uppercase tracking-widest">Aprobar</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Personal Activo</h3>
        <div className="glass rounded-3xl overflow-x-auto border border-white/5">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[10px] uppercase font-black text-white/30 tracking-widest text-left">
              <tr>
                <th className="px-6 py-4">Usuario</th>
                <th className="px-6 py-4">Correo Electrónico</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Tren</th>
                {userRole === 'admin' && <th className="px-6 py-4 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {activos.map((p: any) => {
                const isClosed = closures.some((c: any) => c.driver_id === p.id);
                return (
                <tr key={p.id} className="hover:bg-white/5">
                  <td className="px-6 py-4">
                    <p className="font-bold">{p.full_name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[10px] text-white/60 font-mono tracking-wider">{p.email || '—'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 items-center">
                       <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${p.estado === 'pendiente' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>{p.estado}</span>
                       <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                         p.role === 'admin' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' :
                         p.role === 'visualizador' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                         'bg-white/5 text-white/40 border-white/10'
                       }`}>{p.role}</span>
                       {p.role === 'driver' && (
                         <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border flex items-center gap-1 ${isClosed ? 'bg-emerald-500 text-blue-950 border-emerald-500' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                           {isClosed ? <Lock className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                           {isClosed ? 'Cerrado' : 'Abierto'}
                         </span>
                       )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {p.role === 'driver' && (
                      userRole === 'admin' ? (
                        <select value={p.train_id || ''} onChange={(e) => onAssignTrain(p.id, e.target.value || null)} className="bg-black/20 p-2 rounded-lg border border-white/10 text-xs outline-none">
                          <option value="">Sin Asignar</option>
                          {(trains || []).map((t: any) => <option key={t.id} value={t.id}>{t.matricula} ({t.ciudad})</option>)}
                        </select>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{p.train_id ? trains.find((t: any) => t.id === p.train_id)?.matricula : 'Sin Asignar'}</span>
                      )
                    )}
                  </td>
                  {userRole === 'admin' && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button title="Cambiar Contraseña" onClick={() => onOpenPassword(p)} className="p-2 glass rounded-lg hover:bg-yellow-500/10 transition-colors">
                          <Key className="w-4 h-4 text-yellow-500" />
                        </button>
                        <button title="Editar Nombre" onClick={() => onUpdateName(p)} className="p-2 glass rounded-lg hover:bg-white/10 transition-colors">
                          <Edit2 className="w-4 h-4 text-white/60" />
                        </button>
                        <select 
                          value={p.role} 
                          onChange={(e) => onUpdateRole(p, e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-bold text-white/60 outline-none hover:bg-white/10 transition-colors"
                        >
                          <option value="driver" className="bg-blue-950">Conductor</option>
                          <option value="admin" className="bg-blue-950">Admin</option>
                          <option value="visualizador" className="bg-blue-950">Visualizador</option>
                        </select>
                        <button title={p.estado === 'pendiente' ? 'Activar' : 'Desactivar'} onClick={() => onToggleStatus(p)} className={`p-2 rounded-lg border transition-colors ${p.estado === 'pendiente' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20'}`}>
                          {p.estado === 'pendiente' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </button>
                        <button title="Eliminar Perfil" onClick={() => onDeleteProfile(p)} className="p-2 glass rounded-lg hover:bg-red-500/10 transition-colors group">
                          <Trash2 className="w-4 h-4 text-white/20 group-hover:text-red-500" />
                        </button>
                        {isClosed && (
                          <button title="Reabrir Caja" onClick={() => onReopen(p)} className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-[9px] font-bold uppercase rounded-lg transition-all">
                            Reabrir
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, sub }: any) {
  return (
    <div className="glass p-3 rounded-3xl border border-white/5">
      <div className="flex justify-between items-start mb-2">
        <div className="p-2 bg-white/5 rounded-xl">{icon}</div>
      </div>
      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 leading-none">{title}</p>
      <p className="text-xl font-black italic text-white leading-tight">{value}</p>
      {sub && <p className="text-[9px] text-white/20 mt-2 font-medium">{sub}</p>}
    </div>
  );
}
