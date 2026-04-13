import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { supabase } from '../../lib/supabaseClient';
import type { Operation, Expense } from '../../types/database';
import { 
  Plus, Minus, CheckCircle, AlertCircle, History, Users, 
  Coins, Loader, Clock, FileText, 
  Calculator, Lock, X, Receipt, ArrowDownRight, Scale,
  Camera, Image as ImageIcon, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QuickCalculator } from './QuickCalculator';
import { offlineSync } from '../../lib/offlineSync';
import { KPICardSkeleton } from '../Skeleton';

interface DriverDashboardProps {
  profile: {
    id: string;
    full_name: string;
    role: string;
    train_id?: string | null;
  };
}

export function DriverDashboard({ profile }: DriverDashboardProps) {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showCierre, setShowCierre] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'hoy' | 'historial'>('hoy');
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isDayClosed, setIsDayClosed] = useState(false);
  const [showConfirmCierre, setShowConfirmCierre] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [reopenNotice, setReopenNotice] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [syncingSheets, setSyncingSheets] = useState(false);

  // Ticket Ranges State (Correlative Logic)
  const [ticketRanges, setTicketRanges] = useState({
    adultStart: 0, adultEnd: 0,
    infantStart: 0, infantEnd: 0,
    groupStart: 0, groupEnd: 0
  });

  // Trip Form State
  const [adults, setAdults] = useState(0);
  const [children, setChildren] = useState(0);
  const PRECIO_ADULTO = 5.30;
  const PRECIO_INFANTIL = 4.20;
  const PRECIO_GRUPO = 4.20;
  const [revenue, setRevenue] = useState(0);
  const [observations, setObservations] = useState('');
  const [groups, setGroups] = useState(0);

  // Expense Form State
  const [expenseAmount, setExpenseAmount] = useState(0);
  const [expenseCategory, setExpenseCategory] = useState<Expense['category']>('Combustible');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseFile, setExpenseFile] = useState<File | null>(null);

  const todayStr = useMemo(() => new Date().toLocaleDateString('en-CA'), []);
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayOps = useMemo(() => 
    (operations || []).filter(op => op.fecha === todayStr || (!op.fecha && new Date(op.created_at) >= todayStart)),
    [operations, todayStr, todayStart]
  );

  const historicOps = useMemo(() => 
    (operations || []).filter(op => op.fecha !== todayStr && (op.fecha || new Date(op.created_at) < todayStart)),
    [operations, todayStr, todayStart]
  );

  // Cálculos de Totales Hoy (Referenciados en el Cierre)
  const todayRevenue = useMemo(() => todayOps?.reduce((acc, curr) => acc + (Number(curr.recaudacion) || 0), 0) || 0, [todayOps]);
  const todayAdults = useMemo(() => todayOps?.reduce((acc, curr) => acc + (Number(curr.adultos) || 0), 0) || 0, [todayOps]);
  const todayChildren = useMemo(() => todayOps?.reduce((acc, curr) => acc + (Number(curr.ninos) || 0), 0) || 0, [todayOps]);
  const todayGroups = useMemo(() => todayOps?.reduce((acc, curr) => acc + (Number(curr.groups) || 0), 0) || 0, [todayOps]);
  const todayPassengers = useMemo(() => (todayAdults || 0) + (todayChildren || 0) + (todayGroups || 0), [todayAdults, todayChildren, todayGroups]);

  // Inicializar sincronización offline
  useEffect(() => {
    offlineSync.init();
    offlineSync.sync(); // Al cargar, intentar sincronizar si hay algo pendiente
  }, []);

  const fetchOperations = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('operations')
      .select('*')
      .eq('driver_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) setOperations(data);
    setLoading(false);
  }, [profile.id]);

  const fetchExpenses = useCallback(async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('driver_id', profile.id)
      .eq('fecha', todayStr)
      .order('created_at', { ascending: false });

    if (!error && data) setExpenses(data);
  }, [profile.id]);

  // useRef para evitar problemas de stale closure con isDayClosed
  const isDayClosedRef = useRef(isDayClosed);
  useEffect(() => {
    isDayClosedRef.current = isDayClosed;
  }, [isDayClosed]);

  // Función ÚNICA para verificar cierre — consulta directa a la BD
  const checkClosureStatus = useCallback(async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      const { data, error } = await supabase
        .from('daily_closures')
        .select('id')
        .eq('driver_id', profile.id)
        .eq('fecha', todayStr)
        .maybeSingle();

      if (error) {
        console.error('Error consultando cierre:', error);
        return;
      }

      const isNowClosed = !!data;
      const wasClosed = isDayClosedRef.current;

      if (wasClosed && !isNowClosed) {
        setReopenNotice(true);
        setTimeout(() => setReopenNotice(false), 8000);
      }
      if (!wasClosed && isNowClosed) {
        // Bloqueo silencioso de interfaz
      }

      setIsDayClosed(isNowClosed);
    } catch (err) {
      console.error('Error en checkClosureStatus:', err);
    }
  }, [profile.id]);

  const fetchLastClosure = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_closures')
        .select('*')
        .eq('driver_id', profile.id)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const isToday = data.fecha === todayStr;
        if (isToday) {
          // Si ya existe registro de hoy (Reapertura), mantenemos los mismos números iniciales
          // No sumamos +1 porque es la misma jornada.
          setTicketRanges({
            adultStart: data.adult_start || 0,
            adultEnd: data.adult_end || 0,
            infantStart: data.infant_start || 0,
            infantEnd: data.infant_end || 0,
            groupStart: data.group_start || 0,
            groupEnd: data.group_end || 0
          });
        } else {
          // Es un día diferente: Lógica Contable (Inicio de hoy = Final de ayer + 1)
          setTicketRanges({
            adultStart: (data.adult_end || 0) + 1,
            adultEnd: 0,
            infantStart: (data.infant_end || 0) + 1,
            infantEnd: 0,
            groupStart: (data.group_end || 0) + 1,
            groupEnd: 0
          });
        }
      } else {
        // Primer día del chofer: Permitir ingreso manual de ambos números (inicia en 0)
        setTicketRanges({
          adultStart: 0, adultEnd: 0,
          infantStart: 0, infantEnd: 0,
          groupStart: 0, groupEnd: 0
        });
      }
    } catch (err) {
      console.error('Error fetching last closure:', err);
    }
  }, [profile.id]);

  // Carga inicial
  useEffect(() => {
    fetchOperations();
    fetchExpenses();
    checkClosureStatus();
  }, [fetchOperations, fetchExpenses, checkClosureStatus]);

  // POLLING cada 5 segundos — solución definitiva e infalible
  useEffect(() => {
    const pollInterval = setInterval(() => {
      checkClosureStatus();
    }, 5000);

    console.log('⏱️ Polling de cierre activado (cada 5s)');

    return () => {
      clearInterval(pollInterval);
    };
  }, [checkClosureStatus]);

  // Dynamic Calculator Logic
  useEffect(() => {
    const calculated = (adults * PRECIO_ADULTO) + (children * PRECIO_INFANTIL) + (groups * PRECIO_GRUPO);
    setRevenue(calculated);
  }, [adults, children, groups]);

  // Automatización del Cierre de Jornada (Números de Ticket)
  useEffect(() => {
    if (!isDayClosed) {
      const tAdults = todayOps.reduce((acc, curr) => acc + (Number(curr.adultos) || 0), 0);
      const tChildren = todayOps.reduce((acc, curr) => acc + (Number(curr.ninos) || 0), 0);
      const tGroups = todayOps.reduce((acc, curr) => acc + (Number(curr.groups) || 0), 0);

      setTicketRanges(prev => {
        // Solo actualizar si realmente hubo un cambio para evitar re-renders infinitos
        const newAdultEnd = prev.adultStart + tAdults;
        const newInfantEnd = prev.infantStart + tChildren;
        const newGroupEnd = prev.groupStart + tGroups;

        if (prev.adultEnd !== newAdultEnd || prev.infantEnd !== newInfantEnd || prev.groupEnd !== newGroupEnd) {
          return {
            ...prev,
            adultEnd: newAdultEnd,
            infantEnd: newInfantEnd,
            groupEnd: newGroupEnd
          };
        }
        return prev;
      });
    }
  }, [todayOps, ticketRanges.adultStart, ticketRanges.infantStart, ticketRanges.groupStart, isDayClosed]);

  const todayExpenses = (expenses || []).reduce((acc, curr) => acc + (Number(curr?.amount || 0) || 0), 0);
  const netDaily = (Number(todayRevenue || 0)) - (Number(todayExpenses || 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const tripData = {
      driver_id: profile.id,
      train_id: profile.train_id,
      adultos: adults || 0,
      ninos: children || 0,
      groups: groups || 0,
      recaudacion: revenue || 0,
      observations,
      is_finished: true,
      fecha: new Date().toISOString().split('T')[0]
    };

    if (!navigator.onLine) {
      offlineSync.enqueue('operations', tripData);
      setToast({ msg: 'Guardado localmente (Sin conexión)', type: 'error' });
      setShowForm(false);
      setAdults(0); setChildren(0); setRevenue(0);
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from('operations').insert(tripData);

    if (!error) {
      setShowForm(false);
      setAdults(0);
      setChildren(0);
      setGroups(0);
      setRevenue(0);
      setObservations('');
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
      fetchOperations();
    } else {
      console.error("CRITICAL ERROR SAVING OPERATION:", error);
      setToast({ msg: "Error al guardar: " + error.message, type: 'error' });
    }
    setSubmitting(false);
  };

  const handleApplyCalculatorResult = (result: number) => {
    if (showExpenseForm) {
      setExpenseAmount(result);
    } else {
      setRevenue(result);
      if (!showForm) setShowForm(true);
    }
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseAmount <= 0) return;
    setExpenseSubmitting(true);

    let ticketUrl = null;

    // Handle File Upload if exists
    if (expenseFile) {
      try {
        const fileExt = expenseFile.name.split('.').pop();
        const fileName = `${profile.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('expense-tickets')
          .upload(fileName, expenseFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('expense-tickets')
          .getPublicUrl(fileName);
        
        ticketUrl = publicUrl;
      } catch (err: any) {
        console.error("Error uploading ticket:", err);
        alert("Gasto guardado pero falló el ticket: " + err.message);
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const expenseData = {
      driver_id: profile.id,
      amount: expenseAmount,
      category: expenseCategory,
      description: expenseDesc,
      fecha: todayStr,
      ticket_url: ticketUrl
    };

    if (!navigator.onLine) {
      offlineSync.enqueue('expenses', expenseData);
      setToast({ msg: 'Gasto guardado localmente (Sin conexión)', type: 'error' });
      setShowExpenseForm(false);
      setExpenseAmount(0); setExpenseDesc(''); setExpenseFile(null);
      setExpenseSubmitting(false);
      return;
    }

    const { error } = await supabase.from('expenses').insert(expenseData);

    if (!error) {
      setShowExpenseForm(false);
      setExpenseAmount(0);
      setExpenseDesc('');
      setExpenseFile(null);
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
      fetchExpenses();
    } else {
      setToast({ msg: "Error al guardar gasto: " + error.message, type: 'error' });
    }
    setExpenseSubmitting(false);
  };

  const avgRevenuePerTrip = todayOps.length > 0 ? todayRevenue / todayOps.length : 0;

  // Verificación de integridad final antes del render
  if (!profile) return null;

  try {
    return (
      <div className="space-y-6">
        {/* Success Toast / Notification */}
        <AnimatePresence>
          {(submitSuccess || toast) && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-24 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md border ${
                toast?.type === 'error' ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              }`}
            >
              {toast?.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
              <span className="font-bold text-sm">{toast?.msg || 'Operación realizada'}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* KPI Cards — Today Only */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-1 md:px-0">
          {loading ? (
            <KPICardSkeleton />
          ) : (
            <>
              <KPICard
                title="Recaudación"
                value={`€${(todayRevenue || 0).toFixed(2)}`}
                icon={<Coins className="w-5 h-5 text-emerald-400" />}
                color="emerald"
              />
              <KPICard
                title="Gastos Hoy"
                value={`€${(todayExpenses || 0).toFixed(2)}`}
                icon={<ArrowDownRight className="w-5 h-5 text-orange-400" />}
                color="amber"
              />
              <KPICard
                title="Saldo Neto"
                value={`€${(netDaily || 0).toFixed(2)}`}
                icon={<Scale className="w-5 h-5 text-blue-400" />}
                color="blue"
              />
              <KPICard
                title="Pasajeros"
                value={(todayPassengers || 0).toString()}
                icon={<Users className="w-5 h-5 text-red-500" />}
                color="red"
              />
            </>
          )}
        </div>

        {/* Reopen Notice */}
        <AnimatePresence>
          {reopenNotice && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-2xl flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5" />
              <p className="text-xs font-bold uppercase tracking-widest">
                Tu jornada ha sido reabierta por el administrador. Ya puedes registrar viajes de nuevo.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Day Closed Message */}
        <AnimatePresence>
          {isDayClosed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass p-8 rounded-[2.5rem] border border-emerald-500/20 bg-emerald-500/5 text-center space-y-4"
            >
              <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20 text-emerald-400">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-black italic">Jornada cerrada con éxito.</h2>
                <p className="text-white/40 text-sm mt-1 uppercase tracking-widest font-bold">¡Buen descanso!</p>
              </div>
              <p className="text-xs text-white/30 max-w-xs mx-auto">
                Todos tus viajes de hoy han sido consolidados. El sistema de registro está bloqueado hasta mañana.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button 
                  onClick={() => {
                    fetchLastClosure();
                    setShowCierre(true);
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-widest border border-white/10"
                >
                  <FileText className="w-4 h-4" /> Ver Resumen Final
                </button>
                <button 
                  onClick={() => { console.log('🔄 Refresco manual solicitado'); checkClosureStatus(); }}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest border border-blue-500/20 transition-all active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" /> Refrescar Estado
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Register New Trip CTA */}
        {!isDayClosed && (
          <motion.div
            layout
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-red-600/10 via-amber-600/5 to-transparent p-6 rounded-3xl border border-red-500/20"
          >
            <div>
              <h2 className="text-xl font-bold">Registrar Nuevo Viaje</h2>
              <p className="text-white/40 text-sm mt-0.5">Completa los datos del trayecto actual</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { 
                  fetchLastClosure();
                  setShowCierre(true);
                }}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold bg-white/5 text-white hover:bg-white/10 border border-white/10 transition-all active:scale-95 whitespace-nowrap"
              >
                <FileText className="w-5 h-5 text-yellow-500" />
                Resumen
              </button>
              <button
                onClick={() => { setShowExpenseForm(!showExpenseForm); setShowForm(false); }}
                disabled={isDayClosed}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-xl active:scale-95 whitespace-nowrap ${showExpenseForm
                  ? 'bg-white/10 text-white'
                  : 'bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 border border-orange-500/20'
                  } ${isDayClosed ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}
              >
                <Receipt className="w-5 h-5" />
                {showExpenseForm ? 'Cancelar' : 'Cargar Gasto'}
              </button>
              <button
                onClick={() => { setShowForm(!showForm); setShowExpenseForm(false); }}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-xl active:scale-95 whitespace-nowrap ${showForm
                  ? 'bg-white/10 text-white hover:bg-white/15'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/30'
                  }`}
              >
                {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {showForm ? 'Cancelar' : 'Nuevo Registro'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Operation Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="overflow-hidden"
            >
              <div className="glass rounded-3xl p-8 border border-white/10 shadow-2xl">
                <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-6">Registro de Viaje</h3>
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Adultos - Azul */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] ml-1">Adultos</label>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <button type="button" onClick={() => setAdults(Math.max(0, adults - 1))} className="flex-1 sm:flex-none sm:w-14 h-14 bg-blue-500/10 hover:bg-blue-500/20 rounded-2xl flex items-center justify-center border border-blue-500/20 active:scale-95 text-blue-400 transition-all">
                          <Minus className="w-5 h-5" />
                        </button>
                        <div className="flex-[1.5] text-center bg-blue-500/5 rounded-2xl py-4 border border-blue-500/10">
                           <span className="text-3xl font-black italic text-blue-200">{adults}</span>
                        </div>
                        <button type="button" onClick={() => setAdults(adults + 1)} className="flex-1 sm:flex-none sm:w-14 h-14 bg-blue-600 hover:bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 active:scale-95 text-white transition-all">
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Infantil - Naranja */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-orange-400 uppercase tracking-[0.2em] ml-1">Infantil</label>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <button type="button" onClick={() => setChildren(Math.max(0, children - 1))} className="flex-1 sm:flex-none sm:w-14 h-14 bg-orange-500/10 hover:bg-orange-500/20 rounded-2xl flex items-center justify-center border border-orange-500/20 active:scale-95 text-orange-400 transition-all">
                          <Minus className="w-5 h-5" />
                        </button>
                        <div className="flex-[1.5] text-center bg-orange-500/5 rounded-2xl py-4 border border-orange-500/10">
                           <span className="text-3xl font-black italic text-orange-200">{children}</span>
                        </div>
                        <button type="button" onClick={() => setChildren(children + 1)} className="flex-1 sm:flex-none sm:w-14 h-14 bg-orange-600 hover:bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-600/20 active:scale-95 text-white transition-all">
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Grupos - Púrpura */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.2em] ml-1">{"Grupos (>10)"}</label>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <button type="button" onClick={() => setGroups(Math.max(0, groups - 1))} className="flex-1 sm:flex-none sm:w-14 h-14 bg-purple-500/10 hover:bg-purple-500/20 rounded-2xl flex items-center justify-center border border-purple-500/20 active:scale-95 text-purple-400 transition-all">
                          <Minus className="w-5 h-5" />
                        </button>
                        <div className="flex-[1.5] text-center bg-purple-500/5 rounded-2xl py-4 border border-purple-500/10">
                           <span className="text-3xl font-black italic text-purple-200">{groups}</span>
                        </div>
                        <button type="button" onClick={() => setGroups(groups + 1)} className="flex-1 sm:flex-none sm:w-14 h-14 bg-purple-600 hover:bg-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-600/20 active:scale-95 text-white transition-all">
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center mb-1">
                       <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Recaudación Total (€)</label>
                       <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-black uppercase tracking-widest">Base Autocalculada</span>
                      </div>
                      <input
                        type="number" readOnly
                        className="input-field py-5 text-4xl font-black text-emerald-400 bg-white/5 border-white/10 cursor-not-allowed"
                        value={revenue.toFixed(2)}
                      />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Resumen de Venta</label>
                       <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-blue-400 font-bold">Adultos:</span>
                            <span className="text-white/60">{adults} x {PRECIO_ADULTO.toFixed(2)}€ = <span className="text-white font-bold">{(adults * PRECIO_ADULTO).toFixed(2)}€</span></span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-orange-400 font-bold">Infantil:</span>
                            <span className="text-white/60">{children} x {PRECIO_INFANTIL.toFixed(2)}€ = <span className="text-white font-bold">{(children * PRECIO_INFANTIL).toFixed(2)}€</span></span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-purple-400 font-bold">Grupos:</span>
                            <span className="text-white/60">{groups} x {PRECIO_GRUPO.toFixed(2)}€ = <span className="text-white font-bold">{(groups * PRECIO_GRUPO).toFixed(2)}€</span></span>
                          </div>
                       </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Observaciones (Opcional)</label>
                    <input
                      type="text"
                      className="input-field py-5 text-sm bg-white/5 border-white/10 w-full"
                      placeholder="Ej: Descuento especial aplicada a grupo, etc..."
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                    />
                  </div>

                  {/* Preview */}
                  <div className="md:col-span-2 bg-white/5 rounded-3xl p-6 border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Calculator className="w-16 h-16" />
                    </div>
                    <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] mb-4 font-black">Calculador Dinámico</p>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-xl font-bold block">
                          Total {adults + children + groups} <span className="text-white/40 font-medium text-sm">Pasajeros</span>
                        </span>
                        <p className="text-[10px] text-white/20 uppercase font-black tracking-widest">Suma por categorías (Tarifas Fijas)</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-emerald-400/50 uppercase font-black tracking-widest mb-1">Selección Actual</p>
                        <span className="text-4xl font-black text-emerald-400 italic">€{((adults * PRECIO_ADULTO) + (children * PRECIO_INFANTIL) + (groups * PRECIO_GRUPO)).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <button
                      disabled={submitting || (adults === 0 && children === 0 && groups === 0)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-emerald-600/20"
                    >
                      {submitting ? <Loader className="animate-spin w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
                      Confirmar y Guardar Viaje
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expense Form */}
        <AnimatePresence>
          {showExpenseForm && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              className="overflow-hidden"
            >
              <div className="glass rounded-3xl p-8 border border-orange-500/20 shadow-2xl bg-orange-500/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-orange-500/10 rounded-xl border border-orange-500/20">
                    <Receipt className="w-5 h-5 text-orange-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest">Registrar Gasto Operativo</h3>
                </div>
                
                <form onSubmit={handleSubmitExpense} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Monto del Gasto (€)</label>
                      <input
                        type="number" min="0" step="0.01"
                        className="input-field py-4 text-3xl font-black text-orange-400 bg-black/20 border-white/5"
                        value={expenseAmount || ''}
                        onChange={e => setExpenseAmount(Number(e.target.value))}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Categoría</label>
                      <select 
                        className="input-field py-4 bg-black/20 border-white/5 font-bold"
                        value={expenseCategory}
                        onChange={e => setExpenseCategory(e.target.value as any)}
                      >
                        {['Combustible', 'Limpieza', 'Mantenimiento', 'Peaje', 'Otros'].map(cat => (
                          <option key={cat} value={cat} className="bg-blue-950">{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Descripción / Notas</label>
                      <input
                        type="text"
                        className="input-field py-4 bg-black/20 border-white/5"
                        placeholder="Detalles del gasto..."
                        value={expenseDesc}
                        onChange={e => setExpenseDesc(e.target.value)}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Comprobante (Ticket)</label>
                      {/* Actions */}
                      <div className="relative mt-8 space-y-3">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={e => setExpenseFile(e.target.files?.[0] || null)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className={`input-field py-3.5 flex items-center justify-center gap-2 transition-all ${expenseFile ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-black/20 border-white/5 text-white/40'}`}>
                          {expenseFile ? <ImageIcon className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                          <span className="text-[10px] font-bold uppercase truncate max-w-[150px]">
                            {expenseFile ? expenseFile.name : 'Subir Foto'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={expenseSubmitting || expenseAmount <= 0}
                    className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-orange-600/20"
                  >
                    {expenseSubmitting ? <Loader className="animate-spin w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
                    Guardar Gasto
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Navigation */}
        <div className="flex gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar scroll-smooth">
          {[
            { key: 'hoy', label: 'Viajes de Hoy', icon: <Clock className="w-4 h-4" />, count: todayOps.length },
            { key: 'historial', label: 'Historial', icon: <History className="w-4 h-4" />, count: historicOps.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === tab.key
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.key ? 'bg-white/20' : 'bg-white/10'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'hoy' && (
            <motion.div key="hoy" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <OperationsList operations={todayOps} loading={loading} emptyText="No hay viajes registrados hoy." />
            </motion.div>
          )}
          {activeTab === 'historial' && (
            <motion.div key="historial" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <OperationsList operations={historicOps} loading={loading} emptyText="No hay historial anterior." />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cierre de Caja Modal */}
        <AnimatePresence>
          {showCierre && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCierre(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="w-full max-w-lg glass-strong rounded-[2.5rem] border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar relative z-10"
              >
                <div className="p-6 sm:p-10">
                  <CierreReport
                    ops={todayOps}
                    driverName={profile.full_name}
                    totalRevenue={todayRevenue}
                    totalExpenses={todayExpenses}
                    netDaily={netDaily}
                    totalAdults={todayAdults}
                    totalChildren={todayChildren}
                    totalGroups={todayGroups}
                    avgRevenue={avgRevenuePerTrip}
                    isDayClosed={isDayClosed}
                    onClose={() => setShowCierre(false)}
                    onConfirmClose={() => setShowConfirmCierre(true)}
                    ticketRanges={ticketRanges}
                    setTicketRanges={setTicketRanges}
                  />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Global Confirmation Modal for Closure */}
        <AnimatePresence>
          {showConfirmCierre && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowConfirmCierre(false)} className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
               <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-sm glass-strong rounded-[2rem] border border-red-500/30 p-8 text-center space-y-6 relative z-10">
                  <div className="w-20 h-20 bg-red-500/10 rounded-[2rem] flex items-center justify-center mx-auto border border-red-500/20 text-red-500">
                    <Lock className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">¿Estás seguro?</h3>
                    <p className="text-xs text-white/40 mt-2">
                      Una vez cerrado <span className="text-red-400 font-bold">no podrás registrar más viajes</span> ni editar los datos de hoy.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <button 
                      onClick={async () => {
                        setIsClosing(true);
                        setSyncingSheets(true);
                        const todayStr = new Date().toISOString().split('T')[0];
                        
                        try {
                          // 1. Enviar a Google Sheets (Webhook) - Versión 7 (Anti-Duplicidad)
                          const webhookUrl = "https://script.google.com/macros/s/AKfycby7xmQkP5f-tGB4dDEZSwsN5HHy8bODc7TeCHoMtpCOOHQMutUrYn3rZH056HjApP2zEw/exec";
                          const payload = {
                            fecha: todayStr,
                            adult_start: ticketRanges.adultStart || 0,
                            adult_end: ticketRanges.adultEnd || 0,
                            infant_start: ticketRanges.infantStart || 0,
                            infant_end: ticketRanges.infantEnd || 0,
                            group_start: ticketRanges.groupStart || 0,
                            group_end: ticketRanges.groupEnd || 0
                          };

                          console.log('🚀 Sincronizando con la central de datos...', payload);

                          if (!navigator.onLine) {
                            console.warn('📡 Offline: La sincronización Excel se reintentará más tarde');
                            setToast({ msg: 'Sin conexión: Datos guardados en la central, Excel pendiente.', type: 'error' });
                          } else {
                            try {
                              await fetch(webhookUrl, {
                                method: 'POST',
                                mode: 'no-cors',
                                body: JSON.stringify(payload)
                              });
                              console.log('✅ Sincronización V7 completada con éxito');
                            } catch (excelErr) {
                              console.error('❌ Error enviando a Excel:', excelErr);
                            }
                          }

                          // 2. Proceder a Supabase (Siempre, tras el intento de Excel)
                          const { error: dbError } = await supabase.from('daily_closures').insert({
                            driver_id: profile.id,
                            fecha: todayStr,
                            total_recaudado: todayRevenue,
                            total_passengers: todayPassengers,
                            total_gastos: todayExpenses,
                            adult_start: ticketRanges.adultStart,
                            adult_end: ticketRanges.adultEnd,
                            infant_start: ticketRanges.infantStart,
                            infant_end: ticketRanges.infantEnd,
                            group_start: ticketRanges.groupStart,
                            group_end: ticketRanges.groupEnd
                          });

                          if (dbError) throw dbError;

                          setToast({ msg: 'Jornada Cerrada con Éxito', type: 'success' });
                          setIsDayClosed(true);
                          setShowConfirmCierre(false);
                          setShowCierre(false);
                        } catch (err: any) {
                          console.error("Error en la sincronización:", err);
                          if (err.code === '23505') {
                            setToast({ msg: 'Ya cerraste hoy. Los datos están a salvo.', type: 'success' });
                            setIsDayClosed(true);
                            setShowConfirmCierre(false);
                          } else {
                            setToast({ msg: 'Error al cerrar jornada. Intenta de nuevo.', type: 'error' });
                          }
                        } finally {
                          setIsClosing(false);
                          setSyncingSheets(false);
                        }
                      }}
                      disabled={isClosing}
                      className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
                    >
                      {isClosing ? 'Sincronizando con la central de datos...' : 'Sí, Cerrar Total del Día'}
                    </button>
                    <button 
                      onClick={() => setShowConfirmCierre(false)}
                      className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl text-xs uppercase tracking-widest transition-all"
                    >
                      Volver
                    </button>
                  </div>
               </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Quick Calculator Tool */}
        <QuickCalculator 
          isOpen={isCalculatorOpen} 
          onClose={() => setIsCalculatorOpen(false)}
          onApplyResult={handleApplyCalculatorResult}
        />

        {/* Floating Action Buttons (Mobile Focus) */}
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
          {/* Support Tool: Calculator */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCalculatorOpen(true)}
            className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-xl flex items-center justify-center text-white/60 border border-white/10 shadow-lg"
          >
            <Calculator className="w-5 h-5" />
          </motion.button>

          {/* Primary Action: Add Trip FAB */}
          {!isDayClosed && !showForm && (
            <motion.button
              initial={{ scale: 0, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-emerald-600/30 border-4 border-white/10"
            >
              <Plus className="w-8 h-8" />
            </motion.button>
          )}
        </div>
      </div>
    );
  } catch (error) {
    console.error("Critical error in DriverDashboard render:", error);
    return (
      <div className="flex flex-col items-center justify-center p-20 text-white/40 glass rounded-[2.5rem] border border-red-500/20">
        <AlertCircle className="w-12 h-12 mb-4 text-red-500" />
        <h2 className="text-xl font-bold text-white mb-2">Error de Renderizado</h2>
        <p className="text-xs text-center">{String(error)}</p>
      </div>
    );
  }
}

/* ─── Operation List ─── */
function OperationsList({ operations, loading, emptyText }: { operations: Operation[], loading: boolean, emptyText: string }) {
  if (loading) {
    return (
      <div className="flex justify-center p-16">
        <Loader className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  if (operations.length === 0) {
    return (
      <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-16 text-center">
        <History className="w-10 h-10 text-white/10 mx-auto mb-3" />
        <p className="text-white/30 italic">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {(operations || []).map((op, i) => (
        <motion.div
          key={op?.id || i}
          layout
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-center justify-between p-5 rounded-2xl border border-white/5 bg-white/[0.03] hover:border-white/10 hover:bg-white/5 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/5 rounded-xl flex flex-col items-center justify-center text-[11px] font-bold text-white/40 shrink-0">
              <span>{op?.created_at ? new Date(op.created_at).getHours().toString().padStart(2, '0') : '00'}</span>
              <span className="text-red-400 leading-none">:</span>
              <span>{op?.created_at ? new Date(op.created_at).getMinutes().toString().padStart(2, '0') : '00'}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold">{Number(op?.adultos || 0) + Number(op?.ninos || 0) + Number(op?.groups || 0)} Pasajeros</span>
                <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-white/40 uppercase tracking-widest">
                  {op?.adultos || 0}A / {op?.ninos || 0}N / {op?.groups || 0}G
                </span>
              </div>
              <p className="text-xs text-white/30 mt-0.5">{op?.observations || 'Sin observaciones'}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-emerald-400 text-lg">€{Number(op?.recaudacion || 0).toFixed(2)}</p>
            <p className="text-[10px] text-white/20 uppercase tracking-widest">
              {op?.created_at ? new Date(op.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '—'}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ─── Cash Closing Report ─── */
function CierreReport({
  ops, driverName, totalRevenue, totalExpenses, netDaily, totalAdults, totalChildren, totalGroups, avgRevenue, isDayClosed, onClose, onConfirmClose,
  ticketRanges, setTicketRanges
}: {
  ops: Operation[], driverName: string, totalRevenue: number, totalExpenses: number, netDaily: number,
  totalAdults: number, totalChildren: number, totalGroups: number, avgRevenue: number, 
  isDayClosed: boolean, onClose: () => void, onConfirmClose: () => void,
  ticketRanges: any, setTicketRanges: (ranges: any) => void
}) {
  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Report Header */}
      <div className="glass rounded-3xl p-8 border border-white/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 to-amber-600/5" />
        <div className="relative">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Cierre de Jornada</p>
              <h2 className="text-2xl font-black capitalize">{driverName}</h2>
              <p className="text-sm text-white/40 capitalize mt-1">{today}</p>
            </div>
            <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
              <FileText className="w-6 h-6 text-red-400" />
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
              <p className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-widest mb-1">Ingresos Brutos</p>
              <p className="text-3xl font-black text-emerald-400">€{totalRevenue.toFixed(2)}</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-6">
              <p className="text-[10px] font-bold text-orange-400/60 uppercase tracking-widest mb-1">Total Gastos</p>
              <p className="text-3xl font-black text-orange-400">€{totalExpenses.toFixed(2)}</p>
            </div>
          </div>

          <div className="bg-blue-600 border border-blue-400 rounded-2xl p-6 mb-6">
            <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">Saldo Final a Entregar</p>
            <p className="text-5xl font-black text-white">€{netDaily.toFixed(2)}</p>
          </div>

          {/* Ticket Ticket Control (Lógica Contable Automatizada) */}
          {!isDayClosed && (
            <div className="grid grid-cols-1 gap-4 mb-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="w-4 h-4 text-emerald-400" />
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Cálculo de Tickets Automatizado</p>
                </div>
                
                {/* Cuadro de Verificación Categoría | Nº Inicial | Cantidad (Hoy) | Nº Final */}
                <div className="overflow-hidden rounded-xl border border-white/5">
                  <table className="w-full text-left text-[9px]">
                    <thead className="bg-white/5 text-white/40 font-black uppercase tracking-tighter">
                      <tr>
                        <th className="px-3 py-2">Categoría</th>
                        <th className="px-3 py-2">Inicia</th>
                        <th className="px-3 py-2 text-center">Ventas Hoy</th>
                        <th className="px-3 py-2 text-right">AL Nº (Final)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 bg-black/20">
                      <tr>
                        <td className="px-3 py-3 font-bold text-blue-400">Adultos</td>
                        <td className="px-3 py-3 text-white/60">{ticketRanges.adultStart}</td>
                        <td className="px-3 py-3 text-center font-bold">+{totalAdults}</td>
                        <td className="px-3 py-3 text-right font-black text-emerald-400">{ticketRanges.adultEnd}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-3 font-bold text-orange-400">Infantil</td>
                        <td className="px-3 py-3 text-white/60">{ticketRanges.infantStart}</td>
                        <td className="px-3 py-3 text-center font-bold">+{totalChildren}</td>
                        <td className="px-3 py-3 text-right font-black text-emerald-400">{ticketRanges.infantEnd}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-3 font-bold text-purple-400">Grupos</td>
                        <td className="px-3 py-3 text-white/60">{ticketRanges.groupStart}</td>
                        <td className="px-3 py-3 text-center font-bold">+{totalGroups}</td>
                        <td className="px-3 py-3 text-right font-black text-emerald-400">{ticketRanges.groupEnd}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center gap-3">
                   <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
                   <p className="text-[8px] text-blue-200/60 uppercase leading-relaxed font-bold">
                     Los números finales se han calculado automáticamente según tus registros de viaje de hoy. Verifícalos con tu rollo físico.
                   </p>
                </div>

                {/* Validation Info (Read-Only Version) */}
                <div className="pt-2 border-t border-white/5">
                   <div className="grid grid-cols-3 gap-2 py-2">
                    <div className="text-center">
                      <p className="text-[8px] text-white/30 uppercase">Tickets A</p>
                      <p className="text-xs font-bold text-emerald-400">{totalAdults}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] text-white/30 uppercase">Tickets I</p>
                      <p className="text-xs font-bold text-emerald-400">{totalChildren}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] text-white/30 uppercase">Tickets G</p>
                      <p className="text-xs font-bold text-emerald-400">{totalGroups}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
            {[
              { label: 'Viajes', value: ops.length.toString(), unit: 'v' },
              { label: 'Total Pasajeros', value: (totalAdults + totalChildren + totalGroups).toString(), unit: 'pax' },
              { label: 'Adultos', value: totalAdults.toString(), unit: 'A' },
              { label: 'Niños', value: totalChildren.toString(), unit: 'N' },
              { label: 'Grupos', value: totalGroups.toString(), unit: 'G' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/5 rounded-xl p-4 border border-white/5 flex flex-col items-center justify-center">
                <p className="text-[8px] text-white/30 uppercase tracking-widest mb-1">{stat.label}</p>
                <p className="text-xl font-black text-white">{stat.value}</p>
                <p className="text-[8px] text-white/20 uppercase font-bold">{stat.unit}</p>
              </div>
            ))}
          </div>

          {ops.length > 0 && (
            <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
              <span className="text-sm text-white/40">Promedio por viaje</span>
              <span className="font-bold text-amber-400">€{avgRevenue.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Trip Log */}
      {ops.length > 0 && (
        <div className="glass rounded-3xl p-6 border border-white/10">
          <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-4">Detalle de Viajes</h3>
          <div className="space-y-2">
            {(ops || []).map((op, i) => (
              <div key={op?.id || i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-white/20 w-5 text-right">{i + 1}.</span>
                  <span className="text-xs text-white/50">
                    {op?.created_at ? new Date(op.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                  <span className="text-sm">{(Number(op?.adultos || 0) + Number(op?.ninos || 0) + Number(op?.groups || 0))} pax</span>
                  {op?.observations && (
                    <span className="text-xs text-white/30 italic hidden md:inline">— {op.observations}</span>
                  )}
                </div>
                <span className="font-bold text-emerald-400 text-sm">€{Number(op?.recaudacion || 0).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3">
              <span className="text-xs font-bold text-white/40 uppercase tracking-wider">TOTAL</span>
              <span className="font-black text-emerald-400 text-lg">€{Number(totalRevenue || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {ops.length === 0 && (
        <div className="text-center py-12 text-white/30 italic">
          No hay viajes registrados hoy para generar el cierre.
        </div>
      )}

      {!isDayClosed ? (
        <button
          onClick={onConfirmClose}
          disabled={
            ops.length === 0 || 
            (ticketRanges.adultEnd === ticketRanges.adultStart && ticketRanges.infantEnd === ticketRanges.infantStart && ticketRanges.groupEnd === ticketRanges.groupStart && ops.length > 0 && false)
          }
          className="w-full py-4 mt-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-bold rounded-2xl shadow-xl shadow-emerald-600/20 transition-all uppercase tracking-widest text-[10px]"
        >
          Sincronizar Cierre Automático
        </button>
      ) : (
        <div className="mt-4 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col items-center gap-3 text-emerald-400 text-center">
           <CheckCircle className="w-8 h-8" />
           <div>
             <span className="text-xs uppercase font-black tracking-widest block">Jornada ya cerrada</span>
             <p className="text-[10px] text-white/40 mt-1">Si necesitas modificar algo, contacta al administrador.</p>
           </div>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full py-3 mt-3 bg-white/5 hover:bg-white/10 text-white/60 font-bold rounded-2xl transition-all uppercase tracking-widest text-[9px]"
      >
        Cerrar Resumen
      </button>
    </div>
  );
}

/* ─── KPI Card ─── */
function KPICard({ title, value, icon, color, large }: {
  title: string, value: string, icon: React.ReactNode,
  color: 'amber' | 'red' | 'emerald' | 'blue', large?: boolean
}) {
  const colors = {
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  };

  return (
    <motion.div
      whileHover={{ y: -3 }}
      className={`glass rounded-3xl p-3 border border-white/10 relative overflow-hidden group hover:border-white/20 transition-all ${large ? 'col-span-2 md:col-span-1' : ''}`}
    >
      <div className={`inline-flex p-2 rounded-xl border mb-3 ${colors[color]}`}>{icon}</div>
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1 leading-none">{title}</p>
      <p className={`font-black italic ${large ? 'text-2xl' : 'text-xl'} text-white leading-tight`}>{value}</p>
    </motion.div>
  );
}
