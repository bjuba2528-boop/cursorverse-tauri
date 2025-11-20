import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import Modal from './Modal'

function ThemeManager() {
  const [darkMode, setDarkMode] = useState(false)
  const [transparency, setTransparency] = useState(true)
  const [taskbarAutohide, setTaskbarAutohide] = useState(false)
  const [startMenuStyle, setStartMenuStyle] = useState<'win11' | 'win10'>('win11')
  const [message, setMessage] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'info' | 'success' | 'error' | 'warning'>('info')

  const showMessage = (msg: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setMessage(msg)
    setModalType(type)
    setIsModalOpen(true)
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const isDark = await invoke<boolean>('get_dark_mode')
      setDarkMode(isDark)
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error)
    }
  }

  const handleDarkModeToggle = async () => {
    try {
      const msg = await invoke<string>('set_dark_mode', { enable: !darkMode })
      setDarkMode(!darkMode)
      showMessage(msg, 'success')
    } catch (error) {
      showMessage('Ошибка: ' + error, 'error')
    }
  }

  const handleTransparencyToggle = async () => {
    try {
      const msg = await invoke<string>('set_transparency', { enable: !transparency })
      setTransparency(!transparency)
      showMessage(msg, 'success')
    } catch (error) {
      showMessage('Ошибка: ' + error, 'error')
    }
  }

  const handleTaskbarToggle = async () => {
    try {
      const msg = await invoke<string>('set_taskbar_autohide', { enable: !taskbarAutohide })
      setTaskbarAutohide(!taskbarAutohide)
      showMessage(msg, 'success')
    } catch (error) {
      showMessage('Ошибка: ' + error, 'error')
    }
  }

  const handleResetToDefaults = async () => {
    try {
      const msg = await invoke<string>('reset_to_defaults')
      showMessage(msg, 'success')
      await loadSettings()
    } catch (error) {
      showMessage('Ошибка: ' + error, 'error')
    }
  }

  return (
    <div className="theme-manager">
      <h2>Управление темами</h2>
      
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        type={modalType}
        title={modalType === 'error' ? 'Ошибка' : modalType === 'success' ? 'Успешно' : 'Уведомление'}
      >
        <p>{message}</p>
      </Modal>
      
      <div className="setting-group">
        <label>
          <input 
            type="checkbox" 
            checked={darkMode} 
            onChange={handleDarkModeToggle}
          />
          Тёмный режим
        </label>
      </div>

      <div className="setting-group">
        <label>
          <input 
            type="checkbox" 
            checked={transparency} 
            onChange={handleTransparencyToggle}
          />
          Прозрачность
        </label>
      </div>

      <div className="setting-group">
        <label>
          <input 
            type="checkbox" 
            checked={taskbarAutohide} 
            onChange={handleTaskbarToggle}
          />
          Автоскрытие панели задач
        </label>
      </div>

      <div className="setting-group">
        <h4>Стиль меню Пуск</h4>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button 
            className={startMenuStyle === 'win11' ? 'active' : ''}
            onClick={async () => {
              try {
                const msg = await invoke<string>('set_start_menu_style', { style: 'win11' })
                setStartMenuStyle('win11')
                showMessage(msg, 'success')
              } catch (error) {
                showMessage('Ошибка: ' + error, 'error')
              }
            }}
          >
            Windows 11 (По центру)
          </button>
          <button 
            className={startMenuStyle === 'win10' ? 'active' : ''}
            onClick={async () => {
              try {
                const msg = await invoke<string>('set_start_menu_style', { style: 'win10' })
                setStartMenuStyle('win10')
                showMessage(msg, 'success')
              } catch (error) {
                showMessage('Ошибка: ' + error, 'error')
              }
            }}
          >
            Windows 10 (Слева)
          </button>
        </div>
      </div>

      <div className="setting-group">
        <h4>Иконка Windows на панели задач</h4>
        <button 
          onClick={async () => {
            try {
              const msg = await invoke<string>('change_windows_icon')
              showMessage(msg, 'success')
            } catch (error) {
              showMessage('Ошибка: ' + error, 'error')
            }
          }}
          style={{ marginTop: 10 }}
        >
          📁 Выбрать иконку (.ico, .png)
        </button>
        <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: 8 }}>
          Требуется перезапуск Explorer для применения
        </p>
      </div>

      <button onClick={handleResetToDefaults} className="reset-btn">
        Сбросить к стандартным
      </button>
    </div>
  )
}

export default ThemeManager
