import { vi, describe, it, expect, beforeEach } from 'vitest';
import { startVM, stopVM, forceStopVM, deleteVM, renameVM, migrateVM } from './libvirt';
import { exec } from 'child_process';
import { promisify } from 'util';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, cb) => cb(null, { stdout: 'success' }))
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe('libvirt VM operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call virsh start', async () => {
    await startVM('test-uuid');
    expect(exec).toHaveBeenCalledWith(expect.stringContaining('virsh start test-uuid'), expect.any(Function));
  });

  it('should call virsh shutdown', async () => {
    await stopVM('test-uuid');
    expect(exec).toHaveBeenCalledWith(expect.stringContaining('virsh shutdown test-uuid'), expect.any(Function));
  });

  it('should call virsh destroy', async () => {
    await forceStopVM('test-uuid');
    expect(exec).toHaveBeenCalledWith(expect.stringContaining('virsh destroy test-uuid'), expect.any(Function));
  });

  it('should call virsh undefine', async () => {
    await deleteVM('test-uuid');
    expect(exec).toHaveBeenCalledWith(expect.stringContaining('virsh undefine test-uuid'), expect.any(Function));
  });

  it('should call virsh domrename', async () => {
    await renameVM('test-uuid', 'new-name');
    expect(exec).toHaveBeenCalledWith(expect.stringContaining('virsh domrename test-uuid new-name'), expect.any(Function));
  });

  it('should call virsh migrate', async () => {
    await migrateVM('test-uuid', 'target-node');
    expect(exec).toHaveBeenCalledWith(expect.stringContaining('virsh migrate --live test-uuid qemu+ssh://target-node/system'), expect.any(Function));
  });
});
