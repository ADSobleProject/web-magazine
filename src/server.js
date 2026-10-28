import { createApp } from './app.js';
import { createRepository } from './data/repository.js';
import { buildSeed } from './data/seed.js';

const port = Number(process.env.PORT) || 3000;
const app = createApp({ repo: createRepository(buildSeed()) });

app.listen(port, () => {
  console.log(`웹 매거진 서버: http://localhost:${port}`);
});
