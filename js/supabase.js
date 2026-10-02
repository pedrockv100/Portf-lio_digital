(function () {
  "use strict";

  const config = window.CEUNSP_CONFIG || {};
  const url = String(config.SUPABASE_URL || "").trim();
  const key = String(config.SUPABASE_ANON_KEY || "").trim();
  const configured = Boolean(url && key && window.supabase?.createClient);
  const client = configured ? window.supabase.createClient(url, key) : null;
  const bucket = "project-images";

  function fileExtension(file) {
    const extension = String(file.name || "").split(".").pop().toLowerCase();
    return extension && extension.length <= 8 ? extension : "jpg";
  }

  function safeSlug(value) {
    return String(value || "projeto")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "projeto";
  }

  async function uploadFile(file, projectTitle, folder) {
    if (!file) return null;
    const unique = `${Date.now()}-${crypto.randomUUID()}.${fileExtension(file)}`;
    const storagePath = `${safeSlug(projectTitle)}/${folder}/${unique}`;
    const { error } = await client.storage.from(bucket).upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false
    });
    if (error) throw error;
    const { data } = client.storage.from(bucket).getPublicUrl(storagePath);
    return { image_url: data.publicUrl, storage_path: storagePath };
  }

  function adminClaim(session) {
    return session?.user?.app_metadata?.role === "admin";
  }

  async function getSession() {
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function getProjects() {
    if (!client) return [];
    const { data, error } = await client
      .from("projects")
      .select("*, project_images(id, image_url, storage_path, created_at)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function createProject(payload, coverFile, additionalFiles) {
    const cover = await uploadFile(coverFile, payload.title, "cover");
    const insertPayload = {
      ...payload,
      cover_image: cover?.image_url || "",
      cover_storage_path: cover?.storage_path || null
    };

    const { data: project, error } = await client
      .from("projects")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      if (cover?.storage_path) await client.storage.from(bucket).remove([cover.storage_path]);
      throw error;
    }

    const uploaded = [];
    for (const file of additionalFiles || []) {
      uploaded.push(await uploadFile(file, payload.title, "gallery"));
    }

    if (uploaded.length) {
      const { error: imagesError } = await client.from("project_images").insert(
        uploaded.map((image) => ({
          project_id: project.id,
          image_url: image.image_url,
          storage_path: image.storage_path
        }))
      );
      if (imagesError) throw imagesError;
    }

    return project;
  }

  async function updateProject(id, payload, coverFile, additionalFiles) {
    const current = (await getProjects()).find((project) => String(project.id) === String(id));
    const cover = coverFile ? await uploadFile(coverFile, payload.title, "cover") : null;
    const updatePayload = {
      ...payload,
      ...(cover ? { cover_image: cover.image_url, cover_storage_path: cover.storage_path } : {})
    };

    const { data, error } = await client.from("projects").update(updatePayload).eq("id", id).select().single();
    if (error) throw error;

    if (cover && current?.cover_storage_path) {
      await client.storage.from(bucket).remove([current.cover_storage_path]);
    }

    const uploaded = [];
    for (const file of additionalFiles || []) {
      uploaded.push(await uploadFile(file, payload.title, "gallery"));
    }
    if (uploaded.length) {
      const { error: imagesError } = await client.from("project_images").insert(
        uploaded.map((image) => ({ project_id: id, ...image }))
      );
      if (imagesError) throw imagesError;
    }
    return data;
  }

  async function deleteProject(id) {
    const { data: project, error: readError } = await client
      .from("projects")
      .select("cover_storage_path, project_images(storage_path)")
      .eq("id", id)
      .single();
    if (readError) throw readError;

    const paths = [
      project.cover_storage_path,
      ...(project.project_images || []).map((image) => image.storage_path)
    ].filter(Boolean);
    if (paths.length) {
      const { error: storageError } = await client.storage.from(bucket).remove(paths);
      if (storageError) throw storageError;
    }

    const { error } = await client.from("projects").delete().eq("id", id);
    if (error) throw error;
  }

  function subscribeProjects(callback) {
    if (!client) return () => {};
    const channel = client
      .channel("public-projects")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, callback)
      .subscribe();
    return () => client.removeChannel(channel);
  }

  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  }

  async function signOut() {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  window.CEUNSP_SUPABASE = {
    client,
    configured,
    adminClaim,
    getSession,
    getProjects,
    createProject,
    updateProject,
    deleteProject,
    subscribeProjects,
    signIn,
    signOut
  };
})();
