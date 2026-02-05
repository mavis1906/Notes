import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDGhlpxxSQLNPV2roiEp38EuA5Tuu4W4z8",
  authDomain: "uni-portal-webapp.firebaseapp.com",
  projectId: "uni-portal-webapp",
  storageBucket: "uni-portal-webapp.firebasestorage.app",
  messagingSenderId: "467684694508",
  appId: "1:467684694508:web:7cd24dda749c4e9c3908c9",
  measurementId: "G-E1FWT9YTZ6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

let currentMode = "login";
let groupedNotes = {};

window.showPage = function(pageId) {
  document.getElementById("authCard").classList.add("hidden");
  document.getElementById("uploadPage").classList.add("hidden");
  document.getElementById("viewPage").classList.add("hidden");
  document.getElementById(pageId).classList.remove("hidden");
  if (pageId === "viewPage") refreshView();
  if (pageId === "uploadPage") renderHistory();
};

window.togglePasswordView = function() {
  const passwordField = document.getElementById("passInput");
  const toggleLabel = document.getElementById("eyeButton");
  passwordField.type = passwordField.type === "password" ? "text" : "password";
  toggleLabel.textContent = passwordField.type === "password" ? "SHOW" : "HIDE";
};

window.changeAuthMode = function() {
  const title = document.getElementById("displayTitle");
  const button = document.getElementById("submitBtn");
  const switcher = document.getElementById("modeText");
  const extras = document.getElementById("extraOptions");

  if (currentMode === "login") {
    currentMode = "register";
    title.textContent = "Register";
    button.textContent = "Join Now";
    extras.style.visibility = "hidden";
    switcher.innerHTML = 'Already a member? <a class="switch-link" onclick="changeAuthMode()">Login here</a>';
  } else {
    currentMode = "login";
    title.textContent = "Sign In";
    button.textContent = "Login";
    extras.style.visibility = "visible";
    switcher.innerHTML = 'Need an account? <a class="switch-link" onclick="changeAuthMode()">Create one here</a>';
  }
};

document.getElementById("authForm").addEventListener("submit", function(e) {
  e.preventDefault();
  const card = document.getElementById("authCard");
  const message = document.getElementById("finalGreeting");
  const user = document.getElementById("userInput").value;

  if (currentMode === "login") {
    document.body.style.backgroundColor = "lightsteelblue";
    card.classList.add("exit-animation");
    setTimeout(() => {
      card.style.display = "none";
      message.textContent = "Welcome back, " + user + "!";
      message.style.display = "block";
      setTimeout(() => {
        message.style.display = "none";
        document.getElementById("appNav").classList.remove("hidden");
        showPage("viewPage");
      }, 1500);
    }, 1000);
  } else {
    alert("Success! Please log in.");
    changeAuthMode();
  }
});

document.getElementById("uploadForm").addEventListener("submit", async e => {
  e.preventDefault();
  const file = document.getElementById("file").files[0];
  const dept = document.getElementById("department").value;
  const course = document.getElementById("course").value;

  const storageRef = ref(storage, `notes/${Date.now()}_${file.name}`);
  
  try {
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    await addDoc(collection(db, "notes"), {
      department: dept,
      course: course,
      fileName: file.name,
      fileUrl: downloadURL,
      storagePath: storageRef.fullPath,
      createdAt: new Date()
    });

    document.getElementById("uploadForm").reset();
    showPage("viewPage");
  } catch (error) {
    alert("Error uploading: " + error.message);
  }
});

async function refreshView() {
  const container = document.getElementById("coursesContainer");
  const select = document.getElementById("departmentSelect");
  container.innerHTML = "";
  select.innerHTML = '<option value="">Choose Department</option>';
  groupedNotes = {};

  const querySnapshot = await getDocs(collection(db, "notes"));
  querySnapshot.forEach((doc) => {
    const n = doc.data();
    if (!groupedNotes[n.department]) groupedNotes[n.department] = {};
    if (!groupedNotes[n.department][n.course]) groupedNotes[n.department][n.course] = [];
    groupedNotes[n.department][n.course].push(n);
  });

  Object.keys(groupedNotes).forEach(d => {
    const opt = document.createElement("option");
    opt.value = d; opt.textContent = d; select.appendChild(opt);
  });
}

document.getElementById("departmentSelect").addEventListener("change", function() {
  const container = document.getElementById("coursesContainer");
  container.innerHTML = "";
  const dept = this.value;
  if (!dept || !groupedNotes[dept]) return;

  Object.keys(groupedNotes[dept]).forEach(c => {
    const div = document.createElement("div");
    div.innerHTML = `<h4>${c}</h4>`;
    groupedNotes[dept][c].forEach(n => {
      const link = document.createElement("a");
      link.href = n.fileUrl;
      link.target = "_blank"; link.textContent = n.fileName;
      link.style.display = "block";
      div.appendChild(link);
    });
    container.appendChild(div);
  });
});

async function renderHistory() {
  const container = document.getElementById("existingNotes");
  container.innerHTML = "<h4>Your Uploads</h4>";
  
  const querySnapshot = await getDocs(collection(db, "notes"));
  querySnapshot.forEach((docSnapshot) => {
    const n = docSnapshot.data();
    const id = docSnapshot.id;
    
    const div = document.createElement("div");
    div.className = "note-item";
    div.innerHTML = `<span>${n.course} - ${n.fileName}</span>`;
    
    const del = document.createElement("button");
    del.className = "delete-btn"; del.textContent = "Delete";
    del.onclick = async () => {
      await deleteDoc(doc(db, "notes", id));
      const fileRef = ref(storage, n.storagePath);
      await deleteObject(fileRef);
      renderHistory();
    };
    
    div.appendChild(del); container.appendChild(div);
  });
}
