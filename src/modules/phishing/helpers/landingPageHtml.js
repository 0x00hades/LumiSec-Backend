export function injectLandingTrackingScript(htmlContent, { trackingId, apiBase, redirectUrl }) {
    const base = (apiBase || "").replace(/\/$/, "");
    const redirect = redirectUrl || "https://www.google.com";

    const script = `
<script>
(function () {
  var tid = ${JSON.stringify(trackingId)};
  var apiBase = ${JSON.stringify(base)};
  var redirect = ${JSON.stringify(redirect)};
  document.querySelectorAll("form").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var username = fd.get("username") || fd.get("email") || fd.get("user") || "user";
      fetch(apiBase + "/track/submit/" + tid, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: String(username) })
      }).finally(function () { window.location.href = redirect; });
    });
  });
})();
</script>`;

    if (htmlContent.includes("</body>")) {
        return htmlContent.replace("</body>", `${script}</body>`);
    }
    return `${htmlContent}${script}`;
}
