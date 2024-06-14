import './style.css';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const canvas = document.getElementById('myCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 1000);
camera.position.set(0, 10, 25);

const controls = new OrbitControls(camera, renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
scene.add(directionalLight);
directionalLight.position.set(0, 5, 5);
directionalLight.castShadow = true;

const planeMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.MeshStandardMaterial({ side: THREE.DoubleSide })
);
scene.add(planeMesh);
planeMesh.receiveShadow = true;

const gltfLoader = new GLTFLoader();

let mixer;
const animationMap = new Map();
let activeAction;
const moveDirection = new THREE.Vector3(); // Initialize moveDirection vector
const speed = 0.05;

// Load the equirectangular panoramic image and set it as the scene background
new THREE.TextureLoader().load('/Material_diffuse.jpeg', texture => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = texture;
});

// Load GLTF model
gltfLoader.load('/oldman.glb', (gltf) => {
  const john = gltf.scene;
  john.name = 'john';
  const scale = 2;
  john.scale.set(scale, scale, scale);
  john.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
    }
  });
  john.castShadow = true;
  scene.add(john);

  mixer = new THREE.AnimationMixer(john);
  gltf.animations.forEach((clip) => {
    const action = mixer.clipAction(clip);
    animationMap.set(clip.name, action);
  });

  // Set default animation
  playAnimation('idle');

}, undefined, (error) => {
  console.error('An error occurred while loading the model', error);
});

// Functions to control animations
const playAnimation = (name) => {
  const toAction = animationMap.get(name);
  if (toAction && toAction !== activeAction) {
    const fromAction = activeAction;
    activeAction = toAction;
    if (fromAction) {
      fromAction.fadeOut(0.5);
    }
    toAction.reset().fadeIn(0.5).play();
  }
};

const stopAnimation = (name) => {
  const action = animationMap.get(name);
  if (action && action === activeAction) {
    action.fadeOut(0.5);
    activeAction = null; // Reset activeAction when stopping animation
    playAnimation('idle');
  }
};

// Update position based on moveDirection vector
const updatePosition = () => {
  const model = scene.getObjectByName('john');
  if (model) {
    const displacement = moveDirection.clone().multiplyScalar(speed);
    model.position.add(displacement);
    if (moveDirection.lengthSq() > 0) {
      model.lookAt(model.position.clone().add(moveDirection));
    }
  }
};

// Keyboard input handlers
const onKeydown = (e) => {
  switch (e.code) {
    case 'ArrowUp':
      moveDirection.z = -1;
      break;
    case 'ArrowDown':
      moveDirection.z = 1;
      break;
    case 'ArrowLeft':
      moveDirection.x = -1;
      break;
    case 'ArrowRight':
      moveDirection.x = 1;
      break;
  }
  playAnimation('walking'); // Always play walking animation on keydown
};

const onKeyup = (e) => {
  switch (e.code) {
    case 'ArrowUp':
    case 'ArrowDown':
      moveDirection.z = 0;
      break;
    case 'ArrowLeft':
    case 'ArrowRight':
      moveDirection.x = 0;
      break;
  }
  if (moveDirection.lengthSq() === 0) {
    stopAnimation('walking'); // Stop walking animation only if no movement keys are pressed
  }
};

document.addEventListener('keydown', onKeydown);
document.addEventListener('keyup', onKeyup);

// Cannon.js physics
const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0)
});

const groundBody = new CANNON.Body({
  shape: new CANNON.Box(new CANNON.Vec3(15, 15, 0.1)),
  type: CANNON.Body.STATIC
});
world.addBody(groundBody);
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);

// Animation loop
const clock = new THREE.Clock();

const animate = () => {
  const delta = clock.getDelta();
  world.step(delta);

  if (mixer) {
    mixer.update(delta);
  }

  updatePosition(); // Update character position based on moveDirection

  planeMesh.position.copy(groundBody.position);
  planeMesh.quaternion.copy(groundBody.quaternion);

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
};

// Resize handler
const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

window.addEventListener('resize', onWindowResize);
animate();
