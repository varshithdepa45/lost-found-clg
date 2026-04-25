import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
  apiKey: "AIzaSyBzaceNHFlq09fy6NDyRgcC93gPYLo0vhE",
  authDomain: "lost-found-clg.firebaseapp.com",
  projectId: "lost-found-clg",
  storageBucket: "lost-found-clg.firebasestorage.app",
  messagingSenderId: "335035491718",
  appId: "1:335035491718:web:0fc46d65558a627f26f807",
  measurementId: "G-FVDL55B1JH",
};

let app, db, auth;
try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  console.log("✅ Firebase initialized successfully!");
} catch (error) {
  console.error("❌ Firebase initialization error:", error);
}

// ==================== GLOBAL STATE ====================
let currentUser = null;
let allItems = [];
let selectedItemForContact = null;

// ==================== AUTHENTICATION ====================
function toggleAuth() {
  if (currentUser) {
    showMyPosts();
  } else {
    document.getElementById("authModal").classList.add("show");
  }
}

async function signUp() {
  const email = document.getElementById("authEmail").value;
  const password = document.getElementById("authPassword").value;

  if (!email || !password) {
    alert("Please fill in all fields");
    return;
  }

  try {
    console.log("Creating user...");
    const result = await createUserWithEmailAndPassword(auth, email, password);
    console.log("✅ User created:", result.user.email);
    alert("✅ Account created! You're now signed in.");
    closeAuthModal();
    updateUIForUser();
    loadAllData();
  } catch (error) {
    console.error("❌ Sign up error:", error);
    alert("Error: " + error.message);
  }
}

async function signIn() {
  const email = document.getElementById("authEmail").value;
  const password = document.getElementById("authPassword").value;

  if (!email || !password) {
    alert("Please fill in all fields");
    return;
  }

  try {
    console.log("Signing in...");
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log("✅ User signed in:", result.user.email);
    alert("✅ Signed in successfully!");
    closeAuthModal();
    updateUIForUser();
    loadAllData();
  } catch (error) {
    console.error("❌ Sign in error:", error);
    alert("Error: " + error.message);
  }
}

async function logout() {
  try {
    await signOut(auth);
    console.log("✅ User logged out");
    alert("Logged out successfully!");
    currentUser = null;
    updateUIForUser();
    loadAllData();
  } catch (error) {
    console.error("❌ Logout error:", error);
    alert("Error: " + error.message);
  }
}

function closeAuthModal() {
  document.getElementById("authModal").classList.remove("show");
  document.getElementById("authEmail").value = "";
  document.getElementById("authPassword").value = "";
}

function updateUIForUser() {
  const authBtn = document.getElementById("authBtn");
  const myPostsBtn = document.getElementById("myPostsBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userEmail = document.getElementById("userEmail");

  if (currentUser) {
    authBtn.classList.add("hidden");
    myPostsBtn.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    userEmail.value = currentUser.email;
  } else {
    authBtn.classList.remove("hidden");
    myPostsBtn.classList.add("hidden");
    logoutBtn.classList.add("hidden");
    userEmail.value = "";
  }
}

// ==================== DATA MANAGEMENT ====================
async function submitData() {
  const name = document.getElementById("name").value.trim();
  const userEmail = document.getElementById("userEmail").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const type = document.getElementById("type").value;
  const item = document.getElementById("item").value.trim();
  const description = document.getElementById("description").value.trim();
  const location = document.getElementById("location").value.trim();
  const date = document.getElementById("date").value;
  const photoFile = document.getElementById("photoFile").files[0];

  if (!name || !userEmail || !phone || !type || !item || !location || !date) {
    alert("Please fill in all required fields");
    return;
  }

  try {
    console.log("📝 Posting item:", item);
    let photoBase64 = null;

    // Convert photo to Base64 if provided
    if (photoFile) {
      console.log("📸 Converting photo to Base64...");
      photoBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(photoFile);
      });
      console.log("✅ Photo converted to Base64");
    }

    const docRef = await addDoc(collection(db, "items"), {
      name,
      email: userEmail,
      phone,
      type,
      item: item.toLowerCase(),
      itemOriginal: item,
      description,
      location: location.toLowerCase(),
      locationOriginal: location,
      date,
      category: categorizeItem(item),
      userId: currentUser ? currentUser.uid : "anonymous",
      photoData: photoBase64,
      createdAt: serverTimestamp(),
      viewed: false,
      matched: false,
    });
    console.log("✅ Item posted successfully! Doc ID:", docRef.id);
    alert("✅ Item posted successfully!");
    clearForm();
    loadAllData();
  } catch (error) {
    console.error("❌ Error posting item:", error);
    alert("Error: " + error.message);
  }
}

function clearForm() {
  document.getElementById("name").value = "";
  document.getElementById("phone").value = "";
  document.getElementById("type").value = "";
  document.getElementById("item").value = "";
  document.getElementById("description").value = "";
  document.getElementById("location").value = "";
  document.getElementById("date").value = "";
  document.getElementById("photoFile").value = "";
}

function categorizeItem(itemName) {
  const electronics = [
    "phone",
    "laptop",
    "tablet",
    "headphones",
    "charger",
    "watch",
  ];
  const documents = ["id", "license", "passport", "certificate", "card"];
  const accessories = [
    "wallet",
    "keys",
    "bag",
    "backpack",
    "scarf",
    "umbrella",
  ];
  const clothing = ["jacket", "shirt", "pants", "shoes", "hat", "coat"];

  const lower = itemName.toLowerCase();

  if (electronics.some((e) => lower.includes(e))) return "Electronics";
  if (documents.some((d) => lower.includes(d))) return "Documents";
  if (accessories.some((a) => lower.includes(a))) return "Accessories";
  if (clothing.some((c) => lower.includes(c))) return "Clothing";
  return "Other";
}

// ==================== DATA LOADING ====================
async function loadAllData() {
  try {
    console.log("📂 Loading data from Firestore...");
    const querySnapshot = await getDocs(collection(db, "items"));
    allItems = [];

    querySnapshot.forEach((docSnapshot) => {
      allItems.push({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      });
    });

    console.log(`✅ Loaded ${allItems.length} items from database`);

    allItems.sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return dateB - dateA;
    });

    filterItems();
    checkForMatches();
  } catch (error) {
    console.error("❌ Error loading data:", error);
    alert("Error loading data: " + error.message);
  }
}

// ==================== FILTERING & DISPLAY ====================
function filterItems() {
  const searchQuery = document
    .getElementById("searchInput")
    .value.toLowerCase();
  const typeFilter = document.getElementById("filterType").value;
  const categoryFilter = document.getElementById("filterCategory").value;

  let filtered = allItems;

  if (typeFilter !== "") {
    filtered = filtered.filter((item) => item.type === typeFilter);
  }

  if (categoryFilter !== "") {
    filtered = filtered.filter((item) => item.category === categoryFilter);
  }

  if (searchQuery !== "") {
    filtered = filtered.filter(
      (item) =>
        item.itemOriginal.toLowerCase().includes(searchQuery) ||
        item.description.toLowerCase().includes(searchQuery) ||
        item.locationOriginal.toLowerCase().includes(searchQuery),
    );
  }

  displayItems(filtered);
}

function displayItems(items) {
  const itemsContainer = document.getElementById("list");
  itemsContainer.innerHTML = "";

  if (items.length === 0) {
    itemsContainer.innerHTML = "<p>No items found</p>";
    return;
  }

  items.forEach((item) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "item-card";
    let photoHTML = "";
    if (item.photoData) {
      photoHTML = `<img src="${item.photoData}" alt="${item.itemOriginal}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 12px;">`;
    }
    itemDiv.innerHTML = `
      ${photoHTML}
      <h3>${item.itemOriginal}</h3>
      <p><strong>Type:</strong> ${item.type}</p>
      <p><strong>Category:</strong> ${item.category}</p>
      <p><strong>Location:</strong> ${item.locationOriginal}</p>
      <p><strong>Date:</strong> ${formatDate(item.date)}</p>
      <p>${item.description}</p>
      <div style="background: #f5f5f5; padding: 10px; border-radius: 6px; margin: 10px 0;">
        <p style="margin: 5px 0;"><strong>📝 Uploader:</strong> ${item.name}</p>
        <p style="margin: 5px 0;"><strong>📧 Email:</strong> ${item.email}</p>
        <p style="margin: 5px 0;"><strong>📱 Phone:</strong> ${item.phone}</p>
      </div>
      ${item.matched ? '<p style="color: green;"><strong>✅ Matched!</strong></p>' : ""}
      <button onclick="showContact('${item.id}', ${JSON.stringify(item).replace(/"/g, "&quot;")})">View Contact</button>
      ${currentUser && currentUser.uid === item.userId ? `<button onclick="deleteItem('${item.id}')">Delete</button>` : ""}
    `;
    itemsContainer.appendChild(itemDiv);
  });
}

// ==================== MATCHING ====================
function findMatchingItem(item) {
  return allItems.some((other) => {
    if (other.id === item.id || other.type === item.type) return false;

    const itemLower = item.item.toLowerCase();
    const otherLower = other.item.toLowerCase();

    return (
      itemLower === otherLower ||
      item.description
        .toLowerCase()
        .includes(other.description.toLowerCase()) ||
      other.description.toLowerCase().includes(item.description.toLowerCase())
    );
  });
}

function checkForMatches() {
  const userItems = allItems.filter(
    (item) => currentUser && item.userId === currentUser.uid,
  );
  const hasMatches = userItems.some((item) => findMatchingItem(item));

  if (hasMatches) {
    console.log("🎉 You have matching items!");
  }
}

// ==================== CONTACT & MODALS ====================
function showContact(itemId, item) {
  selectedItemForContact = item;
  document.getElementById("contactName").textContent = item.name;
  document.getElementById("contactEmail").textContent = item.email;
  document.getElementById("contactPhone").textContent = item.phone;
  document.getElementById("contactModal").classList.add("show");
}

function closeContactModal() {
  document.getElementById("contactModal").classList.remove("show");
}

function copyContact() {
  if (!selectedItemForContact) return;

  const text = `Name: ${selectedItemForContact.name}\nEmail: ${selectedItemForContact.email}\nPhone: ${selectedItemForContact.phone}`;
  navigator.clipboard.writeText(text).then(() => {
    alert("✅ Contact copied to clipboard!");
  });
}

async function deleteItem(itemId) {
  if (!confirm("Are you sure you want to delete this item?")) return;

  try {
    await deleteDoc(doc(db, "items", itemId));
    alert("Item deleted!");
    loadAllData();
  } catch (error) {
    alert("Error: " + error.message);
  }
}

function showMyPosts() {
  if (!currentUser) {
    alert("Please sign in first");
    return;
  }

  const myItems = allItems.filter((item) => item.userId === currentUser.uid);
  displayItems(myItems);
}

function formatDate(dateString) {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ==================== EXPOSE FUNCTIONS TO GLOBAL SCOPE ====================
window.toggleAuth = toggleAuth;
window.signUp = signUp;
window.signIn = signIn;
window.logout = logout;
window.closeAuthModal = closeAuthModal;
window.submitData = submitData;
window.filterItems = filterItems;
window.showContact = showContact;
window.closeContactModal = closeContactModal;
window.copyContact = copyContact;
window.deleteItem = deleteItem;
window.showMyPosts = showMyPosts;

// ==================== INITIALIZATION ====================
console.log("🚀 Initializing Lost & Found App...");

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("✅ User authenticated:", user.email);
    currentUser = user;
    updateUIForUser();
  } else {
    console.log("👤 No user authenticated");
    currentUser = null;
    updateUIForUser();
  }
});

loadAllData();

setInterval(loadAllData, 5000);

console.log("✨ App initialization complete!");
