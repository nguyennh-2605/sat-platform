export function AppCrashFallback() {
  return (
    <main role="alert" className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
      <div className="max-w-md rounded-card border border-ui-border bg-surface p-6 shadow-card">
        <h1 className="text-heading font-semibold">Something went wrong</h1>
        <p className="mt-2 text-body text-muted-foreground">
          Reload the page to try again. If the problem continues, contact your teacher or support.
        </p>
      </div>
    </main>
  );
}
