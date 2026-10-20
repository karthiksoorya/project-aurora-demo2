import { stopApi } from './api-process';

export default async function globalTeardown() {
  await stopApi();
}
