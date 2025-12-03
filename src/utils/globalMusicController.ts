// Глобальный контроллер музыки для сохранения воспроизведения между переключениями вкладок

class GlobalMusicController {
  private audio: HTMLAudioElement | null = null
  private listeners: Set<() => void> = new Set()

  constructor() {
    // Создаем единственный аудио элемент при инициализации
    if (typeof window !== 'undefined') {
      this.audio = new Audio('/audio/lilium.mp3')
      this.audio.loop = true
      this.audio.volume = 0.05 // 5% громкость по умолчанию
    }
  }

  // Получить аудио элемент
  getAudioElement(): HTMLAudioElement | null {
    return this.audio
  }

  // Воспроизведение
  play(): void {
    this.audio?.play().catch(err => console.error('Ошибка воспроизведения:', err))
    this.notifyListeners()
  }

  // Пауза
  pause(): void {
    this.audio?.pause()
    this.notifyListeners()
  }

  // Переключить воспроизведение
  togglePlay(): void {
    if (this.audio?.paused) {
      this.play()
    } else {
      this.pause()
    }
  }

  // Проверка состояния
  isPlaying(): boolean {
    return this.audio ? !this.audio.paused : false
  }

  // Установить громкость (0-1)
  setVolume(volume: number): void {
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, volume))
      this.notifyListeners()
    }
  }

  // Получить громкость
  getVolume(): number {
    return this.audio?.volume ?? 0.05
  }

  // Установить текущее время
  setCurrentTime(time: number): void {
    if (this.audio) {
      this.audio.currentTime = time
      this.notifyListeners()
    }
  }

  // Получить текущее время
  getCurrentTime(): number {
    return this.audio?.currentTime ?? 0
  }

  // Получить длительность
  getDuration(): number {
    return this.audio?.duration ?? 0
  }

  // Подписаться на изменения
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  // Уведомить всех слушателей
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener())
  }
}

// Единственный экземпляр контроллера
export const globalMusicController = new GlobalMusicController()
