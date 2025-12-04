import React from 'react';
import { Link } from 'react-router-dom';
import SwitchDarkMode from './SwitchDarkMode';
import SelectLanguage from './SelectLanguage';

function NavBar() {
  return (
    //   <div className="flex-auto">
    //   <div className="ml-4 mr-4 mt-4 flex items-center justify-between">
    //     <SwitchDarkMode />
    //     <SelectLanguage />
    //   </div>
    // </div>
    <div className="flex bg-slate-800 text-white">
      <div className="flex items-center justify-between w-full max-w-6xl mx-auto px-4">
        <div className="flex items-center">
          <h1 className="text-xl font-bold">Time Tracker</h1>
        </div>
        <nav className="ml-4">
          <Link to="/" className="mr-4">
            Home
          </Link>{' '}
          |{' '}
          <Link to="/worktime" className="ml-4 mr-4">
            Work Time
          </Link>{' '}
          |{' '}
          <Link to="/tasks" className="ml-4 mr-4">
            Tasks
          </Link>
        </nav>
        <SwitchDarkMode />
        <SelectLanguage />
        <div className="flex items-center">
          <button className="px-4 py-2 bg-blue-500 rounded">Login</button>
        </div>
      </div>
    </div>
  );
}

export default NavBar;
