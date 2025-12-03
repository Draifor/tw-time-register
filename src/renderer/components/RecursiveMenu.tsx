import React from 'react';
import { Menu, MenuHandler, MenuList, MenuItem } from '@material-tailwind/react';
import { MenuItemType } from '../../types/menu';

interface RecursiveMenuProps {
  items: MenuItemType[];
}

function RecursiveMenu({ items }: RecursiveMenuProps) {
  return (
    <MenuList
      placeholder={undefined}
      onPointerEnterCapture={undefined}
      onPointerLeaveCapture={undefined}
      onResize={undefined}
      onResizeCapture={undefined}
    >
      {items.map((item, index) => (
        <React.Fragment key={`menu-item-${item.label}-${index}`}>
          {item.items ? (
            <Menu placement="right-start">
              <MenuHandler>
                <MenuItem
                  placeholder={undefined}
                  onPointerEnterCapture={undefined}
                  onPointerLeaveCapture={undefined}
                  onResize={undefined}
                  onResizeCapture={undefined}
                >
                  {item.label}
                </MenuItem>
              </MenuHandler>
              <RecursiveMenu items={item.items} />
            </Menu>
          ) : (
            <MenuItem
              onClick={item.action}
              placeholder={undefined}
              onPointerEnterCapture={undefined}
              onPointerLeaveCapture={undefined}
              onResize={undefined}
              onResizeCapture={undefined}
            >
              {item.label}
            </MenuItem>
          )}
        </React.Fragment>
      ))}
    </MenuList>
  );
}

export default RecursiveMenu;
