(() => {
  const $ = (s) => document.querySelector(s);

  const state = {
    token: localStorage.getItem("sc_token") || null,
    username: localStorage.getItem("sc_user") || null,
    role: localStorage.getItem("sc_role") || null,
    anonId:
      localStorage.getItem("sc_anon") ||
      (crypto.randomUUID ? crypto.randomUUID() : "a-" + Math.random().toString(36).slice(2)),
    pendingImage: null,
  };
  localStorage.setItem("sc_anon", state.anonId);

  const chat = $("#chat");
  const input = $("#messageInput");
  const composer = $("#composer");

  async function api(path, body) {
    const headers = { "Content-Type": "application/json" };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const resp = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.detail || `HTTP ${resp.status}`);
    return data;
  }

  function addMsg(text, cls) {
    const el = document.createElement("div");
    el.className = `msg ${cls}`;
    el.textContent = text;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
    return el;
  }

  function addBot(text, crisis) {
    addMsg(text, crisis ? "bot crisis" : "bot");
  }

  function updateAuthChip() {
    const pill = $("#whoPill");
    const btn = $("#authBtn");
    if (state.username) {
      pill.textContent = `${state.username} · remembers you`;
      pill.classList.add("known");
      btn.textContent = "Sign out";
    } else {
      pill.textContent = "Anonymous · no memory";
      pill.classList.remove("known");
      btn.textContent = "Sign in";
    }
  }

  function welcome() {
    addBot(
      state.username
        ? `Welcome back, ${state.username}. I remember our past chats — what's going on today?`
        : "Hey — I'm StreetChat. Free, private, no account needed. I know Orange County shelters, food, showers, and help lines. If this is an emergency call 911, or call/text 988 any time.\n\nWhat's going on?"
    );
  }

  async function send() {
    const text = input.value.trim();
    if (!text && !state.pendingImage) return;

    addMsg(state.pendingImage ? `${text || ""} 📷 [photo sent]` : text, "me");
    input.value = "";
    input.style.height = "auto";
    $("#sendBtn").disabled = true;
    const typing = addMsg("thinking…", "bot typing");

    try {
      let data;
      if (state.pendingImage) {
        data = await api("/api/chat/image", {
          message: text || "What's in this image?",
          image_base64: state.pendingImage.data,
          media_type: state.pendingImage.type,
          anonymous_id: state.anonId,
        });
        clearImage();
      } else {
        data = await api("/api/chat", { message: text, anonymous_id: state.anonId });
      }
      typing.remove();
      addBot(data.reply || "…", data.crisis);
    } catch (e) {
      typing.remove();
      addBot(
        "Connection hiccup — try again in a moment. If it's urgent: call or text 988, or dial 211 for OC services.",
        true
      );
    } finally {
      $("#sendBtn").disabled = false;
      input.focus();
    }
  }

  function clearImage() {
    state.pendingImage = null;
    $("#attachBtn").classList.remove("has-image");
    $("#fileInput").value = "";
  }

  // --- composer wiring ---
  composer.addEventListener("submit", (e) => {
    e.preventDefault();
    send();
  });
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, window.innerHeight * 0.3) + "px";
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  $("#attachBtn").addEventListener("click", () => $("#fileInput").click());
  $("#fileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const [meta, data] = reader.result.split(",");
      state.pendingImage = { data, type: file.type || "image/jpeg" };
      $("#attachBtn").classList.add("has-image");
    };
    reader.readAsDataURL(file);
  });

  // --- auth modal ---
  const modal = $("#authModal");

  function setAuth(token, username, role) {
    state.token = token;
    state.username = username;
    state.role = role;
    if (token) {
      localStorage.setItem("sc_token", token);
      localStorage.setItem("sc_user", username);
      localStorage.setItem("sc_role", role);
    } else {
      ["sc_token", "sc_user", "sc_role"].forEach((k) => localStorage.removeItem(k));
    }
    updateAuthChip();
  }

  $("#authBtn").addEventListener("click", () => {
    if (state.username) {
      setAuth(null, null, null);
      addBot("Signed out. I'm still here — our chat just isn't tied to a name anymore.");
    } else {
      modal.showModal();
      switchTab("signin");
    }
  });
  $("#authClose").addEventListener("click", () => modal.close());

  function switchTab(name) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    document.querySelectorAll(".tabpane").forEach((p) =>
      p.classList.toggle("hidden", p.dataset.pane !== name)
    );
  }
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => switchTab(t.dataset.tab))
  );

  $("#loginSubmit").addEventListener("click", async () => {
    const username = $("#loginUser").value.trim();
    $("#loginErr").textContent = "";
    try {
      const d = await api("/api/auth/login", { username, password: $("#loginPass").value });
      setAuth(d.access_token, username.toLowerCase(), d.role);
      modal.close();
      addBot(`Good to see you again, ${state.username}.`);
    } catch (e) {
      $("#loginErr").textContent = e.message;
    }
  });

  $("#regSubmit").addEventListener("click", async () => {
    const username = $("#regUser").value.trim();
    $("#regErr").textContent = "";
    try {
      const d = await api("/api/auth/register", {
        username,
        password: $("#regPass").value,
        recovery_question: $("#regQ").value,
        recovery_answer: $("#regA").value,
      });
      setAuth(d.access_token, username.toLowerCase(), d.role);
      modal.close();
      addBot(`Account created, ${state.username}. I'll remember you from now on — even by text.`);
    } catch (e) {
      $("#regErr").textContent = e.message;
    }
  });

  $("#recStart").addEventListener("click", async () => {
    $("#recErr").textContent = "";
    try {
      const d = await api("/api/auth/recover/start", { username: $("#recUser").value.trim() });
      $("#recQuestion").textContent = d.question || "Answer your recovery question to continue.";
      $("#recStep2").classList.remove("hidden");
    } catch (e) {
      $("#recErr").textContent = e.message;
    }
  });

  $("#recFinish").addEventListener("click", async () => {
    const username = $("#recUser").value.trim();
    $("#recErr").textContent = "";
    try {
      const d = await api("/api/auth/recover/finish", {
        username,
        answer: $("#recAnswer").value,
        new_password: $("#recPass").value,
      });
      setAuth(d.access_token, username.toLowerCase(), d.role);
      modal.close();
      addBot("Password reset, and you're signed back in.");
    } catch (e) {
      $("#recErr").textContent = "Recovery failed — check your answer and try again.";
    }
  });

  updateAuthChip();
  welcome();
})();