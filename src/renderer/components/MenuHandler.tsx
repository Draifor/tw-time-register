import React, { useState, useRef, useEffect } from 'react';
import MenuItem from './MenuItem';

function MenuHandler({ label, items }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  const handleClickOutside = (event) => {
    if (menuRef.current && !menuRef.current.contains(event.target)) {
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
            <MenuItem key={item.label} {...item} setIsOpen={setIsOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

export default MenuHandler;
