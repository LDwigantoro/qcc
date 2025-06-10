let camera, scene, renderer, controller, model;
let fallbackScene, fallbackCamera, fallbackRenderer;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(navigator.userAgent);
const isMobile = isIOS || isAndroid;
let isARSupported = false;
let currentModel = 'tower1';
const modelUrls = {
    'tower1': './assets/tower1.glb',
    'tower2': './assets/tower2.glb',
    'tower3': './assets/tower3.glb'
};
let currentModelUrl = modelUrls[currentModel];

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    setupIOSFix();
    setupEventListeners();
    setupModelSelector();

    try {
        isARSupported = await checkARSupport();
        if (isIOS && !isARSupported) {
            document.getElementById('ar-button').style.display = 'none';
        }
    } catch (e) {
        console.error("AR initialization error:", e);
        isARSupported = false;
    }
}

function setupEventListeners() {
    // Tower selection
    document.querySelectorAll('.tower-option').forEach(option => {
        option.addEventListener('click', handleSelection);
        option.addEventListener('touchend', handleSelection);
    });

    // Back buttons
    document.getElementById('back-button').addEventListener('click', showMainMenu);
    document.getElementById('quicklook-back').addEventListener('click', showMainMenu);

    // Window resize with debounce
    window.addEventListener('resize', debounce(onWindowResize, 100));
}

function handleSelection(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Visual feedback
    this.style.transform = 'scale(0.95)';
    setTimeout(() => {
        this.style.transform = '';
    }, 200);

    currentModel = this.getAttribute('data-model');
    currentModelUrl = modelUrls[currentModel];
    loadModelViewer();
}

async function checkARSupport() {
    if (!window.XRSession || !navigator.xr) return false;
    
    try {
        const supported = await navigator.xr.isSessionSupported('immersive-ar');
        console.log(`AR supported: ${supported}`);
        return supported;
    } catch (e) {
        console.error("Error checking AR support:", e);
        return false;
    }
}

function initWebXR() {
    // Clean up any existing scenes
    if (scene && renderer) {
        document.body.removeChild(renderer.domElement);
    }

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        powerPreference: "high-performance"
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.getElementById('viewer-page').appendChild(renderer.domElement);

    // AR Button
    const arButton = document.getElementById('ar-button');
    arButton.style.display = 'block';
    arButton.addEventListener('click', async () => {
        try {
            const sessionInit = { 
                requiredFeatures: ['hit-test'],
                optionalFeatures: ['dom-overlay'],
                domOverlay: { root: document.getElementById('viewer-page') }
            };
            
            const button = ARButton.createButton(renderer, sessionInit);
            document.getElementById('viewer-page').appendChild(button);
            arButton.style.display = 'none';
            showInfo("Arahkan kamera ke permukaan datar dan tap layar untuk menempatkan menara");
        } catch (error) {
            console.error("AR session failed:", error);
            showInfo("Gagal memulai AR. Beralih ke mode 3D...");
            init3DFallback();
        }
    });

    // Load model
    loadModel().then(gltf => {
        model = gltf.scene;
        model.visible = false;
        model.scale.set(0.5, 0.5, 0.5);
        scene.add(model);

        // Controller setup
        controller = renderer.xr.getController(0);
        controller.addEventListener('select', onSelect);
        scene.add(controller);
    }).catch(error => {
        console.error("Model loading failed:", error);
        showInfo("Gagal memuat model. Beralih ke mode 3D...");
        init3DFallback();
    });

    // Animation loop
    renderer.setAnimationLoop(() => {
        renderer.render(scene, camera);
    });
}

function init3DFallback() {
    // Clean up any existing fallback scenes
    if (fallbackScene && fallbackRenderer) {
        document.getElementById('fallback-container').removeChild(fallbackRenderer.domElement);
    }

    document.getElementById('ar-button').style.display = 'none';
    document.getElementById('fallback-container').style.display = 'block';
    showInfo("Mode 3D - Gunakan mouse/touch untuk melihat menara dari berbagai sudut");

    fallbackScene = new THREE.Scene();
    fallbackScene.background = new THREE.Color(0xf0f0f0);

    fallbackCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    fallbackCamera.position.z = 3;

    fallbackRenderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance"
    });
    fallbackRenderer.setPixelRatio(window.devicePixelRatio);
    fallbackRenderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('fallback-container').appendChild(fallbackRenderer.domElement);

    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 1);
    fallbackScene.add(light);
    fallbackScene.add(new THREE.AmbientLight(0x404040));

    // Load model
    loadModel().then(gltf => {
        model = gltf.scene;
        model.scale.set(0.5, 0.5, 0.5);
        fallbackScene.add(model);

        // Orbit controls for desktop/mobile
        const controls = new THREE.OrbitControls(fallbackCamera, fallbackRenderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.25;
        controls.screenSpacePanning = true;
        
        // Mobile touch adjustments
        if (isMobile) {
            controls.enablePan = false;
            controls.touchAction = 'none';
        }

        // Animation loop
        function animateFallback() {
            requestAnimationFrame(animateFallback);
            controls.update();
            fallbackRenderer.render(fallbackScene, fallbackCamera);
        }
        animateFallback();
    }).catch(error => {
        console.error("Model loading failed:", error);
        showInfo("Gagal memuat model 3D");
    });

    // Window resize handler
    window.addEventListener('resize', () => {
        fallbackCamera.aspect = window.innerWidth / window.innerHeight;
        fallbackCamera.updateProjectionMatrix();
        fallbackRenderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function loadModel() {
    return new Promise((resolve, reject) => {
        const loader = new THREE.GLTFLoader();
        console.log("Loading model from:", currentModelUrl);
        
        loader.load(
            currentModelUrl,
            (gltf) => {
                console.log("Model loaded successfully");
                resolve(gltf);
            },
            undefined,
            (error) => {
                console.error("Failed to load model:", error);
                showInfo(`Gagal memuat model: ${currentModel}`);
                reject(error);
            }
        );
    });
}

function onSelect() {
    if (model && !model.visible) {
        controller.getWorldDirection(model.position);
        model.position.multiplyScalar(1.5);
        model.quaternion.copy(controller.quaternion);
        model.visible = true;
        showInfo("Menara telah ditempatkan. Anda bisa bergerak mengelilinginya");
    }
}

function onWindowResize() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    if (fallbackCamera && fallbackRenderer) {
        fallbackCamera.aspect = window.innerWidth / window.innerHeight;
        fallbackCamera.updateProjectionMatrix();
        fallbackRenderer.setSize(window.innerWidth, window.innerHeight);
    }
}

function showInfo(message) {
    const infoBox = document.getElementById('info-box');
    infoBox.textContent = message;
    infoBox.style.display = 'block';

    setTimeout(() => {
        infoBox.style.display = 'none';
    }, 5000);
}

function setupModelSelector() {
    const selector = document.getElementById('tower-select');
    if (selector) {
        selector.addEventListener('change', (e) => {
            currentModel = e.target.value;
            currentModelUrl = modelUrls[currentModel];
            reloadModel();
        });
    }
}

function reloadModel() {
    if (model) {
        if (isARSupported && scene) {
            scene.remove(model);
        } else if (fallbackScene) {
            fallbackScene.remove(model);
        }

        loadModel().then(gltf => {
            model = gltf.scene;
            if (isARSupported) {
                model.visible = false;
                model.scale.set(0.5, 0.5, 0.5);
                scene.add(model);
            } else {
                model.scale.set(0.5, 0.5, 0.5);
                fallbackScene.add(model);
            }
        });
    }
}

function showMainMenu() {
    document.querySelectorAll('.container-fluid').forEach(page => {
        page.classList.add('d-none');
    });
    document.getElementById('main-menu').classList.remove('d-none');
    
    // Clean up scenes
    if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
    }
    
    if (fallbackRenderer) {
        fallbackRenderer.dispose();
        if (fallbackRenderer.domElement.parentNode) {
            fallbackRenderer.domElement.parentNode.removeChild(fallbackRenderer.domElement);
        }
    }
}

function loadModelViewer() {
    document.querySelectorAll('.container-fluid').forEach(page => {
        page.classList.add('d-none');
    });
    document.getElementById('viewer-page').classList.remove('d-none');

    if (isIOS && !isARSupported) {
        document.getElementById('ar-quicklook').classList.remove('d-none');
    } else if (isARSupported) {
        initWebXR();
    } else {
        init3DFallback();
    }
}

function setupIOSFix() {
    if (!isIOS) return;
    
    document.body.classList.add('ios-device');
    
    // Prevent default touch behaviors
    document.addEventListener('touchmove', (e) => {
        if (e.target.classList.contains('tower-option')) {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Better touch feedback
    document.querySelectorAll('.tower-option').forEach(el => {
        el.addEventListener('touchstart', () => {
            el.style.opacity = '0.8';
        }, { passive: true });
        
        el.addEventListener('touchend', () => {
            el.style.opacity = '1';
        }, { passive: true });
    });
}

function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}