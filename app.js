// app.js

// -- VARIABEL GLOBAL -- //
let camera, scene, renderer, controller, model;
let fallbackScene, fallbackCamera, fallbackRenderer;

// Deteksi jenis perangkat
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(navigator.userAgent);
const isMobile = isIOS || isAndroid;

let isARSupported = false;
let currentModel = 'tower1';

// URL model 3D
const modelUrls = {
    'tower1': { glb: './assets/tower4.glb', usdz: './assets/tower4.usdz' },
    'tower2': { glb: './assets/tower5.glb', usdz: './assets/tower5.usdz' },
    'tower3': { glb: './assets/tower3.glb', usdz: './assets/tower3.usdz' }
};
let currentModelUrl = modelUrls[currentModel].glb;

// -- INISIALISASI APLIKASI -- //
document.addEventListener('DOMContentLoaded', init);

async function init() {
    setupEventListeners();

    // Cek dukungan AR
    try {
        isARSupported = await checkARSupport();
        console.log("AR Supported:", isARSupported);
    } catch (e) {
        console.error("Gagal mengecek dukungan AR:", e);
        isARSupported = false;
    }

    if (!isARSupported && !isIOS) {
        const arButton = document.getElementById('ar-button');
        if (arButton) arButton.style.display = 'none';
    }
}

// -- PENGATURAN EVENT LISTENER -- //
function setupEventListeners() {
    document.querySelectorAll('.tower-option').forEach(option => {
        option.addEventListener('click', handleSelection);
    });
    document.getElementById('back-button').addEventListener('click', showMainMenu);

    const quicklookBackButton = document.getElementById('quicklook-back');
    if (quicklookBackButton) {
        quicklookBackButton.addEventListener('click', showMainMenu);
    }

    window.addEventListener('resize', debounce(onWindowResize, 150));
}


// -- FUNGSI UTAMA -- //

/**
 * Menangani pemilihan model tower oleh pengguna.
 */
function handleSelection(e) {
    e.preventDefault();

    const selectedModel = this.getAttribute('data-model');
    if (!selectedModel) return;

    currentModel = selectedModel;
    currentModelUrl = modelUrls[currentModel].glb;

    // Memberikan umpan balik visual saat item dipilih
    this.style.transform = 'scale(0.95)';
    setTimeout(() => {
        this.style.transform = '';
    }, 150);

    loadModelViewer();
}

/**
 * Memuat viewer berdasarkan jenis perangkat dan dukungan AR.
 */
// app.js
function loadModelViewer() {
    document.getElementById('main-menu').classList.add('d-none'); // Hide main menu

    if (isIOS) {
        // Ensure ar-quicklook is visible and viewer-page is hidden for iOS
        document.getElementById('ar-quicklook').classList.remove('d-none');
        document.getElementById('viewer-page').classList.add('d-none'); // Ensure viewer-page is hidden if it was shown

        const arQuickLookPage = document.getElementById('ar-quicklook');
        // Find the correct USDZ link based on the selected model
        // The modelUrls object is not directly used here for USDZ, need to adapt.
        // Assuming currentModel will be like 'tower1', 'tower2', 'tower3'
        // and the href in index-ios.html matches 'assets/tower1.usdz', 'assets/tower4.usdz', 'assets/tower3.usdz'
        // There's a mismatch in tower2's USDZ path in index-ios.html ('assets/tower4.usdz')
        // vs modelUrls in app.js ('./assets/tower5.usdz'). This should be corrected for proper functionality.
        let usdzPath;
        if (currentModel === 'tower1') {
            usdzPath = 'assets/tower1.usdz';
        } else if (currentModel === 'tower2') {
            usdzPath = 'assets/tower4.usdz'; // Corrected based on index-ios.html
        } else if (currentModel === 'tower3') {
            usdzPath = 'assets/tower3.usdz';
        }

        const modelLink = arQuickLookPage.querySelector(`a[href*="${usdzPath}"]`);

        if (modelLink) {
            modelLink.click();
        }
        // No need to call init3DFallback immediately for iOS Quick Look, 
        // as Quick Look takes over. Fallback would only be if Quick Look fails.
        // If you want a 3D fallback *after* Quick Look is dismissed or fails,
        // you'd need a different trigger.
    } else if (isARSupported) {
        document.getElementById('viewer-page').classList.remove('d-none'); // Show viewer page for WebXR
        initWebXR();
    } else {
        document.getElementById('viewer-page').classList.remove('d-none'); // Show viewer page for 3D fallback
        init3DFallback();
    }
}

/**
 * Mengecek apakah sesi 'immersive-ar' didukung oleh browser.
 * @returns {Promise<boolean>}
 */
async function checkARSupport() {
    if (!navigator.xr) return false;
    try {
        return await navigator.xr.isSessionSupported('immersive-ar');
    } catch (e) {
        console.error("Error saat mengecek sesi AR:", e);
        return false;
    }
}

/**
 * Inisialisasi sesi WebXR untuk pengalaman AR.
 */
function initWebXR() {
    cleanupRenderers();

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;

    document.getElementById('viewer-page').appendChild(renderer.domElement);

    // Tambahkan tombol AR
    const arButton = document.getElementById('ar-button');
    if (arButton) arButton.style.display = 'block';

    const sessionInit = {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.getElementById('viewer-page') }
    };
    document.body.appendChild(ARButton.createButton(renderer, sessionInit));

    // Atur controller untuk interaksi
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // Muat model 3D
    loadModel().then(gltf => {
        model = gltf.scene;
        model.visible = false; // Sembunyikan model sampai ditempatkan
        scene.add(model);
    }).catch(init3DFallback);

    renderer.setAnimationLoop(() => renderer.render(scene, camera));
}

/**
 * Inisialisasi mode fallback 3D jika AR tidak tersedia.
 */
function init3DFallback() {
    cleanupRenderers();

    const fallbackContainer = document.getElementById('fallback-container');
    fallbackContainer.style.display = 'block';

    // Sembunyikan tombol AR jika ada
    const arButton = document.getElementById('ar-button');
    if (arButton) arButton.style.display = 'none';

    showInfo("Mode 3D - Gunakan gestur untuk memutar model.");

    fallbackScene = new THREE.Scene();
    fallbackScene.background = new THREE.Color(0xE0E0E0);
    fallbackCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    fallbackCamera.position.set(0, 1.5, 5);

    fallbackRenderer = new THREE.WebGLRenderer({ antialias: true });
    fallbackRenderer.setPixelRatio(window.devicePixelRatio);
    fallbackRenderer.setSize(window.innerWidth, window.innerHeight);
    fallbackContainer.appendChild(fallbackRenderer.domElement);

    // Tambahkan pencahayaan
    fallbackScene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    fallbackScene.add(directionalLight);

    // Kontrol orbit
    const controls = new THREE.OrbitControls(fallbackCamera, fallbackRenderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 2;
    controls.maxDistance = 10;
    controls.target.set(0, 1, 0);

    // Muat model
    loadModel().then(gltf => {
        model = gltf.scene;
        fallbackScene.add(model);
    });

    // Loop animasi
    const animateFallback = () => {
        requestAnimationFrame(animateFallback);
        controls.update();
        fallbackRenderer.render(fallbackScene, fallbackCamera);
    };
    animateFallback();
}

/**
 * Memuat model GLB menggunakan GLTFLoader.
 * @returns {Promise<Object>}
 */
function loadModel() {
    return new Promise((resolve, reject) => {
        const loader = new THREE.GLTFLoader();
        loader.load(currentModelUrl,
            gltf => {
                console.log("Model berhasil dimuat:", currentModel);
                // Atur skala dan posisi model
                const box = new THREE.Box3().setFromObject(gltf.scene);
                const center = box.getCenter(new THREE.Vector3());
                gltf.scene.position.sub(center); // Pusatkan model
                resolve(gltf);
            },
            undefined,
            error => {
                console.error("Gagal memuat model:", error);
                showInfo(`Gagal memuat model ${currentModel}`);
                reject(error);
            }
        );
    });
}

/**
 * Menempatkan model di dunia AR saat pengguna mengetuk layar.
 */
function onSelect() {
    if (model) {
        // Logika penempatan model (sesuaikan jika perlu)
        const hitTestSource = null; // Ini perlu diimplementasikan dengan hit-test
        if (hitTestSource) {
            // Implementasi penempatan berdasarkan hit-test
        } else {
            // Penempatan sederhana di depan kamera
            model.position.set(0, 0, -2).applyMatrix4(controller.matrixWorld);
            model.quaternion.setFromRotationMatrix(controller.matrixWorld);
        }
        model.visible = true;
        showInfo("Menara ditempatkan. Anda bisa bergerak di sekitarnya.");
    }
}


// -- FUNGSI UTILITAS -- //

/**
 * Menyesuaikan ukuran renderer saat jendela diubah ukurannya.
 */
function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (renderer && camera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    if (fallbackRenderer && fallbackCamera) {
        fallbackCamera.aspect = width / height;
        fallbackCamera.updateProjectionMatrix();
        fallbackRenderer.setSize(width, height);
    }
}

/**
 * Menampilkan pesan informasi sementara kepada pengguna.
 * @param {string} message - Pesan yang akan ditampilkan.
 */
function showInfo(message) {
    const infoBox = document.getElementById('info-box');
    infoBox.textContent = message;
    infoBox.style.display = 'block';
    setTimeout(() => {
        infoBox.style.display = 'none';
    }, 4000);
}

/**
 * Kembali ke menu utama dan membersihkan scene.
 */
function showMainMenu() {
    document.getElementById('viewer-page').classList.add('d-none');
    document.getElementById('main-menu').classList.remove('d-none');

    const arQuickLookPage = document.getElementById('ar-quicklook');
    if (arQuickLookPage) {
        arQuickLookPage.classList.add('d-none');
    }

    cleanupRenderers();
}

/**
 * Membersihkan renderer dan DOM elemen terkait.
 */
function cleanupRenderers() {
    if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
        renderer = null;
    }
    if (fallbackRenderer) {
        fallbackRenderer.dispose();
        if (fallbackRenderer.domElement.parentNode) {
            fallbackRenderer.domElement.parentNode.removeChild(fallbackRenderer.domElement);
        }
        fallbackRenderer = null;
    }
}

/**
 * Fungsi debounce untuk menunda eksekusi fungsi.
 * @param {Function} func - Fungsi yang akan di-debounce.
 * @param {number} wait - Waktu tunda dalam milidetik.
 * @returns {Function}
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}