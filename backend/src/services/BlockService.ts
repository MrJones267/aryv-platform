/**
 * @fileoverview Blocking people, and asking whether two people are blocked
 * @author Oabona-Majoko
 * @created 2026-10-31
 * @lastModified 2026-10-31
 *
 * A block works both ways for anything the two would do together: booking,
 * seeing each other's rides and ride requests. Only the blocker stops seeing
 * the other's messages; the blocked person is not told.
 */

import { Op } from 'sequelize';
import UserBlock from '../models/UserBlock';
import User from '../models/User';

export class BlockError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

class BlockService {
  async block(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {throw new BlockError('CANNOT_BLOCK_SELF', 'You cannot block yourself');}
    const target = await User.findByPk(blockedId, { attributes: ['id'] });
    if (!target) {throw new BlockError('USER_NOT_FOUND', 'User not found', 404);}
    await UserBlock.findOrCreate({ where: { blockerId, blockedId }, defaults: { blockerId, blockedId } });
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await UserBlock.destroy({ where: { blockerId, blockedId } });
  }

  async list(blockerId: string): Promise<Array<{ userId: string; firstName: string | null; blockedAt: Date }>> {
    const rows = await UserBlock.findAll({ where: { blockerId }, order: [['createdAt', 'DESC']] });
    const users = await User.findAll({ where: { id: rows.map(r => r.blockedId) }, attributes: ['id', 'firstName'] });
    const name = new Map(users.map(u => [u.id, u.firstName]));
    return rows.map(r => ({ userId: r.blockedId, firstName: name.get(r.blockedId) ?? null, blockedAt: r.createdAt }));
  }

  /** People this user has blocked. */
  async blockedBy(userId: string): Promise<string[]> {
    return (await UserBlock.findAll({ where: { blockerId: userId }, attributes: ['blockedId'] })).map(r => r.blockedId);
  }

  /** Everyone on either side of a block with this user. */
  async blockedEitherWay(userId: string): Promise<string[]> {
    const rows = await UserBlock.findAll({
      where: { [Op.or]: [{ blockerId: userId }, { blockedId: userId }] },
      attributes: ['blockerId', 'blockedId'],
    });
    return [...new Set(rows.map(r => (r.blockerId === userId ? r.blockedId : r.blockerId)))];
  }

  async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
    return (await UserBlock.count({
      where: { [Op.or]: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    })) > 0;
  }
}

export const blockService = new BlockService();
export default blockService;
