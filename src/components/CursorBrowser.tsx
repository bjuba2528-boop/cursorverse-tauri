import React, { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import Modal from './Modal'
import { useI18n } from '../i18n'

interface CursorScheme {
  name: string
  cursors: Record<string, string>
  preview?: string | null
  category?: string | null
}

function CursorBrowser() {
  const { t } = useI18n()
  const [schemes, setSchemes] = useState<CursorScheme[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [message, setMessage] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'info' | 'success' | 'error' | 'warning'>('info')
  const [category, setCategory] = useState<'Anime' | 'Classic' | 'All'>('All')
  const [onlyFavs, setOnlyFavs] = useState(false)
  const [page, setPage] = useState(1)
  const [loadedPreviews, setLoadedPreviews] = useState<Set<number>>(new Set())
  const [previewsLoaded, setPreviewsLoaded] = useState(false)
  const [applyingScheme, setApplyingScheme] = useState<string | null>(null)
  const [favoritingScheme, setFavoritingScheme] = useState<string | null>(null)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [previewModalImage, setPreviewModalImage] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [pageInputOpen, setPageInputOpen] = useState(false)
  const [pageInputValue, setPageInputValue] = useState('')
  const [cursorSize, setCursorSize] = useState<number | null>(null)
  const [cursorSizeModalOpen, setCursorSizeModalOpen] = useState(false)
  // const [checkingLib, setCheckingLib] = useState(false) // удалено: проверка библиотеки не используется
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pageSize = 12

  useEffect(() => {
    loadCursors()
  }, [])

  // Текущий размер курсора
  useEffect(() => {
    (async () => {
      try {
        const size = await invoke<number>('get_cursor_size')
        setCursorSize(size)
      } catch {}
    })()
  }, [])

  // Если библиотека была предзагружена на уровне приложения — используем её сразу
  useEffect(() => {
    const w: any = window as any
    if (Array.isArray(w.__cursorLibraryPreloaded) && w.__cursorLibraryPreloaded.length && schemes.length === 0) {
      setSchemes(w.__cursorLibraryPreloaded)
    }
    const handler = () => {
      const data = (window as any).__cursorLibraryPreloaded
      if (Array.isArray(data)) {
        setSchemes(data)
      }
    }
    window.addEventListener('cursorLibraryPreloaded', handler as EventListener)
    return () => window.removeEventListener('cursorLibraryPreloaded', handler as EventListener)
  }, [])

  // Загружаем ВСЕ превью сразу при загрузке схем (только один раз)
  useEffect(() => {
    if (schemes.length > 0 && !previewsLoaded) {
      loadAllPreviews()
      setPreviewsLoaded(true)
    }
  }, [schemes.length, previewsLoaded])

  // При смене страницы всегда скроллим вверх
  useEffect(() => {
    // Скролл к началу контейнера и окна
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'auto', block: 'start' })
    }
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [page])

  const showMessage = (msg: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setMessage(msg)
    setModalType(type)
    setIsModalOpen(true)
  }

  const loadCursors = async () => {
    try {
      const w: any = window as any
      if (Array.isArray(w.__cursorLibraryPreloaded) && w.__cursorLibraryPreloaded.length) {
        setSchemes(w.__cursorLibraryPreloaded)
        const favs = await invoke<string[]>('get_favorites')
        setFavorites(favs)
        return
      }
      const library = await invoke<CursorScheme[]>('get_cursor_library')
      setSchemes(library)
      
      const favs = await invoke<string[]>('get_favorites')
      setFavorites(favs)
    } catch (error) {
      showMessage(t('error_loading_cursors') + ' ' + error, 'error')
    }
  }

  const loadAllPreviews = async () => {
    if (schemes.length === 0) return
    
    // Загружаем ВСЕ превью сразу параллельно
    const promises = []
    for (let i = 0; i < schemes.length; i++) {
      if (loadedPreviews.has(i) || !schemes[i].preview) continue
      
      const s = schemes[i]
      const index = i
      if (s.preview && !s.preview.startsWith('data:')) {
        const promise = invoke<string>('get_preview_base64', { path: s.preview })
          .then(base64 => {
            setSchemes(prev => {
              const updated = [...prev]
              updated[index] = { ...updated[index], preview: base64 }
              return updated
            })
            setLoadedPreviews(prev => new Set(prev).add(index))
          })
          .catch(err => {
            console.error('Failed to load preview for', s.name, err)
          })
        promises.push(promise)
      }
    }
    await Promise.all(promises)
  }

  const handleApplyCursor = async (scheme: CursorScheme) => {
    setApplyingScheme(scheme.name)
    try {
      const msg = await invoke<string>('apply_cursor', { scheme })
      // Держим состояние success 1.5 секунды
      await new Promise(resolve => setTimeout(resolve, 1500))
      showMessage(msg, 'success')
    } catch (error) {
      showMessage('Ошибка: ' + error, 'error')
    } finally {
      setApplyingScheme(null)
    }
  }

  const handleAddFavorite = async (schemeName: string) => {
    setFavoritingScheme(schemeName)
    try {
      const msg = await invoke<string>('add_favorite', { schemeName })
      const favs = await invoke<string[]>('get_favorites')
      setFavorites(favs)
      // Держим анимацию 800мс
      await new Promise(resolve => setTimeout(resolve, 800))
      showMessage(msg, 'success')
    } catch (error) {
      showMessage('Ошибка: ' + error, 'error')
    } finally {
      setFavoritingScheme(null)
    }
  }

  const handleRemoveFavorite = async (schemeName: string) => {
    try {
      const msg = await invoke<string>('remove_favorite', { schemeName })
      showMessage(msg, 'info')
      const favs = await invoke<string[]>('get_favorites')
      setFavorites(favs)
    } catch (error) {
      showMessage('Ошибка: ' + error, 'error')
    }
  }

  const handleResetCursor = async () => {
    try {
      const msg = await invoke<string>('reset_cursor')
      showMessage(msg, 'success')
    } catch (error) {
      showMessage('Ошибка: ' + error, 'error')
    }
  }

  // Удалены handleIncreaseCursor и handleDecreaseCursor - теперь используется ползунок

  const handlePageInputSubmit = () => {
    const pageNum = parseInt(pageInputValue)
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setPage(pageNum)
      setPageInputOpen(false)
      setPageInputValue('')
    } else {
      showMessage(`Страница должна быть от 1 до ${totalPages}`, 'warning')
    }
  }

  // Убрана явная проверка библиотеки курсоров по кнопке

  const handleDownloadCursorLib = async () => {
    const confirmed = window.confirm(t('confirm_download_cursorlib'))
    
    if (!confirmed) return
    
    setDownloading(true)
    setDownloadProgress(0)
    
    // Имитация прогресса загрузки
    const progressInterval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 90) return prev
        return prev + Math.random() * 15
      })
    }, 300)
    
    try {
      await invoke<string>('download_cursorlib')
      setDownloadProgress(100)
      clearInterval(progressInterval)
      await new Promise(resolve => setTimeout(resolve, 500))
      showMessage(t('cursorlib_install_success'), 'success')
    } catch (error) {
      clearInterval(progressInterval)
      showMessage(t('cursorlib_install_error') + ' ' + error, 'error')
    } finally {
      setTimeout(() => {
        setDownloading(false)
        setDownloadProgress(0)
      }, 1000)
    }
  }

  const filteredSchemes = schemes.filter((s: CursorScheme) => {
    const query = searchQuery.toLowerCase().trim()
    const nameMatch = s.name.toLowerCase().includes(query)
    const fileMatch = query.length > 0 && Object.values(s.cursors).some((p) => {
      const justName = p.split(/\\|\//).pop() || p
      return justName.toLowerCase().includes(query)
    })
    const matchesSearch = query.length === 0 ? true : (nameMatch || fileMatch)
    const cat = (s.category || '').toLowerCase()
    const okCat = category === 'All' || (category === 'Anime' && cat === 'anime') || (category === 'Classic' && cat === 'classic')
    const okFav = !onlyFavs || favorites.includes(s.name)
    return matchesSearch && okCat && okFav
  })

  const totalPages = Math.max(1, Math.ceil(filteredSchemes.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * pageSize
  const end = start + pageSize
  const pagedSchemes = filteredSchemes.slice(start, end)

  useEffect(() => {
    setPage(1)
  }, [searchQuery, category, onlyFavs])

  return (
    <>
    <div className="cursor-browser" ref={containerRef}>
      <h2>{t('cursorlib_title')}</h2>
      
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        type={modalType}
        title={modalType === 'error' ? t('modal_error') : modalType === 'success' ? t('modal_success') : t('modal_info')}
      >
        <p>{message}</p>
      </Modal>

      <Modal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        type="info"
        title={t('cursor_preview_title')}
      >
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <img 
            src={previewModalImage} 
            alt="Превью" 
            style={{ 
              maxWidth: '100%', 
              maxHeight: '70vh', 
              objectFit: 'contain',
              borderRadius: 8
            }} 
          />
        </div>
      </Modal>

      <Modal
        isOpen={pageInputOpen}
        onClose={() => {
          setPageInputOpen(false)
          setPageInputValue('')
        }}
        type="info"
        title="Перейти на страницу"
      >
        <div style={{ padding: '20px' }}>
          <p style={{ 
            marginBottom: 15, 
            color: '#ffb3d9',
            textShadow: '0 0 10px rgba(220,20,60,0.5)'
          }}>
            Введите номер страницы (от 1 до {totalPages}):
          </p>
          <input
            type="number"
            min="1"
            max={totalPages}
            value={pageInputValue}
            onChange={(e) => setPageInputValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handlePageInputSubmit()
            }}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '1.1rem',
              background: 'rgba(139,0,0,0.3)',
              border: '2px solid rgba(220,20,60,0.6)',
              borderRadius: 8,
              color: 'white',
              textAlign: 'center',
              boxShadow: '0 0 20px rgba(220,20,60,0.3), inset 0 0 20px rgba(139,0,0,0.2)'
            }}
            autoFocus
            placeholder={`1-${totalPages}`}
          />
          <button
            onClick={handlePageInputSubmit}
            style={{
              width: '100%',
              marginTop: 15,
              padding: '12px',
              fontSize: '1rem'
            }}
          >
            Перейти
          </button>
        </div>
      </Modal>
      
      <div className="search-bar">
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <button className={category==='Anime'?'active':''} onClick={()=>setCategory('Anime')}>{t('category_anime')}</button>
          <button className={category==='Classic'?'active':''} onClick={()=>setCategory('Classic')}>{t('category_classic')}</button>
          <button className={category==='All'?'active':''} onClick={()=>setCategory('All')}>{t('category_all')}</button>
          <button className={onlyFavs?'active':''} onClick={()=>setOnlyFavs(v=>!v)}>
            ⭐ {t('favorites')} {onlyFavs ? `(${t('on')})` : `(${t('off')})`}
          </button>
        </div>
        <input 
          type="text" 
          placeholder={t('search_schemes_placeholder')} 
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={handleResetCursor} className="reset-btn">
          {t('reset_to_default')}
        </button>

        {/* Ползунок размера курсора в стиле Windows 11 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(220, 20, 60, 0.15)',
          border: '1px solid rgba(220, 20, 60, 0.4)',
          borderRadius: 12,
          padding: '12px 20px',
          minWidth: 280,
          transition: 'all 0.2s ease'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8
          }}>
            <span style={{
              color: '#ff5e78',
              fontSize: 13,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              textShadow: '0 0 8px rgba(220, 20, 60, 0.4)'
            }}>
              🖱️ Размер курсора
            </span>
            <span style={{
              color: '#ff8099',
              fontSize: 15,
              fontWeight: 700,
              padding: '2px 10px',
              background: 'rgba(139, 0, 0, 0.3)',
              borderRadius: 6,
              border: '1px solid rgba(220, 20, 60, 0.3)',
              minWidth: 50,
              textAlign: 'center',
              textShadow: '0 0 10px rgba(220, 20, 60, 0.6)'
            }}>
              {cursorSize ? `${cursorSize}%` : '100%'}
            </span>
          </div>

          <button
            onClick={() => setCursorSizeModalOpen(true)}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #dc143c, #b00020)',
              color: 'white',
              border: '1px solid rgba(220, 20, 60, 0.5)',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(220, 20, 60, 0.3)',
              transition: 'all 0.3s ease',
              marginTop: 8
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(220, 20, 60, 0.5)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 20, 60, 0.3)'
            }}
          >
            {t('cursor_size_change_button')}
          </button>
        </div>
        
        {/* Кнопка проверки библиотеки удалена по просьбе пользователя */}
        <button 
          onClick={handleDownloadCursorLib} 
          className="reset-btn"
          disabled={downloading}
          style={{ 
            position: 'relative',
            overflow: 'hidden',
            background: downloading ? 'rgba(0,0,0,0.5)' : 'linear-gradient(135deg, #DC143C, #FF1493)',
            cursor: downloading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease'
          }}
        >
          {downloading && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              height: `${downloadProgress}%`,
              width: '100%',
              background: 'linear-gradient(180deg, rgba(220,20,60,0.3), rgba(220,20,60,0.8))',
              transition: 'height 0.3s ease',
              zIndex: 0
            }} />
          )}
          <span style={{ position: 'relative', zIndex: 1 }}>
            {downloading ? `⏬ ${Math.round(downloadProgress)}%` : `📦 ${t('download_cursorlib_btn')}`}
          </span>
        </button>
      </div>

      <div className="cursor-grid">
        {pagedSchemes.map((scheme: CursorScheme) => (
          <div key={scheme.name} className="cursor-card">
            <h3>{scheme.name}</h3>
            <div 
              style={{marginBottom:12, height:220, background:'rgba(255,255,255,0.02)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', cursor:'pointer'}}
              onClick={() => {
                if (scheme.preview && scheme.preview.startsWith('data:')) {
                  setPreviewModalImage(scheme.preview)
                  setPreviewModalOpen(true)
                }
              }}
              onMouseEnter={(e) => {
                const canvas = e.currentTarget.querySelector('.gif-still') as HTMLCanvasElement
                const img = e.currentTarget.querySelector('.gif-live') as HTMLImageElement
                if (canvas && img) {
                  canvas.style.display = 'none'
                  img.style.display = 'block'
                }
              }}
              onMouseLeave={(e) => {
                const canvas = e.currentTarget.querySelector('.gif-still') as HTMLCanvasElement
                const img = e.currentTarget.querySelector('.gif-live') as HTMLImageElement
                if (canvas && img) {
                  canvas.style.display = 'block'
                  img.style.display = 'none'
                }
              }}
            >
              {scheme.preview ? (
                scheme.preview.startsWith('data:') ? (
                  <div className="preview-wrap" style={{width:'100%', height:'100%', position:'relative'}}>
                    <canvas
                      ref={(canvas) => {
                        if (!canvas || !scheme.preview) return
                        const ctx = canvas.getContext('2d')
                        if (!ctx) return
                        
                        const img = new Image()
                        img.onload = () => {
                          canvas.width = img.width
                          canvas.height = img.height
                          ctx.drawImage(img, 0, 0)
                        }
                        img.src = scheme.preview
                      }}
                      style={{
                        width:'100%',
                        height:'100%',
                        objectFit:'cover',
                        borderRadius:8,
                        display: 'block'
                      }}
                      className="gif-still"
                    />
                    <img
                      src={scheme.preview}
                      alt={scheme.name}
                      style={{
                        width:'100%',
                        height:'100%',
                        objectFit:'cover',
                        borderRadius:8,
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        display: 'none'
                      }}
                      className="gif-live"
                    />
                  </div>
                ) : (
                  <div style={{opacity:0.3, fontSize:'0.85rem'}}>{t('loading')}</div>
                )
              ) : (
                <div style={{opacity:0.2, fontSize:'0.85rem'}}>{t('no_preview')}</div>
              )}
            </div>
            <div className="cursor-info">
              {Object.keys(scheme.cursors).length} {t('cursors_lower')}
            </div>
            <div className="cursor-actions">
              <button 
                className={`confirm-button ${applyingScheme === scheme.name ? 'success' : ''}`}
                onClick={() => handleApplyCursor(scheme)}
                disabled={applyingScheme === scheme.name}
              >
                <span className="button-text">{t('apply')}</span>
                <span className="button-icon-area">
                  <span className="icon-default">→</span>
                  <span className="icon-success">✓</span>
                </span>
              </button>
              {favorites.includes(scheme.name) ? (
                <button 
                  className="animated-button remove-button"
                  onClick={() => handleRemoveFavorite(scheme.name)}
                >
                  <span>{t('remove')}</span>
                  <span className="button-icon">💔</span>
                </button>
              ) : (
                <button 
                  className={`animated-button favorite-button ${favoritingScheme === scheme.name ? 'favorited' : ''}`}
                  onClick={() => handleAddFavorite(scheme.name)}
                  disabled={favoritingScheme === scheme.name}
                >
                  <span>{t('to_favorites')}</span>
                  <span className="button-icon">❤️</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="pagination-container">
        <button 
          className="paginate left" 
          onClick={() => setPage(p => Math.max(1, p - 1))} 
          disabled={currentPage === 1}
        >
          <i></i>
          <i></i>
        </button>
        
        <div className="page-numbers">
          {(() => {
            const pages: (number | string)[] = []
            const maxVisible = 5
            
            if (totalPages <= maxVisible + 2) {
              // Показываем все страницы если их мало
              for (let i = 1; i <= totalPages; i++) {
                pages.push(i)
              }
            } else {
              // Всегда показываем первую страницу
              pages.push(1)
              
              if (currentPage <= 3) {
                // В начале: 1 2 3 4 ... last
                for (let i = 2; i <= Math.min(4, totalPages - 1); i++) {
                  pages.push(i)
                }
                pages.push('...')
                pages.push(totalPages)
              } else if (currentPage >= totalPages - 2) {
                // В конце: 1 ... last-3 last-2 last-1 last
                pages.push('...')
                for (let i = totalPages - 3; i <= totalPages; i++) {
                  pages.push(i)
                }
              } else {
                // В середине: 1 ... current-1 current current+1 ... last
                pages.push('...')
                pages.push(currentPage - 1)
                pages.push(currentPage)
                pages.push(currentPage + 1)
                pages.push('...')
                pages.push(totalPages)
              }
            }
            
            return pages.map((p, idx) => 
              typeof p === 'number' ? (
                <button
                  key={p}
                  className={`page-number ${p === currentPage ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ) : (
                <span 
                  key={`ellipsis-${idx}`} 
                  className="page-ellipsis clickable"
                  onClick={() => setPageInputOpen(true)}
                  title="Перейти на страницу..."
                  style={{ cursor: 'pointer' }}
                >
                  {p}
                </span>
              )
            )
          })()}
        </div>
        
        <button 
          className="paginate right" 
          onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
          disabled={currentPage === totalPages}
        >
          <i></i>
          <i></i>
        </button>
      </div>
    </div>

    {/* Модальное окно изменения размера курсора */}
    {cursorSizeModalOpen && (
      <Modal
        isOpen={cursorSizeModalOpen}
        onClose={() => setCursorSizeModalOpen(false)}
        title={t('cursor_size_modal_title')}
      >
        <div style={{
          padding: '20px',
          color: '#e0e0e0',
          fontSize: 14,
          lineHeight: 1.6
        }}>
          <div style={{
            marginBottom: 20,
            padding: 15,
            background: 'rgba(220, 20, 60, 0.15)',
            borderRadius: 8,
            border: '1px solid rgba(220, 20, 60, 0.3)'
          }}>
            <p style={{ margin: '0 0 10px 0', fontSize: 15, fontWeight: 600 }}>
              {t('cursor_size_apology_title')}
            </p>
            <p style={{ margin: 0 }}>
              {t('cursor_size_apology_text')}
            </p>
          </div>

          <div style={{
            marginBottom: 20,
            padding: 15,
            background: 'rgba(139, 0, 0, 0.2)',
            borderRadius: 8,
            border: '1px solid rgba(220, 20, 60, 0.25)'
          }}>
            <p style={{ margin: '0 0 10px 0', fontSize: 15, fontWeight: 600 }}>
              {t('cursor_size_instruction_title')}
            </p>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              <li>{t('cursor_size_instruction_step1')}</li>
              <li>{t('cursor_size_instruction_step2')}</li>
              <li>{t('cursor_size_instruction_step3')}</li>
              <li>{t('cursor_size_instruction_step4')}</li>
            </ol>
          </div>

          <button
            onClick={async () => {
              try {
                await invoke('open_cursor_size_settings')
                setCursorSizeModalOpen(false)
                showMessage(t('cursor_size_settings_opened'), 'success')
              } catch (error) {
                showMessage(t('cursor_size_settings_error') + ' ' + error, 'error')
              }
            }}
            style={{
              width: '100%',
              padding: '14px 20px',
              background: 'linear-gradient(135deg, #dc143c, #b00020)',
              color: 'white',
              border: '1px solid rgba(220, 20, 60, 0.5)',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(220, 20, 60, 0.4)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(220, 20, 60, 0.6)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(220, 20, 60, 0.4)'
            }}
          >
            {t('cursor_size_open_settings')}
          </button>
        </div>
      </Modal>
    )}
    </>
  )
}

export default CursorBrowser
