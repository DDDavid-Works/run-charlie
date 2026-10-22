# Static hosting for Railway (or any container host): serves this folder with Caddy.
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html privacy.html contact.html manifest.webmanifest robots.txt sw.js /srv/
COPY styles /srv/styles
COPY scripts /srv/scripts
COPY icons /srv/icons
# Railway provides $PORT; the Caddyfile reads it.
