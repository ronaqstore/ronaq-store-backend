import { findLoginPhoneConflict } from './login-phone.helper.js';

describe('findLoginPhoneConflict', () => {
  const client = {
    user: { findFirst: jest.fn() },
    platformAdmin: { findFirst: jest.fn() },
    supplier: { findFirst: jest.fn() },
    customer: { findFirst: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    client.user.findFirst.mockResolvedValue(null);
    client.platformAdmin.findFirst.mockResolvedValue(null);
    client.supplier.findFirst.mockResolvedValue(null);
    client.customer.findFirst.mockResolvedValue(null);
  });

  it('returns null when the phone is free', async () => {
    await expect(
      findLoginPhoneConflict(client as any, '923001234567'),
    ).resolves.toBeNull();
  });

  it('returns USER when a shop owner already has the phone', async () => {
    client.user.findFirst.mockResolvedValue({ id: 'u1' });

    await expect(
      findLoginPhoneConflict(client as any, '923001234567'),
    ).resolves.toBe('USER');
  });

  it('returns PLATFORM_ADMIN when a platform admin already has the phone', async () => {
    client.platformAdmin.findFirst.mockResolvedValue({ id: 'a1' });

    await expect(
      findLoginPhoneConflict(client as any, '923001234567'),
    ).resolves.toBe('PLATFORM_ADMIN');
  });

  it('returns SUPPLIER when a supplier already has the phone', async () => {
    client.supplier.findFirst.mockResolvedValue({ id: 's1' });

    await expect(
      findLoginPhoneConflict(client as any, '923001234567'),
    ).resolves.toBe('SUPPLIER');
  });

  it('returns CUSTOMER when a customer already has the phone', async () => {
    client.customer.findFirst.mockResolvedValue({ id: 'c1' });

    await expect(
      findLoginPhoneConflict(client as any, '923001234567'),
    ).resolves.toBe('CUSTOMER');
  });

  it('prefers USER when both somehow match', async () => {
    client.user.findFirst.mockResolvedValue({ id: 'u1' });
    client.platformAdmin.findFirst.mockResolvedValue({ id: 'a1' });

    await expect(
      findLoginPhoneConflict(client as any, '923001234567'),
    ).resolves.toBe('USER');
  });

  it('excludes the current user id when updating', async () => {
    await findLoginPhoneConflict(client as any, '923001234567', {
      excludeUserId: 'u1',
    });

    expect(client.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          phone: '923001234567',
          id: { not: 'u1' },
        }),
      }),
    );
  });

  it('excludes the current supplier id when updating', async () => {
    await findLoginPhoneConflict(client as any, '923001234567', {
      excludeSupplierId: 's1',
    });

    expect(client.supplier.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          phone: '923001234567',
          id: { not: 's1' },
        }),
      }),
    );
  });
});
