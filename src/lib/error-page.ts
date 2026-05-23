export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Fehler</title>
<style>
  body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; min-height: 100vh; align-items: center; justify-content: center; padding: 1.5rem; }
  .card { max-width: 28rem; text-align: center; }
  h1 { font-size: 1.5rem; margin: 0 0 0.5rem; }
  p { color: #94a3b8; margin: 0 0 1.25rem; }
  a { display: inline-block; background: #2563eb; color: #fff; padding: 0.55rem 1rem; border-radius: 0.5rem; text-decoration: none; font-weight: 600; }
</style>
</head>
<body>
  <div class="card">
    <h1>Etwas ist schiefgelaufen</h1>
    <p>Bitte lade die Seite neu oder versuche es später erneut.</p>
    <a href="/">Zur Startseite</a>
  </div>
</body>
</html>`;
}