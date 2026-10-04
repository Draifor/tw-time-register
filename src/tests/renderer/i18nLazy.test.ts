// @vitest-environment jsdom
/**
 * Contract cover for lazy language loading (PERF-504).
 *
 * Only the `en` fallback bundle ships in the initial chunk; the `es` bundle is
 * pulled on demand by `loadLanguage()`. These tests pin that contract: `es` is
 * absent until requested, `loadLanguage('es')` installs the real bundle, and
 * switching language then yields the Spanish value the locale module actually
 * defines. Asserting against the imported locale module keeps the expectation
 * honest without guessing a translated string.
 */
import { describe, it, expect } from 'vitest';
import i18n, { loadLanguage } from '../../renderer/plugins/i18n';
import es from '../../renderer/locales/es';

describe('lazy i18n language loading', () => {
  it('ships only the fallback bundle until loadLanguage runs', async () => {
    expect(i18n.hasResourceBundle('en', 'translations')).toBe(true);
    expect(i18n.hasResourceBundle('es', 'translations')).toBe(false);

    await loadLanguage('es');
    expect(i18n.hasResourceBundle('es', 'translations')).toBe(true);

    await i18n.changeLanguage('es');
    expect(i18n.t('nav.home')).toBe(es.translations.nav.home);
  });

  it('is idempotent and safe for the eager fallback', async () => {
    await loadLanguage('es');
    await loadLanguage('es');
    await loadLanguage('en');

    expect(i18n.hasResourceBundle('es', 'translations')).toBe(true);
    expect(i18n.hasResourceBundle('en', 'translations')).toBe(true);
  });
});
