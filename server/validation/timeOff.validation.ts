import Joi from "joi";
import { PayrollTreatment, TimeOffCategory, TimeOffStatus } from "../types/timeOff.js";
export class TimeOffError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function validate<T>(schema: Joi.Schema<T>, input: unknown): T {
  const result = schema.required().validate(input, { abortEarly: false, convert: false, messages: {
    "any.required": "{{#label}} est obligatoire.", "any.only": "{{#label}} contient une valeur non autorisée.",
    "any.invalid": "{{#label}} est invalide.", "object.unknown": "Le champ {{#label}} n’est pas autorisé.",
    "object.min": "Indiquez au moins un champ à modifier.", "object.base": "Les données doivent être un objet.",
    "string.base": "{{#label}} doit être un texte.", "string.empty": "{{#label}} ne peut pas être vide.",
    "string.min": "{{#label}} est trop court.", "string.max": "{{#label}} est trop long.",
    "string.trim": "{{#label}} ne doit pas commencer ou finir par des espaces.",
    "string.pattern.base": "Le format de {{#label}} est invalide.", "boolean.base": "{{#label}} doit être un booléen.",
    "number.base": "{{#label}} doit être un nombre.", "number.integer": "{{#label}} doit être un entier.",
    "number.min": "{{#label}} est inférieur au minimum autorisé.", "number.max": "{{#label}} dépasse le maximum autorisé.",
    "array.base": "{{#label}} doit être une liste.", "array.unique": "{{#label}} contient un doublon.",
    "array.max": "{{#label}} contient trop d’éléments.",
  } });
  if (result.error) throw new TimeOffError(400, "INVALID_INPUT", result.error.details.map(item => item.message).join("; "));
  return result.value;
}
export const identifier = Joi.string().trim().min(1).max(128).pattern(/^[a-zA-Z0-9_-]+$/);
export const version = Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER).required();
const date = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value: string, helpers) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? helpers.error("any.invalid") : value;
});
const motifFields = {
  code: Joi.string().pattern(/^[A-Z0-9][A-Z0-9_-]{0,63}$/), label: Joi.string().trim().min(1).max(200),
  category: Joi.string().valid(...Object.values(TimeOffCategory)), payrollTreatment: Joi.string().valid(...Object.values(PayrollTreatment)),
  deductFromLeaveBalance: Joi.boolean(), requiresApproval: Joi.boolean(), requiresJustification: Joi.boolean(),
  requiresSupportingDocument: Joi.boolean(), isActive: Joi.boolean(),
};
export const createMotifSchema = Joi.object({ ...motifFields, _id: identifier }).fork(Object.keys(motifFields), field => field.required()).unknown(false);
export const editMotifSchema = Joi.object({ ...motifFields, serverVersion: version }).min(2).unknown(false);
const requestFields = {
  motifId: identifier, startDate: date, endDate: date, isPartialDay: Joi.boolean(),
  startTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/), endTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/),
  notes: Joi.string().max(10000).allow(""), additionalNotes: Joi.string().max(10000).allow(""),
  supportingDocumentIds: Joi.array().items(identifier).unique().max(20),
};
export const periodSchema = Joi.object({ startDate: date.required(), endDate: date.required(),
  isPartialDay: requestFields.isPartialDay, startTime: requestFields.startTime, endTime: requestFields.endTime }).unknown(false);
export const createRequestSchema = Joi.object({ ...requestFields, _id: identifier, employeeId: identifier.required() })
  .fork(["motifId", "startDate", "endDate"], field => field.required()).unknown(false);
export const editRequestSchema = Joi.object({ ...requestFields, serverVersion: version }).min(2).unknown(false);
export const actionSchema = Joi.object({ serverVersion: version }).unknown(false);
export const rejectSchema = Joi.object({ serverVersion: version, rejectionReason: Joi.string().trim().min(1).max(2000).required() }).unknown(false);
export const notesSchema = Joi.object({ serverVersion: version, additionalNotes: Joi.string().max(10000).allow("").required() }).unknown(false);
export const listSchema = Joi.object({ employeeId: identifier, status: Joi.string().valid(...Object.values(TimeOffStatus)),
  month: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/), includeDeleted: Joi.string().valid("true", "false") }).unknown(false);
