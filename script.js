import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --------------------------------------------------------------
// 1. Анимация появления карточек при скролле (было)
// --------------------------------------------------------------
const cards = document.querySelectorAll('.project-card');
const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            fadeObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -20px 0px' });

cards.forEach(card => fadeObserver.observe(card));

// Доп. проверка при загрузке
window.addEventListener('load', () => {
    cards.forEach(card => {
        if (card.getBoundingClientRect().top < window.innerHeight - 100) {
            card.classList.add('visible');
            fadeObserver.unobserve(card);
        }
    });
});

// --------------------------------------------------------------
// 2. Переключение темы (было) + синхронизация с фоном 3D-сцен
// --------------------------------------------------------------
const themeToggle = document.getElementById('themeToggle');
const body = document.body;

function setTheme(theme) {
    if (theme === 'light') {
        body.classList.remove('dark');
        body.classList.add('light');
        themeToggle.innerHTML = '🌙 Dark';
        localStorage.setItem('portfolio-theme', 'light');
        // Обновить фоновый цвет у всех canvas (если они уже созданы) – опционально
        document.querySelectorAll('.model-canvas').forEach(canvas => {
            const renderer = canvas.renderer;
            if (renderer) renderer.setClearColor(0xf8fafc, 0); // прозрачный, но можно задать светлый тон
        });
    } else {
        body.classList.remove('light');
        body.classList.add('dark');
        themeToggle.innerHTML = '☀️ Light';
        localStorage.setItem('portfolio-theme', 'dark');
        document.querySelectorAll('.model-canvas').forEach(canvas => {
            const renderer = canvas.renderer;
            if (renderer) renderer.setClearColor(0x131318, 0);
        });
    }
}

const savedTheme = localStorage.getItem('portfolio-theme');
if (savedTheme === 'light') setTheme('light');
else setTheme('dark');

themeToggle.addEventListener('click', () => {
    if (body.classList.contains('dark')) setTheme('light');
    else setTheme('dark');
});

// --------------------------------------------------------------
// 3. Ленивая загрузка 3D-моделей для каждой карточки (НОВОЕ)
// --------------------------------------------------------------
const modelObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            init3DFromCard(entry.target);
            modelObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.3 });

function init3DFromCard(card) {
    const canvas = card.querySelector('.model-canvas');
    if (!canvas) return;
    const modelPath = card.getAttribute('data-model');
    if (!modelPath) return;
    if (card.dataset.modelLoaded === 'true') return;
    card.dataset.modelLoaded = 'true';

    // Определяем родительский контейнер для размеров
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width === 0 || height === 0) return;

    // Настройка сцены с прозрачным фоном (подхватит тему body)
    const scene = new THREE.Scene();
    scene.background = null; // прозрачный

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(2, 1.5, 3);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    // Сохраняем ссылку на renderer, чтобы менять clear color при смене темы (опционально)
    canvas.renderer = renderer;

    // Освещение (универсальное)
    const ambientLight = new THREE.AmbientLight(0x404060);
    scene.add(ambientLight);
    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(2, 3, 4);
    scene.add(mainLight);
    const fillLight = new THREE.PointLight(0x4466cc, 0.3);
    fillLight.position.set(-1, 1, 2);
    scene.add(fillLight);
    const backLight = new THREE.PointLight(0xffaa66, 0.2);
    backLight.position.set(0, 1, -2);
    scene.add(backLight);

    // Загрузка модели
    const loader = new GLTFLoader();
    loader.load(modelPath, (gltf) => {
        const model = gltf.scene;
        // Центрируем модель и масштабируем по размеру (опционально)
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.8 / maxDim; // подгоняем под размер сцены
        model.scale.set(scale, scale, scale);
        // Центрируем по вертикали
        const center = box.getCenter(new THREE.Vector3());
        model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
        scene.add(model);
        card.modelObject = model;
    }, undefined, (error) => {
        console.error(`Ошибка загрузки ${modelPath}:`, error);
        canvas.style.display = 'none';
        const icon = document.createElement('i');
        icon.className = 'fas fa-cube';
        icon.style.fontSize = '4rem';
        icon.style.color = 'var(--accent2)';
        container.appendChild(icon);
    });

    // Анимация вращения
    let animationId = null;
    function animate() {
        animationId = requestAnimationFrame(animate);
        if (card.modelObject) {
            card.modelObject.rotation.y += 0.005;
        }
        renderer.render(scene, camera);
    }
    animate();

    // Наблюдатель за изменением размера контейнера
    const resizeObserver = new ResizeObserver(() => {
        const newRect = container.getBoundingClientRect();
        const newWidth = newRect.width;
        const newHeight = newRect.height;
        if (newWidth === 0 || newHeight === 0) return;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
    });
    resizeObserver.observe(container);

    // Очистка при удалении карточки (опционально)
    card.addEventListener('remove', () => {
        if (animationId) cancelAnimationFrame(animationId);
        resizeObserver.disconnect();
        if (card.modelObject) scene.remove(card.modelObject);
    });
}

// Запускаем наблюдатель для всех карточек
cards.forEach(card => {
    modelObserver.observe(card);
});
