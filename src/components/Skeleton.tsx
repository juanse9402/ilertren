import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export function Skeleton({ className = '', count = 1 }: SkeletonProps) {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className={`bg-white/5 rounded-xl animate-pulse ${className}`}
        />
      ))}
    </>
  );
}

export function KPICardSkeleton() {
  return (
    <div className="glass p-6 rounded-3xl border border-white/5 space-y-4">
      <div className="flex justify-between items-start">
        <Skeleton className="w-24 h-4" />
        <Skeleton className="w-10 h-10 rounded-xl" />
      </div>
      <Skeleton className="w-32 h-8" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-white/5">
      {[...Array(cols)].map((_, i) => (
        <Skeleton key={i} className={`h-4 flex-1 ${i === 0 ? 'max-w-[100px]' : ''}`} />
      ))}
    </div>
  );
}
