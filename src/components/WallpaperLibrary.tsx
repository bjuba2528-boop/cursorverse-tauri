import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import Modal from './Modal'
import './WallpaperLibrary.css'

interface WallpaperItem {
  id: string
  title: string
  thumbnail_path: string
  preview_path: string
  wallpaper_type: number
  folder_path: string
  file_path: string
}

interface WallpaperWithPreview extends WallpaperItem {
  thumbnailData?: string
}

function WallpaperLibrary() {
  const [wallpapers, setWallpapers] = useState<WallpaperWithPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, wallpaper: WallpaperWithPreview} | null>(null)
  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean, wallpaperId: string, title: string}>({isOpen: false, wallpaperId: '', title: ''})
  const [nativeMode, setNativeMode] = useState(true) // По умолчанию нативные обои
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    loadWallpapers()
    
    // Закрываем контекстное меню при клике вне его
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [nativeMode])

  const loadWallpapers = async () => {
    try {
      setLoading(true)
      const items = nativeMode 
        ? await invoke<WallpaperItem[]>('get_native_wallpapers')
        : await invoke<WallpaperItem[]>('get_lively_wallpapers')
      
      // Сначала показываем обои без превью
      setWallpapers(items)
      setLoading(false)
      setError('')
      
      // Загружаем превью пачками по 3 штуки для плавности
      const batchSize = 3
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        await Promise.all(
          batch.map(async (item) => {
            if (item.thumbnail_path) {
              try {
                const thumbnailData = await invoke<string>('get_wallpaper_thumbnail', {
                  thumbnailPath: item.thumbnail_path
                })
                setWallpapers(prev => prev.map(w => w.id === item.id ? { ...w, thumbnailData } : w))
              } catch (err) {
                console.error(`Ошибка загрузки превью для ${item.id}:`, err)
              }
            }
          })
        )
        // Небольшая пауза между пачками чтобы не блокировать UI
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    } catch (err) {
      setError(String(err))
      console.error('Ошибка загрузки обоев:', err)
      setLoading(false)
    }
  }

  const handleSetWallpaper = async (wallpaperId: string) => {
    try {
      const result = nativeMode
        ? await invoke<string>('set_native_wallpaper', { wallpaperId })
        : await invoke<string>('set_lively_wallpaper', { wallpaperId, monitor: null })
      console.log(result)
      setContextMenu(null)
    } catch (err) {
      console.error('Ошибка установки обоев:', err)
      setError(String(err))
    }
  }

  const showDeleteConfirm = (wallpaperId: string, title: string) => {
    setContextMenu(null)
    setDeleteModal({isOpen: true, wallpaperId, title})
  }

  const handleDeleteWallpaper = async () => {
    const { wallpaperId } = deleteModal
    setDeleteModal({isOpen: false, wallpaperId: '', title: ''})
    
    try {
      const result = nativeMode
        ? await invoke<string>('delete_native_wallpaper', { wallpaperId })
        : await invoke<string>('delete_wallpaper', { wallpaperId })
      console.log(result)
      await loadWallpapers()
    } catch (err) {
      console.error('Ошибка удаления обоев:', err)
      setError(String(err))
    }
  }

  const handleContextMenu = (e: React.MouseEvent, wallpaper: WallpaperWithPreview) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      wallpaper
    })
  }

  // Закрывать меню при клике вне его
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  const handleAddWallpaper = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'Медиа', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'mp4', 'webm', 'avi', 'mov', 'mkv'] },
          { name: 'Все файлы', extensions: ['*'] }
        ],
        title: 'Выберите файл обоев'
      })

      if (selected && typeof selected === 'string') {
        setLoading(true)
        try {
          const result = nativeMode
            ? await invoke<string>('add_native_wallpaper', { filePath: selected })
            : await invoke<string>('add_wallpaper_to_library', { filePath: selected })
          console.log(result)
          // Перезагружаем библиотеку
          await loadWallpapers()
        } catch (err) {
          console.error('Ошибка добавления обоев:', err)
          setError(String(err))
        } finally {
          setLoading(false)
        }
      }
    } catch (err) {
      console.error('Ошибка выбора файла:', err)
    }
  }

  const getWallpaperTypeLabel = (type: number): string => {
    const types: Record<number, string> = {
      0: 'Приложение',
      1: 'Видео',
      2: 'GIF',
      3: 'Веб',
      4: 'Веб аудио',
      5: 'Картинка',
    }
    return types[type] || 'Неизвестно'
  }

  const handleImportFromLively = async () => {
    setImporting(true)
    try {
      const result = await invoke<string>('import_from_lively')
      console.log(result)
      await loadWallpapers()
      setError('✅ ' + result)
    } catch (err) {
      console.error('Ошибка импорта:', err)
      setError(String(err))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="wallpaper-library">
      <div className="library-header">
        <h2>Библиотека обоев</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Переключатель режима */}
          <button 
            onClick={() => {
              setNativeMode(!nativeMode)
              setWallpapers([])
              setError('')
            }}
            style={{
              padding: '8px 16px',
              background: nativeMode 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                : 'linear-gradient(135deg, #DC143C 0%, #FF1493 100%)',
              border: 'none',
              borderRadius: 8,
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
              transition: 'all 0.3s'
            }}
            title={nativeMode ? 'Переключить на Lively Wallpaper' : 'Переключить на нативные обои'}
          >
            {nativeMode ? '🎨 Нативные обои' : '🔗 Lively Wallpaper'}
          </button>
          
          {/* Кнопка импорта (только в нативном режиме) */}
          {nativeMode && (
            <button 
              onClick={handleImportFromLively}
              disabled={importing}
              style={{
                padding: '8px 16px',
                background: importing 
                  ? 'rgba(0,0,0,0.3)' 
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: 8,
                color: 'white',
                cursor: importing ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600,
                transition: 'all 0.3s',
                opacity: importing ? 0.6 : 1
              }}
              title="Импортировать все обои из Lively Wallpaper"
            >
              {importing ? '⏳ Импорт...' : '📥 Импорт из Lively'}
            </button>
          )}
          
          <button className="add-wallpaper-btn" onClick={handleAddWallpaper} title="Добавить обои">
            <span className="plus-icon">+</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          {error.includes('Библиотека Lively не найдена') && (
            <p style={{ marginTop: 8, fontSize: '0.9rem' }}>
              Убедитесь что Lively Wallpaper установлен из{' '}
              <a href="https://github.com/rocksdanister/lively/releases" target="_blank" rel="noopener noreferrer">
                GitHub Releases
              </a>
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="loading">Загрузка библиотеки...</div>
      ) : (
        <div className="wallpaper-grid">
          {wallpapers.map((wallpaper) => (
            <div
              key={wallpaper.id}
              className="wallpaper-card"
              onClick={() => handleSetWallpaper(wallpaper.id)}
              onContextMenu={(e) => handleContextMenu(e, wallpaper)}
            >
              {wallpaper.thumbnailData ? (
                <div
                  className="wallpaper-thumbnail"
                  style={{
                    backgroundImage: `url('${wallpaper.thumbnailData}')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                />
              ) : (
                <div className="wallpaper-thumbnail no-preview">
                  <span>Нет превью</span>
                </div>
              )}
              <div className="wallpaper-info">
                <h3 className="wallpaper-title">{wallpaper.title}</h3>
                <span className="wallpaper-type">{getWallpaperTypeLabel(wallpaper.wallpaper_type)}</span>
              </div>
            </div>
          ))}

          {wallpapers.length === 0 && !loading && !error && (
            <div className="empty-library">
              <p>Библиотека пуста</p>
              <p style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: 8 }}>
                Нажмите кнопку + чтобы добавить обои
              </p>
            </div>
          )}
        </div>
      )}

      {contextMenu && (
        <div 
          className="context-menu" 
          style={{ 
            left: contextMenu.x, 
            top: contextMenu.y,
            position: 'fixed',
            zIndex: 1000
          }}
        >
          <button onClick={() => handleSetWallpaper(contextMenu.wallpaper.id)}>
            Установить
          </button>
          <button onClick={() => showDeleteConfirm(contextMenu.wallpaper.id, contextMenu.wallpaper.title)} className="delete-btn">
            Удалить
          </button>
        </div>
      )}

      <Modal 
        isOpen={deleteModal.isOpen} 
        onClose={() => setDeleteModal({isOpen: false, wallpaperId: '', title: ''})}
        type="warning"
        title="Удалить обои?"
      >
        <div style={{paddingBottom: 20}}>
          <p style={{marginBottom: 12}}>Вы действительно хотите удалить обои <strong>{deleteModal.title}</strong>?</p>
          <p style={{fontSize: '0.85rem', opacity: 0.7, marginBottom: 20}}>Это действие нельзя отменить.</p>
          <div style={{display: 'flex', gap: 12, justifyContent: 'flex-end'}}>
            <button 
              onClick={() => setDeleteModal({isOpen: false, wallpaperId: '', title: ''})} 
              style={{padding: '10px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer'}}
            >
              Отмена
            </button>
            <button 
              onClick={handleDeleteWallpaper}
              style={{padding: '10px 20px', borderRadius: 8, background: 'linear-gradient(135deg, #f87171 0%, #dc2626 100%)', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 600}}
            >
              Удалить
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default WallpaperLibrary
