/**
 * Main Index Page JavaScript
 */

// Dynamic Particles Background
function createBgParticle() {
    const container = document.getElementById('bgAnimation');
    if (!container) return;

    const particle = document.createElement('div');
    particle.className = 'bg-particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (Math.random() * 5 + 3) + 's';
    particle.style.animationDelay = Math.random() * 2 + 's';

    const colors = ['#00FFAA', '#007BFF', '#CD2E3A', '#FF4757'];
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];

    container.appendChild(particle);

    setTimeout(() => {
        if (particle.parentNode) {
            particle.parentNode.removeChild(particle);
        }
    }, 8000);
}

// Card Hover Effects
function initCardHoverEffects() {
    document.querySelectorAll('.nav-card').forEach(card => {
        card.addEventListener('mouseenter', function () {
            this.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        });

        card.addEventListener('mouseleave', function () {
            this.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        });
    });
}

// Header Scroll Effect (Specific for Index)
function initIndexHeaderScroll() {
    let lastScrollTop = 0;
    const header = document.querySelector('.header');

    if (!header) return;

    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset;

        if (scrollTop > lastScrollTop && scrollTop > 100) {
            // Scrolling down
            header.style.transform = 'translateY(-100%)';
        } else {
            // Scrolling up
            header.style.transform = 'translateY(0)';
        }

        lastScrollTop = scrollTop;
    });
}

// Keyboard Navigation
function initKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        const cards = document.querySelectorAll('.nav-card');
        if (cards.length === 0) return;

        let currentIndex = Array.from(cards).findIndex(card => card === document.activeElement);

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            currentIndex = (currentIndex + 1) % cards.length;
            cards[currentIndex].focus();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            currentIndex = (currentIndex - 1 + cards.length) % cards.length;
            cards[currentIndex].focus();
        }
    });

    // Make cards focusable
    document.querySelectorAll('.nav-card').forEach(card => {
        card.setAttribute('tabindex', '0');
    });
}

// Toast Popup Logic
function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <div class="toast-icon"><i class="fas fa-tools"></i></div>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Trigger reflow
    toast.offsetHeight;

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                container.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

function initToastTriggers() {
    document.querySelectorAll('.nav-card.rag-chatbot, .nav-card.voice-transcription').forEach(card => {
        card.addEventListener('click', function (e) {
            e.preventDefault();
            showToast('현재 열심히 개발 중입니다! 조금만 기다려주세요.');
        });
    });
}

// Initialize Main specific functions
document.addEventListener('DOMContentLoaded', () => {
    initCardHoverEffects();
    initIndexHeaderScroll();
    initKeyboardNavigation();
    initToastTriggers();

    // Start particle system
    if (document.getElementById('bgAnimation')) {
        setInterval(createBgParticle, 200);
    }
});
