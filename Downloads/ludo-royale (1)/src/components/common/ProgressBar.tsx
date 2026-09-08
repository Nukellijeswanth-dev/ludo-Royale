import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  color?: string;
  className?: string;
  showPercent?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  label,
  color = 'from-amber-400 to-amber-500',
  className = '',
  showPercent = true,
}) => {
  const percentage = Math.min(100, Math.max(0, Math.round((current / (total || 1)) * 100)));

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercent) && (
        <div className="flex justify-between text-xs font-semibold mb-1 text-slate-300">
          <span>{label}</span>
          <span>
            {current} / {total} ({percentage}%)
          </span>
        </div>
      )}
      <div className="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden border border-slate-700/60 shadow-inner">
        <div
          className={`h-full bg-gradient-to-r ${color} transition-all duration-500 rounded-full shadow-sm`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
