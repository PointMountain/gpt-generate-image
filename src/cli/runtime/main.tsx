import Pastel from 'pastel';

const app = new Pastel({
  importMeta: import.meta,
  name: 'tokencanvas',
  description: 'TokenCanvas terminal image workbench',
});

await app.run();
