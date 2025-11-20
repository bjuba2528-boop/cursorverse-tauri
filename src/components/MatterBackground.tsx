import { useEffect, useRef } from 'react'

interface Dimensions {
  width: number
  height: number
}

declare global {
  interface Window {
    Matter?: any
  }
}

function MatterBackground() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<any>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    // Динамическая загрузка Matter.js из CDN
    const loadMatter = async () => {
      if (window.Matter) {
        initMatter()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js'
      script.onload = () => {
        // Загрузка плагинов
        const attractorsScript = document.createElement('script')
        attractorsScript.src = 'https://cdn.jsdelivr.net/npm/matter-attractors@0.1.6/build/matter-attractors.min.js'
        attractorsScript.onload = () => {
          if (window.Matter) {
            window.Matter.use('matter-attractors')
            initMatter()
          }
        }
        document.body.appendChild(attractorsScript)
      }
      document.body.appendChild(script)
    }

    const initMatter = () => {
      if (!canvasRef.current || !window.Matter) return

      const Matter = window.Matter
      const dimensions: Dimensions = {
        width: window.innerWidth,
        height: window.innerHeight
      }

      // module aliases
      const Engine = Matter.Engine
      const Events = Matter.Events
      const Runner = Matter.Runner
      const Render = Matter.Render
      const World = Matter.World
      const Body = Matter.Body
      const Mouse = Matter.Mouse
      const Common = Matter.Common
      const Bodies = Matter.Bodies

      // create engine
      const engine = Engine.create()
      engineRef.current = engine

      engine.world.gravity.y = 0
      engine.world.gravity.x = 0
      engine.world.gravity.scale = 0.1

      // create renderer
      const render = Render.create({
        element: canvasRef.current!,
        engine: engine,
        options: {
          showVelocity: false,
          width: dimensions.width,
          height: dimensions.height,
          wireframes: false,
          background: 'transparent'
        }
      })

      // create runner
      const runner = Runner.create()

      // create demo scene
      const world = engine.world
      world.gravity.scale = 0

      // create a body with an attractor
      const attractiveBody = Bodies.circle(
        render.options.width / 2,
        render.options.height / 2,
        Math.max(dimensions.width / 4, dimensions.height / 4) / 2,
        {
          render: {
            fillStyle: 'transparent',
            strokeStyle: 'transparent',
            lineWidth: 0
          },
          isStatic: true,
          plugin: {
            attractors: [
              function (bodyA: any, bodyB: any) {
                return {
                  x: (bodyA.position.x - bodyB.position.x) * 1e-6,
                  y: (bodyA.position.y - bodyB.position.y) * 1e-6
                }
              }
            ]
          }
        }
      )

      World.add(world, attractiveBody)

      // add some bodies that to be attracted
      for (let i = 0; i < 60; i += 1) {
        const x = Common.random(0, render.options.width)
        const y = Common.random(0, render.options.height)
        const s = Common.random() > 0.6 ? Common.random(10, 80) : Common.random(4, 60)
        const poligonNumber = Common.random(3, 6)
        const body = Bodies.polygon(x, y, poligonNumber, s, {
          mass: s / 20,
          friction: 0,
          frictionAir: 0.02,
          angle: Math.round(Math.random() * 360),
          render: {
            fillStyle: 'rgba(255, 255, 255, 0.05)',
            strokeStyle: 'rgba(255, 0, 128, 0.15)',
            lineWidth: 2
          }
        })

        World.add(world, body)

        const r = Common.random(0, 1)
        const circle1 = Bodies.circle(x, y, Common.random(2, 8), {
          mass: 0.1,
          friction: 0,
          frictionAir: 0.01,
          render: {
            fillStyle: r > 0.3 ? 'rgba(255, 45, 106, 0.3)' : 'transparent',
            strokeStyle: 'rgba(233, 32, 46, 0.4)',
            lineWidth: 2
          }
        })
        World.add(world, circle1)

        const circle2 = Bodies.circle(x, y, Common.random(2, 20), {
          mass: 6,
          friction: 0,
          frictionAir: 0,
          render: {
            fillStyle: r > 0.3 ? 'rgba(66, 103, 248, 0.3)' : 'transparent',
            strokeStyle: 'rgba(50, 87, 232, 0.4)',
            lineWidth: 4
          }
        })
        World.add(world, circle2)

        const circle3 = Bodies.circle(x, y, Common.random(2, 30), {
          mass: 0.2,
          friction: 0.6,
          frictionAir: 0.8,
          render: {
            fillStyle: 'transparent',
            strokeStyle: 'rgba(255, 255, 255, 0.1)',
            lineWidth: 3
          }
        })
        World.add(world, circle3)
      }

      // add mouse control
      const mouse = Mouse.create(render.canvas)

      Events.on(engine, 'afterUpdate', function () {
        if (!mouse.position.x) return
        // smoothly move the attractor body towards the mouse
        Body.translate(attractiveBody, {
          x: (mouse.position.x - attractiveBody.position.x) * 0.12,
          y: (mouse.position.y - attractiveBody.position.y) * 0.12
        })
      })

      // Run the engine and renderer
      Runner.run(runner, engine)
      Render.run(render)

      // Handle window resize
      const handleResize = () => {
        const newDimensions = {
          width: window.innerWidth,
          height: window.innerHeight
        }
        render.canvas.width = newDimensions.width
        render.canvas.height = newDimensions.height
        render.options.width = newDimensions.width
        render.options.height = newDimensions.height
      }

      window.addEventListener('resize', handleResize)

      // Cleanup
      return () => {
        window.removeEventListener('resize', handleResize)
        Render.stop(render)
        Runner.stop(runner)
        World.clear(world, false)
        Engine.clear(engine)
      }
    }

    loadMatter()

    return () => {
      if (engineRef.current) {
        // Cleanup будет выполнен через возврат из initMatter
      }
    }
  }, [])

  return <div id="wrapper-canvas" ref={canvasRef}></div>
}

export default MatterBackground
