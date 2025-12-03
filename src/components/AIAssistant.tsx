import React, { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { smartExecute } from '../utils/autonomousAgent'
import { customCommandsManager, type CustomCommand } from '../utils/customCommands'
import CustomCommandsManager from './CustomCommandsManager'
import LLMSettings from './LLMSettings'
import './AIAssistant.css'

interface Message {
  role: string
  content: string
}

const AIAssistant: React.FC = () => {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [agentReady, setAgentReady] = useState(false)
  const [processing, setProcessing] = useState(false)
  // Новая архитектура: используем глобальный модуль VoiceRecognition из voice-lucy-assistant
  const recognitionRef = useRef<any>(null)
  const [hotkey, setHotkey] = useState('')
  const [hotkeySaving, setHotkeySaving] = useState(false)
  const [hotkeyError, setHotkeyError] = useState('')

  // Инициализация агента, хоткея и wake word при загрузке
  useEffect(() => {
    initAgent()
    loadHotkey()
    setupGlobalStartListener()
    // Привязываем события новой системы распознавания, если доступна
    const vr = (window as any).voiceRecognition
    if (vr) {
      recognitionRef.current = vr
    }

    return () => {
      // cleanup не требуется для новой интеграции здесь
    }
  }, [])

  const initAgent = async () => {
    // Автономный агент всегда готов к работе
    setAgentReady(true)
    console.log('🤖 Автономный AI агент готов к работе')
  }

  const loadHotkey = async () => {
    try {
      const current = await invoke<string>('get_listen_hotkey')
      setHotkey(current || 'Ctrl+Shift+L')
    } catch (e) {
      console.error('Не удалось получить хоткей', e)
    }
  }

  const setupGlobalStartListener = () => {
    listen('start-listening', () => {
      console.log('Событие start-listening получено')
      startListening()
    }).catch(err => console.error('Не удалось подписаться на start-listening', err))
  }

  // ...удалено: warmUpMic старой реализации Web Speech API

  // ...удалено: initWakeWordRecognition (wake word) старая реализация

  // ...удалено: initSpeechRecognition (Web Speech API) старая реализация

  // Обработка команды через автономного агента
  const processCommand = async (text: string) => {
    setProcessing(true)
    
    setMessages(prev => [...prev, { role: 'user', content: text }])

    try {
      console.log('🤖 Обрабатываю команду:', text)
      
      // Сначала проверяем пользовательские команды
      const customCommand = customCommandsManager.findCommandByPhrase(text)
      
      let response: string
      
      if (customCommand) {
        console.log('✅ Найдена пользовательская команда:', customCommand.phrase)
        response = await executeCustomCommand(customCommand)
      } else {
        // Используем автономного агента
        response = await smartExecute(text)
      }
      
      // Добавляем ответ агента
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response
      }])
      
      // Озвучиваем ответ
      speak(response)
      
    } catch (e) {
      console.error('❌ Ошибка обработки команды:', e)
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `❌ Ошибка выполнения: ${e}` 
      }])
      speak('Произошла ошибка при выполнении команды')
    } finally {
      setProcessing(false)
    }
  }

  // Выполнение пользовательской команды
  const executeCustomCommand = async (command: CustomCommand): Promise<string> => {
    try {
      switch (command.action) {
        case 'open_file':
        case 'open_folder':
          const openCmd = `start "" "${command.target}"`
          await smartExecute(openCmd)
          return `✅ Открываю: ${command.target}`
        
        case 'run_command':
          const result = await smartExecute(command.target)
          return `✅ Выполнено: ${result}`
        
        case 'open_url':
          window.open(command.target, '_blank')
          return `✅ Открываю URL: ${command.target}`
        
        default:
          return '❌ Неизвестный тип команды'
      }
    } catch (e) {
      return `❌ Ошибка выполнения: ${e}`
    }
  }

  // Озвучивание текста (TTS) с улучшенным качеством
  const speak = (text: string) => {
    // Останавливаем предыдущее воспроизведение
    window.speechSynthesis.cancel()
    
    const utterance = new SpeechSynthesisUtterance(text)
    
    // Получаем список доступных голосов
    const voices = window.speechSynthesis.getVoices()
    
    // Ищем лучший русский женский голос
    const russianVoice = voices.find(v => 
      v.lang.startsWith('ru') && (v.name.includes('Female') || v.name.includes('female'))
    ) || voices.find(v => v.lang.startsWith('ru'))
    
    if (russianVoice) {
      utterance.voice = russianVoice
      console.log('Используется голос:', russianVoice.name)
    }
    
    // Настройки голоса для приятного звучания
    utterance.rate = 0.95 // Немного медленнее для четкости
    utterance.pitch = 1.1 // Чуть выше для женского голоса
    utterance.volume = 0.9 // Громкость
    utterance.lang = 'ru-RU'
    
    window.speechSynthesis.speak(utterance)
  }
  
  // Загрузка голосов при инициализации
  useEffect(() => {
    if ('speechSynthesis' in window) {
      // Голоса загружаются асинхронно
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices()
        console.log('Доступные голоса:', voices.map(v => v.name))
      }
      
      loadVoices()
      window.speechSynthesis.onvoiceschanged = loadVoices
    }
  }, [])

  // Начать/остановить прослушивание
  const toggleListening = () => {
    if (listening) {
      stopListening()
    } else {
      startListening()
    }
  }

  // Начать прослушивание
  const startListening = () => {
    const vr = (window as any).voiceRecognition
    if (vr && typeof vr.start === 'function') {
      setTranscript('Слушаю...')
      setListening(true)
      vr.start()
      // Подпишемся на финальный результат через перехват sendToLucy
      const originalSendToLucy = vr.sendToLucy?.bind(vr)
      if (originalSendToLucy) {
        vr.sendToLucy = async (text: string) => {
          setTranscript(text)
          await processCommand(text)
          return originalSendToLucy(text)
        }
      }
    } else {
      alert('Модуль голосового распознавания недоступен')
    }
  }

  // Остановить прослушивание
  const stopListening = () => {
    const vr = (window as any).voiceRecognition
    if (vr && typeof vr.stop === 'function') {
      vr.stop()
    }
    setListening(false)
  }

  // Очистить историю
  const clearHistory = async () => {
    try {
      await invoke('clear_conversation')
      setMessages([])
    } catch (e) {
      console.error('Ошибка очистки истории:', e)
    }
  }

  const validateHotkey = (value: string) => {
    // Простая проверка наличия хотя бы одного '+' и буквы
    return /\+/.test(value) && /[A-Za-z]/.test(value)
  }

  const saveHotkey = async () => {
    setHotkeyError('')
    if (!validateHotkey(hotkey)) {
      setHotkeyError('Формат: Ctrl+Alt+M или Shift+F9 и т.п.')
      return
    }
    setHotkeySaving(true)
    try {
      await invoke('set_listen_hotkey', { hotkey })
    } catch (e:any) {
      setHotkeyError('Ошибка сохранения: ' + e)
    } finally {
      setHotkeySaving(false)
    }
  }

  return (
    <div className="ai-assistant">
      <div className="assistant-header">
        <div className="assistant-title">
          <img src="CursorVerse.ico" alt="CursorVerse" className="assistant-icon" />
          <h2>Люси - AI Ассистент</h2>
        </div>
        <div className="status-indicator">
          <span className={`status-dot ${agentReady ? 'ready' : 'offline'}`}></span>
          <span className="status-text">
            {agentReady ? '🤖 Автономный агент готов' : '⚠️ Агент недоступен'}
          </span>
        </div>
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>👋 Привет! Я Люси, автономный AI-агент с полным контролем системы.</p>
            <p>🎙️ Скажите <strong>"Люси"</strong> чтобы я начала слушать!</p>
            <p>Примеры команд:</p>
            <ul>
              <li>"Открой блокнот" / "Калькулятор" / "Проводник"</li>
              <li>"Список процессов"</li>
              <li>"Информация о системе"</li>
              <li>"Создай файл test.txt"</li>
            </ul>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="message-icon">
                {msg.role === 'user' ? '👤' : <img src="CursorVerse.ico" alt="Люси" className="message-icon-img" />}
              </div>
              <div className="message-content">{msg.content}</div>
            </div>
          ))
        )}
      </div>

      <div className="transcript-display">
        {transcript && <p className="transcript">{transcript}</p>}
        {processing && <p className="processing">Обрабатываю команду...</p>}
      </div>

      <div className="controls">
        <button
          className={`mic-button ${listening ? 'listening' : ''}`}
          onClick={toggleListening}
          disabled={processing}
        >
          {listening ? (
            <>
              <span className="mic-icon pulse">🎤</span>
              <span>Слушаю...</span>
            </>
          ) : (
            <>
              <span className="mic-icon">🎤</span>
              <span>Начать слушать</span>
            </>
          )}
        </button>

        <button className="clear-button" onClick={clearHistory}>
          🗑️ Очистить историю
        </button>

        <button className="refresh-button" onClick={initAgent}>
          🔄 Перезапустить агента
        </button>
      </div>

      <div className="assistant-info">
        <p className="info-text">
          💡 <strong>Совет:</strong> Автономный агент с полным контролем системы. Может открывать приложения, файлы и выполнять команды.
        </p>
      </div>

      <div className="hotkey-settings">
        <h3>Глобальный хоткей микрофона</h3>
        <p className="info-text">Измените сочетание для мгновенного начала прослушивания.</p>
        <input
          type="text"
          value={hotkey}
          onChange={e => setHotkey(e.target.value)}
          placeholder="Ctrl+Shift+L"
          className="hotkey-input"
        />
        <button onClick={saveHotkey} disabled={hotkeySaving} className="save-hotkey-btn">
          {hotkeySaving ? 'Сохранение...' : 'Сохранить хоткей'}
        </button>
        {hotkeyError && <p className="error-text">{hotkeyError}</p>}
        <p className="hint-text">Примеры: Ctrl+Shift+L | Ctrl+Alt+M | Shift+F9</p>
      </div>

      {/* Менеджер пользовательских команд */}
      <CustomCommandsManager />

      {/* Настройки LLM провайдера */}
      <LLMSettings />
    </div>
  )
}

export default AIAssistant
