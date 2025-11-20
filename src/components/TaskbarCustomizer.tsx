import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './TaskbarCustomizer.css';

interface TaskbarConfig {
  transparency: number;
  color: string;
  height: number;
  position: 'bottom' | 'top' | 'left' | 'right';
  auto_hide: boolean;
}

const TaskbarCustomizer: React.FC = () => {
  const [config, setConfig] = useState<TaskbarConfig>({
    transparency: 255,
    color: '#000000',
    height: 48,
    position: 'bottom',
    auto_hide: false,
  });

  const [notifications, setNotifications] = useState<any[]>([]);
  const [startMenuItems, setStartMenuItems] = useState<any[]>([]);
  const [pinnedApps, setPinnedApps] = useState<any[]>([]);
  const [windowThumbnails, setWindowThumbnails] = useState<any[]>([]);

  useEffect(() => {
    loadStartMenu();
    loadPinnedApps();
    loadNotifications();
    loadWindowThumbnails();
  }, []);

  const loadStartMenu = async () => {
    try {
      const items = await invoke<any[]>('get_start_menu_items');
      setStartMenuItems(items);
    } catch (error) {
      console.error('Failed to load start menu:', error);
    }
  };

  const loadPinnedApps = async () => {
    try {
      const apps = await invoke<any[]>('get_pinned_apps');
      setPinnedApps(apps);
    } catch (error) {
      console.error('Failed to load pinned apps:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      const notifs = await invoke<any[]>('get_notifications');
      setNotifications(notifs);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const loadWindowThumbnails = async () => {
    try {
      const thumbs = await invoke<any[]>('get_all_window_thumbnails');
      setWindowThumbnails(thumbs);
    } catch (error) {
      console.error('Failed to load window thumbnails:', error);
    }
  };

  const handleApplyTransparency = async () => {
    try {
      await invoke('customize_taskbar_transparency', { alpha: config.transparency });
      alert('Прозрачность применена! (может потребоваться перезагрузка Explorer)');
    } catch (error) {
      alert(`Ошибка: ${error}`);
    }
  };

  const handleApplyColor = async () => {
    try {
      await invoke('customize_taskbar_color', { color: config.color });
      alert('Цвет применён!');
    } catch (error) {
      alert(`Ошибка: ${error}`);
    }
  };

  const handleApplyHeight = async () => {
    try {
      await invoke('customize_taskbar_height', { height: config.height });
      alert('Высота изменена!');
    } catch (error) {
      alert(`Ошибка: ${error}`);
    }
  };

  const handleApplyPosition = async () => {
    try {
      await invoke('customize_taskbar_position', { position: config.position });
      alert('Позиция изменена! Explorer будет перезапущен.');
    } catch (error) {
      alert(`Ошибка: ${error}`);
    }
  };

  const handleApplyAutoHide = async () => {
    try {
      await invoke('customize_taskbar_autohide', { enable: config.auto_hide });
      alert('Auto-hide применён!');
    } catch (error) {
      alert(`Ошибка: ${error}`);
    }
  };

  const handleApplyAll = async () => {
    try {
      await invoke('apply_full_taskbar_customization', { config });
      alert('Все настройки применены!');
    } catch (error) {
      alert(`Ошибка: ${error}`);
    }
  };

  const handleResetToDefault = async () => {
    try {
      await invoke('reset_taskbar_to_default');
      setConfig({
        transparency: 255,
        color: '#000000',
        height: 48,
        position: 'bottom',
        auto_hide: false,
      });
      alert('Панель задач сброшена к настройкам по умолчанию');
    } catch (error) {
      alert(`Ошибка: ${error}`);
    }
  };

  const handleSendTestNotification = async () => {
    try {
      await invoke('send_test_notification');
      loadNotifications();
    } catch (error) {
      alert(`Ошибка: ${error}`);
    }
  };

  const handleDismissNotification = async (id: string) => {
    try {
      await invoke('dismiss_notification', { id });
      loadNotifications();
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  };

  const handleLaunchStartMenuItem = async (exePath: string) => {
    try {
      await invoke('launch_start_menu_app', { exePath });
    } catch (error) {
      alert(`Ошибка: ${error}`);
    }
  };

  return (
    <div className="taskbar-customizer">
      <h2>🎨 Модификация Windows Taskbar</h2>
      <p className="description">
        Изменяйте внешний вид и поведение СТАНДАРТНОЙ панели задач Windows
      </p>

      {/* Основные настройки */}
      <div className="customizer-section">
        <h3>Основные настройки</h3>
        
        <div className="setting-row">
          <label>
            Прозрачность (0-255):
            <input
              type="range"
              min="0"
              max="255"
              value={config.transparency}
              onChange={(e) => setConfig({ ...config, transparency: parseInt(e.target.value) })}
            />
            <span>{config.transparency}</span>
          </label>
          <button onClick={handleApplyTransparency}>Применить</button>
        </div>

        <div className="setting-row">
          <label>
            Цвет панели:
            <input
              type="color"
              value={config.color}
              onChange={(e) => setConfig({ ...config, color: e.target.value })}
            />
            <span>{config.color}</span>
          </label>
          <button onClick={handleApplyColor}>Применить</button>
        </div>

        <div className="setting-row">
          <label>
            Высота (px):
            <input
              type="number"
              min="30"
              max="100"
              value={config.height}
              onChange={(e) => setConfig({ ...config, height: parseInt(e.target.value) })}
            />
          </label>
          <button onClick={handleApplyHeight}>Применить</button>
        </div>

        <div className="setting-row">
          <label>
            Позиция:
            <select
              value={config.position}
              onChange={(e) => setConfig({ ...config, position: e.target.value as any })}
            >
              <option value="bottom">Внизу</option>
              <option value="top">Вверху</option>
              <option value="left">Слева</option>
              <option value="right">Справа</option>
            </select>
          </label>
          <button onClick={handleApplyPosition}>Применить</button>
        </div>

        <div className="setting-row">
          <label>
            <input
              type="checkbox"
              checked={config.auto_hide}
              onChange={(e) => setConfig({ ...config, auto_hide: e.target.checked })}
            />
            Автоматически скрывать панель
          </label>
          <button onClick={handleApplyAutoHide}>Применить</button>
        </div>

        <div className="action-buttons">
          <button className="apply-all-btn" onClick={handleApplyAll}>
            ✓ Применить все настройки
          </button>
          <button className="reset-btn" onClick={handleResetToDefault}>
            ↺ Сбросить к умолчаниям
          </button>
        </div>
      </div>

      {/* Закреплённые приложения */}
      <div className="customizer-section">
        <h3>📌 Закреплённые приложения ({pinnedApps.length})</h3>
        <div className="pinned-apps-grid">
          {pinnedApps.map((app, idx) => (
            <div key={idx} className="pinned-app-card">
              {app.icon_path && <img src={app.icon_path} alt={app.name} />}
              <span>{app.name}</span>
              <button onClick={() => invoke('remove_pinned_app', { exePath: app.exe_path })}>
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Start Menu Preview */}
      <div className="customizer-section">
        <h3>🪟 Start Menu ({startMenuItems.length} приложений)</h3>
        <button onClick={loadStartMenu}>🔄 Обновить</button>
        <div className="start-menu-preview">
          {startMenuItems.slice(0, 20).map((item, idx) => (
            <div 
              key={idx} 
              className="start-menu-item"
              onClick={() => handleLaunchStartMenuItem(item.exe_path)}
            >
              {item.icon_base64 && <img src={item.icon_base64} alt={item.name} />}
              <div className="item-info">
                <span className="item-name">{item.name}</span>
                {item.category && <span className="item-category">{item.category}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Уведомления */}
      <div className="customizer-section">
        <h3>🔔 Notification Center ({notifications.length})</h3>
        <button onClick={handleSendTestNotification}>+ Тестовое уведомление</button>
        <button onClick={() => invoke('clear_notifications').then(loadNotifications)}>
          Очистить все
        </button>
        <div className="notifications-list">
          {notifications.map((notif) => (
            <div key={notif.id} className="notification-card">
              <div className="notif-header">
                <strong>{notif.app_name}</strong>
                <button onClick={() => handleDismissNotification(notif.id)}>×</button>
              </div>
              <div className="notif-title">{notif.title}</div>
              <div className="notif-message">{notif.message}</div>
              <div className="notif-time">
                {new Date(notif.timestamp * 1000).toLocaleString('ru-RU')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Window Thumbnails */}
      <div className="customizer-section">
        <h3>🖼️ Window Thumbnails ({windowThumbnails.length})</h3>
        <button onClick={loadWindowThumbnails}>🔄 Обновить</button>
        <div className="thumbnails-grid">
          {windowThumbnails.map((thumb) => (
            <div key={thumb.hwnd} className="thumbnail-card">
              <img src={thumb.thumbnail_base64} alt={thumb.title} />
              <span>{thumb.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TaskbarCustomizer;
