/**
 * Stay-Up page accessibility enhancements.
 * The shared common.js owns the basic menu toggle; this file keeps its
 * accessible state in sync and handles page-specific navigation behavior.
 */

function initAccessibleMobileMenu() {
    const menuButton = document.querySelector('.mobile-menu-btn');
    const navMenu = document.querySelector('.nav-menu');

    if (!menuButton || !navMenu) return;

    const syncMenuState = () => {
        const isOpen = navMenu.classList.contains('active');
        menuButton.setAttribute('aria-expanded', String(isOpen));
        menuButton.setAttribute('aria-label', isOpen ? '메뉴 닫기' : '메뉴 열기');
    };

    const menuObserver = new MutationObserver(syncMenuState);
    menuObserver.observe(navMenu, {
        attributes: true,
        attributeFilter: ['class']
    });

    navMenu.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !navMenu.classList.contains('active')) return;

        window.requestAnimationFrame(() => {
            menuButton.focus();
        });
    }, true);

    const desktopQuery = window.matchMedia('(min-width: 921px)');
    const closeMenuOnDesktop = (event) => {
        if (event.matches) navMenu.classList.remove('active');
    };

    if (typeof desktopQuery.addEventListener === 'function') {
        desktopQuery.addEventListener('change', closeMenuOnDesktop);
    } else {
        desktopQuery.addListener(closeMenuOnDesktop);
    }

    syncMenuState();
}

function initReducedMotionNavigation() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    document.addEventListener('click', (event) => {
        if (!reducedMotion.matches) return;

        const link = event.target.closest('a[href^="#"]');
        if (!link) return;

        const targetId = link.getAttribute('href');
        if (!targetId || targetId === '#') return;

        const target = document.querySelector(targetId);
        if (!target) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        document.querySelector('.nav-menu')?.classList.remove('active');
        target.scrollIntoView({ behavior: 'auto', block: 'start' });

        if (link.classList.contains('skip-link')) {
            target.focus({ preventScroll: true });
        }

        if (window.history && typeof window.history.pushState === 'function') {
            window.history.pushState(null, '', targetId);
        }
    }, true);
}

document.addEventListener('DOMContentLoaded', () => {
    initAccessibleMobileMenu();
    initReducedMotionNavigation();
});
