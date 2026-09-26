// Public browser configuration. Never put a secret or service_role key here.
// Project connected; complete database and authentication setup in SHARED-SETUP.md.
window.STAR_JAR_CONFIG = Object.freeze({
  supabaseUrl: "https://puchqrracculzpoiuule.supabase.co",
  supabasePublicKey: "sb_publishable_pCik-3t3AcB8OJQRw1XaVQ_yJrbMLd2",
  // Optional for local testing; enable Turnstile before a public launch.
  turnstileSiteKey: ""
});
