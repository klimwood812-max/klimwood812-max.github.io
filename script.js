// Анимация появления карточек при скролле
const cards = document.querySelectorAll('.project-card');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -20px 0px' });

cards.forEach(card => observer.observe(card));

// Дополнительная проверка при загрузке (для уже видимых карточек)
window.addEventListener('load', () => {
    cards.forEach(card => {
        if (card.getBoundingClientRect().top < window.innerHeight - 100) {
            card.classList.add('visible');
            observer.unobserve(card);
        }
    });
});

// Переключение светлой / тёмной темы с сохранением в localStorage
const themeToggle = document.getElementById('themeToggle');
const body = document.body;

function setTheme(theme) {
    if (theme === 'light') {
        body.classList.remove('dark');
        body.classList.add('light');
        themeToggle.innerHTML = '🌙 Dark';
        localStorage.setItem('portfolio-theme', 'light');
    } else {
        body.classList.remove('light');
        body.classList.add('dark');
        themeToggle.innerHTML = '☀️ Light';
        localStorage.setItem('portfolio-theme', 'dark');
    }
}

const savedTheme = localStorage.getItem('portfolio-theme');
if (savedTheme === 'light') setTheme('light');
else setTheme('dark');

themeToggle.addEventListener('click', () => {
    if (body.classList.contains('dark')) setTheme('light');
    else setTheme('dark');
});