export default function SettingsPage() {
  return (
    <section aria-labelledby="settings-heading" className="max-w-3xl">
      <h1 id="settings-heading" className="font-heading text-2xl font-medium">
        Settings
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Tenant settings foundation.</p>
      <div className="mt-6 rounded-lg border border-border bg-card p-5">
        <h2 className="font-heading text-base font-medium">Workspace</h2>
        <p className="mt-1 text-sm text-muted-foreground">Configuration panels connect to Stage 1 APIs later.</p>
      </div>
    </section>
  );
}
