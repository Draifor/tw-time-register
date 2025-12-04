import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Square, X, Maximize2 } from 'lucide-react';

import Icon from '../assets/icons/Icon-Electron.png';
import MenuBar from './MenuBar';

function AppBar() {
  const [isMaximize, setMaximize] = useState(false);
  const { t } = useTranslation();

  const handleToggle = () => {
    setMaximize(!isMaximize);
    window.Main.Maximize();
  };

  const toggleDevTools = () => {
    window.Main.ToggleDevTools();
  };

  const menuItems = [
    {
      label: t('menu.file.file'),
      items: [
        { label: t('menu.file.new'), onClick: () => {} },
        { label: t('menu.file.open'), onClick: () => {} },
        { label: t('menu.file.save'), onClick: () => {} },
        {
          label: t('menu.file.export'),
          items: [
            { label: 'PDF', onClick: () => {} },
            { label: 'HTML', onClick: () => {} }
          ]
        }
      ]
    },
    {
      label: t('menu.edit.edit'),
      items: [
        { label: t('menu.edit.undo'), onClick: () => {} },
        { label: t('menu.edit.redo'), onClick: () => {} },
        { label: t('menu.edit.cut'), onClick: () => {} },
        { label: t('menu.edit.copy'), onClick: () => {} },
        { label: t('menu.edit.paste'), onClick: () => {} }
      ]
    },
    {
      label: t('menu.view.view'),
      items: [
        {
          label: t('menu.view.toggleDevTools'),
          onClick: () => toggleDevTools()
        },
        { label: t('menu.view.zoomIn'), onClick: () => {} },
        { label: t('menu.view.zoomOut'), onClick: () => {} },
        { label: t('menu.view.fullscreen'), onClick: () => {} }
      ]
    },
    {
      label: t('menu.help.help'),
      items: [
        { label: t('menu.help.documentation'), onClick: () => {} },
        { label: t('menu.help.about'), onClick: () => {} }
      ]
    }
  ];

  return (
    <div className="fixed top-0 w-full z-50">
      <div className="bg-slate-800 h-8 flex justify-between items-center draggable text-white">
        <div className="inline-flex items-center gap-1 pl-2">
          <img className="h-5 w-5" src={Icon} alt="TW Time Register" />
          <span className="text-sm font-medium">TW Time Register</span>
        </div>
        <div className="inline-flex h-full">
          <button
            onClick={window.Main.Minimize}
            className="undraggable w-12 h-full flex items-center justify-center hover:bg-slate-700 transition-colors"
            aria-label="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={handleToggle}
            className="undraggable w-12 h-full flex items-center justify-center hover:bg-slate-700 transition-colors"
            aria-label={isMaximize ? 'Restore' : 'Maximize'}
          >
            {isMaximize ? <Maximize2 className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={window.Main.Close}
            className="undraggable w-12 h-full flex items-center justify-center hover:bg-red-500 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <MenuBar items={menuItems} />
    </div>
  );
}

export default AppBar;
