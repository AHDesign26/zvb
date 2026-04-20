tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      "colors": {
              "on-surface": "var(--color-on-surface)",
              "secondary": "var(--color-secondary)",
              "background": "var(--color-background)",
              "surface": "var(--color-surface)",
              "on-surface-variant": "var(--color-on-surface-variant)",
              "primary": "var(--color-primary)",
              "light-gray": "var(--color-light-gray)"
      },
      "borderRadius": {
              "DEFAULT": "0.125rem",
              "lg": "0.25rem",
              "xl": "0.5rem",
              "full": "0.75rem"
      },
      "fontFamily": {
              "headline": ["Space Grotesk"],
              "body": ["Inter"],
              "label": ["Space Grotesk"]
      }
    },
  },
};

// Mobile Menu Toggle
document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('menu-icon');

    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', () => {
            const isOpen = !mobileMenu.classList.contains('hidden');

            if (isOpen) {
                mobileMenu.classList.add('hidden');
                mobileMenu.classList.remove('flex');
                menuIcon.textContent = 'menu';
                menuBtn.setAttribute('aria-expanded', 'false');
            } else {
                mobileMenu.classList.remove('hidden');
                mobileMenu.classList.add('flex');
                mobileMenu.style.flexDirection = 'column';
                menuIcon.textContent = 'close';
                menuBtn.setAttribute('aria-expanded', 'true');
            }
        });

        // Close menu when a nav link is clicked
        const mobileLinks = mobileMenu.querySelectorAll('a');
        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
                mobileMenu.classList.remove('flex');
                menuIcon.textContent = 'menu';
                menuBtn.setAttribute('aria-expanded', 'false');
            });
        });
    }
});

// Nav active link on click + hash detection
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.desktop-nav-link');

    function setActive(link) {
        navLinks.forEach(l => {
            l.classList.remove('text-indigo-900', 'border-secondary');
            l.classList.add('text-slate-600', 'border-transparent');
        });
        link.classList.remove('text-slate-600', 'border-transparent');
        link.classList.add('text-indigo-900', 'border-secondary');
    }

    // Highlight based on current URL hash (e.g. arriving from another page via index.html#services)
    if (window.location.hash) {
        const hash = window.location.hash; // e.g. "#services"
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === hash || href === 'index.html' + hash) {
                setActive(link);
            }
        });
    }

    // Highlight on click
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            setActive(link);
        });
    });
});

// Scroll Reveal
const reveal = () => {
    const reveals = document.querySelectorAll('.reveal-on-scroll');
    reveals.forEach(el => {
        const windowHeight = window.innerHeight;
        const revealTop = el.getBoundingClientRect().top;
        const revealPoint = 100;
        if (revealTop < windowHeight - revealPoint) {
            el.classList.add('active');
        }
    });
};

window.addEventListener('scroll', reveal);
window.addEventListener('load', reveal);
