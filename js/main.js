/**
 * Entry page enhancements.
 * Core navigation and content remain available without JavaScript.
 */

function setCurrentYear() {
    const year = document.getElementById('currentYear');
    if (year) {
        year.textContent = String(new Date().getFullYear());
    }
}

function initHeaderState() {
    const header = document.getElementById('siteHeader');
    if (!header) return;

    let ticking = false;

    const updateHeader = () => {
        header.classList.toggle('is-scrolled', window.scrollY > 12);
        ticking = false;
    };

    const requestUpdate = () => {
        if (ticking) return;
        window.requestAnimationFrame(updateHeader);
        ticking = true;
    };

    updateHeader();
    window.addEventListener('scroll', requestUpdate, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
    setCurrentYear();
    initHeaderState();
});
