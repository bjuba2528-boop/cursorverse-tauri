import React, { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import Modal from './Modal'

interface CursorScheme {
  name: string
  cursors: Record<string, string>
  preview?: string | null
  category?: string | null
}

function CursorBrowser() {
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
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pageSize = 12

  useEffect(() => {
    loadCursors()
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
      showMessage('Ошибка загрузки курсоров: ' + error, 'error')
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
    <div className="cursor-browser" ref={containerRef}>
      <h2>Библиотека курсоров</h2>
      
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        type={modalType}
        title={modalType === 'error' ? 'Ошибка' : modalType === 'success' ? 'Успешно' : 'Уведомление'}
      >
        <p>{message}</p>
      </Modal>

      <Modal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        type="info"
        title="Превью курсора"
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
      
      <div className="search-bar">
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <button className={category==='Anime'?'active':''} onClick={()=>setCategory('Anime')}>Аниме</button>
          <button className={category==='Classic'?'active':''} onClick={()=>setCategory('Classic')}>Классика</button>
          <button className={category==='All'?'active':''} onClick={()=>setCategory('All')}>Все</button>
          <button className={onlyFavs?'active':''} onClick={()=>setOnlyFavs(v=>!v)}>
            ⭐ Избранные {onlyFavs ? '(вкл)' : '(выкл)'}
          </button>
        </div>
        <input 
          type="text" 
          placeholder="Поиск схем курсоров..." 
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
        />
      </div>

      <button onClick={handleResetCursor} className="reset-btn">
        Сбросить к стандартным
      </button>

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
                  <div style={{opacity:0.3, fontSize:'0.85rem'}}>Загрузка...</div>
                )
              ) : (
                <div style={{opacity:0.2, fontSize:'0.85rem'}}>Нет превью</div>
              )}
            </div>
            <div className="cursor-info">
              {Object.keys(scheme.cursors).length} курсоров
            </div>
            <div className="cursor-actions">
              <button 
                className={`confirm-button ${applyingScheme === scheme.name ? 'success' : ''}`}
                onClick={() => handleApplyCursor(scheme)}
                disabled={applyingScheme === scheme.name}
              >
                <span className="button-text">Применить</span>
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
                  <span>Убрать</span>
                  <span className="button-icon">★</span>
                </button>
              ) : (
                <button 
                  className={`animated-button favorite-button ${favoritingScheme === scheme.name ? 'favorited' : ''}`}
                  onClick={() => handleAddFavorite(scheme.name)}
                  disabled={favoritingScheme === scheme.name}
                >
                  <span>В избранное</span>
                  <span className="button-icon">★</span>
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
                <span key={`ellipsis-${idx}`} className="page-ellipsis">{p}</span>
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
  )
}

export default CursorBrowser
