# Direct connection setup — `helloliam.co.za`

Goal: connect the portal **straight to your Home Assistant** over your public
static IP instead of routing through the Nabu Casa relay (lower latency), while
keeping Nabu Casa as an automatic fallback.

Target topology:

| Hostname | Points to | Serves |
|---|---|---|
| `ha.helloliam.co.za` | your public static IP → HA host | Home Assistant (HTTPS/`wss`) |
| `www.helloliam.co.za` | Firebase Hosting | the portal |

Do the steps **in order**. Nothing here touches the live portal until the very
last step, and even that is reversible.

---

## 1. DNS records (wherever you manage `helloliam.co.za` DNS)

Add:

- **`ha`** → `A` record → `YOUR.PUBLIC.STATIC.IP` (TTL 5 min while testing)

Leave `www` for step 4 (Firebase gives you the exact records).

> If DNS is at a slow registrar, consider moving the domain's nameservers to
> Cloudflare (free) — DNS only, **grey cloud / DNS-only**, not proxied. Optional.

---

## 2. Router — port forwarding

Forward to the HA host's LAN IP (e.g. `192.168.1.x`):

- **TCP 443 → 443** (HTTPS / websocket)
- **TCP 80 → 80** (only needed so Let's Encrypt can auto-renew via HTTP-01)

If your ISP router can't forward 80, use the DNS-01 challenge in step 3 instead.

---

## 3. HTTPS on Home Assistant (`ha.helloliam.co.za`)

Two add-ons (Settings → Add-ons → Add-on store):

### 3a. Let's Encrypt add-on — issue the certificate
Config:
```yaml
email: you@helloliam.co.za
domains:
  - ha.helloliam.co.za
challenge: http        # uses port 80; switch to dns if 80 can't be forwarded
```
Start it once. It writes `fullchain.pem` + `privkey.pem` into `/ssl`.

### 3b. NGINX Home Assistant SSL proxy add-on — terminate TLS on 443
Config:
```yaml
domain: ha.helloliam.co.za
hsts: max-age=31536000; includeSubDomains
certfile: fullchain.pem
keyfile: privkey.pem
```
Start it. It listens on 443 and reverse-proxies to HA (handling the websocket
upgrade). **Do not** also set `ssl: true` in the `http:` block below — the proxy
terminates TLS, HA stays plain-HTTP internally.

---

## 4. Home Assistant `configuration.yaml`

Add (or merge into) the `http:` block, then restart HA:

```yaml
http:
  use_x_forwarded_for: true
  trusted_proxies:
    - 172.30.33.0/24   # HA add-on docker network (the NGINX proxy)
    - 127.0.0.1
    - ::1
  cors_allowed_origins:
    - https://www.helloliam.co.za
    - https://helloliam-ha-dashboard.web.app
```

`cors_allowed_origins` is required for the portal's REST calls (Assist,
templates, reminders). The live websocket authenticates by token and isn't
gated by CORS, but include the origins anyway.

---

## 5. Verify externally

From a phone on mobile data (off your wifi):

```
https://ha.helloliam.co.za
```

You should get the HA login with a valid padlock (no cert warning). If that
works, the hard part is done.

**NAT hairpin note:** on your home wifi, `ha.helloliam.co.za` resolves to your
public IP — some routers won't route that back inward ("NAT loopback"). If the
portal can't reach HA *only* when you're at home, add a local DNS override
(router/Pi-hole/NextDNS) mapping `ha.helloliam.co.za` → HA's **LAN IP**.

---

## 6. Firebase custom domain for the portal (`www.helloliam.co.za`)

Firebase console → your project → **Hosting** → **Add custom domain** →
`www.helloliam.co.za` → follow the wizard:
1. Add the **TXT** record it shows (ownership verification).
2. Add the **A** records it shows for `www` (Firebase's IPs — use exactly what
   the console displays; don't guess).
3. Wait for it to go green (cert auto-provisions, ~15 min–24 h).

The existing `helloliam-ha-dashboard.web.app` URL keeps working too.

---

## 7. Long-lived access token

In HA: click your **profile** (bottom-left) → **Security** tab → **Long-lived
access tokens** → **Create token** → name it "HA Portal" → copy it (shown once).

---

## 8. Point the portal at your instance

Open the portal → **Settings → System → Home Assistant connection** (owner only):
- **Direct URL:** `https://ha.helloliam.co.za`
- **Long-lived access token:** paste the token
- **Connect directly** → the portal reloads and connects straight to your box.

Reversible any time via **Revert to built-in**. And if `ha.helloliam.co.za` is
ever unreachable, the portal auto-falls back to the Nabu Casa connection, so you
won't get locked out.

---

## 9. Harden (HA is now internet-facing)

- Confirm **MFA** is on for every HA login.
- Keep HA + add-ons updated.
- Consider the **fail2ban** add-on (bans repeated failed logins).
- Optionally restrict `ha.helloliam.co.za` to known IPs at the router/proxy, or
  put Cloudflare Access in front later if you want a login gate.
- Keep the Nabu Casa subscription — it's your fallback and still powers any
  cloud TTS / Alexa / Google integrations.
