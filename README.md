# Football Player Kit Registration

A complete, modern, and easy-to-deploy registration website for a football team. Built with HTML, CSS, JavaScript, and Firebase. No custom backend server required. Ready to be deployed on Vercel.

## Features

- **Player Registration:** Clean form with Kit Number availability check.
- **Duplicate Protection:** Live frontend checks + Database-level transactional protection to ensure no two players can register the same kit number.
- **Admin Dashboard:** Protected by Firebase Authentication.
- **Manage Players:** View, search, edit, delete players, and export to CSV.
- **Responsive:** Works perfectly on mobile and desktop.

## Setup Instructions

### 1. Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** and follow the steps.

### 2. Enable Firestore Database
1. In your Firebase project, go to **Build > Firestore Database**.
2. Click **Create database**.
3. Start in **Production mode**.
4. Choose a location and click **Enable**.

### 3. Add Firestore Security Rules
1. Go to the **Rules** tab in your Firestore Database.
2. Replace the default rules with the contents of the `firestore.rules` file in this project:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /players/{kitNumber} {
         allow get: if true;
         allow list: if request.auth != null;
         allow create: if request.resource.data.kitNumber == int(kitNumber) && !exists(/databases/$(database)/documents/players/$(kitNumber));
         allow update, delete: if request.auth != null;
       }
     }
   }
   ```
3. Click **Publish**.

### 4. Enable Firebase Authentication
1. Go to **Build > Authentication**.
2. Click **Get started**.
3. Go to the **Sign-in method** tab.
4. Enable **Email/Password** (leave "Email link" disabled) and save.

### 5. Create the Admin Account
1. Go to the **Users** tab in Firebase Authentication.
2. Click **Add user**.
3. Enter an email (e.g., `admin@yourteam.com`) and a secure password.
4. Click **Add user**. This is the account you will use to log into the `/admin-login` page.

### 6. Add Firebase Configuration
1. Go to **Project Overview**, click the Web icon (`</>`) to add a web app.
2. Register the app (you don't need Firebase Hosting).
3. Copy the `firebaseConfig` object.
4. In this project, create a `.env` file in the root folder (next to `package.json`):
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

### 7. Run Locally
1. Ensure you have [Node.js](https://nodejs.org/) installed.
2. Open your terminal in the project folder and run:
   ```bash
   npm install
   npm run dev
   ```
3. Open the local URL provided in the terminal (usually `http://localhost:5173`).

### 8. Deploy to Vercel
1. Push your code to a GitHub repository.
2. Go to [Vercel](https://vercel.com/) and import your repository.
3. In the **Environment Variables** section on Vercel, add all the `VITE_FIREBASE_...` variables from your `.env` file.
4. Click **Deploy**. Vercel will automatically detect the Vite build settings.

## Folder Structure
- `/index.html`: Player Registration Page
- `/admin-login/index.html`: Admin Login Page
- `/admin/index.html`: Admin Dashboard
- `/src/`: JavaScript logic and CSS styles
