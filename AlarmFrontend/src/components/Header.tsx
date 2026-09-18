import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import screenfull from 'screenfull';
import { logout } from '../features/auth/authSlice';
import logoExpanded from '../assets/images/logo.png'; // your normal logo
import logoCollapsed from '../assets/images/logoCollapsed.png'; // the one you want when collapsed

import { BsFullscreen } from 'react-icons/bs';
import { FaBars } from 'react-icons/fa';
import type { RootState } from '../app/store';
import { BiChevronDown, BiLogOutCircle, BiUserCircle } from 'react-icons/bi';
import { toggleSidebar } from '../features/ui/uiSlice';

const Header = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [username, setUsername] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // grab collapsed state
  const isSidebarCollapsed = useSelector(
    (state: RootState) => state.ui.isSidebarCollapsed
  );

  useEffect(() => {
    const stored = localStorage.getItem('name');
    if (stored) setUsername(stored);
  }, []);
  useEffect(() => {
    const stored = localStorage.getItem('role');
    if (stored) setUserRole(stored);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login', { replace: true });
  };

  return (
    <header className="bg-white dark:bg-gray-700 shadow-md z-10 px-4 py-2 flex items-center justify-between h-[70px]">
      {/* Left Side */}
      <div className="flex items-center">
        <div
          className={`${
            isSidebarCollapsed ? 'w-[80px]' : 'w-[246px]'
          } flex items-center justify-center transition-all duration-300`}
        >
          <a href="/" className="block">
            <img
              src={isSidebarCollapsed ? logoCollapsed : logoExpanded}
              alt="Logo"
              className={`mx-auto pr-4 transition-all duration-300 ${
                isSidebarCollapsed ? 'h-5 pr-6' : 'h-12'
              }`}
            />
          </a>
        </div>
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="ml-2 text-gray-600 dark:text-gray-200 hover:text-black hover:text-sky-700 text-xl"
        >
          <FaBars className="text-base" />
        </button>
      </div>

      {/* Right Side */}
      <div className="flex items-center space-x-6">
        <button
          onClick={() => screenfull.isEnabled && screenfull.toggle()}
          className="text-gray-600 dark:text-gray-200 hover:text-black dark:hover:text-gray-200 text-xl hidden lg:block"
        >
          <BsFullscreen />
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center space-x-1 text-gray-500 dark:text-gray-200 hover:text-black"
          >
            <BiUserCircle className="text-base text-gray-500 dark:text-gray-200" />
            <span className="hidden xl:inline-block text-sm font-medium text-gray-500 dark:text-gray-200 capitalize">
              {username || 'UserName'} |{' '}
              <span className="text-sky-700 ">{userRole || 'User'}</span>
            </span>
            <BiChevronDown className="text-lg text-gray-500 dark:text-gray-200" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-6 w-40 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-200 rounded-md shadow-lg z-50">
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 text-sm text-red-500 hover:bg-sky-50 hover:bg-gray-600 flex items-center space-x-2"
              >
                <BiLogOutCircle className="rotate-90" />
                <span className="py-1">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
