import React from 'react';
import { Menu, MenuHandler, MenuList, MenuItem } from '@material-tailwind/react';

function RecursiveMenu({ items }) {
  return (
    <MenuList>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {item.items ? (
            <Menu placement="right-start">
              <MenuHandler>
                <MenuItem>{item.label}</MenuItem>
              </MenuHandler>
              <RecursiveMenu items={item.items} />
            </Menu>
          ) : (
            <MenuItem onClick={item.action}>{item.label}</MenuItem>
          )}
        </React.Fragment>
      ))}
    </MenuList>
  );
}

export default RecursiveMenu;
