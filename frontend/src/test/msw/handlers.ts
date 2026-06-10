/**
 * MSW request handlers — default happy-path responses for the API surface the
 * integration tests touch. Individual tests override with `server.use(...)` to
 * exercise empty / error states.
 *
 * Host is wildcarded (`*`) so handlers match whatever origin jsdom resolves the
 * axios baseURL (`/api/v1`) against.
 */
import { http, HttpResponse } from 'msw';

const API = '*/api/v1';

export const handlers = [
  // ── ERP: projects ──────────────────────────────────────────
  http.get(`${API}/projects`, () =>
    HttpResponse.json([
      {
        id: 'p1', code: 'PRJ-2026-001', name: 'Villa Bonapriso',
        location: 'Douala', project_type: 'construction', client_id: 'c1',
        chef_projet_id: null, budget_initial: 1_000_000, budget_spent: 200_000,
        status: 'EN_COURS', progress: 30, start_date: null, end_date: null,
        estimated_end_date: null, created_at: '2026-01-01T00:00:00', updated_at: null,
      },
    ]),
  ),

  // ── ERP: invoices ──────────────────────────────────────────
  http.get(`${API}/invoices`, () =>
    HttpResponse.json([
      {
        id: 'i1', code: 'FAC-2026-001', project_id: 'p1', client_id: 'c1',
        project_name: 'Villa Bonapriso', client_name: 'Jean Talla',
        invoice_type: 'FACTURE', status: 'ENVOYEE', subtotal: 500_000,
        total: 500_000, amount_paid: 0, issue_date: '2026-03-01', due_date: '2026-04-01',
      },
    ]),
  ),

  // ── Public CMS: stats bar ──────────────────────────────────
  http.get(`${API}/cms/stats`, () =>
    HttpResponse.json([
      { id: 's1', label: 'Projets livrés', value: '120', suffix: '+', sort_order: 0 },
      { id: 's2', label: "Années d'expérience", value: '15', suffix: '', sort_order: 1 },
    ]),
  ),
];
