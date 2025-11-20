import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import CursorBrowser from './components/CursorBrowser'
import WallpaperLibrary from './components/WallpaperLibrary'
import Modal from './components/Modal'
import StartScreen from './components/StartScreen'
import MatterBackground from './components/MatterBackground'
import AnimatedGradient from './components/AnimatedGradient'
import UpdateChecker from './components/UpdateChecker'
import { PetsManager } from './components/Pets'
import './App.css'

type Tab = 'cursor' | 'wallpaper' | 'pets'

function App() {
  const [showStartScreen, setShowStartScreen] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('cursor')
  const [needCursorLib, setNeedCursorLib] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [supportOpen, setSupportOpen] = useState(false)
  const [heartActive, setHeartActive] = useState(false)
  const [showPetsManager, setShowPetsManager] = useState(false)
  const toggleSupport = () => { setHeartActive(true); setSupportOpen(true) }
  const closeSupport = () => { setSupportOpen(false) }

  useEffect(() => {
    (async () => {
      try {
        const path = await invoke<string>('check_cursorlib')
        if (!path) setNeedCursorLib(true)
      } catch {}
    })()

    // Listen for tray icon "show-pets" event
    const unlisten = listen('show-pets', () => {
      setActiveTab('pets')
      setShowPetsManager(true)
    })
    
    return () => {
      unlisten.then(fn => fn())
    }
  }, [])

  // Предзагрузка библиотеки курсоров при старте приложения (в фоне)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await invoke<any[]>('get_cursor_library')
        if (cancelled) return
        ;(window as any).__cursorLibraryPreloaded = data
        window.dispatchEvent(new CustomEvent('cursorLibraryPreloaded'))
      } catch (_) {
        // ignore preload errors
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    if (downloading) {
      listen<number>('cursorlib-progress', (e) => {
        if (typeof e.payload === 'number') setProgress(e.payload)
      }).then((f) => { unlisten = f })
    }
    return () => { if (unlisten) unlisten() }
  }, [downloading])

  const startDownload = async () => {
    try {
      setDownloading(true)
      setProgress(0)
      await invoke<string>('download_cursorlib')
      setProgress(100)
      setNeedCursorLib(false)
    } catch (e) {
      console.error(e)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      {showStartScreen && <StartScreen onStart={() => setShowStartScreen(false)} />}
      {!showStartScreen && (
        <div className="app">
          {/* Волны */}
          <div className="wave"></div>
          <div className="wave"></div>
          <div className="wave"></div>

          {/* Animated Gradient Background */}
          <AnimatedGradient />
          
          {/* Matter.js Physics Background */}
          <MatterBackground />

      <div className="sidebar">
        <h1 className="logo">CursorVerse</h1>
        {!showStartScreen && (
          <button onClick={() => setShowStartScreen(true)} className="back-to-menu">
            ← Главное меню
          </button>
        )}
        <button onClick={toggleSupport} className={"support-btn" + (heartActive ? " active" : "")} title="Поддержать проект ❤️">
          <div className="heart-support">
            <div className="heart"></div>
          </div>
        </button>
        <UpdateChecker />
        <nav className="nav">
          <button 
            className={(activeTab === 'cursor' ? 'active ' : '')}
            onClick={() => setActiveTab('cursor')}
          >
            🖱️ Курсоры
          </button>
          <button 
            className={(activeTab === 'wallpaper' ? 'active ' : '')}
            onClick={() => setActiveTab('wallpaper')}
          >
            🖼️ Обои
          </button>
          <button 
            className={(activeTab === 'pets' ? 'active ' : '')}
            onClick={() => { setActiveTab('pets'); setShowPetsManager(true); }}
          >
            🐾 Питомцы
          </button>
        </nav>
      </div>
      <div className="content">
        <Modal 
          isOpen={supportOpen} 
          onClose={closeSupport}
          type="info"
          title="Поддержать проект"
        >
          <div className="support-modal">
            <p>Поддержка помогает развивать CursorVerse и добавлять новые темы.</p>
            <ul>
              <li>Расскажите друзьям об приложении</li>
              <li>Присылайте идеи и баг-репорты</li>
              <li>Можно сделать форк и внести вклад</li>
            </ul>
            <div className="support-actions">
              <button onClick={closeSupport}>Закрыть</button>
            </div>
          </div>
        </Modal>
        {needCursorLib && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
          }}>
            <div style={{ width: 480, maxWidth: '90%', background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24 }}>
              <h3 style={{ marginBottom: 12 }}>Нужна библиотека курсоров</h3>
              <p style={{ opacity: 0.85 }}>Будет скачан архив CursorLib (~несколько сотен МБ) и распакован в ваш профиль. Продолжить?</p>
              <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                {!downloading ? (
                  <>
                    <button onClick={startDownload}>Скачать</button>
                    <button onClick={() => setNeedCursorLib(false)} className="reset-btn">Позже</button>
                  </>
                ) : (
                  <div style={{ width: '100%' }}>
                    <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary-1), var(--primary-2))' }} />
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>{progress}%</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'cursor' && <CursorBrowser />}
        {activeTab === 'wallpaper' && <WallpaperLibrary />}
        {showPetsManager && <PetsManager onClose={() => { setShowPetsManager(false); setActiveTab('cursor'); }} />}
      </div>
        </div>
      )}
    </>
  )
}

export default App
