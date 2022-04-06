import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
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
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
import { BokehPass } from './passes/BokehPass.js'

import vertexShader from './shaders/terrain/vertex.glsl'
import fragmentShader from './shaders/terrain/fragment.glsl'
import depthVertexShader from './shaders/depth/vertex.glsl'
import depthFragmentShader from './shaders/depth/fragment.glsl'

let mouse = new THREE.Vector2(0, 0)
const clock = new Clock()

const gui = new Guify({
  align: 'right',
  theme: 'dark',
  barMode: 'none'
})

const guiDummy = {}
guiDummy.clearColor = '#1f1f25'

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: Math.min(window.devicePixelRatio, 2)
}

const canvas = document.querySelector('canvas.webgl')
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.01,
  1000
)
camera.position.set(0, 1, 2)
scene.add(camera)
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true //плавность вращения камеры

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
  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()

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

window.addEventListener('mousemove', (event) => {
  mouse = {
    x: event.clientX / window.innerWidth - 0.5,
    y: event.clientY / window.innerHeight - 0.5,
  }
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
const renderPass = new RenderPass(scene, camera)
const bokehPass = new BokehPass(
  scene,
  camera,
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
terrain.texture.linesCount = 5
terrain.texture.width = 32
terrain.texture.height = 128
terrain.texture.strongLineWidth = 0.04
terrain.texture.thinLineWidth = 0.01
terrain.texture.thinLineAlpha = 0.5
terrain.texture.canvas = document.createElement('canvas')
terrain.texture.canvas.width = terrain.texture.width
terrain.texture.canvas.height = terrain.texture.height
terrain.texture.canvas.style.position = 'fixed'
terrain.texture.canvas.style.top = 0
terrain.texture.canvas.style.left = 0
terrain.texture.canvas.style.zIndex = 1
document.body.append(terrain.texture.canvas)

terrain.texture.context = terrain.texture.canvas.getContext('2d')


terrain.texture.instance = new THREE.CanvasTexture(terrain.texture.canvas)
terrain.texture.instance.wrapT = THREE.RepeatWrapping
terrain.texture.instance.wrapS = THREE.RepeatWrapping
terrain.texture.instance.magFilter = THREE.NearestFilter //уменьшение opacity по мере удаления (видимости объектов с opacity < 1)

terrain.texture.update = () => {
  terrain.texture.context.clearRect(0, 0, terrain.texture.width, terrain.texture.height)
  terrain.texture.context.fillStyle = '#ffffff'

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
  uElevation: {value: 2},
  uTime: {value: 0}
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

// GUI
// -----------------------------------------------------------

const addGui = () => {
  gui.Register({
    object: terrain.texture,
    property: 'linesCount',
    type: 'range',
    label: 'linesCount',
    min: 1,
    max: 10,
    step: 1,
    onChange: terrain.texture.update
  })

  gui.Register({
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
    object: guiDummy,
    property: 'clearColor',
    type: 'color',
    label: 'clearColor',
    format: 'hex',
    onChange: renderer.setClearColor(guiDummy.clearColor, 1)
  })

  gui.Register({
    object: terrain.uniforms.uElevation,
    property: 'value',
    type: 'range',
    label: 'uElevation',
    min: 0,
    max: 5,
    step: 0.001,
  })

  gui.Register({
    object: terrain.uniforms.uTextureFrequency,
    property: 'value',
    type: 'range',
    label: 'uTextureFrequency',
    min: 1,
    max: 50,
    step: 1,
  })

  gui.Register({
    type: 'folder',
    label: 'bokehPass',
    open: true
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

}
addGui()

//---------------------------------------------------------------------------------------------------------

const tick = () => {
  const elapsedTime = clock.getElapsedTime()
  terrain.uniforms.uTime.value = elapsedTime

  //Update controls
  controls.update() //если включён Damping для камеры необходимо её обновлять в каждом кадре

  // renderer.render(scene, camera)
  effectComposer.render()
  window.requestAnimationFrame(tick)
}

tick()