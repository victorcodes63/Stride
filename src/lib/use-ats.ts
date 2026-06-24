'use client';

import { useMemo } from 'react';
import { atsClient } from '@/lib/ats-api';

/** Stable ATS API bindings for client components. */
export function useATS() {
  return useMemo(
    () => ({
      getJobListings: atsClient.getJobListings.bind(atsClient),
      getJobById: atsClient.getJobById.bind(atsClient),
      submitApplication: atsClient.submitApplication.bind(atsClient),
      submitApplicationFull: atsClient.submitApplicationFull.bind(atsClient),
      getApplicationStatus: atsClient.getApplicationStatus.bind(atsClient),
      createCandidate: atsClient.createCandidate.bind(atsClient),
      updateCandidate: atsClient.updateCandidate.bind(atsClient),
      getEmployerById: atsClient.getEmployerById.bind(atsClient),
      getJobAnalytics: atsClient.getJobAnalytics.bind(atsClient),
      requestRequisitionApproval: atsClient.requestRequisitionApproval.bind(atsClient),
      submitInterviewScorecard: atsClient.submitInterviewScorecard.bind(atsClient),
      requestOfferApproval: atsClient.requestOfferApproval.bind(atsClient),
      convertHiredCandidateToEmployee: atsClient.convertHiredCandidateToEmployee.bind(atsClient),
      uploadResume: atsClient.uploadResume.bind(atsClient),
      uploadDocument: atsClient.uploadDocument.bind(atsClient),
    }),
    [],
  );
}
