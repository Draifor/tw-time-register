// @vitest-environment jsdom
/**
 * Regression cover for the two majors A4 moves together: react-router-dom 7 and
 * i18next 26 / react-i18next 17.
 *
 * The suite had no test that rendered the router and no test that asserted a
 * translated string, so a runtime break in either dependency could have shipped
 * with every gate green — the same class of gap as the React 19 date-field
 * regression. These tests render the real i18n instance (the app has no
 * I18nextProvider; it relies on the global registered by plugins/i18n) and a
 * real router under <React.StrictMode>, because that is how the app mounts
 * (src/renderer/main.tsx).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../../renderer/plugins/i18n';

function Strict({ children }: { children: React.ReactNode }) {
  return <React.StrictMode>{children}</React.StrictMode>;
}

function Section({ labelKey }: { labelKey: string }) {
  const { t } = useTranslation();
  return <h1>{t(labelKey)}</h1>;
}

function Layout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div>
      <Link to="/worktime">{t('nav.workTime')}</Link>
      <button type="button" onClick={() => navigate('/settings')}>
        {t('nav.settings')}
      </button>
      <Outlet />
    </div>
  );
}

function renderApp(initialEntry = '/') {
  return render(
    <Strict>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Section labelKey="nav.home" />} />
            <Route path="/worktime" element={<Section labelKey="nav.workTime" />} />
            <Route path="/settings" element={<Section labelKey="nav.settings" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Strict>
  );
}

describe('react-router-dom 7 + i18next 26 / react-i18next 17', () => {
  it('renders translated labels from the real i18n instance', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Work Time' })).toBeInTheDocument();
  });

  it('navigates with Link and useNavigate', () => {
    renderApp();

    fireEvent.click(screen.getByRole('link', { name: 'Work Time' }));
    expect(screen.getByRole('heading', { name: 'Work Time' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });

  it('interpolates translation values', () => {
    function Badge() {
      const { t } = useTranslation();
      return <span>{t('nav.connectedAs', { username: 'alice', domain: 'acme' })}</span>;
    }

    render(
      <Strict>
        <MemoryRouter>
          <Badge />
        </MemoryRouter>
      </Strict>
    );

    expect(screen.getByText('Connected as alice · acme.teamwork.com')).toBeInTheDocument();
  });
});
