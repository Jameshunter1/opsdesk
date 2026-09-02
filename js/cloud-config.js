/* OpsDesk — cloud configuration.
   Fill these two values in after creating your free Supabase project
   (see docs/guide.md → "Use it on all your devices") and every copy of
   the app — live site, installed app, laptop — will offer sign-in.

   The anon key is designed to be public: it only grants what Row Level
   Security allows, which is "each signed-in user sees exactly their own
   row". Committing it here is safe and intended.

   Leaving both empty keeps OpsDesk fully local, exactly as before.
   Values pasted into Settings → Account override these per device. */
window.OPSDESK_CLOUD = {
  url: "",     // e.g. "https://abcdefgh.supabase.co"
  anonKey: ""  // the long "anon public" key from Project Settings → API
};
