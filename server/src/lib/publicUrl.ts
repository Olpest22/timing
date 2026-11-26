/** Публичный адрес сайта: CLIENT_URL, иначе адрес от хостинга (Render / Railway), иначе dev-адрес Vite */
const railway = process.env.RAILWAY_PUBLIC_DOMAIN;

export const publicUrl =
  process.env.CLIENT_URL ??
  process.env.RENDER_EXTERNAL_URL ??
  (railway ? `https://${railway}` : 'http://localhost:5173');
