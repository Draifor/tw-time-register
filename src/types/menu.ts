export interface MenuItemType {
  label: string;
  items?: MenuItemType[];
  action?: () => void;
}

export interface MenuBarProps {
  items: MenuItemType[];
}

export interface MenuHandlerProps {
  label: string;
  items?: MenuItemType[];
}

export interface MenuItemProps {
  label: string;
  items?: MenuItemType[];
  onClick?: () => void;
  setIsOpen: (isOpen: boolean) => void;
}
