# Data Model Goals and Rationale

This document explains the purpose, design goals, and architectural rationale of the Dark-Modeler data model.

## 1. Core Purpose
Provide a unified, extensible foundation for designing, managing, and evolving data models across **conceptual**, **logical**, and **physical** layers—while preserving lineage, governance context, and system integration metadata.

## 2. Key Design Principles
1. Single Source of Truth (canonical entities + layer projections)
2. Layer Independence with Traceability
3. Extensibility Without Schema Churn (property bag + JSON columns)
4. Visual Fidelity for the Modeling Canvas (positions, visibility, theming)
5. System & Flow Awareness (source/target systems bound to objects/models)
6. Governance-Ready (domains, areas, classification hooks)
7. Automation Friendly (AI hooks, smart layout, export templating)
8. Progressive Typing (conceptual → logical → physical evolution)
9. Minimal Redundancy, Maximal Reuse
10. Future-Proofing (versioning, collaboration, lineage expansion)

## 3. Major Entities and Their Roles
| Entity | Role | Why It Exists |
| ------ | ---- | ------------- |
| `data_models` | A specific model layer instance (conceptual/logical/physical) | Organizes a modeling layer and ties into lineage via `parentModelId` |
| `data_objects` | Canonical business/data entities | Prevents duplication across layers; holds shared semantics |
| `data_model_objects` | Object-in-model projection (layout, layer config) | Supports per-model overrides (visibility, position, target system) |
| `attributes` | Canonical attribute definitions | Shared attribute metadata independent of layer |
| `data_model_attributes` | Attribute-in-model projection | Layer-specific types, ordering, key flags |
| `relationships` | Object/attribute associations | Captures both conceptual associations and physical FK mappings |
| `data_domains` / `data_areas` | Classification + governance | Ownership, thematic grouping, color coding |
| `systems` | Source/target platform registry | Enables lineage, deployment alignment, export generation |
| `color_themes` / `entity_color_assignments` | Visual semantics | Improves readability, large-model navigation, exports |
| `data_model_properties` | Flexible property bag | Extensible metadata (security, retention, SLA, etc.) |
| `configurations` | Application-level dynamic settings | Feature toggles, AI, export, UI behaviors |

## 4. Canonical vs Layer-Specific Separation
- Canonical entities: `data_objects`, `attributes` (business truth)
- Layer projections: `data_model_objects`, `data_model_attributes` (representation details)
This separation avoids copy/paste divergence and enables controlled transformation between modeling stages.

## 5. Typing Strategy
Each attribute supports progressive typing fields:
- `conceptualType` (business classification: Name, Date, Amount)
- `logicalType` (abstract implementation: VARCHAR, DECIMAL, DATE)
- `physicalType` (engine-specific: NVARCHAR(255), DECIMAL(18,2), TIMESTAMP WITH TZ)
This permits forward planning, validation, and impact analysis.

## 6. Relationship Granularity
`relationships` include:
- Level: `object` or `attribute`
- Types: `1:1`, `1:N`, `N:M`
Allows both conceptual association mapping and physical referential enforcement modeling.

## 7. Governance & Classification
- Domains group broad subject areas (e.g., Customer, Finance)
- Areas subdivide domains (e.g., Billing, Invoicing)
- Color codes and theme-aware palettes enable quick recognition and export aesthetics.

## 8. System Alignment
Objects and model projections can reference `systems` for:
- Source lineage (origin system of record)
- Target deployment (intended database/platform)
Supports forward engineering (DDL export) and integration pathway planning.

## 9. Extensibility Mechanisms
- JSON columns: `metadata`, `commonProperties`, `layerSpecificConfig`
- Property table: `data_model_properties` with typed values
Avoids frequent migrations for emergent metadata (e.g., classificationLevel, piiFlag, retentionPeriod).

## 10. Visual Modeling Support
- Coordinates in `position`
- Visibility toggling (`isVisible`)
- Ordering via `orderIndex`
- Theming via `color_themes` & `entity_color_assignments`
This tight coupling enables deterministic exports and reproducible auto-layout algorithms.

## 11. Automation & AI Hooks
Fields like `isNew`, `commonProperties`, layered typing, and system mappings feed AI-driven:
- Naming standardization
- Attribute inference
- Relationship suggestions
- Target type optimization

## 12. Change Tracking & Audit Readiness
All core tables include `createdAt` / `updatedAt`. Separation of canonical vs projection supports diffing:
- Compare conceptual vs logical drift
- Validate physical conformance to logical constraints.

## 13. Example Lifecycle
1. Create conceptual model with high-level entities & associations.
2. Refine to logical model: normalize, constrain, specify logical datatypes.
3. Generate physical model: vendor-specific physical types + deployment mapping.
4. Apply theming and domain classification.
5. Export diagrams/DDL and enrich with governance properties.

## 14. Future Extension Ideas
| Area | Potential Enhancement |
| ---- | --------------------- |
| Versioning | Append history tables or add semantic version fields |
| Collaboration | Row-level locking, user audit fields |
| Lineage Graph | Derived flow maps from system and relationship metadata |
| Policy Integration | Attach security classification & retention policies |
| Plugin System | Custom property resolvers & export adapters |
| Impact Analysis | Dependency traversal across layered projections |

## 15. Summary
This schema balances normalization, modeling flexibility, UI responsiveness, and future extensibility. It is intentionally abstract where evolution is expected and explicit where integrity matters (relationships, typing, system references).

Let us know if you want: a UML diagram, ERD export strategy, versioning patterns, or lineage augmentation—these can be added next.
