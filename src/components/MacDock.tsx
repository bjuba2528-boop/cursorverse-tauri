import React, { useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './MacDock.css';

interface DockApp {
  id: string;
  name: string;
  icon: string;
  path?: string;
  isRunning?: boolean;
}

export const MacDock: React.FC = () => {
  const [apps, setApps] = useState<DockApp[]>([
    { id: 'chrome', name: 'Chrome', icon: '🌐', path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
    { id: 'vscode', name: 'VS Code', icon: '💻', path: 'C:\\Program Files\\Microsoft VS Code\\Code.exe' },
    { id: 'explorer', name: 'Explorer', icon: '📁', path: 'explorer.exe' },
    { id: 'calculator', name: 'Калькулятор', icon: '🔢', path: 'calc.exe' },
    { id: 'settings', name: 'Настройки', icon: '⚙️', path: 'ms-settings:' },
    { id: 'notepad', name: 'Блокнот', icon: '📝', path: 'notepad.exe' },
  ]);
  
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [dockPosition, setDockPosition] = useState<'bottom' | 'left' | 'right'>('bottom');
  const [dockSize, setDockSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [autoHide, setAutoHide] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const dockRef = useRef<HTMLDivElement>(null);

  const iconSizes = {
    small: { base: 48, hover: 64 },
    medium: { base: 64, hover: 96 },
    large: { base: 80, hover: 128 }
  };

  const launchApp = async (app: DockApp) => {
    if (!app.path) return;

    try {
      if (app.path.startsWith('ms-')) {
        // Открываем системные настройки через protocol
        await invoke('launch_app', { path: app.path });
      } else {
        // Запускаем обычное приложение
        await invoke('launch_app', { path: app.path });
      }
    } catch (error) {
      console.error(`Не удалось запустить ${app.name}:`, error);
    }
  };

  const getIconScale = (index: number): number => {
    if (hoveredIndex === null) return 1;
    
    const distance = Math.abs(index - hoveredIndex);
    if (distance === 0) return 1.5;
    if (distance === 1) return 1.3;
    if (distance === 2) return 1.15;
    return 1;
  };

  const getIconSize = (index: number): number => {
    const baseSize = iconSizes[dockSize].base;
    const scale = getIconScale(index);
    return baseSize * scale;
  };

  const handleMouseEnter = () => {
    if (autoHide) {
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    if (autoHide) {
      setTimeout(() => setIsVisible(false), 500);
    }
  };

  const addApp = () => {
    const newApp: DockApp = {
      id: `app-${Date.now()}`,
      name: 'Новое приложение',
      icon: '➕',
    };
    setApps([...apps, newApp]);
  };

  const removeApp = (id: string) => {
    setApps(apps.filter(app => app.id !== id));
  };

  return (
    <div className="mac-dock-container">
      <div className="dock-settings">
        <div className="setting-group">
          <label>Позиция:</label>
          <div className="button-group">
            <button 
              className={dockPosition === 'bottom' ? 'active' : ''}
              onClick={() => setDockPosition('bottom')}
            >
              Снизу
            </button>
            <button 
              className={dockPosition === 'left' ? 'active' : ''}
              onClick={() => setDockPosition('left')}
            >
              Слева
            </button>
            <button 
              className={dockPosition === 'right' ? 'active' : ''}
              onClick={() => setDockPosition('right')}
            >
              Справа
            </button>
          </div>
        </div>

        <div className="setting-group">
          <label>Размер:</label>
          <div className="button-group">
            <button 
              className={dockSize === 'small' ? 'active' : ''}
              onClick={() => setDockSize('small')}
            >
              Маленький
            </button>
            <button 
              className={dockSize === 'medium' ? 'active' : ''}
              onClick={() => setDockSize('medium')}
            >
              Средний
            </button>
            <button 
              className={dockSize === 'large' ? 'active' : ''}
              onClick={() => setDockSize('large')}
            >
              Большой
            </button>
          </div>
        </div>

        <div className="setting-group">
          <label>
            <input 
              type="checkbox"
              checked={autoHide}
              onChange={(e) => {
                setAutoHide(e.target.checked);
                setIsVisible(!e.target.checked);
              }}
            />
            Автоматически скрывать
          </label>
        </div>

        <button onClick={addApp} className="add-app-btn">
          ➕ Добавить приложение
        </button>
      </div>

      <div 
        ref={dockRef}
        className={`mac-dock ${dockPosition} ${isVisible ? 'visible' : 'hidden'} ${autoHide ? 'auto-hide' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="dock-background"></div>
        <div className="dock-apps">
          {apps.map((app, index) => (
            <div
              key={app.id}
              className="dock-app"
              style={{
                width: `${getIconSize(index)}px`,
                height: `${getIconSize(index)}px`,
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onClick={() => launchApp(app)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (confirm(`Удалить ${app.name} из Dock?`)) {
                  removeApp(app.id);
                }
              }}
            >
              <div className="app-icon">
                {app.icon}
              </div>
              {hoveredIndex === index && (
                <div className="app-tooltip">{app.name}</div>
              )}
              {app.isRunning && <div className="running-indicator"></div>}
            </div>
          ))}
        </div>
        <div className="dock-separator"></div>
        <div className="dock-trash">
          <div className="trash-icon">🗑️</div>
        </div>
      </div>

      {autoHide && !isVisible && (
        <div 
          className={`dock-trigger ${dockPosition}`}
          onMouseEnter={handleMouseEnter}
        ></div>
      )}
    </div>
  );
};
