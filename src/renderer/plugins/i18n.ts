import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Ship only the fallback language in the initial chunk. `es` is loaded on
// demand by `loadLanguage()` so it stays out of the eager renderer bundle.
import en from '../locales/en';

i18n
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    fallbackLng: 'en',
    lng: 'en',
    resources: { en },
    defaultNS: 'translations'
  });

/**
 * Load a language bundle on demand. Only Spanish has a lazy bundle today; `en`
 * is always available because it is the eager fallback. Safe to call more than
 * once — an already-loaded bundle is a no-op.
 */
export async function loadLanguage(lng: string): Promise<void> {
  if (i18n.hasResourceBundle(lng, 'translations')) return;

  if (lng.startsWith('es')) {
    const es = await import('../locales/es');
    i18n.addResourceBundle('es', 'translations', es.default.translations, true, true);
  }
}

export default i18n;
