import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import screenfull from 'screenfull';
import { logout } from '../features/auth/authSlice';
import logoExpanded from '../assets/images/logo.png'; // your normal logo
import logoCollapsed from '../assets/images/logoCollapsed.png'; // the one you want when collapsed

import { BsFullscreen } from 'react-icons/bs';
import { FaBars } from 'react-icons/fa';
import { Bell, BellRing } from 'lucide-react';
import type { RootState } from '../app/store';
import { BiChevronDown, BiLogOutCircle, BiUserCircle } from 'react-icons/bi';
import { toggleSidebar } from '../features/ui/uiSlice';
import {
  clearCriticalAlarms,
  markAllCriticalRead,
} from '../features/lib/criticalAlarmSlice';
import { useCriticalAlarmSubscription } from '../features/lib/useCriticalAlarmSubscription';
import CriticalAlarmToast from './CriticalAlarmToast';

const CRITICAL_DASHBOARD_PATH = '/critical-tag-dashboard';
const PREVIEW_COUNT = 5;

// collectorId / collectorName dynamic -> query string banave chhe
const buildCriticalDashboardPath = (
  collectorId?: number | string | null,
  collectorName?: string | null
): string => {
  if (collectorId == null || collectorId === '') {
    return CRITICAL_DASHBOARD_PATH;
  }

  const params = new URLSearchParams({ collectorId: String(collectorId) });
  if (collectorName) params.set('collectorName', collectorName);

  return `${CRITICAL_DASHBOARD_PATH}?${params.toString()}`;
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const Header = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [username, setUsername] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);

  // Backend (notificationHub) thi critical alarms sambhalva mate - app ma ek j var
  useCriticalAlarmSubscription();

  // grab collapsed state
  const isSidebarCollapsed = useSelector(
    (state: RootState) => state.ui.isSidebarCollapsed
  );

  const criticalAlarms = useSelector(
    (state: RootState) => state.criticalAlarms.alarms
  );
  const unreadCount = useSelector(
    (state: RootState) => state.criticalAlarms.unreadCount
  );

  const hasUnread = unreadCount > 0;
  const previewAlarms = criticalAlarms.slice(0, PREVIEW_COUNT);
  const latestAlarm = criticalAlarms[0];

  // Navo alert aave (unreadCount vadhe) tyare animation fari chalave
  const [bumpKey, setBumpKey] = useState(0);
  const prevUnreadRef = useRef(unreadCount);

  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setBumpKey((k) => k + 1);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

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
      const target = event.target as Node;

      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setDropdownOpen(false);
      }

      if (alertsRef.current && !alertsRef.current.contains(target)) {
        setAlertsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    dispatch(clearCriticalAlarms());
    dispatch(logout());
    navigate('/login', { replace: true });
  };

  const handleToggleAlerts = () => {
    setDropdownOpen(false);
    setAlertsOpen((prev) => {
      const next = !prev;
      // Panel khole etle user e alerts joya gana, badge clear
      if (next) dispatch(markAllCriticalRead());
      return next;
    });
  };

  const goToCriticalDashboard = (
    collectorId?: number | string | null,
    collectorName?: string | null
  ) => {
    setAlertsOpen(false);
    dispatch(markAllCriticalRead());
    navigate(buildCriticalDashboardPath(collectorId, collectorName));
  };

  return (
    <header className="relative bg-white dark:bg-gray-700 shadow-md z-40 px-4 py-2 flex items-center justify-between h-[70px]">
      <style>{`
        @keyframes badge-bump {
          0%   { transform: scale(1); }
          35%  { transform: scale(1.7); }
          65%  { transform: scale(0.85); }
          100% { transform: scale(1); }
        }
        .badge-bump { animation: badge-bump 0.5s ease-out; }

        @keyframes bell-shake {
          0%, 100% { transform: rotate(0); }
          15% { transform: rotate(18deg); }
          30% { transform: rotate(-16deg); }
          45% { transform: rotate(12deg); }
          60% { transform: rotate(-8deg); }
          75% { transform: rotate(4deg); }
        }
        .bell-shake {
          animation: bell-shake 0.7s ease-in-out;
          transform-origin: 50% 0%;
        }
      `}</style>

      {/* Critical alert accent bar (fakt jyare navi alerts hoy) */}
      {hasUnread && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[3px] animate-pulse bg-red-500"
        />
      )}

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
        {/* ====================================================== */}
        {/* CRITICAL ALERTS */}
        {/* ====================================================== */}
        <div className="flex items-center gap-3">
          {hasUnread && (
            <button
              type="button"
              onClick={() =>
                goToCriticalDashboard(
                  latestAlarm?.collectorId,
                  latestAlarm?.collectorName
                )
              }
              className="hidden items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[12px] font-bold text-red-600 transition hover:bg-red-100 lg:flex"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              {unreadCount > 99 ? '99+' : unreadCount} new critical{' '}
              {unreadCount === 1 ? 'alert' : 'alerts'}
            </button>
          )}

          <div className="relative" ref={alertsRef}>
            <button
              type="button"
              onClick={handleToggleAlerts}
              aria-haspopup="true"
              aria-expanded={alertsOpen}
              aria-label={
                hasUnread
                  ? `${unreadCount} new critical alerts`
                  : 'Critical alerts'
              }
              className={`relative flex h-10 w-10 items-center justify-center rounded-full transition ${
                hasUnread
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'text-gray-500 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {/* key badlay etle navo alert aave tyare bell pan hale */}
              <span
                key={`bell-${bumpKey}`}
                className={`flex items-center justify-center ${
                  hasUnread && bumpKey > 0 ? 'bell-shake' : ''
                }`}
              >
                {hasUnread ? <BellRing size={20} /> : <Bell size={20} />}
              </span>

              {hasUnread && (
                <span className="pointer-events-none absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center">
                  {/* ping ring */}
                  <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-60" />

                  {/* count: key badlay etle zoom in/out fari chale */}
                  <span
                    key={`badge-${bumpKey}`}
                    className="badge-bump relative flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-gray-700"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                </span>
              )}
            </button>

            {alertsOpen && (
              <div className="absolute right-0 z-50 mt-4 w-80 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-200 dark:bg-gray-700">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                  <p className="text-[13px] font-semibold text-slate-800">
                    Critical Alerts
                  </p>
                  <span className="text-[11px] font-medium text-slate-400">
                    {criticalAlarms.length} total
                  </span>
                </div>

                {previewAlarms.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-[13px] font-medium text-slate-500">
                      No critical alerts
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      You are all caught up.
                    </p>
                  </div>
                ) : (
                  <ul className="max-h-80 divide-y divide-gray-100 overflow-auto">
                    {previewAlarms.map((alarm) => (
                      <li key={alarm.id}>
                        <button
                          type="button"
                          onClick={() =>
                            goToCriticalDashboard(
                              alarm.collectorId,
                              alarm.collectorName
                            )
                          }
                          className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition hover:bg-red-50"
                        >
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />

                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-[12px] font-semibold text-slate-800">
                                {alarm.sourceName}
                              </span>
                              <span className="shrink-0 text-[10px] text-slate-400">
                                {formatTime(alarm.eventTimestamp)}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-[12px] text-slate-500">
                              {alarm.message}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={() => goToCriticalDashboard()}
                  className="w-full border-t border-gray-100 bg-slate-50 px-4 py-2.5 text-center text-[12px] font-semibold text-sky-700 transition hover:bg-sky-50"
                >
                  View all critical alarms
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => screenfull.isEnabled && screenfull.toggle()}
          className="text-gray-600 dark:text-gray-200 hover:text-black dark:hover:text-gray-200 text-xl hidden lg:block"
        >
          <BsFullscreen />
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => {
              setAlertsOpen(false);
              setDropdownOpen((prev) => !prev);
            }}
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

      <CriticalAlarmToast
        onOpen={(alarm) =>
          goToCriticalDashboard(alarm.collectorId, alarm.collectorName)
        }
      />
    </header>
  );
};

export default Header;
