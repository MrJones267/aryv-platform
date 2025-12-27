export declare class GroupCleanupService {
    private groupChatService;
    private cleanupJob?;
    private messageCleanupJob?;
    constructor();
    startScheduler(): void;
    stopScheduler(): void;
    runManualCleanup(): Promise<{
        groupsProcessed: number;
        messagesProcessed: number;
    }>;
    getStatus(): {
        groupCleanupRunning: boolean;
        messageCleanupRunning: boolean;
        nextGroupCleanup?: Date | undefined;
        nextMessageCleanup?: Date | undefined;
    };
}
export declare const groupCleanupService: GroupCleanupService;
export default groupCleanupService;
//# sourceMappingURL=GroupCleanupService.d.ts.map