import React, { useState, useEffect } from 'react'
import './MusicPlayer.css'
import { globalMusicController } from '../utils/globalMusicController'

function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(globalMusicController.isPlaying())
  const [volume, setVolume] = useState(globalMusicController.getVolume())
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const audio = globalMusicController.getAudioElement()
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)

    // Подписываемся на изменения состояния
    const unsubscribe = globalMusicController.subscribe(() => {
      setIsPlaying(globalMusicController.isPlaying())
      setVolume(globalMusicController.getVolume())
    })

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      unsubscribe()
    }
  }, [])

  const togglePlay = () => {
    globalMusicController.togglePlay()
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    globalMusicController.setVolume(newVolume)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    globalMusicController.setCurrentTime(newTime)
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="music-player">
      <div className="player-header">
        <div className="song-icon">🎵</div>
        <div className="song-info">
          <div className="song-title">Lilium</div>
          <div className="song-artist">Elfen Lied OST</div>
        </div>
      </div>

      <div className="player-controls">
        <button 
          className={`play-button ${isPlaying ? 'playing' : ''}`}
          onClick={togglePlay}
          title={isPlaying ? 'Пауза' : 'Воспроизвести'}
        >
          {isPlaying ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className="time-display">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      <div className="progress-container">
        <input
          type="range"
          className="progress-bar"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          step="0.1"
        />
      </div>

      <div className="volume-container">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="volume-icon">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
        <input
          type="range"
          className="volume-slider"
          min="0"
          max="1"
          value={volume}
          onChange={handleVolumeChange}
          step="0.01"
        />
        <span className="volume-percent">{Math.round(volume * 100)}%</span>
      </div>

      <div className="player-decorations">
        <div className="blood-drop drop-1"></div>
        <div className="blood-drop drop-2"></div>
        <div className="blood-drop drop-3"></div>
      </div>
    </div>
  )
}

export default MusicPlayer
