let camera, scene, renderer, controller, model;
let fallbackScene, fallbackCamera, fallbackRenderer;
let isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
let isAndroid = /Android/i.test(navigator.userAgent);
let isARSupported = false;

init();

async function init() {
    isARSupported = await checkARSupport();
    
    if (isIOS && !isARSupported) {
        showQuickLook();
    } else if (isARSupported) {
        initWebXR();
    } else {
        init3DFallback();
    }
}

async function checkARSupport() {
    if (!navigator.xr) return false;
    
    try {
        return await navigator.xr.isSessionSupported('immersive-ar');
    } catch (e) {
        console.error("Error checking AR support:", e);
        return false;
    }
}

function showQuickLook() {
    document.getElementById('ar-button').style.display = 'none';
    document.getElementById('ar-quicklook').style.display = 'block';
    showInfo("Gunakan AR Quick Look untuk pengalaman AR di iPhone");
}

function initWebXR() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);


    document.getElementById('ar-button').addEventListener('click', async () => {
        try {
            const button = ARButton.createButton(renderer, { 
                requiredFeatures: ['hit-test'],
                optionalFeatures: ['dom-overlay'],
                domOverlay: { root: document.body }
            });
            document.body.appendChild(button);
            document.getElementById('ar-button').remove();
            showInfo("Arahkan kamera ke permukaan datar dan tap layar untuk menempatkan menara");
        } catch (error) {
            console.error("AR session failed:", error);
            showInfo("Gagal memulai AR. Beralih ke mode 3D...");
            init3DFallback();
        }
    });

    loadModel().then(() => {
        controller = renderer.xr.getController(0);
        controller.addEventListener('select', onSelect);
        scene.add(controller);
    });

    window.addEventListener('resize', onWindowResize);
    
    animate();
}

function init3DFallback() {
    document.getElementById('ar-button').style.display = 'none';
    document.getElementById('fallback-container').style.display = 'block';
    showInfo("Mode 3D - Gunakan mouse/touch untuk melihat menara dari berbagai sudut");

    fallbackScene = new THREE.Scene();
    fallbackScene.background = new THREE.Color(0xf0f0f0);
    
    fallbackCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    fallbackCamera.position.z = 3;
    
    fallbackRenderer = new THREE.WebGLRenderer({ antialias: true });
    fallbackRenderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('fallback-container').appendChild(fallbackRenderer.domElement);
    
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 1);
    fallbackScene.add(light);
    fallbackScene.add(new THREE.AmbientLight(0x404040));
    
    loadModel().then(gltf => {
        model = gltf.scene;
        model.scale.set(0.5, 0.5, 0.5);
        fallbackScene.add(model);
        
        const controls = new THREE.OrbitControls(fallbackCamera, fallbackRenderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.25;
        
        function animateFallback() {
            requestAnimationFrame(animateFallback);
            controls.update();
            fallbackRenderer.render(fallbackScene, fallbackCamera);
        }
        animateFallback();
    });

    window.addEventListener('resize', () => {
        fallbackCamera.aspect = window.innerWidth / window.innerHeight;
        fallbackCamera.updateProjectionMatrix();
        fallbackRenderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function loadModel() {
    return new Promise((resolve, reject) => {
        const loader = new THREE.GLTFLoader();
        loader.load(
            './assets/tower.glb',
            (gltf) => {
                resolve(gltf);
            },
            undefined,
            (error) => {
                console.error("Failed to load model:", error);
                showInfo("Gagal memuat model 3D");
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

function animate() {
    renderer.setAnimationLoop(render);
}

function render() {
    renderer.render(scene, camera);
}

function showInfo(message) {
    const infoBox = document.getElementById('info-box');
    infoBox.textContent = message;
    infoBox.style.display = 'block';
    
    if (message) {
        setTimeout(() => {
            infoBox.style.display = 'none';
        }, 5000);
    }
}