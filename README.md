# 📍 Campus Lost & Found

A free, open-source platform for college students to post and find lost items within their campus community.

**Live Demo:** `https://YOUR_USERNAME.github.io/campus-lost-found` (after deployment)

## Features ✨

- **Post Lost Items** - Describe what you lost with location and date
- **Post Found Items** - Tell the community about items you found
- **Automatic Matching** - System notifies when a lost + found item matches
- **User Authentication** - Sign up and track your own posts
- **Smart Search** - Filter by item type, category, or keywords
- **Contact Exchange** - Safely view and contact item posters
- **Responsive Design** - Works on desktop, tablet, and mobile
- **100% Free** - Hosted on GitHub Pages, data stored in Firebase

## Quick Start 🚀

### Option 1: Deploy in 5 Minutes (Recommended)

1. **Fork this repository** on GitHub
2. **Enable GitHub Pages** (Settings → Pages → Branch: main)
3. **Set up Firebase** (follow [FIREBASE_SETUP.md](FIREBASE_SETUP.md))
4. Done! Your site is live at `https://YOUR_USERNAME.github.io/campus-lost-found`

### Option 2: Run Locally

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/campus-lost-found.git
cd campus-lost-found

# Set up Firebase config in app.js
# Edit: const firebaseConfig = { ... }

# Open in browser
open index.html
```

## Setup Instructions 📋

### 1. Firebase Setup (REQUIRED)

- Complete guide: [FIREBASE_SETUP.md](FIREBASE_SETUP.md)
- Takes ~10 minutes
- Free tier is enough for your college

### 2. GitHub Pages Deployment (FREE HOSTING)

- Complete guide: [GITHUB_PAGES_SETUP.md](GITHUB_PAGES_SETUP.md)
- Takes ~5 minutes
- No costs, no ads, no limits

## How It Works 🔄

### For Lost Items:

1. Click **"Post an Item"** (left sidebar)
2. Select "Lost"
3. Fill in details: item name, location, date, description
4. Click **"📤 Post Item"**
5. Your post appears in the list
6. If someone finds it, they'll contact you!

### For Found Items:

1. Click **"Post an Item"**
2. Select "Found"
3. Describe what you found
4. Click **"📤 Post Item"**
5. System automatically matches with lost items
6. Get notified when someone claims it!

## Website Structure 📁

```
📁 campus-lost-found/
  ├── 📄 index.html              # Main website
  ├── 📄 app.js                  # Firebase & logic
  ├── 📄 style.css               # Styling
  ├── 📄 README.md               # This file
  ├── 📄 FIREBASE_SETUP.md       # Firebase guide
  └── 📄 GITHUB_PAGES_SETUP.md  # Deployment guide
```

## Technology Stack 🛠️

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Firebase (Firestore + Auth)
- **Hosting**: GitHub Pages (Free)
- **Browser Support**: Chrome, Firefox, Safari, Edge

## Cost Breakdown 💰

| Service       | Cost     | Notes                                     |
| ------------- | -------- | ----------------------------------------- |
| GitHub Pages  | **FREE** | Unlimited hosting                         |
| Firebase      | **FREE** | 50K reads/day, 1GB storage (Free Forever) |
| Custom Domain | Optional | If you buy one ($5-15/year)               |
| **Total**     | **$0**   | Completely free!                          |

## Features Breakdown 🎯

### User Authentication

- Sign up with email & password
- Sign in to manage your posts
- Each user can track their own items

### Smart Matching

- Automatically detects lost ↔ found matches
- Notifies users of potential matches
- Matches on item name, location, and description

### Search & Filter

- Search by item name or description
- Filter by type (Lost/Found)
- Filter by category (Electronics, Documents, etc.)
- Sort by date posted

### Contact System

- View poster's contact info safely
- Phone number & email exchange
- Copy contact to clipboard
- Never shares info without consent

### Dashboard

- View your own posts
- Delete posts anytime
- See which items have matches

## Customization 🎨

### Change Colors

Edit `style.css`:

```css
:root {
  --primary: #4f46e5; /* Change this color */
  --secondary: #10b981; /* And this one */
  --danger: #ef4444; /* And this one */
}
```

### Change Site Name

Edit `index.html`:

```html
<h1 class="logo">📍 Campus Lost & Found</h1>
<!-- Change text -->
<title>Campus Lost & Found</title>
<!-- Change title -->
```

### Add College Name

In `index.html`, change:

```html
<h1 class="logo">📍 [Your College Name] Lost & Found</h1>
```

## Security & Privacy 🔒

- **Passwords**: Hashed by Firebase (industry standard)
- **Contact Info**: Only shown when clicking "View Contact"
- **Firebase Config**: Visible in code (normal & safe for Firebase)
- **Firestore Rules**: Allows read-access to everyone, write-access to authenticated users
- **HTTPS**: All data encrypted in transit

## Firestore Security Rules

Update these based on your needs:

```javascript
// Allow anyone to read and write (Development)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /items/{document=**} {
      allow read, write: if true;
    }
  }
}

// OR: Only authenticated users can post (Production)
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

## Troubleshooting 🐛

### Website not loading?

- Check browser console (F12) for errors
- Verify Firebase config in app.js
- Wait 2-3 minutes after deploying to GitHub Pages

### Can't post items?

- Sign in first if you have auth enabled
- Fill in all required fields
- Check browser console for error messages

### Changes not showing?

- Hard refresh (Cmd+Shift+R or Ctrl+F5)
- Wait 1-2 minutes for deployment
- Clear browser cache

### Firebase errors?

- Follow [FIREBASE_SETUP.md](FIREBASE_SETUP.md)
- Check Firestore Rules are published
- Verify all config values match Firebase Console

## Contributing 🤝

Found a bug? Want to improve?

- Fork the repository
- Make your changes
- Submit a Pull Request
- Include description of changes

## Future Features (Ideas) 💡

- ✨ Image uploads for items
- 💬 Built-in messaging system
- 📧 Email notifications
- 🗺️ Interactive map view
- 📱 Mobile app version
- 🔔 Push notifications
- 🏆 Verified badges
- 🌍 Multi-college support

## Deployment Checklist ✅

- [ ] Fork repository on GitHub
- [ ] Update Firebase config in app.js
- [ ] Set up Firestore & Auth in Firebase
- [ ] Enable GitHub Pages
- [ ] Test website loads
- [ ] Create Firebase collection "items"
- [ ] Test posting an item
- [ ] Verify matches work
- [ ] Share with college community

## Support & Help 💬

**Need help?** Check:

1. [FIREBASE_SETUP.md](FIREBASE_SETUP.md) - Firebase questions
2. [GITHUB_PAGES_SETUP.md](GITHUB_PAGES_SETUP.md) - Deployment questions
3. Browser Console (F12) - Error messages
4. Firebase Docs - https://firebase.google.com/docs
5. GitHub Pages Docs - https://pages.github.com/

## License 📜

This project is open source. Use it for:

- Your college
- Other colleges
- Your own community
- Commercial purposes

No attribution needed!

## Credits 👏

Built with:

- Firebase (Google)
- GitHub Pages (GitHub)
- Modern Web Technologies

## Roadmap 🗺️

- [x] Post lost/found items
- [x] User authentication
- [x] Search & filter
- [x] Automatic matching
- [x] Contact exchange
- [x] Mobile responsive
- [ ] Image uploads
- [ ] Direct messaging
- [ ] Email notifications
- [ ] Advanced analytics

---

**Ready to get started?** Follow these steps:

1. 📖 Read [FIREBASE_SETUP.md](FIREBASE_SETUP.md)
2. 🚀 Read [GITHUB_PAGES_SETUP.md](GITHUB_PAGES_SETUP.md)
3. 🎉 Launch your site!

**Questions?** Open an issue on GitHub!

**Enjoy your Lost & Found platform!** 📍✨
