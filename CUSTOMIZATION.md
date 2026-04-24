# Campus Name Configuration

Change these files to customize your website for your specific college:

## 1. Change College Name

### In index.html (line ~9):

```html
<h1 class="logo">📍 Campus Lost & Found</h1>
```

Change to:

```html
<h1 class="logo">📍 [Your College Name] Lost & Found</h1>
```

### In index.html (line ~6):

```html
<title>Campus Lost & Found</title>
```

Change to:

```html
<title>[Your College Name] Lost & Found</title>
```

## 2. Add College Logo (Optional)

In `index.html` after `<h1 class="logo">`, add:

```html
<img
  src="https://your-college-logo-url.com/logo.png"
  alt="College Logo"
  style="height: 40px; margin-left: 10px;"
/>
```

## 3. Customize Colors

Edit `style.css` lines 6-12:

```css
:root {
  --primary: #4f46e5; /* Main color (blue) */
  --primary-dark: #4338ca; /* Darker shade */
  --secondary: #10b981; /* Match/success color (green) */
  --danger: #ef4444; /* Delete/alert color (red) */
  --light: #f9fafb; /* Background color */
  --dark: #1f2937; /* Text color */
  --border: #e5e7eb; /* Border color */
}
```

Popular color combinations:

- **Red & White**: primary: #dc2626, secondary: #ef4444
- **Green & White**: primary: #059669, secondary: #10b981
- **Purple & White**: primary: #7c3aed, secondary: #8b5cf6
- **Orange & White**: primary: #ea580c, secondary: #f97316

## 4. Add Contact Email

Add this at bottom of `index.html` before closing `</body>`:

```html
<footer
  style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; margin-top: 40px;"
>
  <p>
    Have questions? Contact us at: <strong>contact@yourcollegename.edu</strong>
  </p>
  <p>Made for [Your College Name] Community | © 2024</p>
</footer>
```

## 5. Configure Firebase for Your College

Follow [FIREBASE_SETUP.md](FIREBASE_SETUP.md) to:

1. Create Firebase project
2. Get your config
3. Add to `app.js` (lines 23-30)

## 6. Add College Info to Website

Add this in `index.html` sidebar before the form:

```html
<aside class="sidebar">
  <div
    style="background: #f0f9ff; padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 13px;"
  >
    <p><strong>📍 Location:</strong> [Your Building/Campus Name]</p>
    <p><strong>📧 Support:</strong> support@yourcollegename.edu</p>
  </div>
  <h2>Post an Item</h2>
  ...
</aside>
```

## Example: Complete Customization

Before:

```
📍 Campus Lost & Found
[Post Form]
```

After:

```
📍 Harvard Lost & Found
📍 Location: Harvard University
📧 Support: lostnfound@harvard.edu
[Post Form]
```

## 7. Add College-Specific Locations

Update location suggestions in `index.html`:

```html
<input
  type="text"
  id="location"
  placeholder="e.g., Library, Cafeteria, Building A"
/>
```

Change to:

```html
<input
  type="text"
  id="location"
  placeholder="e.g., Main Library, Student Center, Science Building"
/>
```

Or create a dropdown:

```html
<select id="location">
  <option value="">Select location...</option>
  <option value="main-library">Main Library</option>
  <option value="student-center">Student Center</option>
  <option value="science-building">Science Building</option>
  <option value="dining-hall">Dining Hall</option>
</select>
```

## 8. Share with Your College

After deployment, share this link:

```
https://YOUR_USERNAME.github.io/campus-lost-found
```

Send to:

- College email groups
- Whatsapp/Discord servers
- Social media
- Bulletin boards
- Student organization groups

## Deployment Commands

After making changes:

```bash
git add .
git commit -m "Customize for [Your College Name]"
git push
```

Changes will appear in 1-2 minutes!

## More Customization Ideas

- Add college logo
- Add college colors
- Add college email domain
- Add location options specific to your college
- Add college name to all text
- Create custom favicon
- Add college address/hours
- Add college emergency contact

That's it! Your website is now branded for your college! 🎓
