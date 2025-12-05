import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';

const languages = [
  {
    value: 'English',
    key: 'en',
    iconPath: new URL(`../assets/locales/en.svg`, import.meta.url).href
  },
  {
    value: 'Español',
    key: 'es',
    iconPath: new URL(`../assets/locales/es.svg`, import.meta.url).href
  }
];

function SelectLanguage() {
  const [language, setLanguage] = React.useState('en');
  const { i18n } = useTranslation();

  const languageHandler = (lang: string) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  const currentLanguage = languages.find((l) => l.key === language);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {currentLanguage ? (
            <img src={currentLanguage.iconPath} alt={currentLanguage.value} className="h-4 w-4 rounded-full" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{currentLanguage?.value || 'Language'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map(({ value, key, iconPath }) => (
          <DropdownMenuItem
            key={key}
            onClick={() => languageHandler(key)}
            className={`gap-2 cursor-pointer ${language === key ? 'bg-accent' : ''}`}
          >
            <img src={iconPath} alt={value} className="h-4 w-4 rounded-full" />
            {value}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default SelectLanguage;
