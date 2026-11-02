/**
 * ERP data hooks — MSW network-level integration.
 *
 * Exercises the real React-Query → axios → HTTP path with MSW standing in for
 * the backend, asserting both the populated and the empty-state branches.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { useProjects, useInvoices } from '../hooks/useErp';
import { server } from './msw/server';
import { makeWrapper } from './utils';

describe('useProjects (MSW)', () => {
  it('returns the mocked project list', async () => {
    const { result } = renderHook(() => useProjects(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const data = result.current.data as any[];
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('Villa Bonapriso');
    expect(data[0].status).toBe('EN_COURS');
  });

  it('handles an empty list (adapted empty state)', async () => {
    server.use(http.get('*/api/v1/projects', () => HttpResponse.json([])));
    const { result } = renderHook(() => useProjects(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('surfaces a server error instead of silently mocking', async () => {
    server.use(
      http.get('*/api/v1/projects', () => new HttpResponse(null, { status: 500 })),
    );
    const { result } = renderHook(() => useProjects(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useInvoices (MSW)', () => {
  it('returns the mocked invoice list', async () => {
    const { result } = renderHook(() => useInvoices(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const data = result.current.data as any[];
    expect(data[0].code).toBe('FAC-2026-001');
    expect(data[0].total).toBe(500_000);
  });
});
