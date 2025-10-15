# Welcome to your Dream Team Services project

## Project info

**URL**: https://dreamteamservices.com/projects/timepass-social

## How can I edit this code?

There are several ways of editing your application.

**Use Dream Team Services**

Simply visit the [Dream Team Services Project](https://dreamteamservices.com/projects/timepass-social) and start prompting.

Changes made via Dream Team Services will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Dream Team Services.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## 🔧 Firebase Storage CORS Fix

If you're experiencing CORS errors when uploading stories or images:

1. **Quick Fix (Windows):** Run the automated script:
   ```powershell
   .\apply-cors-fix.ps1
   ```

2. **Manual Fix:** Follow the detailed guide in [FIREBASE_CORS_FIX.md](./FIREBASE_CORS_FIX.md)

This will configure Firebase Storage to accept uploads from localhost and your deployed domain.

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Dream Team Services](https://dreamteamservices.com/projects/timepass-social) and click on Share -> Publish.

## Can I connect a custom domain to my Dream Team Services project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.dreamteamservices.com/features/custom-domain#custom-domain)
