const dbName = "UniversityNotesDB";
const storeName = "notes";
let db;
let currentMode = "login";
let groupedNotes = {};

function openDB() {
  const request = indexedDB.open(dbName, 1);
  request.onupgradeneeded = e => {
    const database = e.target.result;
    if (!database.objectStoreNames.contains(storeName)) {
      database.createObjectStore(storeName, { keyPath: "id", autoIncrement: true });
    }
  };
  request.onsuccess = e => { db = e.target.result; };
}

function showPage(pageId) {
  document.getElementById("authCard").classList.add("hidden");
  document.getElementById("uploadPage").classList.add("hidden");
  document.getElementById("viewPage").classList.add("hidden");
  document.getElementById(pageId).classList.remove("hidden");
  if (pageId === "viewPage") refreshView();
  if (pageId === "uploadPage") renderHistory();
}

function togglePasswordView() {
  const passwordField = document.getElementById("passInput");
  const toggleLabel = document.getElementById("eyeButton");
  passwordField.type = passwordField.type === "password" ? "text" : "password";
  toggleLabel.textContent = passwordField.type === "password" ? "SHOW" : "HIDE";
}

function changeAuthMode() {
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
}

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
  const note = {
    department: document.getElementById("department").value,
    course: document.getElementById("course").value,
    fileName: file.name,
    fileBlob: file
  };
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).add(note);
  tx.oncomplete = () => {
    document.getElementById("uploadForm").reset();
    showPage("viewPage");
  };
});

function refreshView() {
  const container = document.getElementById("coursesContainer");
  const select = document.getElementById("departmentSelect");
  container.innerHTML = "";
  select.innerHTML = '<option value="">Choose Department</option>';
  groupedNotes = {};

  db.transaction(storeName, "readonly").objectStore(storeName).openCursor().onsuccess = e => {
    const cursor = e.target.result;
    if (cursor) {
      const n = cursor.value;
      if (!groupedNotes[n.department]) groupedNotes[n.department] = {};
      if (!groupedNotes[n.department][n.course]) groupedNotes[n.department][n.course] = [];
      groupedNotes[n.department][n.course].push(n);
      cursor.continue();
    } else {
      Object.keys(groupedNotes).forEach(d => {
        const opt = document.createElement("option");
        opt.value = d; opt.textContent = d; select.appendChild(opt);
      });
    }
  };
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
      link.href = URL.createObjectURL(n.fileBlob);
      link.target = "_blank"; link.textContent = n.fileName;
      link.style.display = "block";
      div.appendChild(link);
    });
    container.appendChild(div);
  });
});

function renderHistory() {
  const container = document.getElementById("existingNotes");
  container.innerHTML = "<h4>Your Uploads</h4>";
  db.transaction(storeName, "readonly").objectStore(storeName).getAll().onsuccess = e => {
    e.target.result.forEach(n => {
      const div = document.createElement("div");
      div.className = "note-item";
      div.innerHTML = `<span>${n.course}</span>`;
      const del = document.createElement("button");
      del.className = "delete-btn"; del.textContent = "Delete";
      del.onclick = () => {
        db.transaction(storeName, "readwrite").objectStore(storeName).delete(n.id).onsuccess = () => renderHistory();
      };
      div.appendChild(del); container.appendChild(div);
    });
  };
}

openDB();