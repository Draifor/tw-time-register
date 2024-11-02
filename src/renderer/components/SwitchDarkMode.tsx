import React from 'react';
import '../styles/switch_dark_mode.css';
import useDarkMode from '../hooks/useDarkMode';

const svgMoon = new URL(`../assets/moon.svg`, import.meta.url).href;
const svgSun = new URL(`../assets/sun.svg`, import.meta.url).href;

function SwitchDarkMode() {
  const { isDark, darkModeHandler } = useDarkMode();

  return (
    // https://uiverse.io/andrew-demchenk0/honest-stingray-90
    <label className="switch" htmlFor="checkbox">
      <span className="moon">
        <img src={svgMoon} alt="moon" />
      </span>
      <span className="sun">
        <img src={svgSun} alt="sun" />
      </span>
      <input id="checkbox" type="checkbox" className="input" checked={isDark} onChange={darkModeHandler} />
      <span className="slider" />
    </label>
  );
}

export default SwitchDarkMode;
