const backendUrl = (import.meta.env.VITE_BACKEND_URL || 'https://pwesto-backend.onrender.com')
    .replace(/\/+$/, '');

window.location.replace(new URL('/pwesto', backendUrl).toString());
