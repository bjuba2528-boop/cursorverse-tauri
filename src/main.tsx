import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'

console.log('[DEBUG] main.tsx starting...')
console.log('[DEBUG] document.body:', document.body)
console.log('[DEBUG] document.readyState:', document.readyState)

const current = getCurrentWindow()
console.log('[DEBUG] current window label:', current.label)

if (current.label === 'wallpaper-window') {
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
} else {
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
          <App />
        </React.StrictMode>,
      )
      console.log('[DEBUG] React render called successfully')
    } catch (err) {
      console.error('[ERROR] React mounting failed:', err)
      alert('React mounting failed: ' + err)
    }
  }
}
