# GitHub Pages Deployment Guide

Deploy your Lost & Found website to GitHub Pages for FREE!

## Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click **"+"** (top right) → **"New repository"**
3. Name: `campus-lost-found` (or any name you want)
4. Set to **Public** (required for free GitHub Pages)
5. Add README.md
6. Click **"Create repository"**

## Step 2: Push Your Code to GitHub

### Using Git Terminal (Recommended)

```bash
# Navigate to your project folder
cd /Users/varshithreddy/lost-found-site

# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Lost and Found website"

# Add remote (replace USERNAME and REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/campus-lost-found.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Using GitHub Desktop (Easier)

1. Download [GitHub Desktop](https://desktop.github.com/)
2. Click **"File"** → **"Clone repository"**
3. Select your repository
4. Click **"Clone"**
5. Make sure your files are there
6. The website will auto-update on GitHub

## Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **"Settings"** (top menu)
3. Click **"Pages"** (left sidebar)
4. Under **"Source"**, select:
   - Branch: **main**
   - Folder: **/ (root)**
5. Click **"Save"**
6. Wait 1-2 minutes...

Your site is now live! 🎉

**Your website URL will be:**

- `https://YOUR_USERNAME.github.io/campus-lost-found`

(Replace YOUR_USERNAME with your GitHub username)

## Step 4: Test Your Website

1. Visit: `https://YOUR_USERNAME.github.io/campus-lost-found`
2. The website should load with your domain name
3. If not loading, wait 2-3 more minutes for GitHub to build it

## Step 5: Share Your Website

Your website is now public! Share the link with:

- Your college friends
- Your college community
- Email/social media

**Example link:** `https://varshithreddy.github.io/campus-lost-found`

## How to Update Your Website

### Option 1: Via Terminal

```bash
cd /Users/varshithreddy/lost-found-site
git add .
git commit -m "Update website"
git push
```

Changes appear in 30 seconds to 2 minutes.

### Option 2: Via GitHub Website

1. Go to your repository
2. Click on a file
3. Click ✏️ (pencil icon)
4. Make changes
5. Click **"Commit changes"**
6. Changes appear in 30 seconds to 2 minutes

## Important: Update Your Domain in Firebase

If you're using Google authentication later, add your GitHub Pages URL to Firebase:

1. Firebase Console → Settings → Authorized domains
2. Add: `YOUR_USERNAME.github.io`

## Custom Domain (Optional)

If you have your own domain (like lostfound.com):

1. Go to your domain registrar (GoDaddy, Namecheap, etc.)
2. Add GitHub Pages DNS records
3. GitHub Settings → Pages → Custom domain
4. Enter your domain
5. Wait 24 hours for DNS to update

More info: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site

## Troubleshooting

### Website not loading

- Wait 2-3 minutes after enabling Pages
- Check URL is correct (check your GitHub username)
- Go to Settings → Pages and verify branch is "main"

### Firebase auth not working

- Check if `app.js` has correct Firebase config
- Add your GitHub Pages URL to Firebase authorized domains
- Check browser console (F12) for errors

### Changes not showing up

- Wait 1-2 minutes after pushing
- Hard refresh browser (Ctrl+F5 or Cmd+Shift+R)

## File Structure for GitHub Pages

Your repository should have:

```
campus-lost-found/
  ├── index.html
  ├── app.js
  ├── style.css
  ├── README.md
  ├── FIREBASE_SETUP.md
  └── GITHUB_PAGES_SETUP.md
```

All these files should be in the **root** of the repository, not in any subfolder.

## Security Notes

✅ **Your website is public** - anyone can access it
✅ **Your Firebase config is visible** - this is normal (Firebase keys are meant to be public)
✅ **GitHub Pages is 100% FREE** - no hidden costs
✅ **Your data is private** - stored securely in Firebase

That's it! You now have a free, live website! 🚀

## Next Steps

1. ✅ Set up Firebase (see FIREBASE_SETUP.md)
2. ✅ Deploy to GitHub Pages (this file)
3. Share with your college community!
4. Customize further (colors, features, etc.)

Questions? Check:

- GitHub Pages Docs: https://pages.github.com/
- Firebase Docs: https://firebase.google.com/docs
