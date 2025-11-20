import '../StartScreen.css'

interface StartScreenProps {
  onStart: () => void
}

function StartScreen({ onStart }: StartScreenProps) {

  return (
    <div className="start-screen">
      {/* Волны */}
      <div className="wave"></div>
      <div className="wave"></div>
      <div className="wave"></div>

      {/* Декоративные элементы */}
      <div className="decorative-elements">
        <div className="floating-circle circle-1"></div>
        <div className="floating-circle circle-2"></div>
        <div className="floating-circle circle-3"></div>
        <div className="floating-circle circle-4"></div>
        <div className="floating-square square-1"></div>
        <div className="floating-square square-2"></div>
      </div>

      {/* 3D сфера */}
      <div className="sphere-view">
        <div className="sphere-plane">
          <div className="sphere-circle"></div>
          <div className="sphere-circle"></div>
          <div className="sphere-circle"></div>
          <div className="sphere-circle"></div>
          <div className="sphere-circle"></div>
        </div>
      </div>

      {/* Контент стартового экрана */}
      <div className="start-content">
        <div className="start-logo">
          <h1 className="start-title">CursorVerse</h1>
          <p className="start-subtitle">Персонализируйте свой Windows</p>
        </div>
        
        <div className="start-buttons">
          <button className="start-button" onClick={onStart}>
            Начать
          </button>
        </div>
      </div>
    </div>
  )
}

export default StartScreen
