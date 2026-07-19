"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { ThemeMode, ProjectSite } from "@/lib/types";

type User = {
  id: string;
  username: string;
  email: string;
  role: string;
  companyId: string;
  active: boolean;
  mustChangePassword: boolean;
  lastLogin?: string;
  name?: string;
  projectId?: string;
};

type UserManagementProps = {
  companyId: string;
  projects: ProjectSite[];
  theme: ThemeMode;
  onMessage: (message: string, tone?: "success" | "error") => void;
};

export default function UserManagement({
  companyId,
  projects,
  theme,
  onMessage,
}: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");

  // Forms & Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Create form states
  const [usernameDraft, setUsernameDraft] = useState("");
  const [tempPasswordDraft, setTempPasswordDraft] = useState("");
  const [roleDraft, setRoleDraft] = useState("worker");
  const [nameDraft, setNameDraft] = useState("");
  const [projectDraft, setProjectDraft] = useState("");

  // Edit form states
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editProject, setEditProject] = useState("");

  // Reset form states
  const [resetPassword, setResetPassword] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/company/users?companyId=${encodeURIComponent(companyId)}`);
      const data = await res.json();
      if (res.ok && data.users) {
        setUsers(data.users);
      } else {
        onMessage(data.error || "Failed to fetch users", "error");
      }
    } catch {
      onMessage("Failed to fetch users", "error");
    } finally {
      setLoading(false);
    }
  }, [companyId, onMessage]);

  useEffect(() => {
    if (companyId) {
      fetchUsers();
    }
  }, [companyId, fetchUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const uName = (u.username || "").toLowerCase();
      const dispName = (u.name || "").toLowerCase();
      const matchSearch =
        uName.includes(search.toLowerCase()) || dispName.includes(search.toLowerCase());
      const matchRole = roleFilter ? u.role === roleFilter : true;
      const matchProject = projectFilter ? u.projectId === projectFilter : true;
      return matchSearch && matchRole && matchProject;
    });
  }, [users, search, roleFilter, projectFilter]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameDraft || !tempPasswordDraft || !roleDraft) {
      onMessage("Please fill in all required fields", "error");
      return;
    }

    try {
      const res = await fetch("/api/company/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "create-user",
          companyId,
          username: usernameDraft,
          tempPassword: tempPasswordDraft,
          role: roleDraft,
          name: nameDraft,
          projectId: projectDraft || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onMessage("User created successfully!", "success");
        setShowCreateModal(false);
        setUsernameDraft("");
        setTempPasswordDraft("");
        setRoleDraft("worker");
        setNameDraft("");
        setProjectDraft("");
        fetchUsers();
      } else {
        onMessage(data.error || "Failed to create user", "error");
      }
    } catch {
      onMessage("Network error. Failed to create user.", "error");
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const res = await fetch("/api/company/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "edit-user",
          companyId,
          username: selectedUser.username,
          name: editName,
          role: editRole,
          active: editActive,
          projectId: editProject || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onMessage("User updated successfully!", "success");
        setShowEditModal(false);
        fetchUsers();
      } else {
        onMessage(data.error || "Failed to update user", "error");
      }
    } catch {
      onMessage("Network error. Failed to update user.", "error");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !resetPassword) return;

    try {
      const res = await fetch("/api/company/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "reset-password",
          companyId,
          username: selectedUser.username,
          tempPassword: resetPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onMessage("Password reset successfully. Forced change on login active.", "success");
        setShowResetModal(false);
        setResetPassword("");
      } else {
        onMessage(data.error || "Failed to reset password", "error");
      }
    } catch {
      onMessage("Network error. Failed to reset password.", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="liquid-surface rounded-[2rem] p-6 border border-white/10 bg-white/5 relative overflow-hidden">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs font-black uppercase tracking-[0.25em] text-emerald-500">
              User Management
            </span>
            <h2 className="mt-2 text-2xl font-black">Company Users</h2>
            <p className="mt-1 text-sm font-semibold opacity-60">
              Only authenticated administrators can manage users, assign roles, reset passwords, or enable/disable accounts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn-hover-effect rounded-xl bg-primary text-background px-4 py-2.5 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-primary/10"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            Create User
          </button>
        </div>

        {/* Search & Filters */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative col-span-1 md:col-span-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 opacity-40 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder="Search by username or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 text-xs font-semibold outline-none focus:border-white transition"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs font-semibold outline-none focus:border-white transition text-white"
          >
            <option value="">All Roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="supervisor">Supervisor</option>
            <option value="accountant">Accountant</option>
            <option value="worker">Worker</option>
          </select>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-xs font-semibold outline-none focus:border-white transition text-white"
          >
            <option value="">All Projects / Sites</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* User cards list */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 opacity-50 font-bold">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-8 opacity-50 font-bold">No users match criteria.</div>
        ) : (
          filteredUsers.map((u) => (
            <div
              key={u.id}
              className={`rounded-[1.5rem] p-5 border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 ${
                theme === "dark" ? "bg-white/5 border-white/10" : "bg-black/5 border-black/5"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-neutral-300 dark:bg-white/10 rounded-full flex items-center justify-center font-black text-xl text-neutral-800 dark:text-white">
                  {(u.name || u.username).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black">{u.name || u.username}</span>
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        u.active
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-red-500/10 text-red-500"
                      }`}
                    >
                      {u.active ? "Active" : "Disabled"}
                    </span>
                    {u.mustChangePassword && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
                        Force Change Pwd
                      </span>
                    )}
                  </div>
                  <p className="text-xs opacity-50 font-semibold mt-0.5">
                    @{u.username} · {u.role.toUpperCase()}
                  </p>
                  {u.lastLogin && (
                    <p className="text-[10px] opacity-40 font-semibold mt-1">
                      Last Login: {new Date(u.lastLogin).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(u);
                    setEditName(u.name || u.username);
                    setEditRole(u.role);
                    setEditActive(u.active);
                    setEditProject(u.projectId || "");
                    setShowEditModal(true);
                  }}
                  className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold transition flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(u);
                    setShowResetModal(true);
                  }}
                  className="rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 px-3 py-1.5 text-xs font-bold transition flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">key</span>
                  Reset Pwd
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-[2rem] w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-white">Create New User</h3>
            <p className="text-xs opacity-60 font-semibold mt-1">
              Creates a secure admin-created company user account. Plaintext passwords are never stored.
            </p>

            <form onSubmit={handleCreateUser} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-emerald-500 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. janesmith"
                  value={usernameDraft}
                  onChange={(e) => setUsernameDraft(e.target.value)}
                  className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm font-semibold outline-none focus:border-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-emerald-500 mb-1">
                  Full Name / Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jane Smith"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm font-semibold outline-none focus:border-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-emerald-500 mb-1">
                  Temporary Password *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Temp@1234"
                  value={tempPasswordDraft}
                  onChange={(e) => setTempPasswordDraft(e.target.value)}
                  className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm font-semibold outline-none focus:border-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-emerald-500 mb-1">
                  Assigned Role *
                </label>
                <select
                  value={roleDraft}
                  onChange={(e) => setRoleDraft(e.target.value)}
                  className="w-full h-11 bg-neutral-900 border border-white/10 rounded-xl px-4 text-sm font-semibold outline-none focus:border-white transition text-white"
                >
                  <option value="manager">Manager</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="accountant">Accountant</option>
                  <option value="worker">Worker</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-emerald-500 mb-1">
                  Assigned Project / Site
                </label>
                <select
                  value={projectDraft}
                  onChange={(e) => setProjectDraft(e.target.value)}
                  className="w-full h-11 bg-neutral-900 border border-white/10 rounded-xl px-4 text-sm font-semibold outline-none focus:border-white transition text-white"
                >
                  <option value="">No Project Assigned</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-12 bg-primary text-background rounded-xl text-xs font-bold transition"
                >
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-[2rem] w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-white">Edit User Profile</h3>
            <p className="text-xs opacity-60 font-semibold mt-1">
              Update name, role, site assignment, and active status for @{selectedUser.username}.
            </p>

            <form onSubmit={handleEditUser} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-emerald-500 mb-1">
                  Full Name / Display Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm font-semibold outline-none focus:border-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-emerald-500 mb-1">
                  Assigned Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full h-11 bg-neutral-900 border border-white/10 rounded-xl px-4 text-sm font-semibold outline-none focus:border-white transition text-white"
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="accountant">Accountant</option>
                  <option value="worker">Worker</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-emerald-500 mb-1">
                  Assigned Project / Site
                </label>
                <select
                  value={editProject}
                  onChange={(e) => setEditProject(e.target.value)}
                  className="w-full h-11 bg-neutral-900 border border-white/10 rounded-xl px-4 text-sm font-semibold outline-none focus:border-white transition text-white"
                >
                  <option value="">No Project Assigned</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5">
                <div>
                  <p className="text-xs font-black text-white">Account Status</p>
                  <p className="text-[10px] opacity-50 font-semibold mt-0.5">
                    Disabled accounts cannot log in to the application.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="w-5 h-5 rounded border-white/20 bg-white/5 text-primary focus:ring-0 focus:ring-offset-0 transition cursor-pointer"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-12 bg-primary text-background rounded-xl text-xs font-bold transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-[2rem] w-full max-w-md p-6 relative">
            <h3 className="text-lg font-black text-white">Reset User Password</h3>
            <p className="text-xs opacity-60 font-semibold mt-1">
              Reset password for @{selectedUser.username}. The user will be forced to change password at next login.
            </p>

            <form onSubmit={handleResetPassword} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-emerald-500 mb-1">
                  New Temporary Password *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Temp@5678"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm font-semibold outline-none focus:border-white transition"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-12 bg-primary text-background rounded-xl text-xs font-bold transition"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
