import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('../src/auth/current-user', () => ({
  currentUserProvider: () => Promise.resolve({ getCurrentUser: mocks.currentUser }),
}));

import LineEntryPage from '../app/line/page';

describe('LINE entry page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens LINE login for a signed-out visitor', async () => {
    mocks.currentUser.mockResolvedValue(null);

    await expect(LineEntryPage()).rejects.toThrow('REDIRECT:/login');
  });

  it('opens the Bunshin list for a signed-in visitor', async () => {
    mocks.currentUser.mockResolvedValue({ userId: 'user-a' });

    await expect(LineEntryPage()).rejects.toThrow('REDIRECT:/bunshins');
  });
});
