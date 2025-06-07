let camera, scene, renderer, controller, model;

init();
animate();

function init() {
    // Buat scene Three.js
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    // Setup renderer dengan WebXR
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Tambahkan tombol AR
    document.getElementById('ar-button').addEventListener('click', async () => {
        try {
            await renderer.xr.isSessionSupported('immersive-ar');
            const button = ARButton.createButton(renderer, { 
                requiredFeatures: ['hit-test'] 
            });
            document.body.appendChild(button);
            document.getElementById('ar-button').remove();
        } catch (error) {
            alert("AR tidak didukung di perangkat/browser ini.");
        }
    });

    // Load model 3D menara
    const loader = new THREE.GLTFLoader();
    loader.load(
        './assets/tower.glb',
        (gltf) => {
            model = gltf.scene;
            model.scale.set(0.5, 0.5, 0.5); // Sesuaikan ukuran
            scene.add(model);
            model.visible = false; // Sembunyikan sampai ditempatkan
        },
        undefined,
        (error) => {
            console.error("Gagal memuat model:", error);
        }
    );

    // Setup controller untuk interaksi
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // Handle resize window
    window.addEventListener('resize', onWindowResize);
}

function onSelect() {
    if (model && !model.visible) {
        // Posisikan model di depan kamera
        controller.getWorldDirection(model.position);
        model.position.multiplyScalar(1.5);
        model.quaternion.copy(controller.quaternion);
        model.visible = true;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render() {
    renderer.render(scene, camera);
}