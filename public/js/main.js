import { initThemeToggle } from './lib/theme.js';
import { initPrefetch, initScrollMemory } from './lib/navigation.js';
import { initHome } from './pages/home.js';
import { initCategory } from './pages/category.js';

const page = document.body.dataset.page;

initThemeToggle(document.getElementById('theme-toggle'));
initPrefetch(document.querySelector('.cats'));

let ready = Promise.resolve();
if (page === 'home') ready = initHome();
else if (page === 'category') ready = initCategory();

initScrollMemory(ready);
