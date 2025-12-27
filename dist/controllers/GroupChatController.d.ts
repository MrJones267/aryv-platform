import { Request, Response } from 'express';
interface AuthenticatedRequest extends Request {
    user?: any;
}
export declare class GroupChatController {
    private groupChatService;
    constructor();
    createGroupChat(req: AuthenticatedRequest, res: Response): Promise<void>;
    sendMessage(req: AuthenticatedRequest, res: Response): Promise<void>;
    joinGroup(req: AuthenticatedRequest, res: Response): Promise<void>;
    leaveGroup(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateParticipant(req: AuthenticatedRequest, res: Response): Promise<void>;
    getUserGroupChats(req: AuthenticatedRequest, res: Response): Promise<void>;
    getGroupMessages(req: AuthenticatedRequest, res: Response): Promise<void>;
    addReaction(req: AuthenticatedRequest, res: Response): Promise<void>;
    togglePin(req: AuthenticatedRequest, res: Response): Promise<void>;
    markAsRead(req: AuthenticatedRequest, res: Response): Promise<void>;
    voteToKeepGroup(req: AuthenticatedRequest, res: Response): Promise<void>;
}
export declare const groupChatValidationRules: {
    createGroupChat: import("express-validator").ValidationChain[];
    sendMessage: import("express-validator").ValidationChain[];
    joinGroup: import("express-validator").ValidationChain[];
    leaveGroup: import("express-validator").ValidationChain[];
    updateParticipant: import("express-validator").ValidationChain[];
    getMessages: import("express-validator").ValidationChain[];
    addReaction: import("express-validator").ValidationChain[];
    markAsRead: import("express-validator").ValidationChain[];
    voteToKeepGroup: import("express-validator").ValidationChain[];
};
export default GroupChatController;
//# sourceMappingURL=GroupChatController.d.ts.map