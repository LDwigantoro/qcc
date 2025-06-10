// app.js

// -- GLOBAL VARIABLES -- //
let camera, scene, renderer, controller, model;
let fallbackScene, fallbackCamera, fallbackRenderer;

// Device detection
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(navigator.userAgent);
const isMobile = isIOS || isAndroid; // Simplified for clarity

let isARSupported = false;
let currentModel = 'tower1';

// 3D model URLs - standardized for consistency
const modelUrls = {
    'tower1': { glb: './assets/tower4.glb', usdz: './assets/tower4.usdz' }, // Ensure tower1.usdz exists
    'tower2': { glb: './assets/tower5.glb', usdz: './assets/tower5.usdz' }, // Ensure tower2.usdz exists (previously tower4.usdz in HTML)
    'tower3': { glb: './assets/tower3.glb', usdz: './assets/tower3.usdz' }
};
let currentModelUrl = modelUrls[currentModel].glb; // Default to GLB

// -- APPLICATION INITIALIZATION -- //
document.addEventListener('DOMContentLoaded', init);

async function init() {
    setupEventListeners();

    // Check AR support
    try {
        isARSupported = await checkARSupport();
        console.log("AR Supported:", isARSupported);
    } catch (e) {
        console.error("Failed to check AR support:", e);
        isARSupported = false;
    }
    
    // Hide AR button if AR is not supported and not iOS (iOS handles AR via Quick Look)
    if (!isARSupported && !isIOS) {
        const arButton = document.getElementById('ar-button');
        if(arButton) arButton.style.display = 'none';
    }
}

// -- EVENT LISTENER SETUP -- //
function setupEventListeners() {
    // Attach click listeners to all tower option cards
    document.querySelectorAll('.tower-option').forEach(option => {
        option.addEventListener('click', handleSelection);
    });

    // Attach click listener to the main back button (for Android/Desktop viewer page)
    const backButton = document.getElementById('back-button');
    if (backButton) {
        backButton.addEventListener('click', showMainMenu);
    }
    
    // Attach click listener to the Quick Look back button (for iOS Quick Look page)
    const quicklookBackButton = document.getElementById('quicklook-back');
    if (quicklookBackButton) {
        quicklookBackButton.addEventListener('click', showMainMenu);
    }

    // Debounce window resize events for performance
    window.addEventListener('resize', debounce(onWindowResize, 150));
}


// -- MAIN FUNCTIONS -- //

/**
 * Handles the selection of a tower model by the user.
 * Transitions to the appropriate viewer based on device and AR support.
 */
function handleSelection(e) {
    e.preventDefault(); // Prevent default link behavior if applicable
    
    const selectedModel = this.getAttribute('data-model');
    if (!selectedModel) return;

    currentModel = selectedModel;
    // Update currentModelUrl based on GLB for Three.js fallback
    currentModelUrl = modelUrls[currentModel].glb; 
    
    // Provide visual feedback for selection
    this.style.transform = 'scale(0.95)';
    setTimeout(() => {
        this.style.transform = '';
    }, 150);

    loadModelViewer();
}

/**
 * Loads the appropriate viewer (AR Quick Look, WebXR, or 3D Fallback)
 * based on device type and AR support.
 */
function loadModelViewer() {
    // Always hide the main menu first
    document.getElementById('main-menu').classList.add('d-none');

    if (isIOS) {
        // For iOS, show the AR Quick Look page and hide the general viewer page
        const arQuickLookPage = document.getElementById('ar-quicklook');
        const viewerPage = document.getElementById('viewer-page');

        if (arQuickLookPage) {
            arQuickLookPage.classList.remove('d-none');
        }
        if (viewerPage) {
            viewerPage.classList.add('d-none'); // Ensure viewer-page is hidden if it was visible
        }

        // Get the USDZ path for the current model
        const usdzPath = modelUrls[currentModel].usdz;
        
        if (arQuickLookPage) {
            // Find the <a> tag with rel="ar" and the corresponding usdz path
            const modelLink = arQuickLookPage.querySelector(`a[href*="${usdzPath}"]`);
            if (modelLink) {
                // Simulate a click on the Quick Look link
                modelLink.click();
            } else {
                console.warn(`Quick Look link for model ${currentModel} (${usdzPath}) not found. Falling back to 3D.`);
                // If the specific Quick Look link isn't found, fall back to 3D viewer
                if (arQuickLookPage) arQuickLookPage.classList.add('d-none'); // Hide Quick Look page
                if (viewerPage) viewerPage.classList.remove('d-none'); // Show viewer page
                init3DFallback();
            }
        } else {
            console.error("AR Quick Look page (ar-quicklook) not found. Falling back to 3D.");
            // If ar-quicklook container itself is missing, fall back to 3D
            if (viewerPage) viewerPage.classList.remove('d-none');
            init3DFallback();
        }

    } else if (isARSupported) {
        // For Android/Desktop with WebXR support
        document.getElementById('viewer-page').classList.remove('d-none');
        initWebXR();
    } else {
        // For Android/Desktop without WebXR or any other non-iOS device
        document.getElementById('viewer-page').classList.remove('d-none');
        init3DFallback();
    }
}

/**
 * Checks if the browser supports 'immersive-ar' WebXR session.
 * @returns {Promise<boolean>}
 */
async function checkARSupport() {
    if (!navigator.xr) return false;
    try {
        return await navigator.xr.isSessionSupported('immersive-ar');
    } catch (e) {
        console.error("Error checking AR session:", e);
        return false;
    }
}

/**
 * Initializes the WebXR session for AR experience.
 * This is primarily for Android devices supporting WebXR.
 */
function initWebXR() {
    cleanupRenderers(); // Clean up any existing Three.js renderers

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true; // Enable WebXR on the renderer
    
    // Append the renderer's DOM element to the viewer page
    const viewerPage = document.getElementById('viewer-page');
    if (viewerPage) {
        viewerPage.appendChild(renderer.domElement);
    } else {
        console.error("Viewer page element not found for WebXR setup.");
        return;
    }

    // Show the AR button if it exists
    const arButton = document.getElementById('ar-button');
    if(arButton) arButton.style.display = 'block';

    const sessionInit = { 
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.getElementById('viewer-page') }
    };
    // Create and append the AR Button (from Three.js ARButton.js)
    if (typeof ARButton !== 'undefined') {
        const arButtonElement = ARButton.createButton(renderer, sessionInit);
        if (viewerPage) viewerPage.appendChild(arButtonElement);
        if (arButton) arButton.style.display = 'none'; // Hide the original button if ARButton.js adds its own
    } else {
        console.warn("ARButton.js not loaded or available.");
    }


    // Set up controller for interaction in AR
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect); // Listen for 'select' (e.g., tap) to place model
    scene.add(controller);
    
    // Load the 3D model
    loadModel().then(gltf => {
        model = gltf.scene;
        model.visible = false; // Hide model until placed in AR
        scene.add(model);
    }).catch(init3DFallback); // Fallback to 3D if model loading fails

    // Start the animation loop for WebXR
    renderer.setAnimationLoop(() => renderer.render(scene, camera));
}

/**
 * Initializes the 3D fallback mode if AR is not available or fails.
 * This is used for Desktop and Android devices without WebXR, and as a fallback for iOS.
 */
function init3DFallback() {
    cleanupRenderers(); // Clean up existing renderers

    // Ensure fallback container is visible
    const fallbackContainer = document.getElementById('fallback-container');
    if (fallbackContainer) {
        fallbackContainer.classList.remove('d-none'); // Ensure it's not d-none
        fallbackContainer.style.display = 'block'; // Make sure display is block
    } else {
        console.error("Fallback container element not found.");
        return;
    }

    // Hide the AR button if it exists and we're in fallback mode
    const arButton = document.getElementById('ar-button');
    if(arButton) arButton.style.display = 'none';
    
    showInfo("Mode 3D - Gunakan gestur untuk memutar model.");

    fallbackScene = new THREE.Scene();
    fallbackScene.background = new THREE.Color(0xE0E0E0); // Light grey background
    fallbackCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    fallbackCamera.position.set(0, 1.5, 5); // Position camera

    fallbackRenderer = new THREE.WebGLRenderer({ antialias: true });
    fallbackRenderer.setPixelRatio(window.devicePixelRatio);
    fallbackRenderer.setSize(window.innerWidth, window.innerHeight);
    
    if (fallbackContainer) {
        fallbackContainer.appendChild(fallbackRenderer.domElement);
    }

    // Add lighting to the scene
    fallbackScene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1)); // Soft ambient light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1); // Directional light from top-front-right
    fallbackScene.add(directionalLight);

    // Orbit controls for 3D interaction
    const controls = new THREE.OrbitControls(fallbackCamera, fallbackRenderer.domElement);
    controls.enableDamping = true; // Enable smooth camera movement
    controls.minDistance = 2; // Closest zoom
    controls.maxDistance = 10; // Furthest zoom
    controls.target.set(0, 1, 0); // Focus point of the orbit

    // Load the 3D model
    loadModel().then(gltf => {
        model = gltf.scene;
        fallbackScene.add(model);
    }).catch(error => {
        console.error("Failed to load model for 3D fallback:", error);
        showInfo("Gagal memuat model untuk tampilan 3D.");
    });

    // Animation loop for fallback mode
    const animateFallback = () => {
        requestAnimationFrame(animateFallback);
        controls.update(); // Update controls in each frame
        fallbackRenderer.render(fallbackScene, fallbackCamera); // Render the scene
    };
    animateFallback();
}

/**
 * Loads a GLB model using GLTFLoader.
 * @returns {Promise<Object>} A promise that resolves with the loaded GLTF scene.
 */
function loadModel() {
    return new Promise((resolve, reject) => {
        const loader = new THREE.GLTFLoader();
        loader.load(currentModelUrl, 
            gltf => {
                console.log("Model successfully loaded:", currentModel);
                // Adjust model scale and position to fit the view
                const box = new THREE.Box3().setFromObject(gltf.scene);
                const center = box.getCenter(new THREE.Vector3());
                gltf.scene.position.sub(center); // Center the model
                
                // Scale the model if it's too large/small for the scene
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const desiredSize = 2; // Adjust as needed
                const scale = desiredSize / maxDim;
                gltf.scene.scale.set(scale, scale, scale);

                resolve(gltf);
            }, 
            undefined, // Progress callback (optional)
            error => {
                console.error("Failed to load model:", error);
                showInfo(`Gagal memuat model ${currentModel}`);
                reject(error);
            }
        );
    });
}

/**
 * Places the model in the AR world when the user taps the screen.
 * This function needs more advanced WebXR hit-test implementation for precise placement.
 */
function onSelect() {
    if (model) {
        // Placeholder for AR model placement logic.
        // In a real WebXR app, this would involve hit-testing to place the model
        // on a detected surface. For this example, we'll place it simply.
        // const hitTestSource = null; // This needs to be implemented with hit-test logic from XR session
        // if (hitTestSource) {
        //     // Placement implementation based on hit-test
        // } else {
            // Simple placement in front of the camera (adjust distance as needed)
            model.position.set(0, 0, -2).applyMatrix4(controller.matrixWorld);
            model.quaternion.setFromRotationMatrix(controller.matrixWorld);
        // }
        model.visible = true; // Make model visible once placed
        showInfo("Menara ditempatkan. Anda bisa bergerak di sekitarnya.");
    }
}


// -- UTILITY FUNCTIONS -- //

/**
 * Adjusts the renderer size when the window is resized.
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
 * Displays a temporary information message to the user.
 * @param {string} message - The message to display.
 */
function showInfo(message) {
    const infoBox = document.getElementById('info-box');
    if (infoBox) { // Ensure infoBox exists before trying to manipulate it
        infoBox.textContent = message;
        infoBox.style.display = 'block';
        setTimeout(() => {
            infoBox.style.display = 'none';
        }, 4000);
    } else {
        console.warn("Info box element not found.");
    }
}

/**
 * Returns to the main menu and cleans up the scene.
 */
function showMainMenu() {
    // Hide all viewer-related pages
    document.getElementById('viewer-page').classList.add('d-none');
    const arQuickLookPage = document.getElementById('ar-quicklook');
    if (arQuickLookPage) {
        arQuickLookPage.classList.add('d-none');
    }
    
    // Show the main menu
    document.getElementById('main-menu').classList.remove('d-none');
    
    cleanupRenderers(); // Clean up any active renderers
}

/**
 * Disposes of Three.js renderers and removes their DOM elements.
 */
function cleanupRenderers() {
    if (renderer) {
        renderer.dispose(); // Release GPU resources
        if (renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
        renderer = null; // Clear reference
    }
    if (fallbackRenderer) {
        fallbackRenderer.dispose(); // Release GPU resources
        if (fallbackRenderer.domElement.parentNode) {
            fallbackRenderer.domElement.parentNode.removeChild(fallbackRenderer.domElement);
        }
        fallbackRenderer = null; // Clear reference
    }
}

/**
 * Debounce function to delay function execution.
 * Useful for events like window resizing to prevent excessive calls.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The delay in milliseconds.
 * @returns {Function} The debounced function.
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}
