import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Network, Layers, ShieldCheck, ScrollText, Presentation, Terminal, Cpu } from 'lucide-react';
import TopBar from './TopBar';
import FleetStatusMini from './FleetStatusMini';

const NAV = [
  { to: '/topology',   icon: Network,      label: 'Topology'   },
  { to: '/migration',  icon: Layers,       label: 'Migration'  },
  { to: '/validation', icon: ShieldCheck,  label: 'Validation' },
  { to: '/logs',       icon: Terminal,     label: 'Logs'       },
  { to: '/audit',      icon: ScrollText,   label: 'Audit Log'  },
  { to: '/demo',       icon: Presentation, label: 'Demo'       },
];

export default function AppShell() {
  const location = useLocation();
  const activeLabel = NAV.find((n) => location.pathname.startsWith(n.to))?.label ?? 'Dashboard';

  return (
    <div className="flex h-screen bg-surface-base overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-surface-raised flex flex-col shrink-0 border-r border-surface-border">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-surface-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent-blue flex items-center justify-center">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-text-primary font-bold text-sm tracking-tight leading-none">MQ Control Plane</div>
              <div className="text-text-muted text-[11px] mt-0.5 leading-none">IBM MQ Migration v2</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }, idx) => (
            <NavLink
              key={to}
              to={to}
              style={{ animationDelay: `${idx * 35}ms` }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 animate-slide-in-left ${
                  isActive
                    ? 'bg-surface-overlay text-text-primary border border-surface-border shadow-card'
                    : 'text-text-secondary hover:bg-surface-card hover:text-text-primary'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {location.pathname.startsWith(to) && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom status */}
        <div className="px-4 py-4 border-t border-surface-border">
          <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-2.5">
            Fleet Status
          </div>
          <FleetStatusMini />
        </div>
      </aside>

      {/* Content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar pageTitle={activeLabel} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
