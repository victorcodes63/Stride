/**
 * Reassign foreign keys from duplicate User `dupId` onto `keeperId`, then delete logic can remove dup.
 * Used by prisma cleanup scripts. Requires DATABASE_URL and merged migrations.
 */

/** Dev DBs may be behind migrations; skip optional modules when the table is missing (P2021). */
async function skipIfMissingTable(label, fn) {
  try {
    await fn();
  } catch (e) {
    if (e && e.code === 'P2021') {
      console.warn(`[cleanup] Skipping ${label} — table not in this database.`);
      return;
    }
    throw e;
  }
}

async function mergeContractManagers(prisma, keeperId, dupId) {
  const rows = await prisma.contractManager.findMany({ where: { userId: dupId } });
  for (const cm of rows) {
    const clash = await prisma.contractManager.findFirst({
      where: { contractId: cm.contractId, userId: keeperId },
    });
    if (clash) {
      await prisma.contractManager.delete({ where: { id: cm.id } });
    } else {
      await prisma.contractManager.update({
        where: { id: cm.id },
        data: { userId: keeperId },
      });
    }
  }
}

async function mergeAccountsStaffAccess(prisma, keeperId, dupId) {
  const rows = await prisma.accountsStaffAccess.findMany({ where: { userId: dupId } });
  for (const a of rows) {
    const sameClient = await prisma.accountsStaffAccess.findFirst({
      where: { userId: keeperId, accountsClientId: a.accountsClientId },
    });
    if (sameClient) {
      await prisma.accountsStaffAccess.update({
        where: { id: sameClient.id },
        data: {
          canManageContracts: sameClient.canManageContracts || a.canManageContracts,
          canManageInvoices: sameClient.canManageInvoices || a.canManageInvoices,
          canManagePayments: sameClient.canManagePayments || a.canManagePayments,
          canManageVendors: sameClient.canManageVendors || a.canManageVendors,
        },
      });
      await prisma.accountsStaffAccess.delete({ where: { id: a.id } });
    } else {
      await prisma.accountsStaffAccess.update({
        where: { id: a.id },
        data: { userId: keeperId },
      });
    }
  }
}

async function mergeStaffLeaveBalances(prisma, keeperId, dupId) {
  const rows = await prisma.staffLeaveBalance.findMany({ where: { userId: dupId } });
  for (const b of rows) {
    const existing = await prisma.staffLeaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: {
          userId: keeperId,
          leaveTypeId: b.leaveTypeId,
          year: b.year,
        },
      },
    });
    if (existing) {
      await prisma.staffLeaveBalance.update({
        where: { id: existing.id },
        data: {
          entitledDays: existing.entitledDays + b.entitledDays,
          usedDays: existing.usedDays + b.usedDays,
          carriedOver: existing.carriedOver + b.carriedOver,
        },
      });
      await prisma.staffLeaveBalance.delete({ where: { id: b.id } });
    } else {
      await prisma.staffLeaveBalance.update({
        where: { id: b.id },
        data: { userId: keeperId },
      });
    }
  }
}

async function mergeUserPermissionOverrides(prisma, keeperId, dupId) {
  try {
    const rows = await prisma.userPermissionOverride.findMany({ where: { userId: dupId } });
    for (const o of rows) {
      const existing = await prisma.userPermissionOverride.findUnique({
        where: {
          userId_permissionId: { userId: keeperId, permissionId: o.permissionId },
        },
      });
      if (existing) {
        await prisma.userPermissionOverride.update({
          where: { id: existing.id },
          data: { isAllowed: existing.isAllowed || o.isAllowed },
        });
        await prisma.userPermissionOverride.delete({ where: { id: o.id } });
      } else {
        await prisma.userPermissionOverride.update({
          where: { id: o.id },
          data: { userId: keeperId },
        });
      }
    }
  } catch (e) {
    if (e && e.code === 'P2021') {
      console.warn('[cleanup] Skipping UserPermissionOverride — table not in this database.');
      return;
    }
    throw e;
  }
}

async function mergeCredentialReminders(prisma, keeperId, dupId) {
  try {
    const rows = await prisma.credentialReminderSent.findMany({ where: { userId: dupId } });
    for (const r of rows) {
      const clash = await prisma.credentialReminderSent.findUnique({
        where: {
          credentialId_userId_kind_sentOnYmd: {
            credentialId: r.credentialId,
            userId: keeperId,
            kind: r.kind,
            sentOnYmd: r.sentOnYmd,
          },
        },
      });
      if (clash) {
        await prisma.credentialReminderSent.delete({ where: { id: r.id } });
      } else {
        await prisma.credentialReminderSent.update({
          where: { id: r.id },
          data: { userId: keeperId },
        });
      }
    }
  } catch (e) {
    if (e && e.code === 'P2021') {
      console.warn('[cleanup] Skipping CredentialReminderSent — table not in this database.');
      return;
    }
    throw e;
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} keeperId
 * @param {string} dupId
 */
async function reassignUserFkColumns(prisma, keeperId, dupId) {
  await mergeContractManagers(prisma, keeperId, dupId);
  await mergeAccountsStaffAccess(prisma, keeperId, dupId);
  await mergeStaffLeaveBalances(prisma, keeperId, dupId);
  await mergeUserPermissionOverrides(prisma, keeperId, dupId);
  await mergeCredentialReminders(prisma, keeperId, dupId);

  const bulk = [
    [
      'StaffLeaveApplication.userId',
      () =>
        prisma.staffLeaveApplication.updateMany({
          where: { userId: dupId },
          data: { userId: keeperId },
        }),
    ],
    [
      'StaffLeaveApplication.reviewedById',
      () =>
        prisma.staffLeaveApplication.updateMany({
          where: { reviewedById: dupId },
          data: { reviewedById: keeperId },
        }),
    ],
    [
      'StaffNotification.userId',
      () =>
        prisma.staffNotification.updateMany({ where: { userId: dupId }, data: { userId: keeperId } }),
    ],
    [
      'LeaveApprovalStep.approverUserId',
      () =>
        prisma.leaveApprovalStep.updateMany({
          where: { approverUserId: dupId },
          data: { approverUserId: keeperId },
        }),
    ],
    [
      'LeaveApprovalAction.actorUserId',
      () =>
        prisma.leaveApprovalAction.updateMany({
          where: { actorUserId: dupId },
          data: { actorUserId: keeperId },
        }),
    ],
    [
      'EssPortalUser.createdByUserId',
      () =>
        prisma.essPortalUser.updateMany({
          where: { createdByUserId: dupId },
          data: { createdByUserId: keeperId },
        }),
    ],
    [
      'AttendanceEvent.createdByUserId',
      () =>
        prisma.attendanceEvent.updateMany({
          where: { createdByUserId: dupId },
          data: { createdByUserId: keeperId },
        }),
    ],
    [
      'AttendanceException.resolvedByUserId',
      () =>
        prisma.attendanceException.updateMany({
          where: { resolvedByUserId: dupId },
          data: { resolvedByUserId: keeperId },
        }),
    ],
    [
      'LeaveBalanceLedger.createdByUserId',
      () =>
        prisma.leaveBalanceLedger.updateMany({
          where: { createdByUserId: dupId },
          data: { createdByUserId: keeperId },
        }),
    ],
    [
      'EmployeeDocument.uploadedBy',
      () =>
        prisma.employeeDocument.updateMany({
          where: { uploadedBy: dupId },
          data: { uploadedBy: keeperId },
        }),
    ],
    [
      'OnboardingTask.assignedToId',
      () =>
        prisma.onboardingTask.updateMany({
          where: { assignedToId: dupId },
          data: { assignedToId: keeperId },
        }),
    ],
    [
      'OnboardingTask.completedById',
      () =>
        prisma.onboardingTask.updateMany({
          where: { completedById: dupId },
          data: { completedById: keeperId },
        }),
    ],
    [
      'DisciplinaryCase.reportedById',
      () =>
        prisma.disciplinaryCase.updateMany({
          where: { reportedById: dupId },
          data: { reportedById: keeperId },
        }),
    ],
    [
      'DisciplinaryCase.resolvedById',
      () =>
        prisma.disciplinaryCase.updateMany({
          where: { resolvedById: dupId },
          data: { resolvedById: keeperId },
        }),
    ],
    [
      'DisciplinaryAction.performedById',
      () =>
        prisma.disciplinaryAction.updateMany({
          where: { performedById: dupId },
          data: { performedById: keeperId },
        }),
    ],
    [
      'DisciplinaryDocument.uploadedById',
      () =>
        prisma.disciplinaryDocument.updateMany({
          where: { uploadedById: dupId },
          data: { uploadedById: keeperId },
        }),
    ],
    [
      'Grievance.resolvedById',
      () =>
        prisma.grievance.updateMany({
          where: { resolvedById: dupId },
          data: { resolvedById: keeperId },
        }),
    ],
  ];
  for (const [label, fn] of bulk) {
    await skipIfMissingTable(label, fn);
  }
}

module.exports = { reassignUserFkColumns };
