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
        className="flex items-center w-full px-4 py-1 text-sm text-gray-700 hover:gray-100 focus:outline-none"
      >
        {label}
        {items && <ChevronRight className="ml-auto h-4 w-4" />}
      </button>
      {items && (
        <div className="absolute left-full top-0 w-48 bg-white shadow-lg rounded-md hidden group-hover:block">
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
