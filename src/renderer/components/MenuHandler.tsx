import React, { useState, useRef, useEffect } from 'react';
import MenuItem from './MenuItem';
import { MenuHandlerProps } from '../../types/menu';

function MenuHandler({ label, items }: MenuHandlerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={handleClick} className="px-3 text-sm hover:bg-gray-700 focus:outline-none">
        {label}
      </button>
      {isOpen && items && (
        <div className="absolute left-0 top-full w-48 bg-white shadow-lg rounded-md z-10">
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

export default MenuHandler;
