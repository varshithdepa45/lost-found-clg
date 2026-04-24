# Firebase Setup Guide for Campus Lost & Found

This guide will walk you through setting up Firebase for your lost-and-found website.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter project name: `campus-lost-found`
4. Click **"Continue"**
5. Disable Google Analytics (optional)
6. Click **"Create project"**

Wait 2-3 minutes for the project to be created.

## Step 2: Enable Firestore Database

1. In the Firebase Console, click your project
2. Go to **"Build"** → **"Firestore Database"**
3. Click **"Create database"**
4. Select **"Start in test mode"** (for development)
   - ⚠️ **For production**: Later, change security rules to restrict access
5. Choose location closest to your college
6. Click **"Create"**

## Step 3: Enable Authentication

1. Go to **"Build"** → **"Authentication"**
2. Click **"Get started"**
3. Click **"Email/Password"**
4. Toggle **"Enable"** and click **"Save"**

## Step 4: Get Firebase Config

1. Go to **"Project Settings"** (click gear icon)
2. Click **"Your apps"** or scroll to bottom
3. Click **"</>Web"** to add a web app
4. Register app as: `campus-lost-found`
5. Copy the config object that looks like:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD...",
  authDomain: "campus-lost-found.firebaseapp.com",
  projectId: "campus-lost-found",
  storageBucket: "campus-lost-found.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123...",
};
```

## Step 5: Add Config to Your Website

1. Open `app.js` in your editor
2. Find this section:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

3. Replace it with your actual config from Step 4

## Step 6: Create Firestore Rules (Important for Security)

### For Development (Test Mode - Anyone can read/write):

Firestore → Rules → Replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /items/{document=**} {
      allow read, write: if true;
    }
  }
}
```

### For Production (Recommended Later):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /items/{document=**} {
      allow read: if true;
      allow create, update, delete: if request.auth != null;
    }
  }
}
```

Click **"Publish"** after updating rules.

## Step 7: Test Your Setup

1. Open your website in browser
2. Try signing up with an email
3. Try posting an item
4. Check Firebase Console → Firestore → "items" collection
5. You should see your posted item!

## Troubleshooting

### Issue: "CORS error" or connection fails

- Make sure you added the correct Firebase config
- Check that your website URL is in Firebase Auth settings (optional for GitHub Pages)

### Issue: Can't save data

- Check Firestore Rules are published
- Make sure Authentication is enabled
- Verify projectId matches in config

### Issue: Too many failed login attempts

- This is normal Firebase protection
- Wait 15 minutes before trying again

## Free Tier Limits

- **Firestore**: 1 GB storage, 50K reads/day (FREE FOREVER)
- **Authentication**: No read limits (FREE FOREVER)
- **This site easily fits within free limits!**

## Need Help?

- Firebase Docs: https://firebase.google.com/docs
- Firestore Issues: https://firebase.google.com/support
- Common Issues: Check browser console (F12) for error messages

## Security Tips

🔒 **Never commit your Firebase config to GitHub with real keys**

- Use environment variables for production
- Your apiKey is somewhat exposed on client side (normal for Firebase)
- Real security comes from Firestore Rules

That's it! Your website is now connected to Firebase. 🎉
