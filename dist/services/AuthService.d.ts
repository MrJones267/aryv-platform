import { JwtPayload, AuthResponse, LoginRequest, RegisterRequest } from '../types';
export declare class AuthService {
    static generateAccessToken(payload: JwtPayload): string;
    static generateRefreshToken(): string;
    static verifyToken(token: string): JwtPayload;
    static register(userData: RegisterRequest): Promise<AuthResponse>;
    static login(credentials: LoginRequest): Promise<AuthResponse>;
    static refreshToken(refreshToken: string): Promise<AuthResponse>;
    static logout(userId: string): Promise<void>;
    static getUserById(userId: string): Promise<any>;
    private static getTokenExpiryTime;
}
//# sourceMappingURL=AuthService.d.ts.map