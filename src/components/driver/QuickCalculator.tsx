import { useState } from 'react';
import { 
  Calculator, X, 
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface QuickCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyResult?: (result: number) => void;
}

export function QuickCalculator({ isOpen, onClose, onApplyResult }: QuickCalculatorProps) {
  const [adults, setAdults] = useState(0);
  const [children, setChildren] = useState(0);

  const total = (adults * 5.30) + (children * 4.20);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="w-full max-w-sm glass-strong p-8 rounded-[2rem] border border-white/10 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center text-blue-950">
                <Calculator className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black uppercase tracking-tight">Calculadora</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <X className="w-5 h-5 opacity-40 hover:opacity-100" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Adultos</p>
                <p className="text-xl font-black">{adults}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setAdults(Math.max(0, adults - 1))} className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center font-bold">-</button>
                <button onClick={() => setAdults(adults + 1)} className="w-10 h-10 bg-yellow-500 text-blue-950 rounded-lg flex items-center justify-center font-bold">+</button>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Niños (50%)</p>
                <p className="text-xl font-black">{children}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setChildren(Math.max(0, children - 1))} className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center font-bold">-</button>
                <button onClick={() => setChildren(children + 1)} className="w-10 h-10 bg-yellow-500 text-blue-950 rounded-lg flex items-center justify-center font-bold">+</button>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                 <p className="text-[11px] uppercase tracking-[0.2em] font-black text-yellow-500">Total Recaudado</p>
                 <ArrowRight className="w-3 h-3 text-yellow-500" />
              </div>
              <p className="text-4xl font-black text-white">{total.toFixed(2)}€</p>
              
              {onApplyResult && total > 0 && (
                <button 
                  onClick={() => { onApplyResult(total); onClose(); }}
                  className="mt-6 w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] uppercase font-bold tracking-widest transition-all"
                >
                  Aplicar al formulario
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
