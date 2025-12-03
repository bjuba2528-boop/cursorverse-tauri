// TTS (Text-to-Speech) сервис для озвучки Lucy
// Использует Web Speech API (встроенный в браузер)

class TTSService {
  private synth: SpeechSynthesis | null = null
  private voices: SpeechSynthesisVoice[] = []
  private enabled: boolean = true

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis
      this.loadVoices()
      
      // Голоса могут загружаться асинхронно
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => this.loadVoices()
      }
      
      // Загружаем настройки
      const saved = localStorage.getItem('lucy_tts_enabled')
      this.enabled = saved !== 'false' // По умолчанию включено
      
      console.log('🔊 TTS сервис инициализирован')
    } else {
      console.warn('⚠️ Web Speech API не поддерживается в этом браузере')
    }
  }

  private loadVoices() {
    if (!this.synth) return
    
    this.voices = this.synth.getVoices()
    console.log(`🗣️ Загружено голосов: ${this.voices.length}`)
    
    // Показываем доступные русские голоса
    const russianVoices = this.voices.filter(v => v.lang.startsWith('ru'))
    console.log('🇷🇺 Русские голоса:', russianVoices.map(v => v.name))
  }

  // Получить лучший женский голос для Lucy
  private getBestVoice(lang: string = 'ru-RU'): SpeechSynthesisVoice | null {
    if (this.voices.length === 0) return null

    // Приоритет женских голосов
    const femaleNames = ['female', 'woman', 'anna', 'elena', 'irina', 'алена', 'милена', 'светлана']
    
    // Ищем русские женские голоса
    let voice = this.voices.find(v => 
      v.lang === lang && 
      femaleNames.some(name => v.name.toLowerCase().includes(name))
    )
    
    // Если не найден, берём любой русский
    if (!voice) {
      voice = this.voices.find(v => v.lang === lang)
    }
    
    // Если и русского нет, берём любой с нужным языковым кодом
    if (!voice) {
      voice = this.voices.find(v => v.lang.startsWith(lang.split('-')[0]))
    }
    
    // В крайнем случае - первый доступный
    if (!voice && this.voices.length > 0) {
      voice = this.voices[0]
    }
    
    return voice || null
  }

  // Озвучить текст
  speak(text: string, options?: {
    lang?: string
    rate?: number
    pitch?: number
    volume?: number
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.enabled) {
        console.log('🔇 TTS отключен')
        resolve()
        return
      }

      if (!this.synth) {
        console.warn('⚠️ TTS не поддерживается')
        reject(new Error('TTS не поддерживается'))
        return
      }

      // Останавливаем предыдущую озвучку
      this.stop()

      const utterance = new SpeechSynthesisUtterance(text)
      
      // Настройки голоса
      const voice = this.getBestVoice(options?.lang || 'ru-RU')
      if (voice) {
        utterance.voice = voice
        console.log(`🗣️ Используется голос: ${voice.name} (${voice.lang})`)
      }
      
      // Параметры речи
      utterance.rate = options?.rate ?? 1.0    // Скорость (0.1 - 10)
      utterance.pitch = options?.pitch ?? 1.1   // Тон (0 - 2), чуть выше для женского голоса
      utterance.volume = options?.volume ?? 0.8 // Громкость (0 - 1)
      
      utterance.onend = () => {
        console.log('✅ Озвучка завершена')
        resolve()
      }
      
      utterance.onerror = (event) => {
        console.error('❌ Ошибка TTS:', event.error)
        reject(new Error(`TTS error: ${event.error}`))
      }
      
      this.synth.speak(utterance)
      console.log('🔊 Озвучиваю:', text.substring(0, 50) + (text.length > 50 ? '...' : ''))
    })
  }

  // Остановить озвучку
  stop() {
    if (this.synth && this.synth.speaking) {
      this.synth.cancel()
      console.log('⏹️ Озвучка остановлена')
    }
  }

  // Пауза
  pause() {
    if (this.synth && this.synth.speaking) {
      this.synth.pause()
      console.log('⏸️ Озвучка на паузе')
    }
  }

  // Продолжить
  resume() {
    if (this.synth && this.synth.paused) {
      this.synth.resume()
      console.log('▶️ Озвучка продолжена')
    }
  }

  // Проверка активности
  isSpeaking(): boolean {
    return this.synth?.speaking || false
  }

  // Включить/выключить TTS
  setEnabled(enabled: boolean) {
    this.enabled = enabled
    localStorage.setItem('lucy_tts_enabled', String(enabled))
    
    if (!enabled) {
      this.stop()
    }
    
    console.log(`🔊 TTS ${enabled ? 'включен' : 'выключен'}`)
  }

  // Получить статус
  isEnabled(): boolean {
    return this.enabled
  }

  // Получить список всех доступных голосов
  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.voices
  }

  // Проверка поддержки
  isSupported(): boolean {
    return !!this.synth
  }
}

// Экспортируем синглтон
export const ttsService = new TTSService()
