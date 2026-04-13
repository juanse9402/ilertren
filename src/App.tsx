import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { DriverDashboard } from './components/driver/DriverDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from './types/database';
import { Loader, ShieldAlert, LogOut, User, MapPin, Train as TrainIcon, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Recovery Form State
  const [recName, setRecName] = useState('');
  const [recCity, setRecCity] = useState('');
  const [recPlate, setRecPlate] = useState('');
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [showForcedEntry, setShowForcedEntry] = useState(false);
  const loadingPhrases = [
    'Preparando la Locomotora...',
    'Enganchando Vagones...',
    'Revisando la Vía...',
    'Calentando Motores...',
    'Engrasando Engranajes...',
    'Sincronizando Estaciones...'
  ];
  const [currentPhrase, setCurrentPhrase] = useState(loadingPhrases[0]);

  useEffect(() => {
    if (loading) {
      const phraseInterval = setInterval(() => {
        setCurrentPhrase(prev => {
          const idx = loadingPhrases.indexOf(prev);
          return loadingPhrases[(idx + 1) % loadingPhrases.length];
        });
      }, 800);

      const timeout = setTimeout(() => {
        setShowForcedEntry(true);
      }, 3500); // 3.5s timeout for safety

      return () => {
        clearInterval(phraseInterval);
        clearTimeout(timeout);
      };
    }
  }, [loading]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Profile fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setRecLoading(true);
    setRecError(null);

    try {
      const { error } = await supabase.from('profiles').upsert({
        id: session.user.id,
        full_name: recName,
        email: session.user.email!,
        role: 'driver',
        estado: 'pendiente',
        ciudad: recCity,
        matricula_solicitada: recPlate.toUpperCase()
      });

      if (error) {
        throw error;
      }
      
      await fetchProfile(session.user.id);
    } catch (err: any) {
      setRecError(err.message || "Error al activar perfil");
    } finally {
      setRecLoading(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <motion.div 
          key="loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col items-center justify-center min-h-screen bg-[#000d1a] text-white font-sans relative overflow-hidden"
        >
          {/* Background Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="relative flex flex-col items-center">
            {/* Train Animation */}
            <motion.div
              animate={{ 
                y: [0, -2, 0],
                rotate: [0, 0.5, -0.5, 0],
                scale: [1, 1.01, 1]
              }}
              transition={{ 
                repeat: Infinity, 
                duration: 0.2,
                ease: "linear"
              }}
              className="relative z-10"
            >
              <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full scale-150 animate-pulse" />
              <TrainIcon className="w-16 h-16 text-amber-500 relative z-10 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
            </motion.div>

            {/* Tracks Animation */}
            <div className="w-48 h-[2px] bg-white/10 mt-6 relative overflow-hidden rounded-full">
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: "-100%" }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 1.5, 
                  ease: "linear" 
                }}
                className="absolute inset-0 flex gap-4"
              >
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="min-w-[15px] h-full bg-amber-500/40 rounded-full" />
                ))}
              </motion.div>
            </div>

            {/* Themed Text */}
            <div className="mt-8 text-center space-y-2">
              <AnimatePresence mode="wait">
                <motion.p 
                  key={currentPhrase}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-xs font-bold uppercase tracking-[0.3em] text-white/60 italic"
                >
                  {currentPhrase}
                </motion.p>
              </AnimatePresence>
              <p className="text-[9px] uppercase tracking-[0.5em] opacity-20 font-black">Sistema de Gestión de Trenes</p>
            </div>

            {/* Forced Entry Button */}
            <AnimatePresence>
              {showForcedEntry && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setLoading(false)}
                  className="mt-12 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[9px] uppercase tracking-widest font-black text-white/40 transition-all hover:text-white"
                >
                  Entrada Forzada
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      ) : !session ? (
        <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Auth />
        </motion.div>
      ) : session && !profile ? (
        <motion.div 
          key="sync-error"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center min-h-screen bg-[#001222] text-white p-6 sm:p-10 font-sans relative overflow-hidden"
        >
          {/* Background Decorators */}
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-red-500/10 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="w-full max-w-[480px] glass-strong p-8 sm:p-12 rounded-[3.5rem] shadow-2xl relative z-10 border border-red-500/20">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-red-500/10 rounded-[1.25rem] flex items-center justify-center text-red-500 border border-red-500/20">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-red-500">Activar Identidad</h2>
                <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Ficha de Operario no encontrada</p>
              </div>
            </div>

            <p className="text-sm text-white/60 mb-8 leading-relaxed font-medium">
              Tu cuenta está activa, pero falta completar tu ficha operativa. Por favor, ingresa tus datos para finalizar el acceso.
            </p>

            <form onSubmit={handleCompleteProfile} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-2">Nombre Completo</label>
                <div className="relative flex items-center group">
                  <User className="absolute left-4 w-5 h-5 text-white/20 group-focus-within:text-amber-500 transition-all" />
                  <input type="text" placeholder="Ej: Roberto Martínez" className="input-field-premium" value={recName} onChange={(e) => setRecName(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-2">Sede</label>
                  <div className="relative flex items-center group">
                    <MapPin className="absolute left-4 w-5 h-5 text-white/20 group-focus-within:text-amber-500 transition-all" />
                    <input type="text" placeholder="Barcelona" className="input-field-premium" value={recCity} onChange={(e) => setRecCity(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-2">Matrícula</label>
                  <div className="relative flex items-center group">
                    <TrainIcon className="absolute left-4 w-5 h-5 text-white/20 group-focus-within:text-amber-500 transition-all" />
                    <input type="text" placeholder="TRN-001" className="input-field-premium uppercase" value={recPlate} onChange={(e) => setRecPlate(e.target.value.toUpperCase())} required />
                  </div>
                </div>
              </div>

              {recError && <p className="text-red-400 text-xs font-bold text-center bg-red-500/10 p-4 rounded-xl border border-red-500/10">{recError}</p>}

              <button
                type="submit"
                disabled={recLoading}
                className="w-full bg-amber-500 text-blue-950 font-black py-5 rounded-[1.5rem] flex items-center justify-center gap-3 uppercase tracking-widest text-[11px] hover:bg-amber-400 transition-all shadow-xl shadow-amber-500/10"
              >
                {recLoading ? <Loader className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Finalizar Registro</>}
              </button>
            </form>

            <button 
              onClick={() => { supabase.auth.signOut(); window.location.reload(); }}
              className="w-full mt-6 py-4 text-[9px] font-black uppercase tracking-[0.3em] opacity-20 hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
            >
              <LogOut className="w-3 h-3" /> Cerrar Sesión e Ir atrás
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div 
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="min-h-screen bg-[#001a33]"
        >
          <Layout userProfile={{ id: profile!.id, full_name: profile!.full_name, role: profile!.role }}>
            {(profile!.role === 'admin' || profile!.role === 'visualizador') ? (
              <AdminDashboard userRole={profile!.role} />
            ) : (
              <DriverDashboard profile={profile! as any} />
            )}
          </Layout>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default App;
