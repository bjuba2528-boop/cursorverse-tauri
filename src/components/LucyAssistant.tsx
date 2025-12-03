import React, { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { llmService } from '../utils/llmService'
import CommandAssistant from './CommandAssistant'
import './LucyAssistant.css'
import { useI18n } from '../i18n'
const CursorVerseIcon = '/CursorVerse.ico'

interface Message {
  role: 'user' | 'lucy'
  content: string
  timestamp: number
}

const LucyAssistant: React.FC = () => {
  const { t, lang } = useI18n()
  const [activeTab, setActiveTab] = useState<'chat' | 'commands'>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [llmReady, setLlmReady] = useState(llmService.isReady())
  const [isListening, setIsListening] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Автопрокрутка вниз
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Периодически обновляем статус LLM
  useEffect(() => {
    const llmInterval = setInterval(() => setLlmReady(llmService.isReady()), 3000)
    return () => clearInterval(llmInterval)
  }, [])

  // Загружаем пакеты питомцев при старте
  useEffect(() => {
    const loadPets = async () => {
      try {
        await invoke('dpet_load_packages')
        console.log('✅ Пакеты питомцев загружены')
      } catch (err) {
        console.error('❌ Не удалось загрузить пакеты питомцев:', err)
      }
    }
    loadPets()
  }, [])



  // Проверка Discord RPC при загрузке
  useEffect(() => {
    const checkDiscord = async () => {
      try {
        console.log('🔌 Инициализация Discord RPC...')
        console.log('Application ID: 1444795416846663914')
        const result = await invoke('init_discord_rpc')
        console.log('✅ Discord RPC:', result)
        
        // Устанавливаем начальный статус
        await invoke('update_discord_presence', {
          details: '🔧 Настройка Windows',
          state: 'Lucy AI готова к работе',
          largeImage: 'cursorverse_logo',
          largeText: 'CursorVerse v1.5.0'
        })
        console.log('✅ Discord presence установлен')
      } catch (err) {
        console.error('❌ Discord RPC ошибка:', err)
        console.log('🔍 Проверьте:')
        console.log('1. Discord запущен?')
        console.log('2. Application ID правильный?')
        console.log('3. https://discord.com/developers/applications/1444795416846663914')
      }
    }
    
    // Задержка для убедительности что Discord запустился
    setTimeout(checkDiscord, 1000)
  }, [])

  // ============= УВЕДОМЛЕНИЯ =============

  const showNotificationIfHidden = async (userMessage: string, response: string) => {
    try {
      // Проверяем, видно ли главное окно
      const isVisible = await invoke<boolean>('is_main_window_visible')
      
      if (!isVisible) {
        // Если окно скрыто, показываем уведомление
        const cleanResponse = response.replace(/\[EXECUTE:.+?\]/g, '').trim()
        await invoke('show_lucy_notification', {
          message: userMessage,
          response: cleanResponse
        })
      }
    } catch (error) {
      console.error('Ошибка отображения уведомления:', error)
    }
  }

  // ============= ГОЛОСОВОЕ РАСПОЗНАВАНИЕ =============

  const toggleVoiceRecognition = () => {
    const vr = (window as any).voiceRecognition
    if (!vr) {
      alert('Модуль голосового распознавания не загружен')
      return
    }

    if (isListening) {
      vr.stop()
      setIsListening(false)
    } else {
      setIsListening(true)
      vr.start()
      
      // Подписываемся на результат распознавания
      const originalSendToLucy = vr.sendToLucy?.bind(vr)
      if (originalSendToLucy) {
        vr.sendToLucy = async (text: string) => {
          setIsListening(false)
          setInputText(text)
          await handleSubmit(text)
          return originalSendToLucy(text)
        }
      }
    }
  }

  // ============= ОБРАБОТКА КОМАНД =============

  const handleSubmit = async (text?: string): Promise<void> => {
    const userMessage = text || inputText.trim()
    
    if (!userMessage) {
      console.warn('⚠️ Попытка отправки пустого сообщения')
      return Promise.resolve()
    }

    // Добавляем сообщение пользователя
    const userMsg: Message = {
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    }
    
    setMessages(prev => [...prev, userMsg])
    setInputText('')
    setIsProcessing(true)

    try {
      // Режим чата - прямое общение через Gemini с возможностью выполнения команд
      const systemPrompt = (() => {
        if (lang === 'en') {
          return `You are Lucy 2.0, an advanced AI assistant powered by Google Gemini 2.0 Flash with full access to CursorVerse and Windows.
Answer in English, be friendly, creative and helpful. You have real-time awareness and can perform actions.

🎯 YOUR ENHANCED CAPABILITIES:

📁 FILE & APP MANAGEMENT:
- Open programs: [EXECUTE:APP:program_name]
  Examples: discord, spotify, telegram, chrome, steam, vscode
- Open files: [EXECUTE:FILE:C:\\path\\to\\file.ext]
- Open folders: [EXECUTE:FOLDER:C:\\path\\to\\folder]
- Open websites/games: [EXECUTE:URL:link]
  Examples: steam://rungameid/730 (CS:GO), https://youtube.com

🖱️ CURSOR MANAGEMENT:
- Apply cursor theme: [EXECUTE:CURSOR:theme_name]
  Examples: anime, neon, cyberpunk, cute
- Reset cursor: [EXECUTE:CURSOR_RESET]
- Change cursor size: [EXECUTE:CURSOR_SIZE] (opens Windows settings)

🐾 PET MANAGEMENT (Max 2 pets):
- Add pet: [EXECUTE:PET_ADD:pet_id]
- Remove all pets: [EXECUTE:PET_REMOVE_ALL]
- List available pets: [EXECUTE:PET_LIST]

🪟 WINDOW MANAGEMENT:
- List all windows: [EXECUTE:WINDOWS_LIST]
- Activate window: [EXECUTE:WINDOW_ACTIVATE:window_title]
- Close window: [EXECUTE:WINDOW_CLOSE:window_title]

📸 SCREEN MONITORING:
- Take screenshot: [EXECUTE:SCREENSHOT]
- Get active window info: [EXECUTE:ACTIVE_WINDOW]
- Monitor info: [EXECUTE:MONITOR_INFO]

💡 SPECIAL COMMANDS:
- System info: [EXECUTE:SYSTEM_INFO]
- Clear cache: [EXECUTE:CLEAR_CACHE]

IMPORTANT: Always respond naturally first, then add commands. Be creative and helpful!`
        }
        if (lang === 'uk') {
          return `Ти — Люсі 2.0, просунутий AI-помічник на базі Google Gemini 2.0 Flash із повним доступом до CursorVerse та Windows.
Відповідай українською, будь дружньою, креативною і корисною. Ти маєш реальний контроль над системою.

🎯 ТВОЇ РОЗШИРЕНІ МОЖЛИВОСТІ:

📁 ФАЙЛИ ТА ПРОГРАМИ:
- Відкрити програму: [EXECUTE:APP:назва_програми]
  Приклади: discord, spotify, telegram, chrome, steam, vscode
- Відкрити файл: [EXECUTE:FILE:C:\\шлях\\до\\файлу.ext]
- Відкрити папку: [EXECUTE:FOLDER:C:\\шлях\\до\\папки]
- Відкрити сайт/гру: [EXECUTE:URL:посилання]
  Приклади: steam://rungameid/730 (CS:GO), https://youtube.com

🖱️ КЕРУВАННЯ КУРСОРАМИ:
- Застосувати тему: [EXECUTE:CURSOR:назва_теми]
  Приклади: anime, neon, cyberpunk, cute
- Скинути курсор: [EXECUTE:CURSOR_RESET]
- Змінити розмір: [EXECUTE:CURSOR_SIZE] (відкриває налаштування Windows)

🐾 КЕРУВАННЯ ПИТОМЦЯМИ (Макс 2):
- Додати питомця: [EXECUTE:PET_ADD:pet_id]
- Видалити всіх: [EXECUTE:PET_REMOVE_ALL]
- Список питомців: [EXECUTE:PET_LIST]

🪟 КЕРУВАННЯ ВІКНАМИ:
- Список вікон: [EXECUTE:WINDOWS_LIST]
- Активувати вікно: [EXECUTE:WINDOW_ACTIVATE:назва]
- Закрити вікно: [EXECUTE:WINDOW_CLOSE:назва]

📸 МОНІТОРИНГ ЕКРАНУ:
- Зробити скріншот: [EXECUTE:SCREENSHOT]
- Інфо про вікно: [EXECUTE:ACTIVE_WINDOW]
- Інфо про монітори: [EXECUTE:MONITOR_INFO]

💡 СПЕЦІАЛЬНІ КОМАНДИ:
- Системна інформація: [EXECUTE:SYSTEM_INFO]
- Очистити кеш: [EXECUTE:CLEAR_CACHE]

ВАЖЛИВО: Спочатку дай природну відповідь, потім додай команду(и). Будь креативною!`
        }
        return `Ты — Люси 2.0, продвинутый AI-помощник на базе Google Gemini 2.0 Flash с полным доступом к CursorVerse и Windows.
Отвечай на русском языке, будь дружелюбной, креативной и полезной. У тебя есть реальная осведомленность и возможность выполнять действия.

🎯 ТВОИ РАСШИРЕННЫЕ ВОЗМОЖНОСТИ:

📁 ФАЙЛЫ И ПРОГРАММЫ:
- Открыть программу: [EXECUTE:APP:название_программы]
  Примеры: discord, spotify, telegram, chrome, steam, vscode
- Открыть файл: [EXECUTE:FILE:C:\\путь\\к\\файлу.ext]
- Открыть папку: [EXECUTE:FOLDER:C:\\путь\\к\\папке]
- Открыть сайт/игру: [EXECUTE:URL:ссылка]
  Примеры: steam://rungameid/730 (CS:GO), https://youtube.com

🖱️ УПРАВЛЕНИЕ КУРСОРАМИ:
- Применить тему: [EXECUTE:CURSOR:название_темы]
  Примеры: anime, neon, cyberpunk, cute
- Сбросить курсор: [EXECUTE:CURSOR_RESET]
- Изменить размер: [EXECUTE:CURSOR_SIZE] (открывает настройки Windows)

🐾 УПРАВЛЕНИЕ ПИТОМЦАМИ (Макс 2):
- Добавить питомца: [EXECUTE:PET_ADD:pet_id]
- Удалить всех: [EXECUTE:PET_REMOVE_ALL]
- Список питомцев: [EXECUTE:PET_LIST]

🪟 УПРАВЛЕНИЕ ОКНАМИ:
- Список окон: [EXECUTE:WINDOWS_LIST]
- Активировать окно: [EXECUTE:WINDOW_ACTIVATE:название]
- Закрыть окно: [EXECUTE:WINDOW_CLOSE:название]

📸 МОНИТОРИНГ ЭКРАНА:
- Сделать скриншот: [EXECUTE:SCREENSHOT]
- Инфо об окне: [EXECUTE:ACTIVE_WINDOW]
- Инфо о мониторах: [EXECUTE:MONITOR_INFO]

💡 СПЕЦИАЛЬНЫЕ КОМАНДЫ:
- Показать статистику системы: [EXECUTE:SYSTEM_INFO]
- Очистить кэш: [EXECUTE:CLEAR_CACHE]

ВАЖНО: Сначала дай естественный, дружелюбный ответ, затем добавь команду(ы). Будь креативной и полезной!`
      })()

      const response = await llmService.chat([
        {
          role: 'system' as const,
          content: systemPrompt
        },
        ...messages.map(m => ({
          role: (m.role === 'lucy' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: m.content
        })),
        {
          role: 'user' as const,
          content: userMessage
        }
      ])
      
      // Проверяем наличие команд выполнения
      let displayResponse = response
      const executeRegex = /\[EXECUTE:([A-Z_]+):?([^\]]+)?\]/g
      const matches = [...response.matchAll(executeRegex)]
      
      if (matches.length > 0) {
        // Удаляем команды из отображаемого текста
        displayResponse = response.replace(executeRegex, '').trim()
        
        // Выполняем команды
        for (const match of matches) {
          const [, type, target = ''] = match
          try {
            // === УПРАВЛЕНИЕ КУРСОРАМИ ===
            if (type === 'CURSOR') {
              const schemes = await invoke<any[]>('get_cursor_library')
              const scheme = schemes.find(s => 
                s.name.toLowerCase().includes(target.toLowerCase())
              )
              if (scheme) {
                await invoke('apply_cursor', { scheme })
                displayResponse += `\n\n✅ Применена тема курсора: ${scheme.name}`
              } else {
                displayResponse += `\n\n⚠️ Тема курсора "${target}" не найдена`
              }
            }
            else if (type === 'CURSOR_RESET') {
              await invoke('reset_cursor')
              displayResponse += '\n\n✅ Курсор сброшен к стандартному'
            }
            else if (type === 'CURSOR_SIZE') {
              // Открываем настройки Windows для изменения размера
              await invoke('open_cursor_size_settings')
              displayResponse += '\n\n⚙️ Открыты системные настройки размера курсора'
            }
            // === УПРАВЛЕНИЕ ПИТОМЦАМИ ===
            else if (type === 'PET_ADD') {
              try {
                await invoke('add_pet_from_catalog', { petId: target })
                displayResponse += `\n\n✅ Питомец добавлен на рабочий стол!`
              } catch (err) {
                displayResponse += `\n\n⚠️ Не удалось добавить питомца: ${err}`
              }
            }
            else if (type === 'PET_REMOVE_ALL') {
              const pets = await invoke<any[]>('get_all_pets')
              for (const pet of pets) {
                await invoke('remove_pet', { petId: pet.id })
              }
              displayResponse += `\n\n✅ Все питомцы удалены (${pets.length} шт.)`
            }
            else if (type === 'PET_LIST') {
              const available = await invoke<any[]>('get_available_pets')
              const active = await invoke<any[]>('get_all_pets')
              displayResponse += `\n\n📋 Доступно питомцев: ${available.length}\n🐾 Активных питомцев: ${active.length}`
              if (available.length > 0) {
                displayResponse += `\n\nПримеры: ${available.slice(0, 5).map(p => p.name).join(', ')}`
              }
            }
            // === УПРАВЛЕНИЕ ОКНАМИ ===
            else if (type === 'WINDOWS_LIST') {
              const windows = await invoke<any[]>('get_window_list')
              displayResponse += `\n\n🪟 Открытых окон: ${windows.length}`
              if (windows.length > 0) {
                const list = windows.slice(0, 10).map(w => `• ${w.title}`).join('\n')
                displayResponse += `\n\n${list}`
                if (windows.length > 10) {
                  displayResponse += `\n... и ещё ${windows.length - 10}`
                }
              }
            }
            else if (type === 'WINDOW_ACTIVATE') {
              const windows = await invoke<any[]>('get_window_list')
              const window = windows.find(w => 
                w.title.toLowerCase().includes(target.toLowerCase())
              )
              if (window) {
                await invoke('activate_window', { hwnd: window.hwnd })
                displayResponse += `\n\n✅ Окно "${window.title}" активировано`
              } else {
                displayResponse += `\n\n⚠️ Окно "${target}" не найдено`
              }
            }
            else if (type === 'WINDOW_CLOSE') {
              const windows = await invoke<any[]>('get_window_list')
              const window = windows.find(w => 
                w.title.toLowerCase().includes(target.toLowerCase())
              )
              if (window) {
                await invoke('taskbar_close_window', { hwnd: window.hwnd })
                displayResponse += `\n\n✅ Окно "${window.title}" закрыто`
              } else {
                displayResponse += `\n\n⚠️ Окно "${target}" не найдено`
              }
            }
            // === МОНИТОРИНГ ЭКРАНА ===
            else if (type === 'SCREENSHOT') {
              displayResponse += '\n\n📸 Функция скриншотов будет добавлена в следующем обновлении (требуется дополнительное разрешение)'
            }
            else if (type === 'ACTIVE_WINDOW') {
              const windows = await invoke<any[]>('get_window_list')
              if (windows.length > 0) {
                displayResponse += `\n\n🪟 Активное окно: ${windows[0].title}`
                if (windows[0].exe_path) {
                  displayResponse += `\n📂 Путь: ${windows[0].exe_path}`
                }
              } else {
                displayResponse += '\n\n⚠️ Нет открытых окон'
              }
            }
            else if (type === 'MONITOR_INFO') {
              try {
                const windows = await invoke<any[]>('get_window_list')
                const activeCount = windows.length
                displayResponse += `\n\n🖥️ Мониторинг системы:`
                displayResponse += `\n• Открыто окон: ${activeCount}`
                displayResponse += `\n• Разрешение: ${window.screen.width}x${window.screen.height}`
                displayResponse += `\n• Цветовая глубина: ${window.screen.colorDepth} бит`
                displayResponse += `\n• Ориентация: ${window.screen.orientation?.type || 'landscape'}`
              } catch (err) {
                displayResponse += `\n\n⚠️ Не удалось получить информацию о мониторах: ${err}`
              }
            }
            else if (type === 'SYSTEM_INFO') {
              displayResponse += `\n\n💻 Информация о системе:`
              displayResponse += `\n• ОС: ${navigator.platform}`
              displayResponse += `\n• User Agent: ${navigator.userAgent.substring(0, 50)}...`
              displayResponse += `\n• Язык: ${navigator.language}`
              displayResponse += `\n• Онлайн: ${navigator.onLine ? '✅' : '❌'}`
              displayResponse += `\n• Память: ${(navigator as any).deviceMemory || 'N/A'} GB`
              displayResponse += `\n• Ядер CPU: ${navigator.hardwareConcurrency || 'N/A'}`
            }
            else if (type === 'CLEAR_CACHE') {
              try {
                // Очищаем localStorage
                const keysToKeep = ['llm_config', 'lucy_chat_hotkey']
                const allKeys = Object.keys(localStorage)
                let cleared = 0
                
                allKeys.forEach(key => {
                  if (!keysToKeep.includes(key)) {
                    localStorage.removeItem(key)
                    cleared++
                  }
                })
                
                displayResponse += `\n\n🧹 Кэш очищен! Удалено элементов: ${cleared}`
              } catch (err) {
                displayResponse += `\n\n⚠️ Не удалось очистить кэш: ${err}`
              }
            }
            // === ФАЙЛЫ И ПРИЛОЖЕНИЯ ===
            else if (type === 'APP') {
              // Список популярных программ с их путями
              const commonApps: Record<string, string> = {
                'spotify': '%APPDATA%\\Spotify\\Spotify.exe',
                'discord': '%LOCALAPPDATA%\\Discord\\app-*\\Discord.exe',
                'telegram': '%APPDATA%\\Telegram Desktop\\Telegram.exe',
                'steam': 'C:\\Program Files (x86)\\Steam\\steam.exe',
                'chrome': 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'firefox': 'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
                'code': 'C:\\Program Files\\Microsoft VS Code\\Code.exe',
                'vscode': 'C:\\Program Files\\Microsoft VS Code\\Code.exe'
              }
              
              // Проверяем есть ли программа в списке известных
              const knownPath = commonApps[target.toLowerCase()]
              
              if (knownPath) {
                // Используем cmd для раскрытия переменных окружения и запуска
                const expandedPath = knownPath.replace(/%([^%]+)%/g, (_, varName) => {
                  return `%${varName}%` // cmd сам раскроет переменные
                })
                await invoke('execute_shell_command', { 
                  command: 'cmd', 
                  args: ['/c', 'start', '', expandedPath] 
                })
                console.log(`✅ Запущена программа: ${target}`)
              } else {
                // Пробуем запустить через обычный PATH
                await invoke('execute_shell_command', { 
                  command: 'cmd', 
                  args: ['/c', 'start', '', target] 
                })
                console.log(`✅ Запущена программа: ${target}`)
              }
            } else if (type === 'FILE') {
              // Открыть файл
              await invoke('execute_shell_command', { 
                command: 'cmd', 
                args: ['/c', 'start', '', target] 
              })
              console.log(`✅ Открыт файл: ${target}`)
            } else if (type === 'FOLDER') {
              // Открыть папку в проводнике
              await invoke('execute_shell_command', { 
                command: 'explorer', 
                args: [target] 
              })
              console.log(`✅ Открыта папка: ${target}`)
            } else if (type === 'URL') {
              // Открыть URL в браузере
              await invoke('execute_shell_command', { 
                command: 'cmd', 
                args: ['/c', 'start', '', target] 
              })
              console.log(`✅ Открыт сайт: ${target}`)
            }
          } catch (err: any) {
            console.error('Ошибка выполнения команды:', err)
            const errorMsg = err?.message || err?.toString() || 'Неизвестная ошибка'
            displayResponse += `\n\n⚠️ Не удалось выполнить команду: ${errorMsg}`
          }
        }
      }
      
      // Добавляем ответ Люси
      const lucyMsg: Message = {
        role: 'lucy',
        content: displayResponse,
        timestamp: Date.now()
      }
      
      setMessages(prev => [...prev, lucyMsg])
      
      // Обновляем Discord presence
      try {
        await invoke('update_discord_presence', {
          details: '🤖 Работает с Lucy AI',
          state: `Диалог: ${messages.length + 2} сообщений`,
          largeImage: 'cursorverse_logo',
          largeText: 'CursorVerse - AI Assistant'
        })
      } catch (e) {
        console.log('⚠️ Discord не обновлён:', e)
      }
      
      // Показываем уведомление если окно скрыто
      showNotificationIfHidden(userMessage, displayResponse)
      
    } catch (error: any) {
      const errorMsg: Message = {
        role: 'lucy',
        content: `❌ Произошла ошибка: ${error.message}`,
        timestamp: Date.now()
      }
      
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const clearHistory = () => {
    setMessages([])
  }

  // ============= ОТОБРАЖЕНИЕ =============

  return (
    <>
      <div className="lucy-assistant">
        {/* Заголовок - только для режима чата */}
        {activeTab === 'chat' && (
          <div className="lucy-header">
            <div className="lucy-title">
              <div className="lucy-avatar">
                <img 
                  src={CursorVerseIcon} 
                  alt="Lucy" 
                  style={{width:48,height:48,borderRadius:12}}
                />
              </div>
              <div>
                <h2>{t('lucy_title')}</h2>
                <p className="lucy-subtitle">
                  {t('lucy_subtitle')}
                {llmService.getConfig().provider === 'gemini' && (
                  <span style={{
                    marginLeft: 8,
                    padding: '2px 8px',
                    background: 'linear-gradient(135deg, #4285f4, #ea4335, #fbbc04, #34a853)',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                    boxShadow: '0 2px 8px rgba(66, 133, 244, 0.4)'
                  }}>
                      ⚡ Gemini 2.0 Flash
                  </span>
                )}
                </p>
              </div>
            </div>
            
            <div className="lucy-status">
            <div style={{ display: 'flex', gap: 10, marginRight: 12, alignItems: 'center' }}>
              <a
                href="https://send.monobank.ua/jar/7p4c9uySHf"
                target="_blank"
                rel="noopener noreferrer"
                title="Поддержать (Монобанк)"
                style={{ fontSize: 12, opacity: .6, color: '#ddd', textDecoration: 'underline' }}
              >
                💖 монобанк
              </a>
              <a
                href="https://funpay.com/uk/users/6117488/"
                target="_blank"
                rel="noopener noreferrer"
                title="Профиль FunPay"
                style={{ fontSize: 12, opacity: .6, color: '#ddd', textDecoration: 'underline' }}
              >
                🎮 funpay
              </a>
              <a
                href="https://lolz.live/members/3486486/"
                target="_blank"
                rel="noopener noreferrer"
                title="Профиль на Lolz"
                style={{ fontSize: 12, opacity: .6, color: '#ddd', textDecoration: 'underline' }}
              >
                🧩 lolz
              </a>
            </div>
            <div className={`status-indicator ready`}>
              <span className="status-dot"></span>
              <span>💬 Готова</span>
            </div>
            <div className={`llm-badge ${llmReady ? 'online' : 'offline'}`} title={llmReady ? t('llm_tooltip_on') : t('llm_tooltip_off')}>
              {llmReady ? t('llm_badge_on') : t('llm_badge_off')}
            </div>
          </div>
          </div>
        )}

        {/* Вкладки */}
        <div style={{display:'flex',gap:8,padding:'0 20px',marginBottom:16,borderBottom:'2px solid rgba(220,20,60,0.3)'}}>
          <button 
            onClick={() => setActiveTab('chat')}
            style={{
              flex:1,
              padding:'12px 20px',
              background: activeTab === 'chat' ? 'linear-gradient(135deg, var(--elfen-crimson) 0%, var(--elfen-red) 100%)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'chat' ? '3px solid var(--elfen-crimson)' : '3px solid transparent',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.3s',
              borderRadius: '8px 8px 0 0'
            }}
          >
            {t('lucy_tab_chat')}
          </button>
          <button 
            onClick={() => setActiveTab('commands')}
            style={{
              flex:1,
              padding:'12px 20px',
              background: activeTab === 'commands' ? 'linear-gradient(135deg, var(--elfen-crimson) 0%, var(--elfen-red) 100%)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'commands' ? '3px solid var(--elfen-crimson)' : '3px solid transparent',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.3s',
              borderRadius: '8px 8px 0 0'
            }}
          >
            {t('lucy_tab_commands')}
          </button>
        </div>

        {/* Показываем CommandAssistant в режиме команд */}
        {activeTab === 'commands' ? (
          <CommandAssistant />
        ) : (
          <>
            {/* Сообщения */}
            <div className="lucy-messages">
              {messages.length === 0 ? (
                <div className="lucy-welcome">
                  <div className="welcome-icon">
                    <img 
                      src={CursorVerseIcon} 
                      alt="Lucy" 
                      style={{width:72,height:72,borderRadius:16}}
                    />
                  </div>
                  <h3>{t('lucy_welcome_title')}</h3>
                  <p>{t('lucy_welcome_desc')}</p>
            
            <div className="welcome-features">
              <div className="feature">
                <span>💬</span>
                <span>{t('lucy_feat_dialog')}</span>
              </div>
              <div className="feature">
                <span>🧠</span>
                <span>{t('lucy_feat_understanding')}</span>
              </div>
              <div className="feature">
                <span>💡</span>
                <span>{t('lucy_feat_creative')}</span>
              </div>
              <div className="feature">
                <span>📚</span>
                <span>{t('lucy_feat_knowledge')}</span>
              </div>
              <div className="feature">
                <span>🚀</span>
                <span>{t('lucy_feat_fast')}</span>
              </div>
            </div>

                  <div className="example-commands">
                    <p><strong>{t('lucy_examples_title')}</strong></p>
                    <ul>
                      <li>🖱️ "Поставь тему курсора Anime" - применить курсор</li>
                      <li>🐾 "Добавь питомца на рабочий стол" - вызвать питомца</li>
                      <li>🪟 "Покажи список открытых окон" - мониторинг</li>
                      <li>📁 "Открой папку Downloads" - быстрый доступ</li>
                      <li>🚀 "Запусти Discord" - открыть программу</li>
                      <li>💬 "Расскажи анекдот" - просто пообщаться</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <>
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? '👤' : (
                    <img 
                      src={CursorVerseIcon} 
                      alt="Lucy" 
                      style={{width:32,height:32,borderRadius:8}}
                    />
                  )}
                </div>
                <div className="message-bubble">
                  <div className="message-content">{msg.content}</div>
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString(lang === 'uk' ? 'uk-UA' : lang === 'en' ? 'en-US' : 'ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            ))}
            
            {isProcessing && (
              <div className="message lucy">
                <div className="message-avatar">
                  <img 
                    src={CursorVerseIcon} 
                    alt="Lucy" 
                    style={{width:32,height:32,borderRadius:8}}
                  />
                </div>
                <div className="message-bubble processing">
                  <div className="thinking-animation">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </div>
                  <span>{t('lucy_thinking')}</span>
                </div>
              </div>
                )}
              </>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Панель ввода */}
          <div className="lucy-input-panel">
            <div className="input-wrapper">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t('lucy_input_placeholder')}
                disabled={isProcessing}
                rows={1}
              />
              
              <div className="input-actions">
                <button
                  className={`btn-voice ${isListening ? 'listening' : ''} ${isProcessing ? 'disabled' : ''}`}
                  onClick={toggleVoiceRecognition}
                  disabled={isProcessing}
                  title={isListening ? 'Остановить распознавание' : 'Начать распознавание голоса'}
                >
                  <span className="mic-icon">🎤</span>
                </button>
                <button
                  className="btn-send"
                  onClick={() => handleSubmit()}
                  disabled={!inputText.trim() || isProcessing}
                  title={t('send_title')}
                >
                  ➤
                </button>
              </div>
            </div>

            <div className="lucy-controls">
              <button className="btn-control" onClick={clearHistory}>
                🗑️ {t('clear_history')}
              </button>
            </div>
          </div>
        </>
        )}
      </div>
    </>
  )
}

export default LucyAssistant
