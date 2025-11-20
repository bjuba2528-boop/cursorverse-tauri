import { useEffect, useRef } from 'react'

function AnimatedGradient() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Адаптация размера под окно
    const updateSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    updateSize()
    window.addEventListener('resize', updateSize)

    // Цвета в стиле CursorVerse
    const colors = [
      [255, 0, 128],    // #FF0080 - розовый
      [199, 36, 177],   // #C724B1 - фиолетово-розовый
      [157, 0, 255],    // #9D00FF - фиолетовый
      [123, 0, 224],    // #7B00E0 - темно-фиолетовый
      [91, 0, 199],     // #5B00C7 - еще темнее
      [255, 20, 147],   // #FF1493 - ярко-розовый
      [30, 7, 49],      // #1E0731 - темный фон
      [45, 10, 78]      // #2D0A4E - темный фиолетовый
    ]

    let colorIndices = [0, 1, 2, 3]
    let step = 0
    const gradientSpeed = 0.002

    const updateGradient = () => {
      if (!ctx || !canvas) return

      const c0_0 = colors[colorIndices[0]]
      const c0_1 = colors[colorIndices[1]]
      const c1_0 = colors[colorIndices[2]]
      const c1_1 = colors[colorIndices[3]]

      const istep = 1 - step
      const r1 = Math.round(istep * c0_0[0] + step * c0_1[0])
      const g1 = Math.round(istep * c0_0[1] + step * c0_1[1])
      const b1 = Math.round(istep * c0_0[2] + step * c0_1[2])
      const color1 = `rgb(${r1},${g1},${b1})`

      const r2 = Math.round(istep * c1_0[0] + step * c1_1[0])
      const g2 = Math.round(istep * c1_0[1] + step * c1_1[1])
      const b2 = Math.round(istep * c1_0[2] + step * c1_1[2])
      const color2 = `rgb(${r2},${g2},${b2})`

      // Создаем градиент
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      gradient.addColorStop(0, color1)
      gradient.addColorStop(1, color2)

      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      step += gradientSpeed
      if (step >= 1) {
        step %= 1
        colorIndices[0] = colorIndices[1]
        colorIndices[2] = colorIndices[3]

        // Выбираем новые целевые цвета
        colorIndices[1] = (colorIndices[1] + Math.floor(1 + Math.random() * (colors.length - 1))) % colors.length
        colorIndices[3] = (colorIndices[3] + Math.floor(1 + Math.random() * (colors.length - 1))) % colors.length
      }
    }

    const intervalId = setInterval(updateGradient, 10)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -3,
        opacity: 0.6
      }}
    />
  )
}

export default AnimatedGradient
