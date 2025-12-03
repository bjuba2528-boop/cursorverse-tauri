import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import CursorBrowser from './components/CursorBrowser'
import Modal from './components/Modal'
import StartScreen from './components/StartScreen'
import MatterBackground from './components/MatterBackground'
import AnimatedGradient from './components/AnimatedGradient'
import UpdateChecker from './components/UpdateChecker'
import LucyAssistant from './components/LucyAssistant'
import LLMSettings from './components/LLMSettings'
import DPETManager from './components/DPETManager'
import './App.css'
import { useI18n } from './i18n'
import { initDiscordRPC, updatePresence, disconnectDiscordRPC } from './utils/discordRpc'

type Tab = 'cursor' | 'lucy' | 'dpet'

function App() {
  const { t } = useI18n()
  const [showStartScreen, setShowStartScreen] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('cursor')
  const [needCursorLib, setNeedCursorLib] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [supportOpen, setSupportOpen] = useState(false)
  const closeSupport = () => { setSupportOpen(false) }

  useEffect(() => {
    (async () => {
      try {
        const result = await invoke<{needs_download: boolean, anime_exists: boolean, classic_exists: boolean, total_folders: number, missing_folders: string[], message: string}>('check_cursorlib_files')
        if (result.needs_download) {
          setNeedCursorLib(true)
          console.log('Требуется загрузка библиотеки курсоров:', result.message)
        } else {
          console.log('Библиотека курсоров найдена:', result.total_folders, 'папок')
        }
      } catch (e) {
        console.error('Ошибка проверки библиотеки курсоров:', e)
        setNeedCursorLib(true)
      }
    })()
  }, [])

  // Инициализация Discord Rich Presence
  useEffect(() => {
    initDiscordRPC();

    return () => {
      disconnectDiscordRPC();
    };
  }, []);

  // Обновление Discord presence при смене вкладки
  useEffect(() => {
    const tabDetails: Record<Tab, { details: string; state: string }> = {
      cursor: {
        details: '🖱️ Просматривает курсоры',
        state: 'В библиотеке курсоров'
      },
      lucy: {
        details: '🤖 Общается с Lucy AI',
        state: 'Использует голосового ассистента'
      },
      dpet: {
        details: '🐾 Управляет питомцами',
        state: 'В библиотеке питомцев'
      }
    };

    updatePresence({
      details: tabDetails[activeTab].details,
      state: tabDetails[activeTab].state,
      largeImage: 'cursorverse_logo',
      largeText: 'CursorVerse v1.5.0'
    });
  }, [activeTab]);

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
      
      // Показываем сообщение о необходимости перезапуска
      alert(t('cursorlib_install_success'))
    } catch (e) {
      console.error(e)
      alert(t('cursorlib_install_error') + ' ' + e)
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
        <h1 className="logo">{t('start_title')}</h1>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => setShowStartScreen(true)} className="back-to-menu">← {t('start_button')}</button>
        </div>
        <UpdateChecker />
        <nav className="nav">
          <button 
            className={(activeTab === 'cursor' ? 'active ' : '')}
            onClick={() => setActiveTab('cursor')}
            data-tab="cursors"
          >
            {t('tab_cursors')}
          </button>
          <button 
            className={(activeTab === 'lucy' ? 'active ' : '')}
            onClick={() => setActiveTab('lucy')}
            data-tab="lucy"
          >
            {t('tab_lucy')}
          </button>
          <button 
            className={(activeTab === 'dpet' ? 'active ' : '')}
            onClick={() => setActiveTab('dpet')}
            data-tab="dpet"
          >
            🐾 Pets
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
              <h3 style={{ marginBottom: 12 }}>{t('cursorlib_needed_title')}</h3>
              <p style={{ opacity: 0.85 }}>{t('cursorlib_needed_desc')}</p>
              <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                {!downloading ? (
                  <>
                    <button onClick={startDownload}>{t('download')}</button>
                    <button onClick={() => setNeedCursorLib(false)} className="reset-btn">{t('later')}</button>
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
        {activeTab === 'lucy' && <LucyAssistant />}
        {activeTab === 'dpet' && <DPETManager />}
      </div>
        </div>
      )}
      
      {/* LLM Settings - Developer Panel */}
      {!showStartScreen && <LLMSettings />}
    </>
  )
}

export default App