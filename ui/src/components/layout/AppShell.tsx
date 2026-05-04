import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Network, Layers, ShieldCheck, ScrollText, Presentation, Terminal, Zap } from 'lucide-react';
import TopBar from './TopBar';
import FleetStatusMini from './FleetStatusMini';

const NAV = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/topology',   icon: Network,         label: 'Topology'   },
  { to: '/migration',  icon: Layers,          label: 'Migration'  },
  { to: '/validation', icon: ShieldCheck,     label: 'Validation' },
  { to: '/logs',       icon: Terminal,        label: 'Logs'       },
  { to: '/audit',      icon: ScrollText,      label: 'Audit Log'  },
  { to: '/demo',       icon: Presentation,    label: 'Demo'       },
];

export default function AppShell() {
  const location = useLocation();
  const activeLabel = NAV.find((n) => location.pathname.startsWith(n.to))?.label ?? 'Dashboard';

  return (
    <div className="flex h-screen bg-surface-base overflow-hidden bg-mesh">
      {/* Sidebar */}
      <aside
        className="w-[220px] flex flex-col shrink-0 border-r border-surface-border"
        style={{
          background: 'linear-gradient(180deg, #0F1523 0%, #0B0F1A 100%)',
          boxShadow: '1px 0 0 rgba(255,255,255,0.04), 4px 0 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* Logo */}
        <div className="px-4 py-5 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                boxShadow: '0 4px 14px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
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
                      ? 'text-white'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay/60'
                  }`
                }
              >
                {isActive && (
                  <span
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(79,70,229,0.08) 100%)',
                      border: '1px solid rgba(99,102,241,0.28)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                    }}
                  />
                )}

                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                    style={{ background: 'linear-gradient(180deg, #818CF8 0%, #6366F1 100%)' }}
                  />
                )}

                <Icon
                  className={`w-4 h-4 shrink-0 relative z-10 transition-colors duration-200 ${
                    isActive ? 'text-indigo-400' : 'text-text-muted group-hover:text-text-secondary'
                  }`}
                />
                <span className="flex-1 relative z-10">{label}</span>

                {isActive && (
                  <span
                    className="w-1.5 h-1.5 rounded-full relative z-10 shrink-0"
                    style={{ background: '#6366F1', boxShadow: '0 0 6px rgba(99,102,241,0.9)' }}
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Fleet status block */}
        <div
          className="mx-3 mb-4 p-3 rounded-xl border border-surface-border"
          style={{ background: 'rgba(20, 27, 45, 0.6)', backdropFilter: 'blur(8px)' }}
        >
          <div className="section-title mb-3">Fleet Status</div>
          <FleetStatusMini />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-surface-border flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 text-white"
            style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)' }}
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
    </div>
  );
}
