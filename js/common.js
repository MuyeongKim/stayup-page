/**
 * Shared interactions for the Stay-Up portal pages.
 */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', (event) => {
            const targetId = anchor.getAttribute('href');
            if (!targetId || targetId === '#') return;

            const target = document.querySelector(targetId);
            if (!target) return;

            event.preventDefault();
            target.scrollIntoView({
                behavior: prefersReducedMotion.matches ? 'auto' : 'smooth',
                block: 'start'
            });

            if (anchor.classList.contains('skip-link')) {
                target.focus({ preventScroll: true });
            }
        });
    });
}

function initFadeInAnimations() {
    const elements = document.querySelectorAll('.fade-in');
    if (!elements.length) return;

    if (prefersReducedMotion.matches || !('IntersectionObserver' in window)) {
        elements.forEach((element) => element.classList.add('visible'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        });
    }, {
        threshold: 0.08,
        rootMargin: '0px 0px -40px 0px'
    });

    elements.forEach((element) => observer.observe(element));
}

function initMobileMenu() {
    const button = document.querySelector('.mobile-menu-btn');
    const menu = document.querySelector('.nav-menu');
    if (!button || !menu) return;

    const setOpen = (open, returnFocus = false) => {
        menu.classList.toggle('active', open);
        button.setAttribute('aria-expanded', String(open));
        button.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
        if (returnFocus) button.focus();
    };

    button.addEventListener('click', () => {
        setOpen(!menu.classList.contains('active'));
    });

    menu.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => setOpen(false));
    });

    document.addEventListener('click', (event) => {
        if (!menu.classList.contains('active')) return;
        if (menu.contains(event.target) || button.contains(event.target)) return;
        setOpen(false);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !menu.classList.contains('active')) return;
        setOpen(false, true);
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 920 && menu.classList.contains('active')) {
            setOpen(false);
        }
    }, { passive: true });
}

function initStickyHeader() {
    const header = document.getElementById('header');
    if (!header) return;

    let framePending = false;
    const updateHeader = () => {
        header.classList.toggle('scrolled', window.scrollY > 24);
        framePending = false;
    };

    window.addEventListener('scroll', () => {
        if (framePending) return;
        framePending = true;
        window.requestAnimationFrame(updateHeader);
    }, { passive: true });

    updateHeader();
}

function initCurrentYear() {
    const currentYear = String(new Date().getFullYear());
    document.querySelectorAll('[data-current-year]').forEach((element) => {
        element.textContent = currentYear;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initSmoothScroll();
    initFadeInAnimations();
    initMobileMenu();
    initStickyHeader();
    initCurrentYear();
});
