/**
 * useClientUser — Derives the signed-in client's display profile from AuthContext
 * and their real project (via useClientProject).
 *
 * No mock or default data: when the user or project is absent, the corresponding
 * fields are empty strings so the UI shows adapted empty states rather than
 * placeholder values.
 */
import { useAuth } from '../context/AuthContext';
import { useClientProject } from './useClient';

interface ClientUser {
  name: string;
  initials: string;
  email: string;
  phone: string;
  role: string;
  projectName: string;
  projectId: string;
}

const EMPTY: ClientUser = {
  name: '',
  initials: '',
  email: '',
  phone: '',
  role: 'Propriétaire',
  projectName: '',
  projectId: '',
};

export function useClientUser(): ClientUser {
  const { user } = useAuth();
  const { data: project } = useClientProject();

  if (!user) return EMPTY;

  const firstName = user.first_name || '';
  const lastName = user.last_name || '';
  const proj = (project as any) || {};

  return {
    name: user.full_name || `${firstName} ${lastName}`.trim() || '',
    initials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase(),
    email: user.email || '',
    phone: user.phone || '',
    role: 'Propriétaire',
    projectName: proj.name || proj.project_name || proj.label || '',
    projectId: proj.id || proj.code || '',
  };
}
