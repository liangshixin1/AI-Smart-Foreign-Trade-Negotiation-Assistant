async function handleAdminProfileUpdate(event) {
  event.preventDefault();
  if (!state.auth.user || state.auth.user.role !== "teacher") {
    return;
  }
  const displayName = adminProfileNameInput ? adminProfileNameInput.value.trim() : "";
  if (!displayName) {
    updateInlineStatus(adminProfileStatus, "请填写显示名称", "error");
    return;
  }
  updateInlineStatus(adminProfileStatus, "保存中...", "muted");
  try {
    const response = await fetchWithAuth("/api/account/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "更新失败");
    }
    const data = await response.json();
    if (data.user) {
      state.auth.user = { ...state.auth.user, ...data.user };
      if (adminProfileNameInput) {
        adminProfileNameInput.value = data.user.displayName || data.user.username || displayName;
      }
      updateAuthUI();
    }
    updateInlineStatus(adminProfileStatus, "显示名称已更新", "success");
  } catch (error) {
    console.error(error);
    updateInlineStatus(adminProfileStatus, error.message || "更新失败", "error");
  }
}




async function handleAdminPasswordUpdate(event) {
  event.preventDefault();
  if (!state.auth.user || state.auth.user.role !== "teacher") {
    return;
  }
  const currentPassword = adminPasswordCurrent ? adminPasswordCurrent.value : "";
  const newPassword = adminPasswordNew ? adminPasswordNew.value : "";
  if (!currentPassword || !newPassword) {
    updateInlineStatus(adminPasswordStatus, "请填写完整的密码信息", "error");
    return;
  }
  updateInlineStatus(adminPasswordStatus, "更新中...", "muted");
  try {
    const response = await fetchWithAuth("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "更新密码失败");
    }
    if (adminPasswordCurrent) adminPasswordCurrent.value = "";
    if (adminPasswordNew) adminPasswordNew.value = "";
    updateInlineStatus(adminPasswordStatus, "密码已更新", "success");
  } catch (error) {
    console.error(error);
    updateInlineStatus(adminPasswordStatus, error.message || "更新密码失败", "error");
  }
}



