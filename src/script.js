import './style.css'
import * as THREE from 'three'
import gsap from 'gsap'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls'
import {
  Clock,
  LinearFilter, mergeUniforms,
  MeshDepthMaterial, NoBlending, RGBADepthPacking,
  RGBAFormat,
  sRGBEncoding, UniformsLib,
  WebGLMultisampleRenderTarget,
  WebGLRenderTarget
} from 'three'
import Guify from 'guify'
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer'
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass'
import {BokehPass} from './passes/BokehPass.js'

import vertexShader from './shaders/terrain/vertex.glsl'
import fragmentShader from './shaders/terrain/fragment.glsl'
import depthVertexShader from './shaders/depth/vertex.glsl'
import depthFragmentShader from './shaders/depth/fragment.glsl'
import overlayVertexShader from './shaders/overlay/vertex.glsl'
import overlayFragmentShader from './shaders/overlay/fragment.glsl'

let mouse = new THREE.Vector2(0, 0)
const clock = new Clock()

const gui = new Guify({
  align: 'right',
  theme: 'dark',
  width: '450px',
  barMode: 'none'
})

const guiDummy = {}
guiDummy.clearColor = '#1f1f25'

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: Math.min(window.devicePixelRatio, 2)
}

const camera = {}
camera.position = new THREE.Vector3()
camera.rotation = new THREE.Euler()
camera.rotation.reorder('YXZ')

const canvas = document.querySelector('canvas.webgl')
const scene = new THREE.Scene()
camera.instance = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.01,
  1000
)
camera.instance.rotation.reorder('YXZ')
// camera.instance.position.set(0, 1, 2)
scene.add(camera.instance)

const orbitControls = new OrbitControls(camera.instance, canvas)
// orbitControls.enabled = false
orbitControls.enableDamping = true //плавность вращения камеры

const renderer = new THREE.WebGLRenderer({
  canvas: canvas
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(sizes.pixelRatio) //ограничение кол-ва рендеров в завис-ти от плотности пикселей
renderer.setClearColor(guiDummy.clearColor, 1)
renderer.physicallyCorrectLights = true;
renderer.outputEncoding = THREE.sRGBEncoding;

window.addEventListener('resize', () => {
  //update sizes
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight
  sizes.pixelRatio = Math.min(window.devicePixelRatio, 2)

  //update camera
  camera.instance.aspect = sizes.width / sizes.height
  camera.instance.updateProjectionMatrix()

  //update renderer
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(sizes.pixelRatio)

  //update composer
  effectComposer.setSize(sizes.width, sizes.height)
  effectComposer.setPixelRatio(sizes.pixelRatio)

  //update passes
  bokehPass.renderTargetDepth.width = sizes.width * sizes.pixelRatio
  bokehPass.renderTargetDepth.height = sizes.height * sizes.pixelRatio
})

const renderTarget = new WebGLMultisampleRenderTarget(
  800,
  600,
  {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    format: RGBAFormat,
    encoding: sRGBEncoding
  }
)
const effectComposer = new EffectComposer(renderer)
const renderPass = new RenderPass(scene, camera.instance)
const bokehPass = new BokehPass(
  scene,
  camera.instance,
  {
    focus: 1.0,
    aperture: 0.002,
    maxblur: 0.01,
    width: sizes.width * sizes.pixelRatio,
    height: sizes.height * sizes.pixelRatio
  }
)
// bokehPass.enabled = false

effectComposer.setSize(sizes.width, sizes.height)
effectComposer.setPixelRatio(sizes.pixelRatio)
effectComposer.addPass(renderPass)
effectComposer.addPass(bokehPass)

//------------------------------------------------------------------------------------------------------
const terrain = {}

//texture
terrain.texture = {}
terrain.texture.visible = false
terrain.texture.linesCount = 5
terrain.texture.width = 32
terrain.texture.height = 128
terrain.texture.strongLineWidth = 0.08
terrain.texture.thinLineWidth = 0.01
terrain.texture.thinLineAlpha = 0.5
terrain.texture.canvas = document.createElement('canvas')
terrain.texture.canvas.width = terrain.texture.width
terrain.texture.canvas.height = terrain.texture.height
terrain.texture.canvas.style.position = 'fixed'
terrain.texture.canvas.style.top = 0
terrain.texture.canvas.style.left = 0
terrain.texture.canvas.style.zIndex = 1

if (terrain.texture.visible) {
  document.body.append(terrain.texture.canvas)
}

terrain.texture.context = terrain.texture.canvas.getContext('2d')


terrain.texture.instance = new THREE.CanvasTexture(terrain.texture.canvas)
terrain.texture.instance.wrapT = THREE.RepeatWrapping
terrain.texture.instance.wrapS = THREE.RepeatWrapping
terrain.texture.instance.magFilter = THREE.NearestFilter //уменьшение opacity по мере удаления (видимости объектов с opacity < 1)

terrain.texture.update = () => {
  terrain.texture.context.clearRect(0, 0, terrain.texture.width, terrain.texture.height)
  terrain.texture.context.fillStyle = '#00ffff'

  //Strong line
  terrain.texture.context.globalAlpha = 1.0
  const actualStrongLineWidth = Math.round(terrain.texture.height * terrain.texture.strongLineWidth)
  terrain.texture.context.fillRect(
    0,
    0,
    terrain.texture.width,
    actualStrongLineWidth
  )

  //Thin lines
  const thinLinesCount = terrain.texture.linesCount - 1
  const actualThinLineWidth = Math.round(terrain.texture.height * terrain.texture.thinLineWidth)
  for (let i = 0; i < thinLinesCount; ++i) {
    terrain.texture.context.globalAlpha = terrain.texture.thinLineAlpha
    terrain.texture.context.fillStyle = '#ffffff'
    terrain.texture.context.fillRect(
      0,
      actualStrongLineWidth + Math.round((terrain.texture.height - actualStrongLineWidth) / terrain.texture.linesCount) * (i + 1),
      terrain.texture.width,
      actualThinLineWidth
    )
  }

  //для того, чтобы текстура изменялась при изм-и gui
  terrain.texture.instance.needsUpdate = true
}

terrain.texture.update()

terrain.uniforms = {
  uTexture: {value: terrain.texture.instance},
  uTextureFrequency: {value: 10},
  uTextureOffset: {value: 0},
  uElevation: {value: 2},
  uTime: {value: 0},
  uElevationValley: {value: 0.4},
  uElevationValleyFrequency: {value: 1.0},
  uElevationGeneral: {value: 0.5},
  uElevationGeneralFrequency: {value: 0.3},
  uElevationDetails: {value: 0.2},
  uElevationDetailsFrequency: {value: 1.2},

  uHslHue: {value: 0.25},
  uHslHueOffset: {value: 0.6},
  uHslHueFrequency: {value: 20.0},
  uHslLightness: {value: 0.75},
  uHslLightnessVariation: {value: 0.25},
  uHslLightnessFrequency: {value: 20.0},
  uHslTimeFrequency: {value: 0.03}
}

terrain.geometry = new THREE.PlaneBufferGeometry(1, 1, 1000, 1000)
terrain.geometry.rotateX(-Math.PI * 0.5)
terrain.material = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  vertexShader: vertexShader,
  fragmentShader: fragmentShader,
  transparent: true,
  // depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: terrain.uniforms
})

//depth material
const uniforms = THREE.UniformsUtils.merge([
  THREE.UniformsLib.common,
  THREE.UniformsLib.displacementmap,
])
for (const uniformKey in uniforms) {
  uniforms[uniformKey] = terrain.uniforms[uniformKey]
}
terrain.depthMaterial = new THREE.ShaderMaterial({
  uniforms: uniforms,
  vertexShader: depthVertexShader,
  fragmentShader: depthFragmentShader,
});

// bokehPass.materialDepth = terrain.depthMaterial

// terrain.depthMaterial.morphTargets = false;
// terrain.depthMaterial.map = null;
// terrain.depthMaterial.alphaMap = null;
// terrain.depthMaterial.displacementMap = null;
// terrain.depthMaterial.displacementScale = 1;
// terrain.depthMaterial.displacementBias = 0;
// terrain.depthMaterial.wireframe = false;
// terrain.depthMaterial.wireframeLinewidth = 1;
// terrain.depthMaterial.fog = false;

terrain.depthMaterial.depthPacking = THREE.RGBADepthPacking;
terrain.depthMaterial.blending = THREE.NoBlending;

terrain.mesh = new THREE.Mesh(terrain.geometry, terrain.material)
terrain.mesh.scale.set(10, 10, 10)
terrain.mesh.userData.depthMaterial = terrain.depthMaterial
scene.add(terrain.mesh)

//OVERLAY
// -----------------------------------------------------------------------------------------
const overlay = {}

overlay.vignetteColor = {}
overlay.vignetteColor.value = '#00d9ff'
overlay.vignetteColor.instance = new THREE.Color(overlay.vignetteColor.value)

overlay.overlayColor = {}
overlay.overlayColor.value = '#000000'
overlay.overlayColor.instance = new THREE.Color(overlay.overlayColor.value)

overlay.geometry = new THREE.PlaneBufferGeometry(2, 2)
overlay.material = new THREE.ShaderMaterial({
  fragmentShader: overlayFragmentShader,
  vertexShader: overlayVertexShader,
  transparent: true,
  depthTest: false,
  uniforms: {
    uVignetteColor: {value: overlay.vignetteColor.instance},
    uVignetteOffset: {value: -0.176},
    uVignetteMultiplier: {value: 0.82},

    uOverlayColor: {value: overlay.overlayColor.instance},
    uOverlayAlpha: {value: 1.0}
  }
})
overlay.mesh = new THREE.Mesh(overlay.geometry, overlay.material)
overlay.mesh.userData.noBokeh = true
overlay.mesh.frustumCulled = false
scene.add(overlay.mesh)

window.requestAnimationFrame(() => {
  gsap.to(overlay.material.uniforms.uOverlayAlpha, {
    duration: 3,
    value: 0,
    delay: 0.4,
    ease: 'power2.out',
  })
})

// VIEWS
// ----------------------------------------------------------------------
const view = {}
view.index = 0
view.settings = [
  {
    position: {x: -0.0, y: 3.124, z: -0.3},
    rotation: {x: -1.489, y: -Math.PI, z: 0},
    focus: 2.14,
    parallaxMultiplier: 0.25
  },
  {
    position: {x: 2.36, y: 1.12, z: -1.43},
    rotation: {x: -0.385, y: 2.115, z: 0},
    focus: 2.14,
    parallaxMultiplier: 0.2
  },
  {
    position: {x: -0.411, y: 1.156, z: -2.713},
    rotation: {x: -0.398, y: -2.99, z: -7.53},
    focus: 2.14,
    parallaxMultiplier: 0.15
  },
  {
    position: {x: -2.963, y: 0.28, z: 0.03},
    rotation: {x: -0.09, y: -1.55, z: 0},
    focus: 2.2,
    parallaxMultiplier: 0.15
  },
]

view.current = view.settings[view.index]
// window.camera = camera.instance

// PARALLAX
// ----------------------------------------------------------------------
view.parallax = {}
view.parallax.target = {}
view.parallax.target.x = 0
view.parallax.target.y = 0
view.parallax.eased = {}
view.parallax.eased.x = 0
view.parallax.eased.y = 0
view.parallax.eased.multiplier = 4
view.parallax.multiplier = 0.25

window.addEventListener('mousemove', (event) => {
  mouse = {
    x: event.clientX / sizes.width - 0.5,
    y: event.clientY / sizes.height - 0.5,
  }

  view.parallax.target.x = (event.clientX / sizes.width - 0.5) * view.parallax.multiplier
  view.parallax.target.y = -(event.clientY / sizes.height - 0.5) * view.parallax.multiplier
})

view.apply = () => {
  camera.position.copy(view.current.position)
  camera.rotation.x = view.current.rotation.x
  camera.rotation.y = view.current.rotation.y
  bokehPass.materialBokeh.uniforms.focus.value = view.current.focus
  view.parallax.multiplier = view.current.parallaxMultiplier
}

view.change = (_index) => {
  view.index = _index
  view.current = view.settings[_index]

  gsap.to(overlay.material.uniforms.uOverlayAlpha, {
    duration: 1.25,
    value: 1,
    delay: 0.4,
    ease: 'power2.inOut',
    onComplete: () => {
      view.apply()

      gsap.to(overlay.material.uniforms.uOverlayAlpha, {
        duration: 1,
        value: 0,
        delay: 0.4,
        ease: 'power2.inOut',
      })
    }
  })
}

view.apply()

window.setInterval(() => {
  view.index += 1
  if (view.index > 3) view.index = 0
  view.change(view.index)
}, 7500)

const changeFocus = () => {
  gsap.to(
    bokehPass.materialBokeh.uniforms.focus, {
    duration: 0.5 + Math.random() * 3,
    delay: 0.5 + Math.random(),
    ease: 'power2.inOut',
    onComplete: changeFocus,
    value: view.current.focus + Math.random() - 0.2
  })
}

changeFocus()

// GUI
// -----------------------------------------------------------

const addGui = () => {
  gui.Register({
    type: 'folder',
    label: 'camera',
    open: false
  })

  gui.Register({
    folder: 'camera',
    object: orbitControls,
    property: 'enabled',
    type: 'checkbox',
    label: 'orbitControls'
  })

  gui.Register({
    type: 'folder',
    label: 'overlay',
    open: false
  })

  gui.Register({
    folder: 'overlay',
    object: overlay.vignetteColor,
    property: 'value',
    type: 'color',
    label: 'vignetteColor',
    format: 'hex',
    onChange: () => {
      overlay.vignetteColor.instance.set(overlay.vignetteColor.value)
    }
  })

  gui.Register({
    folder: 'overlay',
    object: overlay.material.uniforms.uVignetteOffset,
    property: 'value',
    type: 'range',
    label: 'vignetteOffset',
    min: -2,
    max: 2,
    step: 0.001
  })

  gui.Register({
    folder: 'overlay',
    object: overlay.material.uniforms.uVignetteMultiplier,
    property: 'value',
    type: 'range',
    label: 'vignetteMultiplier',
    min: 0,
    max: 5,
    step: 0.001
  })

  gui.Register({
    folder: 'overlay',
    object: overlay.overlayColor,
    property: 'value',
    type: 'color',
    label: 'overlayColor',
    format: 'hex',
    onChange: () => {
      overlay.overlayColor.instance.set(overlay.overlayColor.value)
    }
  })

  gui.Register({
    folder: 'overlay',
    object: overlay.material.uniforms.uOverlayAlpha,
    property: 'value',
    type: 'range',
    label: 'overlayAlpha',
    min: 0,
    max: 1,
    step: 0.001
  })

  gui.Register({
    type: 'folder',
    label: 'allSettings',
    open: false
  })

  gui.Register({
    folder: 'allSettings',
    object: terrain.texture,
    property: 'linesCount',
    type: 'range',
    label: 'linesCount',
    min: 1,
    max: 10,
    step: 1,
    onChange: terrain.texture.update
  })

  //превью линий в левом углу экрана
  gui.Register({
    folder: 'allSettings',
    object: terrain.texture,
    property: 'visible',
    type: 'checkbox',
    label: 'visible',
    onChange: () => {
      if (terrain.texture.visible) {
        document.body.append(terrain.texture.canvas)
      } else {
        document.body.removeChild(terrain.texture.canvas)
      }
    }
  })

  gui.Register({
    folder: 'allSettings',
    object: terrain.texture,
    property: 'strongLineWidth',
    type: 'range',
    label: 'strongLineWidth',
    min: 0,
    max: 0.1,
    step: 0.0001,
    onChange: terrain.texture.update
  })

  gui.Register({
    folder: 'allSettings',
    object: terrain.texture,
    property: 'thinLineWidth',
    type: 'range',
    label: 'thinLineWidth',
    min: 0,
    max: 0.1,
    step: 0.0001,
    onChange: terrain.texture.update
  })

  gui.Register({
    folder: 'allSettings',
    object: terrain.texture,
    property: 'thinLineAlpha',
    type: 'range',
    label: 'thinLineAlpha',
    min: 0,
    max: 1,
    step: 0.01,
    onChange: terrain.texture.update
  })

  gui.Register({
    folder: 'allSettings',
    object: guiDummy,
    property: 'clearColor',
    type: 'color',
    label: 'clearColor',
    format: 'hex',
    onChange: renderer.setClearColor(guiDummy.clearColor, 1)
  })

  gui.Register({
    folder: 'allSettings',
    object: terrain.uniforms.uElevation,
    property: 'value',
    type: 'range',
    label: 'uElevation',
    min: 0,
    max: 5,
    step: 0.001,
  })

  gui.Register({
    folder: 'allSettings',
    object: terrain.uniforms.uElevationValley,
    property: 'value',
    type: 'range',
    label: 'uElevationValley',
    min: 0,
    max: 1,
    step: 0.001,
  })

  gui.Register({
    folder: 'allSettings',
    object: terrain.uniforms.uElevationValleyFrequency,
    property: 'value',
    type: 'range',
    label: 'uElevationValleyFrequency',
    min: 0,
    max: 10,
    step: 0.001,
  })

  gui.Register({
    folder: 'allSettings',
    object: terrain.uniforms.uElevationGeneral,
    property: 'value',
    type: 'range',
    label: 'uElevationGeneral',
    min: 0,
    max: 1,
    step: 0.001,
  })

  gui.Register({
    folder: 'allSettings',
    object: terrain.uniforms.uElevationDetails,
    property: 'value',
    type: 'range',
    label: 'uElevationDetails',
    min: 0,
    max: 1,
    step: 0.001,
  })

  gui.Register({
    folder: 'allSettings',
    object: terrain.uniforms.uElevationDetailsFrequency,
    property: 'value',
    type: 'range',
    label: 'uElevationDetailsFrequency',
    min: 0,
    max: 5,
    step: 0.001,
  })

  gui.Register({
    folder: 'allSettings',
    object: terrain.uniforms.uElevationGeneralFrequency,
    property: 'value',
    type: 'range',
    label: 'uElevationGeneralFrequency',
    min: 0,
    max: 1,
    step: 0.001,
  })

  gui.Register({
    folder: 'allSettings',
    object: terrain.uniforms.uTextureOffset,
    property: 'value',
    type: 'range',
    label: 'uTextureOffset',
    min: 0,
    max: 1,
    step: 0.001,
  })

  gui.Register({
    type: 'folder',
    label: 'uHsl',
    open: false
  })

  gui.Register({
    folder: 'uHsl',
    object: terrain.uniforms.uHslHue,
    property: 'value',
    type: 'range',
    label: 'uHslHue',
    min: 0,
    max: 1,
    step: 0.001,
  })

  gui.Register({
    folder: 'uHsl',
    object: terrain.uniforms.uHslHueOffset,
    property: 'value',
    type: 'range',
    label: 'uHslHueOffset',
    min: 0,
    max: 1,
    step: 0.001,
  })

  gui.Register({
    folder: 'uHsl',
    object: terrain.uniforms.uHslHueFrequency,
    property: 'value',
    type: 'range',
    label: 'uHslHueFrequency',
    min: 0,
    max: 50,
    step: 0.01,
  })

  gui.Register({
    folder: 'uHsl',
    object: terrain.uniforms.uHslLightness,
    property: 'value',
    type: 'range',
    label: 'uHslLightness',
    min: 0,
    max: 1,
    step: 0.001,
  })

  gui.Register({
    folder: 'uHsl',
    object: terrain.uniforms.uHslLightnessVariation,
    property: 'value',
    type: 'range',
    label: 'uHslLightnessVariation',
    min: 0,
    max: 1,
    step: 0.001,
  })

  gui.Register({
    folder: 'uHsl',
    object: terrain.uniforms.uHslLightnessFrequency,
    property: 'value',
    type: 'range',
    label: 'uHslLightnessFrequency',
    min: 0,
    max: 50,
    step: 0.001,
  })

  gui.Register({
    folder: 'uHsl',
    object: terrain.uniforms.uHslTimeFrequency,
    property: 'value',
    type: 'range',
    label: 'uHslTimeFrequency',
    min: 0,
    max: 0.2,
    step: 0.001,
  })

  gui.Register({
    type: 'folder',
    label: 'bokehPass',
    open: false
  })

  //дальность фокусировки
  gui.Register({
    folder: 'bokehPass',
    object: bokehPass.materialBokeh.uniforms.focus,
    property: 'value',
    type: 'range',
    label: 'focus',
    min: 0,
    max: 10,
    step: 0.01
  })

  //ширина чётких линий
  gui.Register({
    folder: 'bokehPass',
    object: bokehPass.materialBokeh.uniforms.aperture,
    property: 'value',
    type: 'range',
    label: 'aperture',
    min: 0,
    max: 0.1,
    step: 0.0001
  })

  //ширина размытых линий
  gui.Register({
    folder: 'bokehPass',
    object: bokehPass.materialBokeh.uniforms.maxblur,
    property: 'value',
    type: 'range',
    label: 'maxblur',
    min: 0,
    max: 0.1,
    step: 0.0001
  })

  //отключение
  gui.Register({
    folder: 'bokehPass',
    object: bokehPass,
    property: 'enabled',
    type: 'checkbox',
    label: 'enabled',
  })

  gui.Register({
    type: 'folder',
    label: 'views',
    open: true
  })

  for (const _settingsIndex in view.settings) {
    gui.Register({
      type: 'button',
      label: `change${_settingsIndex}`,
      action: () => {
        view.change(_settingsIndex)
      }
    })
  }


}
addGui()

//---------------------------------------------------------------------------------------------------------
let lastElapsedTime = 0
const tick = () => {
  const elapsedTime = clock.getElapsedTime()
  const deltaTime = elapsedTime - lastElapsedTime
  lastElapsedTime = elapsedTime
  terrain.uniforms.uTime.value = elapsedTime

  //Update controls
  if (orbitControls.enabled) {
    orbitControls.update() //если включён Damping для камеры необходимо её обновлять в каждом кадре
  }

  camera.instance.position.copy(camera.position)

  view.parallax.eased.x += (view.parallax.target.x - view.parallax.eased.x) * deltaTime * view.parallax.eased.multiplier
  view.parallax.eased.y += (view.parallax.target.y - view.parallax.eased.y) * deltaTime * view.parallax.eased.multiplier

  camera.instance.translateX(view.parallax.eased.x)
  camera.instance.translateY(view.parallax.eased.y)

  camera.instance.rotation.x = camera.rotation.x
  camera.instance.rotation.y = camera.rotation.y

  // renderer.render(scene, camera.instance)
  effectComposer.render()
  window.requestAnimationFrame(tick)
}

tick()