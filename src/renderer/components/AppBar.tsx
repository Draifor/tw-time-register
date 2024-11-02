import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import Icon from '../assets/icons/Icon-Electron.png';
import MenuBar from './MenuBar';

function AppBar() {
  const [isMaximize, setMaximize] = useState(false);
  const { t } = useTranslation();

  const handleToggle = () => {
    if (isMaximize) {
      setMaximize(false);
    } else {
      setMaximize(true);
    }
    window.Main.Maximize();
  };

  const toggleDevTools = () => {
    window.Main.ToggleDevTools();
  };

  const menuItems = [
    {
      label: t('menu.file.file'),
      items: [
        { label: t('menu.file.new'), onClick: () => console.log(t('menu.file.new')) },
        { label: t('menu.file.open'), onClick: () => console.log(t('menu.file.open')) },
        { label: t('menu.file.save'), onClick: () => console.log(t('menu.file.save')) },
        {
          label: t('menu.file.export'),
          items: [
            { label: 'PDF', onClick: () => console.log(t('menu.file.export'), 'PDF') },
            { label: 'HTML', onClick: () => console.log(t('menu.file.export'), 'HTML') }
          ]
        }
      ]
    },
    {
      label: t('menu.edit.edit'),
      items: [
        { label: t('menu.edit.undo'), onClick: () => console.log(t('menu.edit.undo')) },
        { label: t('menu.edit.redo'), onClick: () => console.log(t('menu.edit.redo')) },
        { label: t('menu.edit.cut'), onClick: () => console.log(t('menu.edit.cut')) },
        { label: t('menu.edit.copy'), onClick: () => console.log(t('menu.edit.copy')) },
        { label: t('menu.edit.paste'), onClick: () => console.log(t('menu.edit.paste')) }
      ]
    },
    {
      label: t('menu.view.view'),
      items: [
        {
          label: t('menu.view.toggleDevTools'),
          onClick: () => toggleDevTools()
        },
        { label: t('menu.view.zoomIn'), onClick: () => console.log(t('menu.view.zoomIn')) },
        { label: t('menu.view.zoomOut'), onClick: () => console.log(t('menu.view.zoomOut')) },
        { label: t('menu.view.fullscreen'), onClick: () => console.log(t('menu.view.fullscreen')) }
      ]
    },
    {
      label: t('menu.help.help'),
      items: [
        { label: t('menu.help.documentation'), onClick: () => console.log(t('menu.help.documentation')) },
        { label: t('menu.help.about'), onClick: () => console.log(t('menu.help.about')) }
      ]
    }
  ];
  return (
    <div className="fixed top-0 w-full z-50">
      <div className="bg-slate-800 py-0.5 flex justify-between draggable text-white">
        <div className="inline-flex">
          <img className="h-6 lg:-ml-2" src={Icon} alt="Icon of Electron" />
          <p className="text-xs md:pt-1 md:-ml-1 lg:-ml-2">Vite App</p>
        </div>
        <div className="inline-flex -mt-1">
          <button onClick={window.Main.Minimize} className="undraggable md:px-4 lg:px-3 pt-1 hover:bg-gray-300">
            &#8211;
          </button>
          <button onClick={handleToggle} className="undraggable px-6 lg:px-5 pt-1 hover:bg-gray-300">
            {isMaximize ? '\u2752' : '⃞'}
          </button>
          <button onClick={window.Main.Close} className="undraggable px-4 pt-1 hover:bg-red-500 hover:text-white">
            &#10005;
          </button>
        </div>
      </div>
      <div className="flex flex-col">
        <MenuBar items={menuItems} />
      </div>
    </div>
  );
}

export default AppBar;
