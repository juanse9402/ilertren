import React from 'react';
import { supabase } from '../lib/supabaseClient';
import { LogOut, User, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

interface LayoutProps {
  children: React.ReactNode;
  userProfile: {
    id: string;
    full_name: string;
    role: string;
  };
}

export function Layout({ children, userProfile }: LayoutProps) {
  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#001a33] text-white relative flex-1">

      {/* Ambient glow background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-yellow-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 glass-strong border-b border-white/5 px-4 md:px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
            className="w-24 sm:w-32 md:w-40 h-6 sm:h-8 md:h-10 flex items-center justify-start drop-shadow-xl shrink-0"
          >
            <img 
               src="/logo.png" 
               alt="Trenes Logo" 
               onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x120/002f5c/white?text=TRENES+GESTION' }}
               className="h-full object-contain filter drop-shadow-[0_0_8px_rgba(255,255,255,0.1)] rounded"
            />
          </motion.div>
          <div className="hidden lg:block border-l border-white/10 pl-4">
            <h1 className="font-bold text-white/90 text-[11px] uppercase tracking-widest leading-none">Portal Operativo</h1>
            <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-[0.2em] leading-none mt-1 capitalize">{today}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Role Badge */}
          <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-[0.15em] border shadow-inner ${
            userProfile.role === 'admin'
              ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500'
              : userProfile.role === 'visualizador'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-blue-400/10 border-blue-400/30 text-blue-400'
          }`}>
            {userProfile.role === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
            {userProfile.role === 'visualizador' ? 'Supremo Visualizador' : userProfile.role}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-2 pl-3 border-l border-white/10">
            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold leading-tight">{userProfile.full_name}</p>
            </div>
            <div className="relative group flex items-center h-full">
              <button className="w-9 h-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer">
                <User className="w-4 h-4 text-white/60 group-hover:text-yellow-400 transition-colors" />
              </button>
              
              {/* Invisible Bridge Container para que el hover no se rompa */}
              <div className="absolute top-full right-0 pt-3 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all w-48 z-50">
                <div className="glass-strong rounded-2xl p-2 shadow-2xl transform origin-top-right scale-95 group-hover:scale-100 transition-all border border-white/10">
                  <div className="px-3 py-2 border-b border-white/5 mb-1">
                    <p className="text-xs font-bold text-white truncate">{userProfile.full_name || 'Sin Nombre'}</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">
                      {userProfile.role === 'visualizador' ? 'Supremo Visualizador' : (userProfile.role || 'Sin Rol Asignado')}
                    </p>
                  </div>
                  
                  {(!userProfile.role || userProfile.role.trim() === '') && (
                     <button
                       onClick={async () => {
                          const { error } = await supabase.from('profiles').update({ role: 'admin', estado: 'aprobado', full_name: 'Super Admin' }).eq('id', userProfile.id);
                          if (!error) window.location.reload();
                          else alert(error.message);
                       }}
                       className="w-full flex items-center justify-center gap-2 px-3 py-2.5 mb-1 text-xs text-black bg-yellow-500 hover:bg-yellow-400 rounded-xl transition-colors font-bold cursor-pointer"
                     >
                       <Shield className="w-3 h-3" /> Reparar mi Perfil a Admin
                     </button>
                  )}

                  <button
                    onClick={() => supabase.auth.signOut()}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-yellow-500 hover:bg-yellow-500/10 rounded-xl transition-colors font-medium cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20 relative z-10 w-full">
        <motion.div
           initial={{ opacity: 0, y: 15 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.4, ease: "easeOut" }}
           className="w-full md:max-w-7xl md:mx-auto px-2 md:px-8 py-4 md:py-8"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
