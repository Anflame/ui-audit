export const handleError = (err: unknown, message?: string) => {
  console.error(message ?? 'Ошибка выполнения:');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
};
