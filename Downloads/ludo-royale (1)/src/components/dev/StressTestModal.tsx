import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, RefreshCw, X, Bug } from 'lucide-react';
import { stressTestRunner, StressTestSuiteSummary } from '../../utils/stressTest';

interface StressTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StressTestModal: React.FC<StressTestModalProps> = ({ isOpen, onClose }) => {
  // DEV guard: Never render or mount in production builds
  if (!import.meta.env.DEV) {
    return null;
  }

  const [isRunning, setIsRunning] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<string>('');
  const [summary, setSummary] = useState<StressTestSuiteSummary | null>(null);

  const handleRunSuite = async () => {
    setIsRunning(true);
    setCurrentProgress('Starting test suite...');
    try {
      const res = await stressTestRunner.runFullSuite((status) => {
        setCurrentProgress(status);
      });
      setSummary(res);
    } catch (err: any) {
      setCurrentProgress(`Error: ${err.message || 'Suite failed'}`);
    } finally {
      setIsRunning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/90">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Bug className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-tight">Multiplayer Stress Test Mode</h2>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    DEV ONLY
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Simulates multi-player concurrency, action spam, rate limits, and network drops.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isRunning}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Status Card */}
            <div className="bg-neutral-800/60 border border-neutral-700/80 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <div>
                  <h4 className="text-sm font-semibold text-white">Server Authority & Concurrency Audit</h4>
                  <p className="text-xs text-neutral-400">
                    All simulated test rooms are isolated and do not modify persistent profiles or ratings.
                  </p>
                </div>
              </div>
              <button
                onClick={handleRunSuite}
                disabled={isRunning}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-lg transition whitespace-nowrap"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    Run All Tests
                  </>
                )}
              </button>
            </div>

            {/* In-Progress Notification */}
            {isRunning && (
              <div className="p-3.5 bg-sky-950/60 border border-sky-800/80 rounded-xl flex items-center gap-3">
                <RefreshCw className="w-4 h-4 text-sky-400 animate-spin flex-shrink-0" />
                <span className="text-xs font-medium text-sky-200">{currentProgress}</span>
              </div>
            )}

            {/* Results Overview */}
            {summary && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-neutral-800/80 border border-neutral-700 rounded-xl text-center">
                    <span className="text-xs text-neutral-400 font-medium">Total Scenarios</span>
                    <p className="text-xl font-bold text-white mt-0.5">{summary.totalTests}</p>
                  </div>
                  <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-center">
                    <span className="text-xs text-emerald-400 font-medium">Passed</span>
                    <p className="text-xl font-bold text-emerald-300 mt-0.5">{summary.passedTests}</p>
                  </div>
                  <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-center">
                    <span className="text-xs text-red-400 font-medium">Failed</span>
                    <p className="text-xl font-bold text-red-300 mt-0.5">{summary.failedTests}</p>
                  </div>
                </div>

                {/* Scenarios Breakdown */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 px-1">
                    Scenario Breakdown ({summary.durationMs}ms)
                  </h4>
                  {summary.scenarios.map((sc) => (
                    <div
                      key={sc.scenario}
                      className="p-3.5 bg-neutral-800/40 border border-neutral-700/60 rounded-xl flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          {sc.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          )}
                          <span className="text-sm font-semibold text-white">{sc.name}</span>
                        </div>
                        <span className="text-xs font-mono text-neutral-400">{sc.durationMs}ms</span>
                      </div>
                      <p className="text-xs text-neutral-300 pl-6">{sc.details}</p>

                      {/* Sub-results if available */}
                      {sc.subResults && sc.subResults.length > 0 && (
                        <div className="ml-6 mt-1 space-y-1 bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800">
                          {sc.subResults.map((sub, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-neutral-400">{sub.step}</span>
                              <span
                                className={`font-mono font-medium ${
                                  sub.passed ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              >
                                {sub.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!summary && !isRunning && (
              <div className="text-center py-8 text-neutral-500 text-xs">
                Click &quot;Run All Tests&quot; to begin testing server-authoritative validations, rate limits, and
                concurrency locks.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-900/90 flex items-center justify-between text-xs text-neutral-400">
            <span>Only available in development mode (NODE_ENV !== production)</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-medium transition"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
