/** Публичный адрес сайта: CLIENT_URL, иначе адрес, который выдаёт Render, иначе dev-адрес Vite */
export const publicUrl =
  process.env.CLIENT_URL ?? process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:5173';
