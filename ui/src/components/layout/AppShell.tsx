import { NavLink, Outlet } from 'react-router-dom';
import { Network, Layers, ShieldCheck, ScrollText } from 'lucide-react';
import TopBar from './TopBar';
import FleetStatusMini from './FleetStatusMini';

const NAV = [
  { to: '/topology',   icon: Network,      label: 'Topology'   },
  { to: '/migration',  icon: Layers,       label: 'Migration'  },
  { to: '/validation', icon: ShieldCheck,  label: 'Validation' },
  { to: '/audit',      icon: ScrollText,   label: 'Audit Log'  },
];

export default function AppShell() {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="text-white font-bold text-sm tracking-tight">MQ Control Plane</div>
          <div className="text-slate-400 text-xs mt-0.5">IBM MQ Migration v2</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150
                ${isActive
                  ? 'bg-slate-700 text-white shadow-inner'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }
              `}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom status */}
        <div className="px-4 py-4 border-t border-slate-800">
          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">
            Fleet Status
          </div>
          <FleetStatusMini />
        </div>
      </aside>

      {/* Content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
