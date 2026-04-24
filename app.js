import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  updateDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ==================== FIREBASE CONFIG ====================
// ✅ Firebase config for lost-found-clg project
const firebaseConfig = {
  apiKey: "AIzaSyB6fvyCu03BGH-KwKo-PaBj1ysQjtH8",
  authDomain: "lost-found-clg.firebaseapp.com",
  projectId: "lost-found-clg",
  storageBucket: "lost-found-clg.firebasestorage.app",
  messagingSenderId: "336035491718",
  appId: "1:336035491718:web:532c173e2438157526f807"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

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
    await createUserWithEmailAndPassword(auth, email, password);
    alert("Account created! You're now signed in.");
    closeAuthModal();
    loadAllData();
  } catch (error) {
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
    await signInWithEmailAndPassword(auth, email, password);
    alert("Signed in successfully!");
    closeAuthModal();
    loadAllData();
  } catch (error) {
    alert("Error: " + error.message);
  }
}

async function logout() {
  try {
    await signOut(auth);
    alert("Logged out successfully!");
    currentUser = null;
    updateUIForUser();
    loadAllData();
  } catch (error) {
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

  if (!name || !userEmail || !phone || !type || !item || !location || !date) {
    alert("Please fill in all required fields");
    return;
  }

  try {
    await addDoc(collection(db, "items"), {
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
      createdAt: serverTimestamp(),
      viewed: false,
      matched: false,
    });

    alert("✅ Item posted successfully!");
    clearForm();
    loadAllData();
  } catch (error) {
    alert("Error: " + error.message);
    console.error(error);
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
}

function categorizeItem(itemName) {
  const electronics = [
    "airpods",
    "phone",
    "laptop",
    "headphones",
    "charger",
    "earbuds",
    "watch",
    "tablet",
  ];
  const documents = ["id", "card", "passport", "license", "certificate"];
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

async function loadAllData() {
  try {
    const querySnapshot = await getDocs(collection(db, "items"));
    allItems = [];

    querySnapshot.forEach((docSnapshot) => {
      allItems.push({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      });
    });

    // Sort by date (newest first)
    allItems.sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return dateB - dateA;
    });

    filterItems();
    checkForMatches();
  } catch (error) {
    console.error("Error loading data:", error);
  }
}

function filterItems() {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();
  const filterType = document.getElementById("filterType").value;
  const filterCategory = document.getElementById("filterCategory").value;

  let filtered = allItems.filter((item) => {
    const matchesSearch =
      item.item.includes(searchTerm) ||
      item.itemOriginal.toLowerCase().includes(searchTerm) ||
      item.description.toLowerCase().includes(searchTerm) ||
      item.location.includes(searchTerm);
    const matchesType = !filterType || item.type === filterType;
    const matchesCategory = !filterCategory || item.category === filterCategory;

    return matchesSearch && matchesType && matchesCategory;
  });

  displayItems(filtered);
}

function displayItems(items) {
  const listContainer = document.getElementById("list");

  if (items.length === 0) {
    listContainer.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #9ca3af;">
        <p style="font-size: 16px;">No items found. Try adjusting your filters.</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = items
    .map((item) => {
      const isUserItem = currentUser && item.userId === currentUser.uid;
      const matchingItem = findMatchingItem(item);

      return `
      <div class="item-card">
        <span class="item-badge ${item.type === "lost" ? "badge-lost" : "badge-found"}">
          ${item.type === "lost" ? "❌ LOST" : "✅ FOUND"}
        </span>
        
        <h3 class="item-title">${item.itemOriginal}</h3>
        
        ${item.description ? `<p class="item-description">"${item.description}"</p>` : ""}
        
        <div class="item-meta">
          <div class="meta-item">
            <span class="meta-label">📍 Location:</span><br>${item.locationOriginal}
          </div>
          <div class="meta-item">
            <span class="meta-label">📅 Date:</span><br>${formatDate(item.date)}
          </div>
          <div class="meta-item">
            <span class="meta-label">🏷️ Type:</span><br>${item.category}
          </div>
          <div class="meta-item">
            <span class="meta-label">👤 Posted by:</span><br>${item.name}
          </div>
        </div>

        ${
          matchingItem
            ? `
          <div class="match-badge">
            🎉 MATCH FOUND! Someone posted a matching ${matchingItem.type === "lost" ? "found" : "lost"} item!
          </div>
        `
            : ""
        }

        <div class="item-footer">
          <button class="contact-btn" onclick="showContact('${item.id}', ${JSON.stringify(item).replace(/'/g, "&apos;")})">
            📞 View Contact
          </button>
          ${isUserItem ? `<button class="delete-btn" onclick="deleteItem('${item.id}')">🗑️ Delete</button>` : ""}
        </div>
      </div>
    `;
    })
    .join("");
}

function findMatchingItem(item) {
  return allItems.find((other) => {
    if (other.id === item.id) return false;

    // Match logic: same item type, opposite lost/found status, similar location
    const sameItemName = other.item === item.item;
    const oppositeType = other.type !== item.type;
    const similarLocation =
      other.location === item.location ||
      item.description
        .toLowerCase()
        .includes(other.description.toLowerCase()) ||
      other.description.toLowerCase().includes(item.description.toLowerCase());

    return sameItemName && oppositeType && similarLocation;
  });
}

function checkForMatches() {
  const userItems = allItems.filter(
    (item) => currentUser && item.userId === currentUser.uid,
  );
  const hasMatches = userItems.some((item) => findMatchingItem(item));

  const notification = document.getElementById("matchNotification");
  if (hasMatches) {
    notification.classList.remove("hidden");
  } else {
    notification.classList.add("hidden");
  }
}

function showContact(itemId, item) {
  selectedItemForContact = item;
  const contactDetails = document.getElementById("contactDetails");
  contactDetails.innerHTML = `
    <strong>Name:</strong> ${item.name}<br><br>
    <strong>Email:</strong> ${item.email}<br><br>
    <strong>Phone:</strong> ${item.phone}<br><br>
    <strong>Item:</strong> ${item.itemOriginal}<br><br>
    <strong>Status:</strong> ${item.type === "lost" ? "Lost" : "Found"}<br><br>
    <strong>Location:</strong> ${item.locationOriginal}<br><br>
    ${item.description ? `<strong>Description:</strong> ${item.description}<br><br>` : ""}
    <strong>Date:</strong> ${formatDate(item.date)}
  `;
  document.getElementById("contactModal").classList.add("show");
}

function closeContactModal() {
  document.getElementById("contactModal").classList.remove("show");
  selectedItemForContact = null;
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
    alert("Please sign in to view your posts");
    return;
  }

  const myPosts = allItems.filter((item) => item.userId === currentUser.uid);
  const listContainer = document.getElementById("list");

  if (myPosts.length === 0) {
    listContainer.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #9ca3af;">
        <p style="font-size: 16px;">You haven't posted any items yet.</p>
      </div>
    `;
    return;
  }

  displayItems(myPosts);
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

// ==================== AUTH STATE LISTENER ====================
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateUIForUser();
  if (user) {
    console.log("User signed in:", user.email);
  }
});

// ==================== EXPOSE FUNCTIONS TO GLOBAL SCOPE ====================
// This allows HTML onclick handlers to call these functions
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
loadAllData();

// Auto-refresh data every 5 seconds
setInterval(loadAllData, 5000);
