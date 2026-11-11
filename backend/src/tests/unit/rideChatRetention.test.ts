/**
 * @fileoverview A ride's chat is kept for a day after the trip, then deleted
 * @author Oabona-Majoko
 * @created 2026-11-11
 * @lastModified 2026-11-11
 */

import { sequelize } from '../../config/database';
import GroupChatService, { RIDE_CHAT_RETENTION_HOURS, RideChatNotKeptError } from '../../services/GroupChatService';
import GroupChat, { GroupChatStatus } from '../../models/GroupChat';
import GroupChatParticipant from '../../models/GroupChatParticipant';
import GroupChatMessage from '../../models/GroupChatMessage';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

const HOUR = 60 * 60 * 1000;

describe('ride chat retention', () => {
  const service = new GroupChatService();
  const tx = { commit: jest.fn(), rollback: jest.fn() };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(sequelize, 'transaction').mockResolvedValue(tx as any);
    jest.spyOn(GroupChat, 'update').mockResolvedValue([1] as any);
    jest.spyOn(GroupChatParticipant, 'update').mockResolvedValue([1] as any);
    jest.spyOn(GroupChatMessage, 'create').mockResolvedValue({} as any);
    jest.spyOn(GroupChatMessage, 'destroy').mockResolvedValue(3 as any);
    jest.spyOn(service as any, 'getSocketService').mockReturnValue(null);
    jest.spyOn(service as any, 'chatCreator').mockResolvedValue('driver-1');
  });

  it('keeps the chat for 24 hours', () => {
    expect(RIDE_CHAT_RETENTION_HOURS).toBe(24);
  });

  it('on completion, says when the chat goes and schedules it a day ahead, whatever the group settings', async () => {
    const group = { id: 'group-1', rideId: 'ride-1', settings: { autoDisbandOnRideCompletion: false, disbandDelay: 500 }, metadata: { note: 'kept' } };
    jest.spyOn(GroupChat, 'findAll').mockResolvedValue([group] as any);
    jest.spyOn(GroupChat, 'findByPk').mockResolvedValue(group as any);
    const before = Date.now();

    await service.handleRideCompletion('ride-1');

    const message = (GroupChatMessage.create as jest.Mock).mock.calls[0][0];
    expect(message.content).toContain('deleted in 24 hours');

    const { metadata } = (GroupChat.update as jest.Mock).mock.calls[0][0];
    const due = new Date(metadata.scheduledDisbandAt).getTime();
    expect(due).toBeGreaterThanOrEqual(before + 24 * HOUR);
    expect(due).toBeLessThanOrEqual(Date.now() + 24 * HOUR);
    expect(metadata.note).toBe('kept');
    expect(GroupChatMessage.destroy).not.toHaveBeenCalled();
  });

  it('when the day is up, closes the chat and deletes its messages', async () => {
    jest.spyOn(sequelize, 'query').mockResolvedValue([{ id: 'group-1' }] as any);
    jest.spyOn(GroupChat, 'findByPk').mockResolvedValue({ id: 'group-1', metadata: {} } as any);
    jest.spyOn(GroupChat, 'findAll').mockResolvedValue([]);

    const cleaned = await service.cleanupInactiveGroups();

    expect(cleaned).toBe(1);
    expect((sequelize.query as jest.Mock).mock.calls[0][0]).toContain("(metadata->>'scheduledDisbandAt')::timestamptz < NOW()");
    expect(GroupChat.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: GroupChatStatus.ARCHIVED }),
      expect.objectContaining({ where: { id: 'group-1' } }),
    );
    expect(GroupChatMessage.destroy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { groupChatId: 'group-1' }, force: true }),
    );
    expect(GroupChatMessage.create).not.toHaveBeenCalled();
  });

  it('refuses a vote to keep a ride chat', async () => {
    await expect(service.voteToKeepGroup('group-1', 'user-1', true)).rejects.toBeInstanceOf(RideChatNotKeptError);
  });
});
