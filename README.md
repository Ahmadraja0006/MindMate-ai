# MindMate AI — Mobile App (Expo)

Native Android/iOS version of the MindMate AI SIH26003 concept.

## Included
- Elderly-friendly blue/white mobile UI
- English/Hindi language switch
- Login/role selection
- Memory Match, Object Recall, Pattern Recognition and Attention Game
- Real scoring + bounded adaptive difficulty
- Progress tracking
- Memory Assistant / routine reminders
- Voice read-out with Expo Speech
- Local reminder notifications
- Offline session queue using AsyncStorage
- Backend API integration when `EXPO_PUBLIC_API_URL` is configured
- Caregiver dashboard prototype
- SIH26003 medical-safety disclaimer

## Run locally

Requirements: Node.js 22.13+ for Expo SDK 57.

```bash
npm install
npx expo start
```

Install Expo Go on an Android phone and scan the QR code for the fastest preview. For notification/native testing, use an EAS development or preview build.

## Build an installable APK

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

The `preview` profile creates an APK for direct device installation.

## Build Google Play version

```bash
eas build --platform android --profile production
```

Production Android builds are AAB files for Google Play.

## Backend connection

The `backend/` folder is included in this package, so the mobile app and the original Express/PostgreSQL API are kept together.

Start the backend from its folder with `npm install`, copy `.env.example` to `.env`, then run `npm run db:init`, `npm run db:seed`, and `npm run dev`. The default backend port is `5000`.



Copy `.env.example` to `.env` and set:

```text
EXPO_PUBLIC_API_URL=http://YOUR-PC-IP:4000/api
```

Start the existing MindMate backend first. A physical phone must be able to reach the PC over the same network.

## Demo login

- Elderly: `ramesh.demo@mindmate.local`
- Caregiver: `caregiver.demo@mindmate.local`
- Admin: `admin.demo@mindmate.local`
- Password: `Demo@12345`

If the backend is unavailable, the app still runs in local demo/offline mode.
