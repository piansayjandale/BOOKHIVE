import { superAdminModel } from "../models/super-admin.model.js";
import { adminModel } from "../models/admin.model.js";
import { eventDispatcher } from "../services/event-dispatcher.js";

export const superAdminController = {
  // 1. Dashboard Vitals & Infrastructure Overview
  async getDashboard(req, res) {
    const data = await superAdminModel.getDashboardVitals();
    return res.json(data);
  },

  // 2. User Account CRUD (All User Types)
  async listUsers(req, res) {
    const role = String(req.query.role || "All");
    const status = String(req.query.status || "All");
    const search = String(req.query.search || "");
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Number(req.query.pageSize || 10));

    const result = await superAdminModel.listUsers({ role, status, search, page, pageSize });
    return res.json(result);
  },

  async createUser(req, res) {
    const { name, email, idNumber, password, role, department, course, status } = req.body;

    if (!name || !email || !idNumber || !role) {
      return res.status(400).json({ message: "Name, email, ID number, and role are required." });
    }

    const newUser = await superAdminModel.createUser({
      name,
      email,
      idNumber,
      password,
      role,
      department,
      course,
      status: status || "Active",
    });

    const actor = req.user?.name || "Super Admin";
    await adminModel.addHistoryLog({
      actor: `Super Admin ${actor}`,
      action: "Created User Account",
      target: name,
      module: "System Management",
      detail: `Created account for ${name} (${email}) with role ${role}.`,
    });

    void eventDispatcher.dispatchUserMutation("created", newUser);

    return res.status(201).json({ user: newUser });
  },

  async updateUser(req, res) {
    const { id } = req.params;
    const { name, email, idNumber, role, department, course, status, password } = req.body;

    const updated = await superAdminModel.updateUser(id, {
      name,
      email,
      idNumber,
      role,
      department,
      course,
      status,
      password,
    });

    if (!updated) {
      return res.status(404).json({ message: "User not found or no changes made." });
    }

    const actor = req.user?.name || "Super Admin";
    await adminModel.addHistoryLog({
      actor: `Super Admin ${actor}`,
      action: "Updated User Account",
      target: updated.name,
      module: "System Management",
      detail: `Modified user record for ${updated.name} (Role: ${updated.role}, Status: ${updated.status}).`,
    });

    void eventDispatcher.dispatchUserMutation("updated", updated);

    return res.json({ user: updated });
  },

  async deleteUser(req, res) {
    const { id } = req.params;
    const deleted = await superAdminModel.deleteUser(id);

    if (!deleted) {
      return res.status(404).json({ message: "User not found." });
    }

    const actor = req.user?.name || "Super Admin";
    await adminModel.addHistoryLog({
      actor: `Super Admin ${actor}`,
      action: "Deleted User Account",
      target: deleted.name,
      module: "System Management",
      detail: `Permanently removed account for ${deleted.name} (${deleted.email}).`,
    });

    void eventDispatcher.dispatchUserMutation("deleted", deleted);

    return res.json({ message: "User permanently deleted.", user: deleted });
  },

  // 3. Permanent Data Pruning
  async purgeArchivedBooks(req, res) {
    const result = await superAdminModel.purgeArchivedBooks();
    const actor = req.user?.name || "Super Admin";
    await adminModel.addHistoryLog({
      actor: `Super Admin ${actor}`,
      action: "Purged Archived Books",
      target: `${result.purgedCount} books`,
      module: "System Management",
      detail: `Permanently purged ${result.purgedCount} archived books from the database.`,
    });
    void eventDispatcher.dispatchCatalogMutation("purged", result);
    return res.json(result);
  },

  async purgeDeactivatedAccounts(req, res) {
    const result = await superAdminModel.purgeDeactivatedAccounts();
    const actor = req.user?.name || "Super Admin";
    await adminModel.addHistoryLog({
      actor: `Super Admin ${actor}`,
      action: "Purged Deactivated Accounts",
      target: `${result.purgedCount} accounts`,
      module: "System Management",
      detail: `Permanently purged ${result.purgedCount} deactivated / suspended accounts from the database.`,
    });
    void eventDispatcher.dispatchUserMutation("purged", result);
    return res.json(result);
  },

  // 4. Infrastructure Health
  async getInfrastructure(req, res) {
    const health = await superAdminModel.getInfrastructureHealth();
    return res.json(health);
  },

  async rebuildIndex(req, res) {
    const result = await superAdminModel.rebuildSearchIndex();
    const actor = req.user?.name || "Super Admin";
    await adminModel.addHistoryLog({
      actor: `Super Admin ${actor}`,
      action: "Rebuilt Search Index",
      target: "Neural Search Index",
      module: "Infrastructure",
      detail: "Triggered a full re-index of the BookHive catalog.",
    });
    return res.json(result);
  },

  // 5. Audit & Security Logs
  async listAuditLogs(req, res) {
    const search = String(req.query.search || "");
    const actor = String(req.query.actor || "All");
    const moduleName = String(req.query.module || "All");
    const severity = String(req.query.severity || "All");
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Number(req.query.pageSize || 20));

    const result = await superAdminModel.listAuditLogs({
      search,
      actor,
      moduleName,
      severity,
      from,
      to,
      page,
      pageSize,
    });
    return res.json(result);
  },

  // 6. Master Records (Tabbed: Accounts, Books, Transactions)
  async getRecords(req, res) {
    const tab = String(req.query.tab || "accounts");
    const roleFilter = String(req.query.role || "All");
    const bookStatus = String(req.query.bookStatus || "All");
    const txType = String(req.query.txType || "All");
    const search = String(req.query.search || "");
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Number(req.query.pageSize || 15));

    const result = await superAdminModel.getTabbedRecords({
      tab,
      roleFilter,
      bookStatus,
      txType,
      search,
      page,
      pageSize,
    });
    return res.json(result);
  },

  // 7. Global Settings & Institutional Sync
  async getSettings(req, res) {
    const data = await superAdminModel.getSettings();
    return res.json(data);
  },

  async updateSettings(req, res) {
    const updated = await superAdminModel.updateSettings(req.body);
    const actor = req.user?.name || "Super Admin";
    await adminModel.addHistoryLog({
      actor: `Super Admin ${actor}`,
      action: "Updated Global Settings",
      target: "System Configuration",
      module: "Settings",
      detail: "Updated global platform parameters and environment constants.",
    });
    return res.json(updated);
  },

  async triggerInstitutionalSync(req, res) {
    const result = await superAdminModel.triggerInstitutionalSync();
    const actor = req.user?.name || "Super Admin";
    await adminModel.addHistoryLog({
      actor: `Super Admin ${actor}`,
      action: "Triggered Institutional Sync",
      target: "STI WNU Directory",
      module: "Ecosystem Integration",
      detail: `Synchronized ${result.syncedRecords} records with STI WNU academic ecosystem.`,
    });
    return res.json({ message: "Institutional synchronization completed successfully.", log: result });
  },

  // 8. Database Backups & Snapshots
  async listBackups(req, res) {
    const backups = await superAdminModel.listBackups();
    return res.json({ backups });
  },

  async triggerBackup(req, res) {
    const actor = req.user?.name || "Super Admin";
    const backup = await superAdminModel.triggerBackup({
      backupType: req.body.backupType || "MANUAL",
      createdBy: actor,
    });

    await adminModel.addHistoryLog({
      actor: `Super Admin ${actor}`,
      action: "Created Database Backup",
      target: backup.fileName,
      module: "Disaster Recovery",
      detail: `Created database snapshot ${backup.fileName} (${backup.fileSizeMb} MB).`,
    });

    return res.status(201).json({ backup });
  },

  async restoreBackup(req, res) {
    const { backupId } = req.body;
    if (!backupId) {
      return res.status(400).json({ message: "Backup ID is required." });
    }

    const result = await superAdminModel.restoreBackup(backupId);
    const actor = req.user?.name || "Super Admin";
    await adminModel.addHistoryLog({
      actor: `Super Admin ${actor}`,
      action: "Restored Database Backup",
      target: String(backupId),
      module: "Disaster Recovery",
      detail: `Initiated disaster recovery restore from backup snapshot ID: ${backupId}.`,
    });

    return res.json(result);
  },
};
