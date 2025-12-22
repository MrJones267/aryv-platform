-- Simple test data for user management testing
-- Matches actual database schema

INSERT INTO users (
    email,
    password_hash,
    first_name,
    last_name,
    phone_number,
    role,
    is_verified,
    is_active
) VALUES 
-- Active drivers
('john.driver@aryv-app.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm', 'John', 'Driver', '+1234567001', 'driver', true, true),
('sarah.wilson@aryv-app.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm', 'Sarah', 'Wilson', '+1234567002', 'driver', false, true),
-- Active passengers
('mike.passenger@aryv-app.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm', 'Mike', 'Johnson', '+1234567003', 'passenger', true, true),
('emma.smith@aryv-app.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm', 'Emma', 'Smith', '+1234567004', 'passenger', false, true),
-- Inactive users
('blocked.user@aryv-app.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm', 'Blocked', 'User', '+1234567005', 'driver', true, false),
('inactive.user@aryv-app.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm', 'Inactive', 'User', '+1234567006', 'passenger', false, false),
-- New users
('new.user1@aryv-app.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm', 'New', 'User1', '+1234567007', 'passenger', false, true),
('new.user2@aryv-app.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm', 'New', 'User2', '+1234567008', 'driver', true, true),
('alice.cooper@aryv-app.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm', 'Alice', 'Cooper', '+1234567009', 'driver', true, true),
('bob.tester@aryv-app.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm', 'Bob', 'Tester', '+1234567010', 'passenger', true, true);