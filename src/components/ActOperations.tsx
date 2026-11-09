import React, { useState } from 'react';
import { Play, CheckCircle2, Clock, ShieldCheck, Download, Sparkles, Terminal, FileText, ArrowRight } from 'lucide-react';
import { ExecutionTask } from '../types/index.ts';

interface ActOperationsProps {
  onExecuteAct: (mission: string) => void;
  isLoading: boolean;
}

const DEFAULT_TASKS: ExecutionTask[] = [
  {
    id: 'task-1',
    title: 'Deconstruct Strategic Invariants & Attack Vectors',
    description: 'Map architectural attack surfaces, failover states, and sovereign data retention bounds.',
    category: 'analysis',
    status: 'done',
    outputPreview: 'Analyzed 14 edge services. Identified zero critical vulnerability points. Invariants verified.',
  },
  {
    id: 'task-2',
    title: 'Deploy High-Throughput Ingress & WebSocket Relays',
    description: 'Configure distributed edge nodes with TLS 1.3 termination and voice packet buffering.',
    category: 'automation',
    status: 'done',
    outputPreview: 'Configured Envoy proxies across 3 geographic zones with sub-15ms latency.',
  },
  {
    id: 'task-3',
    title: 'Autonomous Tool Invocations & API Harmonization',
    description: 'Wire Gemini 3.8 Flash server pipelines with structured telemetry logs.',
    category: 'code',
    status: 'executing',
    outputPreview: 'Actively routing multimodal requests through express proxy gateway...',
  },
  {
    id: 'task-4',
    title: 'Executive Briefing & Verification Artifact Generation',
    description: 'Synthesize deliverables into comprehensive executive reports and machine-readable JSON schemas.',
    category: 'strategy',
    status: 'todo',
  },
];

export const ActOperations: React.FC<ActOperationsProps> = ({ onExecuteAct, isLoading }) => {
  const [tasks, setTasks] = useState<ExecutionTask[]>(DEFAULT_TASKS);
  const [missionInput, setMissionInput] = useState('');

  const toggleTaskStatus = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextStatus = t.status === 'done' ? 'todo' : 'done';
          return { ...t, status: nextStatus };
        }
        return t;
      })
    );
  };

  const handleStartMission = () => {
    if (!missionInput.trim()) return;
    onExecuteAct(missionInput);
  };

  const exportMissionPlan = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(
        JSON.stringify(
          {
            mission: missionInput || 'RaOne AI Autonomous Plan',
            brandSignature: 'RaOne AI by RavanaTec',
            tagline: 'Think. Create. Act.',
            tasks,
          },
          null,
          2
        )
      );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'raone_action_plan.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const completedCount = tasks.filter((t) => t.status === 'done').length;
  const progressPercent = Math.round((completedCount / tasks.length) * 100);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Section Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 tracking-wider uppercase mb-1.5">
          <Play className="w-4 h-4" />
          <span>Execution Dimension: Act</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-white tracking-tight">
          Autonomous Action Operations
        </h1>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
          The third pillar of RaOne AI: Transforming decisions into real-world autonomous action plans, workflows, step-by-step task runners, and verifiable outcomes.
        </p>
      </div>

      {/* Mission Planner Box */}
      <div className="bg-[#0D1322] border border-emerald-500/30 rounded-2xl p-6 sm:p-8 shadow-xl mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">Define Action Mission</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Specify the high-level objective. RaOne AI will decompose it into executable phases.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportMissionPlan}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 rounded-lg border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={missionInput}
            onChange={(e) => setMissionInput(e.target.value)}
            placeholder="e.g. Conduct a comprehensive security audit & launch plan for fintech infrastructure"
            className="flex-1 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <button
            onClick={handleStartMission}
            disabled={!missionInput.trim() || isLoading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 rounded-xl transition-all shadow-lg whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Action Blueprint</span>
          </button>
        </div>
      </div>

      {/* Progress & Milestone Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-slate-400 mb-1">Execution Progress</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
            {progressPercent}%
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-slate-400 mb-1">Active Tasks</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">
            {completedCount} / {tasks.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Verified milestones completed</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-slate-400 mb-1">Execution Core</div>
          <div className="text-sm font-semibold text-amber-300 font-mono mt-1">
            RaOne AI Autonomous Engine
          </div>
          <p className="text-[11px] text-slate-400 mt-1">One AI for Your World · RavanaTec</p>
        </div>
      </div>

      {/* Execution Task Checklist */}
      <div className="bg-[#0A0E17] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Operational Workflow Deliverables</span>
          </h2>
          <span className="text-xs font-mono text-slate-400">
            Status: {completedCount === tasks.length ? 'Mission Completed' : 'In Progress'}
          </span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {tasks.map((task, idx) => (
            <div
              key={task.id}
              className={`p-5 transition-colors ${
                task.status === 'done' ? 'bg-slate-950/40' : 'bg-slate-900/20'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <button
                  onClick={() => toggleTaskStatus(task.id)}
                  className="mt-0.5 text-slate-500 hover:text-emerald-400 transition-colors"
                >
                  {task.status === 'done' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : task.status === 'executing' ? (
                    <Clock className="w-5 h-5 text-amber-400 animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-600 hover:border-emerald-400" />
                  )}
                </button>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono tabular-nums text-slate-400">
                      Phase {idx + 1}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="text-xs font-medium capitalize text-slate-400">
                      {task.category}
                    </span>
                  </div>
                  <h3
                    className={`text-sm font-semibold transition-all ${
                      task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-100'
                    }`}
                  >
                    {task.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {task.description}
                  </p>

                  {task.outputPreview && (
                    <div className="mt-3 p-3 rounded-lg bg-[#070A10] border border-slate-800/90 text-xs font-mono text-emerald-300/90">
                      {task.outputPreview}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
