import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Mail, Lock, Loader, User, MapPin, Train as TrainIcon, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type AuthMode = 'login' | 'register';

export function Auth() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [registrationPlate, setRegistrationPlate] = useState('');
  
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) setError(authError.message);
      } else {
        const { data, error: authError } = await supabase.auth.signUp({ 
          email, 
          password 
        });
        
        if (authError) {
          setError(authError.message);
        } else if (data.user) {
          const { error: dbError } = await supabase.from('profiles').insert({
            id: data.user.id,
            full_name: fullName,
            email: email,
            role: 'driver',
            estado: 'pendiente',
            ciudad: city,
            matricula_solicitada: registrationPlate.toUpperCase()
          });
          if (dbError) setError("Registro exitoso, pero error al crear perfil: " + dbError.message);
        }
      }
    } catch (err) {
      setError("Fallo crítico de conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-8 relative overflow-hidden bg-[#001222]">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-[450px] glass-strong p-8 sm:p-12 rounded-[3.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative z-10 overflow-hidden"
      >
        {/* Top Accent Bar */}
        <div className="absolute top-0 left-0 w-full h-[6px] bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600" />

        <div className="flex flex-col items-center mb-12 mt-4">
          <motion.div 
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="w-48 h-12 flex items-center justify-center mb-4"
          >
             <img src="/logo.png" alt="Ilertren" className="h-full w-full object-contain filter drop-shadow-[0_5px_15px_rgba(245,158,11,0.3)]"
               onError={(e) => { e.currentTarget.setAttribute('src', 'https://placehold.co/400x120/001a33/fbbf24?text=ILERTREN') }}
             />
          </motion.div>
          <div className="space-y-1 text-center">
            <p className="text-amber-500 text-[10px] uppercase font-black tracking-[0.5em] opacity-80">Sistemas de Flota</p>
            <p className="text-white/20 text-[8px] uppercase tracking-[0.2em] font-bold">Portal Operativo Central</p>
          </div>
        </div>

        {/* Tab Selector (Segmented Control) */}
        <div className="flex bg-black/40 rounded-[1.25rem] p-1.5 mb-10 border border-white/5 relative shadow-inner">
          <motion.div
             layoutId="tab-active"
             className="absolute inset-1.5 w-[calc(50%-6px)] bg-amber-500 rounded-xl shadow-lg"
             transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
             style={{ x: mode === 'login' ? 0 : '100%' }}
          />
          <button 
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className={`flex-1 relative z-10 py-3 text-[10px] font-black uppercase tracking-widest transition-colors duration-300 ${mode === 'login' ? 'text-blue-950' : 'text-white/40 hover:text-white'}`}
          >
            Acceso
          </button>
          <button 
            type="button"
            onClick={() => { setMode('register'); setError(null); }}
            className={`flex-1 relative z-10 py-3 text-[10px] font-black uppercase tracking-widest transition-colors duration-300 ${mode === 'register' ? 'text-blue-950' : 'text-white/40 hover:text-white'}`}
          >
            Registro
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <AnimatePresence mode="wait">
            {mode === 'register' && (
              <motion.div 
                key="register-fields"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 overflow-hidden"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-2">Identidad Operario</label>
                  <div className="relative flex items-center group">
                    <User className="absolute left-4 w-5 h-5 text-white/20 group-focus-within:text-amber-500 transition-all duration-300" />
                    <input type="text" placeholder="Nombre completo" className="input-field-premium" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-2">Sede</label>
                    <div className="relative flex items-center group">
                      <MapPin className="absolute left-4 w-5 h-5 text-white/20 group-focus-within:text-amber-500 transition-all duration-300" />
                      <input type="text" placeholder="Barcelona" className="input-field-premium" value={city} onChange={(e) => setCity(e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-2">Placa Tren</label>
                    <div className="relative flex items-center group">
                      <TrainIcon className="absolute left-4 w-5 h-5 text-white/20 group-focus-within:text-amber-500 transition-all duration-300" />
                      <input type="text" placeholder="TRN-001" className="input-field-premium uppercase" value={registrationPlate} onChange={(e) => setRegistrationPlate(e.target.value.toUpperCase())} required />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-2">Correo Electrónico</label>
            <div className="relative flex items-center group">
              <Mail className="absolute left-4 w-5 h-5 text-white/20 group-focus-within:text-amber-500 transition-all duration-300" />
              <input type="email" placeholder="operario@ilertren.com" className="input-field-premium" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-2">Contraseña de Acceso</label>
            <div className="relative flex items-center group">
              <Lock className="absolute left-4 w-5 h-5 text-white/20 group-focus-within:text-amber-500 transition-all duration-300" />
              <input type="password" placeholder="••••••••" className="input-field-premium" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] p-4 rounded-2xl text-center font-bold tracking-tight"
            >
              ⚠️ {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group w-full bg-amber-500 hover:bg-amber-400 text-blue-950 font-black py-5 rounded-[1.5rem] shadow-xl shadow-amber-500/10 transition-all active:scale-[0.97] flex items-center justify-center gap-3 uppercase tracking-[0.3em] text-[12px] mt-10 disabled:opacity-30 overflow-hidden relative"
          >
            {loading ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span className="relative z-10">{mode === 'login' ? "Entrar al Tren" : "Registrar Operario"}</span>
                <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-14 text-center border-t border-white/5 pt-10">
           <p className="text-[9px] text-white/20 uppercase tracking-[0.4em] leading-relaxed font-black opacity-40">
             &copy; 2026 ILERTREN OPERATIVO<br/>
             <span className="text-[7px]">Sistemas de Control y Gestión de Flota</span>
           </p>
        </div>
      </motion.div>
    </div>
  );
}
