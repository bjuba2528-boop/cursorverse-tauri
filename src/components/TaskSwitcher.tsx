import React, { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import Modal from './Modal'

interface WindowInfo {
  hwnd: number
  title: string
  visible: boolean
}

function TaskSwitcher() {
  const [windows, setWindows] = useState<WindowInfo[]>([])
  const [message, setMessage] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'info' | 'success' | 'error' | 'warning'>('info')
  const [searchQuery, setSearchQuery] = useState('')

  const showMessage = (msg: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setMessage(msg)
    setModalType(type)
    setIsModalOpen(true)
  }

  useEffect(() => {
    loadWindows()
  }, [])

  const loadWindows = async () => {
    try {
      const windowList = await invoke<WindowInfo[]>('get_window_list')
      setWindows(windowList)
    } catch (error) {
      showMessage('Ошибка загрузки окон: ' + error, 'error')
    }
  }

  const handleActivateWindow = async (hwnd: number) => {
    try {
      const msg = await invoke<string>('activate_window', { hwnd })
      showMessage(msg, 'success')
    } catch (error) {
      showMessage('Ошибка активации окна: ' + error, 'error')
    }
  }

  const filteredWindows = windows.filter((w: WindowInfo) => 
    w.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="task-switcher">
      <h2>Переключатель окон</h2>
      
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        type={modalType}
        title={modalType === 'error' ? 'Ошибка' : modalType === 'success' ? 'Успешно' : 'Уведомление'}
      >
        <p>{message}</p>
      </Modal>
      
      <div className="search-bar">
        <input 
          type="text" 
          placeholder="Поиск окон..." 
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
        />
      </div>

      <button onClick={loadWindows} className="refresh-btn">
        🔄 Обновить список
      </button>

      <div className="windows-list">
        {filteredWindows.map((window: WindowInfo) => (
          <div key={window.hwnd} className="window-item">
            <div className="window-info">
              <strong>{window.title}</strong>
              <span>HWND: {window.hwnd}</span>
            </div>
            <button onClick={() => handleActivateWindow(window.hwnd)}>
              Переключиться
            </button>
          </div>
        ))}
      </div>

      {filteredWindows.length === 0 && (
        <div className="no-windows">
          Нет открытых окон
        </div>
      )}
    </div>
  )
}

export default TaskSwitcher
