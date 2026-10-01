import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sprout, LayoutDashboard, Users, ShoppingCart, Truck, Brain } from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/farmers', label: 'Farmers', icon: Users },
  { path: '/buyers', label: 'Buyers', icon: ShoppingCart },
  { path: '/transport', label: 'Transport', icon: Truck },
  { path: '/coordination', label: 'AI Coordination', icon: Brain },
];

export default function Navbar() {
  const location = useLocation();

  return (
    <nav className="glass sticky top-0 z-50 shadow-card" id="main-navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group" id="nav-logo">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-glow group-hover:scale-105 transition-transform">
              <Sprout className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg leading-none text-primary-900 tracking-tight">
                HarvestFlow
              </span>
              <span className="text-[10px] font-semibold text-primary-600 tracking-widest uppercase">
                .ai
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 shadow-sm'
                      : 'text-stone-600 hover:text-primary-700 hover:bg-primary-50/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-primary-600' : ''}`} />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`p-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-stone-500 hover:text-primary-600'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
