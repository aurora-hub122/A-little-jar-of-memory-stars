/* The original eight memories stay in HTML. This file adds the shared jar. */
(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const config = window.STAR_JAR_CONFIG || {};
  const colors = { rose: "#e4a6ba", lavender: "#bcb0d9", sage: "#b3c9a9", butter: "#ead37f", blue: "#a8c9da" };
  const form = $("#star-form");
  const writeDialog = $("#write-dialog");
  const visitorDialog = $("#visitor-dialog");
  const originalStars = [...document.querySelectorAll(".star-field > a")];
  const PAGE_SIZE = 8;
  let client, userId, mode = "aurora", page = 0, rows = [], total = 0;
  let selected, previewUrl, busy = false, loadVersion = 0, captchaToken = "", captchaWidget;
  let pendingSubmission; // Keeps a retry id stable if the network loses the reply.
  let deletionConfirmed = false;

  $(".contribute").hidden = false;
  $(".jar-switch").hidden = false;
  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });
  document.querySelectorAll("dialog").forEach(dialog => {
    dialog.addEventListener("click", event => { if (event.target === dialog && !busy) dialog.close(); });
  });
  writeDialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
  function status(message) { $("#form-status").textContent = message; }
  function collectionStatus(message) {
    $("#collection-status").textContent = message;
    $("#collection-status").hidden = !message;
  }
  function setBusy(value) {
    busy = value;
    form.setAttribute("aria-busy", String(value));
    form.querySelectorAll("input, textarea, select, button").forEach(el => { el.disabled = value; });
    writeDialog.querySelector("[data-close]").disabled = value;
    $(".fold-button").textContent = value ? "Folding your memory…" : "Fold & place in the jar ✧";
  }
  function clearPhoto() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    $("#image-preview").removeAttribute("src");
    $("#star-image").value = "";
    $(".upload-preview").hidden = true;
  }
  function validPhoto(file) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Please choose a JPG, PNG or WebP photograph.");
    if (file.size > 5 * 1024 * 1024) throw new Error("This photograph is a little large. Please choose one under 5 MB.");
  }
  $("#star-image").addEventListener("change", () => {
    const file = $("#star-image").files[0];
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    try {
      validPhoto(file);
      previewUrl = file ? URL.createObjectURL(file) : null;
      $(".upload-preview").hidden = !file;
      if (file) $("#image-preview").src = previewUrl;
      status("");
    } catch (error) { clearPhoto(); status(error.message); }
  });
  $("#remove-image").addEventListener("click", clearPhoto);
  $("#star-story").addEventListener("input", () => {
    $("#story-count").textContent = `${$("#star-story").value.length.toLocaleString()} / 3,000`;
  });
  $("#star-color").addEventListener("change", () => {
    writeDialog.style.setProperty("--chosen-paper", colors[$("#star-color").value]);
  });

  // Re-encode a small image; this also removes the original photo's metadata.
  async function preparePhoto(file) {
    validPhoto(file);
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fffdfb";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("This image could not be prepared. Please try another photograph.")), "image/jpeg", 0.84));
    } finally { bitmap.close(); }
  }

  let captchaPromise;
  function prepareCaptcha() {
    if (!config.turnstileSiteKey || userId) return Promise.resolve();
    if (captchaPromise) return captchaPromise;
    captchaPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.onload = () => {
        captchaWidget = window.turnstile.render("#captcha", {
          sitekey: config.turnstileSiteKey, theme: "light",
          callback: token => { captchaToken = token; },
          "expired-callback": () => { captchaToken = ""; },
          "error-callback": () => { captchaToken = ""; status("The visitor check could not load. Please reopen the paper and try again."); }
        });
        resolve();
      };
      script.onerror = () => { script.remove(); captchaPromise = null; reject(new Error("The visitor check could not connect. Please try again.")); };
      document.head.append(script);
    });
    return captchaPromise;
  }
  $("#write-star").addEventListener("click", async () => {
    writeDialog.showModal();
    if (!client) {
      status("The shared jar is not connected yet. You can try writing here, but your memory cannot be uploaded yet.");
      return;
    }
    status("");
    try { await prepareCaptcha(); } catch (error) { status(error.message); }
  });
  async function ensureVisitor() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session) { userId = data.session.user.id; return; }
    if (config.turnstileSiteKey && !captchaToken) throw new Error("Please finish the visitor check before folding your star.");
    const result = await client.auth.signInAnonymously({ options: { captchaToken: captchaToken || undefined } });
    if (captchaWidget !== undefined) window.turnstile.reset(captchaWidget);
    captchaToken = "";
    if (result.error) throw new Error("We couldn’t start your visitor session. Please try again; the jar’s owner may need to check sharing settings.");
    userId = result.data.user.id;
    $("#captcha").hidden = true;
  }

  function showMode(next) {
    mode = next;
    loadVersion++;
    originalStars.forEach(el => { el.hidden = mode !== "aurora"; });
    document.querySelectorAll(".visitor-star").forEach(el => el.remove());
    $("#aurora-stars").setAttribute("aria-pressed", String(mode === "aurora"));
    $("#visitor-stars").setAttribute("aria-pressed", String(mode === "shared"));
    $(".shared-pagination").hidden = true;
    $(".jar-area").setAttribute("aria-label", mode === "aurora" ? "Aurora’s eight memory stars" : "Memory stars shared by visitors");
    $(".jar-heading span").textContent = mode === "aurora" ? "8 memories folded inside" : "memories we keep together";
    collectionStatus("");
    if (mode === "shared") { page = 0; void loadStars(); }
  }
  $("#aurora-stars").addEventListener("click", () => showMode("aurora"));
  $("#visitor-stars").addEventListener("click", () => showMode("shared"));
  $("#previous-stars").addEventListener("click", () => { if (page > 0) { page--; void loadStars(); } });
  $("#next-stars").addEventListener("click", () => { if ((page + 1) * PAGE_SIZE < total) { page++; void loadStars(); } });

  async function loadStars() {
    const version = ++loadVersion;
    document.querySelectorAll(".visitor-star").forEach(el => el.remove());
    $(".shared-pagination").hidden = true;
    if (!client) { collectionStatus("The shared jar is waiting to be connected. Aurora’s stars are ready to open."); return; }
    collectionStatus("Finding the little things people kept…");
    try {
      const result = await client.from("memory_stars").select("id,title,story,author,color,image_path,created_at", { count: "exact" })
        .order("created_at", { ascending: false }).order("id", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (version !== loadVersion || mode !== "shared") return;
      if (result.error) throw result.error;
      rows = result.data;
      total = result.count || 0;
      if (!rows.length && page > 0) { page = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1); return loadStars(); }
      rows.forEach((row, index) => {
        const star = document.createElement("button");
        star.type = "button";
        star.className = `paper-star visitor-star star-0${index + 1}`;
        star.style.setProperty("--star-color", colors[row.color] || colors.rose);
        star.setAttribute("aria-label", `Open shared memory: ${row.title}`);
        star.title = row.title;
        const mark = document.createElement("b");
        mark.textContent = "✧";
        star.append(mark);
        star.addEventListener("click", () => openMemory(row));
        $(".star-field").append(star);
      });
      $(".jar-heading span").textContent = `${total} shared ${total === 1 ? "memory" : "memories"} folded inside`;
      $(".shared-pagination").hidden = total <= PAGE_SIZE;
      $("#page-label").textContent = `${page + 1} / ${Math.max(1, Math.ceil(total / PAGE_SIZE))}`;
      $("#previous-stars").disabled = page === 0;
      $("#next-stars").disabled = (page + 1) * PAGE_SIZE >= total;
      collectionStatus(total ? "" : "The first shared star could be yours.");
    } catch (_) { if (version === loadVersion) collectionStatus("The shared memories couldn’t load. Tap Everyone’s stars to try again."); }
  }

  async function openMemory(row) {
    selected = row;
    deletionConfirmed = false;
    $("#visitor-title").textContent = row.title;
    $("#visitor-story").textContent = row.story;
    $("#visitor-signature").textContent = `kept by ${row.author || "someone who remembers"}`;
    $("#visitor-date").textContent = `folded ${new Date(row.created_at).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}`;
    $("#visitor-status").textContent = "";
    $("#delete-star").hidden = true;
    $("#delete-star").textContent = "Remove my star";
    visitorDialog.style.setProperty("--chosen-paper", colors[row.color] || colors.rose);
    const image = $("#visitor-photo img");
    image.removeAttribute("src");
    $("#visitor-photo").hidden = !row.image_path;
    if (row.image_path) {
      image.onerror = () => { $("#visitor-photo").hidden = true; $("#visitor-status").textContent = "This photograph is temporarily unavailable."; };
      image.src = client.storage.from("memory-photos").getPublicUrl(row.image_path).data.publicUrl;
    }
    visitorDialog.showModal();
    // Ownership is checked on the server, without exposing visitor IDs publicly.
    if (userId) {
      const result = await client.rpc("owns_memory_star", { star_id: row.id });
      if (selected?.id === row.id && !result.error) $("#delete-star").hidden = !result.data;
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    if (!client) { status("Your words have not been uploaded. The jar’s owner needs to connect sharing first."); return; }
    const values = {
      title: $("#star-title").value.trim(), story: $("#star-story").value.trim(),
      author: $("#star-author").value.trim(), color: $("#star-color").value
    };
    if (!values.title || values.story.length < 10) { status("Give your memory a name and at least ten characters of story."); return; }
    const file = $("#star-image").files[0];
    const fingerprint = JSON.stringify([values, file?.name, file?.size, file?.lastModified]);
    setBusy(true);
    try {
      await ensureVisitor();
      // First reconcile an uncertain previous request before creating anything else.
      if (pendingSubmission) {
        const check = await client.from("memory_stars").select("id").eq("id", pendingSubmission.id).maybeSingle();
        if (check.error) throw new Error("We couldn’t confirm your last upload. Please retry when your connection returns.");
        if (check.data) { finishSubmission(); return; }
        if (pendingSubmission.fingerprint !== fingerprint) {
          if (pendingSubmission.path) await client.storage.from("memory-photos").remove([pendingSubmission.path]);
          pendingSubmission = null;
        }
      }
      pendingSubmission ||= { id: crypto.randomUUID(), fingerprint, path: null };
      const submission = pendingSubmission;
      if (file && !submission.path) {
        status("Tucking in your photograph…");
        const photo = await preparePhoto(file);
        const path = `${userId}/${submission.id}.jpg`;
        const upload = await client.storage.from("memory-photos").upload(path, photo, { contentType: "image/jpeg", upsert: false });
        // An interrupted reply may hide a successful upload; confirm its exact path.
        if (upload.error) {
          const existing = await client.storage.from("memory-photos").list(userId, { search: `${submission.id}.jpg`, limit: 1 });
          if (existing.error || !existing.data?.some(item => item.name === `${submission.id}.jpg`))
            throw new Error("Your photo couldn’t upload. Please check your connection and try again.");
        }
        submission.path = path;
      }
      status("Folding your memory into the shared jar…");
      const result = await client.rpc("create_memory_star", {
        star_id: submission.id, star_title: values.title, star_story: values.story,
        star_author: values.author, star_color: values.color, star_image: submission.path
      });
      if (result.error) {
        if (result.error.message?.includes("star_limit")) throw new Error("You’ve folded five stars in the past day, or reached this visitor’s 50-star limit. Please return another day.");
        throw new Error("We couldn’t confirm the save. Your words are still here. Please retry; we’ll check for your star before sending it again.");
      }
      finishSubmission();
    } catch (error) { status(error.message || "Your star couldn’t be saved. Please try again."); }
    finally { setBusy(false); }
  });
  function finishSubmission() {
    pendingSubmission = null;
    form.reset();
    clearPhoto();
    $("#story-count").textContent = "0 / 3,000";
    writeDialog.style.removeProperty("--chosen-paper");
    writeDialog.close();
    showMode("shared");
    collectionStatus("Your star is now in the shared jar. Thank you for leaving a little of your world here.");
  }
  $("#delete-star").addEventListener("click", async () => {
    if (!selected) return;
    if (!deletionConfirmed) {
      deletionConfirmed = true;
      $("#delete-star").textContent = "Yes, remove this star";
      $("#visitor-status").textContent = "This removes your story and photograph from the shared jar. This cannot be undone.";
      return;
    }
    const row = selected;
    $("#delete-star").disabled = true;
    try {
      // Remove the file first so a failed deletion can be retried from the star.
      if (row.image_path) {
        const photo = await client.storage.from("memory-photos").remove([row.image_path]);
        if (photo.error) throw photo.error;
      }
      const result = await client.rpc("delete_memory_star", { star_id: row.id });
      if (result.error) throw result.error;
      visitorDialog.close();
      await loadStars();
    } catch (_) { $("#visitor-status").textContent = "We couldn’t finish removing this star. Please try again."; }
    finally { $("#delete-star").disabled = false; }
  });

  if (config.supabaseUrl && config.supabasePublicKey && window.supabase) {
    try {
      client = window.supabase.createClient(config.supabaseUrl, config.supabasePublicKey);
      client.auth.getSession().then(({ data }) => { userId = data.session?.user.id; }).catch(() => {});
    } catch (_) { client = null; }
  }
  // Refresh on return to the page, without taking visitors away from an open letter.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && mode === "shared" && !visitorDialog.open && !writeDialog.open) void loadStars();
  });
})();
