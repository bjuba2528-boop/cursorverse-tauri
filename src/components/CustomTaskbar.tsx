import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './CustomTaskbar.css';

interface WindowInfo {
  hwnd: number;
  title: string;
  exe_path: string;
  icon_base64: string;
  is_visible: boolean;
  is_minimized: boolean;
}

interface PinnedApp {
  name: string;
  exe_path: string;
  icon_base64: string;
  args?: string;
}

interface SystemTrayIcon {
  id: string;
  window_handle: number;
  uid: number;
  callback_message: number;
  tooltip: string;
  icon_base64: string;
  is_visible: boolean;
}

const CustomTaskbar: React.FC = () => {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [pinnedApps, setPinnedApps] = useState<PinnedApp[]>([]);
  const [trayIcons, setTrayIcons] = useState<SystemTrayIcon[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [position] = useState<'bottom' | 'top' | 'left' | 'right'>('bottom');
  const [showStartMenu, setShowStartMenu] = useState(false);

  useEffect(() => {
    // Обновление списка окон
    const updateWindows = async () => {
      try {
        const wins = await invoke<WindowInfo[]>('get_taskbar_windows');
        setWindows(wins);
      } catch (error) {
        console.error('Failed to get windows:', error);
      }
    };

    // Обновление закреплённых приложений
    const updatePinnedApps = async () => {
      try {
        const apps = await invoke<PinnedApp[]>('get_pinned_apps_list');
        setPinnedApps(apps);
      } catch (error) {
        console.error('Failed to get pinned apps:', error);
      }
    };

    // Обновление трей-иконок
    const updateTrayIcons = async () => {
      try {
        const icons = await invoke<SystemTrayIcon[]>('get_system_tray_icons');
        setTrayIcons(icons);
      } catch (error) {
        console.error('Failed to get tray icons:', error);
      }
    };

    // Скрытие стандартной панели задач Windows
    const hideWindowsTaskbar = async () => {
      try {
        await invoke('taskbar_hide_windows_taskbar');
      } catch (error) {
        console.error('Failed to hide Windows taskbar:', error);
      }
    };

    // Инициализация
    hideWindowsTaskbar();
    updateWindows();
    updatePinnedApps();
    updateTrayIcons();

    // Периодическое обновление
    const windowInterval = setInterval(updateWindows, 1000);
    const trayInterval = setInterval(updateTrayIcons, 2000);

    // Обновление времени
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(windowInterval);
      clearInterval(trayInterval);
      clearInterval(clockInterval);
      
      // Восстановление стандартной панели задач при выходе
      invoke('taskbar_show_windows_taskbar').catch(console.error);
    };
  }, []);

  const handleActivateWindow = async (hwnd: number) => {
    try {
      await invoke('taskbar_activate_window', { hwnd });
    } catch (error) {
      console.error('Failed to activate window:', error);
    }
  };

  const handleCloseWindow = async (hwnd: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke('taskbar_close_window', { hwnd });
    } catch (error) {
      console.error('Failed to close window:', error);
    }
  };

  const handleLaunchPinnedApp = async (app: PinnedApp) => {
    try {
      await invoke('launch_pinned_app', { 
        exePath: app.exe_path, 
        args: app.args 
      });
    } catch (error) {
      console.error('Failed to launch app:', error);
    }
  };

  const handleTrayIconClick = async (icon: SystemTrayIcon, button: 'left' | 'right' | 'middle') => {
    try {
      await invoke('send_tray_icon_click', { 
        iconId: icon.id, 
        button 
      });
    } catch (error) {
      console.error('Failed to send tray icon click:', error);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const renderTaskbarContent = () => (
    <>
      {/* Кнопка Start */}
      <div 
        className="taskbar-start-button"
        onClick={() => setShowStartMenu(!showStartMenu)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/>
        </svg>
      </div>

      {/* Закреплённые приложения */}
      <div className="taskbar-pinned-apps">
        {pinnedApps.map((app, idx) => (
          <div
            key={`pinned-${idx}`}
            className="taskbar-app-item pinned"
            onClick={() => handleLaunchPinnedApp(app)}
            title={app.name}
          >
            {app.icon_base64 ? (
              <img src={app.icon_base64} alt={app.name} />
            ) : (
              <div className="taskbar-app-icon-placeholder">
                {app.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Разделитель */}
      {pinnedApps.length > 0 && windows.length > 0 && (
        <div className="taskbar-separator" />
      )}

      {/* Открытые окна */}
      <div className="taskbar-running-apps">
        {windows.map((win) => (
          <div
            key={win.hwnd}
            className={`taskbar-app-item running ${win.is_minimized ? 'minimized' : ''}`}
            onClick={() => handleActivateWindow(win.hwnd)}
            title={win.title}
          >
            {win.icon_base64 ? (
              <img src={win.icon_base64} alt={win.title} />
            ) : (
              <div className="taskbar-app-icon-placeholder">
                {win.title.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="taskbar-app-title">{win.title}</span>
            <button
              className="taskbar-close-btn"
              onClick={(e) => handleCloseWindow(win.hwnd, e)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Пространство */}
      <div className="taskbar-spacer" />

      {/* System Tray */}
      <div className="taskbar-system-tray">
        {trayIcons.filter(icon => icon.is_visible).map((icon) => (
          <div
            key={icon.id}
            className="taskbar-tray-icon"
            onClick={() => handleTrayIconClick(icon, 'left')}
            onContextMenu={(e) => {
              e.preventDefault();
              handleTrayIconClick(icon, 'right');
            }}
            title={icon.tooltip}
          >
            {icon.icon_base64 ? (
              <img src={icon.icon_base64} alt={icon.tooltip} />
            ) : (
              <div className="taskbar-tray-icon-placeholder">•</div>
            )}
          </div>
        ))}
      </div>

      {/* Часы */}
      <div className="taskbar-clock">
        <div className="taskbar-time">{formatTime(currentTime)}</div>
        <div className="taskbar-date">{formatDate(currentTime)}</div>
      </div>
    </>
  );

  return (
    <>
      <div className={`custom-taskbar taskbar-${position}`}>
        {renderTaskbarContent()}
      </div>

      {/* Start Menu */}
      {showStartMenu && (
        <div className="start-menu-overlay" onClick={() => setShowStartMenu(false)}>
          <div className="start-menu" onClick={(e) => e.stopPropagation()}>
            <div className="start-menu-header">
              <h2>Меню Пуск</h2>
            </div>
            <div className="start-menu-apps">
              <p>Список приложений</p>
              {/* TODO: Добавить список приложений из Start Menu */}
            </div>
            <div className="start-menu-footer">
              <button onClick={() => console.log('Power options')}>⏻</button>
              <button onClick={() => console.log('Settings')}>⚙</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomTaskbar;
