import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

let currentMode = "login";
let groupedNotes = {};

window.showPage = async function(pageId) {
  document.getElementById("authCard").classList.add("hidden");
  document.getElementById("uploadPage").classList.add("hidden");
  document.getElementById("viewPage").classList.add("hidden");

  document.getElementById(pageId).classList.remove("hidden");

  if (pageId === "viewPage") {
    await refreshView();
  }

  if (pageId === "uploadPage") {
    await renderHistory();
  }
};

window.togglePasswordView = function() {
  const passwordField = document.getElementById("passInput");
  const toggleLabel = document.getElementById("eyeButton");

  passwordField.type =
    passwordField.type === "password" ? "text" : "password";

  toggleLabel.textContent =
    passwordField.type === "password" ? "SHOW" : "HIDE";
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

    switcher.innerHTML =
      'Already a member? <a class="switch-link" onclick="window.changeAuthMode()">Login here</a>';
  } else {
    currentMode = "login";

    title.textContent = "Sign In";
    button.textContent = "Login";
    extras.style.visibility = "visible";

    switcher.innerHTML =
      'Need an account? <a class="switch-link" onclick="window.changeAuthMode()">Create one here</a>';
  }
};

window.triggerRecovery = async function() {
  const email = document.getElementById("userInput").value.trim();

  if (!email) {
    alert("Enter your email address first.");
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email);

  if (error) {
    alert("Error sending reset email: " + error.message);
    return;
  }

  alert("Password reset instructions have been sent to your email.");
};

window.logout = async function() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    alert("Error logging out: " + error.message);
    return;
  }

  location.reload();
};

document
  .getElementById("authForm")
  .addEventListener("submit", async function(e) {
    e.preventDefault();

    const email = document.getElementById("userInput").value.trim();
    const password = document.getElementById("passInput").value;
    const card = document.getElementById("authCard");
    const message = document.getElementById("finalGreeting");

    if (currentMode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        alert("Login failed: " + error.message);
        return;
      }

      const userEmail = data.user?.email || email;

      document.body.style.backgroundColor = "lightsteelblue";
      card.classList.add("exit-animation");

      setTimeout(() => {
        card.style.display = "none";
        message.textContent = "Welcome back, " + userEmail + "!";
        message.style.display = "block";

        setTimeout(() => {
          message.style.display = "none";
          document.getElementById("appNav").classList.remove("hidden");
          window.showPage("viewPage");
        }, 1500);
      }, 1000);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) {
        alert("Registration failed: " + error.message);
        return;
      }

      if (data.session) {
        alert("Registration successful.");
      } else {
        alert(
          "Registration successful. Check your email to confirm your account, then log in."
        );
      }

      currentMode = "login";
      window.changeAuthMode();
    }
  });

document
  .getElementById("uploadForm")
  .addEventListener("submit", async e => {
    e.preventDefault();

    const file = document.getElementById("file").files[0];
    const dept = document.getElementById("department").value.trim();
    const course = document.getElementById("course").value.trim();

    if (!file) {
      alert("Please select a PDF file.");
      return;
    }

    if (file.type !== "application/pdf") {
      alert("Only PDF files are allowed.");
      return;
    }

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("You must be logged in to upload a note.");
      return;
    }

    const safeDepartment = dept
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");

    const safeCourse = course
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");

    const safeFileName = file.name
      .replace(/[^\w.\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");

    const filePath =
      `${user.id}/${safeDepartment}/${safeCourse}/${Date.now()}_${safeFileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("notes")
        .upload(filePath, file, {
          contentType: "application/pdf",
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      document.getElementById("uploadForm").reset();

      alert("Note uploaded successfully.");

      await window.showPage("viewPage");
    } catch (error) {
      alert("Error uploading: " + error.message);
    }
  });

async function getAllFiles(path = "") {
  const { data, error } = await supabase.storage
    .from("notes")
    .list(path, {
      limit: 100,
      offset: 0,
      sortBy: {
        column: "name",
        order: "asc"
      }
    });

  if (error) {
    throw error;
  }

  const files = [];

  for (const item of data || []) {
    const itemPath = path
      ? `${path}/${item.name}`
      : item.name;

    if (item.id === null) {
      const nestedFiles = await getAllFiles(itemPath);
      files.push(...nestedFiles);
    } else {
      const { data: publicUrlData } = supabase.storage
        .from("notes")
        .getPublicUrl(itemPath);

      const pathParts = itemPath.split("/");

      if (pathParts.length >= 4) {
        files.push({
          department: pathParts[1],
          course: pathParts[2],
          fileName: pathParts
            .slice(3)
            .join("/")
            .replace(/^\d+_/, ""),
          filePath: itemPath,
          fileUrl: publicUrlData.publicUrl,
          ownerId: pathParts[0]
        });
      }
    }
  }

  return files;
}

async function refreshView() {
  const container = document.getElementById("coursesContainer");
  const select = document.getElementById("departmentSelect");

  container.innerHTML = "";
  select.innerHTML = '<option value="">Choose Department</option>';

  groupedNotes = {};

  try {
    const notes = await getAllFiles();

    notes.forEach(note => {
      if (!groupedNotes[note.department]) {
        groupedNotes[note.department] = {};
      }

      if (!groupedNotes[note.department][note.course]) {
        groupedNotes[note.department][note.course] = [];
      }

      groupedNotes[note.department][note.course].push(note);
    });

    Object.keys(groupedNotes)
      .sort()
      .forEach(department => {
        const option = document.createElement("option");

        option.value = department;
        option.textContent = department;

        select.appendChild(option);
      });
  } catch (error) {
    container.innerHTML = "<p>Unable to load notes.</p>";
    alert("Error loading notes: " + error.message);
  }
}

document
  .getElementById("departmentSelect")
  .addEventListener("change", function() {
    const container = document.getElementById("coursesContainer");

    container.innerHTML = "";

    const department = this.value;

    if (!department || !groupedNotes[department]) {
      return;
    }

    Object.keys(groupedNotes[department])
      .sort()
      .forEach(course => {
        const div = document.createElement("div");
        const heading = document.createElement("h4");

        heading.textContent = course;

        div.appendChild(heading);

        groupedNotes[department][course].forEach(note => {
          const link = document.createElement("a");

          link.href = note.fileUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = note.fileName;
          link.style.display = "block";

          div.appendChild(link);
        });

        container.appendChild(div);
      });
  });

async function renderHistory() {
  const container = document.getElementById("existingNotes");

  container.innerHTML = "<h4>Your Uploads</h4>";

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    container.innerHTML += "<p>Please log in to view your uploads.</p>";
    return;
  }

  try {
    const notes = await getAllFiles(user.id);

    if (notes.length === 0) {
      container.innerHTML += "<p>No uploads yet.</p>";
      return;
    }

    notes.forEach(note => {
      const div = document.createElement("div");
      div.className = "note-item";

      const text = document.createElement("span");
      text.textContent = `${note.course} - ${note.fileName}`;

      const del = document.createElement("button");
      del.className = "delete-btn";
      del.textContent = "Delete";

      del.onclick = async () => {
        const confirmed = confirm(`Delete ${note.fileName}?`);

        if (!confirmed) {
          return;
        }

        const { error } = await supabase.storage
          .from("notes")
          .remove([note.filePath]);

        if (error) {
          alert("Error deleting file: " + error.message);
          return;
        }

        await renderHistory();
      };

      div.appendChild(text);
      div.appendChild(del);

      container.appendChild(div);
    });
  } catch (error) {
    container.innerHTML += "<p>Unable to load your uploads.</p>";
    alert("Error loading uploads: " + error.message);
  }
}

async function checkSession() {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) {
    return;
  }

  if (session) {
    document.getElementById("authCard").classList.add("hidden");
    document.getElementById("appNav").classList.remove("hidden");

    await window.showPage("viewPage");
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    location.reload();
  }

  if (event === "SIGNED_IN" && session) {
    document.getElementById("appNav").classList.remove("hidden");
  }
});

checkSession();