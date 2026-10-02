(function () {
  "use strict";

  const api = window.CEUNSP_SUPABASE;
  const state = { projects: [], editingId: null, deletingId: null };
  const elements = {
    authView: document.querySelector("#auth-view"),
    denied: document.querySelector("#access-denied"),
    shell: document.querySelector("#admin-shell"),
    signOut: document.querySelector("#sign-out"),
    loginForm: document.querySelector("#login-form"),
    loginMessage: document.querySelector("#login-message"),
    form: document.querySelector("#project-form"),
    formTitle: document.querySelector("#form-title"),
    cancelEdit: document.querySelector("#cancel-edit"),
    list: document.querySelector("#admin-projects"),
    total: document.querySelector("#project-total"),
    modeBanner: document.querySelector("#mode-banner"),
    confirmDialog: document.querySelector("#confirm-dialog"),
    toast: document.querySelector("#toast")
  };

  function localProjects() {
    try {
      const saved = JSON.parse(localStorage.getItem("ceunsp_mock_projects") || "null");
      return Array.isArray(saved) ? saved : [...window.CEUNSP_MOCK_PROJECTS];
    } catch {
      return [...window.CEUNSP_MOCK_PROJECTS];
    }
  }

  function splitValues(value) {
    return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
  }

  function showToast(message, type = "success") {
    elements.toast.textContent = message;
    elements.toast.className = `toast visible ${type === "error" ? "error" : ""}`;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => elements.toast.classList.remove("visible"), 3500);
  }

  function showShell() {
    elements.authView.hidden = true;
    elements.denied.hidden = true;
    elements.shell.hidden = false;
    elements.signOut.hidden = !api.configured;
    if (api.configured) {
      elements.modeBanner.classList.add("connected");
      elements.modeBanner.innerHTML = "<strong>Supabase conectado.</strong> Publicações e imagens serão salvas no acervo oficial.";
      document.querySelector("#upload-hint").textContent = "As imagens serão enviadas ao bucket project-images após a publicação.";
    }
  }

  async function loadProjects() {
    state.projects = api.configured ? await api.getProjects() : localProjects();
    renderProjects();
  }

  function renderProjects() {
    elements.list.innerHTML = "";
    elements.total.textContent = `${state.projects.length} ${state.projects.length === 1 ? "projeto" : "projetos"}`;
    if (!state.projects.length) {
      elements.list.innerHTML = '<div class="empty-admin">Nenhum projeto cadastrado.</div>';
      return;
    }

    state.projects.forEach((project) => {
      const article = document.createElement("article");
      article.className = "admin-project";
      const cover = document.createElement("div");
      cover.className = `admin-project-cover ${project.is_mock ? "" : "real"}`;
      const image = document.createElement("img");
      const coverSource = String(project.cover_image || "");
      image.src = coverSource && !/^(https?:|blob:|\/)/i.test(coverSource)
        ? `../${coverSource}`
        : coverSource || "../assets/images/ceunsp-logo.png";
      image.alt = "";
      image.addEventListener("error", () => { image.src = "../assets/images/ceunsp-logo.png"; });
      cover.append(image);

      const copy = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = project.title;
      const meta = document.createElement("p");
      meta.textContent = `${project.course} · ${project.subject}`;
      copy.append(title, meta);

      const actions = document.createElement("div");
      actions.className = "project-actions";
      const view = document.createElement("a");
      view.href = `../index.html?project=${encodeURIComponent(project.id)}#projetos`;
      view.target = "_blank";
      view.rel = "noopener";
      view.textContent = "Visualizar";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Editar";
      edit.addEventListener("click", () => startEdit(project));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete";
      remove.textContent = "Excluir";
      remove.addEventListener("click", () => askDelete(project.id));
      actions.append(view, edit, remove);
      article.append(cover, copy, actions);
      elements.list.append(article);
    });
  }

  function payloadFromForm(formData) {
    return {
      title: String(formData.get("title") || "").trim(),
      short_description: String(formData.get("short_description") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      course: String(formData.get("course") || "").trim(),
      subject: String(formData.get("subject") || "").trim(),
      class_name: String(formData.get("class_name") || "").trim(),
      students: splitValues(formData.get("students")),
      technologies: splitValues(formData.get("technologies")),
      project_url: String(formData.get("project_url") || "").trim(),
      github_url: String(formData.get("github_url") || "").trim()
    };
  }

  async function submitProject(event) {
    event.preventDefault();
    const submitButton = elements.form.querySelector("[type=submit]");
    const formData = new FormData(elements.form);
    const payload = payloadFromForm(formData);
    const cover = formData.get("cover_image");
    const additional = formData.getAll("additional_images").filter((file) => file.size > 0);
    submitButton.disabled = true;
    submitButton.textContent = state.editingId ? "Salvando..." : "Publicando...";

    try {
      if (api.configured) {
        if (state.editingId) {
          await api.updateProject(state.editingId, payload, cover?.size ? cover : null, additional);
        } else {
          await api.createProject(payload, cover?.size ? cover : null, additional);
        }
      } else {
        const mockProject = {
          ...payload,
          id: state.editingId || `local-${crypto.randomUUID()}`,
          cover_image: "assets/images/ceunsp-logo.png",
          project_images: [],
          accent: "#0879bd",
          is_mock: true
        };
        if (state.editingId) {
          state.projects = state.projects.map((project) => String(project.id) === String(state.editingId) ? mockProject : project);
        } else {
          state.projects.unshift(mockProject);
        }
        localStorage.setItem("ceunsp_mock_projects", JSON.stringify(state.projects));
      }
      showToast(state.editingId ? "Projeto atualizado com sucesso." : "Projeto publicado com sucesso.");
      resetForm();
      await loadProjects();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Não foi possível salvar o projeto.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = state.editingId ? "Salvar alterações" : "Publicar projeto";
    }
  }

  function startEdit(project) {
    state.editingId = project.id;
    elements.formTitle.textContent = "Editar projeto";
    elements.cancelEdit.hidden = false;
    const fields = {
      title: project.title,
      short_description: project.short_description,
      description: project.description,
      course: project.course,
      subject: project.subject,
      class_name: project.class_name,
      students: (project.students || []).join(", "),
      technologies: (project.technologies || []).join(", "),
      project_url: project.project_url,
      github_url: project.github_url
    };
    Object.entries(fields).forEach(([name, value]) => {
      const field = elements.form.elements.namedItem(name);
      if (field) field.value = value || "";
    });
    elements.form.querySelector("[type=submit]").textContent = "Salvar alterações";
    document.querySelector("#form-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetForm() {
    state.editingId = null;
    elements.form.reset();
    elements.formTitle.textContent = "Novo projeto";
    elements.cancelEdit.hidden = true;
    elements.form.querySelector("[type=submit]").textContent = "Publicar projeto";
  }

  function askDelete(id) {
    state.deletingId = id;
    elements.confirmDialog.showModal();
  }

  async function confirmDelete() {
    if (!state.deletingId) return;
    try {
      if (api.configured) {
        await api.deleteProject(state.deletingId);
      } else {
        state.projects = state.projects.filter((project) => String(project.id) !== String(state.deletingId));
        localStorage.setItem("ceunsp_mock_projects", JSON.stringify(state.projects));
      }
      elements.confirmDialog.close();
      showToast("Projeto excluído.");
      if (String(state.editingId) === String(state.deletingId)) resetForm();
      state.deletingId = null;
      await loadProjects();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Não foi possível excluir o projeto.", "error");
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    const button = elements.loginForm.querySelector("button");
    const formData = new FormData(elements.loginForm);
    button.disabled = true;
    elements.loginMessage.textContent = "Entrando...";
    try {
      const session = await api.signIn(formData.get("email"), formData.get("password"));
      if (!api.adminClaim(session)) {
        elements.authView.hidden = true;
        elements.denied.hidden = false;
        elements.signOut.hidden = false;
        return;
      }
      showShell();
      await loadProjects();
    } catch (error) {
      elements.loginMessage.textContent = error.message || "Não foi possível entrar.";
    } finally {
      button.disabled = false;
      if (elements.loginMessage.textContent === "Entrando...") elements.loginMessage.textContent = "";
    }
  }

  async function signOut() {
    try { await api.signOut(); } catch (error) { console.error(error); }
    location.reload();
  }

  async function init() {
    window.CEUNSP_COURSES.forEach((course) => {
      const option = document.createElement("option");
      option.value = course.name;
      document.querySelector("#course-options").append(option);
    });

    if (!api.configured) {
      showShell();
      await loadProjects();
      return;
    }

    try {
      const session = await api.getSession();
      if (!session) {
        elements.authView.hidden = false;
      } else if (!api.adminClaim(session)) {
        elements.denied.hidden = false;
        elements.signOut.hidden = false;
      } else {
        showShell();
        await loadProjects();
      }
    } catch (error) {
      elements.authView.hidden = false;
      elements.loginMessage.textContent = "Não foi possível verificar o acesso ao Supabase.";
      console.error(error);
    }
  }

  elements.form.addEventListener("submit", submitProject);
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.signOut.addEventListener("click", signOut);
  document.querySelector("#denied-sign-out").addEventListener("click", signOut);
  document.querySelector("#new-project").addEventListener("click", () => {
    resetForm();
    document.querySelector("#form-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  elements.cancelEdit.addEventListener("click", resetForm);
  document.querySelector("#cancel-delete").addEventListener("click", () => elements.confirmDialog.close());
  document.querySelector("#confirm-delete").addEventListener("click", confirmDelete);
  init();
})();
