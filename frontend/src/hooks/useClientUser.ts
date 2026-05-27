/**
 * useClientUser — Provides client user data from AuthContext
 * in the same shape as the old mockUser for backward compatibility.
 */
import { useAuth } from '../context/AuthContext';

interface ClientUser {
  name: string;
  initials: string;
  email: string;
  phone: string;
  role: string;
  projectName: string;
  projectId: string;
}

const FALLBACK: ClientUser = {
  name: 'Client',
  initials: 'CL',
  email: 'client@email.com',
  phone: '',
  role: 'Propriétaire',
  projectName: 'Mon Projet',
  projectId: 'PRJ',
};

export function useClientUser(): ClientUser {
  const { user } = useAuth();
  
  if (!user) return FALLBACK;
  
  const firstName = user.first_name || '';
  const lastName = user.last_name || '';
  
  return {
    name: user.full_name || `${firstName} ${lastName}`.trim() || 'Client',
    initials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'CL',
    email: user.email || '',
    phone: user.phone || '',
    role: 'Propriétaire',
    projectName: 'Mon Projet', // Will be fetched from client API in the future
    projectId: 'PRJ',
  };
}

/**
 * @deprecated Use useClientUser() hook instead. This is kept for backward compatibility.
 */
export const mockUser = FALLBACK;
