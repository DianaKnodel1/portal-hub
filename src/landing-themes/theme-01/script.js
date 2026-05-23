(function () {
  var form = document.getElementById("application-form");
  var status = document.getElementById("form-status");
  if (!form) return;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    status.className = "status";
    status.textContent = "Wird gesendet…";
    var data = Object.fromEntries(new FormData(form).entries());
    fetch(window.PORTAL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function () {
        status.className = "status success";
        status.textContent = "Danke! Du wirst zum Mitarbeiter-Portal weitergeleitet…";
        form.reset();
        if (window.PORTAL_URL) {
          setTimeout(function () { window.location.href = window.PORTAL_URL; }, 1200);
        }
      })
      .catch(function () {
        status.className = "status error";
        status.textContent = "Da ist etwas schiefgelaufen. Bitte später erneut versuchen.";
      });
  });
})();