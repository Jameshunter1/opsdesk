/* OpsDesk — cloud configuration.
   Fill these two values in after creating your free Supabase project
   (see docs/guide.md → "Use it on all your devices") and every copy of
   the app — live site, installed app, laptop — will offer sign-in.

   The publishable/anon key is designed to be public: it only grants what
   Row Level Security allows, which is "each signed-in user sees exactly
   their own row". Committing it here is safe and intended.

   Emptying both values returns OpsDesk to fully local, exactly as before.
   Values pasted into Settings → Account override these per device. */
window.OPSDESK_CLOUD = {
  url: "https://ocsvbckyqtrkibrtzxwu.supabase.co",
  anonKey: "sb_publishable_OuOXzUlxG7LRAHBTuycRJw_1tGl-yyd"
};
