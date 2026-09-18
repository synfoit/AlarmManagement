// Sidebar.tsx
import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../app/store';
import type { ComponentType } from 'react';

import {
  BiHomeCircle,
  BiChevronDown,
  BiFile,
  BiUserCircle,
  BiCog,
  BiPackage,
  BiLayer,
  BiTransfer,
  BiBarChartSquare,
} from 'react-icons/bi';

import { setSidebarCollapsed } from '../features/ui/uiSlice';

interface HoverPos {
  top: number;
  key: string;
}

interface MenuItem {
  key: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  path?: string;
  subItems?: {
    label: string;
    path: string;
  }[];
}

const menuItems: MenuItem[] = [
  {
    key: 'servilink',
    label: 'Dashboards',
    icon: BiHomeCircle,
    subItems: [
      { label: 'Alarm Dashboard', path: '/home' },
      { label: 'Alarm KPI Dashboard', path: '/alarm-kpi-dashboard' },
      {
        label: 'Rationalization Dashboard',
        path: '/rationalization-kpi-dashboard',
      },
      {
        label: 'Shift-wise Alarm Summary',
        path: '/shift-wise-alarm-summary',
      },
    ],
  },
  // {
  //   key: 'servilink',
  //   label: 'Dashboard',
  //   icon: BiHomeCircle,
  //   path: '/home',
  // },

  {
    key: 'reports',
    label: 'Reports',
    icon: BiFile,
    subItems: [
      { label: 'Base Oil Report', path: '/base-oil-report' },
      { label: 'Product List Report', path: '/product-list-report' },
      // { label: 'Dosing Report', path: '/dosing-report' },
    ],
  },

  // {
  //   key: 'pigging-report',
  //   label: 'Pigging Report',
  //   icon: BiTransfer,
  //   path: '/pigging-report',
  // },
  {
    key: 'configuration',
    label: 'Configuration',
    icon: BiCog,
    subItems: [
      { label: 'Blender Config', path: '/blender-list' },
      { label: 'Connector Settings', path: '/connector-settings' },
    ],
  },
  {
    key: 'users',
    label: 'Users',
    icon: BiUserCircle,
    subItems: [
      { label: 'Manage Users', path: '/manage-user' },
      { label: 'View Users', path: '/user-list' },
    ],
  },
];

export default function Sidebar() {
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const isCollapsed = useSelector(
    (state: RootState) => state.ui.isSidebarCollapsed
  );

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [hoverInfo, setHoverInfo] = useState<HoverPos | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimeout = useRef<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      dispatch(setSidebarCollapsed(isMobile));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dispatch]);

  useEffect(() => {
    if (!isCollapsed) {
      const newOpenState: Record<string, boolean> = {};
      for (const item of menuItems) {
        if (item.subItems) {
          newOpenState[item.key] = item.subItems.some((sub) =>
            pathname.startsWith(sub.path)
          );
        }
      }
      setOpenSections(newOpenState);
      setHoverInfo(null);
    }
  }, [pathname, isCollapsed]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const clearHideTimeout = () => {
    if (hideTimeout.current) {
      window.clearTimeout(hideTimeout.current);
      hideTimeout.current = null;
    }
  };

  const handleMouseEnter = (key: string, e: React.MouseEvent) => {
    if (!isCollapsed) return;
    clearHideTimeout();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHoverInfo({
      top: rect.top - (containerRef.current?.getBoundingClientRect().top || 0),
      key,
    });
  };

  const handleMouseLeave = () => {
    if (!isCollapsed) return;
    clearHideTimeout();
    hideTimeout.current = window.setTimeout(() => {
      setHoverInfo(null);
    }, 200);
  };

  const activeBtnClasses = 'bg-sky-50 text-sky-700 font-semibold ';

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={`bg-white shadow-md transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        } h-full overflow-hidden`}
      >
        <div className="overflow-y-auto h-full px-2 py-4">
          <ul className="space-y-2 text-sm font-semibold text-gray-600">
            {menuItems.map((item) => {
              const isActive = item.subItems
                ? item.subItems.some((sub) => pathname.startsWith(sub.path))
                : pathname === item.path;

              const Icon = item.icon;

              return (
                <li
                  key={item.key}
                  onMouseEnter={(e) => handleMouseEnter(item.key, e)}
                  onMouseLeave={handleMouseLeave}
                >
                  {item.subItems ? (
                    <button
                      onClick={() => toggleSection(item.key)}
                      className={`flex items-center w-full px-4 py-2 rounded-md transition hover:bg-gray-100
                        ${!isCollapsed && isActive ? activeBtnClasses : ''}
                        ${
                          isCollapsed && hoverInfo?.key === item.key
                            ? 'bg-gray-200'
                            : ''
                        }`}
                    >
                      <Icon className="mr-2 text-lg" />
                      {!isCollapsed && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          <BiChevronDown
                            size={20}
                            className={`ml-auto transition-transform duration-200 ${
                              openSections[item.key] ? 'rotate-180' : ''
                            }`}
                          />
                        </>
                      )}
                    </button>
                  ) : (
                    <NavLink
                      to={item.path || '#'}
                      className={({ isActive }) =>
                        `flex items-center w-full px-4 py-2 rounded-md transition hover:bg-gray-100 ${
                          isActive ? activeBtnClasses : ''
                        } ${
                          isCollapsed && hoverInfo?.key === item.key
                            ? 'bg-gray-200'
                            : ''
                        }`
                      }
                    >
                      <Icon className="mr-2 text-lg" />
                      {!isCollapsed && (
                        <span className="flex-1 text-left">{item.label}</span>
                      )}
                    </NavLink>
                  )}
                  {!isCollapsed && item.subItems && openSections[item.key] && (
                    <ul className="pl-10 mt-1 space-y-1 text-sm text-gray-600">
                      {item.subItems.map((sub) => (
                        <li key={sub.path}>
                          <NavLink
                            to={sub.path}
                            className={({ isActive }) =>
                              `block px-2 py-1 rounded hover:bg-sky-50 ${
                                isActive ? 'text-sky-700 font-semibold' : ''
                              }`
                            }
                          >
                            {sub.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Floating menu on hover when collapsed */}
      {isCollapsed && hoverInfo && (
        <div
          className="absolute bg-white shadow-lg rounded-md overflow-hidden z-10"
          style={{ top: hoverInfo.top, left: '100%', width: 200 }}
          onMouseEnter={() => {
            clearHideTimeout();
            setHoverInfo(hoverInfo);
          }}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex items-center px-4 py-2 border-b text-gray-800 font-semibold bg-gray-50">
            <>
              {(() => {
                const item = menuItems.find((i) => i.key === hoverInfo.key);
                if (!item) return null;
                const Icon = item.icon;
                return (
                  <>
                    <Icon className="mr-2" />
                    {item.label}
                  </>
                );
              })()}
            </>
          </div>
          <ul className="py-2 text-sm text-gray-700">
            {(() => {
              const item = menuItems.find((i) => i.key === hoverInfo.key);
              if (!item) return null;
              if (item.subItems) {
                return item.subItems.map((sub) => (
                  <li key={sub.path}>
                    <NavLink
                      to={sub.path}
                      className={({ isActive }) =>
                        `block px-4 py-2 hover:bg-gray-50 ${
                          isActive ? activeBtnClasses : ''
                        }`
                      }
                    >
                      {sub.label}
                    </NavLink>
                  </li>
                ));
              } else if (item.path) {
                return (
                  <li>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        `block px-4 py-2 hover:bg-gray-50 ${
                          isActive ? activeBtnClasses : ''
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                );
              }
              return null;
            })()}
          </ul>
        </div>
      )}
    </div>
  );
}
