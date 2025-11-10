(async () => {
  try {
    const { main: mainUiAudit } = await import('./index');
    await mainUiAudit();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
})();
