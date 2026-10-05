import React from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/switch_dark_mode.css';
import useDarkMode from '../hooks/useDarkMode';

const svgMoon = new URL(`../assets/moon.svg`, import.meta.url).href;
const svgSun = new URL(`../assets/sun.svg`, import.meta.url).href;

function SwitchDarkMode() {
  const { t } = useTranslation();
  const { isDark, darkModeHandler } = useDarkMode();

  return (
    // https://uiverse.io/andrew-demchenk0/honest-stingray-90
    <label className="switch" htmlFor="checkbox">
      <span className="moon">
        <img src={svgMoon} alt="" />
      </span>
      <span className="sun">
        <img src={svgSun} alt="" />
      </span>
      <input
        id="checkbox"
        type="checkbox"
        className="input"
        checked={isDark}
        onChange={darkModeHandler}
        aria-label={t('common.toggleDarkMode')}
      />
      <span className="slider" />
    </label>
  );
}

export default SwitchDarkMode;
