import React from 'react';
import MenuHandler from './MenuHandler';

function MenuBar({ items }) {
  return (
    <div className="flex bg-slate-800 text-white">
      {items.map((item) => (
        <React.Fragment key={item.label}>
          <MenuHandler {...item} />
        </React.Fragment>
      ))}
    </div>
  );
}

export default MenuBar;
