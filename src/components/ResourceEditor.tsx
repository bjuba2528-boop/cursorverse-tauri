import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import './ResourceEditor.css';

interface IconResource {
  id: number;
  width: number;
  height: number;
  bits_per_pixel: number;
  data_base64: string;
}

export const ResourceEditor: React.FC = () => {
  const [systemIconFiles, setSystemIconFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [extractedIcons, setExtractedIcons] = useState<IconResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentSystemIcons, setCurrentSystemIcons] = useState<[string, string][]>([]);
  const [selectedIconType, setSelectedIconType] = useState<string>('my_computer');

  useEffect(() => {
    loadSystemIconFiles();
    loadCurrentSystemIcons();
  }, []);

  const loadSystemIconFiles = async () => {
    try {
      const files = await invoke<string[]>('get_system_icon_files');
      setSystemIconFiles(files);
      if (files.length > 0) {
        setSelectedFile(files[0]);
      }
    } catch (error) {
      console.error('Ошибка загрузки системных файлов:', error);
    }
  };

  const loadCurrentSystemIcons = async () => {
    try {
      const icons = await invoke<[string, string][]>('get_current_system_icons');
      setCurrentSystemIcons(icons);
    } catch (error) {
      console.error('Ошибка загрузки текущих иконок:', error);
    }
  };

  const extractIcons = async () => {
    if (!selectedFile) return;
    
    setLoading(true);
    try {
      const icons = await invoke<IconResource[]>('extract_icons_from_file', {
        filePath: selectedFile
      });
      setExtractedIcons(icons);
    } catch (error) {
      console.error('Ошибка извлечения иконок:', error);
      alert(`Ошибка: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const selectCustomFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Executable Files',
        extensions: ['exe', 'dll', 'ico']
      }]
    });

    if (selected && typeof selected === 'string') {
      setSelectedFile(selected);
    }
  };

  const selectCustomIcon = async () => {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Icon Files',
        extensions: ['ico', 'png', 'jpg', 'jpeg', 'bmp']
      }]
    });

    if (selected && typeof selected === 'string') {
      return selected;
    }
    return null;
  };

  const changeSystemIcon = async () => {
    const iconPath = await selectCustomIcon();
    if (!iconPath) return;

    try {
      const result = await invoke<string>('set_system_icon', {
        iconType: selectedIconType,
        iconPath: iconPath,
        iconIndex: 0
      });
      alert(result);
      loadCurrentSystemIcons();
    } catch (error) {
      console.error('Ошибка изменения иконки:', error);
      alert(`Ошибка: ${error}`);
    }
  };

  const replaceIconInFile = async () => {
    const exePath = await open({
      multiple: false,
      filters: [{
        name: 'Executable Files',
        extensions: ['exe', 'dll']
      }]
    });

    if (!exePath || typeof exePath !== 'string') return;

    const iconPath = await selectCustomIcon();
    if (!iconPath) return;

    try {
      const result = await invoke<string>('replace_icon_in_exe', {
        exePath: exePath,
        iconPath: iconPath,
        backup: true
      });
      alert(result);
    } catch (error) {
      console.error('Ошибка замены иконки:', error);
      alert(`Ошибка: ${error}`);
    }
  };

  const getIconTypeName = (type: string): string => {
    const names: { [key: string]: string } = {
      'my_computer': '🖥️ Этот компьютер',
      'recycle_bin_empty': '🗑️ Корзина (пустая)',
      'recycle_bin_full': '🗑️ Корзина (полная)',
      'network': '🌐 Сеть',
      'user_folder': '👤 Папка пользователя',
      'control_panel': '⚙️ Панель управления'
    };
    return names[type] || type;
  };

  return (
    <div className="resource-editor">
      <div className="resource-header">
        <h2>🎨 Редактор Ресурсов Windows</h2>
        <p>Измените системные иконки и иконки приложений</p>
      </div>

      <div className="resource-sections">
        {/* Секция системных иконок */}
        <div className="resource-section">
          <h3>🔧 Системные Иконки</h3>
          <div className="system-icons-grid">
            <div className="form-group">
              <label>Выберите объект:</label>
              <select 
                value={selectedIconType}
                onChange={(e) => setSelectedIconType(e.target.value)}
                className="icon-select"
              >
                <option value="my_computer">🖥️ Этот компьютер</option>
                <option value="recycle_bin_empty">🗑️ Корзина</option>
                <option value="network">🌐 Сеть</option>
                <option value="user_folder">👤 Папка пользователя</option>
                <option value="control_panel">⚙️ Панель управления</option>
              </select>
            </div>
            <button onClick={changeSystemIcon} className="btn-primary">
              Изменить иконку
            </button>
          </div>

          <div className="current-icons">
            <h4>Текущие иконки:</h4>
            {currentSystemIcons.map(([type, path]) => (
              <div key={type} className="icon-info">
                <span className="icon-type">{getIconTypeName(type)}:</span>
                <span className="icon-path">{path}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Секция извлечения иконок */}
        <div className="resource-section">
          <h3>📦 Извлечение Иконок</h3>
          
          <div className="file-selector">
            <label>Системные файлы с иконками:</label>
            <div className="file-select-group">
              <select 
                value={selectedFile}
                onChange={(e) => setSelectedFile(e.target.value)}
                className="file-select"
              >
                {systemIconFiles.map(file => (
                  <option key={file} value={file}>
                    {file.split('\\').pop()}
                  </option>
                ))}
              </select>
              <button onClick={selectCustomFile} className="btn-secondary">
                📁 Свой файл
              </button>
            </div>
          </div>

          <button 
            onClick={extractIcons} 
            disabled={!selectedFile || loading}
            className="btn-primary extract-btn"
          >
            {loading ? '⏳ Извлечение...' : '🔍 Извлечь иконки'}
          </button>

          {extractedIcons.length > 0 && (
            <div className="extracted-icons">
              <h4>Извлеченные иконки ({extractedIcons.length}):</h4>
              <div className="icons-grid">
                {extractedIcons.map((icon, index) => (
                  <div key={index} className="icon-item">
                    <img 
                      src={icon.data_base64} 
                      alt={`Icon ${icon.width}x${icon.height}`}
                      className="icon-preview"
                    />
                    <div className="icon-details">
                      {icon.width}x{icon.height}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Секция замены иконок в EXE */}
        <div className="resource-section">
          <h3>🔄 Замена Иконки в EXE/DLL</h3>
          <p className="section-description">
            Замените иконку в любом .exe или .dll файле. Будет создан бэкап (.backup).
          </p>
          <button onClick={replaceIconInFile} className="btn-primary">
            Заменить иконку в файле
          </button>
        </div>
      </div>
    </div>
  );
};
