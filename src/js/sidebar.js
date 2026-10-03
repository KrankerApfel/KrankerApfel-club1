function getSiteRootUrl() {
    const pathname = window.location.pathname;
    const pagesPathIndex = pathname.indexOf('/pages/');
    const siteRootPath = pagesPathIndex === -1
        ? new URL('.', window.location.href).pathname
        : `${pathname.slice(0, pagesPathIndex)}/`;

    return new URL(siteRootPath, window.location.origin);
}

const sidebarStateKey = 'sidebar-closed';

document.addEventListener('DOMContentLoaded', () => {
    const siteRootUrl = getSiteRootUrl();

    document.querySelectorAll('#sidebar a[href]').forEach((link) => {
        const href = link.getAttribute('href').trim();
        link.href = new URL(href, siteRootUrl).href;
    });

    document.querySelectorAll('.nav-main > li > a').forEach((link) => {
        const panel = link.nextElementSibling;
        if (!panel || !panel.classList.contains('panel-section')) {
            return;
        }

        link.addEventListener('click', (event) => {
            event.preventDefault();
            const isOpen = panel.classList.contains('active');
            document.querySelectorAll('.panel-section.active').forEach((openPanel) => {
                openPanel.classList.remove('active');
            });
            if (!isOpen) {
                panel.classList.add('active');
            }
        });
    });

    const navButton = document.querySelector('.btn-nav');
    const sidebarClosed = sessionStorage.getItem(sidebarStateKey) === 'true';

    if (sidebarClosed) {
        document.body.classList.add('sidebar-closed');
        if (navButton) {
            navButton.textContent = '>>';
        }
    }

    if (!navButton) {
        return;
    }

    navButton.addEventListener('click', () => {
        const isClosed = document.body.classList.toggle('sidebar-closed');
        sessionStorage.setItem(sidebarStateKey, String(isClosed));
        navButton.textContent = isClosed ? '>>' : '<<';
    });
});