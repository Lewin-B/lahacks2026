# water-grid-frontend

A Cloudinary React + Vite + TypeScript project scaffolded with [create-cloudinary-react](https://github.com/cloudinary-devs/create-cloudinary-react).

## Prerequisites

- **Node.js** — use a current LTS release. Supported ranges are listed under `engines` in this `package.json`.

## Quick Start

```bash
npm run dev
```

## Cloudinary Setup

This project uses Cloudinary for image management. If you don't have a Cloudinary account yet:
- [Sign up for free](https://cld.media/reactregister)
- Find your cloud name in your [dashboard](https://console.cloudinary.com/app/home/dashboard)

## Environment Variables

Your `.env` file has been pre-configured with:
- `VITE_CLOUDINARY_CLOUD_NAME`: dxsohghtt
- `VITE_CLOUDINARY_UPLOAD_PRESET`: water_grid_uploads

**Note**: Transformations work without an upload preset (using sample images). Uploads require an unsigned upload preset.

To create an unsigned upload preset:
1. Go to https://console.cloudinary.com/app/settings/upload/presets
2. Click "Add upload preset"
3. Set it to "Unsigned" mode
4. Add the preset name to your `.env` file
5. **Save** the `.env` file and restart the dev server so the new values load correctly.


## AI Assistant Support

This project includes AI coding rules for your selected AI assistant(s). The rules help AI assistants understand Cloudinary React SDK patterns, common errors, and best practices.

**Try the AI Prompts**: Check out the "🤖 Try Asking Your AI Assistant" section in the app for ready-to-use Cloudinary prompts! Copy and paste them into your AI assistant to get started.

## Learn More

- [Cloudinary React SDK Docs](https://cloudinary.com/documentation/react_integration)
- [Vite Documentation](https://vite.dev)
- [React Documentation](https://react.dev)
