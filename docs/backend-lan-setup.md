# Backend LAN setup (physical device testing)

For the SouqView app on a **physical device** to reach your backend, two things are required:

## 1. App: use your computer's LAN IP

In the mobile app `.env`, set:

```env
EXPO_PUBLIC_API_URL=http://YOUR_IPv4:5000/api
```

Example: `http://192.168.0.214:5000/api`. Find your IPv4 in Windows: `ipconfig` → "IPv4 Address".

## 2. Backend: listen on all interfaces (0.0.0.0)

Your Node/Express server must bind to **0.0.0.0** so it accepts connections from other devices on the LAN, not only from localhost.

### If you use Express directly

**Before (localhost only):**
```js
app.listen(5000, () => {
  console.log('Server on http://localhost:5000');
});
```

**After (accepts LAN connections):**
```js
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server on http://0.0.0.0:${PORT} (LAN: http://YOUR_IP:${PORT})`);
});
```

### If your server is created with `http.createServer`

**Before:**
```js
server.listen(5000, () => { ... });
```

**After:**
```js
server.listen(5000, '0.0.0.0', () => {
  console.log('Server listening on 0.0.0.0:5000');
});
```

### Checklist

- [ ] Backend listens on `0.0.0.0` (or host `'0.0.0.0'` in `listen()`).
- [ ] Firewall allows inbound TCP on port 5000 (Windows Firewall or antivirus).
- [ ] Phone and PC are on the same Wi‑Fi network.
- [ ] `.env` has `EXPO_PUBLIC_API_URL=http://YOUR_IP:5000/api`.

After changing `.env`, restart the Expo app (or run `npx expo start --clear`) so it picks up the new URL.
