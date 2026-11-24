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
  BiLayer,
} from 'react-icons/bi';

import { setSidebarCollapsed } from '../features/ui/uiSlice';
import { createCrudApi } from '../features/lib/createCrudApi';
import { COLLECTORS_CHANGED_EVENT } from '../features/lib/collectorEvents';

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

interface Collector {
  collectorId: number;
  collectorName: string;
}

const collectorApi = createCrudApi('collector-configs');

const DASHBOARD_LINKS = [
  {
    label: 'Live Dashboard',
    path: '/live-dashboard',
  },
  {
    label: 'Critical Alarm Dashboard',
    path: '/critical-tag-dashboard',
  },
  {
    label: 'Alarm KPI Dashboard',
    path: '/alarm-kpi-dashboard',
  },
  {
    label: 'Rationalization Dashboard',
    path: '/rationalization-kpi-dashboard',
  },
  {
    label: 'Shift-wise Alarm Summary',
    path: '/shift-wise-alarm-summary',
  },
];

const menuItems: MenuItem[] = [
  {
    key: 'report',
    label: 'Report',
    icon: BiFile,
    path: '/reports',
  },
  {
    key: 'configuration',
    label: 'Configuration',
    icon: BiCog,
    subItems: [
      { label: 'Plant Master', path: '/plant' },
      { label: 'Area Master', path: '/area' },
      { label: 'Console Master', path: '/console' },
      { label: 'Source Master', path: '/source' },
      { label: 'Lookup Master', path: '/lookup' },
      { label: 'Connection List', path: '/connection-list' },
      { label: 'Parsing', path: '/parsing-config' },
      { label: 'Email Configuration', path: '/email-configuration' },
      { label: 'Critical Tags Config', path: '/critical-tags-config' },
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

function buildCollectorDashboardPath(
  path: string,
  collector: Collector
): string {
  const params = new URLSearchParams({
    collectorId: String(collector.collectorId),
    collectorName: collector.collectorName,
  });

  return `${path}?${params.toString()}`;
}

export default function Sidebar() {
  const dispatch = useDispatch();
  const { pathname, search } = useLocation();
  const isCollapsed = useSelector(
    (state: RootState) => state.ui.isSidebarCollapsed
  );

  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [collectorLoading, setCollectorLoading] = useState(false);
  const [collectorError, setCollectorError] = useState<string | null>(null);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openCollectors, setOpenCollectors] = useState<Record<number, boolean>>(
    {}
  );
  const [hoverInfo, setHoverInfo] = useState<HoverPos | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimeout = useRef<number | null>(null);

  const selectedCollectorId = new URLSearchParams(search).get('collectorId');
  const selectedCollectorName = new URLSearchParams(search).get(
    'collectorName'
  );

  const isDashboardActive =
    pathname === '/home' ||
    DASHBOARD_LINKS.some((dashboard) => pathname.startsWith(dashboard.path));

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
    let isMounted = true;

    const fetchCollectors = async (showLoader = true) => {
      if (showLoader) setCollectorLoading(true);
      setCollectorError(null);

      try {
        const response = await collectorApi.get<unknown>(
          'data?includeInactive=false'
        );

        const json = response.data;

        const rawList = Array.isArray(json)
          ? json
          : typeof json === 'object' && json !== null && 'data' in json
            ? (json as { data?: unknown }).data
            : [];

        const list = Array.isArray(rawList)
          ? rawList
              .map((item) => {
                if (
                  typeof item !== 'object' ||
                  item === null ||
                  !('collectorId' in item) ||
                  !('collectorName' in item)
                ) {
                  return null;
                }

                const collectorId = Number(
                  (item as { collectorId: unknown }).collectorId
                );

                const collectorName = String(
                  (item as { collectorName: unknown }).collectorName ?? ''
                ).trim();

                if (!Number.isFinite(collectorId) || !collectorName) {
                  return null;
                }

                return { collectorId, collectorName } satisfies Collector;
              })
              .filter((item): item is Collector => item !== null)
          : [];

        if (isMounted) setCollectors(list);
      } catch (error) {
        console.error('Collector list fetch failed:', error);

        if (isMounted) {
          setCollectors([]);
          setCollectorError(
            error instanceof Error ? error.message : 'Failed to load collectors'
          );
        }
      } finally {
        if (isMounted && showLoader) setCollectorLoading(false);
      }
    };

    fetchCollectors();

    // delete / add / edit pachi silent refresh (loader flash na thay)
    const handleCollectorsChanged = () => fetchCollectors(false);
    window.addEventListener(COLLECTORS_CHANGED_EVENT, handleCollectorsChanged);

    return () => {
      isMounted = false;
      window.removeEventListener(
        COLLECTORS_CHANGED_EVENT,
        handleCollectorsChanged
      );
    };
  }, []);

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

      newOpenState.dashboards = isDashboardActive;
      setOpenSections(newOpenState);

      setOpenCollectors(() => {
        const next: Record<number, boolean> = {};
        const collectorId = Number(selectedCollectorId);

        collectors.forEach((collector) => {
          next[collector.collectorId] =
            Boolean(selectedCollectorId) &&
            Number.isFinite(collectorId) &&
            collector.collectorId === collectorId;
        });

        return next;
      });

      setHoverInfo(null);
    }
  }, [
    pathname,
    search,
    isCollapsed,
    isDashboardActive,
    selectedCollectorId,
    collectors,
  ]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const isCurrentlyOpen = !!prev[key];
      const next: Record<string, boolean> = {};

      Object.keys(prev).forEach((sectionKey) => {
        next[sectionKey] = false;
      });

      next[key] = !isCurrentlyOpen;
      return next;
    });
  };

  const toggleCollector = (collectorId: number) => {
    setOpenCollectors((prev) => {
      const isCurrentlyOpen = !!prev[collectorId];
      const next: Record<number, boolean> = {};

      collectors.forEach((collector) => {
        next[collector.collectorId] = false;
      });

      next[collectorId] = !isCurrentlyOpen;
      return next;
    });
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

  const renderCollectorLinks = (collapsed = false) => {
    if (collectorLoading) {
      return (
        <div
          className={
            collapsed
              ? 'px-4 py-3 text-xs text-slate-400'
              : 'px-2 py-2 text-[11px] text-slate-400'
          }
        >
          Loading collectors...
        </div>
      );
    }

    if (collectorError) {
      return (
        <div
          className={
            collapsed
              ? 'px-4 py-3 text-xs text-red-500'
              : 'px-2 py-2 text-[11px] text-red-500'
          }
        >
          Unable to load collectors
        </div>
      );
    }

    if (collectors.length === 0) {
      return (
        <div
          className={
            collapsed
              ? 'px-4 py-3 text-xs text-slate-400'
              : 'px-2 py-2 text-[11px] text-slate-400'
          }
        >
          No collectors available
        </div>
      );
    }

    return collectors.map((collector) => {
      const isOpen = !!openCollectors[collector.collectorId];

      return (
        <li key={collector.collectorId} className={collapsed ? 'mb-1' : 'mb-1'}>
          <button
            type="button"
            onClick={() => toggleCollector(collector.collectorId)}
            className={
              collapsed
                ? 'flex w-full items-center rounded px-4 py-2 text-left text-xs font-semibold text-slate-600 transition hover:bg-gray-100'
                : 'flex w-full items-center rounded px-2 py-1.5 text-left text-xs font-semibold text-slate-600 transition hover:bg-gray-100'
            }
            title={collector.collectorName}
          >
            <BiLayer className="mr-1 shrink-0 text-sm text-slate-500" />

            <span className="min-w-0 flex-1 truncate">
              {collector.collectorName}
            </span>

            <BiChevronDown
              size={16}
              className={`ml-2 shrink-0 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isOpen && (
            <ul className={collapsed ? 'mt-0.5' : 'mt-0.5 space-y-0.5'}>
              {DASHBOARD_LINKS.map((dashboard) => {
                const to = buildCollectorDashboardPath(
                  dashboard.path,
                  collector
                );
                const isActive =
                  pathname === dashboard.path &&
                  String(collector.collectorId) === selectedCollectorId &&
                  collector.collectorName === selectedCollectorName;

                return (
                  <li key={`${collector.collectorId}-${dashboard.path}`}>
                    <NavLink
                      to={to}
                      className={`block rounded px-2 ms-6 py-1 text-[11px] transition hover:bg-sky-50 ${
                        isActive ? 'bg-sky-50 font-semibold text-sky-700' : ''
                      } ${collapsed ? 'px-4 py-2' : ''}`}
                      title={`${collector.collectorName} - ${dashboard.label}`}
                    >
                      {dashboard.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      );
    });
  };

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
            {/* ====================================================== */}
            {/* DASHBOARDS */}
            {/* ====================================================== */}
            <li
              onMouseEnter={(e) => handleMouseEnter('dashboards', e)}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={() => toggleSection('dashboards')}
                className={`flex items-center w-full px-4 py-2 rounded-md transition hover:bg-gray-100 ${
                  !isCollapsed && isDashboardActive ? activeBtnClasses : ''
                } ${
                  isCollapsed && hoverInfo?.key === 'dashboards'
                    ? 'bg-gray-200'
                    : ''
                }`}
              >
                <BiHomeCircle className="mr-2 text-lg" />

                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left">Dashboards</span>
                    <BiChevronDown
                      size={20}
                      className={`ml-auto transition-transform duration-200 ${
                        openSections.dashboards ? 'rotate-180' : ''
                      }`}
                    />
                  </>
                )}
              </button>

              {!isCollapsed && openSections.dashboards && (
                <ul className="pl-4 mt-1 space-y-1 text-xs text-gray-600">
                  {renderCollectorLinks(false)}
                </ul>
              )}
            </li>

            {/* ====================================================== */}
            {/* OTHER MENU ITEMS */}
            {/* ====================================================== */}
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
                      className={`flex items-center w-full px-4 py-2 rounded-md transition hover:bg-gray-100 ${
                        !isCollapsed && isActive ? activeBtnClasses : ''
                      } ${
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
                      className={({ isActive: navIsActive }) =>
                        `flex items-center w-full px-4 py-2 rounded-md transition hover:bg-gray-100 ${
                          navIsActive ? activeBtnClasses : ''
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
                    <ul className="pl-10 mt-1 space-y-1 text-xs text-gray-600">
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
          style={{ top: hoverInfo.top, left: '100%', width: 290 }}
          onMouseEnter={() => {
            clearHideTimeout();
            setHoverInfo(hoverInfo);
          }}
          onMouseLeave={handleMouseLeave}
        >
          {hoverInfo.key === 'dashboards' ? (
            <>
              <div className="flex items-center px-4 py-2 border-b text-gray-800 font-semibold bg-gray-50">
                <BiHomeCircle className="mr-2" />
                Dashboards
              </div>

              <div className="max-h-[calc(100vh-2rem)] overflow-y-auto py-2 text-sm text-gray-700">
                <ul>{renderCollectorLinks(true)}</ul>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center px-4 py-2 border-b text-gray-800 font-semibold bg-gray-50">
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
                  }

                  if (item.path) {
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
