import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { I18nProvider } from './i18n'
import './styles.css'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen, emit } from '@tauri-apps/api/event'

console.log('[DEBUG] main.tsx starting...')
console.log('[DEBUG] document.body:', document.body)
console.log('[DEBUG] document.readyState:', document.readyState)

const current = getCurrentWindow()
const params = new URLSearchParams(window.location.search)
const isBackground = params.get('background') === '1' || current.label === 'lucy_background'

if (isBackground) {
  // Фоновый режим: wake word "люси" без UI
  console.log('[Lucy Background] starting wake word loop')
  const initWakeWord = () => {
    if (!('webkitSpeechRecognition' in window)) {
      console.warn('[Lucy Background] SpeechRecognition API недоступен')
      return null
    }
    const rec = new (window as any).webkitSpeechRecognition()
    rec.lang = 'ru-RU'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e: any) => {
      const txt = e.results[e.results.length - 1][0].transcript.toLowerCase()
      if (txt.includes('люси')) {
        console.log('[Lucy Background] Wake word detected')
        emit('start-listening') // триггер основному окну
        try { rec.stop() } catch {}
        setTimeout(() => {
          try { rec.start() } catch {}
        }, 2000) // пауза после срабатывания
      }
    }
    rec.onerror = (ev: any) => {
      if (ev.error !== 'aborted') console.warn('[Lucy Background] error', ev.error)
      setTimeout(() => { try { rec.start() } catch {} }, 1000)
    }
    rec.onend = () => {
      setTimeout(() => { try { rec.start() } catch {} }, 500)
    }
    try { rec.start() } catch {}
    return rec
  }
  initWakeWord()
  // Ничего не монтируем
} else {
console.log('[DEBUG] current window label:', current.label)

if (!isBackground && current.label === 'wallpaper-window') {
  console.log('[DEBUG] wallpaper-window mode')
  // Окно для анимированных обоев: слушаем HTML содержимое и подменяем body
  listen<string>('wallpaper-html', (event) => {
    const html = event.payload
    if (html) {
      document.body.innerHTML = html
    }
  })
  // Рендерим пустой контейнер (ожидаем событие)
  const rootEl = document.getElementById('root') as HTMLElement
  if (rootEl) {
    rootEl.remove() // удаляем React root чтобы не мешал
  }
} else if (!isBackground) {
  console.log('[DEBUG] Rendering main App...')
  const rootElement = document.getElementById('root') as HTMLElement
  console.log('[DEBUG] rootElement:', rootElement)
  if (!rootElement) {
    console.error('[ERROR] #root element not found!')
    alert('ERROR: #root element not found!')
  } else {
    console.log('[DEBUG] #root found, mounting React...')
    try {
      const root = ReactDOM.createRoot(rootElement)
      console.log('[DEBUG] createRoot successful:', root)
      root.render(
        <React.StrictMode>
          <I18nProvider>
            <App />
          </I18nProvider>
        </React.StrictMode>,
      )
      console.log('[DEBUG] React render called successfully')
    } catch (err) {
      console.error('[ERROR] React mounting failed:', err)
      alert('React mounting failed: ' + err)
    }
  }
}
}
