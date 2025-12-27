interface Config {
    server: {
        port: number;
        host: string;
        nodeEnv: string;
    };
    database: {
        url: string;
        host: string;
        port: number;
        name: string;
        username: string;
        password: string;
        ssl: boolean;
        logging: boolean;
    };
    redis: {
        url: string;
        host: string;
        port: number;
        password?: string;
        db: number;
    };
    jwt: {
        secret: string;
        expiresIn: string;
    };
    cors: {
        origin: string[];
    };
    rateLimit: {
        windowMs: number;
        maxRequests: number;
    };
    upload: {
        maxFileSize: number;
        maxFiles: number;
        allowedTypes: string[];
        destination: string;
    };
    email: {
        smtp: {
            host: string;
            port: number;
            secure: boolean;
            user: string;
            pass: string;
        };
    };
    payment: {
        stripe: {
            secretKey: string;
            publishableKey: string;
            webhookSecret: string;
        };
    };
    aws: {
        accessKeyId: string;
        secretAccessKey: string;
        region: string;
        s3Bucket: string;
    };
    aiServices: {
        baseURL: string;
        timeout: number;
        enabled: boolean;
    };
    maps: {
        googleApiKey: string;
    };
    monitoring: {
        sentryDsn?: string;
        logLevel: string;
    };
    features: {
        aiMatching: boolean;
        blockchainCourier: boolean;
        realTimeChat: boolean;
        pushNotifications: boolean;
    };
}
export declare const config: Config;
export declare const serverConfig: {
    port: number;
    host: string;
    nodeEnv: string;
};
export declare const databaseConfig: {
    url: string;
    host: string;
    port: number;
    name: string;
    username: string;
    password: string;
    ssl: boolean;
    logging: boolean;
};
export declare const redisConfig: {
    url: string;
    host: string;
    port: number;
    password?: string;
    db: number;
};
export declare const jwtConfig: {
    secret: string;
    expiresIn: string;
};
export declare const aiServicesConfig: {
    baseURL: string;
    timeout: number;
    enabled: boolean;
};
export {};
//# sourceMappingURL=config.d.ts.map