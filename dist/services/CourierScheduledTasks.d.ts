export declare class CourierScheduledTasks {
    private tasks;
    private isRunning;
    start(): void;
    stop(): void;
    getStatus(): {
        isRunning: boolean;
        activeTasks: string[];
        taskCount: number;
    };
    private scheduleAutoPaymentRelease;
    private scheduleQRCodeCleanup;
    private scheduleDailyReports;
    triggerTask(taskName: string): Promise<boolean>;
    getNextRunTimes(): Record<string, string | null>;
}
declare const _default: CourierScheduledTasks;
export default _default;
//# sourceMappingURL=CourierScheduledTasks.d.ts.map