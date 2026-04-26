# Cloudinary React SDK Patterns & Common Errors

**Scope**: These rules apply to **React (web)** with the browser Upload Widget. The **default** is **Vite** (create-cloudinary-react uses Vite). They also work with **other bundlers** (Create React App, Next.js, Parcel, etc.): only **how you read env vars** changes; see **"Other bundlers (non-Vite)"** below. Rules-only users: see **"Project setup (rules-only / without CLI)"** for the reusable Cloudinary instance, env, Upload Widget (unsigned/signed), and video player. For **React Native** uploads (including signed upload), see: https://cloudinary.com/documentation/react_native_image_and_video_upload#signed_upload — same “never expose secret, generate signature on backend” principle, but React Native uses the `upload()` method and backend SDKs differently.

## Official Documentation
- **Transformation Rules**: https://cloudinary.com/documentation/cloudinary_transformation_rules.md
- **Transformation Reference**: https://cloudinary.com/documentation/transformation_reference.md
- **React Image Transformations & Plugins**: https://cloudinary.com/documentation/react_image_transformations.md#plugins
- **React Video Transformations**: https://cloudinary.com/documentation/react_video_transformations.md
- **Cloudinary Video Player** (standalone player): https://cloudinary.com/documentation/cloudinary_video_player.md
- **Video Player React Tutorial**: https://cloudinary.com/documentation/video_player_react_tutorial.md
- **Upload Widget (signed uploads)**: https://cloudinary.com/documentation/upload_widget.md#signed_uploads
- **Upload assets in Next.js (backend signature)**: https://cloudinary.com/documentation/upload_assets_in_nextjs_tutorial.md
- **Cloudinary Node.js SDK (server-side signing)** — use **v2**: `import { v2 as cloudinary } from 'cloudinary'`; do not use v1 (e.g. 1.47.0). https://cloudinary.com/documentation/node_integration.md
- **React Native image and video upload (signed)**: https://cloudinary.com/documentation/react_native_image_and_video_upload.md#signed_upload
- Always consult the official transformation rules when creating transformations
- Use only officially supported parameters from the transformation reference

**Golden rule for @cloudinary/url-gen:** When generating overlay or transformation code, use **only** the "Import reference" table and "Canonical overlay block" in these rules. Copy those import paths and usage patterns exactly; do not guess or derive paths (e.g. `text` and `image` are from `qualifiers/source`, not `actions/overlay`; `Position` is from `qualifiers/position`, not `positioning/Position`).

---

# 📋 PATTERNS (How to Do It Right)

## Project setup (rules-only / without CLI)

If the user is **not** using the create-cloudinary-react CLI and only has these rules, generate the following so they get correct config, env, and widget setup.

**1. Environment (.env)**  
Create a `.env` file in the project root with **Vite prefix** (required for client access):
- `VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name` (required)
- `VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset_name` (optional; required for unsigned upload widget)
- Save the `.env` file after editing it, then restart the dev server so changes load correctly. Use `import.meta.env.VITE_*` in code, not `process.env`.

**2. Reusable Cloudinary instance (config)**  
Create a config file (e.g. `src/cloudinary/config.ts`) so the rest of the app can use a single `cld` instance:
```ts
import { Cloudinary } from '@cloudinary/url-gen';

const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
if (!cloudName) {
  throw new Error('VITE_CLOUDINARY_CLOUD_NAME is not set. Add it to .env with the VITE_ prefix.');
}

export const cld = new Cloudinary({ cloud: { cloudName } });
export const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';
```
- Use **this** pattern for the reusable instance. Everywhere else: `import { cld } from './cloudinary/config'` (or the path the user chose) and call `cld.image(publicId)` / `cld.video(publicId)`.

**3. Upload Widget (unsigned, from scratch)**  

**Strict pattern (always follow this exactly):**
1. **Script in `index.html`** (required): Add `<script src="https://upload-widget.cloudinary.com/global/all.js" async></script>` to `index.html`. Do **not** rely only on dynamic script injection from React — it's fragile.
2. **Poll in useEffect** (required): In `useEffect`, poll with `setInterval` (e.g. every 100ms) until `typeof window.cloudinary?.createUploadWidget === 'function'`. Only then create the widget. A single check (even in `onload`) is **not** reliable because `window.cloudinary` can exist before `createUploadWidget` is attached.
3. **Add a timeout**: Set a timeout (e.g. 10 seconds) to stop polling and show an error if the script never loads. Clear both interval and timeout in cleanup.
4. **Create widget once**: When `createUploadWidget` is available, create the widget and store it in a **ref**. Clear the interval and timeout. Pass options: `{ cloudName, uploadPreset, sources: ['local', 'camera', 'url'], multiple: false }`.
5. **Open on click**: Attach a click listener to a button that calls `widgetRef.current?.open()`. Remove the listener in useEffect cleanup.

❌ **Do NOT**: Check only `window.cloudinary` (not enough); do a single check in `onload` (unreliable); skip the script in `index.html`; poll forever without a timeout.
- **Signed uploads**: Do not use only `uploadPreset`; use the pattern under "Secure (Signed) Uploads" (uploadSignature as function, fetch api_key, server includes upload_preset in signature).

**4. Video player**  
- Use imperative video element only (create with document.createElement, append to container ref, pass to videoPlayer). See "Cloudinary Video Player (The Player)" for the full pattern.

**5. Summary for rules-only users**  
- **Env**: Use your bundler's client env prefix and access (Vite: `VITE_` + `import.meta.env.VITE_*`; see "Other bundlers" if not Vite).
- **Reusable instance**: One config file that creates and exports `cld` (and optionally `uploadPreset`) from `@cloudinary/url-gen`; use it everywhere.
- **Upload widget**: Script in index.html (required); in useEffect, **poll** until `createUploadWidget` is a function, then create widget once and store in ref; unsigned = cloudName + uploadPreset; signed = use uploadSignature function and backend.
- **Video player**: Imperative video element (createElement, append to container ref, pass to videoPlayer); dispose + removeChild in cleanup; fall back to AdvancedVideo if init fails.

**If the user is not using Vite:** Use their bundler's client env prefix and access in the config file and everywhere you read env. Examples: Create React App → `REACT_APP_CLOUDINARY_CLOUD_NAME`, `process.env.REACT_APP_CLOUDINARY_CLOUD_NAME`; Next.js (client) → `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`. The rest (cld instance, widget options, video player) is the same.

## Environment Variables
- **Default: Vite** — Vite requires `VITE_` prefix; use `import.meta.env.VITE_CLOUDINARY_CLOUD_NAME` (not `process.env`). Restart dev server after changing `.env`.
- ✅ CORRECT (Vite): `VITE_CLOUDINARY_CLOUD_NAME=mycloud` in `.env`; `import.meta.env.VITE_CLOUDINARY_CLOUD_NAME`

## Other bundlers (non-Vite)
- **Only the env access changes.** All other patterns (reusable `cld`, Upload Widget, Video Player, overlays, signed uploads) are bundler-agnostic.
- **Create React App**: Prefix `REACT_APP_`; access `process.env.REACT_APP_CLOUDINARY_CLOUD_NAME`, `process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET`. Restart dev server after `.env` changes.
- **Next.js (client)**: Prefix `NEXT_PUBLIC_` for client; access `process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, etc. Server-side can use `process.env.CLOUDINARY_*` without `NEXT_PUBLIC_`.
- **Parcel / other**: Check the bundler's docs for "exposing environment variables to the client" (often a prefix or allowlist). Use that prefix and the documented access (e.g. `process.env.*`).
- **Config file**: In `src/cloudinary/config.ts` (or equivalent), read cloud name and upload preset using the **user's bundler** env API (e.g. for CRA: `process.env.REACT_APP_CLOUDINARY_CLOUD_NAME`). Same `new Cloudinary({ cloud: { cloudName } })` and exports; only the env read line changes.

## Upload Presets
- **Unsigned** = client-only uploads (no backend). **Signed** = backend required, more secure. See **"Signed vs unsigned uploads"** below for when to use which.
- ✅ Create unsigned upload preset (for simple client uploads): https://console.cloudinary.com/app/settings/upload/presets
- ✅ Set preset in `.env`: `VITE_CLOUDINARY_UPLOAD_PRESET=your-preset-name`
- ✅ Use in code: `import { uploadPreset } from './cloudinary/config'`
- ⚠️ If upload preset is missing, the Upload Widget will show an error message
- ⚠️ Upload presets must be set to "Unsigned" mode for client-side usage (no API key/secret needed)
- **When unsigned upload fails**: First check that the user configured their upload preset:
  1. Is `VITE_CLOUDINARY_UPLOAD_PRESET` set in `.env`? (must match preset name exactly)
  2. Does the preset exist in the dashboard under Settings → Upload → Upload presets?
  3. Is the preset set to **Unsigned** (not Signed)?
  4. Was the dev server restarted after adding/updating `.env`?

## Installing Cloudinary packages
- ✅ **Install the latest**: When adding Cloudinary packages, use `npm install <package>` **with no version** so npm installs the latest compatible version (e.g. `npm install cloudinary-video-player`). In package.json use a **caret range** (e.g. `"cloudinary-video-player": "^1.0.0"`) so future installs get the latest compatible. Do not pin to an exact version unless you have verified it exists on npm.
- ✅ **Package names only**: Use **only** these names: `@cloudinary/react`, `@cloudinary/url-gen`, `cloudinary-video-player` (standalone player), `cloudinary` (Node server-side only). Do not invent names (e.g. no `@cloudinary/video-player`).
- ❌ **WRONG**: `npm install cloudinary-video-player@1.2.3` or `"cloudinary-video-player": "1.2.3"` (exact pin) — versions may not exist and break installs.
- ✅ **Correct**: `npm install cloudinary-video-player` (no version) or in package.json: `"cloudinary-video-player": "^1.0.0"` (caret = latest compatible).

## Import Patterns
- ✅ Import Cloudinary instance: `import { cld } from './cloudinary/config'`
- ✅ Import components: `import { AdvancedImage, AdvancedVideo } from '@cloudinary/react'`
- ✅ Import plugins: `import { responsive, lazyload, placeholder } from '@cloudinary/react'`
- ✅ **For transformations and overlays**, use **only** the exact paths in "Import reference: @cloudinary/url-gen" and the "Canonical overlay block" below. Do **not** guess subpaths (e.g. `text` and `image` are from `qualifiers/source`, not `actions/overlay`).

## Import reference: @cloudinary/url-gen (use these exact paths only)

**Rule:** Do not invent or guess import paths for `@cloudinary/url-gen`. Use **only** the paths in the table and canonical block below. Copy the import statements exactly; do not derive paths (e.g. `@cloudinary/url-gen/overlay` exports only `source` — `text` and `image` are from **`qualifiers/source`**; `Position` is from **`qualifiers/position`**, not `positioning/Position`). Wrong paths cause "module not found" or "does not exist".

| Purpose | Exact import |
|--------|----------------|
| Cloudinary instance (config) | `import { Cloudinary } from '@cloudinary/url-gen';` |
| Resize (fill) | `import { fill } from '@cloudinary/url-gen/actions/resize';` |
| Resize (scale, for overlays) | `import { scale } from '@cloudinary/url-gen/actions/resize';` |
| Delivery format/quality | `import { format, quality } from '@cloudinary/url-gen/actions/delivery';` |
| Format qualifier (auto) | `import { auto } from '@cloudinary/url-gen/qualifiers/format';` |
| Quality qualifier (auto) | `import { auto as autoQuality } from '@cloudinary/url-gen/qualifiers/quality';` |
| Effects (e.g. blur) | `import { blur } from '@cloudinary/url-gen/actions/effect';` |
| Overlay source | `import { source } from '@cloudinary/url-gen/actions/overlay';` |
| Overlay text / image (source types) | `import { text, image } from '@cloudinary/url-gen/qualifiers/source';` |
| Overlay image transformation | `import { Transformation } from '@cloudinary/url-gen/transformation/Transformation';` |
| Position (overlay) | `import { Position } from '@cloudinary/url-gen/qualifiers/position';` |
| Gravity/compass | `import { compass } from '@cloudinary/url-gen/qualifiers/gravity';` |
| Text style (overlay) | `import { TextStyle } from '@cloudinary/url-gen/qualifiers/textStyle';` |
| Types | `import type { CloudinaryImage, CloudinaryVideo } from '@cloudinary/url-gen';` |

**Canonical overlay block (copy these imports and patterns exactly):**
```ts
// Overlay imports — text/image from qualifiers/source, NOT actions/overlay
import { source } from '@cloudinary/url-gen/actions/overlay';
import { text, image } from '@cloudinary/url-gen/qualifiers/source';
import { Position } from '@cloudinary/url-gen/qualifiers/position';
import { TextStyle } from '@cloudinary/url-gen/qualifiers/textStyle';
import { compass } from '@cloudinary/url-gen/qualifiers/gravity';
import { Transformation } from '@cloudinary/url-gen/transformation/Transformation';
import { scale } from '@cloudinary/url-gen/actions/resize';

// Text overlay (compass with underscores: 'south_east', 'center')
cld.image('id').overlay(
  source(text('Hello', new TextStyle('Arial', 60).fontWeight('bold')).textColor('white'))
    .position(new Position().gravity(compass('center')))
);

// Image overlay (logo/image with resize)
cld.image('id').overlay(
  source(image('logo').transformation(new Transformation().resize(scale().width(100))))
    .position(new Position().gravity(compass('south_east')).offsetX(20).offsetY(20))
);
```

- **Components** (AdvancedImage, AdvancedVideo, plugins) come from **`@cloudinary/react`**, not from `@cloudinary/url-gen`.
- **Transformation actions and qualifiers** (resize, delivery, effect, overlay, etc.) come from **`@cloudinary/url-gen/actions/*`** and **`@cloudinary/url-gen/qualifiers/*`** with the exact subpaths above.
- If an import fails, verify the package version (`@cloudinary/url-gen` in package.json) and the [Cloudinary URL-Gen SDK docs](https://cloudinary.com/documentation/sdks/js/url-gen/index.html) or [Transformation Builder reference](https://cloudinary.com/documentation/sdks/js/transformation_builder_reference).

## Creating Image & Video Instances
- ✅ Create image instance: `const img = cld.image(publicId)`
- ✅ Create video instance: `const video = cld.video(publicId)` (same pattern as images)
- ✅ Public ID format: Use forward slashes for folders (e.g., `'folder/subfolder/image'`)
- ✅ Public IDs are case-sensitive and should not include file extensions
- ✅ **Sample assets**: Cloudinary may provide sample assets under `samples/`. **Assume they might not exist** (users can delete them); always handle load errors and provide fallbacks (see Image gallery). When they exist, use them for examples and demos instead of requiring uploads first.
- ✅ **Sample public IDs that may be available** (use for galleries, demos; handle onError if missing):
  - Images: `samples/cloudinary-icon`, `samples/two-ladies`, `samples/food/spices`, `samples/landscapes/beach-boat`, `samples/bike`, `samples/landscapes/girl-urban-view`, `samples/animals/reindeer`, `samples/food/pot-mussels`
  - Video: `samples/elephants`
- ✅ **Default / most reliable**: Start with `samples/cloudinary-icon` for a single image; use the list above for galleries or variety. Prefer uploaded assets when the user has them.
- ✅ Examples:
  ```tsx
  const displayImage = cld.image('samples/cloudinary-icon');
  const displayVideo = cld.video('samples/elephants');
  // Gallery: e.g. ['samples/bike', 'samples/landscapes/beach-boat', 'samples/food/spices', ...]
  ```

## Transformation Patterns

### Image Transformations
- ✅ Chain transformations on image instance:
  ```tsx
  const img = cld.image('id')
    .resize(fill().width(800).height(600))
    .effect(blur(800))
    .delivery(format(auto()))
    .delivery(quality(autoQuality()));
  ```
- ✅ Pass to component: `<AdvancedImage cldImg={img} />`

### Video Transformations
- ✅ Chain transformations on video instance (same pattern as images):
  ```tsx
  const video = cld.video('id')
    .resize(fill().width(800).height(600))
    .delivery(format(auto()));
  ```
- ✅ Pass to component: `<AdvancedVideo cldVid={video} />`
- ✅ Video transformations work the same way as image transformations

### Transformation Best Practices
- ✅ Format and quality must use separate `.delivery()` calls
- ✅ Always end with auto format/quality: `.delivery(format(auto())).delivery(quality(autoQuality()))` unless user specifies a particular format or quality
- ✅ Use `gravity(auto())` unless user specifies a focal point
- ✅ Same transformation syntax works for both images and videos

## Plugin Patterns
- ✅ **When the user asks for lazy loading or responsive images**: Use the **Cloudinary plugins** from `@cloudinary/react` — `responsive()`, `lazyload()`, `placeholder()` — with `AdvancedImage`. Do not use only native `loading="lazy"` or CSS-only responsive; the Cloudinary plugins handle breakpoints, lazy loading, and placeholders for Cloudinary URLs.
- ✅ Import plugins from `@cloudinary/react`
- ✅ Pass plugins as array: `plugins={[responsive(), lazyload(), placeholder()]}`
- ✅ Recommended plugin order:
  1. `responsive()` - First (handles breakpoints)
  2. `placeholder()` - Second (shows placeholder while loading)
  3. `lazyload()` - Third (delays loading until in viewport)
  4. `accessibility()` - Last (if needed)
- ✅ Always add `width` and `height` attributes to prevent layout shift
- ✅ Example:
  ```tsx
  <AdvancedImage
    cldImg={img}
    plugins={[responsive(), placeholder({ mode: 'blur' }), lazyload()]}
    width={800}
    height={600}
  />
  ```

## Responsive Images Pattern
- ✅ **Responsive images**: Use the Cloudinary `responsive()` plugin with `fill()` resize (not only CSS). **Lazy loading**: Use the Cloudinary `lazyload()` plugin with `AdvancedImage` (not only `loading="lazy"`).
- ✅ Use `responsive()` plugin with `fill()` resize
- ✅ Combine with `placeholder()` and `lazyload()` plugins
- ✅ Example:
  ```tsx
  const img = cld.image('id').resize(fill().width(800));
  <AdvancedImage 
    cldImg={img} 
    plugins={[responsive(), placeholder({ mode: 'blur' }), lazyload()]} 
    width={800}
    height={600}
  />
  ```

## Image gallery with lazy loading and responsive
- ✅ **When the user asks for an image gallery with lazy loading and responsive**: Use Cloudinary **plugins** with `AdvancedImage`: `responsive()`, `lazyload()`, `placeholder()` (see Plugin Patterns). Use `fill()` resize with the responsive plugin. Add `width` and `height` to prevent layout shift.
- ✅ **Sample assets in galleries**: Use the sample public IDs from "Creating Image & Video Instances" (e.g. `samples/bike`, `samples/landscapes/beach-boat`, `samples/food/spices`, `samples/two-ladies`, `samples/landscapes/girl-urban-view`, `samples/animals/reindeer`, `samples/food/pot-mussels`, `samples/cloudinary-icon`). **Assume any sample might not exist** — users can delete them. Start with one reliable sample (e.g. `samples/cloudinary-icon`) or a short list; add **onError** handling and remove/hide failed images. Prefer **uploaded** assets when available (e.g. from UploadWidget) over samples.
- ✅ **Handle load errors**: Use `onError` on `AdvancedImage` to hide or remove failed images (e.g. set state to filter out the publicId, or hide the parent). Provide user feedback (e.g. "Some images could not be loaded. Try uploading your own!") and upload functionality so users can add their own images.
- ✅ **Fallback**: Default gallery list can be a subset of the sample list (e.g. `['samples/cloudinary-icon', 'samples/bike', 'samples/landscapes/beach-boat']`); when user uploads, append `result.public_id`. If an image fails to load, remove it from the list or hide it so the UI doesn't show broken images.

## Image Overlays (text or logos)
- ✅ **When the user asks for image overlays with text or logos**: Use `@cloudinary/url-gen` overlay APIs. Copy imports and patterns from the **"Import reference"** table and **"Canonical overlay block"** in these rules. Do not import `text` or `image` from `actions/overlay` — they are from **`qualifiers/source`**; only `source` is from `actions/overlay`.
- ✅ **Import** `source` from `actions/overlay`; **`text` and `image` from `qualifiers/source`**. Also: `Position` from `qualifiers/position`, `TextStyle` from `qualifiers/textStyle`, `compass` from `qualifiers/gravity`, `Transformation` from `transformation/Transformation`, `scale` from `actions/resize`.
- ✅ **compass()** takes **string** values, with **underscores**: `compass('center')`, `compass('south_east')`, `compass('north_west')`. ❌ WRONG: `compass(southEast)` or `'southEast'` (no camelCase).
- ✅ **Overlay image**: Use `new Transformation()` **inside** `.transformation()`: `image('logo').transformation(new Transformation().resize(scale().width(100)))`. ❌ WRONG: `image('logo').transformation().resize(...)` (`.transformation()` does not return a chainable object).
- ✅ **Text overlay**: `fontWeight` goes on **TextStyle**: `new TextStyle('Arial', 60).fontWeight('bold')`. `textColor` goes on the **text source** (chained after `text(...)`): `text('Hello', new TextStyle('Arial', 60)).textColor('white')`.
- ✅ **Position** is chained **after** `source(...)`, not inside: `source(image('logo').transformation(...)).position(new Position().gravity(compass('south_east')).offsetX(20).offsetY(20))`.
- ✅ **Image overlay pattern**: `baseImage.overlay(source(image('id').transformation(new Transformation().resize(scale().width(100)))).position(new Position().gravity(compass('south_east')).offsetX(20).offsetY(20)))`. (Import `scale` from `@cloudinary/url-gen/actions/resize` if needed.)
- ✅ **Text overlay pattern**: `baseImage.overlay(source(text('Your Text', new TextStyle('Arial', 60).fontWeight('bold')).textColor('white')).position(new Position().gravity(compass('center'))))`.
- ✅ Docs: React Image Transformations and transformation reference for overlay syntax.

## Upload Widget Pattern
- ✅ Use component: `import { UploadWidget } from './cloudinary/UploadWidget'`

**Strict initialization pattern (always follow this exactly):**
1. ✅ **Script in `index.html`** (required):
  ```html
  <script src="https://upload-widget.cloudinary.com/global/all.js" async></script>
  ```
2. ✅ **Poll in useEffect until `createUploadWidget` is available** (required): Use `setInterval` (e.g. every 100ms) to check `typeof window.cloudinary?.createUploadWidget === 'function'`. Only create the widget when this returns `true`. Clear the interval once ready.
3. ✅ **Add a timeout** (e.g. 10 seconds) to stop polling and show an error state if the script never loads. Clear both interval and timeout in cleanup and when ready.
4. ✅ **Create widget once**, store in a ref. Cleanup: clear interval, clear timeout, remove click listener.

❌ **Do NOT**: Check only `window.cloudinary` (the function may not be attached yet); do a single check in `onload` (unreliable timing); skip `index.html` and rely only on dynamic injection; poll forever without a timeout.

- ✅ Create unsigned upload preset in dashboard at `settings/upload/presets`
- ✅ Add to `.env`: `VITE_CLOUDINARY_UPLOAD_PRESET=your_preset_name`
- ✅ Handle callbacks:
  ```tsx
  <UploadWidget
    onUploadSuccess={(result) => {
      console.log('Public ID:', result.public_id);
    }}
    onUploadError={(error) => {
      console.error('Upload failed:', error);
    }}
  />
  ```
- ✅ Upload result contains: `public_id`, `secure_url`, `width`, `height`, etc.

## Signed vs unsigned uploads (when to use which)

**Unsigned uploads** (simpler, no backend required):
- Use when: Quick prototypes, low-risk apps, or when anyone with the preset name may upload.
- Preset: Create an **Unsigned** upload preset in Cloudinary dashboard (Settings → Upload → Upload presets). Put preset name in `.env` as `VITE_CLOUDINARY_UPLOAD_PRESET`.
- Client: Widget needs only `cloudName` and `uploadPreset`. No API key or secret; no backend.
- Trade-off: Anyone who knows the preset name can upload. Use only when that is acceptable.

**Signed uploads** (more secure, backend required):
- Use when: Production apps, authenticated users, or when you need to control who can upload.
- Preset: Create a **Signed** upload preset in the dashboard. The backend generates a signature using your API secret; the client never sees the secret.
- Client: Widget gets `api_key` (from your backend), `uploadPreset`, and an `uploadSignature` **function** that calls your backend for each upload. API secret stays on server only.
- Trade-off: Requires a backend (Node/Express, Next.js API route, etc.) to sign requests. More secure; signature validates each upload.

**Rule of thumb**: **Default to unsigned uploads** unless the user explicitly asks for "secure" or "signed" uploads. Do not default to signed — it requires a running backend and will fail out of the box. Use **signed** only when the user explicitly requests secure/signed uploads or needs to restrict who can upload.

## Secure (Signed) Uploads

**Golden rules**: (1) **Never expose or commit the API secret** — it must live only in server env and server code. (2) **Never commit the API key or secret** — use `server/.env` (or equivalent) and ensure it is in `.gitignore`. (3) The **api_key** is not secret and may be sent to the client (e.g. in the signature response); only **api_secret** must stay server-only.

**When the user asks for secure uploads**: Use a signed upload preset and generate the signature on the server. The client may receive `uploadSignature`, `uploadSignatureTimestamp`, `api_key`, and `cloudName` from your backend; it must **never** receive or contain the API secret.

### Where to put API key and secret (server-only, never committed)

- **Do not put them in the root `.env`** used by Vite. Keep root `.env` for `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` only.
- **Create `server/.env`** (in a `server/` folder) and put there: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. No `VITE_` prefix. Load this file only in the server process (e.g. `dotenv.config({ path: 'server/.env' })`).
- **Never commit API key or secret**: Add `server/.env` to `.gitignore`. Use env vars for all credentials; never hardcode or commit them.
- **In code**: Read `process.env.CLOUDINARY_API_SECRET` and `process.env.CLOUDINARY_API_KEY` only in server/API code. Never in React components or any file Vite bundles.
- **Next.js**: `CLOUDINARY_*` in root `.env.local` is server-only (browser only sees `NEXT_PUBLIC_*`). For Vite + Node in same repo, prefer `server/.env` and load it only in the server.
- **Server SDK**: Use the **Cloudinary Node.js SDK v2** for server-side signing: `import { v2 as cloudinary } from 'cloudinary'` (package name: `cloudinary`). Do **not** use v1 (e.g. 1.47.0) — v1 does not expose `cloudinary.utils.api_sign_request` the same way. Install: `npm install cloudinary` (v2).

### How the client gets credentials (working pattern — use this)

Use **`uploadSignature` as a function** (not `signatureEndpoint`). The widget calls the function with `params_to_sign`; your function calls your backend and passes the signature back. This pattern is reliable across widget versions.

1. **Fetch `api_key` from server first** (before creating the widget). API key is not secret; safe to use in client. Your backend returns it from the sign endpoint (e.g. `/api/sign-image`).

2. **Set `uploadSignature` to a function** that receives `(callback, params_to_sign)` from the widget. Inside the function, add `upload_preset` to `params_to_sign` (use your signed preset name, e.g. from env or a constant), POST to your backend with `{ params_to_sign: paramsWithPreset }`, then call `callback(data.signature)` with the response.

3. **Include `uploadPreset` in the widget config** (your signed preset name). The widget needs it so it includes it in `params_to_sign`. **Default:** Cloudinary accounts have a built-in signed preset `ml_default` (users can delete it). If the user has not created their own signed preset, use `ml_default`; otherwise use the preset name from their dashboard.

4. **Server endpoint**: Accept `params_to_sign` from the request body. Always include `upload_preset` in the object you sign (add it if the client did not send it). Use `cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET)` to generate the signature. Return `{ signature, timestamp, api_key, cloud_name }`. Never return the API secret.

**Preset name:** Use `ml_default` when the user has not specified a signed preset (Cloudinary provides it by default; users can delete it — then they must create one in the dashboard). Otherwise use the user's preset name.

**Generic client pattern** (preset: use `ml_default` if it exists / user hasn't specified one; endpoint is up to the user):
```tsx
// Fetch api_key from server first, then:
widgetConfig.api_key = data.api_key; // from your sign endpoint
widgetConfig.uploadPreset = 'ml_default'; // default signed preset (or user's preset if they created one)
widgetConfig.uploadSignature = function(callback, params_to_sign) {
  const paramsWithPreset = { ...params_to_sign, upload_preset: 'ml_default' };
  fetch('/api/sign-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ params_to_sign: paramsWithPreset }),
  })
    .then(r => r.json())
    .then(data => data.signature ? callback(data.signature) : callback(''))
    .catch(() => callback(''));
};
```

**Generic server pattern** (Node/Express with SDK v2):
```ts
// import { v2 as cloudinary } from 'cloudinary';
const params = req.body.params_to_sign || {};
const paramsToSign = { ...params, upload_preset: params.upload_preset || 'ml_default' };
const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);
res.json({ signature, timestamp: paramsToSign.timestamp, api_key: process.env.CLOUDINARY_API_KEY, cloud_name: process.env.CLOUDINARY_CLOUD_NAME });
```

- ❌ **Avoid `signatureEndpoint`** — it may not be called reliably by all widget versions. Prefer the `uploadSignature` function.
- ✅ Docs: [Upload widget — signed uploads](https://cloudinary.com/documentation/upload_widget.md#signed_uploads), [Upload assets in Next.js](https://cloudinary.com/documentation/upload_assets_in_nextjs_tutorial.md).

### Rules for secure uploads
- ✅ Use a **signed** upload preset (dashboard → Upload presets → Signed). Do not use an unsigned preset when the user wants secure uploads. **Default:** Accounts have a built-in signed preset `ml_default` — use it if the user hasn't created their own (they can delete `ml_default`, in which case they must create a signed preset in the dashboard).
- ✅ Generate the signature **on the server only** using Cloudinary Node.js SDK **v2** (`cloudinary.utils.api_sign_request`). Never put `CLOUDINARY_API_SECRET` in a `VITE_` variable or in client-side code.
- ✅ Keep `server/.env` in `.gitignore`; never commit API key or secret.
- ✅ Use **`uploadSignature` as a function** (not `signatureEndpoint`) for reliable signed uploads.
- ✅ Include **`uploadPreset` in the widget config** so the widget includes it in `params_to_sign`.
- ✅ **Server must include `upload_preset` in the signed params** (add it if the client did not send it).

### What not to do
- ❌ **Never** put the API secret in a `VITE_` (or `NEXT_PUBLIC_`) variable or in any file sent to the browser.
- ❌ **Never** commit the API key or secret; use env vars and ignore `server/.env` in git.
- ❌ **Do not** generate the signature in client-side JavaScript (it would require the secret in the client).
- ❌ **Do not** use an unsigned preset when the user explicitly wants secure/signed uploads.
- ❌ **Do not** omit `uploadPreset` from the widget config when using signed uploads (widget needs it in `params_to_sign`).
- ❌ **Do not** use Cloudinary Node SDK v1 (e.g. 1.47.0) for signing — use v2 (`import { v2 as cloudinary } from 'cloudinary'`).
- ❌ **Do not** rely on `signatureEndpoint` alone; use the `uploadSignature` function for reliability.

## Video Patterns

- ✅ **Display a video** → Use **AdvancedVideo** (`@cloudinary/react`). It just displays a video (with optional transformations). Not a full player.
- ✅ **A video player** → Use **Cloudinary Video Player** (`cloudinary-video-player`). That is the actual player (styled UI, controls, playlists, etc.).

### ⚠️ IMPORTANT: Two Different Approaches

**1. AdvancedVideo** (`@cloudinary/react`) — For **displaying** a video
- React component similar to `AdvancedImage`; just displays a video with Cloudinary transformations
- Not a full "player" — it's video display (native HTML5 video with optional controls)
- Use when: user wants to show/display a video. Works with `cld.video()` like images with `cld.image()`

**2. Cloudinary Video Player** (`cloudinary-video-player`) — The **player**
- Full-featured video player (styled UI, controls, playlists). Use when the user asks for a "video player."
- **Use imperative video element only** (create with document.createElement, append to container ref); do not pass a React-managed `<video ref>`. See "Cloudinary Video Player (The Player)" below.

### AdvancedVideo (React SDK - For Displaying a Video)
- ✅ **Purpose**: Display a video with Cloudinary transformations (resize, effects, etc.). It is **not** a full player — it is for showing a video. For a player, use Cloudinary Video Player.
- ✅ **Package**: `@cloudinary/react` (same as AdvancedImage)
- ✅ **Import**: `import { AdvancedVideo } from '@cloudinary/react'`
- ✅ **NO CSS IMPORT NEEDED**: AdvancedVideo uses native HTML5 video - no CSS import required
- ❌ **WRONG**: `import '@cloudinary/react/dist/cld-video-player.css'` (this path doesn't exist)
- ✅ **Create video instance**: `const video = cld.video(publicId)` (like `cld.image()`)
- ✅ **Apply transformations**: Chain transformations like images:
  ```tsx
  const video = cld.video('video-id')
    .resize(fill().width(800).height(600))
    .delivery(format(auto()));
  ```
- ✅ **Use component**:
  ```tsx
  <AdvancedVideo
    cldVid={video}
    controls
    autoplay
    muted
  />
  ```
- ✅ **Documentation**: https://cloudinary.com/documentation/react_video_transformations.md

### Cloudinary Video Player (The Player)
Use when the user asks for a **video player** (styled UI, controls, playlists). For just **displaying** a video, use AdvancedVideo instead.

**Rule: imperative element only.** Do **not** pass a React-managed `<video ref={...} />` to the player — the library mutates the DOM and React will throw removeChild errors. Create the video element with `document.createElement('video')`, append it to a container ref, and pass that element to `videoPlayer(el, ...)`.

- **Package**: `cloudinary-video-player`. Install with `npm install cloudinary-video-player` (no version).
- **Import**: `import { videoPlayer } from 'cloudinary-video-player'` (named) and `import 'cloudinary-video-player/cld-video-player.min.css'` (no `dist/` in path). The package only exposes paths under `lib/` via `exports`; use `cld-video-player.min.css` (no `dist/`), which resolves to `lib/cld-video-player.min.css`.
- ❌ **WRONG**: `import 'cloudinary-video-player/dist/cld-video-player.min.css'` — package `exports` do not expose `dist/`; the valid path is `cloudinary-video-player/cld-video-player.min.css`.
- **player.source()** takes an **object**: `player.source({ publicId: 'samples/elephants' })`. Not a string.
- **Cleanup**: Call `player.dispose()`, then **only if** `el.parentNode` exists call `el.parentNode.removeChild(el)` (avoids NotFoundError).
- **If init fails** (CSP, extensions, timing): render **AdvancedVideo** with the same publicId. Do not relax CSP in index.html or ask the user to disable extensions.

**Poster options**: Always include `posterOptions` for a predictable poster image with a fallback color:
- `transformation: { startOffset: '0' }` — use the first frame of the video as the poster (consistent and loads reliably)
- `posterColor: '#0f0f0f'` — if the poster image fails to load, shows a dark background instead of blank/broken
- These can be overridden via props (e.g. `posterOptions={{ transformation: { startOffset: '5' } }}` for a different frame)

**Example (copy this pattern):**
```tsx
const containerRef = useRef<HTMLDivElement>(null);
const playerRef = useRef<ReturnType<typeof videoPlayer> | null>(null);
useLayoutEffect(() => {
  if (!cloudName || !containerRef.current?.isConnected) return;
  const el = document.createElement('video');
  el.className = 'cld-video-player cld-fluid';
  containerRef.current.appendChild(el);
  try {
    const player = videoPlayer(el, {
      cloudName,
      secure: true,
      controls: true,
      fluid: true,
      posterOptions: {
        transformation: { startOffset: '0' },
        posterColor: '#0f0f0f',
      },
    });
    player.source({ publicId: 'samples/elephants' });
    playerRef.current = player;
  } catch (err) { console.error(err); }
  return () => {
    if (playerRef.current) {
      try { playerRef.current.dispose(); } catch (e) { console.warn(e); }
      playerRef.current = null;
    }
    if (el.parentNode) el.parentNode.removeChild(el);
  };
}, [cloudName]);
return <div ref={containerRef} />;
```
Docs: https://cloudinary.com/documentation/cloudinary_video_player.md

### When to Use Which?
- ✅ **Use AdvancedVideo** when: User wants to **display** or **show** a video (no full player). It just displays a video with transformations.
- ✅ **Use Cloudinary Video Player** when: User asks for a **video player** — the actual player with styled UI, controls, and optional features (playlists, ads, etc.).

## TypeScript Patterns

### Type Imports
- ✅ Import types from `@cloudinary/url-gen`:
  ```tsx
  import type { CloudinaryImage } from '@cloudinary/url-gen';
  import type { CloudinaryVideo } from '@cloudinary/url-gen';
  ```
- ✅ Type image instance: `const img: CloudinaryImage = cld.image('id')`
- ✅ Type video instance: `const video: CloudinaryVideo = cld.video('id')`

### Upload Result Types
- ✅ Define interface for upload results:
  ```tsx
  interface CloudinaryUploadResult {
    public_id: string;
    secure_url: string;
    url: string;
    width: number;
    height: number;
    format: string;
    resource_type: string;
    bytes: number;
    created_at: string;
    // Add other fields as needed
  }
  ```
- ✅ Type upload callbacks:
  ```tsx
  onUploadSuccess?: (result: CloudinaryUploadResult) => void;
  ```
- ❌ **WRONG**: `onUploadSuccess?: (result: any) => void`
- ✅ **CORRECT**: Use proper interface or type definition

### Environment Variable Typing
- ✅ Create `vite-env.d.ts` for type safety:
  ```tsx
  /// <reference types="vite/client" />
  
  interface ImportMetaEnv {
    readonly VITE_CLOUDINARY_CLOUD_NAME: string;
    readonly VITE_CLOUDINARY_UPLOAD_PRESET?: string;
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  ```
- ✅ Access with type safety: `import.meta.env.VITE_CLOUDINARY_CLOUD_NAME`

### Type Guards and Safety
- ✅ Type guard for window.cloudinary (check `createUploadWidget`, not just `cloudinary`):
  ```tsx
  function isUploadWidgetReady(): boolean {
    return typeof window !== 'undefined' && 
           typeof window.cloudinary?.createUploadWidget === 'function';
  }
  ```
- ✅ Use type guards before accessing (but **always poll with timeout** in useEffect — don't rely on a single check):
  ```tsx
  // In useEffect, poll until ready with timeout:
  const interval = setInterval(() => {
    if (isUploadWidgetReady()) {
      clearInterval(interval);
      clearTimeout(timeout);
      window.cloudinary.createUploadWidget(...);
    }
  }, 100);
  const timeout = setTimeout(() => {
    clearInterval(interval);
    console.error('Upload widget script failed to load');
  }, 10000);
  // Cleanup: clearInterval(interval); clearTimeout(timeout);
  ```

### Ref Typing Patterns
- ✅ Type refs properly:
  ```tsx
  // Video element ref
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Button ref
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Widget ref (use unknown if types not available)
  const widgetRef = useRef<unknown>(null);
  ```

### Type Narrowing
- ✅ Handle optional values with type narrowing:
  ```tsx
  const preset = uploadPreset || undefined; // Type: string | undefined
  
  // Type narrowing in conditionals
  if (uploadPreset) {
    // TypeScript knows uploadPreset is string here
    console.log(preset.length);
  }
  ```

### Avoid `any` Type
- ❌ **WRONG**: `const result: any = ...`
- ✅ **CORRECT**: Use proper interface or `unknown` with type guards
- ✅ **CORRECT**: `const result: unknown = ...` then narrow with type guards
- ✅ When types aren't available, use `unknown` and narrow:
  ```tsx
  function handleResult(result: unknown) {
    if (result && typeof result === 'object' && 'public_id' in result) {
      // TypeScript knows result has public_id
      const uploadResult = result as CloudinaryUploadResult;
    }
  }
  ```

## Best Practices
- ✅ Always use `fill()` resize with automatic gravity for responsive images
- ✅ Always end transformations with `.delivery(format(auto())).delivery(quality(autoQuality()))` unless the user specifies a format or quality
- ✅ Use `placeholder()` and `lazyload()` plugins together
- ✅ Always add `width` and `height` attributes to `AdvancedImage`
- ✅ Store `public_id` from upload success, not full URL
- ✅ Video player: use imperative element only; dispose in useLayoutEffect cleanup and remove element with `if (el.parentNode) el.parentNode.removeChild(el)`; always include `posterOptions` with `transformation: { startOffset: '0' }` and `posterColor: '#0f0f0f'` for reliable poster display
- ✅ Use TypeScript for better autocomplete and error catching
- ✅ Prefer `unknown` over `any` when types aren't available
- ✅ Use type guards for runtime type checking
- ✅ Define interfaces for Cloudinary API responses
- ✅ Create `vite-env.d.ts` for environment variable typing
- ✅ Use proper HTML element types for refs

---

# ⚠️ COMMON ERRORS & SOLUTIONS

## Environment Variable Errors

### "Where do I create the Cloudinary instance?" / "Config with Vite prefix"
- ❌ Problem: User is using rules only (no CLI) and doesn't have a Cloudinary config file, or is using wrong env (e.g. process.env, or missing VITE_ prefix).
- ✅ Create a **single config file** (e.g. `src/cloudinary/config.ts`) that: imports `Cloudinary` from `@cloudinary/url-gen`, reads `import.meta.env.VITE_CLOUDINARY_CLOUD_NAME`, validates it, creates `export const cld = new Cloudinary({ cloud: { cloudName } })`, and exports `uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || ''`. Use **VITE_** prefix in `.env`; access with `import.meta.env.VITE_*` only. See PATTERNS → "Project setup (rules-only / without CLI)" for exact code.

### "Cloud name is required"
- ❌ Problem: `VITE_CLOUDINARY_CLOUD_NAME` not set or wrong prefix
- ✅ Solution:
  1. Check `.env` file exists in project root
  2. Verify variable is `VITE_CLOUDINARY_CLOUD_NAME` (with `VITE_` prefix!)
  3. Restart dev server after adding .env variables

### "VITE_ prefix required" or env var is undefined
- ❌ Problem: Variable doesn't have the right prefix for the bundler, or wrong access (e.g. process.env in Vite, or no prefix in CRA).
- ✅ **Vite**: Use `VITE_` prefix in `.env` and `import.meta.env.VITE_CLOUDINARY_CLOUD_NAME` (not `process.env`).
- ✅ **Not Vite?** Use your bundler's client env prefix and access: Create React App → `REACT_APP_` and `process.env.REACT_APP_CLOUDINARY_CLOUD_NAME`; Next.js (client) → `NEXT_PUBLIC_` and `process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`. See PATTERNS → "Other bundlers (non-Vite)".
- Restart dev server after changing `.env`.

## Import Errors

### "Cannot find module" or wrong import
- ❌ Problem: Importing from wrong package or wrong subpath; agent often invents paths that don't exist.
- ✅ **Use only the exact paths** in PATTERNS → "Import reference: @cloudinary/url-gen (use these exact paths only)". Do **not** guess subpaths (e.g. `@cloudinary/url-gen/resize` or `@cloudinary/url-gen/overlay` — use `actions/resize`, `actions/overlay` with the exact export names from the table).
- ✅ Components and plugins: `@cloudinary/react` (not `@cloudinary/url-gen`). Cloudinary instance and transformation actions/qualifiers: `@cloudinary/url-gen` with the exact subpaths from the Import reference (e.g. `actions/resize`, `actions/delivery`, `qualifiers/format`, `qualifiers/quality`, `actions/overlay`, `qualifiers/gravity`, `qualifiers/textStyle`, `qualifiers/position`, `transformation/Transformation`).
- ✅ If a path fails, check package.json has `@cloudinary/url-gen` and match the import to the Import reference table exactly.

## Transformation Errors

### "Transformation not working" or image looks wrong
- ❌ Problem: Incorrect transformation syntax
- ✅ Solution:
  1. Check transformation is chained: `cld.image('id').resize(...).effect(...)`
  2. Verify actions are imported from correct modules
  3. Ensure image public_id is correct and accessible
  4. Check transformation syntax matches v2 (not v1)
  5. Format/quality must be separate: `.delivery(format(auto())).delivery(quality(autoQuality()))`

### Wrong transformation syntax
- ❌ WRONG: `<AdvancedImage src="image.jpg" width={800} />`
- ✅ CORRECT: 
  ```tsx
  const img = cld.image('image.jpg').resize(fill().width(800));
  <AdvancedImage cldImg={img} />
  ```

## Plugin Errors

### "Responsive images not working" or "Placeholder issues"
- ❌ Problem: Plugins not configured correctly
- ✅ Solution:
  1. Must use `responsive()` plugin with `fill()` resize
  2. Include both `placeholder()` and `lazyload()` plugins
  3. Check image is accessible and public_id is correct
  4. Verify plugins are in array: `plugins={[responsive(), placeholder(), lazyload()]}`
  5. Always add `width` and `height` attributes

### Plugins not working
- ❌ WRONG: `<AdvancedImage cldImg={img} lazyLoad placeholder />`
- ✅ CORRECT: `<AdvancedImage cldImg={img} plugins={[lazyload(), placeholder()]} />`
- ✅ Plugins must be imported from `@cloudinary/react`, not `@cloudinary/url-gen`

## Upload Widget Errors

### Upload fails (unsigned uploads) — first check upload preset
- ❌ Problem: Upload fails when using unsigned upload
- ✅ **Debug checklist** (in order):
  1. **Is the upload preset configured?** Check `.env` has `VITE_CLOUDINARY_UPLOAD_PRESET=your-preset-name` (exact name, no typos)
  2. **Does the preset exist?** Cloudinary dashboard → Settings → Upload → Upload presets
  3. **Is it Unsigned?** Preset must be "Unsigned" for client-side uploads (no API key/secret in browser)
  4. **Env reloaded?** Restart the dev server after any `.env` change
- ✅ If all above are correct, then check: script loaded in `index.html`, cloud name set, and network/console for the actual error message

### "Upload preset not found" or "Invalid upload preset"
- ❌ Problem: Preset doesn't exist or is signed
- ✅ Solution:
  1. Create unsigned upload preset in Cloudinary dashboard
  2. Go to `settings/upload/presets` > Add upload preset
  3. Set to "Unsigned" mode
  4. Copy exact preset name to `.env` as `VITE_CLOUDINARY_UPLOAD_PRESET`
  5. Restart dev server

### "Cannot upload large images" or "Upload fails for large files"
- ❌ Problem: File too large or script not loaded
- ✅ Solution:
  1. Use chunked uploads for files > 20MB
  2. Check upload preset has appropriate limits in dashboard
  3. Verify `window.cloudinary` script is loaded in `index.html`
  4. Consider using server-side upload for very large files

### Widget not opening
- ❌ Problem: Script not loaded, or widget created before `createUploadWidget` was available
- ✅ Solution:
  1. Ensure script is in `index.html`: `<script src="https://upload-widget.cloudinary.com/global/all.js" async></script>`
  2. In `useEffect`, **poll** with `setInterval` until `typeof window.cloudinary?.createUploadWidget === 'function'` — only then create the widget. Do **not** check only `window.cloudinary`.
  3. Verify upload preset is set correctly

### "createUploadWidget is not a function"
- ❌ Problem: **Race condition** — the script loads **async**, so `window.cloudinary` can exist before `createUploadWidget` is attached. A single check (even in `onload`) is **not** reliable.
- ✅ **Always poll**: In `useEffect`, use `setInterval` to check `typeof window.cloudinary?.createUploadWidget === 'function'`. Only create the widget when this returns `true`. Clear the interval once ready.
- ❌ **Do NOT**: Check only `window.cloudinary`; do a single check in `onload`; skip the script in `index.html`.
- ✅ See PATTERNS → Upload Widget Pattern and Project setup → Upload Widget for the strict pattern.

### Video player: "Invalid target for null#on" or React removeChild or NotFoundError
- ❌ Problem: Passing a React-managed `<video ref={...} />` to the player causes removeChild errors (the player mutates the DOM). Or container/ref not in DOM yet when init runs.
- ✅ **Use imperative video element only**: Create the video with `document.createElement('video')`, append to a container ref, pass that element to `videoPlayer(el, ...)`. Check `containerRef.current?.isConnected` before init. In cleanup: dispose, then `if (el.parentNode) el.parentNode.removeChild(el)`. See PATTERNS → Cloudinary Video Player (The Player).

### Video player: failed HEAD or CORS-like console noise
- Failed HEAD/analytics from the player does **not** necessarily mean playback fails. Do not add a preflight GET. If video doesn't play, use the imperative pattern and fall back to AdvancedVideo when init fails.

### Video player blocked by CSP or extensions
- **Do not** relax CSP in index.html or ask the user to disable extensions. **Fall back to AdvancedVideo** with the same publicId when the player fails to initialize.

### User needs secure/signed uploads
- ❌ Problem: User asks for secure uploads; unsigned preset or client-side secret is not acceptable.
- ✅ Use signed preset + server-side signature. Use **`uploadSignature` as a function** (not `signatureEndpoint`); fetch `api_key` from server first; include `uploadPreset` in widget config; server must include `upload_preset` in signed params. Use Cloudinary Node SDK **v2** on server. Never expose or commit the API secret.
- ✅ See PATTERNS → "Signed vs unsigned uploads" and "Secure (Signed) Uploads" → "How the client gets credentials (working pattern)".

### "Where do I put my API key and secret?" / "Never commit API key or secret"
- ❌ Problem: User needs to store `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` securely, or is told to "create a .env file" and worries it will overwrite the existing Vite `.env`.
- ✅ Do not put them in root `.env`. Create `server/.env` with `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`; add `server/.env` to `.gitignore`; load only in the server. Never commit API key or secret.
- ✅ See PATTERNS → "Secure (Signed) Uploads" → "Where to put API key and secret (server-only, never committed)".

### "Invalid Signature" or "Missing required parameter - api_key"
- ❌ Problem: Signed upload fails with "Invalid Signature" or "Missing required parameter - api_key".
- ✅ **Use the working pattern:** (1) Use **`uploadSignature` as a function** (not `signatureEndpoint`). (2) **Fetch `api_key` from server** before creating the widget (API key is not secret). (3) **Include `uploadPreset` in widget config** so the widget includes it in `params_to_sign`. (4) **Server must include `upload_preset` in the signed params** (add it if the client did not send it). (5) Use **Cloudinary Node.js SDK v2** on the server (`import { v2 as cloudinary } from 'cloudinary'`), not v1 (e.g. 1.47.0).
- ✅ **Common mistakes:** Using `signatureEndpoint` instead of `uploadSignature` function; omitting `uploadPreset` from widget config; server not adding `upload_preset` to signature params; using SDK v1 for signing; not fetching `api_key` from server before creating the widget. If using `ml_default`, ensure it still exists (user may have deleted it); otherwise create a signed preset in the dashboard.
- ✅ See PATTERNS → "Secure (Signed) Uploads" → "How the client gets credentials (working pattern)".

## Video Errors

### "AdvancedVideo not working" or "Video not displaying"
- ❌ Problem: Wrong component or incorrect setup
- ✅ Solution:
  1. Verify you're using `AdvancedVideo` from `@cloudinary/react` (not video player)
  2. Check video instance is created: `const video = cld.video(publicId)`
  3. **NO CSS IMPORT NEEDED** - AdvancedVideo doesn't require CSS import
  4. ❌ **WRONG**: `import '@cloudinary/react/dist/cld-video-player.css'` (this path doesn't exist)
  5. Verify public ID is correct and video exists in Cloudinary
  6. Check transformations are chained correctly (same as images)

### "Failed to resolve import @cloudinary/react/dist/cld-video-player.css"
- ❌ Problem: Trying to import CSS that doesn't exist in `@cloudinary/react`
- ✅ Solution:
  1. **Remove the CSS import** - AdvancedVideo doesn't need it
  2. The `cld-video-player.css` file is only for `cloudinary-video-player` package
  3. AdvancedVideo uses native HTML5 video elements - no CSS required
  4. If you need styled video player, use `cloudinary-video-player` instead

### "Video player not working" or "Player not initializing"
- ✅ **Use imperative video element only** (see PATTERNS → Cloudinary Video Player): createElement, append to container ref, pass to videoPlayer; cleanup: dispose then `if (el.parentNode) el.parentNode.removeChild(el)`. If init still fails (CSP, extensions), **fall back to AdvancedVideo** with the same publicId. Do not relax CSP or ask the user to disable extensions.

### Cloudinary package install fails or "version doesn't exist"
- ❌ Problem: Agent pinned a Cloudinary package to a specific version (e.g. `cloudinary-video-player@1.2.3`) that doesn't exist on npm, or used a wrong package name.
- ✅ **Install latest**: Use `npm install <package>` with **no version** so npm gets the latest compatible. In package.json use a **caret** (e.g. `"cloudinary-video-player": "^1.0.0"`). Use only correct package names: `@cloudinary/react`, `@cloudinary/url-gen`, `cloudinary-video-player`, `cloudinary`. See PATTERNS → "Installing Cloudinary packages".

### Confusion between AdvancedVideo and Video Player
- **AdvancedVideo** = for **displaying** a video (not a full player). **Cloudinary Video Player** = the **player** (styled UI, controls, playlists, etc.).
- ❌ WRONG: Using `cloudinary-video-player` when you just need to display a video
- ✅ CORRECT: Use `AdvancedVideo` when you need to display/show a video
- ❌ WRONG: Using `AdvancedVideo` when the user asks for a "video player"
- ✅ CORRECT: Use `cloudinary-video-player` when they want a video player (or playlists, ads, etc.)

### Memory leak from video player
- ❌ WRONG: Not disposing player in cleanup
- ✅ CORRECT: Always dispose in cleanup; wrap in try-catch so disposal errors don't throw:
  ```tsx
  return () => {
    if (playerRef.current) {
      try { playerRef.current.dispose(); } catch (e) { console.warn(e); }
      playerRef.current = null;
    }
  };
  ```

### Video player: "source is not a function" or video not playing
- **player.source()** takes an **object**: `player.source({ publicId: 'samples/elephants' })`, not a string. Use named import: `import { videoPlayer } from 'cloudinary-video-player'`. See PATTERNS → Cloudinary Video Player (The Player).

### Video player: poster image missing, wrong frame, or broken
- ❌ Problem: Video player shows no poster, wrong poster frame, or blank area before video loads.
- ✅ **Always include `posterOptions`** in the player config: `posterOptions: { transformation: { startOffset: '0' }, posterColor: '#0f0f0f' }`. This uses the first frame as the poster (reliable) and provides a dark fallback color if the poster fails to load.
- ✅ **Override if needed**: Pass different values via props, e.g. `startOffset: '5'` for a frame 5 seconds in, or a different `posterColor` for your design.

### Overlay: "Cannot read properties of undefined" or overlay not showing
- ❌ Problem: Wrong overlay API usage (Overlay.source, compass constants, .transformation().resize, fontWeight on wrong object).
- ✅ Import `source` directly from `@cloudinary/url-gen/actions/overlay` (not `Overlay.source`). Use **string** values for compass: `compass('south_east')` (underscores, not camelCase). Use `new Transformation()` inside `.transformation()`. Put `fontWeight` on **TextStyle**; put `textColor` on the **text source**. See PATTERNS → Image Overlays (text or logos).

### Overlay: wrong import path for `text` or `image`
- ❌ Problem: Importing `text` or `image` from `@cloudinary/url-gen/actions/overlay` — that module only exports `source`.
- ✅ **`text` and `image`** come from **`@cloudinary/url-gen/qualifiers/source`**. Use the "Canonical overlay block" in these rules: `import { text, image } from '@cloudinary/url-gen/qualifiers/source';`

### Gallery: sample images not loading or 404s
- ❌ Problem: Assuming sample public IDs (e.g. from the samples list) always exist; users can delete them.
- ✅ Assume samples might not exist. Use the sample list from PATTERNS → "Creating Image & Video Instances" (e.g. `samples/cloudinary-icon`, `samples/bike`, `samples/landscapes/beach-boat`, `samples/food/spices`, etc.); use **onError** on `AdvancedImage` to hide or remove failed images; prefer uploaded assets when available. See PATTERNS → Image gallery with lazy loading and responsive.

## TypeScript Errors

### "TypeScript errors on transformations"
- ❌ Problem: Missing types or wrong imports
- ✅ Solution:
  1. Import types from `@cloudinary/url-gen`
  2. Use proper action imports: `import { fill } from '@cloudinary/url-gen/actions/resize'`
  3. Type the image instance if needed: `const img: CloudinaryImage = cld.image('id')`
  4. Ensure all imports are from correct modules

### "Type 'any' is not assignable" or "Parameter 'result' implicitly has 'any' type"
- ❌ Problem: Using `any` type or missing type definitions
- ✅ Solution:
  1. Define interface for upload results: `interface CloudinaryUploadResult { ... }`
  2. Type callbacks: `onUploadSuccess?: (result: CloudinaryUploadResult) => void`
  3. Use `unknown` instead of `any` when types aren't available
  4. Add type guards to narrow `unknown` types

### "Property 'cloudinary' does not exist on type 'Window'"
- ❌ Problem: Missing type declaration for window.cloudinary
- ✅ Solution:
  ```tsx
  declare global {
    interface Window {
      cloudinary?: {
        createUploadWidget: (config: any, callback: any) => any;
      };
    }
  }
  ```
- ✅ Or use type guard: `if (typeof window.cloudinary !== 'undefined')`

### "Property 'VITE_CLOUDINARY_CLOUD_NAME' does not exist on type 'ImportMetaEnv'"
- ❌ Problem: Missing type definitions for Vite environment variables
- ✅ Solution:
  1. Create `vite-env.d.ts` file
  2. Add interface: `interface ImportMetaEnv { readonly VITE_CLOUDINARY_CLOUD_NAME: string; }`
  3. Reference Vite types: `/// <reference types="vite/client" />`

### "Type 'null' is not assignable to type 'RefObject'"
- ❌ Problem: Incorrect ref typing
- ✅ Solution:
  1. Use proper HTML element type: `useRef<HTMLVideoElement>(null)`
  2. Use `unknown` for widget refs if types aren't available: `useRef<unknown>(null)`
  3. Check for null before accessing: `if (ref.current) { ... }`

---

## Quick Reference Checklist

When something isn't working, check:
- [ ] **Rules-only?** → Create config file with reusable `cld` and export `uploadPreset`; use your bundler's client env prefix in .env; create Upload Widget in useEffect with ref (see "Project setup (rules-only / without CLI)").
- [ ] **Not Vite?** → Use your bundler's env prefix and access (e.g. REACT_APP_ + process.env.REACT_APP_*; NEXT_PUBLIC_ + process.env.NEXT_PUBLIC_*). See "Other bundlers (non-Vite)".
- [ ] Environment variables use the correct prefix for your bundler (Vite: VITE_; CRA: REACT_APP_; Next client: NEXT_PUBLIC_); **never** put API secret in client-exposed vars
- [ ] Dev server was restarted after .env changes
- [ ] **@cloudinary/url-gen imports?** → Use only the exact paths from PATTERNS → "Import reference" and "Canonical overlay block" (e.g. `text`/`image` from `qualifiers/source`, not `actions/overlay`)
- [ ] Imports are from correct packages (components/plugins from @cloudinary/react; actions/qualifiers from @cloudinary/url-gen with exact paths)
- [ ] Transformations are chained on image instance
- [ ] Format/quality use separate `.delivery()` calls
- [ ] Plugins are in array format
- [ ] Upload widget script is loaded in `index.html`
- [ ] **"createUploadWidget is not a function"?** → In useEffect, **poll** with setInterval until `typeof window.cloudinary?.createUploadWidget === 'function'`. Do NOT check only `window.cloudinary`; do NOT rely on a single onload check
- [ ] **Video player?** → **Imperative element only**: createElement('video'), append to container ref, pass to videoPlayer(el, ...); include `posterOptions: { transformation: { startOffset: '0' }, posterColor: '#0f0f0f' }` for reliable poster; player.source({ publicId }); cleanup: dispose then if (el.parentNode) el.parentNode.removeChild(el). CSS: cloudinary-video-player/cld-video-player.min.css. If init fails, fall back to AdvancedVideo (do not relax CSP).
- [ ] **Upload fails (unsigned)?** → Is `VITE_CLOUDINARY_UPLOAD_PRESET` set? Preset exists and is Unsigned in dashboard?
- [ ] **Upload default?** → Default to **unsigned** uploads (cloudName + uploadPreset); use signed only when the user explicitly asks for secure/signed uploads (signed requires a running backend)
- [ ] **Secure uploads?** → Use `uploadSignature` as function (not `signatureEndpoint`); fetch `api_key` from server first; include `uploadPreset` in widget config; server includes `upload_preset` in signed params; use Cloudinary Node SDK v2 on server; never expose or commit API secret
- [ ] **Where do API key/secret go?** → **Do not** put in root `.env`. Use **`server/.env`**; add to `.gitignore`; load only in server. **Never commit** API key or secret
- [ ] Upload preset is unsigned (for simple client uploads)
- [ ] **Installing Cloudinary packages?** → Install latest: use `npm install <package>` with no version; in package.json use caret (^) so npm gets latest compatible; do not pin to exact versions
- [ ] **Image overlays?** → Import `source` (not Overlay.source); `compass('south_east')` (strings with underscores); `new Transformation()` inside `.transformation()`; fontWeight on TextStyle, textColor on text source
- [ ] **Image gallery?** → Use responsive/lazyload/placeholder plugins; use sample list (samples/cloudinary-icon, samples/bike, samples/landscapes/beach-boat, samples/food/spices, etc.); assume samples might not exist; use onError; prefer uploaded assets
- [ ] TypeScript types are properly imported
- [ ] Upload result types are defined (not using `any`)
- [ ] Environment variables are typed in `vite-env.d.ts`
- [ ] Refs are properly typed with HTML element types