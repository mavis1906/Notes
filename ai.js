import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const noteSelect = document.getElementById("noteSelect");

const analyzeButton = document.getElementById("analyzeButton");

const aiStatus = document.getElementById("aiStatus");

const aiResponse = document.getElementById("aiResponse");

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

async function loadNotes() {
  try {
    aiStatus.textContent = "Loading your notes...";

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      aiStatus.textContent = "Please log in first.";
      return;
    }

    const notes = await getAllFiles(user.id);

    noteSelect.innerHTML = '<option value="">Select a note</option>';

    notes.forEach(note => {
      const option = document.createElement("option");

      option.value = note.fileUrl;

      option.textContent = `${note.course} - ${note.fileName}`;

      option.dataset.fileName = note.fileName;

      noteSelect.appendChild(option);
    });

    if (notes.length === 0) {
      aiStatus.textContent = "You have no uploaded notes yet.";
    } else {
      aiStatus.textContent = `${notes.length} note${notes.length === 1 ? "" : "s"} available.`;
    }
  } catch (error) {
    console.error(error);

    aiStatus.textContent = "Unable to load your notes.";
  }
}

function formatAIResponse(text) {
  aiResponse.innerHTML = "";

  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map(line => line.trim())
    .filter(line => line !== "---");

  let currentSection = null;
  let currentList = null;
  let answerSection = null;
  let showingAnswers = false;

  function createSection(title) {
    const section = document.createElement("section");

    section.className = "ai-section";

    const heading = document.createElement("h3");

    heading.textContent = title;

    section.appendChild(heading);

    aiResponse.appendChild(section);

    return section;
  }

  function addParagraph(text) {
    if (!currentSection) {
      currentSection = createSection("AI Analysis");
    }

    const paragraph = document.createElement("p");

    paragraph.textContent = text;

    currentSection.appendChild(paragraph);

    currentList = null;
  }

  function addListItem(text, numbered = false, targetSection = currentSection) {
    if (!targetSection) {
      targetSection = createSection("AI Analysis");
      currentSection = targetSection;
    }

    if (
      !currentList ||
      currentList.dataset.type !== (numbered ? "numbered" : "bullet") ||
      currentList.parentElement !== targetSection
    ) {
      currentList = document.createElement(numbered ? "ol" : "ul");

      currentList.dataset.type = numbered ? "numbered" : "bullet";

      targetSection.appendChild(currentList);
    }

    const item = document.createElement("li");

    item.textContent = text;

    currentList.appendChild(item);
  }

  function cleanText(value) {
    return value
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .trim();
  }

  for (const line of lines) {
    if (/^#{1,4}\s+/.test(line)) {
      const title = cleanText(line.replace(/^#{1,4}\s+/, ""));

      if (/^(answers?|answer key)/i.test(title)) {
        answerSection = document.createElement("section");

        answerSection.className = "ai-section ai-answers";

        answerSection.style.display = "none";

        const heading = document.createElement("h3");

        heading.textContent = title;

        answerSection.appendChild(heading);

        aiResponse.appendChild(answerSection);

        currentSection = answerSection;

        currentList = null;

        continue;
      }

      currentSection = createSection(title);

      currentList = null;

      continue;
    }

    if (/^(answers?|answer key)\s*:?\s*$/i.test(line)) {
      answerSection = document.createElement("section");

      answerSection.className = "ai-section ai-answers";

      answerSection.style.display = "none";

      const heading = document.createElement("h3");

      heading.textContent = "Answers";

      answerSection.appendChild(heading);

      aiResponse.appendChild(answerSection);

      currentSection = answerSection;

      currentList = null;

      continue;
    }

    if (/^(answer\s*\d+|answer\s+\d+)\s*:/i.test(line)) {
      if (!answerSection) {
        answerSection = document.createElement("section");

        answerSection.className = "ai-section ai-answers";

        answerSection.style.display = "none";

        const heading = document.createElement("h3");

        heading.textContent = "Answers";

        answerSection.appendChild(heading);

        aiResponse.appendChild(answerSection);
      }

      const answerText = cleanText(
        line.replace(/^(answer\s*\d+|answer\s+\d+)\s*:\s*/i, "")
      );

      addListItem(answerText, true, answerSection);

      currentSection = answerSection;

      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const text = cleanText(line.replace(/^\d+\.\s+/, ""));

      if (answerSection && currentSection === answerSection) {
        addListItem(text, true, answerSection);
      } else {
        addListItem(text, true);
      }

      continue;
    }

    if (/^[-*•]\s+/.test(line)) {
      const text = cleanText(line.replace(/^[-*•]\s+/, ""));

      if (answerSection && currentSection === answerSection) {
        addListItem(text, false, answerSection);
      } else {
        addListItem(text);
      }

      continue;
    }

    const cleanedLine = cleanText(line);

    if (cleanedLine) {
      if (answerSection && currentSection === answerSection) {
        const paragraph = document.createElement("p");

        paragraph.textContent = cleanedLine;

        answerSection.appendChild(paragraph);
      } else {
        addParagraph(cleanedLine);
      }
    }
  }

  if (answerSection) {
    const showAnswersButton = document.createElement("button");

    showAnswersButton.textContent = "Show Answers";

    showAnswersButton.type = "button";

    showAnswersButton.style.marginTop = "20px";
    showAnswersButton.style.padding = "12px 20px";
    showAnswersButton.style.backgroundColor = "blue";
    showAnswersButton.style.color = "white";
    showAnswersButton.style.border = "none";
    showAnswersButton.style.borderRadius = "6px";
    showAnswersButton.style.cursor = "pointer";
    showAnswersButton.style.fontSize = "15px";
    showAnswersButton.style.fontWeight = "bold";

    showAnswersButton.addEventListener("click", () => {
      showingAnswers = !showingAnswers;

      answerSection.style.display = showingAnswers ? "block" : "none";

      showAnswersButton.textContent = showingAnswers
        ? "Hide Answers"
        : "Show Answers";
    });

    aiResponse.appendChild(showAnswersButton);
  }

  if (!aiResponse.children.length) {
    addParagraph(text);
  }
}

analyzeButton.addEventListener("click", async () => {
  const selectedOption = noteSelect.options[noteSelect.selectedIndex];

  const fileUrl = noteSelect.value;

  const fileName = selectedOption?.dataset.fileName;

  if (!fileUrl) {
    aiStatus.textContent = "Select a note first.";
    return;
  }

  analyzeButton.disabled = true;

  aiStatus.textContent = "AI is analyzing your notes...";

  aiResponse.innerHTML = "<p>Reading your study material...</p>";

  try {
    const response = await fetch(
      "http://localhost:5000/api/ai/analyze",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fileUrl,
          fileName
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "AI analysis failed.");
    }

    aiStatus.textContent = "Analysis complete.";

    formatAIResponse(data.response);
  } catch (error) {
    console.error(error);

    aiStatus.textContent = "Unable to analyze this note.";

    aiResponse.innerHTML =
      "<p>Something went wrong while analyzing the note.</p>";
  } finally {
    analyzeButton.disabled = false;
  }
});

loadNotes();