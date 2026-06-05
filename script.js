import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─────────────────────────────────────────────
// ТЕМА
// ─────────────────────────────────────────────
const themeToggle = document.getElementById('themeToggle');
const body = document.body;

function setTheme(theme) {
    if (theme === 'light') {
        body.classList.replace('dark', 'light');
        themeToggle.innerHTML = '🌙 Dark';
    } else {
        body.classList.replace('light', 'dark');
        themeToggle.innerHTML = '☀️ Light';
    }
    localStorage.setItem('portfolio-theme', theme);
}

const savedTheme = localStorage.getItem('portfolio-theme');
setTheme(savedTheme === 'light' ? 'light' : 'dark');

themeToggle.addEventListener('click', () => {
    setTheme(body.classList.contains('dark') ? 'light' : 'dark');
});

// ─────────────────────────────────────────────
// ПОЯВЛЕНИЕ КАРТОЧЕК + ЗАПУСК 3D (единый observer)
// ─────────────────────────────────────────────
const cards = document.querySelectorAll('.project-card');

const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const card = entry.target;
        card.classList.add('visible');
        cardObserver.unobserve(card);

        // Запускаем 3D только если у карточки есть data-model
        if (card.dataset.model) {
            // requestAnimationFrame — ждём один кадр браузера,
            // чтобы layout был посчитан и getBoundingClientRect вернул реальные размеры
            requestAnimationFrame(() => init3D(card));
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -20px 0px' });

cards.forEach(card => cardObserver.observe(card));

// Карточки в зоне видимости при первой загрузке
window.addEventListener('load', () => {
    cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        if (rect.top < window.innerHeight - 50) {
            card.classList.add('visible');
            cardObserver.unobserve(card);
            if (card.dataset.model) {
                requestAnimationFrame(() => init3D(card));
            }
        }
    });
});

// ─────────────────────────────────────────────
// ИНИЦИАЛИЗАЦИЯ 3D
// ─────────────────────────────────────────────
function init3D(card) {
    // Защита от двойного вызова
    if (card.dataset.modelLoaded === 'true') return;
    card.dataset.modelLoaded = 'true';

    const canvas = card.querySelector('.model-canvas');
    const loader_indicator = card.querySelector('.canvas-loader');
    if (!canvas) return;

    const modelPath = card.dataset.model;
    const container = canvas.parentElement; // .card-img

    // Получаем реальные размеры — offsetWidth надёжнее при opacity:0
    const width  = container.offsetWidth  || 400;
    const height = container.offsetHeight || 200;

    // ── Сцена ──
    const scene = new THREE.Scene();
    // Фон не задаём — canvas прозрачный, тему подхватывает через CSS

    // ── Камера ──
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
    camera.position.set(2.5, 1.5, 3);
    camera.lookAt(0, 0, 0);

    // ── Рендерер ──
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // ── Освещение ──
    const ambient  = new THREE.AmbientLight(0x404060, 1.2);
    const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
    mainLight.position.set(3, 5, 4);
    const fillLight = new THREE.PointLight(0x4466cc, 0.8, 20);
    fillLight.position.set(-2, 2, 2);
    const rimLight  = new THREE.PointLight(0xff4d00, 0.4, 20);
    rimLight.position.set(0, 1, -3);
    scene.add(ambient, mainLight, fillLight, rimLight);

    // ── Загрузка модели ──
    const gltfLoader = new GLTFLoader();

    gltfLoader.load(
        modelPath,

        // onLoad — успех
        (gltf) => {
            const model = gltf.scene;

            // Центрируем и масштабируем под сцену
            const box    = new THREE.Box3().setFromObject(model);
            const size   = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale  = 1.8 / maxDim;

            model.scale.setScalar(scale);
            model.position.set(
                -center.x * scale,
                -center.y * scale,
                -center.z * scale
            );

            scene.add(model);
            // Рендерить модель сразу, даже без текстур
                                model.traverse((child) => {
                                    if (child.isMesh && child.material) {
                                        child.material.needsUpdate = true;
                                    }
                                });
            card._model3D = model;

            // Скрываем лоадер
            if (loader_indicator) loader_indicator.style.opacity = '0';
        },

        // onProgress — не используем
        undefined,

        // onError — показываем заглушку
        (error) => {
            console.error(`[3D] Ошибка загрузки: ${modelPath}`, error);
            showFallback(card, canvas, container, loader_indicator);
        }
    );

    // ── Анимация вращения ──
    let rafId;
    function animate() {
        rafId = requestAnimationFrame(animate);
        if (card._model3D) {
            card._model3D.rotation.y += 0.005;
        }
        renderer.render(scene, camera);
    }
    //animate();

    // ── Адаптивность ──
    const resizeObserver = new ResizeObserver(() => {
        const w = container.offsetWidth;
        const h = container.offsetHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // ── Очистка ──
    card.addEventListener('remove', () => {
        cancelAnimationFrame(rafId);
        resizeObserver.disconnect();
        renderer.dispose();
    });
}

// ─────────────────────────────────────────────
// FALLBACK — если модель не загрузилась
// ─────────────────────────────────────────────
function showFallback(card, canvas, container, loaderEl) {
    canvas.style.display = 'none';
    if (loaderEl) loaderEl.style.display = 'none';

    container.classList.add('card-img--placeholder');

    const icon = document.createElement('i');
    icon.className = 'fas fa-cube';
    container.appendChild(icon);

    const text = document.createElement('div');
    text.className = 'img-placeholder-text';
    text.textContent = 'preview';
    container.appendChild(text);
}
