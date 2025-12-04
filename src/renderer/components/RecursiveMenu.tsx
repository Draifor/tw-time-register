import React from 'react';
import { Menu, MenuHandler, MenuList, MenuItem } from '@material-tailwind/react';
import { MenuItemType } from '../../types/menu';

interface RecursiveMenuProps {
  items: MenuItemType[];
}

function RecursiveMenu({ items }: RecursiveMenuProps) {
  const MenuListAny = MenuList as any;
  const MenuItemAny = MenuItem as any;

  return (
    <MenuListAny>
      {items.map((item, index) => (
        <React.Fragment key={`menu-item-${item.label}-${index}`}>
          {item.items ? (
            <Menu placement="right-start">
              <MenuHandler>
                <MenuItemAny>{item.label}</MenuItemAny>
              </MenuHandler>
              <RecursiveMenu items={item.items} />
            </Menu>
          ) : (
            <MenuItemAny onClick={item.action}>{item.label}</MenuItemAny>
          )}
        </React.Fragment>
      ))}
    </MenuListAny>
  );
}

export default RecursiveMenu;
