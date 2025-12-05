import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Clock, ListTodo, Home, Settings } from 'lucide-react';
import SwitchDarkMode from './SwitchDarkMode';
import SelectLanguage from './SelectLanguage';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

function NavBar() {
  const location = useLocation();

  const navItems = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/worktime', label: 'Work Time', icon: Clock },
    { to: '/tasks', label: 'Tasks', icon: ListTodo },
    { to: '/settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div className="border-b bg-background">
      <div className="flex items-center justify-between h-14 px-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold">TW Time Register</h1>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <Link key={item.to} to={item.to}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn('gap-2', isActive && 'bg-secondary')}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <SwitchDarkMode />
          <SelectLanguage />
        </div>
      </div>
    </div>
  );
}

export default NavBar;
