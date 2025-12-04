import { ChevronRight } from 'lucide-react';
import React from 'react';
import { MenuItemProps } from '../../types/menu';

function MenuItem({ label, items, onClick, setIsOpen }: MenuItemProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
      setIsOpen(false);
    }
  };

  return (
    <div className="relative group">
      <button
        onClick={handleClick}
        className="flex items-center w-full px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none transition-colors"
      >
        {label}
        {items && <ChevronRight className="ml-auto h-4 w-4 opacity-70" />}
      </button>
      {items && (
        <div className="absolute left-full top-0 w-52 bg-popover border border-border shadow-lg rounded-md py-1 hidden group-hover:block">
          {items.map((item) => (
            <MenuItem
              key={item.label}
              label={item.label}
              items={item.items}
              onClick={item.action}
              setIsOpen={setIsOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default MenuItem;
