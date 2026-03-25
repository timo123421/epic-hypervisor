import { describe, it, expect, vi } from 'vitest';
import { listSnapshots, createSnapshot } from '../libvirt';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, cb) => cb(null, { stdout: 'snap1\nsnap2', stderr: '' }))
}));

describe('libvirt snapshot management', () => {
  it('should list snapshots', async () => {
    const snapshots = await listSnapshots('test-uuid');
    expect(snapshots).toEqual(['snap1', 'snap2']);
  });

  it('should create a snapshot', async () => {
    const result = await createSnapshot('test-uuid', 'snap3');
    expect(result.success).toBe(true);
  });
});
