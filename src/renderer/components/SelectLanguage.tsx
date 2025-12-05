import React, { useEffect } from 'react';
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
  const { i18n } = useTranslation();

  // Load language from DB on mount (only once)
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguage = await window.Main.getLanguage();
        if (savedLanguage && savedLanguage !== i18n.language) {
          i18n.changeLanguage(savedLanguage);
        }
      } catch (error) {
        console.error('Error loading language:', error);
      }
    };
    loadLanguage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const languageHandler = async (lang: string) => {
    i18n.changeLanguage(lang);
    try {
      await window.Main.setLanguage(lang);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  // Use i18n.language directly as source of truth
  const currentLanguage = languages.find((l) => l.key === i18n.language);

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
            className={`gap-2 cursor-pointer ${i18n.language === key ? 'bg-accent' : ''}`}
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
