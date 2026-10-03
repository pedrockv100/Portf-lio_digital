(function () {
  "use strict";

  const state = {
    projects: [],
    search: "",
    course: "",
    subject: "",
    subscribed: false
  };

  const elements = {
    coursesGrid: document.querySelector("#courses-grid"),
    projectsGrid: document.querySelector("#projects-grid"),
    search: document.querySelector("#search-input"),
    courseFilter: document.querySelector("#course-filter"),
    subjectFilter: document.querySelector("#subject-filter"),
    clearFilters: document.querySelector("#clear-filters"),
    resultCount: document.querySelector("#results-count"),
    dataSource: document.querySelector("#data-source"),
    emptyState: document.querySelector("#empty-state"),
    dialog: document.querySelector("#project-dialog"),
    detail: document.querySelector("#project-detail"),
    menuToggle: document.querySelector(".menu-toggle"),
    navLinks: document.querySelector(".nav-links"),
    backToTop: document.querySelector("#back-to-top")
  };

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[character]);
  }

  function safeUrl(value) {
    try {
      const parsed = new URL(value, window.location.href);
      return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
    } catch {
      return "";
    }
  }

  function safeAssetUrl(value) {
    try {
      const parsed = new URL(value, window.location.href);
      return ["http:", "https:", "file:"].includes(parsed.protocol) ? parsed.href : "";
    } catch {
      return "";
    }
  }

  function arrayValue(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    return String(value).split(",").map((item) => item.trim()).filter(Boolean);
  }

  function localProjects() {
    const bundled = Array.isArray(window.CEUNSP_MOCK_PROJECTS)
      ? window.CEUNSP_MOCK_PROJECTS
      : [];
    const dataVersion = String(window.CEUNSP_PROJECTS_DATA_VERSION || "1");

    try {
      const saved = JSON.parse(localStorage.getItem("ceunsp_mock_projects") || "null");
      const savedVersion = localStorage.getItem("ceunsp_mock_projects_version");

      if (!Array.isArray(saved) || savedVersion !== dataVersion) {
        const bundledIds = new Set(bundled.map((project) => String(project.id)));
        const customProjects = Array.isArray(saved)
          ? saved.filter((project) => !bundledIds.has(String(project.id)))
          : [];
        const merged = [...bundled, ...customProjects];
        localStorage.setItem("ceunsp_mock_projects", JSON.stringify(merged));
        localStorage.setItem("ceunsp_mock_projects_version", dataVersion);
        return merged;
      }

      return saved;
    } catch {
      localStorage.setItem("ceunsp_mock_projects", JSON.stringify(bundled));
      localStorage.setItem("ceunsp_mock_projects_version", dataVersion);
      return bundled;
    }
  }

  async function loadProjects() {
    if (window.CEUNSP_SUPABASE.configured) {
      try {
        state.projects = await window.CEUNSP_SUPABASE.getProjects();
        elements.dataSource.textContent = "Dados do Supabase";
        if (!state.subscribed) {
          window.CEUNSP_SUPABASE.subscribeProjects(loadProjects);
          state.subscribed = true;
        }
      } catch (error) {
        console.warn("Não foi possível carregar o Supabase; usando dados de demonstração.", error);
        state.projects = localProjects();
        elements.dataSource.textContent = "Demonstração — Supabase indisponível";
      }
    } else {
      state.projects = localProjects();
      elements.dataSource.textContent = "Modo demonstração";
    }
    populateFilters();
    renderCourses();
    renderProjects();
    const requestedProject = new URLSearchParams(window.location.search).get("project");
    if (requestedProject) {
      const project = state.projects.find((item) => String(item.id) === requestedProject);
      if (project) {
        openProject(project);
        history.replaceState({}, "", `${location.pathname}#projetos`);
      }
    }
  }

  function renderCourses() {
    elements.coursesGrid.innerHTML = "";
    const template = document.querySelector("#course-card-template");

    window.CEUNSP_COURSES.forEach((course) => {
      const fragment = template.content.cloneNode(true);
      const card = fragment.querySelector(".course-card");
      const count = state.projects.filter((project) => !project.is_mock && project.course === course.name).length;
      card.style.setProperty("--course-accent", course.accent);
      fragment.querySelector(".course-icon").textContent = course.icon;
      fragment.querySelector("h3").textContent = course.name;
      fragment.querySelector(".course-description").textContent = course.description;
      fragment.querySelector(".project-count").textContent = `${count} ${count === 1 ? "projeto" : "projetos"}`;
      fragment.querySelector("button").addEventListener("click", () => {
        state.course = course.name;
        elements.courseFilter.value = course.name;
        renderProjects();
        document.querySelector("#projetos").scrollIntoView({ behavior: "smooth" });
      });
      elements.coursesGrid.append(fragment);
    });
    observeReveals();
  }

  function populateFilters() {
    const currentCourse = elements.courseFilter.value;
    const currentSubject = elements.subjectFilter.value;
    const courses = window.CEUNSP_COURSES.map((course) => course.name);
    const subjects = [...new Set(state.projects.map((project) => project.subject).filter(Boolean))].sort();
    elements.courseFilter.innerHTML = '<option value="">Todos os cursos</option>';
    elements.subjectFilter.innerHTML = '<option value="">Todas as disciplinas</option>';
    courses.forEach((course) => elements.courseFilter.add(new Option(course, course)));
    subjects.forEach((subject) => elements.subjectFilter.add(new Option(subject, subject)));
    elements.courseFilter.value = courses.includes(currentCourse) ? currentCourse : "";
    elements.subjectFilter.value = subjects.includes(currentSubject) ? currentSubject : "";
  }

  function filteredProjects() {
    const query = normalizeText(state.search);
    return state.projects.filter((project) => {
      const haystack = normalizeText([
        project.title,
        project.course,
        project.course_acronym,
        project.filter_course,
        project.subject,
        project.short_description,
        project.description,
        ...arrayValue(project.students),
        ...arrayValue(project.technologies)
      ].join(" "));
      return (!query || haystack.includes(query))
        && (!state.course || (project.filter_course || project.course) === state.course)
        && (!state.subject || project.subject === state.subject);
    });
  }

  function renderProjects() {
    const projects = filteredProjects();
    const template = document.querySelector("#project-card-template");
    elements.projectsGrid.innerHTML = "";
    elements.resultCount.textContent = `${projects.length} ${projects.length === 1 ? "projeto encontrado" : "projetos encontrados"}`;
    elements.emptyState.hidden = projects.length > 0;

    projects.forEach((project) => {
      const fragment = template.content.cloneNode(true);
      const card = fragment.querySelector(".project-card");
      const cover = fragment.querySelector(".project-cover");
      const coverImage = cover.querySelector("img");
      const coverUrl = safeAssetUrl(project.cover_image);
      card.style.setProperty("--project-accent", project.accent || "#0879bd");
      if (!project.is_mock && coverUrl) {
        cover.classList.add("has-image");
        if (project.cover_fit === "contain") cover.classList.add("contain-image");
        coverImage.src = coverUrl;
        coverImage.alt = `Capa do projeto ${project.title}`;
        cover.querySelector(".mock-badge").hidden = true;
      }
      fragment.querySelector(".project-meta").textContent = `${project.course_label || project.course} · ${project.subject}`;
      fragment.querySelector("h3").textContent = project.title;
      fragment.querySelector(".project-summary").textContent = project.short_description;
      fragment.querySelector(".student-list").textContent = arrayValue(project.students).join(", ");
      const techList = fragment.querySelector(".technology-list");
      arrayValue(project.technologies).slice(0, project.card_technology_limit || 4).forEach((technology) => {
        const tag = document.createElement("span");
        tag.textContent = technology;
        techList.append(tag);
      });
      const openButton = fragment.querySelector(".project-card-hit");
      const footerButton = fragment.querySelector(".project-open-button");
      openButton.setAttribute("aria-label", `Ver detalhes do projeto ${project.title}`);
      openButton.addEventListener("click", () => openProject(project));
      footerButton.addEventListener("click", (event) => {
        event.stopPropagation();
        openProject(project);
      });
      elements.projectsGrid.append(fragment);
    });
    observeReveals();
  }

  function openProject(project) {
    const technologies = arrayValue(project.technologies)
      .map((item) => `<span>${escapeHtml(item)}</span>`)
      .join("");
    const projectUrl = safeUrl(project.project_url);
    const coverUrl = safeAssetUrl(project.cover_image);
    const features = arrayValue(project.features);
    const images = arrayValue(project.project_images)
      .map((item) => typeof item === "string" ? item : item?.image_url)
      .map(safeAssetUrl)
      .filter(Boolean);
    const links = projectUrl
      ? `<a class="button button-primary" href="${escapeHtml(projectUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(project.link_label || "Abrir projeto")}</a>`
      : "";
    const gallery = images.length
      ? `<div class="detail-gallery">${images.map((url) => `<img src="${escapeHtml(url)}" alt="Imagem adicional do projeto ${escapeHtml(project.title)}" />`).join("")}</div>`
      : "";
    const featuresMarkup = features.length
      ? `<h3>Funcionalidades propostas</h3><ul class="detail-features">${features.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "";
    const heroImage = !project.is_mock && coverUrl
      ? `<div class="detail-project-logo"><img src="${escapeHtml(coverUrl)}" alt="Logo do projeto ${escapeHtml(project.title)}" /></div>`
      : '<img class="detail-brand-watermark" src="assets/images/ceunsp-logo.png" alt="" />';

    elements.detail.innerHTML = `
      <div class="detail-hero${!project.is_mock && coverUrl ? " has-project-logo" : ""}" style="--project-accent: ${escapeHtml(project.accent || "#0879bd")}">
        ${heroImage}
        <div class="detail-hero-content">
          <p>${project.is_mock ? "Projeto demonstrativo · " : ""}${escapeHtml(project.course)}</p>
          <h2 id="modal-title">${escapeHtml(project.title)}</h2>
        </div>
      </div>
      <div class="detail-body">
        <div class="detail-main">
          <h3>Sobre o projeto</h3>
          <p>${escapeHtml(project.description || project.short_description)}</p>
          ${links ? `<div class="detail-actions detail-actions-primary">${links}</div>` : ""}
          ${featuresMarkup}
          <h3>Tecnologias utilizadas</h3>
          <div class="technology-list">${technologies}</div>
          ${gallery}
        </div>
        <aside class="detail-side">
          <h3>Informações acadêmicas</h3>
          <dl class="detail-meta">
            <div><dt>Integrantes</dt><dd>${escapeHtml(arrayValue(project.students).join(", "))}</dd></div>
            <div><dt>Curso</dt><dd>${escapeHtml(project.course)}</dd></div>
            <div><dt>Disciplina</dt><dd>${escapeHtml(project.subject)}</dd></div>
            ${project.class_name ? `<div><dt>Turma</dt><dd>${escapeHtml(project.class_name)}</dd></div>` : ""}
          </dl>
        </aside>
      </div>`;
    elements.dialog.showModal();
    document.body.classList.add("dialog-open");
  }

  function clearFilters() {
    state.search = "";
    state.course = "";
    state.subject = "";
    elements.search.value = "";
    elements.courseFilter.value = "";
    elements.subjectFilter.value = "";
    renderProjects();
  }

  function observeReveals() {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal").forEach((element) => element.classList.add("visible"));
      return;
    }
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          currentObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll(".reveal:not(.visible)").forEach((element) => observer.observe(element));
  }

  function bindEvents() {
    elements.search.addEventListener("input", (event) => {
      state.search = event.target.value;
      renderProjects();
    });
    elements.courseFilter.addEventListener("change", (event) => {
      state.course = event.target.value;
      renderProjects();
    });
    elements.subjectFilter.addEventListener("change", (event) => {
      state.subject = event.target.value;
      renderProjects();
    });
    elements.clearFilters.addEventListener("click", clearFilters);
    document.querySelector("[data-clear-filters]").addEventListener("click", clearFilters);
    document.querySelector(".dialog-close").addEventListener("click", () => elements.dialog.close());
    elements.dialog.addEventListener("click", (event) => {
      if (event.target === elements.dialog) elements.dialog.close();
    });
    elements.dialog.addEventListener("close", () => document.body.classList.remove("dialog-open"));
    elements.menuToggle.addEventListener("click", () => {
      const open = elements.navLinks.classList.toggle("open");
      elements.menuToggle.setAttribute("aria-expanded", String(open));
      elements.menuToggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    });
    elements.navLinks.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
      elements.navLinks.classList.remove("open");
      elements.menuToggle.setAttribute("aria-expanded", "false");
    }));
    window.addEventListener("scroll", () => {
      elements.backToTop.classList.toggle("visible", window.scrollY > 560);
    }, { passive: true });
    elements.backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    window.addEventListener("storage", (event) => {
      if (event.key === "ceunsp_mock_projects" && !window.CEUNSP_SUPABASE.configured) loadProjects();
    });
  }

  document.querySelector("#current-year").textContent = new Date().getFullYear();
  bindEvents();
  observeReveals();
  loadProjects();
})();
