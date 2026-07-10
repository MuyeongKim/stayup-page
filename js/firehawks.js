/**
 * FireHawks page enhancements.
 * Navigation behavior is shared through common.js.
 */
document.addEventListener('DOMContentLoaded', () => {
    const currentYear = String(new Date().getFullYear());
    document.querySelectorAll('[data-current-year]').forEach((element) => {
        element.textContent = currentYear;
    });
});
