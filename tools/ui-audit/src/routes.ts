import { handleError } from './utils/errors';

export const parseRoutes = () => {
  try {
  } catch (err) {
    handleError((err as Error).message);
  }
};
