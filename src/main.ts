// Tipografías incluidas en la app (funcionan sin conexión y en cualquier equipo).
import '@fontsource-variable/inter/wght.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-ext-500.css';
import '@fontsource/cormorant-garamond/latin-ext-600.css';
import '@fontsource/cormorant-garamond/latin-700.css';
import '@fontsource/cormorant-garamond/latin-ext-700.css';
import './styles/main.css';

import { App } from './app';
import { createBackend } from './services/backend';

async function boot(): Promise<void> {
  const host = document.getElementById('app')!;
  const backend = await createBackend();
  const app = new App(backend);
  app.mount(host);
  await app.start();
}

boot().catch((e) => {
  console.error(e);
  document.body.textContent = `noteAI no pudo arrancar: ${e}`;
});
