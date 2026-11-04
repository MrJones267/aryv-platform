-- =====================================================================
-- Migration 036: Pickups (bakkies) and coupes as vehicle types
-- Author: Oabona-Majoko
-- Created: 2026-11-04
--
-- Purpose:
--   The app offers Truck and Coupe when a driver registers a vehicle; the
--   vehicle_type enum had neither, so those could not be stored. A bakkie
--   is one of the commonest cars in Botswana.
--
--   The enum is the one Sequelize created from the Vehicle model
--   (enum_vehicles_vehicle_type). ADD VALUE IF NOT EXISTS: safe to re-run.
-- =====================================================================

ALTER TYPE "enum_vehicles_vehicle_type" ADD VALUE IF NOT EXISTS 'pickup';
ALTER TYPE "enum_vehicles_vehicle_type" ADD VALUE IF NOT EXISTS 'coupe';
