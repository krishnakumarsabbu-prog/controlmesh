import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Network, Layers, ShieldCheck, ScrollText, Presentation, Terminal, Zap, Sparkles, CirclePlay as PlayCircle, RotateCcw, Cpu, Swords } from 'lucide-react';
import TopBar from './TopBar';
import FleetStatusMini from './FleetStatusMini';
import FloatingAssistant from '../shared/FloatingAssistant';
import { useAssistantAgent } from '../../hooks/useAssistantAgent';
import { useAppStore } from '../../store/appStore';

const NAV = [
  { to: '/dashboard',              icon: LayoutDashboard, label: 'Dashboard'        },
  { to: '/topology',               icon: Network,         label: 'Topology'         },
  { to: '/migration',              icon: Layers,          label: 'Migration'        },
  { to: '/migration-plan',         icon: Sparkles,        label: 'Migration Plan'   },
  { to: '/migration-simulation',   icon: Swords,          label: 'Simulation'       },
  { to: '/migration-execution',    icon: PlayCircle,      label: 'Execution'        },
  { to: '/rollback-state',         icon: RotateCcw,       label: 'Rollback State'   },
  { to: '/autonomous',             icon: Cpu,             label: 'Autonomous Mode'  },
  { to: '/validation',             icon: ShieldCheck,     label: 'Validation'       },
  { to: '/logs',                   icon: Terminal,        label: 'Logs'             },
  { to: '/audit',                  icon: ScrollText,      label: 'Audit Log'        },
  { to: '/demo',                   icon: Presentation,    label: 'Demo'             },
];

export default function AppShell() {
  const location = useLocation();
  const activeLabel = NAV.find((n) => location.pathname.startsWith(n.to))?.label ?? 'Dashboard';
  const { messages, handleCommand, isProcessing } = useAssistantAgent();
  useAppStore((s) => s.theme); // subscribe so re-render happens on theme change

  return (
    <div className="flex h-screen bg-surface-base overflow-hidden bg-mesh transition-all duration-500">
      {/* Sidebar */}
      <aside
        className="w-[220px] flex flex-col shrink-0 border-r border-surface-border bg-surface-raised"
        style={{
          boxShadow: '1px 0 0 rgba(255,255,255,0.04), 4px 0 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* Logo */}
        <div className="px-4 py-5 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'var(--logo-gradient)',
                boxShadow: 'var(--logo-shadow)',
              }}
            >
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm tracking-tight leading-none text-gradient-indigo">
                ControlMesh
              </div>
              <div className="text-[10px] text-text-muted mt-1 leading-none font-medium tracking-widest uppercase">
                MQ v2.0
              </div>
            </div>
          </div>
        </div>

        {/* Nav label */}
        <div className="px-4 pt-5 pb-2">
          <span className="section-title">Workspace</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-2">
          {NAV.map(({ to, icon: Icon, label }, idx) => {
            const isActive = location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                style={{ animationDelay: `${idx * 40}ms` }}
                className={() =>
                  `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-out animate-slide-in-left ${
                    isActive
                      ? 'text-accent-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay/60'
                  }`
                }
              >
                {isActive && (
                  <span
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: 'var(--nav-active-bg)',
                      border: '1px solid var(--nav-active-border)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                    }}
                  />
                )}

                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                    style={{ background: 'var(--accent-primary)' }}
                  />
                )}

                <Icon
                  className={`w-4 h-4 shrink-0 relative z-10 transition-colors duration-200 ${
                    isActive ? 'text-accent-primary' : 'text-text-muted group-hover:text-text-secondary'
                  }`}
                />
                <span className="flex-1 relative z-10">{label}</span>

                {isActive && (
                  <span
                    className="w-1.5 h-1.5 rounded-full relative z-10 shrink-0"
                    style={{ background: 'var(--accent-primary)', boxShadow: '0 0 6px var(--accent-glow)' }}
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Fleet status block */}
        <div
          className="mx-3 mb-4 p-3 rounded-xl border border-surface-border bg-surface-overlay/60"
          style={{ backdropFilter: 'blur(8px)' }}
        >
          <div className="section-title mb-3">Fleet Status</div>
          <FleetStatusMini />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-surface-border flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 text-white"
            style={{ background: 'var(--logo-gradient)' }}
          >
            CM
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-text-secondary font-medium truncate">Admin</div>
            <div className="text-[10px] text-text-muted truncate">Enterprise</div>
          </div>
        </div>
      </aside>

      {/* Content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar pageTitle={activeLabel} />
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in">
          <Outlet />
        </main>
      </div>

      {/* Global floating AI assistant — visible on all pages */}
      <FloatingAssistant
        messages={messages}
        onUserMessage={handleCommand}
        isProcessing={isProcessing}
      />
    </div>
  );
}
