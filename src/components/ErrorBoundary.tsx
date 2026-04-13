import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CRITICAL UI ERROR:', error, errorInfo);
  }

  private handleReset = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center p-6 text-white relative overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-red-500/5 rounded-full blur-[120px] pointer-events-none" />

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full glass-strong border border-red-500/20 p-10 rounded-[3rem] text-center shadow-2xl relative z-10"
          >
            <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-red-500/20 text-red-500">
              <AlertCircle className="w-10 h-10" />
            </div>

            <h1 className="text-2xl font-black mb-4 tracking-tight text-red-500">Módulo Bloqueado</h1>
            <p className="text-white/60 text-sm mb-10 leading-relaxed font-bold">
              Algo salió mal al cargar este módulo. No te preocupes, tus datos están a salvo en el servidor.
            </p>

            <div className="space-y-4">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-red-500 text-blue-950 font-black py-5 rounded-3xl shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-[11px]"
              >
                <RefreshCw className="w-4 h-4" /> Reintentar Carga
              </button>
              
              <button
                onClick={this.handleReset}
                className="w-full bg-white/5 hover:bg-white/10 text-white/40 font-bold py-4 rounded-2xl border border-white/5 transition-all text-[9px] uppercase tracking-widest"
              >
                Cerrar y Volver al Inicio
              </button>
            </div>

            {import.meta.env.DEV && (
              <div className="mt-8 pt-6 border-t border-white/5">
                <p className="text-[10px] text-red-400 font-mono break-all text-left bg-black/40 p-4 rounded-xl">
                  {this.state.error?.toString()}
                </p>
              </div>
            )}
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
