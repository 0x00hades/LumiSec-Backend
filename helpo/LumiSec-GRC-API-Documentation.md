# LumiSec GRC API Documentation

**Version:** 1.0.0  
**Module:** Governance, Risk & Compliance (GRC)  
**Audience:** Frontend Developers  
**Last Updated:** June 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Base URL & Conventions](#base-url--conventions)
3. [Authentication](#authentication)
4. [Standard Response Formats](#standard-response-formats)
5. [Reference Data & Enums](#reference-data--enums)
6. [Entity Schemas](#entity-schemas)
7. [Findings APIs](#findings-apis)
8. [Risks APIs](#risks-apis)
9. [Remediation Tasks APIs](#remediation-tasks-apis)
10. [Evidence APIs](#evidence-apis)
11. [Audit Reports APIs](#audit-reports-apis)
12. [Compliance APIs](#compliance-apis)
13. [Retesting APIs](#retesting-apis)
14. [Dashboard APIs](#dashboard-apis)
15. [Audit Logs APIs](#audit-logs-apis)
16. [Notifications APIs](#notifications-apis)
17. [Integration APIs](#integration-apis)
18. [Real-Time Events (Socket.IO)](#real-time-events-socketio)
19. [OpenAPI Specification](#openapi-specification)

---

## Overview

The **LumiSec GRC API** is the central governance engine for the LumiSec cybersecurity platform. It manages security findings, risks, remediation workflows, compliance controls, audit reports, and cross-module integrations (Network, UCTC, SOAR, Phishing, SIEM, OpenCTI).

All endpoints are RESTful, return JSON (except file download endpoints), and require JWT authentication unless otherwise noted.

---

## Base URL & Conventions

| Item | Value |
|------|-------|
| **API Base Path** | `/api/grc` |
| **Full URL Pattern** | `{HOST}/api/grc/{resource}` |
| **Content-Type** | `application/json` (except Evidence upload) |
| **ID Format** | MongoDB ObjectId — 24-character hexadecimal string |
| **Date Format** | ISO 8601 (`2026-06-10T14:30:00.000Z`) |
| **Pagination Defaults** | `page=1`, `limit=20`, max `limit=100` |
| **Default Sort** | `-createdAt` (newest first) |

> **Note:** Endpoint paths in this document use the prefix `/api/grc`. For example, `POST /grc/findings` in the architecture spec maps to `POST /api/grc/findings` in the live API.

---

## Authentication

All GRC endpoints require a valid JWT Bearer token.

### Header

```http
Authorization: Bearer <token>
```

### Supported Roles

| Role | Value | Typical GRC Usage |
|------|-------|-------------------|
| Admin | `admin` | Full access |
| GRC Manager | `grc_manager` | Primary GRC operator |
| Auditor | `auditor` | Findings, reports, verification |
| SOC Manager | `soc_manager` | Risks, integrations, dashboard |
| SOC Analyst | `soc_analyst` | Read findings, SIEM integration |
| Detection Engineer | `detection_engineer` | Retests, UCTC/Network/SIEM integrations |
| Compliance Manager | `compliance_manager` | Compliance, reports (read) |
| IT Manager | `it_manager` | Task assignment, mitigation |
| Assignee | `assignee` | Task execution, evidence upload |

### Auth Error Responses

| Status | Condition | Message |
|--------|-----------|---------|
| `401` | Missing or invalid token | `Authentication required` |
| `403` | Valid token, insufficient role | `You are not authorized to perform this action` |
| `403` | Suspended account | `Your account has been suspended` |

---

## Standard Response Formats

### Success Response (Single Resource)

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

### Success Response (Paginated List)

```json
{
  "success": true,
  "message": "Resources fetched",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 87,
    "pages": 5
  },
  "data": []
}
```

### Error Response (Standard)

```json
{
  "success": false,
  "message": "Validation error",
  "errors": []
}
```

> **Implementation note:** Validation failures currently return HTTP `422` with `message` containing concatenated field errors (e.g. `"Validation failed: \"title\" is required"`). Frontend should parse `message` and also handle the `errors` array shape for forward compatibility.

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Resource created |
| `400` | Business rule violation |
| `401` | Not authenticated |
| `403` | Not authorized |
| `404` | Resource not found |
| `422` | Validation failed |
| `500` | Internal server error |

---

## Reference Data & Enums

### Finding Status

| Value | Description |
|-------|-------------|
| `open` | Newly created, not yet assigned |
| `in_progress` | Assigned and being remediated |
| `ready_for_retest` | Remediation complete, awaiting retest |
| `closed` | Verified and closed |
| `reopened` | Failed retest or manually reopened |

### Source Module

`network` · `uctc` · `soar` · `phishing` · `siem` · `opencti` · `manual`

### Severity / Risk Level

`low` · `medium` · `high` · `critical`

### Risk Status

`open` · `mitigated` · `accepted` · `closed`

### Risk Treatment

`mitigate` · `accept` · `transfer` · `avoid`

### Task Status

`open` · `in_progress` · `completed` · `verified`

### Task Priority

`low` · `medium` · `high` · `critical`

### Compliance Framework

`ISO27001` · `NIST` · `PCI_DSS` · `SOC2`

### Control Status

`compliant` · `non_compliant` · `partially_compliant` · `not_assessed`

### Retest Result

`pass` · `fail`

### Report Status

`draft` · `generating` · `ready` · `published`

### Notification Type

`finding` · `risk` · `task` · `report` · `compliance` · `retest` · `integration`

### Audit Action

`create` · `update` · `delete` · `assign` · `close` · `reopen` · `accept` · `mitigate` · `complete` · `verify` · `link` · `generate`

### Entity Type (Audit)

`finding` · `risk` · `task` · `evidence` · `report` · `control` · `retest` · `siem_alert` · `notification`

### Risk Score Calculation

```
score = likelihood × impact   (each 1–5)
```

| Score Range | Risk Level |
|-------------|------------|
| 1–4 | `low` |
| 5–9 | `medium` |
| 10–14 | `high` |
| 15–25 | `critical` |

---

## Entity Schemas

### Finding

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Unique identifier |
| `title` | string | Short title |
| `description` | string | Detailed description |
| `sourceModule` | enum | Originating module |
| `sourceId` | string | External reference ID |
| `severity` | enum | Severity level |
| `riskRating` | enum | Overall risk rating |
| `asset` | string | Affected asset (IP, hostname, etc.) |
| `status` | enum | Workflow status |
| `assignedTo` | ObjectId | Assigned user ref |
| `createdBy` | ObjectId | Creator user ref |
| `dueDate` | date | Remediation deadline |
| `tags` | string[] | Labels |
| `createdAt` | date | Auto timestamp |
| `updatedAt` | date | Auto timestamp |
| `closedAt` | date | When closed |

### Risk

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Unique identifier |
| `findingId` | ObjectId | Linked finding (optional) |
| `title` | string | Risk title |
| `description` | string | Risk description |
| `likelihood` | integer (1–5) | Probability |
| `impact` | integer (1–5) | Business impact |
| `score` | integer | Auto-calculated |
| `riskLevel` | enum | Auto-calculated |
| `treatment` | enum | Treatment strategy |
| `owner` | ObjectId | Risk owner |
| `status` | enum | Workflow status |
| `acceptedBy` | ObjectId | Who accepted risk |
| `acceptedAt` | date | Acceptance timestamp |
| `closedAt` | date | Closure timestamp |

### Remediation Task

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Unique identifier |
| `findingId` | ObjectId | Parent finding |
| `title` | string | Task title |
| `description` | string | Task instructions |
| `assignedTo` | ObjectId | Assignee |
| `assignedBy` | ObjectId | Creator |
| `dueDate` | date | Deadline |
| `priority` | enum | Priority level |
| `status` | enum | Workflow status |
| `completedAt` | date | Completion timestamp |
| `verifiedBy` | ObjectId | Verifier |
| `verifiedAt` | date | Verification timestamp |

### Evidence

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Unique identifier |
| `findingId` | ObjectId | Parent finding |
| `taskId` | ObjectId | Linked task (optional) |
| `filename` | string | Original filename |
| `filePath` | string | Server storage path |
| `mimeType` | string | File MIME type |
| `size` | number | File size in bytes |
| `uploadedBy` | ObjectId | Uploader |
| `uploadedAt` | date | Upload timestamp |

### Audit Report

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Unique identifier |
| `title` | string | Report title |
| `framework` | enum | Compliance framework |
| `findings` | ObjectId[] | Linked findings |
| `generatedBy` | ObjectId | Author |
| `generatedAt` | date | Generation timestamp |
| `pdfPath` | string | PDF file path (after generation) |
| `scope` | string | Audit scope |
| `summary` | string | Executive summary |
| `status` | enum | Report status |

### Compliance Control

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Unique identifier |
| `framework` | enum | Framework |
| `controlId` | string | Control reference (e.g. `A.8.2.3`) |
| `title` | string | Control title |
| `description` | string | Control description |
| `status` | enum | Compliance status |
| `linkedFindings` | ObjectId[] | Related findings |

### SIEM Alert

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Unique identifier |
| `alertId` | string | External alert ID |
| `ruleName` | string | Detection rule name |
| `severity` | enum | Alert severity |
| `sourceIp` | string | Source IP |
| `destinationIp` | string | Destination IP |
| `indexName` | string | Elasticsearch index |
| `findingId` | ObjectId | Auto-created finding |
| `receivedAt` | date | Receipt timestamp |

### Audit Log

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Unique identifier |
| `user` | ObjectId | Acting user |
| `action` | enum | Action performed |
| `entityType` | enum | Entity type |
| `entityId` | ObjectId | Entity ID |
| `oldValue` | object | Previous state |
| `newValue` | object | New state |
| `timestamp` | date | Action timestamp |

### Notification

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Unique identifier |
| `userId` | ObjectId | Recipient |
| `title` | string | Notification title |
| `message` | string | Notification body |
| `type` | enum | Notification category |
| `entityType` | string | Related entity type |
| `entityId` | ObjectId | Related entity |
| `isRead` | boolean | Read status |
| `createdAt` | date | Creation timestamp |

---

# Findings APIs

---

## 1. Create Finding

| Property | Value |
|----------|-------|
| **Endpoint Name** | Create Finding |
| **Method** | `POST` |
| **URL** | `/api/grc/findings` |
| **Purpose** | Register a new security finding manually or from the GRC UI |
| **Authentication Required** | Yes |
| **Required Roles** | `admin`, `auditor`, `grc_manager` |

### Headers

```http
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Finding title |
| `description` | string | Yes | Detailed description |
| `severity` | enum | Yes | `low`, `medium`, `high`, `critical` |
| `riskRating` | enum | Yes | `low`, `medium`, `high`, `critical` |
| `sourceModule` | enum | No | Defaults to `manual` |
| `sourceId` | string | No | External reference |
| `asset` | string | No | Affected asset |
| `assignedTo` | ObjectId | No | Pre-assign to user |
| `dueDate` | date | No | Remediation deadline |
| `tags` | string[] | No | Labels |
| `control` | string | No | Related control reference |
| `auditReportId` | ObjectId | No | Link to audit report |

### Validation Rules

- `title` and `description` must be non-empty strings
- `severity` and `riskRating` must be valid enum values
- `assignedTo` and `auditReportId` must be valid 24-char hex ObjectIds
- `dueDate` must be a valid ISO date

### Success Response — `201 Created`

```json
{
  "success": true,
  "message": "Finding created successfully",
  "data": {
    "_id": "665a1f2e8b4c2d0012345678",
    "title": "Missing MFA on admin accounts",
    "description": "Privileged accounts lack multi-factor authentication",
    "severity": "high",
    "riskRating": "high",
    "sourceModule": "manual",
    "status": "open",
    "tags": ["identity", "mfa"],
    "createdBy": "665a1f2e8b4c2d0012345601",
    "createdAt": "2026-06-10T10:00:00.000Z",
    "updatedAt": "2026-06-10T10:00:00.000Z"
  }
}
```

### Error Responses

| Status | Message | `errors` example |
|--------|---------|------------------|
| `401` | `Authentication required` | `[]` |
| `403` | `You are not authorized to perform this action` | `[]` |
| `422` | `Validation failed: "severity" is required` | `[{ "field": "severity", "message": "is required" }]` |

### Example Request

```http
POST /api/grc/findings
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "title": "Missing MFA on admin accounts",
  "description": "Privileged accounts lack multi-factor authentication",
  "severity": "high",
  "riskRating": "high",
  "asset": "auth-server-01",
  "tags": ["identity", "mfa"],
  "dueDate": "2026-07-01T00:00:00.000Z"
}
```

### Notes (Frontend)

- Default `status` is `open` — do not send status on create
- If `assignedTo` is provided, assignee receives a real-time `grc:notification` event
- Use severity for display badges; `riskRating` drives risk matrix placement

---

## 2. List Findings

| Property | Value |
|----------|-------|
| **Endpoint Name** | List Findings |
| **Method** | `GET` |
| **URL** | `/api/grc/findings` |
| **Purpose** | Retrieve paginated, filterable list of findings |
| **Authentication Required** | Yes |
| **Required Roles** | `admin`, `auditor`, `grc_manager`, `compliance_manager`, `it_manager`, `soc_manager`, `soc_analyst` |

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 20, max: 100) |
| `sort` | string | No | Sort field (default: `-createdAt`) |
| `search` | string | No | Text search on title, description, asset |
| `severity` | enum | No | Filter by severity |
| `status` | enum | No | Filter by status |
| `asset` | string | No | Filter by asset |
| `sourceModule` | enum | No | Filter by source module |
| `riskRating` | enum | No | Filter by risk rating |
| `assignedTo` | ObjectId | No | Filter by assignee |

### Validation Rules

- `page` ≥ 1, `limit` between 1 and 100
- Enum filters must match allowed values
- `assignedTo` must be valid ObjectId

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Findings fetched",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "pages": 3
  },
  "data": [
    {
      "_id": "665a1f2e8b4c2d0012345678",
      "title": "Open RDP port",
      "description": "Port 3389 exposed to internet",
      "severity": "critical",
      "riskRating": "critical",
      "status": "in_progress",
      "asset": "10.0.0.15",
      "sourceModule": "network",
      "assignedTo": { "_id": "665a1f2e8b4c2d0012345602", "name": "John Doe", "email": "john@lumisec.io" },
      "createdBy": { "_id": "665a1f2e8b4c2d0012345601", "name": "Jane Auditor", "email": "jane@lumisec.io" },
      "createdAt": "2026-06-01T08:00:00.000Z"
    }
  ]
}
```

### Filtering Example

```http
GET /api/grc/findings?severity=high&status=open&sourceModule=siem&page=1&limit=10
```

### Search Example

```http
GET /api/grc/findings?search=rdp&page=1&limit=20
```

### Notes (Frontend)

- Populate `createdBy` and `assignedTo` are returned as nested user objects
- Combine filters with `&` — all filters are AND conditions
- Use `pages` from pagination to build page controls

---

## 3. Get Finding by ID

| Property | Value |
|----------|-------|
| **Endpoint Name** | Get Finding |
| **Method** | `GET` |
| **URL** | `/api/grc/findings/:id` |
| **Purpose** | Retrieve a single finding with full details |
| **Authentication Required** | Yes |
| **Required Roles** | `admin`, `auditor`, `grc_manager`, `compliance_manager`, `it_manager`, `soc_manager`, `soc_analyst` |

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | ObjectId | Yes | Finding ID |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Finding fetched",
  "data": {
    "_id": "665a1f2e8b4c2d0012345678",
    "title": "Open RDP port",
    "description": "Port 3389 exposed to internet",
    "severity": "critical",
    "riskRating": "critical",
    "status": "in_progress",
    "asset": "10.0.0.15",
    "sourceModule": "network",
    "sourceId": "net-scan-2026-001",
    "tags": ["network", "exposure"],
    "assignedTo": { "_id": "665a1f2e8b4c2d0012345602", "name": "John Doe", "email": "john@lumisec.io" },
    "createdBy": { "_id": "665a1f2e8b4c2d0012345601", "name": "Jane Auditor", "email": "jane@lumisec.io" },
    "dueDate": "2026-07-15T00:00:00.000Z",
    "createdAt": "2026-06-01T08:00:00.000Z",
    "updatedAt": "2026-06-05T14:30:00.000Z"
  }
}
```

### Error Responses

| Status | Message |
|--------|---------|
| `404` | `Finding not found` |

### Notes (Frontend)

- Use this endpoint for the finding detail page
- Pair with `GET /api/grc/findings/:id/history` for activity timeline

---

## 4. Update Finding

| Property | Value |
|----------|-------|
| **Endpoint Name** | Update Finding |
| **Method** | `PATCH` |
| **URL** | `/api/grc/findings/:id` |
| **Purpose** | Update finding fields |
| **Authentication Required** | Yes |
| **Required Roles** | `admin`, `auditor`, `grc_manager` |

### Path Parameters

| Parameter | Type | Required |
|-----------|------|----------|
| `id` | ObjectId | Yes |

### Request Body Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | No | Updated title |
| `description` | string | No | Updated description |
| `severity` | enum | No | Updated severity |
| `riskRating` | enum | No | Updated risk rating |
| `asset` | string | No | Updated asset |
| `status` | enum | No | Status override |
| `dueDate` | date | No | Updated deadline |
| `tags` | string[] | No | Updated tags |

### Validation Rules

- At least one field should be provided
- `status` must be a valid finding status enum
- All enum fields must match allowed values

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Finding updated successfully",
  "data": {
    "_id": "665a1f2e8b4c2d0012345678",
    "title": "Open RDP port — escalated",
    "severity": "critical",
    "riskRating": "critical",
    "status": "in_progress",
    "updatedAt": "2026-06-10T11:00:00.000Z"
  }
}
```

### Notes (Frontend)

- Prefer dedicated endpoints (`/assign`, `/close`, `/reopen`) for workflow transitions
- An audit log entry is created automatically on every update

---

## 5. Assign Finding

| Property | Value |
|----------|-------|
| **Endpoint Name** | Assign Finding |
| **Method** | `PATCH` |
| **URL** | `/api/grc/findings/:id/assign` |
| **Purpose** | Assign a finding to a user; auto-transitions `open` → `in_progress` |
| **Authentication Required** | Yes |
| **Required Roles** | `admin`, `grc_manager`, `it_manager` |

### Path Parameters

| Parameter | Type | Required |
|-----------|------|----------|
| `id` | ObjectId | Yes |

### Request Body Schema

| Field | Type | Required |
|-------|------|----------|
| `assignedTo` | ObjectId | Yes |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Finding assigned successfully",
  "data": {
    "_id": "665a1f2e8b4c2d0012345678",
    "status": "in_progress",
    "assignedTo": "665a1f2e8b4c2d0012345602"
  }
}
```

### Notes (Frontend)

- Assignee receives a Socket.IO `grc:notification` event
- Show user picker populated from your users API

---

## 6. Close Finding

| Property | Value |
|----------|-------|
| **Endpoint Name** | Close Finding |
| **Method** | `PATCH` |
| **URL** | `/api/grc/findings/:id/close` |
| **Purpose** | Close a finding; sets `closedAt` and `closedBy` |
| **Authentication Required** | Yes |
| **Required Roles** | `admin`, `auditor`, `grc_manager` |

### Path Parameters

| Parameter | Type | Required |
|-----------|------|----------|
| `id` | ObjectId | Yes |

### Request Body

None required.

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Finding closed successfully",
  "data": {
    "_id": "665a1f2e8b4c2d0012345678",
    "status": "closed",
    "closedBy": "665a1f2e8b4c2d0012345601",
    "closedAt": "2026-06-10T12:00:00.000Z"
  }
}
```

### Notes (Frontend)

- Typical flow: task completed → retest passed → close
- Can also close directly after manual review

---

## 7. Reopen Finding

| Property | Value |
|----------|-------|
| **Endpoint Name** | Reopen Finding |
| **Method** | `PATCH` |
| **URL** | `/api/grc/findings/:id/reopen` |
| **Purpose** | Reopen a closed or failed finding for re-remediation |
| **Authentication Required** | Yes |
| **Required Roles** | `admin`, `auditor`, `grc_manager` |

### Path Parameters

| Parameter | Type | Required |
|-----------|------|----------|
| `id` | ObjectId | Yes |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Finding reopened — re-test required",
  "data": {
    "_id": "665a1f2e8b4c2d0012345678",
    "status": "reopened",
    "closedAt": null,
    "closedBy": null
  }
}
```

### Notes (Frontend)

- Also triggered automatically when retest result is `fail`
- Clear `closedAt` display when status is `reopened`

---

## 8. Delete Finding

| Property | Value |
|----------|-------|
| **Endpoint Name** | Delete Finding |
| **Method** | `DELETE` |
| **URL** | `/api/grc/findings/:id` |
| **Purpose** | Permanently delete a finding |
| **Authentication Required** | Yes |
| **Required Roles** | `admin`, `grc_manager` |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Finding deleted successfully",
  "data": null
}
```

### Notes (Frontend)

- Show confirmation dialog — deletion is irreversible
- Audit log records the deletion with the full previous state

---

## 9. Get Finding History

| Property | Value |
|----------|-------|
| **Endpoint Name** | Get Finding History |
| **Method** | `GET` |
| **URL** | `/api/grc/findings/:id/history` |
| **Purpose** | Retrieve audit trail for a specific finding |
| **Authentication Required** | Yes |
| **Required Roles** | `admin`, `auditor`, `grc_manager`, `compliance_manager`, `it_manager`, `soc_manager`, `soc_analyst` |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Finding history fetched",
  "data": [
    {
      "_id": "665a1f2e8b4c2d0012345701",
      "action": "create",
      "entityType": "finding",
      "entityId": "665a1f2e8b4c2d0012345678",
      "user": { "_id": "665a1f2e8b4c2d0012345601", "name": "Jane Auditor", "email": "jane@lumisec.io", "role": "auditor" },
      "newValue": { "title": "Open RDP port", "status": "open" },
      "timestamp": "2026-06-01T08:00:00.000Z"
    },
    {
      "_id": "665a1f2e8b4c2d0012345702",
      "action": "assign",
      "entityType": "finding",
      "entityId": "665a1f2e8b4c2d0012345678",
      "user": { "_id": "665a1f2e8b4c2d0012345603", "name": "IT Manager", "role": "it_manager" },
      "oldValue": { "assignedTo": null },
      "newValue": { "assignedTo": "665a1f2e8b4c2d0012345602" },
      "timestamp": "2026-06-02T09:00:00.000Z"
    }
  ]
}
```

### Notes (Frontend)

- Render as a chronological activity timeline
- Use `action` field for icon/badge mapping

---

# Risks APIs

---

## 10. Create Risk

| Property | Value |
|----------|-------|
| **Endpoint Name** | Create Risk |
| **Method** | `POST` |
| **URL** | `/api/grc/risks` |
| **Purpose** | Register a new risk; score and riskLevel are auto-calculated |
| **Authentication Required** | Yes |
| **Required Roles** | `admin`, `grc_manager`, `soc_manager` |

### Request Body Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Risk title |
| `description` | string | Yes | Risk description |
| `likelihood` | integer | Yes | 1–5 |
| `impact` | integer | Yes | 1–5 |
| `findingId` | ObjectId | No | Linked finding |
| `treatment` | enum | No | Defaults to `mitigate` |
| `owner` | ObjectId | No | Defaults to authenticated user |

### Validation Rules

- `likelihood` and `impact` must be integers between 1 and 5
- `treatment` must be `mitigate`, `accept`, `transfer`, or `avoid`

### Success Response — `201 Created`

```json
{
  "success": true,
  "message": "Risk created successfully",
  "data": {
    "_id": "665a1f2e8b4c2d0012345801",
    "title": "Credential theft via phishing",
    "description": "Users may submit credentials to fake login pages",
    "likelihood": 4,
    "impact": 5,
    "score": 20,
    "riskLevel": "critical",
    "treatment": "mitigate",
    "status": "open",
    "owner": "665a1f2e8b4c2d0012345601",
    "createdAt": "2026-06-10T10:00:00.000Z"
  }
}
```

### Example Request

```json
{
  "title": "Credential theft via phishing",
  "description": "Users may submit credentials to fake login pages",
  "likelihood": 4,
  "impact": 5,
  "findingId": "665a1f2e8b4c2d0012345678"
}
```

### Notes (Frontend)

- Display `score` and `riskLevel` as read-only — never send them in requests
- Use a 5×5 heatmap matrix for likelihood/impact selection UI

---

## 11. List Risks

| Property | Value |
|----------|-------|
| **Endpoint Name** | List Risks |
| **Method** | `GET` |
| **URL** | `/api/grc/risks` |
| **Purpose** | Paginated list of risks with filters |
| **Authentication Required** | Yes |
| **Required Roles** | `admin`, `grc_manager`, `auditor`, `compliance_manager`, `soc_manager` |

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page`, `limit`, `sort`, `search` | — | Standard pagination |
| `status` | enum | Filter by risk status |
| `riskLevel` | enum | Filter by risk level |
| `owner` | ObjectId | Filter by owner |
| `findingId` | ObjectId | Filter by linked finding |

### Filtering Example

```http
GET /api/grc/risks?riskLevel=critical&status=open&page=1&limit=10
```

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Risks fetched",
  "pagination": { "page": 1, "limit": 20, "total": 15, "pages": 1 },
  "data": [
    {
      "_id": "665a1f2e8b4c2d0012345801",
      "title": "Credential theft via phishing",
      "score": 20,
      "riskLevel": "critical",
      "status": "open",
      "owner": { "_id": "665a1f2e8b4c2d0012345601", "name": "GRC Manager", "email": "grc@lumisec.io" }
    }
  ]
}
```

---

## 12. Get Risk by ID

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/grc/risks/:id` |
| **Required Roles** | `admin`, `grc_manager`, `auditor`, `compliance_manager`, `soc_manager` |

### Success Response — `200 OK`

Returns full risk object with populated `owner` and `findingId`.

### Error Responses

| Status | Message |
|--------|---------|
| `404` | `Risk not found` |

---

## 13. Update Risk

| Property | Value |
|----------|-------|
| **Method** | `PATCH` |
| **URL** | `/api/grc/risks/:id` |
| **Required Roles** | `admin`, `grc_manager` |

### Request Body Schema

| Field | Type | Required |
|-------|------|----------|
| `title` | string | No |
| `description` | string | No |
| `likelihood` | integer (1–5) | No |
| `impact` | integer (1–5) | No |
| `treatment` | enum | No |
| `status` | enum | No |
| `owner` | ObjectId | No |

### Notes (Frontend)

- Updating `likelihood` or `impact` recalculates `score` and `riskLevel` server-side

---

## 14. Accept Risk

| Property | Value |
|----------|-------|
| **Method** | `PATCH` |
| **URL** | `/api/grc/risks/:id/accept` |
| **Purpose** | Formally accept risk; sets status to `accepted` |
| **Required Roles** | `admin`, `grc_manager`, `compliance_manager` |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Risk accepted successfully",
  "data": {
    "_id": "665a1f2e8b4c2d0012345801",
    "status": "accepted",
    "treatment": "accept",
    "acceptedBy": "665a1f2e8b4c2d0012345601",
    "acceptedAt": "2026-06-10T14:00:00.000Z"
  }
}
```

### Notes (Frontend)

- Show acceptance confirmation with reason/justification field in UI (stored in audit log via action)

---

## 15. Mitigate Risk

| Property | Value |
|----------|-------|
| **Method** | `PATCH` |
| **URL** | `/api/grc/risks/:id/mitigate` |
| **Purpose** | Mark risk as mitigated |
| **Required Roles** | `admin`, `grc_manager`, `it_manager` |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Risk mitigated successfully",
  "data": { "_id": "665a1f2e8b4c2d0012345801", "status": "mitigated" }
}
```

---

## 16. Close Risk

| Property | Value |
|----------|-------|
| **Method** | `PATCH` |
| **URL** | `/api/grc/risks/:id/close` |
| **Purpose** | Permanently close a risk |
| **Required Roles** | `admin`, `grc_manager` |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Risk closed successfully",
  "data": {
    "_id": "665a1f2e8b4c2d0012345801",
    "status": "closed",
    "closedAt": "2026-06-10T16:00:00.000Z"
  }
}
```

---

# Remediation Tasks APIs

---

## 17. Create Remediation Task

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/grc/tasks` |
| **Purpose** | Create remediation task; auto-sets finding to `in_progress` |
| **Required Roles** | `admin`, `it_manager`, `grc_manager` |

### Request Body Schema

| Field | Type | Required |
|-------|------|----------|
| `findingId` | ObjectId | Yes |
| `title` | string | Yes |
| `description` | string | Yes |
| `assignedTo` | ObjectId | Yes |
| `dueDate` | date | No |
| `priority` | enum | No (default: `medium`) |

### Success Response — `201 Created`

```json
{
  "success": true,
  "message": "Remediation task created successfully",
  "data": {
    "_id": "665a1f2e8b4c2d0012345901",
    "findingId": "665a1f2e8b4c2d0012345678",
    "title": "Enable MFA for admin accounts",
    "description": "Configure MFA policy in identity provider",
    "assignedTo": "665a1f2e8b4c2d0012345602",
    "assignedBy": "665a1f2e8b4c2d0012345603",
    "priority": "high",
    "status": "open",
    "dueDate": "2026-07-01T00:00:00.000Z",
    "createdAt": "2026-06-10T10:00:00.000Z"
  }
}
```

### Notes (Frontend)

- Parent finding status changes to `in_progress` automatically
- Assignee receives a `grc:notification` event

---

## 18. List Remediation Tasks

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/grc/tasks` |
| **Required Roles** | `admin`, `it_manager`, `grc_manager`, `assignee`, `auditor` |

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page`, `limit`, `sort` | — | Pagination |
| `status` | enum | Filter by status |
| `priority` | enum | Filter by priority |
| `assignedTo` | ObjectId | Filter by assignee |
| `findingId` | ObjectId | Filter by finding |

### Filtering Example

```http
GET /api/grc/tasks?assignedTo=665a1f2e8b4c2d0012345602&status=open&priority=high
```

---

## 19. Get Task by ID

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/grc/tasks/:id` |
| **Required Roles** | `admin`, `it_manager`, `grc_manager`, `assignee`, `auditor` |

### Error Responses

| Status | Message |
|--------|---------|
| `404` | `Remediation task not found` |

---

## 20. Update Task

| Property | Value |
|----------|-------|
| **Method** | `PATCH` |
| **URL** | `/api/grc/tasks/:id` |
| **Required Roles** | `admin`, `it_manager`, `grc_manager`, `assignee` |

### Request Body Schema

| Field | Type | Required |
|-------|------|----------|
| `title` | string | No |
| `description` | string | No |
| `assignedTo` | ObjectId | No |
| `dueDate` | date | No |
| `priority` | enum | No |
| `status` | enum | No |

---

## 21. Complete Task

| Property | Value |
|----------|-------|
| **Method** | `PATCH` |
| **URL** | `/api/grc/tasks/:id/complete` |
| **Purpose** | Mark task complete; sets parent finding to `ready_for_retest` |
| **Required Roles** | `admin`, `it_manager`, `assignee` |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Remediation task completed successfully",
  "data": {
    "_id": "665a1f2e8b4c2d0012345901",
    "status": "completed",
    "completedAt": "2026-06-10T15:00:00.000Z"
  }
}
```

### Notes (Frontend)

- After completion, navigate user to retest workflow
- Parent finding status becomes `ready_for_retest`

---

## 22. Verify Task

| Property | Value |
|----------|-------|
| **Method** | `PATCH` |
| **URL** | `/api/grc/tasks/:id/verify` |
| **Purpose** | Auditor verifies completed remediation |
| **Required Roles** | `admin`, `auditor`, `grc_manager` |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Remediation task verified successfully",
  "data": {
    "_id": "665a1f2e8b4c2d0012345901",
    "status": "verified",
    "verifiedBy": "665a1f2e8b4c2d0012345601",
    "verifiedAt": "2026-06-10T16:00:00.000Z"
  }
}
```

### Error Responses

| Status | Message |
|--------|---------|
| `400` | `Task must be completed before verification` |

---

# Evidence APIs

---

## 23. Upload Evidence

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/grc/evidence` |
| **Purpose** | Upload supporting evidence file for a finding or task |
| **Required Roles** | `admin`, `it_manager`, `assignee`, `auditor` |

### Headers

```http
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

### Request Body (multipart/form-data)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | Evidence file |
| `findingId` | string | Yes | Parent finding ObjectId |
| `taskId` | string | No | Linked task ObjectId |

### Validation Rules

- `file` is required
- Allowed MIME types: `application/pdf`, `image/png`, `image/jpeg`, `text/plain`, `application/json`, `application/zip`
- Max file size: 10 MB

### Success Response — `201 Created`

```json
{
  "success": true,
  "message": "Evidence uploaded successfully",
  "data": {
    "_id": "665a1f2e8b4c2d0012345a01",
    "findingId": "665a1f2e8b4c2d0012345678",
    "taskId": "665a1f2e8b4c2d0012345901",
    "filename": "mfa-screenshot.png",
    "filePath": "uploads/evidence/1718035200000-123456789.png",
    "mimeType": "image/png",
    "size": 245760,
    "uploadedBy": "665a1f2e8b4c2d0012345602",
    "uploadedAt": "2026-06-10T12:00:00.000Z"
  }
}
```

### Error Responses

| Status | Message |
|--------|---------|
| `400` | `Evidence file is required` |
| `400` | `Unsupported file type` |

### Example Request (JavaScript)

```javascript
const formData = new FormData();
formData.append("file", fileInput.files[0]);
formData.append("findingId", "665a1f2e8b4c2d0012345678");
formData.append("taskId", "665a1f2e8b4c2d0012345901");

await fetch("/api/grc/evidence", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: formData
});
```

### Notes (Frontend)

- Do **not** set `Content-Type` manually — browser sets boundary for multipart
- Show upload progress indicator for large files
- Display `filename` and `size` in evidence list UI

---

## 24. Get Evidence by ID

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/grc/evidence/:id` |
| **Required Roles** | `admin`, `auditor`, `grc_manager`, `it_manager`, `assignee` |

### Success Response — `200 OK`

Returns evidence metadata with populated `uploadedBy`.

### Error Responses

| Status | Message |
|--------|---------|
| `404` | `Evidence not found` |

---

## 25. Delete Evidence

| Property | Value |
|----------|-------|
| **Method** | `DELETE` |
| **URL** | `/api/grc/evidence/:id` |
| **Required Roles** | `admin`, `grc_manager`, `auditor` |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Evidence deleted successfully",
  "data": null
}
```

---

# Audit Reports APIs

---

## 26. Create Audit Report

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/grc/reports` |
| **Required Roles** | `admin`, `auditor`, `grc_manager` |

### Request Body Schema

| Field | Type | Required |
|-------|------|----------|
| `title` | string | Yes |
| `framework` | enum | Yes |
| `scope` | string | No |
| `summary` | string | No |
| `findings` | ObjectId[] | No |

### Success Response — `201 Created`

```json
{
  "success": true,
  "message": "Audit report created successfully",
  "data": {
    "_id": "665a1f2e8b4c2d0012345b01",
    "title": "Q2 2026 Cloud Security Audit",
    "framework": "SOC2",
    "status": "draft",
    "generatedBy": "665a1f2e8b4c2d0012345601",
    "generatedAt": "2026-06-10T10:00:00.000Z",
    "findings": []
  }
}
```

---

## 27. List Audit Reports

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/grc/reports` |
| **Required Roles** | `admin`, `auditor`, `grc_manager`, `compliance_manager` |

### Query Parameters

`page`, `limit`, `sort`, `framework`, `status`

---

## 28. Get Audit Report by ID

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/grc/reports/:id` |
| **Required Roles** | `admin`, `auditor`, `grc_manager`, `compliance_manager` |

Returns report with populated `findings` (title, severity, riskRating, status).

---

## 29. Update Audit Report

| Property | Value |
|----------|-------|
| **Method** | `PATCH` |
| **URL** | `/api/grc/reports/:id` |
| **Required Roles** | `admin`, `auditor`, `grc_manager` |

### Request Body Schema

| Field | Type | Required |
|-------|------|----------|
| `title` | string | No |
| `scope` | string | No |
| `summary` | string | No |
| `status` | enum | No |

---

## 30. Delete Audit Report

| Property | Value |
|----------|-------|
| **Method** | `DELETE` |
| **URL** | `/api/grc/reports/:id` |
| **Required Roles** | `admin`, `grc_manager` |

---

## 31. Add Findings to Report

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/grc/reports/:id/findings` |
| **Purpose** | Link one or more findings to an audit report |
| **Required Roles** | `admin`, `auditor`, `grc_manager` |

### Request Body Schema

| Field | Type | Required |
|-------|------|----------|
| `findingIds` | ObjectId[] | Yes (min 1) |

### Example Request

```json
{
  "findingIds": [
    "665a1f2e8b4c2d0012345678",
    "665a1f2e8b4c2d0012345679"
  ]
}
```

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Findings added to report",
  "data": {
    "_id": "665a1f2e8b4c2d0012345b01",
    "findings": ["665a1f2e8b4c2d0012345678", "665a1f2e8b4c2d0012345679"]
  }
}
```

---

## 32. Generate Report PDF

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/grc/reports/:id/generate` |
| **Purpose** | Queue asynchronous PDF generation via background worker |
| **Required Roles** | `admin`, `auditor`, `grc_manager` |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Report PDF generation queued",
  "data": {
    "_id": "665a1f2e8b4c2d0012345b01",
    "status": "generating"
  }
}
```

### Notes (Frontend)

- Poll `GET /api/grc/reports/:id` until `status` becomes `ready`
- Show loading/spinner during `generating` state
- Enable download button only when `status === "ready"`

---

## 33. Download Report PDF

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/grc/reports/:id/download` |
| **Purpose** | Download generated PDF file |
| **Required Roles** | `admin`, `auditor`, `grc_manager`, `compliance_manager` |

### Success Response — `200 OK`

Returns binary PDF file with `Content-Disposition: attachment` header.

### Error Responses

| Status | Message |
|--------|---------|
| `404` | `Report PDF is not ready for download` |

### Notes (Frontend)

- Response is **not JSON** — handle as file download
- Use `window.open()` or anchor with `download` attribute

---

# Compliance APIs

---

## 34. Create Compliance Control

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/grc/compliance/controls` |
| **Required Roles** | `admin`, `grc_manager`, `compliance_manager` |

### Request Body Schema

| Field | Type | Required |
|-------|------|----------|
| `framework` | enum | Yes |
| `controlId` | string | Yes |
| `title` | string | Yes |
| `description` | string | No |
| `status` | enum | No (default: `not_assessed`) |

### Example Request

```json
{
  "framework": "ISO27001",
  "controlId": "A.8.2.3",
  "title": "Handling of removable media",
  "description": "Procedures for secure media handling",
  "status": "partially_compliant"
}
```

---

## 35. List Compliance Controls

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/grc/compliance/controls` |
| **Required Roles** | `admin`, `grc_manager`, `compliance_manager`, `auditor` |

### Query Parameters

`page`, `limit`, `sort`, `framework`, `status`

### Filtering Example

```http
GET /api/grc/compliance/controls?framework=NIST&status=non_compliant&page=1&limit=50
```

---

## 36. Get Compliance Control by ID

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/grc/compliance/controls/:id` |
| **Required Roles** | `admin`, `grc_manager`, `compliance_manager`, `auditor` |

Returns control with populated `linkedFindings`.

---

## 37. Update Compliance Control

| Property | Value |
|----------|-------|
| **Method** | `PATCH` |
| **URL** | `/api/grc/compliance/controls/:id` |
| **Required Roles** | `admin`, `grc_manager`, `compliance_manager` |

### Request Body Schema

| Field | Type | Required |
|-------|------|----------|
| `title` | string | No |
| `description` | string | No |
| `status` | enum | No |

---

## 38. Link Finding to Control

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/grc/compliance/controls/:id/link-finding` |
| **Purpose** | Associate a finding with a compliance control |
| **Required Roles** | `admin`, `grc_manager`, `compliance_manager` |

### Request Body Schema

| Field | Type | Required |
|-------|------|----------|
| `findingId` | ObjectId | Yes |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Finding linked to control successfully",
  "data": {
    "_id": "665a1f2e8b4c2d0012345c01",
    "controlId": "A.8.2.3",
    "linkedFindings": ["665a1f2e8b4c2d0012345678"]
  }
}
```

---

## 39. Get Compliance Status

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/grc/compliance/status` |
| **Purpose** | Aggregated compliance statistics by framework and status |
| **Required Roles** | `admin`, `grc_manager`, `compliance_manager`, `auditor` |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Compliance status fetched",
  "data": {
    "byFramework": [
      {
        "_id": "ISO27001",
        "statuses": [
          { "status": "compliant", "count": 45 },
          { "status": "non_compliant", "count": 8 },
          { "status": "partially_compliant", "count": 12 }
        ],
        "total": 65
      }
    ],
    "overall": [
      { "_id": "compliant", "count": 120 },
      { "_id": "non_compliant", "count": 25 },
      { "_id": "partially_compliant", "count": 30 },
      { "_id": "not_assessed", "count": 15 }
    ]
  }
}
```

### Notes (Frontend)

- Use for compliance dashboard charts (donut/bar per framework)
- Pair with `GET /api/grc/dashboard/compliance` for richer metrics

---

# Retesting APIs

---

## 40. Record Retest

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/grc/findings/:id/retest` |
| **Purpose** | Record retest result; `pass` closes finding, `fail` reopens it |
| **Required Roles** | `admin`, `auditor`, `grc_manager`, `detection_engineer` |

### Path Parameters

| Parameter | Type | Required |
|-----------|------|----------|
| `id` | ObjectId | Yes (finding ID) |

### Request Body Schema

| Field | Type | Required |
|-------|------|----------|
| `result` | enum | Yes (`pass` or `fail`) |
| `notes` | string | No |

### Success Response — `201 Created`

```json
{
  "success": true,
  "message": "Retest recorded successfully",
  "data": {
    "retest": {
      "_id": "665a1f2e8b4c2d0012345d01",
      "findingId": "665a1f2e8b4c2d0012345678",
      "result": "pass",
      "notes": "MFA enforced on all admin accounts",
      "testedBy": "665a1f2e8b4c2d0012345601",
      "testedAt": "2026-06-10T16:00:00.000Z"
    },
    "finding": {
      "_id": "665a1f2e8b4c2d0012345678",
      "status": "closed",
      "closedAt": "2026-06-10T16:00:00.000Z"
    }
  }
}
```

### Notes (Frontend)

- Show pass/fail toggle with notes textarea
- On `fail`, redirect to task creation flow for re-remediation

---

## 41. List Retest History

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/grc/findings/:id/retests` |
| **Required Roles** | `admin`, `auditor`, `grc_manager`, `compliance_manager`, `it_manager`, `soc_manager`, `soc_analyst` |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Retest history fetched",
  "data": [
    {
      "_id": "665a1f2e8b4c2d0012345d01",
      "result": "fail",
      "notes": "MFA not yet enforced",
      "testedBy": { "_id": "665a1f2e8b4c2d0012345601", "name": "Jane Auditor", "email": "jane@lumisec.io" },
      "testedAt": "2026-06-05T10:00:00.000Z"
    },
    {
      "_id": "665a1f2e8b4c2d0012345d02",
      "result": "pass",
      "notes": "MFA enforced on all admin accounts",
      "testedBy": { "_id": "665a1f2e8b4c2d0012345601", "name": "Jane Auditor", "email": "jane@lumisec.io" },
      "testedAt": "2026-06-10T16:00:00.000Z"
    }
  ]
}
```

---

# Dashboard APIs

---

## 42. Dashboard Overview

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/grc/dashboard/overview` |
| **Purpose** | High-level GRC KPIs and breakdowns |
| **Required Roles** | `admin`, `grc_manager`, `auditor`, `compliance_manager`, `soc_manager`, `it_manager` |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Dashboard overview fetched",
  "data": {
    "openFindings": 23,
    "totalRisks": 15,
    "openTasks": 8,
    "findingsByStatus": [
      { "_id": "open", "count": 10 },
      { "_id": "in_progress", "count": 8 },
      { "_id": "ready_for_retest", "count": 3 },
      { "_id": "closed", "count": 42 }
    ],
    "findingsBySeverity": [
      { "_id": "critical", "count": 5 },
      { "_id": "high", "count": 12 },
      { "_id": "medium", "count": 20 },
      { "_id": "low", "count": 8 }
    ]
  }
}
```

### Notes (Frontend)

- Use for main GRC dashboard landing page
- Map `findingsByStatus` and `findingsBySeverity` to chart components

---

## 43. Dashboard Risks

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/grc/dashboard/risks` |
| **Required Roles** | `admin`, `grc_manager`, `auditor`, `compliance_manager`, `soc_manager`, `it_manager` |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Risk dashboard fetched",
  "data": {
    "byLevel": [
      { "_id": "critical", "count": 3 },
      { "_id": "high", "count": 7 }
    ],
    "byStatus": [
      { "_id": "open", "count": 10 },
      { "_id": "mitigated", "count": 5 }
    ],
    "byTreatment": [
      { "_id": "mitigate", "count": 12 },
      { "_id": "accept", "count": 2 }
    ],
    "topRisks": [
      { "_id": "665a1f2e8b4c2d0012345801", "title": "Credential theft", "score": 20, "riskLevel": "critical", "status": "open", "treatment": "mitigate" }
    ]
  }
}
```

---

## 44. Dashboard Compliance

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/grc/dashboard/compliance` |
| **Required Roles** | `admin`, `grc_manager`, `auditor`, `compliance_manager`, `soc_manager`, `it_manager` |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Compliance dashboard fetched",
  "data": {
    "byFramework": [
      { "framework": "ISO27001", "total": 65, "compliant": 45, "complianceRate": 69.23 },
      { "framework": "NIST", "total": 40, "compliant": 30, "complianceRate": 75 }
    ],
    "byStatus": [
      { "_id": "compliant", "count": 120 },
      { "_id": "non_compliant", "count": 25 }
    ]
  }
}
```

---

## 45. Dashboard Tasks

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/grc/dashboard/tasks` |
| **Required Roles** | `admin`, `grc_manager`, `auditor`, `compliance_manager`, `soc_manager`, `it_manager` |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Tasks dashboard fetched",
  "data": {
    "byStatus": [
      { "_id": "open", "count": 5 },
      { "_id": "in_progress", "count": 3 },
      { "_id": "completed", "count": 10 }
    ],
    "byPriority": [
      { "_id": "critical", "count": 2 },
      { "_id": "high", "count": 6 }
    ],
    "overdue": 4
  }
}
```

### Notes (Frontend)

- Highlight `overdue` count with warning badge
- Cross-reference with `GET /api/grc/tasks?status=open` for detail list

---

## 46. Risk Heatmap

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/grc/dashboard/risk-heatmap` |
| **Purpose** | 5×5 likelihood/impact matrix for open risks |
| **Required Roles** | `admin`, `grc_manager`, `auditor`, `compliance_manager`, `soc_manager`, `it_manager` |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Risk heatmap fetched",
  "data": {
    "heatmap": [
      { "_id": { "likelihood": 4, "impact": 5 }, "count": 2, "avgScore": 20 },
      { "_id": { "likelihood": 3, "impact": 3 }, "count": 5, "avgScore": 9 }
    ],
    "matrix": [
      [
        { "likelihood": 1, "impact": 1, "count": 1, "avgScore": 1 },
        { "likelihood": 1, "impact": 2, "count": 0, "avgScore": 0 }
      ]
    ]
  }
}
```

### Notes (Frontend)

- Render `matrix` as a 5×5 color-coded grid
- Cell color intensity based on `count` or `avgScore`

---

# Audit Logs APIs

---

## 47. List Audit Logs

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/grc/audit-logs` |
| **Purpose** | Platform-wide audit trail with filters |
| **Required Roles** | `admin`, `auditor`, `grc_manager` |

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page`, `limit`, `sort` | — | Pagination |
| `action` | enum | Filter by action |
| `entityType` | enum | Filter by entity type |
| `user` | ObjectId | Filter by acting user |

### Filtering Example

```http
GET /api/grc/audit-logs?entityType=finding&action=update&page=1&limit=50
```

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Audit logs fetched",
  "pagination": { "page": 1, "limit": 20, "total": 150, "pages": 8 },
  "data": [
    {
      "_id": "665a1f2e8b4c2d0012345e01",
      "action": "update",
      "entityType": "finding",
      "entityId": "665a1f2e8b4c2d0012345678",
      "user": { "_id": "665a1f2e8b4c2d0012345601", "name": "Jane Auditor", "role": "auditor" },
      "oldValue": { "status": "open" },
      "newValue": { "status": "in_progress" },
      "timestamp": "2026-06-02T09:00:00.000Z"
    }
  ]
}
```

---

## 48. Get Entity Audit Logs

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/grc/audit-logs/:entityType/:entityId` |
| **Purpose** | Audit history for a specific entity |
| **Required Roles** | `admin`, `auditor`, `grc_manager` |

### Path Parameters

| Parameter | Type | Required | Example |
|-----------|------|----------|---------|
| `entityType` | string | Yes | `finding`, `risk`, `task` |
| `entityId` | ObjectId | Yes | `665a1f2e8b4c2d0012345678` |

### Example

```http
GET /api/grc/audit-logs/finding/665a1f2e8b4c2d0012345678
```

---

# Notifications APIs

---

## 49. List Notifications

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **URL** | `/api/grc/notifications` |
| **Purpose** | List notifications for the authenticated user |
| **Required Roles** | All authenticated platform roles |

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page`, `limit` | — | Pagination |
| `isRead` | string | `"true"` or `"false"` |

### Filtering Example

```http
GET /api/grc/notifications?isRead=false&page=1&limit=20
```

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Notifications fetched",
  "pagination": { "page": 1, "limit": 20, "total": 5, "pages": 1 },
  "data": [
    {
      "_id": "665a1f2e8b4c2d0012345f01",
      "userId": "665a1f2e8b4c2d0012345602",
      "title": "Finding assigned",
      "message": "You have been assigned finding \"Open RDP port\"",
      "type": "finding",
      "entityType": "finding",
      "entityId": "665a1f2e8b4c2d0012345678",
      "isRead": false,
      "createdAt": "2026-06-10T10:00:00.000Z"
    }
  ]
}
```

### Notes (Frontend)

- Show unread count badge using `isRead=false` filter
- Clicking notification should navigate to `entityType`/`entityId` detail page
- Also listen for real-time `grc:notification` Socket.IO events

---

## 50. Mark Notification as Read

| Property | Value |
|----------|-------|
| **Method** | `PATCH` |
| **URL** | `/api/grc/notifications/:id/read` |
| **Purpose** | Mark a single notification as read |
| **Required Roles** | All authenticated platform roles |

### Path Parameters

| Parameter | Type | Required |
|-----------|------|----------|
| `id` | ObjectId | Yes |

### Success Response — `200 OK`

```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "_id": "665a1f2e8b4c2d0012345f01",
    "isRead": true
  }
}
```

### Error Responses

| Status | Message |
|--------|---------|
| `404` | `Notification not found` |

### Notes (Frontend)

- Only the notification owner can mark it read (scoped to authenticated user)

---

# Integration APIs

> Integration endpoints are called by other LumiSec modules or authorized service accounts to push data into GRC automatically.

---

## 51. Network → GRC Finding

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/grc/integrations/network/findings` |
| **Purpose** | Ingest findings from Network module (open ports, vulnerabilities, rogue devices, weak services) |
| **Required Roles** | `admin`, `grc_manager`, `detection_engineer`, `soc_manager` |

### Request Body Schema

| Field | Type | Required |
|-------|------|----------|
| `title` | string | Yes |
| `description` | string | Yes |
| `severity` | enum | Yes |
| `riskRating` | enum | No (auto-derived from severity) |
| `asset` | string | No |
| `sourceId` | string | No |
| `findingType` | string | No |
| `tags` | string[] | No |
| `assignedTo` | ObjectId | No |

### Example Request

```json
{
  "title": "Rogue device detected on VLAN 10",
  "description": "Unauthorized MAC address 00:1A:2B:3C:4D:5E detected",
  "severity": "high",
  "asset": "00:1A:2B:3C:4D:5E",
  "findingType": "rogue_device",
  "sourceId": "net-scan-2026-042",
  "tags": ["network", "rogue_device"]
}
```

### Success Response — `201 Created`

```json
{
  "success": true,
  "message": "Integration data ingested successfully",
  "data": {
    "_id": "665a1f2e8b4c2d0012345678",
    "sourceModule": "network",
    "status": "open"
  }
}
```

### Notes (Frontend)

- Network module UI should call this — not typically used by GRC UI directly
- `sourceModule` is automatically set to `network`

---

## 52. UCTC → GRC Finding

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/grc/integrations/uctc/findings` |
| **Purpose** | Ingest findings from failed test cases and detection gaps |
| **Required Roles** | `admin`, `grc_manager`, `detection_engineer` |

### Request Body Schema

| Field | Type | Required |
|-------|------|----------|
| `title` | string | Yes |
| `description` | string | Yes |
| `severity` | enum | Yes |
| `riskRating` | enum | No |
| `asset` | string | No |
| `testCaseId` | string | No |
| `sourceId` | string | No |
| `tags` | string[] | No |

### Example Request

```json
{
  "title": "Sigma rule failed detection test",
  "description": "Rule SID-5001 did not trigger on simulated attack",
  "severity": "medium",
  "testCaseId": "uctc-tc-2026-015",
  "tags": ["detection-gap", "sigma"]
}
```

---

## 53. SOAR → GRC Incident

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/grc/integrations/soar/incidents` |
| **Purpose** | Create finding (and optionally risk) from SOAR incident |
| **Required Roles** | `admin`, `grc_manager`, `soc_manager` |

### Request Body Schema

| Field | Type | Required |
|-------|------|----------|
| `incidentId` | string | Yes |
| `description` | string | Yes |
| `title` | string | No |
| `severity` | enum | No |
| `riskRating` | enum | No |
| `createRisk` | boolean | No |
| `likelihood` | integer (1–5) | No |
| `impact` | integer (1–5) | No |

### Example Request

```json
{
  "incidentId": "INC-2026-0042",
  "title": "Brute force attack on VPN",
  "description": "Multiple failed login attempts from 203.0.113.10",
  "severity": "high",
  "createRisk": true,
  "likelihood": 4,
  "impact": 4
}
```

### Success Response — `201 Created`

```json
{
  "success": true,
  "message": "Integration data ingested successfully",
  "data": {
    "finding": { "_id": "665a1f2e8b4c2d0012345678", "sourceModule": "soar" },
    "risk": { "_id": "665a1f2e8b4c2d0012345801", "score": 16, "riskLevel": "critical" }
  }
}
```

---

## 54. SOAR → Update Task

| Property | Value |
|----------|-------|
| **Method** | `PATCH` |
| **URL** | `/api/grc/integrations/soar/tasks/:id` |
| **Purpose** | Update remediation task status from SOAR playbook |
| **Required Roles** | `admin`, `grc_manager`, `soc_manager` |

### Request Body Schema

| Field | Type | Required |
|-------|------|----------|
| `status` | enum | No |
| `description` | string | No |
| `priority` | enum | No |

---

## 55. Phishing → GRC Risk

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/grc/integrations/phishing/risk` |
| **Purpose** | Create risk from phishing click or credential submission events |
| **Required Roles** | `admin`, `grc_manager`, `soc_manager` |

### Request Body Schema

| Field | Type | Required |
|-------|------|----------|
| `eventType` | enum | Yes (`click` or `submit`) |
| `title` | string | No |
| `description` | string | No |
| `owner` | ObjectId | No |
| `findingId` | ObjectId | No |

### Example Request

```json
{
  "eventType": "submit",
  "title": "Credential submission during phishing simulation",
  "description": "User submitted credentials on fake O365 login page"
}
```

### Notes (Frontend)

- `submit` events auto-set higher likelihood/impact than `click` events

---

## 56. SIEM → GRC Alert

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/grc/integrations/siem/alerts` |
| **Purpose** | Store SIEM alert and auto-create linked finding |
| **Required Roles** | `admin`, `grc_manager`, `soc_analyst`, `detection_engineer` |

### Request Body Schema

| Field | Type | Required |
|-------|------|----------|
| `alertId` | string | Yes |
| `ruleName` | string | Yes |
| `severity` | enum | Yes |
| `sourceIp` | string | No |
| `destinationIp` | string | No |
| `indexName` | string | No |
| `receivedAt` | date | No |

### Example Request

```json
{
  "alertId": "alert-abc-123",
  "ruleName": "Brute Force Login",
  "severity": "critical",
  "sourceIp": "203.0.113.10",
  "destinationIp": "10.0.0.5",
  "indexName": "winlogbeat-*"
}
```

### Success Response — `201 Created`

```json
{
  "success": true,
  "message": "Integration data ingested successfully",
  "data": {
    "alert": {
      "_id": "665a1f2e8b4c2d0012345g01",
      "alertId": "alert-abc-123",
      "findingId": "665a1f2e8b4c2d0012345678"
    },
    "finding": {
      "_id": "665a1f2e8b4c2d0012345678",
      "title": "SIEM Alert: Brute Force Login",
      "sourceModule": "siem"
    }
  }
}
```

---

## 57. OpenCTI → GRC IOC Risk

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **URL** | `/api/grc/integrations/opencti/ioc` |
| **Purpose** | Create risk from threat intelligence indicator |
| **Required Roles** | `admin`, `grc_manager`, `soc_analyst` |

### Request Body Schema

| Field | Type | Required |
|-------|------|----------|
| `indicator` | string | Yes |
| `iocType` | enum | Yes (`ip`, `domain`, `hash`, `malware`, `url`) |
| `title` | string | No |
| `description` | string | No |
| `confidence` | integer (1–5) | No |
| `owner` | ObjectId | No |

### Example Request

```json
{
  "indicator": "malicious-domain.example.com",
  "iocType": "domain",
  "title": "C2 domain from OpenCTI feed",
  "confidence": 4,
  "description": "Known command-and-control domain linked to APT group"
}
```

---

# Real-Time Events (Socket.IO)

Connect to the LumiSec WebSocket server with JWT authentication:

```javascript
import { io } from "socket.io-client";

const socket = io("ws://localhost:3000", {
  auth: { token: "<jwt_token>" }
});

socket.on("grc:notification", (payload) => {
  // payload: { id, title, message, type, entityType, entityId }
  showToast(payload.title, payload.message);
  refreshNotificationBadge();
});
```

| Event | Trigger |
|-------|---------|
| `grc:notification` | Finding assigned, task assigned, risk created, retest completed |

---

# OpenAPI Specification

Machine-readable OpenAPI 3.0 spec available at:

```
GET /api/grc/docs/openapi.json
```

Import into Postman, Swagger UI, or Insomnia for interactive testing.

---

## Workflow State Diagram (Frontend Reference)

```
Finding:  open → in_progress → ready_for_retest → closed
                ↘ reopened ←──────────────────────────┘

Task:       open → in_progress → completed → verified

Risk:       open → mitigated / accepted → closed
```

---

## Quick Reference — All Endpoints

| # | Method | Endpoint |
|---|--------|----------|
| 1 | POST | `/api/grc/findings` |
| 2 | GET | `/api/grc/findings` |
| 3 | GET | `/api/grc/findings/:id` |
| 4 | PATCH | `/api/grc/findings/:id` |
| 5 | PATCH | `/api/grc/findings/:id/assign` |
| 6 | PATCH | `/api/grc/findings/:id/close` |
| 7 | PATCH | `/api/grc/findings/:id/reopen` |
| 8 | DELETE | `/api/grc/findings/:id` |
| 9 | GET | `/api/grc/findings/:id/history` |
| 10 | POST | `/api/grc/risks` |
| 11 | GET | `/api/grc/risks` |
| 12 | GET | `/api/grc/risks/:id` |
| 13 | PATCH | `/api/grc/risks/:id` |
| 14 | PATCH | `/api/grc/risks/:id/accept` |
| 15 | PATCH | `/api/grc/risks/:id/mitigate` |
| 16 | PATCH | `/api/grc/risks/:id/close` |
| 17 | POST | `/api/grc/tasks` |
| 18 | GET | `/api/grc/tasks` |
| 19 | GET | `/api/grc/tasks/:id` |
| 20 | PATCH | `/api/grc/tasks/:id` |
| 21 | PATCH | `/api/grc/tasks/:id/complete` |
| 22 | PATCH | `/api/grc/tasks/:id/verify` |
| 23 | POST | `/api/grc/evidence` |
| 24 | GET | `/api/grc/evidence/:id` |
| 25 | DELETE | `/api/grc/evidence/:id` |
| 26 | POST | `/api/grc/reports` |
| 27 | GET | `/api/grc/reports` |
| 28 | GET | `/api/grc/reports/:id` |
| 29 | PATCH | `/api/grc/reports/:id` |
| 30 | DELETE | `/api/grc/reports/:id` |
| 31 | POST | `/api/grc/reports/:id/findings` |
| 32 | POST | `/api/grc/reports/:id/generate` |
| 33 | GET | `/api/grc/reports/:id/download` |
| 34 | POST | `/api/grc/compliance/controls` |
| 35 | GET | `/api/grc/compliance/controls` |
| 36 | GET | `/api/grc/compliance/controls/:id` |
| 37 | PATCH | `/api/grc/compliance/controls/:id` |
| 38 | POST | `/api/grc/compliance/controls/:id/link-finding` |
| 39 | GET | `/api/grc/compliance/status` |
| 40 | POST | `/api/grc/findings/:id/retest` |
| 41 | GET | `/api/grc/findings/:id/retests` |
| 42 | GET | `/api/grc/dashboard/overview` |
| 43 | GET | `/api/grc/dashboard/risks` |
| 44 | GET | `/api/grc/dashboard/compliance` |
| 45 | GET | `/api/grc/dashboard/tasks` |
| 46 | GET | `/api/grc/dashboard/risk-heatmap` |
| 47 | GET | `/api/grc/audit-logs` |
| 48 | GET | `/api/grc/audit-logs/:entityType/:entityId` |
| 49 | GET | `/api/grc/notifications` |
| 50 | PATCH | `/api/grc/notifications/:id/read` |
| 51 | POST | `/api/grc/integrations/network/findings` |
| 52 | POST | `/api/grc/integrations/uctc/findings` |
| 53 | POST | `/api/grc/integrations/soar/incidents` |
| 54 | PATCH | `/api/grc/integrations/soar/tasks/:id` |
| 55 | POST | `/api/grc/integrations/phishing/risk` |
| 56 | POST | `/api/grc/integrations/siem/alerts` |
| 57 | POST | `/api/grc/integrations/opencti/ioc` |

---

*End of LumiSec GRC API Documentation*
