import React, { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import Modal from './Modal'

interface ToolbarPin {
  name: string
  path: string
  icon?: string
}

interface ToolbarConfig {
  pins: ToolbarPin[]
  autostart: boolean
  weather_api_key?: string
  weather_city?: string
}

function Toolbar() {
  const [config, setConfig] = useState<ToolbarConfig>({ pins: [], autostart: false })
  const [message, setMessage] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'info' | 'success' | 'error' | 'warning'>('info')
  const [newPinName, setNewPinName] = useState('')
  const [newPinPath, setNewPinPath] = useState('')

  const showMessage = (msg: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setMessage(msg)
    setModalType(type)
    setIsModalOpen(true)
  }

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const cfg = await invoke<ToolbarConfig>('get_toolbar_config')
      setConfig(cfg)
    } catch (error) {
      showMessage('Ошибка загрузки конфигурации: ' + error, 'error')
    }
  }

  const saveConfig = async (newConfig: ToolbarConfig) => {
    try {
      await invoke('save_toolbar_config', { config: newConfig })
      setConfig(newConfig)
      showMessage('Конфигурация сохранена', 'success')
    } catch (error) {
      showMessage('Ошибка сохранения: ' + error, 'error')
    }
  }

  const handleAddPin = () => {
    if (!newPinName || !newPinPath) {
      showMessage('Введите имя и путь для приложения', 'warning')
      return
    }

    const newConfig = {
      ...config,
      pins: [...config.pins, { name: newPinName, path: newPinPath }]
    }
    saveConfig(newConfig)
    setNewPinName('')
    setNewPinPath('')
  }

  const handleRemovePin = (index: number) => {
    const newConfig = {
      ...config,
      pins: config.pins.filter((_, i) => i !== index)
    }
    saveConfig(newConfig)
  }

  const handleLaunchApp = async (path: string) => {
    try {
      const msg = await invoke<string>('launch_app', { path })
      showMessage(msg, 'success')
    } catch (error) {
      showMessage('Ошибка запуска: ' + error, 'error')
    }
  }

  const handleAutostartToggle = () => {
    const newConfig = { ...config, autostart: !config.autostart }
    saveConfig(newConfig)
  }

  return (
    <div className="toolbar-config">
      <h2>Настройка панели</h2>
      
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        type={modalType}
        title={modalType === 'error' ? 'Ошибка' : modalType === 'success' ? 'Успешно' : modalType === 'warning' ? 'Внимание' : 'Уведомление'}
      >
        <p>{message}</p>
      </Modal>
      
      <div className="setting-group">
        <label>
          <input 
            type="checkbox" 
            checked={config.autostart} 
            onChange={handleAutostartToggle}
          />
          Автозагрузка при старте Windows
        </label>
      </div>

      <h3>Закрепленные приложения</h3>
      
      <div className="pins-list">
        {config.pins.map((pin, index) => (
          <div key={index} className="pin-item">
            <div className="pin-info">
              <strong>{pin.name}</strong>
              <span>{pin.path}</span>
            </div>
            <div className="pin-actions">
              <button onClick={() => handleLaunchApp(pin.path)}>
                ▶️ Запустить
              </button>
              <button onClick={() => handleRemovePin(index)}>
                🗑️ Удалить
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="add-pin-form">
        <h4>Добавить приложение</h4>
        <input 
          type="text" 
          placeholder="Название" 
          value={newPinName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPinName(e.target.value)}
        />
        <input 
          type="text" 
          placeholder="Путь к файлу (.exe, .lnk, .url)" 
          value={newPinPath}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPinPath(e.target.value)}
        />
        <button onClick={handleAddPin}>Добавить</button>
      </div>
    </div>
  )
}

export default Toolbar
