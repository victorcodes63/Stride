import { redirect } from 'next/navigation';

/** Legacy path: multi-employer “clients” list — recruitment uses a single primary workspace. */
export default function DashboardClientsRedirect() {
 redirect('/dashboard/recruitment/profile');
}
