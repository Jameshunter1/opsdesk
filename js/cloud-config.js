/* OpsDesk — cloud configuration.
   Point this at YOUR sync server (server/server.js — one file, plain
   Node, no installs) and every copy of the app is pre-connected, so
   devices only need to sign in.

   Leave it empty and OpsDesk is fully local; each device can also set
   its own server address in Settings → Account (which overrides this).

   Example: url: "https://yourbox.your-tailnet.ts.net:8787"
        or: url: "http://192.168.2.50:8787"  (LAN — use a local copy of
            the app for plain http; the https live site can't call it) */
window.OPSDESK_CLOUD = {
  url: ""
};
