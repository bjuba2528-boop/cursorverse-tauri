import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import Modal from './Modal'

type WallpaperType = 'image' | 'gif' | 'video'

function WallpaperManager() {
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [wallpaperType, setWallpaperType] = useState<WallpaperType>('image')
  const [message, setMessage] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'info' | 'success' | 'error' | 'warning'>('info')
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [applying, setApplying] = useState(false)
  const [installingLively, setInstallingLively] = useState(false)
  const [livelyInstalled, setLivelyInstalled] = useState(false)
  const [livelyPath, setLivelyPath] = useState('')

  useEffect(() => {
    // Проверяем статус Lively при загрузке
    checkLivelyStatus()
    
    // Перепроверяем статус каждые 3 секунды
    const interval = setInterval(() => {
      checkLivelyStatus()
    }, 3000)
    
    return () => clearInterval(interval)
  }, [wallpaperType])

  const checkLivelyStatus = async () => {
    try {
      const status = await invoke<{installed: boolean, path: string, message: string}>('check_lively_status')
      setLivelyInstalled(status.installed)
      setLivelyPath(status.path)
    } catch (err) {
      console.error('Lively status check error:', err)
      setLivelyInstalled(false)
    }
  }

  const showMessage = (msg: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setMessage(msg)
    setModalType(type)
    setIsModalOpen(true)
  }

  const handleSelectFile = async () => {
    try {
      const filters = wallpaperType === 'video' 
        ? [{ name: 'Видео', extensions: ['mp4', 'webm', 'avi', 'mov', 'mkv'] }]
        : [{ name: 'Изображения', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }]

      const selected = await open({
        multiple: false,
        filters,
        title: wallpaperType === 'video' ? 'Выберите видео' : 'Выберите изображение'
      })

      if (selected && typeof selected === 'string') {
        setSelectedFile(selected)
        
        // Определяем тип по расширению
        const ext = selected.split('.').pop()?.toLowerCase()
        if (ext === 'gif') {
          setWallpaperType('gif')
        } else if (['mp4', 'webm', 'avi', 'mov', 'mkv'].includes(ext || '')) {
          setWallpaperType('video')
        } else {
          setWallpaperType('image')
        }

        // Загружаем превью
        try {
          const base64 = await invoke<string>('get_file_base64', { path: selected })
          setPreviewUrl(base64)
        } catch (err) {
          console.error('Preview load error:', err)
        }
      }
    } catch (error) {
      showMessage('Ошибка выбора файла: ' + error, 'error')
    }
  }

  const handleApplyWallpaper = async () => {
    if (!selectedFile) {
      showMessage('Выберите файл обоев', 'warning')
      return
    }

    setApplying(true)
    try {
      if (wallpaperType !== 'image') {
        // Применяем анимированные обои напрямую (OpenGL рендерер)
        try {
          const msg = await invoke<string>('set_animated_wallpaper', { path: selectedFile, wallpaperType })
          showMessage(msg, 'success')
        } catch (err) {
          showMessage('Ошибка применения: ' + err, 'error')
        }
      } else {
        // Статичные обои
        try {
          const msg = await invoke<string>('set_wallpaper', { path: selectedFile, wallpaperType })
          showMessage(msg, 'success')
        } catch (e) {
          showMessage('Ошибка установки обоев: ' + e, 'error')
        }
      }
    } catch (error) {
      showMessage('Ошибка установки обоев: ' + error, 'error')
    } finally {
      setApplying(false)
    }
  }

  const handleResetWallpaper = async () => {
    try {
      const msg = await invoke<string>('reset_wallpaper')
      setSelectedFile('')
      setPreviewUrl('')
      showMessage(msg, 'success')
    } catch (error) {
      showMessage('Ошибка сброса обоев: ' + error, 'error')
    }
  }

  const handleInstallLively = async () => {
    setInstallingLively(true)
    try {
      showMessage('Загрузка Lively Wallpaper с GitHub...', 'info')
      const path = await invoke<string>('install_lively_wallpaper')
      showMessage(path, 'success')
      // Перепроверяем статус после установки
      setTimeout(() => checkLivelyStatus(), 2000)
    } catch (error) {
      showMessage('Ошибка установки Lively: ' + error, 'error')
    } finally {
      setInstallingLively(false)
    }
  }

  return (
    <div className="wallpaper-manager">
      <h2>Обои рабочего стола</h2>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        type={modalType}
        title={modalType === 'error' ? 'Ошибка' : modalType === 'success' ? 'Успешно' : 'Уведомление'}
      >
        <p>{message}</p>
      </Modal>

      <div className="setting-group">
        <h3>Выбор типа обоев</h3>
        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <button 
            className={wallpaperType === 'image' ? 'active' : ''}
            onClick={() => setWallpaperType('image')}
          >
            🖼️ Изображение
          </button>
          <button 
            className={wallpaperType === 'video' ? 'active' : ''}
            onClick={() => setWallpaperType('video')}
          >
            🎬 Видео
          </button>
        </div>
      </div>

      <div className="setting-group">
        <h3>Файл обоев</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
          <button onClick={handleSelectFile}>
            📁 Выбрать файл
          </button>
          {selectedFile && (
            <span style={{ fontSize: '0.9rem', opacity: 0.7, wordBreak: 'break-all' }}>
              {selectedFile.split('\\').pop() || selectedFile.split('/').pop()}
            </span>
          )}
        </div>
      </div>

      {previewUrl && (
        <div className="setting-group">
          <h3>Превью</h3>
          <div style={{ 
            marginTop: 10, 
            background: 'rgba(255,255,255,0.02)', 
            borderRadius: 12, 
            padding: 20,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 300,
            maxHeight: 400,
            overflow: 'hidden'
          }}>
            {wallpaperType === 'video' ? (
              <video 
                src={previewUrl}
                controls
                loop
                muted
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '100%', 
                  borderRadius: 8,
                  objectFit: 'contain'
                }}
              />
            ) : (
              <img 
                src={previewUrl}
                alt="Превью обоев"
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '100%', 
                  borderRadius: 8,
                  objectFit: 'contain'
                }}
              />
            )}
          </div>
        </div>
      )}

      <div className="setting-group">
        <h3>Действия</h3>
        <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          <button 
            className={`confirm-button ${applying ? 'success' : ''}`}
            onClick={handleApplyWallpaper}
            disabled={!selectedFile || applying}
            style={{ flex: '1 1 200px' }}
          >
            <span className="button-text">
              {applying ? 'Применение...' : 'Применить обои'}
            </span>
            <span className="button-icon-area">
              <span className="icon-default">→</span>
              <span className="icon-success">✓</span>
            </span>
          </button>
          <button 
            onClick={handleResetWallpaper}
            className="reset-btn"
            style={{ flex: '1 1 200px' }}
          >
            Сбросить к стандартным
          </button>
        </div>

        {wallpaperType === 'video' && !livelyInstalled && (
          <div style={{ marginTop: 16 }}>
            <button 
              className={`confirm-button ${installingLively ? 'success' : ''}`}
              onClick={handleInstallLively}
              disabled={installingLively}
              style={{ width: '100%' }}
            >
              <span className="button-text">
                {installingLively ? 'Загрузка...' : '📥 Скачать и установить Lively Wallpaper'}
              </span>
              <span className="button-icon-area">
                <span className="icon-default">⬇</span>
                <span className="icon-success">✓</span>
              </span>
            </button>
            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: 8, textAlign: 'center' }}>
              Для видео обоев требуется Lively Wallpaper
            </p>
          </div>
        )}
        
        {wallpaperType === 'video' && livelyInstalled && (
          <div style={{ marginTop: 16, padding: 12, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <p style={{ fontSize: '0.9rem', color: '#10b981', margin: 0, textAlign: 'center' }}>
              ✓ Lively Wallpaper установлен
            </p>
            <p style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: 4, textAlign: 'center' }}>
              {livelyPath}
            </p>
          </div>
        )}
      </div>

      <div className="setting-group" style={{ background: 'rgba(255, 200, 0, 0.05)', borderColor: 'rgba(255, 200, 0, 0.2)' }}>
        <h4>ℹ️ Информация</h4>
        <ul style={{ fontSize: '0.9rem', opacity: 0.8, lineHeight: 1.8, paddingLeft: 20 }}>
          <li><strong>Изображение:</strong> Статичные обои (JPG, PNG, BMP, WebP)</li>
          <li><strong>Видео:</strong> Интеграция с Lively Wallpaper для анимированных обоев</li>
          <li><strong>Lively Wallpaper:</strong> Открытый проект для живых обоев (автоматическая установка)</li>
          <li><strong>Производительность:</strong> Аппаратное ускорение видео</li>
          <li><strong>Поддержка форматов:</strong> MP4, WebM, AVI, MOV, MKV и другие</li>
          <li><strong>Без установки:</strong> Portable версия встраивается в приложение</li>
        </ul>
      </div>
    </div>
  )
}

export default WallpaperManager
