/**
 * @fileoverview An SOS raised by a user.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * An alert used to be a plain object with an id made from Date.now(), written
 * to a log line and then dropped. Nothing could list open emergencies, nothing
 * could resolve one, and there was no record afterwards.
 *
 * Two positions are kept rather than one. `raisedCoordinates` is where the
 * person was when they pressed the button — where help was sent — and never
 * changes. `lastCoordinates` follows them while the alert is open. Overwriting
 * the first with the second would lose the trail.
 */

import {
  Model,
  DataTypes,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  ForeignKey,
} from 'sequelize';
import { sequelize } from '../config/database';
import { GeoPoint } from '../types';

/**
 * What the person says is happening.
 *
 * `panic` and `harassment` are here because they are what the SOS button
 * sends. The previous endpoint's list omitted both, so the two most likely
 * emergencies were rejected as invalid input.
 */
export enum EmergencyAlertType {
  PANIC = 'panic',
  HARASSMENT = 'harassment',
  ACCIDENT = 'accident',
  MEDICAL = 'medical',
  BREAKDOWN = 'breakdown',
  SAFETY = 'safety',
  OTHER = 'other',
}

export enum EmergencyAlertStatus {
  RAISED = 'raised',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  FALSE_ALARM = 'false_alarm',
}

/**
 * Emergencies where telling the other people on the ride is the wrong move,
 * because the person the alert is about may be one of them.
 *
 * A harassment alert broadcast to the ride room tells the harasser that they
 * have been reported, while both are still in the same vehicle.
 */
export const ALERT_TYPES_PRIVATE_TO_RIDE: ReadonlySet<string> = new Set([
  EmergencyAlertType.HARASSMENT,
  EmergencyAlertType.PANIC,
]);

export interface EmergencyAlertModel extends Model<
  InferAttributes<EmergencyAlertModel>,
  InferCreationAttributes<EmergencyAlertModel>
> {
  id: CreationOptional<string>;
  userId: ForeignKey<string>;

  alertType: EmergencyAlertType;
  status: CreationOptional<EmergencyAlertStatus>;
  message: CreationOptional<string | null>;

  raisedCoordinates: GeoPoint;
  lastCoordinates: GeoPoint;
  lastLocationAt: CreationOptional<Date>;

  rideId: CreationOptional<string | null>;

  /** How many contacts were actually reached, not how many were tried. */
  contactsNotified: CreationOptional<number>;
  notifyError: CreationOptional<string | null>;

  acknowledgedBy: CreationOptional<string | null>;
  acknowledgedAt: CreationOptional<Date | null>;
  resolvedAt: CreationOptional<Date | null>;
  resolutionNote: CreationOptional<string | null>;

  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

const EmergencyAlert = sequelize.define<EmergencyAlertModel>(
  'emergency_alerts',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: { model: 'users', key: 'id' },
    },
    alertType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'alert_type',
      validate: { isIn: [Object.values(EmergencyAlertType)] },
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: EmergencyAlertStatus.RAISED,
      validate: { isIn: [Object.values(EmergencyAlertStatus)] },
    },
    message: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    raisedCoordinates: {
      type: DataTypes.GEOMETRY('POINT', 4326),
      allowNull: false,
      field: 'raised_coordinates',
    },
    lastCoordinates: {
      type: DataTypes.GEOMETRY('POINT', 4326),
      allowNull: false,
      field: 'last_coordinates',
    },
    lastLocationAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'last_location_at',
    },
    rideId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'ride_id',
      references: { model: 'rides', key: 'id' },
    },
    contactsNotified: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'contacts_notified',
    },
    notifyError: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'notify_error',
    },
    acknowledgedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'acknowledged_by',
      references: { model: 'users', key: 'id' },
    },
    acknowledgedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'acknowledged_at',
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'resolved_at',
    },
    resolutionNote: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'resolution_note',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
  },
  {
    tableName: 'emergency_alerts',
    timestamps: true,
    underscored: true,
  },
);

export default EmergencyAlert;
